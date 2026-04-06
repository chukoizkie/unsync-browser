// UnSync Browser — Kademlia-lite in-memory DHT
// No central registry. Peers gossip handle→peerId mappings.

const ENTRY_TTL    = 30 * 60 * 1000; // 30 minutes
const MAX_PEERS    = 50;
const MAX_STORE    = 500;
const QUERY_TTL    = 3;               // max hops for dht_find
const QUERY_TIMEOUT = 8000;           // ms before giving up

class DHT {
  constructor() {
    this.store      = new Map(); // handle → { peerId, timestamp, expires }
    this.peers      = new Map(); // peerId → sendFn (data channel send)
    this.queries    = new Map(); // queryId → { resolve, timeout, handle }
    this.ownHandle  = null;
    this.ownPeerId  = null;
  }

  // ── Init ──────────────────────────────────────────────────────
  init(handle, peerId) {
    this.ownHandle = handle;
    this.ownPeerId = peerId;
    // Announce self immediately
    this._announceToAll();
  }

  // ── Peer management ──────────────────────────────────────────
  addPeer(peerId, sendFn) {
    if (peerId === this.ownPeerId) return;
    if (this.peers.size >= MAX_PEERS) {
      // Drop oldest peer (first in map)
      const first = this.peers.keys().next().value;
      this.peers.delete(first);
    }
    this.peers.set(peerId, sendFn);
    // Announce ourselves to the new peer
    this._sendTo(peerId, {
      type:      'dht_announce',
      handle:    this.ownHandle,
      peerId:    this.ownPeerId,
      timestamp: Date.now(),
    });
    // Also send our known store to the new peer (gossip bootstrap)
    this._gossipStoreTo(peerId);
  }

  removePeer(peerId) {
    this.peers.delete(peerId);
  }

  // ── Store ────────────────────────────────────────────────────
  _storeEntry(handle, peerId, timestamp) {
    if (!handle || !peerId) return;
    if (this.store.size >= MAX_STORE) {
      // Evict oldest
      const first = this.store.keys().next().value;
      this.store.delete(first);
    }
    this.store.set(handle, {
      peerId,
      timestamp,
      expires: Date.now() + ENTRY_TTL,
    });
  }

  _getEntry(handle) {
    const entry = this.store.get(handle);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.store.delete(handle);
      return null;
    }
    return entry;
  }

  // ── Announce ─────────────────────────────────────────────────
  _announceToAll() {
    const msg = {
      type:      'dht_announce',
      handle:    this.ownHandle,
      peerId:    this.ownPeerId,
      timestamp: Date.now(),
    };
    for (const peerId of this.peers.keys()) this._sendTo(peerId, msg);
  }

  _gossipStoreTo(targetPeerId) {
    // Send up to 20 known entries to bootstrap the new peer
    let count = 0;
    for (const [handle, entry] of this.store.entries()) {
      if (count++ > 20) break;
      if (Date.now() > entry.expires) continue;
      this._sendTo(targetPeerId, {
        type:      'dht_announce',
        handle,
        peerId:    entry.peerId,
        timestamp: entry.timestamp,
      });
    }
  }

  // ── Resolve ──────────────────────────────────────────────────
  resolve(handle) {
    return new Promise((resolve) => {
      // 1. Check own store first
      const cached = this._getEntry(handle);
      if (cached) return resolve({ found: true, peerId: cached.peerId, handle });

      // 2. Check if it's ourselves
      if (handle === this.ownHandle) return resolve({ found: true, peerId: this.ownPeerId, handle });

      // 3. No peers — can't resolve
      if (this.peers.size === 0) return resolve({ found: false, handle });

      // 4. Broadcast dht_find to all peers
      const queryId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const timeout = setTimeout(() => {
        this.queries.delete(queryId);
        resolve({ found: false, handle });
      }, QUERY_TIMEOUT);

      this.queries.set(queryId, { resolve, timeout, handle });

      const msg = { type: 'dht_find', handle, queryId, ttl: QUERY_TTL };
      for (const peerId of this.peers.keys()) this._sendTo(peerId, msg);
    });
  }

  // ── Handle incoming DHT messages ─────────────────────────────
  handleMessage(fromPeerId, msg) {
    switch (msg.type) {

      case 'dht_announce': {
        // Store the mapping, gossip forward to peers who don't have it
        const existing = this.store.get(msg.handle);
        if (!existing || msg.timestamp > existing.timestamp) {
          this._storeEntry(msg.handle, msg.peerId, msg.timestamp);
          // Gossip to other peers (minus sender)
          for (const peerId of this.peers.keys()) {
            if (peerId !== fromPeerId) this._sendTo(peerId, msg);
          }
        }
        break;
      }

      case 'dht_find': {
        if (msg.ttl <= 0) return;
        const handle = msg.handle;

        // Do we have it?
        const entry = this._getEntry(handle);
        const isUs  = handle === this.ownHandle;

        if (entry || isUs) {
          // Respond with found
          this._sendTo(fromPeerId, {
            type:    'dht_found',
            handle,
            peerId:  isUs ? this.ownPeerId : entry.peerId,
            queryId: msg.queryId,
          });
          return;
        }

        // Forward to other peers with decremented TTL
        const forward = { ...msg, ttl: msg.ttl - 1 };
        for (const peerId of this.peers.keys()) {
          if (peerId !== fromPeerId) this._sendTo(peerId, forward);
        }
        break;
      }

      case 'dht_found': {
        // Store it and resolve pending query
        this._storeEntry(msg.handle, msg.peerId, Date.now());
        const query = this.queries.get(msg.queryId);
        if (query) {
          clearTimeout(query.timeout);
          this.queries.delete(msg.queryId);
          query.resolve({ found: true, peerId: msg.peerId, handle: msg.handle });
        }
        // Also gossip the found mapping to all peers
        for (const peerId of this.peers.keys()) {
          if (peerId !== fromPeerId) {
            this._sendTo(peerId, {
              type:      'dht_announce',
              handle:    msg.handle,
              peerId:    msg.peerId,
              timestamp: Date.now(),
            });
          }
        }
        break;
      }

      case 'dht_not_found': {
        // Only resolve if no other peer answered
        const query = this.queries.get(msg.queryId);
        if (query) {
          // Don't resolve yet — wait for timeout or another peer to answer
        }
        break;
      }
    }
  }

  // ── Send helper ──────────────────────────────────────────────
  _sendTo(peerId, msg) {
    const sendFn = this.peers.get(peerId);
    if (!sendFn) return;
    try { sendFn(JSON.stringify(msg)); } catch {}
  }

  // ── Debug info ───────────────────────────────────────────────
  stats() {
    return {
      peers:   this.peers.size,
      entries: this.store.size,
      queries: this.queries.size,
    };
  }
}

// Singleton
const dht = new DHT();
module.exports = dht;
