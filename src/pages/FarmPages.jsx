import { useState } from 'react'
import { ArrowRight, CalendarDays, Check, Download, Droplets, HeartPulse, Leaf, Pencil, Plus, Search, Trash2, Users, Wheat } from 'lucide-react'
import { Badge, DataTable, Empty, Field, Metric, PageHeader, ProductionChart } from '../components/UI'
import { healthStatuses, titleCase } from '../components/RecordForm'
import { dailyProduction, dateLabel, daysAgo, downloadCSV, number, productionSummary, today } from '../lib/domain'

const labels = { cows: 'animal', milk_records: 'milk record', health_records: 'health record', feed_inventory: 'inventory item', farm_tasks: 'task' }
export function RecordActions({ kind, row, onEdit, onDelete }) {
  return <div className="row-actions"><button className="icon-button" title="Edit" aria-label={`Edit ${labels[kind]}`} onClick={() => onEdit(kind, row)}><Pencil size={16}/></button><button className="icon-button danger" title="Delete" aria-label={`Delete ${labels[kind]}`} onClick={() => onDelete(kind, row)}><Trash2 size={16}/></button></div>
}
export function Overview({ data, settings, onEdit, navigate, onToggle, busy }) {
  const date = today()
  const active = data.cows.filter(cow => cow.health_status !== 'inactive')
  const milk = productionSummary(data.milk_records, date, date)
  const week = productionSummary(data.milk_records, daysAgo(6), date)
  const low = data.feed_inventory.filter(item => Number(item.quantity) <= Number(item.reorder_at))
  const due = data.farm_tasks.filter(task => !task.completed && task.due_date <= date).sort((a,b) => `${a.due_date}${a.due_time}`.localeCompare(`${b.due_date}${b.due_time}`))
  const followups = data.health_records.filter(row => row.next_due && row.next_due <= date)
  return <>
    <PageHeader eyebrow={new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} title={`Welcome${settings?.owner_name ? `, ${settings.owner_name}` : ' to your farm'}`} description="A clear view of your herd, your output, and the day ahead."><button className="button primary" onClick={() => onEdit('milk_records')}><Plus size={18}/>Log milk production</button></PageHeader>
    <div className="metric-grid"><Metric icon={Droplets} label="Milk produced today" value={number(milk.liters)} unit="L" detail={`${milk.records.length} of 2 sessions recorded`}/><Metric icon={Users} tone="lilac" label="Active herd" value={active.length} unit="animals" detail={`${data.cows.length - active.length} archived`}/><Metric icon={HeartPulse} tone="peach" label="Health follow-ups due" value={followups.length} unit="records" detail="Today and overdue"/><Metric icon={Wheat} tone="sand" label="Low-stock items" value={low.length} unit="items" detail={`${data.feed_inventory.length} items in inventory`}/></div>
    <div className="overview-grid"><section className="panel"><div className="panel-heading"><div><div className="eyebrow">PRODUCTION</div><h2>A week of milk</h2><p>Your recorded output over the last seven days.</p></div><strong className="big-number">{number(week.liters)} <small>L</small></strong></div><ProductionChart days={dailyProduction(data.milk_records)}/><button className="text-button panel-link" onClick={() => navigate('reports')}>Open production reports<ArrowRight size={16}/></button></section>
    <section className="panel"><div className="panel-heading"><div><div className="eyebrow">YOUR DAY</div><h2>Tasks to take care of</h2><p>Due today, plus anything still outstanding.</p></div><button className="icon-button" aria-label="Add task" onClick={() => onEdit('farm_tasks')}><Plus size={20}/></button></div>{due.length ? <div className="task-list">{due.slice(0,5).map(task => <div className="task-item" key={task.id}><button className="task-check" aria-label={`Complete ${task.title}`} disabled={busy} onClick={() => onToggle(task)}><Check size={16}/></button><div><strong>{task.title}</strong><span>{dateLabel(task.due_date)}{task.due_time ? ` · ${task.due_time.slice(0,5)}` : ''}</span></div>{task.due_date < date && <Badge tone="amber">Overdue</Badge>}</div>)}</div> : <Empty title="All caught up" text="Add a task to plan your next milking, delivery, or checkup."/>}<button className="text-button panel-link" onClick={() => navigate('tasks')}>Open all tasks<ArrowRight size={16}/></button></section></div>
    <div className="overview-grid"><section className="panel"><div className="panel-heading"><div><div className="eyebrow">THE HERD</div><h2>Your animals</h2><p>Healthy routines begin with good records.</p></div><button className="button secondary" onClick={() => onEdit('cows')}><Plus size={16}/>Add animal</button></div>{data.cows.length ? <div className="animal-preview">{data.cows.slice(0,4).map(cow => <button key={cow.id} onClick={() => onEdit('cows', cow)}><span className="animal-icon"><Users size={20}/></span><span><strong>{cow.name}</strong><small>{cow.tag_number} · {cow.breed}</small></span><Badge tone={cow.health_status === 'healthy' ? '' : 'amber'}>{titleCase(cow.health_status)}</Badge></button>)}</div> : <Empty title="Give your herd a home" text="Add your first animal to start keeping health and herd records."/>}<button className="text-button panel-link" onClick={() => navigate('herd')}>Manage your herd<ArrowRight size={16}/></button></section>
    <section className="panel attention-panel"><div className="eyebrow">FARM NOTES</div><div className="farm-art" aria-hidden="true"><Leaf size={60}/><span/></div><h2>A little attention goes a long way.</h2><p>{low.length ? `${low.length} inventory items have reached their reorder threshold.` : 'Your inventory has no low-stock alerts.'}</p><button className="text-button" onClick={() => navigate('feed')}>Review inventory<ArrowRight size={16}/></button>{followups.length > 0 && <button className="text-button" onClick={() => navigate('health')}>{followups.length} health follow-ups need attention<ArrowRight size={16}/></button>}</section></div>
  </>
}

export function RecordsPage({ page, data, onEdit, onDelete, onToggle, busy }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const kind = { herd:'cows', milk:'milk_records', health:'health_records', feed:'feed_inventory', tasks:'farm_tasks' }[page]
  const config = {
    herd: ['Your herd', 'Keep an accurate record of each animal, from arrival to retirement.', 'Add animal'],
    milk: ['Milk production', 'Record morning and evening totals. Every litre counts.', 'Log milk'],
    health: ['Health records', 'Checkups, treatments, vaccinations, and follow-up dates.', 'Add health record'],
    feed: ['Feed & inventory', 'Track stock in its own unit and know when it is time to reorder.', 'Add item'],
    tasks: ['Farm tasks', 'Plan daily work and keep track of what has been completed.', 'Add task'],
  }[page]
  const cowName = row => { const cow = data.cows.find(cow => cow.id === row.cow_id); return cow ? `${cow.name} · ${cow.tag_number}` : 'Unknown animal' }
  let rows = [...data[kind]].filter(row => `${Object.values(row).join(' ')} ${kind === 'health_records' ? cowName(row) : ''}`.toLowerCase().includes(search.toLowerCase().trim()))
  if (page === 'herd' && filter !== 'all') rows = rows.filter(row => row.health_status === filter)
  if (page === 'milk' && filter !== 'all') rows = rows.filter(row => row.session === filter)
  if (page === 'health' && filter === 'due') rows = rows.filter(row => row.next_due && row.next_due <= today())
  if (page === 'feed' && filter === 'low') rows = rows.filter(row => Number(row.quantity) <= Number(row.reorder_at))
  if (page === 'tasks' && filter !== 'all') rows = rows.filter(row => filter === 'completed' ? row.completed : !row.completed)
  if (['milk', 'health'].includes(page)) rows = rows.filter(row => (!start || row.record_date >= start) && (!end || row.record_date <= end))
  rows.sort((a,b) => page === 'tasks' ? `${a.due_date}${a.due_time || ''}`.localeCompare(`${b.due_date}${b.due_time || ''}`) : (b.record_date || b.created_at || b.updated_at).localeCompare(a.record_date || a.created_at || a.updated_at))
  const action = { key:'actions', label:'Actions', render:row => <RecordActions kind={kind} row={row} onEdit={onEdit} onDelete={onDelete}/> }
  const columns = {
    herd: [{key:'name',label:'Animal',render:row=><div className="cell-stack"><strong>{row.name}</strong><small>{row.tag_number}</small></div>},{key:'breed',label:'Breed'},{key:'age_label',label:'Age'},{key:'health_status',label:'Status',render:row=><Badge tone={row.health_status==='healthy'?'':row.health_status==='inactive'?'neutral':'amber'}>{titleCase(row.health_status)}</Badge>},action],
    milk: [{key:'record_date',label:'Date',render:row=>dateLabel(row.record_date)},{key:'session',label:'Session'},{key:'liters',label:'Milk (L)',render:row=><strong>{number(row.liters)}</strong>},{key:'cow_count',label:'Cows milked'},{key:'notes',label:'Notes',render:row=><span className="cell-notes">{row.notes || '—'}</span>},action],
    health: [{key:'cow_id',label:'Animal',render:cowName},{key:'record_date',label:'Date',render:row=>dateLabel(row.record_date)},{key:'record_type',label:'Type',render:row=>titleCase(row.record_type)},{key:'summary',label:'Summary',render:row=><span className="cell-notes">{row.summary}</span>},{key:'veterinarian',label:'Veterinarian'},{key:'next_due',label:'Follow-up',render:row=>row.next_due?<Badge tone={row.next_due<=today()?'amber':'neutral'}>{dateLabel(row.next_due)}</Badge>:'—'},action],
    feed: [{key:'item_name',label:'Item'},{key:'quantity',label:'Stock',render:row=><strong>{number(row.quantity)} {row.unit}</strong>},{key:'reorder_at',label:'Reorder at',render:row=>`${number(row.reorder_at)} ${row.unit}`},{key:'status',label:'Status',render:row=>Number(row.quantity)<=Number(row.reorder_at)?<Badge tone="amber">Low stock</Badge>:<Badge>In stock</Badge>},action],
    tasks: [{key:'completed',label:'Done',render:row=><button className={`task-check ${row.completed?'checked':''}`} aria-label={`${row.completed?'Reopen':'Complete'} ${row.title}`} disabled={busy} onClick={()=>onToggle(row)}><Check size={16}/></button>},{key:'title',label:'Task',render:row=><div className="cell-stack"><strong className={row.completed?'strike':''}>{row.title}</strong><small>{row.notes}</small></div>},{key:'due_date',label:'Due date',render:row=>dateLabel(row.due_date)},{key:'due_time',label:'Time',render:row=>row.due_time?.slice(0,5)||'—'},{key:'status',label:'Status',render:row=><Badge tone={!row.completed&&row.due_date<today()?'amber':''}>{row.completed?'Completed':row.due_date<today()?'Overdue':'Open'}</Badge>},action],
  }[page]
  const filters = { herd: healthStatuses.map(value=>({value,label:titleCase(value)})), milk:['Morning','Evening'].map(value=>({value,label:value})), health:[{value:'due',label:'Follow-ups due'}], feed:[{value:'low',label:'Low stock'}], tasks:[{value:'open',label:'Open'},{value:'completed',label:'Completed'}] }[page]
  const exportRows = () => {
    const keys = Object.keys(rows[0] || {}).filter(key=>!['id','owner_id','version'].includes(key))
    downloadCSV(`pasture-${page}-${today()}.csv`, keys, rows.map(row=>keys.map(key=>row[key])))
  }
  return <><PageHeader title={config[0]} description={config[1]}><button className="button primary" disabled={page==='health'&&!data.cows.length} onClick={()=>onEdit(kind)}><Plus size={18}/>{config[2]}</button></PageHeader>
    {page==='health'&&!data.cows.length ? <section className="panel"><Empty title="Add an animal first" text="Health records are linked to an animal in your private herd." action={<button className="button primary" onClick={()=>onEdit('cows')}><Plus size={18}/>Add animal</button>}/></section> : <section className="panel records-panel"><div className="toolbar"><label className="search"><Search size={18}/><input aria-label="Search records" placeholder={`Search ${config[0].toLowerCase()}…`} value={search} onChange={event=>setSearch(event.target.value)}/></label><select aria-label="Filter records" value={filter} onChange={event=>setFilter(event.target.value)}><option value="all">All records</option>{filters.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select><button className="button secondary" disabled={!rows.length} onClick={exportRows}><Download size={16}/>Export CSV</button></div>
    {['milk','health'].includes(page)&&<div className="date-filters"><Field label="From date" name="start" type="date" max={end||today()} value={start} onChange={event=>setStart(event.target.value)}/><Field label="To date" name="end" type="date" min={start} max={today()} value={end} onChange={event=>setEnd(event.target.value)}/><button className="text-button" onClick={()=>{setStart('');setEnd('')}}>Clear dates</button></div>}
    <DataTable key={`${search}-${filter}-${start}-${end}`} caption={config[0]} columns={columns} rows={rows} empty={<Empty title={data[kind].length?'No matching records':'Start your first record'} text={data[kind].length?'Try another search or filter.':'Your saved records will appear here.'}/>}/></section>}
  </>
}

export function Reports({ data }) {
  const [start, setStart] = useState(daysAgo(29))
  const [end, setEnd] = useState(today())
  const summary = productionSummary(data.milk_records, start, end)
  const valid = start && end && start <= end
  return <><PageHeader title="Production reports" description="Real totals from your saved milk records. Choose a date range and take your report with you."><button className="button primary" disabled={!valid||!summary.records.length} onClick={()=>downloadCSV(`pasture-milk-${start}-to-${end}.csv`,['Date','Session','Litres','Cows milked','Notes'],summary.records.sort((a,b)=>a.record_date.localeCompare(b.record_date)).map(row=>[row.record_date,row.session,row.liters,row.cow_count,row.notes]))}><Download size={18}/>Download report</button></PageHeader><section className="panel report-filters"><Field label="From date" name="report_start" type="date" required max={end} value={start} onChange={event=>setStart(event.target.value)}/><Field label="To date" name="report_end" type="date" required min={start} max={today()} value={end} onChange={event=>setEnd(event.target.value)}/></section>
    {!valid?<Empty title="Choose a valid date range" text="The start date must be on or before the end date."/>:<><div className="metric-grid report-metrics"><Metric icon={Droplets} label="Total milk produced" value={number(summary.liters)} unit="L" detail={`${dateLabel(start)} – ${dateLabel(end)}`}/><Metric icon={CalendarDays} tone="lilac" label="Milking sessions" value={summary.records.length} detail="Saved sessions in this date range"/><Metric icon={Users} tone="peach" label="Average per cow per session" value={number(summary.average)} unit="L" detail="Total litres ÷ recorded cows milked"/></div><section className="panel"><div className="panel-heading"><div><h2>Session breakdown</h2><p>Missing sessions are not estimated or filled with sample data.</p></div></div><DataTable caption="Milk report" rows={[...summary.records].sort((a,b)=>b.record_date.localeCompare(a.record_date))} columns={[{key:'record_date',label:'Date',render:row=>dateLabel(row.record_date)},{key:'session',label:'Session'},{key:'liters',label:'Litres',render:row=>number(row.liters)},{key:'cow_count',label:'Cows milked'},{key:'average',label:'L / cow / session',render:row=>number(Number(row.cow_count)>0?Number(row.liters)/Number(row.cow_count):0)}]}/></section></>}
  </>
}
