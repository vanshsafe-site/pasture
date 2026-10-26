import { useState } from 'react'
import { Field, Notice } from './UI'
import { today } from '../lib/domain'

export const healthStatuses = ['healthy', 'checkup_due', 'under_treatment', 'inactive']
export const titleCase = value => value?.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
const optional = value => String(value || '').trim() || null
export function RecordForm({ kind, record, cows, onSave, onClose, busy }) {
  const [error, setError] = useState('')
  const [healthDate, setHealthDate] = useState(record?.record_date || today())
  const row = record || {}
  async function submit(event) {
    event.preventDefault(); setError('')
    const form = new FormData(event.currentTarget)
    const raw = Object.fromEntries(form)
    let values
    if (kind === 'cows') values = { tag_number: raw.tag_number.trim(), name: raw.name.trim(), breed: raw.breed.trim(), age_label: optional(raw.age_label), health_status: raw.health_status }
    if (kind === 'milk_records') values = { record_date: raw.record_date, session: raw.session, liters: Number(raw.liters), cow_count: Number(raw.cow_count), notes: optional(raw.notes) }
    if (kind === 'health_records') values = { cow_id: raw.cow_id, record_date: raw.record_date, record_type: raw.record_type, summary: raw.summary.trim(), veterinarian: optional(raw.veterinarian), next_due: optional(raw.next_due) }
    if (kind === 'feed_inventory') values = { item_name: raw.item_name.trim(), quantity: Number(raw.quantity), unit: raw.unit, reorder_at: Number(raw.reorder_at) }
    if (kind === 'farm_tasks') values = { title: raw.title.trim(), due_date: raw.due_date, due_time: optional(raw.due_time), notes: optional(raw.notes), completed: row.completed || false }
    if (Object.values(values).some(value => value === '')) return setError('Required fields cannot contain only spaces.')
    if (kind === 'health_records' && values.next_due && values.next_due < values.record_date) return setError('The follow-up date must be on or after the record date.')
    try { await onSave(values); onClose() } catch (err) { setError(err.message) }
  }
  return <form onSubmit={submit} className="record-form"><fieldset disabled={busy}>
    {kind === 'cows' && <><div className="form-grid"><Field label="Tag number" name="tag_number" required maxLength={40} defaultValue={row.tag_number}/><Field label="Animal name" name="name" required maxLength={80} defaultValue={row.name}/></div><Field label="Breed" name="breed" required maxLength={80} defaultValue={row.breed}/><div className="form-grid"><Field label="Age" name="age_label" placeholder="e.g. 3 years" maxLength={40} defaultValue={row.age_label}/><Field label="Health status" name="health_status" options={healthStatuses.map(status => ({ value: status, label: titleCase(status) }))} defaultValue={row.health_status || 'healthy'}/></div></>}
    {kind === 'milk_records' && <><div className="form-grid"><Field label="Record date" name="record_date" type="date" required max={today()} defaultValue={row.record_date || today()}/><Field label="Session" name="session" options={['Morning', 'Evening']} defaultValue={row.session || 'Morning'}/><Field label="Milk produced (litres)" name="liters" type="number" required min="0.01" max="1000000" step="0.01" defaultValue={row.liters}/><Field label="Cows milked" name="cow_count" type="number" required min="1" max="100000" step="1" defaultValue={row.cow_count || ''}/></div><p className="field-hint">Enter the total for the whole session. Each date can have one morning and one evening record.</p><Field label="Notes" name="notes" type="textarea" maxLength={2000} defaultValue={row.notes}/></>}
    {kind === 'health_records' && <><Field label="Animal" name="cow_id" required options={[{ value: '', label: 'Select an animal' }, ...cows.map(cow => ({ value: cow.id, label: `${cow.name} · ${cow.tag_number}` }))]} defaultValue={row.cow_id || ''}/><div className="form-grid"><Field label="Record date" name="record_date" type="date" required max={today()} value={healthDate} onChange={event => setHealthDate(event.target.value)}/><Field label="Record type" name="record_type" options={['checkup', 'vaccination', 'treatment', 'note'].map(type => ({ value: type, label: titleCase(type) }))} defaultValue={row.record_type || 'checkup'}/></div><Field label="Summary" name="summary" type="textarea" required maxLength={2000} defaultValue={row.summary}/><div className="form-grid"><Field label="Veterinarian" name="veterinarian" maxLength={120} defaultValue={row.veterinarian}/><Field label="Follow-up date" name="next_due" type="date" min={healthDate} defaultValue={row.next_due}/></div></>}
    {kind === 'feed_inventory' && <><Field label="Feed or inventory item" name="item_name" required maxLength={120} defaultValue={row.item_name}/><div className="form-grid"><Field label="Quantity in stock" name="quantity" type="number" required min="0" max="1000000" step="0.01" defaultValue={row.quantity ?? 0}/><Field label="Unit" name="unit" options={['kg', 'tonnes', 'litres', 'bags', 'units']} defaultValue={row.unit || 'kg'}/></div><Field label="Low-stock threshold" name="reorder_at" type="number" required min="0" max="1000000" step="0.01" defaultValue={row.reorder_at ?? 0} hint="An alert appears when quantity is at or below this level."/></>}
    {kind === 'farm_tasks' && <><Field label="Task" name="title" required maxLength={160} defaultValue={row.title}/><div className="form-grid"><Field label="Due date" name="due_date" type="date" required defaultValue={row.due_date || today()}/><Field label="Time (optional)" name="due_time" type="time" defaultValue={row.due_time?.slice(0, 5)}/></div><Field label="Notes" name="notes" type="textarea" maxLength={2000} defaultValue={row.notes}/></>}
    <Notice>{error}</Notice><div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" type="submit">{busy ? 'Saving…' : record ? 'Save changes' : 'Save record'}</button></div>
  </fieldset></form>
}
