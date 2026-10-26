import { useEffect, useState } from 'react'
import { Check, CircleHelp, ClipboardList, Droplets, FileText, HeartPulse, LayoutDashboard, LogOut, Menu, RefreshCw, Settings as SettingsIcon, ShieldCheck, Sprout, Users, Wheat, X } from 'lucide-react'
import { supabase, configError } from './lib/supabase'
import { useFarm } from './lib/useFarm'
import { useDemoFarm } from './lib/useDemoFarm'
import { DEMO_USER } from './lib/demo'
import { errorMessage } from './lib/domain'
import { Auth } from './pages/Auth'
import { Admin, Help, Settings } from './pages/Account'
import { Overview, RecordsPage, Reports } from './pages/FarmPages'
import { Loading, Modal, Notice } from './components/UI'
import { RecordForm } from './components/RecordForm'

const navigation = [
  ['overview','Overview',LayoutDashboard],['herd','Herd',Users],['milk','Milk production',Droplets],['health','Health records',HeartPulse],['feed','Feed & inventory',Wheat],['tasks','Tasks',ClipboardList],['reports','Reports',FileText],['settings','Settings',SettingsIcon],['help','Help & privacy',CircleHelp],
]
const validPages = new Set([...navigation.map(item=>item[0]),'admin'])
const readPage = () => window.location.pathname.split('/')[1] || 'overview'

export default function App() {
  const [demo,setDemo]=useState(()=>{try{return sessionStorage.getItem('pasture.demo.active')==='yes'}catch{return false}})
  const [session,setSession]=useState(null)
  const [ready,setReady]=useState(!supabase)
  const [authError,setAuthError]=useState('')
  const [recovery,setRecovery]=useState(window.location.pathname==='/reset-password')
  useEffect(()=>{
    if(!supabase)return
    let alive=true
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,next)=>{
      if(!alive)return
      setSession(next);setReady(true)
      if(event==='PASSWORD_RECOVERY')setRecovery(true)
    })
    supabase.auth.getSession().then(({data,error})=>{
      if(!alive)return
      if(error)setAuthError(errorMessage(error))
      setSession(data?.session||null);setReady(true)
    }).catch(error=>{if(alive){setAuthError(errorMessage(error));setReady(true)}})
    const params=new URLSearchParams(window.location.hash.slice(1))
    if(params.has('error_description')){setAuthError(params.get('error_description'));window.history.replaceState({},'',window.location.pathname)}
    return()=>{alive=false;subscription.unsubscribe()}
  },[])
  function startDemo(){try{sessionStorage.setItem('pasture.demo.active','yes')}catch{};window.history.replaceState({},'','/overview');setDemo(true)}
  function exitDemo(){try{sessionStorage.removeItem('pasture.demo.active')}catch{};window.history.replaceState({},'','/');setDemo(false)}
  if(demo)return <Workspace key="demo" user={DEMO_USER} demo onExitDemo={exitDemo}/>
  if(configError)return <main className="setup-page"><div className="brand"><span><Sprout size={24}/></span>pasture.</div><section className="panel"><h1>Connect your farm workspace</h1><p>{configError}</p><p>Use <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>. Values in <code>.env.example</code> are not loaded.</p><p>Setup instructions are in <code>README.md</code>. The sign-in screen appears once configuration is ready.</p><button className="button primary" onClick={startDemo}>Explore demo — no login needed</button></section></main>
  if(!ready)return <main className="setup-page"><Loading text="Opening your secure workspace…"/></main>
  if(!session || recovery)return <Auth onDemo={startDemo} key={recovery?'recovery':'signin'} recovery={recovery&&!!session} initialError={authError} onRecovered={()=>{setRecovery(false);window.history.replaceState({},'','/overview')}}/>
  return <Workspace key={session.user.id} user={session.user}/>
}

function Workspace({user,demo=false,onExitDemo}) {
  const liveFarm=useFarm(demo?null:user.id)
  const demoFarm=useDemoFarm(demo)
  const farm=demo?demoFarm:liveFarm
  const [page,setPage]=useState(readPage)
  const [mobileOpen,setMobileOpen]=useState(false)
  const [editor,setEditor]=useState(null)
  const [deleting,setDeleting]=useState(null)
  const [deleteError,setDeleteError]=useState('')
  const [resetDemo,setResetDemo]=useState(false)
  const [toast,setToast]=useState('')
  const [actionError,setActionError]=useState('')
  const [signingOut,setSigningOut]=useState(false)
  const [online,setOnline]=useState(navigator.onLine)
  useEffect(()=>{
    const pop=()=>setPage(readPage())
    const status=()=>setOnline(navigator.onLine)
    window.addEventListener('popstate',pop);window.addEventListener('online',status);window.addEventListener('offline',status)
    return()=>{window.removeEventListener('popstate',pop);window.removeEventListener('online',status);window.removeEventListener('offline',status)}
  },[])
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),5000);return()=>clearTimeout(timer)},[toast])
  function navigate(next) {
    window.history.pushState({},'',`/${next}`);setPage(next);setMobileOpen(false);setActionError('');window.scrollTo({top:0,behavior:'instant'})
  }
  useEffect(()=>{
    if(page==='auth'||page==='reset-password'){window.history.replaceState({},'','/overview');setPage('overview')}
    document.title=`${navigation.find(item=>item[0]===page)?.[1]||'Account oversight'} · Pasture`
  },[page])
  async function signOut() {
    if(demo){onExitDemo();return}
    setSigningOut(true);setActionError('')
    try { const {error}=await supabase.auth.signOut({scope:'local'});if(error)throw error }
    catch(err){setActionError(errorMessage(err));setSigningOut(false)}
  }
  function edit(kind,record=null){setEditor({kind,record});setActionError('')}
  function confirmDelete(kind,record){setDeleteError('');setDeleting({kind,record})}
  async function remove() {
    try {await farm.mutate(deleting.kind,'delete',null,deleting.record);setDeleting(null);setToast('Record deleted.')}
    catch(err){setDeleteError(err.message)}
  }
  async function toggleTask(task) {
    setActionError('')
    try {await farm.mutate('farm_tasks','update',{completed:!task.completed},task);setToast(task.completed?'Task reopened.':'Task completed.')}
    catch(err){setActionError(err.message)}
  }
  const nav=<><a className="brand" href="/overview" onClick={event=>{event.preventDefault();navigate('overview')}}><span><Sprout size={24}/></span>pasture.</a><div className="farm-switch"><span className="farm-icon"><Sprout size={22}/></span><div><strong>{farm.settings?.farm_name||'My farm'}</strong><small>{demo?'Editable sample farm':'Private workspace'}</small></div></div><div className="nav-label">WORKSPACE</div><nav aria-label="Main navigation">{[...navigation,...(farm.profile?.role==='admin'?[['admin','Account oversight',ShieldCheck]]:[])].map(([key,label,Icon])=><a key={key} href={`/${key}`} className={`nav-item ${key===page?'selected':''}`} aria-current={key===page?'page':undefined} onClick={event=>{if(!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&event.button===0){event.preventDefault();navigate(key)}}}><Icon size={19}/>{label}</a>)}</nav><div className="sidebar-footer"><div className="user-profile"><span className="avatar">{(farm.settings?.owner_name||user.email||'U').slice(0,2).toUpperCase()}</span><div><strong title={user.email}>{farm.settings?.owner_name||user.email}</strong><small>{demo?'Demo visitor':farm.profile?.role==='admin'?'Administrator':'Farm user'}</small></div></div><button className="button secondary signout" disabled={signingOut||farm.busy} onClick={signOut}><LogOut size={17}/>{demo?'Exit demo':signingOut?'Signing out…':'Sign out'}</button></div></>
  const pageProps={data:farm.data,onEdit:edit,onDelete:confirmDelete,onToggle:toggleTask,busy:farm.busy}
  return <div className="app-shell"><a className="skip-link" href="#main-content">Skip to content</a><aside className="sidebar">{nav}</aside>{mobileOpen&&<Modal title="Farm workspace" onClose={()=>setMobileOpen(false)}><div className="mobile-navigation">{nav}</div></Modal>}<main className="main-content" id="main-content"><header className="topbar"><button className="icon-button menu-toggle" aria-label="Open navigation" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(true)}><Menu size={22}/></button><div className="breadcrumb"><span>{farm.settings?.farm_name||'My farm'}</span><span>/</span><strong>{page==='admin'?'Account oversight':navigation.find(item=>item[0]===page)?.[1]||'Page not found'}</strong></div><div className="topbar-actions"><span className="connection"><i className={online?'':'offline'}/>{online?'Network available':'Offline'}</span><button className="icon-button" aria-label="Refresh farm data" disabled={farm.loading||farm.busy} onClick={farm.reload}><RefreshCw size={18} className={farm.loading?'spin':''}/></button></div></header><div className="page-wrap">
    {demo&&<div className="demo-banner"><div><strong>You’re exploring the demo</strong><span>Edit anything. Sample data stays in this browser and never changes a real farm.</span></div><div className="demo-actions"><button className="button secondary" onClick={()=>setResetDemo(true)}>Reset demo</button><button className="button primary" onClick={onExitDemo}>Exit demo</button></div></div>}
    {!online&&!demo&&<Notice kind="info">You’re offline. Reconnect before making changes.</Notice>}<Notice>{actionError}</Notice>
    {farm.loading?<Loading/>:farm.error?<section className="panel"><h1>We couldn’t open your farm</h1><Notice>{farm.error}</Notice><button className="button primary" onClick={farm.reload}><RefreshCw size={17}/>Retry connection</button><p className="muted">If this is your first sign-in, apply supabase/setup.sql in your Supabase project.</p></section>:<>
      {page==='overview'&&<Overview {...pageProps} settings={farm.settings} navigate={navigate}/>}
      {['herd','milk','health','feed','tasks'].includes(page)&&<RecordsPage key={page} page={page} {...pageProps}/>}
      {page==='reports'&&<Reports data={farm.data}/>}
      {page==='settings'&&<Settings demo={demo} farm={farm} user={user} notify={setToast}/>}
      {page==='admin'&&<Admin profile={farm.profile}/>}
      {page==='help'&&<Help/>}
      {!validPages.has(page)&&<section className="panel"><h1>Page not found</h1><button className="button primary" onClick={()=>navigate('overview')}>Return to overview</button></section>}
    </>}<footer className="page-footer"><span>Pasture · A little more care, every day.</span><button className="text-button" onClick={()=>navigate('help')}>Help & privacy</button></footer>
  </div></main>
  {editor&&<Modal title={`${editor.record?'Edit':'Add'} ${{cows:'animal',milk_records:'milk production',health_records:'health record',feed_inventory:'inventory item',farm_tasks:'task'}[editor.kind]}`} busy={farm.busy} onClose={()=>setEditor(null)}><RecordForm kind={editor.kind} record={editor.record} cows={farm.data.cows} busy={farm.busy} onClose={()=>setEditor(null)} onSave={async values=>{await farm.mutate(editor.kind,editor.record?'update':'insert',values,editor.record);setToast('Record saved.')}}/></Modal>}
  {deleting&&<Modal title="Delete this record?" busy={farm.busy} onClose={()=>setDeleting(null)}><p>This permanently removes the selected record from your farm.</p>{deleting.kind==='cows'&&<p>Animals with health history cannot be deleted. Set their health status to Inactive to archive them instead.</p>}<Notice>{deleteError}</Notice><div className="form-actions"><button className="button secondary" disabled={farm.busy} onClick={()=>setDeleting(null)}>Cancel</button><button className="button destructive" disabled={farm.busy} onClick={remove}>{farm.busy?'Deleting…':'Delete record'}</button></div></Modal>}
  {resetDemo&&<Modal title="Reset demo data?" onClose={()=>setResetDemo(false)}><p>This removes your demo edits and restores the sample farm in this browser. Real accounts are unaffected.</p><div className="form-actions"><button className="button secondary" onClick={()=>setResetDemo(false)}>Cancel</button><button className="button primary" onClick={()=>{try{farm.reset();setResetDemo(false);setToast('Sample farm restored.')}catch(err){setActionError(err.message);setResetDemo(false)}}}>Restore sample farm</button></div></Modal>}
  {toast&&<div className="toast" role="status"><Check size={19}/><span>{toast}</span><button className="icon-button" aria-label="Dismiss notification" onClick={()=>setToast('')}><X size={17}/></button></div>}
  </div>
}
