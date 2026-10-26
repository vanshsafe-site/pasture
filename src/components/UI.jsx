import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, LoaderCircle, Sprout, X } from 'lucide-react'
import { dateLabel, number } from '../lib/domain'

export function Notice({ children, kind = 'error' }) {
  if (!children) return null
  const Icon = kind === 'success' ? CheckCircle2 : AlertCircle
  return <div className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}><Icon size={18}/><span>{children}</span></div>
}
export function Loading({ text = 'Loading your farm…' }) {
  return <div className="loading" role="status"><LoaderCircle className="spin" size={24}/><span>{text}</span></div>
}
export function Empty({ title = 'No records yet', text = 'Your records will appear here.', action }) {
  return <div className="empty"><span className="empty-icon"><Sprout size={28}/></span><h3>{title}</h3><p>{text}</p>{action}</div>
}
export function PageHeader({ eyebrow, title, description, children }) {
  return <header className="page-heading"><div><div className="eyebrow"><span/>{eyebrow || 'YOUR FARM WORKSPACE'}</div><h1>{title}</h1><p>{description}</p></div><div className="heading-actions">{children}</div></header>
}
export function Metric({ icon: Icon, label, value, unit, detail, tone = 'green' }) {
  return <article className="metric"><div className={`metric-icon ${tone}`}><Icon size={20}/></div><p>{label}</p><strong>{value}<small>{unit}</small></strong><span>{detail}</span></article>
}
export function Badge({ children, tone = '' }) { return <span className={`badge ${tone}`}>{children}</span> }
export function Modal({ title, children, onClose, busy }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    const focused = document.activeElement
    dialog.showModal()
    return () => { dialog.close(); focused?.focus?.() }
  }, [])
  return <dialog ref={ref} className="modal" aria-labelledby="modal-title" onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="modal-heading"><h2 id="modal-title">{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={20}/></button></div>{children}
  </dialog>
}
export function Field({ label, name, type = 'text', options, hint, ...props }) {
  return <label className="field" htmlFor={name}><span>{label}{props.required && <span aria-hidden="true"> *</span>}</span>{options ? <select id={name} name={name} {...props}>{options.map(option => { const item = typeof option === 'string' ? { value: option, label: option } : option; return <option value={item.value} key={item.value}>{item.label}</option> })}</select> : type === 'textarea' ? <textarea id={name} name={name} rows={3} {...props}/> : <input id={name} name={name} type={type} {...props}/>} {hint && <small>{hint}</small>}</label>
}
export function DataTable({ columns, rows, rowKey = 'id', empty, caption, paginated = true }) {
  const [page, setPage] = useState(0)
  const size = paginated ? 20 : Math.max(1, rows.length)
  const last = Math.max(0, Math.ceil(rows.length / size) - 1)
  const current = Math.min(page, last)
  if (!rows.length) return empty || <Empty/>
  return <><div className="table-scroll" tabIndex="0" role="region" aria-label={caption || 'Records table'}><table><caption className="sr-only">{caption}</caption><thead><tr>{columns.map(column => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead><tbody>{rows.slice(current * size, (current + 1) * size).map(row => <tr key={row[rowKey]}>{columns.map(column => <td key={column.key}>{column.render ? column.render(row) : row[column.key] || '—'}</td>)}</tr>)}</tbody></table></div><div className="pagination" style={{display: paginated ? undefined : "none"}}><span>{current * size + 1}–{Math.min((current + 1) * size, rows.length)} of {number(rows.length)}</span><div><button className="icon-button" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft size={18}/></button><button className="icon-button" aria-label="Next page" disabled={current === last} onClick={() => setPage(current + 1)}><ChevronRight size={18}/></button></div></div></>
}
export function ProductionChart({ days }) {
  const max = Math.max(1, ...days.map(day => day.morning + day.evening))
  return <><div className="chart-legend"><span><i/>Morning</span><span><i/>Evening</span><small>Litres per day</small></div><div className="production-chart" role="img" aria-label={days.map(day => `${dateLabel(day.date)}: ${number(day.morning + day.evening)} litres`).join('. ')}>{days.map(day => <div className="chart-column" key={day.date}><small>{number(day.morning + day.evening)}</small><div className="chart-track"><div className="chart-stack" style={{ height: `${(day.morning + day.evening) / max * 100}%` }}><div className="evening-bar" style={{ flex: day.evening }}/><div className="morning-bar" style={{ flex: day.morning }}/></div></div><span>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</span></div>)}</div></>
}
