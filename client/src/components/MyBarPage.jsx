import { useState, useEffect, useRef } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const fmtTime = iso => { const d = new Date(iso); return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); };

const StarRating = ({ value, onChange, t }) => (
  <div style={{ display: 'flex', gap: 4 }}>
    {[2,4,6,8,10].map(v => (
      <button key={v} onClick={() => onChange?.(v)} style={{ background: 'none', border: 'none', cursor: onChange ? 'pointer' : 'default', fontSize: 18, color: value >= v ? '#f5a623' : t.border, padding: 0, transition: 'color 0.15s' }}>★</button>
    ))}
    <span style={{ fontSize: 12, color: t.textMuted, alignSelf: 'center', marginLeft: 4 }}>{value ? `${value}/10` : ''}</span>
  </div>
);

export default function MyBarPage({ userId, onBack }) {
  const { user } = useAuth();
  const { t } = useTheme();
  const [tab, setTab] = useState('ratings');
  const [ratings, setRatings] = useState([]);
  const [collection, setCollection] = useState([]);
  const [bucketList, setBucketList] = useState([]);
  const [badges, setBadges] = useState(null);
  const [showAddRating, setShowAddRating] = useState(false);
  const [showAddCollection, setShowAddCollection] = useState(false);
  const [bucketInput, setBucketInput] = useState('');
  const isMe = !userId || userId === user?.id;
  const uid = userId || user?.id;

  useEffect(() => {
    api.get(`/ratings?user_id=${uid}`).then(r => setRatings(r.data)).catch(()=>{});
    api.get(`/collection?user_id=${uid}`).then(r => setCollection(r.data)).catch(()=>{});
    api.get(`/bucketlist?user_id=${uid}`).then(r => setBucketList(r.data)).catch(()=>{});
    api.get(`/badges/${uid}`).then(r => setBadges(r.data)).catch(()=>{});
  }, [uid]);

  const toggleBucket = async (item) => {
    await api.patch(`/bucketlist/${item.id}/check`);
    setBucketList(bl => bl.map(b => b.id === item.id ? { ...b, checked: b.checked ? 0 : 1 } : b));
  };

  const deleteBucket = async (id) => { await api.delete(`/bucketlist/${id}`); setBucketList(bl => bl.filter(b => b.id !== id)); };
  const addBucket = async () => {
    if (!bucketInput.trim()) return;
    const { data } = await api.post('/bucketlist', { drink_name: bucketInput.trim() });
    setBucketList(bl => [data, ...bl]); setBucketInput('');
  };
  const deleteRating = async (id) => { await api.delete(`/ratings/${id}`); setRatings(r => r.filter(x => x.id !== id)); };
  const deleteCollection = async (id) => { await api.delete(`/collection/${id}`); setCollection(c => c.filter(x => x.id !== id)); };

  const cardStyle = { background: t.card, borderRadius: 16, padding: 20, border: `1px solid ${t.border}`, boxShadow: t.shadow, marginBottom: 12 };
  const tabStyle = active => ({ flex:1, padding:'10px 8px', background: active ? t.accentSoft : 'none', border:'none', borderRadius:10, color: active ? t.accent : t.textMuted, fontWeight: active?700:500, fontSize:13, cursor:'pointer', transition:'all 0.2s' });

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 0 40px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        {onBack && <button onClick={onBack} style={{ background:t.card, border:`1.5px solid ${t.border}`, borderRadius:20, padding:'8px 16px', color:t.textMuted, fontSize:13, cursor:'pointer' }}>← Back</button>}
        <div style={{ fontSize:20, fontWeight:800, color:t.text }}>My Bar 🍶</div>
        <div style={{ fontSize:13, color:t.textMuted }}>{isMe ? 'Your collection, ratings & achievements' : 'Their bar'}</div>
      </div>

      {/* Badges summary */}
      {badges && badges.earned.length > 0 && (
        <div style={{ ...cardStyle, display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ fontSize:12, color:t.textMuted, fontWeight:600, marginRight:4 }}>BADGES</span>
          {badges.earned.map(b => (
            <div key={b.id} title={b.desc} style={{ display:'flex', alignItems:'center', gap:4, background:t.accentSoft, borderRadius:20, padding:'4px 10px', fontSize:13, color:t.accent, fontWeight:600, cursor:'default' }}>
              {b.icon} {b.name}
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      {badges && (
        <div style={{ ...cardStyle, display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          {[
            ['📝', badges.stats.posts, 'Posts'],
            ['🍺', badges.stats.cheers_received, 'Cheers Rcvd'],
            ['⭐', ratings.length, 'Ratings'],
            ['🗄️', collection.length, 'Collection'],
          ].map(([icon,val,label]) => (
            <div key={label} style={{ textAlign:'center' }}>
              <div style={{ fontSize:24, fontWeight:800, color:t.accent }}>{val}</div>
              <div style={{ fontSize:11, color:t.textMuted }}>{icon} {label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, background:t.cardAlt, borderRadius:12, padding:4, marginBottom:16 }}>
        {[['ratings','⭐ Ratings'],['collection','🗄️ Collection'],['bucket','📋 Bucket List'],['badges','🏆 Badges']].map(([id,label]) => (
          <button key={id} style={tabStyle(tab===id)} onClick={()=>setTab(id)}>{label}</button>
        ))}
      </div>

      {/* RATINGS */}
      {tab === 'ratings' && (
        <div>
          {isMe && <button onClick={()=>setShowAddRating(true)} style={{ width:'100%', background:'linear-gradient(135deg,#f5a623,#ffcc5c)', border:'none', borderRadius:12, padding:12, color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', marginBottom:14 }}>+ Log a Drink Rating</button>}
          {ratings.length === 0 && <div style={{ ...cardStyle, textAlign:'center', color:t.textMuted }}><div style={{fontSize:36,marginBottom:8}}>⭐</div>No ratings yet</div>}
          {ratings.map(r => (
            <div key={r.id} style={cardStyle}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:16, color:t.text }}>{r.drink_name}</div>
                  {r.distillery && <div style={{ fontSize:13, color:t.textMuted }}>{r.distillery} · {r.drink_type}</div>}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ fontSize:24, fontWeight:800, color:'#f5a623' }}>{r.rating}</div>
                  {isMe && <button onClick={()=>deleteRating(r.id)} style={{ background:'none', border:'none', color:t.textFaint, cursor:'pointer', fontSize:16 }} onMouseEnter={e=>e.target.style.color=t.danger} onMouseLeave={e=>e.target.style.color=t.textFaint}>🗑</button>}
                </div>
              </div>
              <StarRating value={r.rating} t={t} />
              {(r.nose||r.palate||r.finish) && (
                <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:6 }}>
                  {[['👃 Nose', r.nose],['👅 Palate', r.palate],['🔥 Finish', r.finish]].filter(([,v])=>v).map(([label,val])=>(
                    <div key={label} style={{ fontSize:13 }}><span style={{color:t.textMuted,fontWeight:600}}>{label}:</span> <span style={{color:t.textSub}}>{val}</span></div>
                  ))}
                </div>
              )}
              <div style={{ fontSize:11, color:t.textFaint, marginTop:8 }}>{fmtTime(r.created_at)}</div>
            </div>
          ))}
        </div>
      )}

      {/* COLLECTION */}
      {tab === 'collection' && (
        <div>
          {isMe && <button onClick={()=>setShowAddCollection(true)} style={{ width:'100%', background:'linear-gradient(135deg,#f5a623,#ffcc5c)', border:'none', borderRadius:12, padding:12, color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', marginBottom:14 }}>+ Add to Collection</button>}
          {collection.length === 0 && <div style={{ ...cardStyle, textAlign:'center', color:t.textMuted }}><div style={{fontSize:36,marginBottom:8}}>🗄️</div>No bottles yet</div>}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {collection.map(c => (
              <div key={c.id} style={{ ...cardStyle, marginBottom:0, position:'relative' }}>
                {c.image_url && <img src={c.image_url} alt="" style={{ width:'100%', height:120, objectFit:'cover', borderRadius:8, marginBottom:10 }} onError={e=>e.target.style.display='none'} />}
                <div style={{ fontWeight:700, fontSize:14, color:t.text }}>{c.name}</div>
                {c.distillery && <div style={{ fontSize:12, color:t.textMuted }}>{c.distillery}</div>}
                <div style={{ fontSize:12, color:t.textFaint, marginTop:2 }}>{c.drink_type} {c.vintage && `· ${c.vintage}`}</div>
                {c.rating > 0 && <div style={{ fontSize:13, color:'#f5a623', fontWeight:700, marginTop:4 }}>★ {c.rating}/10</div>}
                {c.notes && <div style={{ fontSize:12, color:t.textSub, marginTop:6, fontStyle:'italic' }}>"{c.notes}"</div>}
                {isMe && <button onClick={()=>deleteCollection(c.id)} style={{ position:'absolute', top:10, right:10, background:t.card, border:`1px solid ${t.border}`, borderRadius:8, padding:'2px 6px', color:t.textFaint, cursor:'pointer', fontSize:12 }}>✕</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BUCKET LIST */}
      {tab === 'bucket' && (
        <div>
          {isMe && (
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              <input value={bucketInput} onChange={e=>setBucketInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addBucket()} placeholder="Add a drink to your bucket list…" style={{ flex:1, background:t.inputBg, border:`1.5px solid ${t.border}`, borderRadius:12, padding:'10px 16px', color:t.text, fontSize:14, outline:'none' }} onFocus={e=>e.target.style.borderColor=t.accent} onBlur={e=>e.target.style.borderColor=t.border} />
              <button onClick={addBucket} style={{ background:'linear-gradient(135deg,#f5a623,#ffcc5c)', border:'none', borderRadius:12, padding:'10px 20px', color:'#fff', fontWeight:700, cursor:'pointer' }}>Add</button>
            </div>
          )}
          <div style={{ marginBottom:8, fontSize:12, color:t.textMuted }}>{bucketList.filter(b=>b.checked).length} / {bucketList.length} ticked off</div>
          {bucketList.length === 0 && <div style={{ ...cardStyle, textAlign:'center', color:t.textMuted }}><div style={{fontSize:36,marginBottom:8}}>📋</div>Bucket list is empty</div>}
          {bucketList.map(b => (
            <div key={b.id} style={{ ...cardStyle, display:'flex', alignItems:'center', gap:12, padding:'12px 16px' }}>
              <button onClick={()=>isMe&&toggleBucket(b)} style={{ width:24, height:24, borderRadius:6, border:`2px solid ${b.checked?t.accent:t.border}`, background:b.checked?t.accent:'none', cursor:isMe?'pointer':'default', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:14, color:'#fff', transition:'all 0.2s' }}>{b.checked?'✓':''}</button>
              <span style={{ flex:1, fontSize:14, color:b.checked?t.textMuted:t.text, textDecoration:b.checked?'line-through':'none' }}>{b.drink_name}</span>
              {isMe && <button onClick={()=>deleteBucket(b.id)} style={{ background:'none', border:'none', color:t.textFaint, cursor:'pointer', fontSize:14 }} onMouseEnter={e=>e.target.style.color=t.danger} onMouseLeave={e=>e.target.style.color=t.textFaint}>✕</button>}
            </div>
          ))}
        </div>
      )}

      {/* ALL BADGES */}
      {tab === 'badges' && badges && (
        <div>
          <div style={{ fontSize:13, color:t.textMuted, marginBottom:14 }}>{badges.earned.length} of {badges.all.length} badges earned</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {badges.all.map(b => (
              <div key={b.id} style={{ ...cardStyle, marginBottom:0, opacity: b.earned ? 1 : 0.45, border:`1px solid ${b.earned ? t.accent : t.border}` }}>
                <div style={{ fontSize:28, marginBottom:6 }}>{b.icon}</div>
                <div style={{ fontWeight:700, fontSize:14, color: b.earned ? t.text : t.textMuted }}>{b.name}</div>
                <div style={{ fontSize:12, color:t.textFaint, marginTop:2 }}>{b.desc}</div>
                {b.earned && <div style={{ marginTop:8, fontSize:11, color:t.accent, fontWeight:600 }}>✓ Earned</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Rating Modal */}
      {showAddRating && <AddRatingModal t={t} onClose={()=>setShowAddRating(false)} onSaved={r=>{setRatings(prev=>[r,...prev]);setShowAddRating(false);}} />}
      {showAddCollection && <AddCollectionModal t={t} onClose={()=>setShowAddCollection(false)} onSaved={c=>{setCollection(prev=>[c,...prev]);setShowAddCollection(false);}} />}
    </div>
  );
}

function AddRatingModal({ t, onClose, onSaved }) {
  const [form, setForm] = useState({ drink_name:'', distillery:'', drink_type:'Single Malt Whisky', rating:8, nose:'', palate:'', finish:'' });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const save = async () => { setSaving(true); try { const {data}=await api.post('/ratings',form); onSaved(data); } finally { setSaving(false); } };
  const inp = { background:t.inputBg, border:`1.5px solid ${t.border}`, borderRadius:10, padding:'8px 12px', color:t.text, fontSize:13, outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'Inter,sans-serif' };
  return (
    <div style={{ position:'fixed',inset:0,zIndex:1200,background:t.overlay,backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20 }} onClick={onClose}>
      <div className="popIn" style={{ background:t.card,borderRadius:20,padding:24,width:'100%',maxWidth:460,border:`1px solid ${t.border}`,boxShadow:t.shadowLg,maxHeight:'90vh',overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex',justifyContent:'space-between',marginBottom:20 }}>
          <div style={{ fontWeight:700,fontSize:17,color:t.text }}>⭐ Log a Drink</div>
          <button onClick={onClose} style={{ background:'none',border:'none',color:t.textMuted,fontSize:20,cursor:'pointer' }}>×</button>
        </div>
        {[['Drink Name *','drink_name','Yamazaki 18 Year'],['Distillery','distillery','Suntory'],['Type','drink_type','Single Malt Whisky']].map(([label,key,ph])=>(
          <div key={key} style={{ marginBottom:12 }}>
            <label style={{ fontSize:12,color:t.textMuted,fontWeight:600,display:'block',marginBottom:4 }}>{label}</label>
            <input value={form[key]} onChange={e=>set(key,e.target.value)} placeholder={ph} style={inp} onFocus={e=>e.target.style.borderColor=t.accent} onBlur={e=>e.target.style.borderColor=t.border} />
          </div>
        ))}
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12,color:t.textMuted,fontWeight:600,display:'block',marginBottom:6 }}>Rating: {form.rating}/10</label>
          <input type="range" min={1} max={10} step={0.5} value={form.rating} onChange={e=>set('rating',parseFloat(e.target.value))} style={{ width:'100%',accentColor:t.accent }} />
        </div>
        {[['👃 Nose','nose','Dried fruits, vanilla…'],['👅 Palate','palate','Rich sherry, spice…'],['🔥 Finish','finish','Long, warm, smooth…']].map(([label,key,ph])=>(
          <div key={key} style={{ marginBottom:12 }}>
            <label style={{ fontSize:12,color:t.textMuted,fontWeight:600,display:'block',marginBottom:4 }}>{label}</label>
            <input value={form[key]} onChange={e=>set(key,e.target.value)} placeholder={ph} style={inp} onFocus={e=>e.target.style.borderColor=t.accent} onBlur={e=>e.target.style.borderColor=t.border} />
          </div>
        ))}
        <button onClick={save} disabled={!form.drink_name.trim()||saving} style={{ width:'100%',background:form.drink_name.trim()?'linear-gradient(135deg,#f5a623,#ffcc5c)':t.cardAlt,border:'none',borderRadius:20,padding:12,color:form.drink_name.trim()?'#fff':t.textMuted,fontWeight:700,fontSize:14,cursor:form.drink_name.trim()?'pointer':'not-allowed' }}>{saving?'Saving…':'Save Rating ⭐'}</button>
      </div>
    </div>
  );
}

function AddCollectionModal({ t, onClose, onSaved }) {
  const [form, setForm] = useState({ name:'', distillery:'', drink_type:'🥃 Single Malt', vintage:'', rating:0, notes:'' });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const save = async () => { setSaving(true); try { const {data}=await api.post('/collection',form); onSaved(data); } finally { setSaving(false); } };
  const inp = { background:t.inputBg, border:`1.5px solid ${t.border}`, borderRadius:10, padding:'8px 12px', color:t.text, fontSize:13, outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'Inter,sans-serif' };
  return (
    <div style={{ position:'fixed',inset:0,zIndex:1200,background:t.overlay,backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20 }} onClick={onClose}>
      <div className="popIn" style={{ background:t.card,borderRadius:20,padding:24,width:'100%',maxWidth:440,border:`1px solid ${t.border}`,boxShadow:t.shadowLg }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex',justifyContent:'space-between',marginBottom:20 }}>
          <div style={{ fontWeight:700,fontSize:17,color:t.text }}>🗄️ Add to Collection</div>
          <button onClick={onClose} style={{ background:'none',border:'none',color:t.textMuted,fontSize:20,cursor:'pointer' }}>×</button>
        </div>
        {[['Bottle Name *','name','Macallan 18'],['Distillery','distillery','The Macallan'],['Type','drink_type','🥃 Single Malt'],['Vintage','vintage','2015']].map(([label,key,ph])=>(
          <div key={key} style={{ marginBottom:12 }}>
            <label style={{ fontSize:12,color:t.textMuted,fontWeight:600,display:'block',marginBottom:4 }}>{label}</label>
            <input value={form[key]} onChange={e=>set(key,e.target.value)} placeholder={ph} style={inp} onFocus={e=>e.target.style.borderColor=t.accent} onBlur={e=>e.target.style.borderColor=t.border} />
          </div>
        ))}
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12,color:t.textMuted,fontWeight:600,display:'block',marginBottom:4 }}>Notes</label>
          <input value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Why it's special…" style={inp} onFocus={e=>e.target.style.borderColor=t.accent} onBlur={e=>e.target.style.borderColor=t.border} />
        </div>
        <button onClick={save} disabled={!form.name.trim()||saving} style={{ width:'100%',background:form.name.trim()?'linear-gradient(135deg,#f5a623,#ffcc5c)':t.cardAlt,border:'none',borderRadius:20,padding:12,color:form.name.trim()?'#fff':t.textMuted,fontWeight:700,fontSize:14,cursor:form.name.trim()?'pointer':'not-allowed' }}>{saving?'Saving…':'Add to Collection 🗄️'}</button>
      </div>
    </div>
  );
}
