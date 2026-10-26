import { useEffect, useState } from 'react'
import { Download, RefreshCw, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { dateLabel, daysAgo, errorMessage, timeLabel } from '../lib/domain'
import { Badge, DataTable, Field, Loading, Notice, PageHeader } from '../components/UI'

export function Settings({ farm, user, notify, demo = false }) {
  const [error, setError] = useState('')
  const [mailBusy, setMailBusy] = useState(false)
  async function save(event) {
    event.preventDefault(); setError('')
    const form = new FormData(event.currentTarget)
    const farm_name = String(form.get('farm_name')).trim()
    const owner_name = String(form.get('owner_name')).trim()
    if (!farm_name) return setError('Enter a farm name.')
    try { await farm.mutate('farm_settings','upsert',{ farm_name, owner_name }); notify('Farm settings saved.') }
    catch (err) { setError(err.message) }
  }
  async function resetPassword() {
    if (demo) return
    setMailBusy(true); setError('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/reset-password` })
      if (error) throw error
      notify('Password reset instructions have been requested. Check your email.')
    } catch (err) { setError(errorMessage(err)) }
    finally { setMailBusy(false) }
  }
  function exportData() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ exported_at: new Date().toISOString(), settings: farm.settings, records: farm.data },null,2)],{ type:'application/json' }))
    const link = document.createElement('a'); link.href=url; link.download='pasture-my-farm.json'; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  return <><PageHeader title="Farm & account settings" description="Make this workspace your own and manage your account."/><div className="settings-grid"><section className="panel"><h2>Farm details</h2><p className="muted">Only your account can view and update these details.</p><form className="record-form" onSubmit={save}><fieldset disabled={farm.busy}><Field label="Farm name" name="farm_name" required maxLength={100} defaultValue={farm.settings?.farm_name || ''}/><Field label="Your preferred name" name="owner_name" maxLength={80} defaultValue={farm.settings?.owner_name || ''}/><button className="button primary" type="submit">{farm.busy?'Saving…':'Save settings'}</button></fieldset></form></section><section className="panel"><h2>Your account</h2><dl className="account-details"><dt>Email</dt><dd>{user.email}</dd><dt>Access</dt><dd><Badge>{farm.profile?.role==='admin'?'Administrator':'Farm user'}</Badge></dd><dt>Account created</dt><dd>{dateLabel(farm.profile?.created_at)}</dd><dt>Latest sign-in</dt><dd>{timeLabel(farm.profile?.last_login_at)}</dd></dl><button className="button secondary" disabled={mailBusy||demo} onClick={resetPassword}>{demo?'Password reset requires a real account':mailBusy?'Sending…':'Send password reset email'}</button><hr/><h3>Take your records with you</h3><p className="muted">Download your farm settings and all currently loaded farm records as a JSON file.</p><button className="button secondary" onClick={exportData}><Download size={17}/>Export my farm data</button></section></div><Notice>{error}</Notice></>
}

export function Admin({ profile }) {
  const [tab,setTab]=useState('accounts')
  const [search,setSearch]=useState('')
  const [page,setPage]=useState(0)
  const [revision,setRevision]=useState(0)
  const [state,setState]=useState({ rows:[],count:0,total:0,active:0,loading:true,error:'' })
  useEffect(()=>{
    if(profile?.role!=='admin')return
    const controller=new AbortController()
    setState(previous=>({...previous,loading:true,error:''}))
    const timer=setTimeout(async()=>{
      try {
        let query=tab==='accounts'?supabase.from('profiles').select('id,email,role,created_at,last_login_at',{count:'exact'}).order('created_at',{ascending:false}).order('id'):supabase.from('login_events').select('id,email,signed_in_at',{count:'exact'}).gte('signed_in_at',`${daysAgo(89)}T00:00:00Z`).order('signed_in_at',{ascending:false}).order('id',{ascending:false})
        if(search.trim())query=query.ilike('email',`%${search.trim().replaceAll('%','').replaceAll('_','')}%`)
        const results=await Promise.all([query.range(page*25,page*25+24).abortSignal(controller.signal),supabase.from('profiles').select('id',{count:'exact',head:true}).abortSignal(controller.signal),supabase.from('profiles').select('id',{count:'exact',head:true}).gte('last_login_at',new Date(Date.now()-7*86400000).toISOString()).abortSignal(controller.signal)])
        results.forEach(result=>{if(result.error)throw result.error})
        if(!controller.signal.aborted)setState({rows:results[0].data,count:results[0].count,total:results[1].count,active:results[2].count,loading:false,error:''})
      }catch(err){if(!controller.signal.aborted)setState(previous=>({...previous,rows:[],loading:false,error:errorMessage(err)}))}
    },200)
    return()=>{clearTimeout(timer);controller.abort()}
  },[profile?.role,tab,search,page,revision])
  if(profile?.role!=='admin')return <Notice>This page is available only to the administrator.</Notice>
  const columns=tab==='accounts'?[{key:'email',label:'Account email'},{key:'role',label:'Role',render:row=><Badge tone={row.role==='admin'?'amber':''}>{row.role}</Badge>},{key:'created_at',label:'Created',render:row=>dateLabel(row.created_at)},{key:'last_login_at',label:'Latest sign-in',render:row=>timeLabel(row.last_login_at)}]:[{key:'email',label:'Account email'},{key:'signed_in_at',label:'Signed in at',render:row=>timeLabel(row.signed_in_at)}]
  return <><PageHeader eyebrow="ADMINISTRATOR ONLY" title="Account oversight" description="Understand account activity while keeping farm records private."><button className="button secondary" disabled={state.loading} onClick={()=>setRevision(value=>value+1)}><RefreshCw size={17}/>Refresh</button></PageHeader><div className="admin-summary"><div><strong>{state.total}</strong><span>Registered accounts</span></div><div><strong>{state.active}</strong><span>Accounts signed in within 7 days</span></div><div><ShieldCheck size={25}/><span>Read-only account oversight</span></div></div><Notice kind="info">This page shows email addresses and sign-in timestamps. It does not give access to passwords, IP addresses, or another user’s farm records. A recent login does not mean a user is currently online.</Notice><section className="panel records-panel"><div className="toolbar"><div className="tabs">{['accounts','activity'].map(value=><button className={tab===value?'active':''} key={value} onClick={()=>{setTab(value);setPage(0)}}>{value==='accounts'?'Accounts':'Sign-in history'}</button>)}</div><input className="admin-search" aria-label="Search accounts by email" placeholder="Search email…" value={search} onChange={event=>{setSearch(event.target.value);setPage(0)}}/></div><Notice>{state.error}</Notice>{state.loading?<Loading text="Loading account activity…"/>:<><DataTable paginated={false} caption={tab==='accounts'?'Account directory':'Sign-in history'} columns={columns} rows={state.rows}/><div className="pagination"><span>{state.count} matching {tab==='accounts'?'accounts':'sign-ins'}{tab==='activity'?' · Last 90 days':''}</span><div><button className="button secondary" disabled={page===0} onClick={()=>setPage(value=>value-1)}>Previous</button><span>Page {page+1}</span><button className="button secondary" disabled={(page+1)*25>=state.count} onClick={()=>setPage(value=>value+1)}>Next</button></div></div></>}</section></>
}

export function Help() {
  return <><PageHeader title="Help & privacy" description="A few simple habits make farm records more useful."/><div className="settings-grid"><section className="panel prose"><h2>Using your workspace</h2><h3>Start with your herd</h3><p>Add an animal with a unique tag. Use its health status to flag treatment, a checkup, or an inactive animal. Archive an animal by setting its status to Inactive; this keeps its health history.</p><h3>Log each milking session</h3><p>Enter one total for each morning or evening session, with the number of cows milked. Edit the saved record to correct a quantity. Reports calculate only from records you have saved.</p><h3>Keep follow-ups useful</h3><p>Give a health record a follow-up date to create an alert. After the follow-up is complete, clear that date or update it to the next appointment.</p><h3>Record stock in the right unit</h3><p>Keep a consistent unit for each item. Edit its quantity after deliveries and consumption. The low-stock threshold uses that same unit.</p></section><section className="panel prose"><h2>Your data and privacy</h2><p>Your account stores your herd, milk, health, inventory, tasks, and farm details. Access rules in the database limit these records to your account.</p><p>The administrator can see registered email addresses, account creation dates, the last sign-in, and recent sign-in events. The app does not collect IP addresses, device fingerprints, or passwords in its account directory.</p><p>Login history older than 90 days is pruned when a new sign-in is recorded. Your latest sign-in timestamp remains with your account. Supabase may retain separate infrastructure and authentication logs according to your project’s settings.</p><p>Project database operators have technical access to the database. The administrator screen itself has no access to other users’ farm records.</p><p>Export your farm records from Settings or download filtered CSV files from individual pages. Delete records you no longer need; animals with health history must be archived or have their linked records removed first.</p><h3>Dates and sessions</h3><p>Farm dates follow the dates you enter. Login timestamps are displayed in your device’s local time. Signing out ends this browser’s session.</p></section></div></>
}
