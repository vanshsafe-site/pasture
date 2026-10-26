import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { errorMessage } from './domain'

const tables = ['cows', 'milk_records', 'health_records', 'feed_inventory', 'farm_tasks']
const empty = () => Object.fromEntries(tables.map(name => [name, []]))
async function readAll(table, ownerId, signal) {
  const rows = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from(table).select('*').eq('owner_id', ownerId).order('id').range(offset, offset + 499).abortSignal(signal)
    if (error) throw error
    rows.push(...data)
    if (data.length < 500) return rows
  }
}

export function useFarm(userId) {
  const [data, setData] = useState(empty)
  const [profile, setProfile] = useState(null)
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const controller = useRef(null)
  const mutationLock = useRef(false)
  const reload = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    controller.current?.abort()
    const request = new AbortController(); controller.current = request
    setLoading(true); setError('')
    try {
      const [collections, profileResult, settingsResult] = await Promise.all([
        Promise.all(tables.map(table => readAll(table, userId, request.signal))),
        supabase.from('profiles').select('id,email,role,created_at,last_login_at').eq('id', userId).single().abortSignal(request.signal),
        supabase.from('farm_settings').select('*').eq('owner_id', userId).maybeSingle().abortSignal(request.signal),
      ])
      if (profileResult.error) throw profileResult.error
      if (settingsResult.error) throw settingsResult.error
      if (request.signal.aborted) return
      setData(Object.fromEntries(tables.map((table, index) => [table, collections[index]])))
      setProfile(profileResult.data); setSettings(settingsResult.data)
    } catch (err) { if (!request.signal.aborted) setError(errorMessage(err)) }
    finally { if (!request.signal.aborted) setLoading(false) }
  }, [userId])
  useEffect(() => { reload(); return () => controller.current?.abort() }, [reload])

  const mutate = async (table, action, values, previous) => {
    if (!userId) throw new Error('Sign in before saving farm records.')
    if (mutationLock.current) throw new Error('Please wait for the current change to finish.')
    mutationLock.current = true; setBusy(true)
    try {
      let result
      if (table === 'farm_settings') {
        result = await supabase.from(table).upsert({ ...values, owner_id: userId }, { onConflict: 'owner_id' }).select().single()
      } else if (action === 'insert') {
        result = await supabase.from(table).insert({ ...values, owner_id: userId }).select().single()
      } else {
        const query = action === 'delete' ? supabase.from(table).delete() : supabase.from(table).update(values)
        result = await query.eq('id', previous.id).eq('owner_id', userId).eq('version', previous.version).select().maybeSingle()
        if (!result.error && !result.data) throw new Error('This record changed in another session. Refresh the page before trying again.')
      }
      if (result.error) throw result.error
      // Publish only server-confirmed values; failed writes never appear saved.
      if (table === 'farm_settings') setSettings(result.data)
      else setData(current => ({ ...current, [table]: action === 'delete' ? current[table].filter(row => row.id !== previous.id) : action === 'insert' ? [...current[table], result.data] : current[table].map(row => row.id === previous.id ? result.data : row) }))
      return result.data
    } catch (err) { throw new Error(errorMessage(err)) }
    finally { mutationLock.current = false; setBusy(false) }
  }
  return { data, profile, settings, loading, error, busy, reload, mutate }
}
