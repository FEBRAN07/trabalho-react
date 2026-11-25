import { useRef, useState, type FormEvent } from 'react'
import { errorMessage } from '../lib/api'
import type { Client } from '../lib/registry'

export function DeactivateClient({ client, onDeactivate, onDeactivated, onCancel, onBusyChange, reactivate = false }: {
  reactivate?: boolean
  client: Client; onDeactivate: () => Promise<Client>; onDeactivated: (client: Client) => void
  onCancel: () => void; onBusyChange: (busy: boolean) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending.current) return
    pending.current = true; setSaving(true); setError(''); onBusyChange(true)
    try { onDeactivated(await onDeactivate()) }
    catch (cause) { setError(errorMessage(cause)) }
    finally { pending.current = false; setSaving(false); onBusyChange(false) }
  }
  return <form onSubmit={submit} aria-busy={saving}>
    <div className="form-body">
      <p>Confirma a {reactivate ? 'reabilitação' : 'desativação'} de <strong>{client.name} ({client.code})</strong>?</p>
      <p>{reactivate ? 'O cliente e todos os seus equipamentos voltarão a ficar ativos e aparecerão nas buscas padrão.' : 'Todos os equipamentos deste cliente também serão desativados. Os cadastros serão preservados e poderão ser consultados marcando “Incluir inativos”.'}</p>
      {error && <div className="error-notice" role="alert">{error}</div>}
    </div>
    <div className="modal-footer"><div>
      <button autoFocus className="button secondary" type="button" disabled={saving} onClick={onCancel}>Cancelar</button>
      <button className={`button ${reactivate ? 'primary' : 'danger'}`} type="submit" disabled={saving}>{saving ? reactivate ? 'Reabilitando...' : 'Desativando...' : reactivate ? 'Confirmar reabilitação' : 'Confirmar desativação'}</button>
    </div></div>
  </form>
}
