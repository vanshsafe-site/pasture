import { daysAgo, today } from './domain.js'

export const DEMO_STORAGE_KEY = 'pasture.demo.v1'
export const DEMO_USER = Object.freeze({ id: 'demo-farmer', email: 'demo@example.test' })
const tables = ['cows', 'milk_records', 'health_records', 'feed_inventory', 'farm_tasks']
export function createDemo() {
  const now = new Date().toISOString()
  const row = (id, values) => ({ id, owner_id: DEMO_USER.id, version: 1, created_at: now, updated_at: now, ...values })
  const cows = [
    row('demo-cow-1', { tag_number: 'C-101', name: 'Daisy', breed: 'Holstein Friesian', age_label: '4 years', health_status: 'healthy' }),
    row('demo-cow-2', { tag_number: 'C-102', name: 'Maple', breed: 'Jersey', age_label: '3 years', health_status: 'healthy' }),
    row('demo-cow-3', { tag_number: 'C-103', name: 'Clover', breed: 'Gir', age_label: '5 years', health_status: 'checkup_due' }),
    row('demo-cow-4', { tag_number: 'C-104', name: 'Buttercup', breed: 'Brown Swiss', age_label: '4 years', health_status: 'healthy' }),
    row('demo-cow-5', { tag_number: 'C-105', name: 'Willow', breed: 'Jersey', age_label: '2 years', health_status: 'under_treatment' }),
    row('demo-cow-6', { tag_number: 'C-106', name: 'Hazel', breed: 'Holstein Friesian', age_label: '8 years', health_status: 'inactive' }),
  ]
  const milk_records = Array.from({ length: 14 }, (_, day) => ['Morning','Evening'].map((session,index) => row(`demo-milk-${day}-${index}`, { record_date: daysAgo(day), session, liters: Number((45 + ((day * 7) % 13) + (index ? -8 : 6)).toFixed(2)), cow_count: 4, notes: 'Sample production record' }))).flat()
  return {
    schema: 1,
    profile: { id: DEMO_USER.id, email: DEMO_USER.email, role: 'user', created_at: now, last_login_at: null },
    settings: { owner_id: DEMO_USER.id, farm_name: 'Greenfield Demo Farm', owner_name: 'Demo farmer', version: 1, created_at: now, updated_at: now },
    data: {
      cows, milk_records,
      health_records: [row('demo-health-1', { cow_id:'demo-cow-3',record_date:daysAgo(7),record_type:'checkup',summary:'Routine checkup; follow-up scheduled.',veterinarian:'Sample veterinarian',next_due:today() }),row('demo-health-2', { cow_id:'demo-cow-5',record_date:daysAgo(2),record_type:'treatment',summary:'Sample treatment record. Follow the veterinarian’s instructions.',veterinarian:'Sample veterinarian',next_due:daysAgo(-3) })],
      feed_inventory: [row('demo-feed-1',{item_name:'Silage',quantity:180,unit:'kg',reorder_at:200}),row('demo-feed-2',{item_name:'Green fodder',quantity:850,unit:'kg',reorder_at:150}),row('demo-feed-3',{item_name:'Mineral mixture',quantity:6,unit:'bags',reorder_at:2})],
      farm_tasks: [row('demo-task-1',{title:'Morning milking',due_date:today(),due_time:'06:30:00',notes:'Record the total after milking.',completed:true}),row('demo-task-2',{title:'Arrange Clover’s follow-up',due_date:today(),due_time:'10:00:00',notes:'Check the health record before the visit.',completed:false}),row('demo-task-3',{title:'Order silage',due_date:daysAgo(1),due_time:null,notes:'Stock is below the reorder threshold.',completed:false}),row('demo-task-4',{title:'Evening milking',due_date:today(),due_time:'17:00:00',notes:null,completed:false})],
    },
  }
}
export function loadDemo(storage) {
  const raw = storage.getItem(DEMO_STORAGE_KEY)
  if (!raw) return createDemo()
  const saved = JSON.parse(raw)
  if (saved.schema !== 1 || !saved.settings || !saved.data || !tables.every(table => Array.isArray(saved.data[table]))) throw new Error('Demo data could not be loaded. Reset the demo to restore the sample farm.')
  // A locally edited demo profile can never become a real administrator.
  return { ...saved, profile: { ...saved.profile, ...DEMO_USER, role: 'user' } }
}
export function changeDemo(current, table, action, values, previous) {
  const next = structuredClone(current)
  const now = new Date().toISOString()
  if (table === 'farm_settings') {
    next.settings = { ...current.settings, ...values, owner_id:DEMO_USER.id, updated_at:now, version:current.settings.version+1 }
    return next
  }
  if (!tables.includes(table)) throw new Error('That operation is unavailable in the demo.')
  const rows = next.data[table]
  if (action !== 'insert') {
    const saved = rows.find(row=>row.id===previous?.id)
    if (!saved || saved.version !== previous.version) throw new Error('This demo record changed in another tab. Refresh before trying again.')
  }
  if (action === 'delete') {
    if (table==='cows'&&next.data.health_records.some(row=>row.cow_id===previous.id)) throw new Error('This animal has health records. Set its health status to Inactive to archive it.')
    next.data[table]=rows.filter(row=>row.id!==previous.id)
    return next
  }
  const merged={ ...previous, ...values }
  if (table==='cows'&&rows.some(row=>row.id!==previous?.id&&row.tag_number===merged.tag_number)) throw new Error('This tag number already exists.')
  if (table==='milk_records'&&rows.some(row=>row.id!==previous?.id&&row.record_date===merged.record_date&&row.session===merged.session)) throw new Error('This milking session already exists. Edit the existing session or choose a different date.')
  if (table==='health_records'&&!next.data.cows.some(row=>row.id===merged.cow_id)) throw new Error('Choose an animal from the demo herd.')
  if(action==='insert') rows.push({ ...values,id:crypto.randomUUID(),owner_id:DEMO_USER.id,created_at:now,updated_at:now,version:1 })
  else next.data[table]=rows.map(row=>row.id===previous.id?{...row,...values,updated_at:now,version:row.version+1}:row)
  return next
}
