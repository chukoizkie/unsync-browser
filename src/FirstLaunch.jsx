import React, { useState } from 'react';

export default function FirstLaunch({ onComplete }) {
  const [handle, setHandle]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const isValid = /^[a-z0-9_]{3,24}$/.test(handle);

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      const identity = await window.electronAPI.createIdentity(handle);
      onComplete(identity);
    } catch (e) {
      setError(e.message || 'Failed to create identity');
      setLoading(false);
    }
  };

  return (
    <div style={{
      width:'100%', height:'100%', background:'#080808',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      gap:32, fontFamily:"'Syne', system-ui, sans-serif",
    }}>
      {/* Mesh glyph */}
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
        <circle cx="36" cy="36" r="9" fill="#00ffcc" opacity="0.9"/>
        <circle cx="9"  cy="9"  r="5.5" fill="#64c8ff" opacity="0.5"/>
        <circle cx="63" cy="9"  r="5.5" fill="#64c8ff" opacity="0.5"/>
        <circle cx="9"  cy="63" r="5.5" fill="#64c8ff" opacity="0.5"/>
        <circle cx="63" cy="63" r="5.5" fill="#64c8ff" opacity="0.5"/>
        <path d="M13 13L28 28M59 13L44 28M13 59L28 44M59 59L44 44"
          stroke="#64c8ff" strokeWidth="1.5" opacity="0.3"/>
      </svg>

      <div style={{ textAlign:'center' }}>
        <p style={{ fontSize:26, fontWeight:700, color:'#e8e8e8', letterSpacing:'-0.02em' }}>
          Welcome to UnSync
        </p>
        <p style={{ fontSize:13, color:'#555', marginTop:8, fontFamily:'monospace' }}>
          Choose your mesh handle. You can't change it later.
        </p>
      </div>

      {/* Handle input */}
      <div style={{ display:'flex', flexDirection:'column', gap:10, width:320 }}>
        <div style={{
          display:'flex', alignItems:'center',
          background:'#000', border:`1px solid ${error ? '#ff6b35' : handle && isValid ? '#00ffcc44' : 'rgba(255,255,255,0.08)'}`,
          borderRadius:999, padding:'0 20px', height:52,
          transition:'border-color 0.2s',
        }}>
          <span style={{ color:'#00ffcc', fontFamily:'monospace', fontSize:18, marginRight:2 }}>@</span>
          <input
            value={handle}
            onChange={e => { setHandle(e.target.value.toLowerCase()); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && isValid && !loading && handleSubmit()}
            placeholder="yourhandle"
            maxLength={24}
            autoFocus
            spellCheck={false}
            style={{
              flex:1, background:'transparent', border:'none', outline:'none',
              color:'#e8e8e8', fontFamily:'monospace', fontSize:16,
            }}
          />
        </div>

        <p style={{ fontSize:11, color: handle && !isValid ? '#ff6b35' : '#444', fontFamily:'monospace', paddingLeft:16 }}>
          {handle && !isValid
            ? '3–24 chars, lowercase letters, numbers, underscores only'
            : '3–24 chars · lowercase · letters, numbers, _ only'}
        </p>

        {error && <p style={{ fontSize:12, color:'#ff6b35', paddingLeft:16, fontFamily:'monospace' }}>{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={!isValid || loading}
          style={{
            marginTop:8, height:48, borderRadius:999,
            background: isValid && !loading ? '#00ffcc' : '#1a1a1a',
            border:'none', cursor: isValid && !loading ? 'pointer' : 'default',
            color: isValid && !loading ? '#080808' : '#333',
            fontSize:14, fontWeight:700, fontFamily:"'Syne', system-ui, sans-serif",
            letterSpacing:'0.04em', transition:'all 0.2s',
          }}
        >
          {loading ? 'Generating identity…' : 'Claim @' + (handle || 'handle')}
        </button>
      </div>

      <p style={{ fontSize:11, color:'#333', fontFamily:'monospace' }}>
        Your identity is stored locally. Never leaves your device.
      </p>
    </div>
  );
}
