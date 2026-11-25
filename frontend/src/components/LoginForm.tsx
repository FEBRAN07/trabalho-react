import { useRef, useState, type FormEvent } from 'react'
import { errorMessage, type Session } from '../lib/api'

export function LoginForm({ onLogin, onConnected, onBusyChange }: {
  onLogin: (email: string, password: string) => Promise<Session>
  onConnected: (session: Session) => void
  onBusyChange: (busy: boolean) => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const pending = useRef(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending.current) return
    if (!email.trim() || !password) { setError('Informe o e-mail e a senha.'); return }
    pending.current = true; setSaving(true); setError(''); onBusyChange(true)
    try {
      const session = await onLogin(email, password)
      setPassword(''); onConnected(session)
    } catch (cause) { setError(errorMessage(cause)) }
    finally { pending.current = false; setSaving(false); onBusyChange(false) }
  }
  return <form onSubmit={submit} aria-busy={saving}><fieldset className="form-fields" disabled={saving}>
    <div className="form-body">
      <label className="field" htmlFor="login-email">E-mail <span className="required">*</span>
        <input autoFocus id="login-email" type="email" autoComplete="username" required value={email} onChange={event => { setEmail(event.target.value); setError('') }} />
      </label>
      <label className="field" htmlFor="login-password">Senha <span className="required">*</span>
        <input id="login-password" type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={event => { setPassword(event.target.value); setError('') }} />
      </label>
      {error && <div className="error-notice" role="alert">{error}</div>}
    </div>
    <div className="modal-footer"><button type="submit" className="button primary">{saving ? 'Entrando...' : 'Entrar'}</button></div>
  </fieldset></form>
}
