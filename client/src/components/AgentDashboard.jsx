import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

const API = '/api/agents';

export default function AgentDashboard() {
  const { t } = useTheme();
  const [agents, setAgents] = useState({});
  const [stats, setStats] = useState({});
  const [activities, setActivities] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [pending, setPending] = useState([]);
  const [tab, setTab] = useState('dashboard');
  const [taskAgent, setTaskAgent] = useState('');
  const [taskInput, setTaskInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatFrom, setChatFrom] = useState('');
  const [chatTo, setChatTo] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatMsgs, setChatMsgs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [llmProvider, setLlmProvider] = useState('simulation');
  const [apiKey, setApiKey] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const chatRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => { fetchDashboard(); connectWS(); return () => wsRef.current?.close(); }, []);

  function connectWS() {
    try {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = import.meta.env.DEV ? `${proto}//${location.hostname}:4000` : `${proto}//${location.host}`;
      const ws = new WebSocket(wsUrl);
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.event === 'init') { setAgents(msg.data.agents||{}); setStats(msg.data.stats||{}); setActivities(msg.data.activities||[]); setPending(msg.data.pendingApprovals||[]); }
        if (msg.event === 'activity') setActivities(a => [...a, msg.data].slice(-50));
        if (msg.event === 'agent_update' && msg.data.role) setAgents(a => ({...a, [Object.keys(a).find(k=>a[k].role===msg.data.role)||'']: msg.data}));
        if (msg.event === 'decision') setDecisions(d => [...d, msg.data]);
      };
      wsRef.current = ws;
    } catch(e) { console.log('WS not available'); }
  }

  async function fetchDashboard() {
    try {
      const r = await fetch(`${API}/dashboard`); const d = await r.json();
      setAgents(d.agents||{}); setStats(d.stats||{}); setActivities(d.activities||[]); setPending(d.pendingApprovals||[]);
    } catch(e) { console.error(e); }
  }

  async function fetchDecisions() {
    try { const r = await fetch(`${API}/decisions/list?limit=50`); setDecisions(await r.json()); } catch(e) {}
  }

  async function submitTask() {
    if (!taskAgent || !taskInput.trim()) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/task`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({agentKey:taskAgent, task:taskInput}) });
      const d = await r.json();
      if (!d.error) { setDecisions(prev => [...prev, d]); setTaskInput(''); fetchDashboard(); }
      else alert(d.error);
    } catch(e) { alert(e.message); }
    setLoading(false);
  }

  async function resolveApproval(id, approved) {
    try {
      await fetch(`${API}/decisions/${id}/resolve`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({approved, feedback:''}) });
      fetchDashboard();
    } catch(e) { alert(e.message); }
  }

  async function toggleAgent(key, status) {
    try {
      await fetch(`${API}/${key}/status`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({status: status==='active'?'paused':'active'}) });
      fetchDashboard();
    } catch(e) { alert(e.message); }
  }

  async function sendChat() {
    if (!chatFrom || !chatTo || !chatInput.trim() || chatFrom===chatTo) return;
    setChatMsgs(m => [...m, {role:agents[chatFrom]?.role||chatFrom, text:chatInput, sent:true}]);
    const msg = chatInput; setChatInput('');
    try {
      const r = await fetch(`${API}/message`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({from:chatFrom, to:chatTo, message:msg}) });
      const d = await r.json();
      if (d.response) setChatMsgs(m => [...m, {role:agents[chatTo]?.role||chatTo, text:d.response, sent:false}]);
    } catch(e) { setChatMsgs(m => [...m, {role:'System', text:'Error: '+e.message, sent:false}]); }
    setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 100);
  }

  async function saveConfig() {
    setSavingConfig(true);
    try {
      await fetch(`${API}/global/config`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({llm: {provider: llmProvider, apiKey}}) });
      alert('Settings saved! LLM updated.');
    } catch(e) { alert(e.message); }
    setSavingConfig(false);
  }

  const s = (base, extra={}) => ({...base, ...extra, transition:'all 0.3s'});
  const card = s({background:t.card, borderRadius:16, border:`1px solid ${t.border}`, padding:20, boxShadow:t.shadow});
  const agentKeys = Object.keys(agents);
  const orgKeys = agentKeys.filter(k => agents[k].category === 'org');
  const platKeys = agentKeys.filter(k => agents[k].category === 'platform');
  const displayKeys = filter === 'org' ? orgKeys : filter === 'platform' ? platKeys : agentKeys;

  const tabBtn = (id, label, icon) => (
    <button key={id} onClick={() => { setTab(id); if(id==='decisions') fetchDecisions(); }} style={s({
      background: tab===id ? t.accent+'22' : 'none', border: tab===id ? `1px solid ${t.accent}44` : `1px solid transparent`,
      borderRadius:10, padding:'8px 16px', color: tab===id ? t.accent : t.textMuted, fontWeight:600, fontSize:13,
      cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6
    })}>
      <span style={{fontSize:15}}>{icon}</span>{label}
    </button>
  );

  const tierColor = tier => tier===1 ? '#50C878' : tier===2 ? '#F39C12' : '#E74C3C';
  const tierLabel = tier => tier===1 ? 'Autonomous' : tier===2 ? 'Collaborative' : 'Escalation';
  const statusColor = st => st==='completed'||st==='approved' ? '#50C878' : st==='awaiting_approval'||st==='in_review' ? '#F39C12' : st==='rejected' ? '#E74C3C' : t.textMuted;

  return (
    <div style={{maxWidth:1200, margin:'0 auto'}}>
      {/* Header */}
      <div style={s(card, {marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12})}>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <span style={{fontSize:32}}>🤖</span>
          <div>
            <div style={{fontWeight:800, fontSize:20, color:t.text}}>Agent Command Center</div>
            <div style={{fontSize:13, color:t.textMuted}}>{stats.agents||0} agents · {stats.activeAgents||0} active · {stats.decisions?.total||0} decisions</div>
          </div>
        </div>
        <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
          {tabBtn('dashboard','Dashboard','📊')}
          {tabBtn('decisions','Decisions','⚖️')}
          {tabBtn('settings','Settings','⚙️')}
          <button onClick={()=>{setChatOpen(true); setChatFrom(orgKeys[0]||''); setChatTo(platKeys[0]||orgKeys[1]||''); setChatMsgs([]);}} style={s({
            background:t.accent+'22', border:`1px solid ${t.accent}44`, borderRadius:10, padding:'8px 16px',
            color:t.accent, fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6
          })}><span style={{fontSize:15}}>💬</span>Agent Chat</button>
        </div>
      </div>

      {/* Stats */}
      {tab === 'dashboard' && (
        <>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:12, marginBottom:16}}>
            {[
              {v:stats.orgAgents||0, l:'Org Agents', icon:'👔', c:'#4A90D9'},
              {v:stats.platformAgents||0, l:'Platform Agents', icon:'🌟', c:'#E91E63'},
              {v:stats.decisions?.total||0, l:'Decisions', icon:'📋', c:'#50C878'},
              {v:stats.pendingApprovals||0, l:'Pending', icon:'⏳', c:'#E74C3C'},
              {v:stats.platform?.users||0, l:'Users', icon:'👥', c:'#9B59B6'},
              {v:stats.platform?.posts||0, l:'Posts', icon:'📝', c:'#FF9800'},
            ].map((s,i) => (
              <div key={i} style={{...card, padding:14, textAlign:'center', borderLeft:`3px solid ${s.c}`}}>
                <div style={{fontSize:22}}>{s.icon}</div>
                <div style={{fontSize:24, fontWeight:800, color:t.text}}>{s.v}</div>
                <div style={{fontSize:11, color:t.textMuted}}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Category filter */}
          <div style={{display:'flex', gap:8, marginBottom:16}}>
            {[['all','All Agents'],['org','🏢 Organization'],['platform','🌐 Platform']].map(([id,label])=>(
              <button key={id} onClick={()=>setFilter(id)} style={s({
                background: filter===id ? t.accent+'22' : t.card, border:`1px solid ${filter===id ? t.accent+'55' : t.border}`,
                borderRadius:20, padding:'6px 14px', color: filter===id ? t.accent : t.textMuted,
                fontWeight:600, fontSize:12, cursor:'pointer', fontFamily:'inherit'
              })}>{label}</button>
            ))}
          </div>

          {/* Agent Grid */}
          {filter !== 'platform' && orgKeys.length > 0 && (
            <div style={{marginBottom:8}}>
              <div style={{fontSize:14, fontWeight:700, color:t.text, marginBottom:10, display:'flex', alignItems:'center', gap:6}}>
                <span>🏢</span> Organization Structure
              </div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:12, marginBottom:20}}>
                {orgKeys.map(k => <AgentCard key={k} k={k} agent={agents[k]} t={t} card={card} s={s}
                  onToggle={()=>toggleAgent(k,agents[k].status)} onTask={()=>{setTaskAgent(k);document.getElementById('agentTaskInput')?.focus();}}
                  onChat={()=>{setChatOpen(true);setChatFrom(k);setChatTo(orgKeys.find(x=>x!==k)||platKeys[0]||'');setChatMsgs([]);}} />)}
              </div>
            </div>
          )}

          {filter !== 'org' && platKeys.length > 0 && (
            <div style={{marginBottom:8}}>
              <div style={{fontSize:14, fontWeight:700, color:t.text, marginBottom:10, display:'flex', alignItems:'center', gap:6}}>
                <span>🌐</span> Platform Operations
              </div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:12, marginBottom:20}}>
                {platKeys.map(k => <AgentCard key={k} k={k} agent={agents[k]} t={t} card={card} s={s}
                  onToggle={()=>toggleAgent(k,agents[k].status)} onTask={()=>{setTaskAgent(k);document.getElementById('agentTaskInput')?.focus();}}
                  onChat={()=>{setChatOpen(true);setChatFrom(k);setChatTo(platKeys.find(x=>x!==k)||orgKeys[0]||'');setChatMsgs([]);}} />)}
              </div>
            </div>
          )}

          {/* Task Submission */}
          <div style={{...card, marginBottom:16}}>
            <div style={{fontWeight:700, fontSize:15, color:t.text, marginBottom:12}}>🚀 Submit Task to Agent</div>
            <div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
              <select value={taskAgent} onChange={e=>setTaskAgent(e.target.value)} style={{background:t.bg, border:`1px solid ${t.border}`, borderRadius:10, padding:'10px 14px', color:t.text, fontSize:13, fontFamily:'inherit', minWidth:200}}>
                <option value="">Select Agent...</option>
                <optgroup label="🏢 Organization">
                  {orgKeys.map(k=><option key={k} value={k}>{agents[k].icon} {agents[k].role}</option>)}
                </optgroup>
                <optgroup label="🌐 Platform">
                  {platKeys.map(k=><option key={k} value={k}>{agents[k].icon} {agents[k].role}</option>)}
                </optgroup>
              </select>
              <input id="agentTaskInput" value={taskInput} onChange={e=>setTaskInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submitTask()}
                placeholder="Describe the task..." style={{flex:1, background:t.bg, border:`1px solid ${t.border}`, borderRadius:10, padding:'10px 14px', color:t.text, fontSize:13, fontFamily:'inherit', minWidth:200}} />
              <button onClick={submitTask} disabled={loading} style={{background:`linear-gradient(135deg, ${t.accent}, #e8a020)`, border:'none', borderRadius:10, padding:'10px 20px', color:'#fff', fontWeight:700, fontSize:13, cursor:loading?'wait':'pointer', fontFamily:'inherit', opacity:loading?0.6:1}}>
                {loading ? '⏳ Processing...' : '🚀 Submit'}
              </button>
            </div>
          </div>

          {/* Pending Approvals */}
          {pending.length > 0 && (
            <div style={{...card, marginBottom:16, borderLeft:'3px solid #E74C3C'}}>
              <div style={{fontWeight:700, fontSize:15, color:'#E74C3C', marginBottom:12}}>🔴 Pending Owner Approvals ({pending.length})</div>
              {pending.map(d => (
                <div key={d.id} style={{background:t.bg, borderRadius:10, padding:14, marginBottom:10, border:`1px solid ${t.border}`}}>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:6}}>
                    <span style={{fontWeight:700, fontSize:13, color:t.text}}>{d.agentRole}</span>
                    <span style={{fontSize:11, padding:'2px 8px', borderRadius:12, background:'#E74C3C22', color:'#E74C3C', fontWeight:600}}>Tier {d.tier}</span>
                  </div>
                  <div style={{fontSize:13, color:t.textMuted, marginBottom:6}}>{d.task}</div>
                  <div style={{fontSize:12, color:t.textMuted, background:t.bg, padding:8, borderRadius:6, marginBottom:8, maxHeight:80, overflow:'auto'}}>{d.reasoning}</div>
                  {d.guardrailsApplied?.length>0 && <div style={{fontSize:11, color:'#F39C12', marginBottom:8}}>⚠️ {d.guardrailsApplied.join(' | ')}</div>}
                  <div style={{display:'flex', gap:8}}>
                    <button onClick={()=>resolveApproval(d.id,true)} style={{background:'#50C878', border:'none', borderRadius:8, padding:'6px 14px', color:'#fff', fontWeight:600, fontSize:12, cursor:'pointer', fontFamily:'inherit'}}>✅ Approve</button>
                    <button onClick={()=>resolveApproval(d.id,false)} style={{background:'#E74C3C', border:'none', borderRadius:8, padding:'6px 14px', color:'#fff', fontWeight:600, fontSize:12, cursor:'pointer', fontFamily:'inherit'}}>❌ Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Activity Feed */}
          <div style={{...card}}>
            <div style={{fontWeight:700, fontSize:15, color:t.text, marginBottom:12}}>📡 Live Activity Feed</div>
            {activities.length === 0 ? <div style={{color:t.textMuted, fontSize:13, textAlign:'center', padding:20}}>No activity yet. Submit a task to get started.</div> :
              activities.slice().reverse().slice(0,15).map((a,i) => (
                <div key={i} style={{padding:'8px 12px', background:t.bg, borderRadius:8, marginBottom:6, borderLeft:`3px solid ${t.accent}`, fontSize:13, color:t.textMuted}}>
                  <span style={{fontSize:10, color:t.accent, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5}}>{(a.type||'').replace(/_/g,' ')}</span>
                  <div style={{color:t.text, marginTop:2}}>
                    {a.data?.agentRole && <strong>{a.data.agentRole}</strong>} {a.data?.task ? `: "${a.data.task.substring(0,80)}"` : a.data?.message ? `: ${a.data.message.substring(0,80)}` : ''}
                    {a.data?.from && a.data?.to && <span> ({a.data.from} → {a.data.to})</span>}
                  </div>
                  <div style={{fontSize:10, color:t.textMuted, marginTop:2}}>{new Date(a.timestamp).toLocaleTimeString()}</div>
                </div>
              ))}
          </div>
        </>
      )}

      {/* Decisions Tab */}
      {tab === 'decisions' && (
        <div style={card}>
          <div style={{fontWeight:700, fontSize:15, color:t.text, marginBottom:12}}>⚖️ Decision Audit Log</div>
          {decisions.length===0 ? <div style={{color:t.textMuted, fontSize:13, textAlign:'center', padding:20}}>No decisions yet.</div> :
            decisions.slice().reverse().map((d,i) => (
              <div key={i} style={{background:t.bg, borderRadius:10, padding:14, marginBottom:10, border:`1px solid ${t.border}`}}>
                <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:6, flexWrap:'wrap'}}>
                  <span style={{fontSize:11, padding:'2px 8px', borderRadius:12, background:t.accent+'22', color:t.accent, fontWeight:600}}>{d.agentRole}</span>
                  <span style={{fontSize:11, padding:'2px 8px', borderRadius:12, background:tierColor(d.tier)+'22', color:tierColor(d.tier), fontWeight:600}}>Tier {d.tier} — {tierLabel(d.tier)}</span>
                  <span style={{fontSize:11, fontWeight:600, color:statusColor(d.status)}}>{d.status}</span>
                  <span style={{fontSize:10, color:t.textMuted, marginLeft:'auto'}}>{new Date(d.timestamp).toLocaleTimeString()}</span>
                </div>
                <div style={{fontSize:14, fontWeight:600, color:t.text, marginBottom:4}}>{d.task}</div>
                <div style={{fontSize:12, color:t.textMuted, lineHeight:1.5}}>{(d.reasoning||'').substring(0,300)}</div>
              </div>
            ))}
        </div>
      )}

      {/* Settings Tab */}
      {tab === 'settings' && (
        <div style={card}>
          <div style={{fontWeight:700, fontSize:15, color:t.text, marginBottom:12}}>⚙️ Platform Settings</div>
          <div style={{background:t.bg, borderRadius:10, padding:20, border:`1px solid ${t.border}`}}>
            <div style={{fontWeight:600, color:t.text, marginBottom:16}}>Brain / LLM Configuration</div>
            <div style={{display:'flex', flexDirection:'column', gap:16, maxWidth:500}}>
              <div>
                <label style={{display:'block', fontSize:12, color:t.textMuted, marginBottom:6}}>LLM Provider</label>
                <select value={llmProvider} onChange={e=>setLlmProvider(e.target.value)} style={{width:'100%', background:t.card, border:`1px solid ${t.border}`, borderRadius:8, padding:'10px 14px', color:t.text, fontSize:14, fontFamily:'inherit'}}>
                  <option value="simulation">Simulation (Mock Responses)</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </div>
              {llmProvider !== 'simulation' && (
                <div>
                  <label style={{display:'block', fontSize:12, color:t.textMuted, marginBottom:6}}>API Key</label>
                  <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder={`Enter ${llmProvider} API key...`} style={{width:'100%', background:t.card, border:`1px solid ${t.border}`, borderRadius:8, padding:'10px 14px', color:t.text, fontSize:14, fontFamily:'inherit', boxSizing:'border-box'}} />
                </div>
              )}
              <button onClick={saveConfig} disabled={savingConfig} style={{background:t.accent, border:'none', borderRadius:8, padding:'10px 20px', color:'#fff', fontWeight:700, fontSize:14, cursor:savingConfig?'wait':'pointer', fontFamily:'inherit', opacity:savingConfig?0.6:1, marginTop:8}}>
                {savingConfig ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {chatOpen && (
        <div onClick={()=>setChatOpen(false)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div onClick={e=>e.stopPropagation()} style={{background:t.card, borderRadius:16, border:`1px solid ${t.border}`, width:'90%', maxWidth:700, maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,0.3)'}}>
            <div style={{display:'flex', justifyContent:'space-between', padding:'16px 20px', borderBottom:`1px solid ${t.border}`}}>
              <div style={{fontWeight:700, fontSize:16, color:t.text}}>💬 Agent Communication</div>
              <button onClick={()=>setChatOpen(false)} style={{background:'none', border:'none', color:t.textMuted, fontSize:20, cursor:'pointer'}}>✕</button>
            </div>
            <div ref={chatRef} style={{flex:1, overflow:'auto', padding:16, display:'flex', flexDirection:'column', gap:8, minHeight:250, maxHeight:350}}>
              {chatMsgs.map((m,i) => (
                <div key={i} style={{alignSelf:m.sent?'flex-end':'flex-start', maxWidth:'80%', padding:'8px 14px', borderRadius:12, fontSize:13, lineHeight:1.5,
                  background:m.sent?t.accent:'rgba(255,255,255,0.05)', color:m.sent?'#fff':t.text, border:m.sent?'none':`1px solid ${t.border}`,
                  borderBottomRightRadius:m.sent?4:12, borderBottomLeftRadius:m.sent?12:4}}>
                  <div style={{fontSize:10, fontWeight:700, opacity:0.7, marginBottom:2}}>{m.role}</div>
                  {m.text}
                </div>
              ))}
            </div>
            <div style={{display:'flex', gap:8, padding:'12px 16px', borderTop:`1px solid ${t.border}`, alignItems:'center'}}>
              <select value={chatFrom} onChange={e=>setChatFrom(e.target.value)} style={{background:t.bg, border:`1px solid ${t.border}`, borderRadius:8, padding:'6px 8px', color:t.text, fontSize:12, fontFamily:'inherit'}}>
                {agentKeys.map(k=><option key={k} value={k}>{agents[k]?.icon} {agents[k]?.role}</option>)}
              </select>
              <span style={{color:t.textMuted}}>→</span>
              <select value={chatTo} onChange={e=>setChatTo(e.target.value)} style={{background:t.bg, border:`1px solid ${t.border}`, borderRadius:8, padding:'6px 8px', color:t.text, fontSize:12, fontFamily:'inherit'}}>
                {agentKeys.map(k=><option key={k} value={k}>{agents[k]?.icon} {agents[k]?.role}</option>)}
              </select>
              <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendChat()}
                placeholder="Type a message..." style={{flex:1, background:t.bg, border:`1px solid ${t.border}`, borderRadius:8, padding:'8px 12px', color:t.text, fontSize:13, fontFamily:'inherit'}} />
              <button onClick={sendChat} style={{background:t.accent, border:'none', borderRadius:8, padding:'8px 16px', color:'#fff', fontWeight:600, fontSize:12, cursor:'pointer', fontFamily:'inherit'}}>Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AgentCard({k, agent, t, card, s, onToggle, onTask, onChat}) {
  const statusColors = {active:'#50C878', paused:'#F39C12', disabled:'#64748b'};
  return (
    <div style={{...card, padding:14, position:'relative', overflow:'hidden', cursor:'pointer', borderTop:`3px solid ${agent.color}`}}
      onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'} onMouseLeave={e=>e.currentTarget.style.transform='none'}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <div style={{fontSize:24, width:40, height:40, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:10, background:agent.color+'15'}}>{agent.icon}</div>
          <div>
            <div style={{fontWeight:700, fontSize:13, color:t.text}}>{agent.role}</div>
            <div style={{fontSize:10, color:t.textMuted}}>{agent.title}</div>
          </div>
        </div>
        <span style={{fontSize:9, padding:'2px 8px', borderRadius:12, background:statusColors[agent.status]+'22', color:statusColors[agent.status], fontWeight:700, textTransform:'uppercase'}}>{agent.status}</span>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:10}}>
        {(agent.kpis||[]).slice(0,4).map((kpi,i)=>(
          <div key={i} style={{background:t.bg, borderRadius:6, padding:6}}>
            <div style={{fontSize:14, fontWeight:700, color:t.text}}>{agent.kpiValues?.[kpi.name]??kpi.defaultValue??0}</div>
            <div style={{fontSize:9, color:t.textMuted}}>{kpi.label}</div>
          </div>
        ))}
      </div>
      <div style={{display:'flex', gap:4}}>
        <button onClick={onToggle} style={{flex:1, padding:5, border:`1px solid ${t.border}`, borderRadius:6, background:t.bg, color:t.textMuted, fontSize:10, cursor:'pointer', fontFamily:'inherit'}}>{agent.status==='active'?'⏸ Pause':'▶ Resume'}</button>
        <button onClick={onChat} style={{flex:1, padding:5, border:`1px solid ${t.border}`, borderRadius:6, background:t.bg, color:t.textMuted, fontSize:10, cursor:'pointer', fontFamily:'inherit'}}>💬 Chat</button>
        <button onClick={onTask} style={{flex:1, padding:5, border:`1px solid ${t.border}`, borderRadius:6, background:t.bg, color:t.textMuted, fontSize:10, cursor:'pointer', fontFamily:'inherit'}}>📋 Task</button>
      </div>
    </div>
  );
}
