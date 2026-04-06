import React, { useState, useEffect, useRef } from 'react';

// ── States ──────────────────────────────────────────────────────
const S = {
  IDLE:        'idle',
  KNOCKING:    'knocking',
  CONNECTING:  'connecting',
  OPEN:        'open',
  OFFLINE:     'offline',
  ERROR:       'error',
};

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// ── Status UI ───────────────────────────────────────────────────
function StatusScreen({ state, handle, peerId, error, content, onRetry }) {
  const configs = {
    [S.IDLE]:       { icon: '⬡', color: '#555',     title: 'Ready',                  sub: null },
    [S.KNOCKING]:   { icon: '⬡', color: '#64c8ff',  title: 'Knocking…',              sub: `looking for @${handle} on the mesh` },
    [S.CONNECTING]: { icon: '⬡', color: '#00ffcc',  title: 'Connecting…',            sub: 'WebRTC handshake in progress' },
    [S.OPEN]:       { icon: '●', color: '#00ffcc',  title: `@${handle}`,             sub: peerId?.slice(0, 24) + '…' },
    [S.OFFLINE]:    { icon: '○', color: '#555',     title: `@${handle} is offline`,  sub: 'peer not reachable on mesh' },
    [S.ERROR]:      { icon: '⚠', color: '#ff6b35',  title: 'Connection failed',      sub: error || 'unknown error' },
  };

  const cfg = configs[state] || configs[S.IDLE];

  // If open and we have content, render it
  if (state === S.OPEN && content) {
    return (
      <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#080808', color:'#e8e8e8', fontFamily:'monospace', padding:32, gap:16, overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, paddingBottom:16, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ color:'#00ffcc', fontSize:12 }}>●</span>
          <span style={{ fontSize:12, color:'#555' }}>@{handle}.unsync · live mesh connection</span>
        </div>
        <pre style={{ whiteSpace:'pre-wrap', wordBreak:'break-word', fontSize:13, lineHeight:1.6, color:'#e8e8e8' }}>
          {content}
        </pre>
      </div>
    );
  }

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20, background:'#080808', fontFamily:"'Syne', system-ui, sans-serif" }}>
      {/* Animated mesh glyph */}
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none"
        style={{ opacity: [S.KNOCKING, S.CONNECTING].includes(state) ? 1 : 0.4,
                 animation: [S.KNOCKING, S.CONNECTING].includes(state) ? 'meshPulse 2s ease-in-out infinite' : 'none' }}>
        <circle cx="32" cy="32" r="8" fill={cfg.color} opacity="0.9"/>
        <circle cx="8"  cy="8"  r="5" fill="#64c8ff" opacity="0.4"/>
        <circle cx="56" cy="8"  r="5" fill="#64c8ff" opacity="0.4"/>
        <circle cx="8"  cy="56" r="5" fill="#64c8ff" opacity="0.4"/>
        <circle cx="56" cy="56" r="5" fill="#64c8ff" opacity="0.4"/>
        <path d="M12 12L25 25M52 12L39 25M12 52L25 39M52 52L39 39"
          stroke="#64c8ff" strokeWidth="1.5" opacity="0.25"/>
      </svg>

      <div style={{ textAlign:'center' }}>
        <p style={{ fontSize:20, fontWeight:700, color: cfg.color, letterSpacing:'-0.01em' }}>
          {cfg.icon} {cfg.title}
        </p>
        {cfg.sub && <p style={{ fontSize:12, color:'#555', marginTop:8, fontFamily:'monospace' }}>{cfg.sub}</p>}
      </div>

      {[S.OFFLINE, S.ERROR].includes(state) && (
        <button onClick={onRetry}
          style={{ padding:'8px 24px', borderRadius:999, background:'transparent', border:'1px solid rgba(255,255,255,0.1)', color:'#888', fontSize:12, cursor:'pointer', fontFamily:'monospace', transition:'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.25)'; e.currentTarget.style.color='#e8e8e8'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.1)'; e.currentTarget.style.color='#888'; }}>
          retry
        </button>
      )}

      <style>{`
        @keyframes meshPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}

// ── Main MeshPage component ──────────────────────────────────────
export default function MeshPage({ handle, targetPeerId }) {
  const [state,   setState]   = useState(S.IDLE);
  const [content, setContent] = useState(null);
  const [error,   setError]   = useState(null);

  const pcRef      = useRef(null);  // RTCPeerConnection
  const dcRef      = useRef(null);  // RTCDataChannel
  const ownPeerId  = useRef(null);
  const pendingIce = useRef([]);    // buffer ICE until remote desc set
  const remoteSet  = useRef(false);

  const cleanup = () => {
    dcRef.current?.close();
    pcRef.current?.close();
    dcRef.current = null;
    pcRef.current = null;
    remoteSet.current = false;
    pendingIce.current = [];
  };

  // ── Flush buffered ICE candidates ───────────────────────────
  const flushIce = async () => {
    if (!pcRef.current || !remoteSet.current) return;
    for (const c of pendingIce.current) {
      try { await pcRef.current.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
    pendingIce.current = [];
  };

  // ── Initiate connection (caller side) ───────────────────────
  const initiateConnection = async (remotePeerId) => {
    cleanup();
    setState(S.CONNECTING);

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    // Create data channel (caller creates it)
    const dc = pc.createDataChannel('unsync', { ordered: true });
    dcRef.current = dc;

    dc.onopen = () => {
      setState(S.OPEN);
      // Request content from peer
      dc.send(JSON.stringify({ type: 'request', path: '/' }));
    };

    dc.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'response') setContent(msg.body);
      } catch {
        setContent(e.data);
      }
    };

    dc.onerror = () => setState(S.ERROR);
    dc.onclose = () => { if (state === S.OPEN) setState(S.OFFLINE); };

    // ICE candidate → relay via signaling
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        window.electronAPI.meshSend({
          type: 'ice', to: remotePeerId,
          candidate: candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected'].includes(pc.connectionState)) {
        setState(S.ERROR);
        setError('WebRTC connection failed');
      }
    };

    // Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    window.electronAPI.meshSend({ type: 'offer', to: remotePeerId, sdp: pc.localDescription });
  };

  // ── Handle incoming signal (answer / ICE from peer) ─────────
  useEffect(() => {
    const handler = async (msg) => {
      if (!pcRef.current) return;

      if (msg.type === 'answer' && msg.from === targetPeerId) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          remoteSet.current = true;
          await flushIce();
        } catch (e) {
          setError(e.message);
          setState(S.ERROR);
        }
        return;
      }

      if (msg.type === 'ice' && msg.from === targetPeerId) {
        if (remoteSet.current) {
          try { await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {}
        } else {
          pendingIce.current.push(msg.candidate);
        }
        return;
      }

      // Incoming knock — someone wants to connect TO us (server side)
      if (msg.type === 'knock' && msg.from === targetPeerId) {
        await handleIncomingConnection(msg.from);
        return;
      }

      // Incoming offer — we are the server
      if (msg.type === 'offer' && msg.from === targetPeerId) {
        await handleIncomingOffer(msg.from, msg.sdp);
        return;
      }
    };

    window.electronAPI.onMeshSignal(handler);
    return () => {}; // cleanup handled by Electron IPC listener lifecycle
  }, [targetPeerId]);

  // ── Handle incoming connection (we are the server) ───────────
  const handleIncomingConnection = async (remotePeerId) => {
    // Just wait for the offer — it'll come right after the knock
  };

  const handleIncomingOffer = async (remotePeerId, offerSdp) => {
    cleanup();
    setState(S.CONNECTING);

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.ondatachannel = ({ channel }) => {
      dcRef.current = channel;

      channel.onopen = () => setState(S.OPEN);

      channel.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'request') {
            // Serve our identity page
            channel.send(JSON.stringify({
              type: 'response',
              body: `@${handle} · UnSync mesh node\npeerId: ${targetPeerId}\nstatus: online\n\nHello from the mesh! 👋`,
            }));
          }
        } catch {}
      };

      channel.onerror = () => setState(S.ERROR);
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        window.electronAPI.meshSend({ type: 'ice', to: remotePeerId, candidate: candidate.toJSON() });
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
    remoteSet.current = true;
    await flushIce();

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    window.electronAPI.meshSend({ type: 'answer', to: remotePeerId, sdp: pc.localDescription });
  };

  // ── Kick off connection on mount ────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      ownPeerId.current = await window.electronAPI.getPeerId();

      setState(S.KNOCKING);
      const result = await window.electronAPI.meshKnock(targetPeerId);

      if (cancelled) return;

      if (!result.online) {
        setState(S.OFFLINE);
        return;
      }

      await initiateConnection(targetPeerId);
    };

    start().catch(e => { setError(e.message); setState(S.ERROR); });

    return () => { cancelled = true; cleanup(); };
  }, [targetPeerId]);

  return (
    <div style={{ display:'flex', flexDirection:'column', width:'100%', height:'100%' }}>
      <StatusScreen
        state={state} handle={handle}
        peerId={targetPeerId} error={error}
        content={content}
        onRetry={() => {
          setError(null);
          setContent(null);
          setState(S.IDLE);
          window.electronAPI.meshKnock(targetPeerId).then(r => {
            if (r.online) initiateConnection(targetPeerId);
            else setState(S.OFFLINE);
          });
        }}
      />
    </div>
  );
}
