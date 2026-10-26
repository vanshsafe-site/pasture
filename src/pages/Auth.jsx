import { useState } from 'react'
import { ArrowRight, Leaf, ShieldCheck, Sprout } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../lib/domain'
import { Field, Notice } from '../components/UI'

export function Auth({ recovery = false, onRecovered, onDemo, initialError = '' }) {
  const [mode, setMode] = useState('signin')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initialError)
  const [message, setMessage] = useState('')
  const active = recovery ? 'recovery' : mode
  const titles = { signin: 'Welcome back.', signup: 'A fresh start for your farm.', forgot: 'Let’s get you back in.', resend: 'Confirm your email.', recovery: 'Choose a new password.' }
  const descriptions = { signin: 'Sign in to pick up where you left off.', signup: 'Create an account to keep your farm organised.', forgot: 'We’ll email a secure link to reset your password.', resend: 'Request another account confirmation email.', recovery: 'Use a unique password with at least 12 characters.' }
  const changeMode = next => { setMode(next); setError(''); setMessage('') }
  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setError(''); setMessage('')
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') || '').trim()
    const password = String(form.get('password') || '')
    if (['signup','recovery'].includes(active) && password !== form.get('confirm')) return setError('The passwords do not match.')
    setBusy(true)
    try {
      let result
      if (active === 'signin') result = await supabase.auth.signInWithPassword({ email, password })
      if (active === 'signup') result = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })
      if (active === 'forgot') result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
      if (active === 'resend') result = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })
      if (active === 'recovery') result = await supabase.auth.updateUser({ password })
      if (result.error) throw result.error
      if (active === 'signup' && !result.data.session) setMessage('Check your inbox to confirm your account, then sign in. If you already have an account, use Sign in or reset your password.')
      if (active === 'forgot') setMessage('If an account exists for this email, a password reset link will arrive shortly. Check your spam folder too.')
      if (active === 'resend') setMessage('If confirmation is required for this account, an email will arrive shortly.')
      if (active === 'recovery') onRecovered()
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }
  return <main className="auth-layout"><section className="auth-story"><a className="brand" href="/"><span><Sprout size={24}/></span>pasture.</a><div className="auth-story-copy"><div className="eyebrow">MADE FOR THE EVERYDAY FARMER</div><h1>Good records.<br/>Healthier herds.<br/><em>Better days.</em></h1><p>A little less paperwork. A little more time for the things that grow.</p><div className="auth-landscape" aria-hidden="true"><span className="sun"/><span className="hill one"/><span className="hill two"/><Leaf className="landscape-leaf" size={75}/></div></div><span className="auth-foot">Your farm, thoughtfully organised.</span></section><section className="auth-form-section"><div className="auth-card"><div className="brand mobile-brand"><span><Sprout size={24}/></span>pasture.</div><div className="eyebrow">YOUR FARM WORKSPACE</div><h2>{titles[active]}</h2><p>{descriptions[active]}</p><form onSubmit={submit}><fieldset disabled={busy}>
    {active !== 'recovery' && <Field label="Email address" name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com"/>}
    {['signin','signup','recovery'].includes(active) && <Field label={active === 'recovery' ? 'New password' : 'Password'} name="password" type="password" required minLength={active==='signin'?1:12} maxLength={128} autoComplete={active==='signin'?'current-password':'new-password'}/>}
    {['signup','recovery'].includes(active) && <Field label="Confirm password" name="confirm" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/>}
    {active==='signin' && <button className="text-button auth-forgot" type="button" onClick={()=>changeMode('forgot')}>Forgot password?</button>}
    <Notice>{error}</Notice><Notice kind="success">{message}</Notice>
    <button type="submit" className="button primary full-width">{busy?'Please wait…':{signin:'Sign in',signup:'Create account',forgot:'Send reset link',resend:'Resend confirmation',recovery:'Update password'}[active]}{!busy&&<ArrowRight size={18}/>}</button>
    </fieldset></form>{!recovery&&<div className="auth-switch">{active==='signin'?<>New here? <button className="text-button" onClick={()=>changeMode('signup')}>Create an account</button></>:<button className="text-button" onClick={()=>changeMode('signin')}>Back to sign in</button>}{['signin','signup'].includes(active)&&<button className="text-button" onClick={()=>changeMode('resend')}>Resend confirmation email</button>}</div>}
    {!recovery&&<div className="demo-entry"><span>Want to look around first?</span><button type="button" className="button secondary full-width" disabled={busy} onClick={onDemo}>Explore demo — no login needed</button><small>Edit a sample farm. Your changes stay in this browser.</small></div>}
    <p className="auth-privacy"><ShieldCheck size={17}/>Your farm records are private to your account. Administrators can view your email and sign-in times to manage access.</p>
  </div></section></main>
}
