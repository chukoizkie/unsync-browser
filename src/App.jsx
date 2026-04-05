import React, { useState, useRef, useEffect, useCallback } from 'react';

const IconBack    = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconForward = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconReload  = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 2.5A5.5 5.5 0 1 1 6.5 1H10M10 1v3.5M10 1H6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconStop    = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>;
const IconLock    = () => <svg width="10" height="11" viewBox="0 0 10 11" fill="none"><rect x="1.5" y="4.5" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2"/><path d="M3 4.5V3a2 2 0 0 1 4 0v1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>;
const IconMesh    = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="2" fill="currentColor"/><circle cx="1.5" cy="1.5" r="1.2" fill="currentColor" opacity="0.6"/><circle cx="10.5" cy="1.5" r="1.2" fill="currentColor" opacity="0.6"/><circle cx="1.5" cy="10.5" r="1.2" fill="currentColor" opacity="0.6"/><circle cx="10.5" cy="10.5" r="1.2" fill="currentColor" opacity="0.6"/><path d="M2.5 2.5L4.5 4.5M9.5 2.5L7.5 4.5M2.5 9.5L4.5 7.5M9.5 9.5L7.5 7.5" stroke="currentColor" strokeWidth="0.8" opacity="0.4"/></svg>;

const HOME_URL = 'https://unsync.uk';
let tabIdCounter = 0;

function makeTab(url = HOME_URL) {
  return { id: ++tabIdCounter, url, displayUrl: url, title: 'New Tab', loading: false, canGoBack: false, canGoForward: false };
}

function normalizeUrl(input) {
  const t = input.trim();
  if (!t) return HOME_URL;
  if (t.endsWith('.unsync') || t.startsWith('unsync://')) return t;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[a-z0-9-]+\.[a-z]{2,}/i.test(t)) return `https://${t}`;
  return `https://search.brave.com/search?q=${encodeURIComponent(t)}`;
}

function NavBtn({ children, onClick, disabled, title }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:'999px', background:'transparent', border:'none', cursor: disabled ? 'default' : 'pointer', color: disabled ? 'var(--text-dim)' : 'var(--text-secondary)', transition:'all 0.12s ease', flexShrink:0 }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background='rgba(255,255,255,0.07)'; e.currentTarget.style.color='var(--text-primary)'; }}}
      onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color= disabled ? 'var(--text-dim)' : 'var(--text-secondary)'; }}>
      {children}
    </button>
  );
}

function TrafficLight({ color, onClick, title }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ width:12, height:12, borderRadius:'50%', background:color, border:'none', cursor:'pointer', opacity: hov ? 1 : 0.75, transition:'all 0.1s', transform: hov ? 'scale(1.1)' : 'scale(1)', boxShadow: hov ? `0 0 6px ${color}88` : 'none' }}
    />
  );
}

function TitleBar() {
  const ctrl = window.electronAPI;
  return (
    <div style={{ display:'flex', alignItems:'center', height:'var(--titlebar-h)', padding:'0 12px', WebkitAppRegion:'drag', flexShrink:0, borderBottom:'1px solid var(--border-subtle)' }}>
      <div style={{ display:'flex', gap:6, WebkitAppRegion:'no-drag', flexShrink:0 }}>
        <TrafficLight color="#ff5f57" onClick={() => ctrl?.windowClose()}    title="Close" />
        <TrafficLight color="#febc2e" onClick={() => ctrl?.windowMinimize()} title="Minimize" />
        <TrafficLight color="#28c840" onClick={() => ctrl?.windowMaximize()} title="Maximize" />
      </div>
      <div style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center', gap:6 }}>
        <span style={{ color:'var(--accent-mesh)', display:'flex', alignItems:'center' }}><IconMesh /></span>
        <span style={{ fontSize:11, fontWeight:600, color:'var(--text-dim)', fontFamily:'var(--font-ui)', letterSpacing:'0.08em', textTransform:'uppercase' }}>UnSync</span>
      </div>
      <div style={{ width:58, flexShrink:0 }} />
    </div>
  );
}

function TabItem({ tab, active, onActivate, onClose }) {
  return (
    <div onClick={onActivate}
      style={{ display:'flex', alignItems:'center', gap:6, height:28, padding:'0 10px 0 12px', borderRadius:'8px 8px 0 0', background: active ? 'var(--bg-surface)' : 'transparent', border: active ? '1px solid var(--border-subtle)' : '1px solid transparent', borderBottom: active ? '1px solid var(--bg-surface)' : 'none', color: active ? 'var(--text-primary)' : 'var(--text-dim)', cursor:'pointer', fontSize:11, fontFamily:'var(--font-ui)', fontWeight: active ? 500 : 400, transition:'all 0.15s ease', userSelect:'none', maxWidth:180, minWidth:80 }}>
      <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tab.title || 'Loading…'}</span>
      <button onClick={e => { e.stopPropagation(); onClose(); }}
        style={{ display:'flex', alignItems:'center', justifyContent:'center', width:16, height:16, borderRadius:4, background:'transparent', border:'none', cursor:'pointer', color:'var(--text-dim)', flexShrink:0 }}
        onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'}
        onMouseLeave={e => e.currentTarget.style.background='transparent'}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
      </button>
    </div>
  );
}

function FloatingIsland({ tab, onNavigate, onBack, onForward, onReload, onStop }) {
  const [inputValue, setInputValue] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { if (!focused) setInputValue(tab?.displayUrl || ''); }, [tab?.displayUrl, focused]);

  const handleKeyDown = e => {
    if (e.key === 'Enter') { inputRef.current?.blur(); onNavigate(normalizeUrl(inputValue)); }
    if (e.key === 'Escape') { setInputValue(tab?.displayUrl || ''); inputRef.current?.blur(); }
  };

  const isSecure  = tab?.displayUrl?.startsWith('https://');
  const isMesh    = tab?.displayUrl?.includes('.unsync');
  const isLoading = tab?.loading;

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'10px 16px 8px', WebkitAppRegion:'drag' }}>
      <div style={{ display:'flex', alignItems:'center', gap:0, height:'var(--island-h)', background:'var(--island-bg)', border:`1px solid ${focused ? 'rgba(100,200,255,0.22)' : 'var(--island-border)'}`, borderRadius:'var(--radius-pill)', boxShadow: focused ? '0 8px 40px rgba(0,0,0,0.9), 0 0 0 1px rgba(100,200,255,0.15)' : 'var(--island-shadow)', width:'100%', maxWidth:720, overflow:'hidden', transition:'border-color 0.2s ease, box-shadow 0.2s ease', WebkitAppRegion:'no-drag' }}>

        <div style={{ display:'flex', alignItems:'center', padding:'0 4px 0 8px', gap:0, flexShrink:0 }}>
          <NavBtn onClick={onBack}    disabled={!tab?.canGoBack}    title="Back"><IconBack /></NavBtn>
          <NavBtn onClick={onForward} disabled={!tab?.canGoForward} title="Forward"><IconForward /></NavBtn>
          <NavBtn onClick={isLoading ? onStop : onReload}           title={isLoading ? 'Stop' : 'Reload'}>
            {isLoading ? <IconStop /> : <IconReload />}
          </NavBtn>
        </div>

        <div style={{ width:1, height:18, background:'var(--border-subtle)', flexShrink:0 }} />

        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, flexShrink:0, color: isMesh ? 'var(--accent-mesh)' : isSecure ? 'var(--accent-cyan)' : 'var(--text-dim)' }}>
          {isMesh ? <IconMesh /> : <IconLock />}
        </div>

        <input ref={inputRef}
          value={focused ? inputValue : (tab?.displayUrl || '')}
          onChange={e => setInputValue(e.target.value)}
          onFocus={() => { setFocused(true); setInputValue(tab?.displayUrl || ''); setTimeout(() => inputRef.current?.select(), 0); }}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="Search or enter .unsync address"
          spellCheck={false} autoComplete="off"
          style={{ flex:1, background:'transparent', border:'none', outline:'none', color: focused ? 'var(--text-primary)' : 'var(--text-secondary)', fontFamily:'var(--font-mono)', fontSize:12.5, padding:'0 4px', transition:'color 0.15s ease' }}
        />

        {isLoading && <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent-cyan)', marginRight:12, flexShrink:0, animation:'pulse 1s ease-in-out infinite' }} />}
      </div>
    </div>
  );
}

function NewTabPage() {
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:24, background:'var(--bg-void)', fontFamily:'var(--font-ui)' }}>
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ opacity:0.5 }}>
        <circle cx="32" cy="32" r="8" fill="var(--accent-mesh)" opacity="0.8"/>
        <circle cx="8"  cy="8"  r="5" fill="var(--accent-cyan)" opacity="0.5"/>
        <circle cx="56" cy="8"  r="5" fill="var(--accent-cyan)" opacity="0.5"/>
        <circle cx="8"  cy="56" r="5" fill="var(--accent-cyan)" opacity="0.5"/>
        <circle cx="56" cy="56" r="5" fill="var(--accent-cyan)" opacity="0.5"/>
        <path d="M12 12L25 25M52 12L39 25M12 52L25 39M52 52L39 39" stroke="var(--accent-cyan)" strokeWidth="1.5" opacity="0.3"/>
      </svg>
      <div style={{ textAlign:'center' }}>
        <p style={{ fontSize:22, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>UnSync Browser</p>
        <p style={{ fontSize:12, color:'var(--text-dim)', marginTop:6, fontFamily:'var(--font-mono)' }}>mesh-native · sovereign · private</p>
      </div>
    </div>
  );
}

export default function App() {
  const [tabs, setTabs]           = useState([makeTab(HOME_URL)]);
  const [activeTabId, setActiveTabId] = useState(1);
  const webviewRefs = useRef({});

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const addTab = () => {
    const t = makeTab('about:blank');
    setTabs(prev => [...prev, t]);
    setActiveTabId(t.id);
  };

  const closeTab = (id) => {
    setTabs(prev => {
      if (prev.length === 1) return prev;
      const next = prev.filter(t => t.id !== id);
      if (activeTabId === id) setActiveTabId(next[next.length - 1].id);
      return next;
    });
  };

  const updateTab = (id, patch) => setTabs(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));

  const getWv    = id => webviewRefs.current[id];
  const navigate = url => { getWv(activeTabId)?.loadURL(url); updateTab(activeTabId, { url, displayUrl: url, loading: true }); };
  const goBack    = () => getWv(activeTabId)?.goBack();
  const goForward = () => getWv(activeTabId)?.goForward();
  const reload    = () => getWv(activeTabId)?.reload();
  const stop      = () => getWv(activeTabId)?.stop();

  const bindWebview = useCallback((wv, tabId) => {
    if (!wv || webviewRefs.current[tabId] === wv) return;
    webviewRefs.current[tabId] = wv;
    const u = p => updateTab(tabId, p);
    wv.addEventListener('did-start-loading',    () => u({ loading: true }));
    wv.addEventListener('did-stop-loading',     () => u({ loading: false, canGoBack: wv.canGoBack(), canGoForward: wv.canGoForward() }));
    wv.addEventListener('did-navigate',         e => u({ displayUrl: e.url }));
    wv.addEventListener('did-navigate-in-page', e => u({ displayUrl: e.url }));
    wv.addEventListener('page-title-updated',   e => u({ title: e.title }));
    wv.addEventListener('did-fail-load',        () => u({ loading: false }));
  }, []);

  useEffect(() => {
    const h = e => {
      if (e.ctrlKey && e.key === 't') { e.preventDefault(); addTab(); }
      if (e.ctrlKey && e.key === 'w') { e.preventDefault(); closeTab(activeTabId); }
      if (e.ctrlKey && e.key === 'l') { e.preventDefault(); document.querySelector('input')?.focus(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [activeTabId]);

  const isBlank = url => !url || url === 'about:blank';

  return (
    <div style={{ display:'flex', flexDirection:'column', width:'100%', height:'100%', background:'var(--bg-void)', overflow:'hidden' }}>

      <TitleBar />

      {/* Tab strip */}
      <div style={{ display:'flex', alignItems:'flex-end', padding:'4px 12px 0', gap:2, background:'var(--bg-void)', borderBottom:'1px solid var(--border-subtle)', flexShrink:0, WebkitAppRegion:'drag', overflowX:'auto', overflowY:'hidden' }}>
        {tabs.map(tab => (
          <div key={tab.id} style={{ WebkitAppRegion:'no-drag' }}>
            <TabItem tab={tab} active={tab.id === activeTabId} onActivate={() => setActiveTabId(tab.id)} onClose={() => closeTab(tab.id)} />
          </div>
        ))}
        <button onClick={addTab}
          style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:6, background:'transparent', border:'none', cursor:'pointer', color:'var(--text-dim)', fontSize:16, WebkitAppRegion:'no-drag', transition:'all 0.12s' }}
          onMouseEnter={e => { e.currentTarget.style.color='var(--text-primary)'; e.currentTarget.style.background='rgba(255,255,255,0.06)'; }}
          onMouseLeave={e => { e.currentTarget.style.color='var(--text-dim)'; e.currentTarget.style.background='transparent'; }}
          title="New tab (Ctrl+T)">+</button>
      </div>

      {/* Floating island */}
      <div style={{ background:'var(--bg-void)', flexShrink:0 }}>
        <FloatingIsland tab={activeTab} onNavigate={navigate} onBack={goBack} onForward={goForward} onReload={reload} onStop={stop} />
      </div>

      {/* Content */}
      <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
        {tabs.map(tab => (
          <div key={tab.id} style={{ position:'absolute', inset:0, display: tab.id === activeTabId ? 'flex' : 'none', flexDirection:'column' }}>
            {isBlank(tab.url) ? <NewTabPage /> : (
              <webview ref={el => el && bindWebview(el, tab.id)} src={tab.url}
                style={{ flex:1, width:'100%', border:'none' }}
                allowpopups="true" partition="persist:unsync" />
            )}
          </div>
        ))}
      </div>

      {/* Status bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', height:22, padding:'0 12px', background:'var(--bg-void)', borderTop:'1px solid var(--border-subtle)', flexShrink:0 }}>
        <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--text-dim)' }}>
          {activeTab?.loading ? 'Loading…' : activeTab?.displayUrl || 'Ready'}
        </span>
        <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--accent-mesh)', display:'flex', alignItems:'center', gap:4 }}>
          <IconMesh /> mesh · offline
        </span>
      </div>
    </div>
  );
}
