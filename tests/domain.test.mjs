import test from 'node:test'
import assert from 'node:assert/strict'
import { csvText, dailyProduction, daysAgo, errorMessage, localDate, productionSummary, today } from '../src/lib/domain.js'
import { changeDemo, createDemo, DEMO_USER, loadDemo, DEMO_STORAGE_KEY } from '../src/lib/demo.js'

const storeFor = value => ({ getItem:key => key===DEMO_STORAGE_KEY?value:null })

test('farm dates use local calendar dates, including year boundaries', () => {
  assert.match(today(), /^\d{4}-\d\d-\d\d$/)
  assert.equal(localDate(new Date(2025, 0, 1, 0, 1)), '2025-01-01')
  assert.equal(daysAgo(1, new Date(2025, 0, 1, 0, 1)), '2024-12-31')
})

test('production reports total only saved sessions and guard empty averages', () => {
  const records=[{record_date:'2025-01-01',session:'Morning',liters:48,cow_count:4},{record_date:'2025-01-01',session:'Evening',liters:32,cow_count:4},{record_date:'2024-12-31',session:'Morning',liters:900,cow_count:10}]
  assert.deepEqual(productionSummary(records,'2025-01-01','2025-01-01'),{records:records.slice(0,2),liters:80,milkings:8,average:10})
  assert.equal(productionSummary([], '2025-01-01','2025-01-01').average,0)
  assert.deepEqual(dailyProduction(records,1,new Date(2025,0,1,12))[0],{date:'2025-01-01',morning:48,evening:32})
})

test('CSV export escapes quotes and formula-like user input', () => {
  const csv=csvText(['Name','Notes'],[['Daisy','calm, "healthy"'],['=1+1','@SUM(A1)'],['-2','+cmd']])
  assert.ok(csv.startsWith('\uFEFF'))
  assert.match(csv,/"calm, ""healthy"""/)
  assert.match(csv,/"'=1\+1","'@SUM\(A1\)"/)
  assert.match(csv,/"'-2","'\+cmd"/)
})

test('demo sample data has a private regular-user identity and all work areas', () => {
  const sample=createDemo()
  assert.equal(sample.profile.role,'user')
  assert.equal(sample.profile.id,DEMO_USER.id)
  assert.deepEqual(Object.keys(sample.data).sort(),['cows','farm_tasks','feed_inventory','health_records','milk_records'].sort())
  for(const collection of Object.values(sample.data)) assert.ok(collection.every(row=>row.owner_id===DEMO_USER.id))
  assert.equal(sample.data.milk_records.length,28)
  assert.equal(sample.data.health_records.length,2)
})

test('demo storage rejects corrupted records and never trusts local admin role', () => {
  assert.throws(()=>loadDemo(storeFor('{bad')),/could not be loaded/)
  const stored=createDemo();stored.profile.role='admin'
  const loaded=loadDemo(storeFor(JSON.stringify(stored)))
  assert.equal(loaded.profile.role,'user')
  assert.equal(loaded.profile.id,DEMO_USER.id)
})

test('demo edits return a new state and increment row versions', () => {
  const initial=createDemo();const cow=initial.data.cows[0]
  const updated=changeDemo(initial,'cows','update',{name:'Daisy Mae'},cow)
  assert.equal(initial.data.cows[0].name,'Daisy')
  assert.equal(updated.data.cows[0].name,'Daisy Mae')
  assert.equal(updated.data.cows[0].version,2)
})

test('demo validation catches duplicate tags and duplicate daily sessions', () => {
  const sample=createDemo()
  assert.throws(()=>changeDemo(sample,'cows','insert',{tag_number:'C-101',name:'Copy',breed:'Jersey',health_status:'healthy'}),/tag number already exists/)
  assert.throws(()=>changeDemo(sample,'milk_records','insert',{record_date:sample.data.milk_records[0].record_date,session:sample.data.milk_records[0].session,liters:20,cow_count:2}),/session already exists/)
})

test('demo protects health history and animal ownership', () => {
  const sample=createDemo();const clover=sample.data.cows.find(cow=>cow.tag_number==='C-103')
  assert.throws(()=>changeDemo(sample,'cows','delete',null,clover),/health records/)
  assert.throws(()=>changeDemo(sample,'health_records','insert',{cow_id:'someone-elses-cow',record_date:'2025-01-01',record_type:'note',summary:'No'}),/Choose an animal/)
})

test('demo detects stale versions and disallows arbitrary tables', () => {
  const sample=createDemo();const task=sample.data.farm_tasks[0]
  assert.throws(()=>changeDemo(sample,'farm_tasks','update',{completed:false},{...task,version:55}),/changed in another tab/)
  assert.throws(()=>changeDemo(sample,'profiles','update',{role:'admin'},sample.profile),/unavailable/)
})

test('database errors tell users how to recover', () => {
  assert.match(errorMessage({code:'PGRST205'}),/supabase\/setup.sql/)
  assert.match(errorMessage({code:'23505'}),/already exists/)
  assert.match(errorMessage({code:'42501'}),/permission/)
})
