export const today = () => localDate(new Date())
export function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function daysAgo(days, from = new Date()) {
  const date = new Date(from); date.setDate(date.getDate() - days); return localDate(date)
}
export const number = value => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(value) || 0)
export function dateLabel(value) {
  if (!value) return '—'
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
export function timeLabel(value) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not yet'
}
export function productionSummary(records, start, end) {
  const selected = records.filter(r => r.record_date >= start && r.record_date <= end)
  const liters = selected.reduce((sum, r) => sum + Number(r.liters), 0)
  const milkings = selected.reduce((sum, r) => sum + Number(r.cow_count), 0)
  return { records: selected, liters, milkings, average: milkings ? liters / milkings : 0 }
}
export function dailyProduction(records, count = 7, end = new Date()) {
  return Array.from({ length: count }, (_, index) => {
    const date = daysAgo(count - index - 1, end)
    const rows = records.filter(row => row.record_date === date)
    return { date, morning: rows.filter(r => r.session === 'Morning').reduce((s, r) => s + Number(r.liters), 0), evening: rows.filter(r => r.session === 'Evening').reduce((s, r) => s + Number(r.liters), 0) }
  })
}
export function csvText(headers, rows) {
  const cell = value => {
    let text = String(value ?? '')
    // Prevent spreadsheet formulas when user-entered names/notes are exported.
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  return '\uFEFF' + [headers, ...rows].map(row => row.map(cell).join(',')).join('\r\n')
}
export function downloadCSV(filename, headers, rows) {
  const url = URL.createObjectURL(new Blob([csvText(headers, rows)], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function errorMessage(error) {
  if (error?.code === '23505') return 'This record already exists. Check the tag number or the date and milking session.'
  if (error?.code === '23503') return 'The linked animal is missing or has related health records. Refresh your records; archive animals with health history instead of deleting them.'
  if (error?.code === 'PGRST116') return 'Your account profile is not ready. Apply supabase/setup.sql in your project’s SQL Editor, then retry.'
  if (error?.code === '23514') return 'Please check your values. A date, quantity, or required field is invalid.'
  if (['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error?.code)) return 'The database setup is incomplete. Apply supabase/setup.sql in your project’s SQL Editor, then retry.'
  if (error?.code === '42501') return 'You do not have permission to perform this action.'
  if (/fetch|network|abort|timeout/i.test(error?.message || '')) return 'The connection failed. Check your internet connection and try again.'
  return error?.message || 'Something went wrong. Please try again.'
}
