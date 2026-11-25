import { useEffect, useRef, useState, type FormEvent } from 'react'
import { errorMessage, type Api } from '../lib/api'
import { displayDate } from '../lib/registry'
import { validateUser, type User, type UserInput } from '../lib/users'
import { Modal } from './Modal'
import { RecordActions } from './RecordActions'
import { DeleteConfirmation } from './DeleteConfirmation'
import { Plus, Search } from './Icons'

const profileLabel = (profile: User['profile']) => profile === 'ATENDENTE' ? 'Atendente' : 'Técnico'

export function UserForm({ initialUser, onSave, onSaved, onCancel, onBusyChange }: {
  initialUser?: User; onSave: (input: UserInput) => Promise<User>; onSaved: (user: User) => void
  onCancel: () => void; onBusyChange: (busy: boolean) => void
}) {
  const [input, setInput] = useState<UserInput>({ name: initialUser?.name ?? '', email: initialUser?.email ?? '', password: '', profile: initialUser?.profile ?? 'ATENDENTE', active: initialUser?.active ?? true })
  const [errors, setErrors] = useState<ReturnType<typeof validateUser>>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const pending = useRef(false)
  function change<K extends keyof UserInput>(field: K, value: UserInput[K]) {
    setInput(previous => ({ ...previous, [field]: value })); setErrors({}); setError('')
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending.current) return
    const validation = validateUser(input, !!initialUser)
    setErrors(validation)
    if (Object.keys(validation).length) return
    pending.current = true; setSaving(true); setError(''); onBusyChange(true)
    try { onSaved(await onSave(input)) }
    catch (cause) { setError(errorMessage(cause)) }
    finally { pending.current = false; setSaving(false); onBusyChange(false) }
  }
  return <form onSubmit={submit} noValidate aria-busy={saving}><fieldset disabled={saving} className="form-fields"><div className="form-body">
    <label className="field" htmlFor="user-name">Nome completo <span className="required">*</span>
      <input id="user-name" autoFocus autoComplete="off" value={input.name} onChange={e => change('name', e.target.value)} aria-required="true" aria-invalid={!!errors.name} aria-describedby="user-name-error" />
      {errors.name && <span id="user-name-error" className="field-error">{errors.name}</span>}
    </label>
    <label className="field" htmlFor="user-email">E-mail <span className="required">*</span>
      <input id="user-email" type="email" autoComplete="off" value={input.email} onChange={e => change('email', e.target.value)} aria-required="true" aria-invalid={!!errors.email} aria-describedby="user-email-error" />
      {errors.email && <span id="user-email-error" className="field-error">{errors.email}</span>}
    </label>
    <div className="form-grid">
      <label className="field" htmlFor="user-profile">Perfil <span className="required">*</span>
        <select id="user-profile" value={input.profile} onChange={e => change('profile', e.target.value as User['profile'])} aria-required="true" aria-invalid={!!errors.profile} aria-describedby="user-profile-error"><option value="ATENDENTE">Atendente</option><option value="TECNICO">Técnico</option></select>
        {errors.profile && <span id="user-profile-error" className="field-error">{errors.profile}</span>}
      </label>
      {initialUser && <label className="field" htmlFor="user-status">Situação<select id="user-status" value={input.active ? 'active' : 'inactive'} onChange={e => change('active', e.target.value === 'active')}><option value="active">Ativo</option><option value="inactive">Inativo</option></select></label>}
    </div>
    <label className="field" htmlFor="user-password">{initialUser ? 'Nova senha' : 'Senha'} {!initialUser && <span className="required">*</span>}
      <input id="user-password" type="password" maxLength={1024} autoComplete="new-password" value={input.password} onChange={e => change('password', e.target.value)} aria-required={!initialUser} aria-invalid={!!errors.password} aria-describedby="user-password-hint user-password-error" />
      {initialUser && <span id="user-password-hint" className="field-hint">Deixe em branco para manter a senha atual.</span>}
      {errors.password && <span id="user-password-error" className="field-error">{errors.password}</span>}
    </label>
    {error && <div className="error-notice" role="alert">{error}</div>}
  </div><div className="modal-footer"><span><span className="required">*</span> Campo obrigatório</span><div><button type="button" className="button secondary" onClick={onCancel}>Cancelar</button><button type="submit" className="button primary">{saving ? 'Salvando...' : initialUser ? 'Salvar alterações' : 'Cadastrar usuário'}</button></div></div></fieldset></form>
}

export function UserDetails({ api, id, canManage, onEdit, onDelete }: { api: Api; id: string; canManage: boolean; onEdit: (user: User) => void; onDelete: (user: User) => void }) {
  const [state, setState] = useState<{ user?: User; error?: string }>({})
  useEffect(() => {
    const controller = new AbortController()
    void api.getUser(id, controller.signal).then(user => {
      if (!controller.signal.aborted) setState({ user })
    }).catch(cause => { if (!controller.signal.aborted) setState({ error: errorMessage(cause) }) })
    return () => controller.abort()
  }, [api, id])
  if (state.error) return <div className="detail-body error-notice" role="alert">{state.error}</div>
  if (!state.user) return <div className="detail-body" role="status">Consultando usuário...</div>
  const user = state.user
  return <div className="detail-body"><dl className="detail-grid">
    <div><dt>Nome</dt><dd>{user.name}</dd></div><div><dt>Identificador</dt><dd>#{user.id}</dd></div>
    <div><dt>E-mail</dt><dd>{user.email}</dd></div><div><dt>Perfil</dt><dd>{profileLabel(user.profile)}</dd></div>
    <div><dt>Situação</dt><dd>{user.active ? 'Ativo' : 'Inativo'}</dd></div><div><dt>Cadastrado em</dt><dd>{displayDate(user.createdAt)}</dd></div>
  </dl><RecordActions canManage={canManage} onEdit={() => onEdit(user)} onDelete={() => onDelete(user)} /></div>
}

export function UserTable({ users, onDetails }: { users: User[]; onDetails: (user: User) => void }) {
  return <div className="table-wrap"><table><thead><tr><th>USUÁRIO</th><th>E-MAIL</th><th>PERFIL</th><th>SITUAÇÃO</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{users.map(user => <tr key={user.id}>
    <td><div className="identity-cell"><div><button className="row-name" onClick={() => onDetails(user)}>{user.name}</button><span className="record-code">#{user.id}</span></div></div></td><td>{user.email}</td><td>{profileLabel(user.profile)}</td><td>{user.active ? 'Ativo' : 'Inativo'}</td><td><button className="button secondary" onClick={() => onDetails(user)}>Ver detalhes</button></td>
  </tr>)}</tbody></table></div>
}

type UserDialog = { kind: 'new' } | { kind: 'detail' | 'edit' | 'delete'; user: User } | null
export function UsersPage({ api, canManage, onBusyChange, onNotice }: { api: Api; canManage: boolean; onBusyChange: (busy: boolean) => void; onNotice: (message: string) => void }) {
  const [result, setResult] = useState<{ users: User[]; status: 'loading' | 'success' | 'error'; error?: string }>({ users: [], status: 'loading' })
  const [query, setQuery] = useState('')
  const [revision, setRevision] = useState(0)
  const [dialog, setDialog] = useState<UserDialog>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    void api.listUsers(controller.signal).then(users => {
      if (!controller.signal.aborted) setResult({ users, status: 'success' })
    }).catch(cause => { if (!controller.signal.aborted) setResult({ users: [], status: 'error', error: errorMessage(cause) }) })
    return () => controller.abort()
  }, [api, revision])
  function refresh() { setResult({ users: [], status: 'loading' }); setRevision(value => value + 1) }
  function close() {
    if (busy) return
    setDialog(previous => previous?.kind === 'edit' || previous?.kind === 'delete' ? { kind: 'detail', user: previous.user } : null)
  }
  function saved(user: User) {
    onNotice(`Usuário ${user.name} salvo com sucesso.`); refresh(); setDialog({ kind: 'detail', user })
  }
  function busyChanged(value: boolean) { setBusy(value); onBusyChange(value) }
  const term = query.trim().toLocaleLowerCase('pt-BR')
  const users = result.users.filter(user => `${user.name} ${user.email} ${profileLabel(user.profile)}`.toLocaleLowerCase('pt-BR').includes(term))
  return <>
    <section className="registry-panel" aria-labelledby="users-title">
      <div className="panel-heading"><h2 id="users-title">Atendentes e técnicos</h2>{canManage && <button className="button primary" onClick={() => setDialog({ kind: 'new' })}><Plus size={18} />Novo usuário</button>}</div>
      <div className="toolbar"><div className="search-field"><Search size={18} /><input aria-label="Filtrar usuários" placeholder="Filtrar por nome, e-mail ou perfil" value={query} onChange={e => setQuery(e.target.value)} /></div><button className="button secondary" disabled={result.status === 'loading'} onClick={refresh}>Atualizar lista</button></div>
      {result.status === 'loading' && <div className="empty-state" role="status">Consultando usuários...</div>}
      {result.status === 'error' && <div className="panel-message error-notice" role="alert">{result.error}</div>}
      {result.status === 'success' && (users.length ? <><UserTable users={users} onDetails={user => setDialog({ kind: 'detail', user })} /><div className="table-footer"><span>{users.length} usuário(s)</span></div></> : <div className="empty-state"><h3>{query ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}</h3></div>)}
    </section>
    {dialog?.kind === 'new' && <Modal title="Novo usuário" busy={busy} onClose={close}><UserForm onSave={api.createUser} onSaved={saved} onCancel={close} onBusyChange={busyChanged} /></Modal>}
    {dialog?.kind === 'detail' && <Modal title="Dados do usuário" onClose={close}><UserDetails key={`${dialog.user.id}:${revision}`} api={api} id={dialog.user.id} canManage={canManage} onEdit={user => setDialog({ kind: 'edit', user })} onDelete={user => setDialog({ kind: 'delete', user })} /></Modal>}
    {dialog?.kind === 'edit' && <Modal title="Editar usuário" subtitle={`Identificador #${dialog.user.id}`} busy={busy} onClose={close}><UserForm initialUser={dialog.user} onSave={input => api.updateUser(dialog.user.id, input)} onSaved={saved} onCancel={close} onBusyChange={busyChanged} /></Modal>}
    {dialog?.kind === 'delete' && <Modal title="Excluir usuário" busy={busy} onClose={close}><DeleteConfirmation resource="usuário" description={`${dialog.user.name} (#${dialog.user.id})`} onDelete={() => api.deleteUser(dialog.user.id)} onDeleted={() => { onNotice(`Usuário ${dialog.user.name} excluído com sucesso.`); refresh(); setDialog(null) }} onCancel={close} onBusyChange={busyChanged} /></Modal>}
  </>
}
