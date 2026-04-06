import React, { useState, useEffect, useRef } from 'react';

const S = {
  IDLE:       'idle',
  RESOLVING:  'resolving',
  KNOCKING:   'knocking',
  CONNECTING: 'connecting',
  OPEN:       'open',
  OFFLINE:    'offline',
  NOT_FOUND:  'not_found',
  ERROR:      'error',
};

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function StatusScreen({ state, handle, peerId, error, dhtPeers, onRetry }) {
  const configs = {
    [S.IDLE]:       { icon: '⬡', color: '#555',    title: 'Ready' },
    [S.RESOLVING]:  { icon: '⬡', color: '#64c8ff', title: 'Resolving…',            sub: `searching DHT for @${handle}` },
    [S.KNOCKING]:   { icon: '⬡', color: '#64c8ff', title: 'Knocking…',             sub: 'peer found · announcing on mesh' },
    [S.CONNECTING]: { icon: '⬡', color: '#00ffcc', title: 'Connecting…',           sub: 'WebRTC handshake in progress' },
    [S.OPEN]:       { icon: '●', color: '#00ffcc', title: `@${handle}`,            sub: peerId?.slice(0,24) + '…' },
    [S.OFFLINE]:    { icon: '○', color: '#555',    title: `@${handle} is offline`, sub: 'peer found on DHT but not reachable' },
    [S.NOT_FOUND]:  { icon: '⬡', color: '#555',    title: `@${handle} not found`,  sub: `not on DHT · ${dhtPeers} peer${dhtPeers===1?'':'s'} searched` },
    [S.ERROR]:      { icon: '⚠', color: '#ff6b35', title: 'Connection failed',     sub: error },
  };
  const cfg = configs[state] || configs[S.IDLE];

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20, background:'#080808', fontFamily:"'Syne', system-ui, sans-serif" }}>
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none"
        style={{ opacity:[S.RESOLVING,S.KNOCKING,S.CONNECTING].includes(state)?1:0.35, animation:[S.RESOLVING,S.KNOCKING,S.CONNECTING].includes(state)?'meshPulse 2s ease-in-out infinite':'none' }}>
        <circle cx="32" cy="32" r="8" fill={cfg.color} opacity="0.9"/>
        <circle cx="8"  cy="8"  r="5" fill="#64c8ff" opacity="0.4"/>
        <circle cx="56" cy="8"  r="5" fill="#64c8ff" opacity="0.4"/>
        <circle cx="8"  cy="56" r="5" fill="#64c8ff" opacity="0.4"/>
        <circle cx="56" cy="56" r="5" fill="#64c8ff" opacity="0.4"/>
        <path d="M12 12L25 25M52 12L39 25M12 52L25 39M52 52L39 39" stroke="#64c8ff" strokeWidth="1.5" opacity="0.25"/>
      </svg>
      <div style={{ textAlign:'center' }}>
        <p style={{ fontSize:20, fontWeight:700, color:cfg.color, letterSpacing:'-0.01em' }}>{cfg.icon} {cfg.title}</p>
        {cfg.sub && <p style={{ fontSize:12, color:'#555', marginTop:8, fontFamily:'monospace' }}>{cfg.sub}</p>}
      </div>
      {[S.OFFLINE,S.NOT_FOUND,S.ERROR].includes(state) && (
        <button onClick={onRetry}
          style={{ padding:'8px 24px', borderRadius:999, background:'transparent', border:'1px solid rgba(255,255,255,0.1)', color:'#888', fontSize:12, cursor:'pointer', fontFamily:'monospace', transition:'all 0.15s' }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.25)';e.currentTarget.style.color='#e8e8e8';}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.1)';e.currentTarget.style.color='#888';}}>
          retry
        </button>
      )}
      <style>{`@keyframes meshPulse{0%,100%{opacity:0.6;transform:scale(1)}50%{opacity:1;transform:scale(1.05)}}`}</style>
    </div>
  );
}

// Renders HTML content received from peer in a sandboxed iframe
function MeshContent({ html, handle, peerId }) {
  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#080808' }}>
      {/* Connection badge */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
        <span style={{ color:'#00ffcc', fontSize:10 }}>●</span>
        <span style={{ fontSize:10, color:'#555', fontFamily:'monospace' }}>
          @{handle}.unsync · P2P · {peerId?.slice(0,20)}…
        </span>
        <span style={{ marginLeft:'auto', fontSize:9, color:'#333', fontFamily:'monospace' }}>DHT + WebRTC · no servers</span>
      </div>
      <iframe
        src={url}
        sandbox="allow-scripts allow-same-origin"
        style={{ flex:1, border:'none', background:'#fff' }}
        title={`@${handle}.unsync`}
      />
    </div>
  );
}

export default function MeshPage({ handle }) {
  const [state,    setState]    = useState(S.RESOLVING);
  const [html,     setHtml]     = useState(null);
  const [error,    setError]    = useState(null);
  const [peerId,   setPeerId]   = useState(null);
  const [dhtPeers, setDhtPeers] = useState(0);

  const pcRef      = useRef(null);
  const dcRef      = useRef(null);
  const remoteSet  = useRef(false);
  const pendingIce = useRef([]);
  const targetRef  = useRef(null);

  const cleanup = () => {
    dcRef.current?.close();
    pcRef.current?.close();
    dcRef.current = null;
    pcRef.current = null;
    remoteSet.current = false;
    pendingIce.current = [];
  };

  const flushIce = async () => {
    if (!pcRef.current || !remoteSet.current) return;
    for (const c of pendingIce.current) {
      try { await pcRef.current.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
    pendingIce.current = [];
  };

  // ── Caller side ──────────────────────────────────────────────
  const initiateConnection = async (remotePeerId) => {
    cleanup();
    targetRef.current = remotePeerId;
    setState(S.CONNECTING);

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    const dc = pc.createDataChannel('unsync', { ordered: true });
    dcRef.current = dc;

    let responseBuffer = '';

    dc.onopen = () => {
      setState(S.OPEN);
      dc.send(JSON.stringify({ type: 'request', path: '/' }));
    };

    dc.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'response_start') { responseBuffer = ''; return; }
        if (msg.type === 'response_chunk') { responseBuffer += msg.chunk; return; }
        if (msg.type === 'response_end')   { setHtml(responseBuffer); return; }
        if (msg.type === 'response')       { setHtml(atob(msg.data)); return; }
      } catch { setHtml(e.data); }
    };

    dc.onerror = () => { setState(S.ERROR); setError('Data channel error'); };
    dc.onclose = () => { if (state !== S.OPEN) setState(S.OFFLINE); };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) window.electronAPI.meshSend({ type:'ice', to:remotePeerId, candidate:candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (['failed','disconnected'].includes(pc.connectionState)) { setState(S.ERROR); setError('WebRTC failed'); }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    window.electronAPI.meshSend({ type:'offer', to:remotePeerId, sdp:pc.localDescription });
  };

  // ── Receiver side ────────────────────────────────────────────
  const handleIncomingOffer = async (fromPeerId, offerSdp) => {
    cleanup();
    targetRef.current = fromPeerId;
    setState(S.CONNECTING);

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.ondatachannel = ({ channel }) => {
      dcRef.current = channel;
      channel.onopen = () => setState(S.OPEN);

      channel.onmessage = async (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'request') {
            // Ask main process to serve the content
            const result = await window.electronAPI.serveRequest(msg.path || '/');
            // Send as base64 — data channel is text-only
            channel.send(JSON.stringify({
              type: 'response',
              mime: result.mime,
              data: result.data, // already base64 from main
            }));
          }
        } catch {}
      };
      channel.onerror = () => setState(S.ERROR);
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) window.electronAPI.meshSend({ type:'ice', to:fromPeerId, candidate:candidate.toJSON() });
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
    remoteSet.current = true;
    await flushIce();

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    window.electronAPI.meshSend({ type:'answer', to:fromPeerId, sdp:pc.localDescription });
  };

  // ── Signal handler ───────────────────────────────────────────
  useEffect(() => {
    const handler = async (msg) => {
      const target = targetRef.current;

      if (msg.type === 'answer' && msg.from === target) {
        try {
          await pcRef.current?.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          remoteSet.current = true;
          await flushIce();
        } catch (e) { setError(e.message); setState(S.ERROR); }
        return;
      }
      if (msg.type === 'ice' && msg.from === target) {
        if (remoteSet.current) {
          try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {}
        } else { pendingIce.current.push(msg.candidate); }
        return;
      }
      if (msg.type === 'offer') {
        await handleIncomingOffer(msg.from, msg.sdp);
        return;
      }
    };
    window.electronAPI.onMeshSignal(handler);
  }, []);

  // ── Start ────────────────────────────────────────────────────
  const start = async () => {
    setError(null);
    setHtml(null);
    setPeerId(null);
    setState(S.RESOLVING);

    const stats = await window.electronAPI.dhtStats();
    setDhtPeers(stats.peers);

    const resolved = await window.electronAPI.dhtResolve(handle);
    if (!resolved.found) { setState(S.NOT_FOUND); return; }

    setPeerId(resolved.peerId);
    targetRef.current = resolved.peerId;

    setState(S.KNOCKING);
    const knock = await window.electronAPI.meshKnock(resolved.peerId);
    if (!knock.online) { setState(S.OFFLINE); return; }

    await initiateConnection(resolved.peerId);
  };

  useEffect(() => {
    let cancelled = false;
    start().catch(e => { if (!cancelled) { setError(e.message); setState(S.ERROR); }});
    return () => { cancelled = true; cleanup(); };
  }, [handle]);

  // If open and we have HTML — render it
  if (state === S.OPEN && html) {
    return <MeshContent html={html} handle={handle} peerId={peerId} />;
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', width:'100%', height:'100%' }}>
      <StatusScreen state={state} handle={handle} peerId={peerId} error={error} dhtPeers={dhtPeers} onRetry={start} />
    </div>
  );
}
