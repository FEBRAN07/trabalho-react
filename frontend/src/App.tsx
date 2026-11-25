
import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { Check, ChevronRight, ClipboardList, Monitor, Plus, UserRound, UsersRound, X, Zap } from './components/Icons'
import { OrdersPage } from './components/Orders'
import { Modal } from './components/Modal'
import { ClientForm, EquipmentForm } from './components/Forms'
import { ClientSearch, EquipmentPanel } from './components/SearchPanels'
import { ClientDetails, EquipmentDetails } from './components/Details'
import { DeleteConfirmation } from './components/DeleteConfirmation'
import { UsersPage } from './components/Users'
import { createApi, type Session } from './lib/api'
import type { Client, Equipment } from './lib/registry'

type Page = 'clients' | 'equipment' | 'orders' | 'users'

type Dialog =
  | { kind: 'client' }
  | { kind: 'client-edit' | 'client-delete' | 'client-detail'; client: Client }
  | { kind: 'equipment'; client: Client }
  | { kind: 'equipment-edit' | 'equipment-delete'; client: Client; item: Equipment }
  | { kind: 'equipment-detail'; client: Client; code: string }
  | null

export default function App({
  apiBaseUrl = 'http://localhost:3000/api',
}: {
  apiBaseUrl?: string
}) {
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)

  const [sessionVersion, setSessionVersion] = useState(0)
  const [page, setPage] = useState<Page>('clients')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [clientRevision, setClientRevision] = useState(0)
  const [notice, setNotice] = useState('')
  const [sessionError, setSessionError] = useState('')

  const token = session?.token ?? ''
  const profile = session?.user.profile ?? null

  const unauthorized = useCallback(() => {
    setSession(null)
    setSelectedClient(null)
    setDialog(null)
    setBusy(false)
    setNotice('')
    setSessionError('Sua sessão expirou. Entre novamente.')
  }, [])

  const api = useMemo(
    () => createApi(apiBaseUrl, token, unauthorized),
    [apiBaseUrl, token, unauthorized],
  )

  const canCreate = !!token && profile === 'ATENDENTE'
  const isClients = page === 'clients'

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (loginBusy) return

    if (!email.trim() || !password) {
      setLoginError('Informe seu e-mail e sua senha.')
      return
    }

    setLoginBusy(true)
    setLoginError('')

    try {
      const nextSession = await api.login(email, password)
      setSession(nextSession)

      setPassword('')
      setSessionError('')
      setLoginError('')
      setSelectedClient(null)
      setDialog(null)
      setPage('clients')
      setNotice('')
      setSessionVersion(value => value + 1)
    } catch (error) {
      setLoginError(
        error instanceof TypeError
          ? 'Não foi possível conectar à API. Verifique se o servidor está funcionando.'
          : error instanceof Error
            ? error.message
            : 'Não foi possível realizar o login.',
      )
    } finally {
      setLoginBusy(false)
    }
  }

  function disconnect() {
    setSession(null)
    setSelectedClient(null)
    setDialog(null)
    setNotice('')
    setSessionError('')
    setEmail('')
    setPassword('')
    setSessionVersion(value => value + 1)
  }

  function selectClient(client: Client) {
    setSelectedClient(client)
    setPage('equipment')
    setDialog(null)
  }

  function clientCreated(client: Client) {
    setNotice(`Cliente ${client.name} cadastrado com sucesso. Identificador ${client.code}.`)
    selectClient(client)
  }

  function equipmentCreated(item: Equipment) {
    setNotice(`Equipamento #${item.code} cadastrado para o cliente #${item.clientId}.`)
    setDialog(null)
    setRevision(value => value + 1)
  }

  function clientUpdated(client: Client) {
    setNotice(`Cliente ${client.name} atualizado com sucesso.`)
    setSelectedClient(previous =>
      previous?.id === client.id ? client : previous,
    )
    setClientRevision(value => value + 1)
    setDialog({ kind: 'client-detail', client })
  }

  function clientDeleted(client: Client) {
    setNotice(`Cliente ${client.name} excluído com sucesso.`)

    if (selectedClient?.id === client.id) {
      setSelectedClient(null)
      setPage('clients')
    }

    setClientRevision(value => value + 1)
    setDialog(null)
  }

  function equipmentUpdated(item: Equipment) {
    setNotice(`Equipamento #${item.code} atualizado com sucesso.`)
    setRevision(value => value + 1)

    if (selectedClient) {
      setDialog({
        kind: 'equipment-detail',
        client: selectedClient,
        code: item.code,
      })
    } else {
      setDialog(null)
    }
  }

  function equipmentDeleted(item: Equipment) {
    setNotice(`Equipamento #${item.code} excluído do cliente #${item.clientId}.`)
    setRevision(value => value + 1)
    setDialog(null)
  }

  function closeDialog() {
    if (busy) return

    if (dialog?.kind === 'client-edit' || dialog?.kind === 'client-delete') {
      setDialog({ kind: 'client-detail', client: dialog.client })
    } else if (
      dialog?.kind === 'equipment-edit' ||
      dialog?.kind === 'equipment-delete'
    ) {
      setDialog({
        kind: 'equipment-detail',
        client: dialog.client,
        code: dialog.item.code,
      })
    } else {
      setDialog(null)
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#clientes"
          onClick={event => {
            event.preventDefault()
            if (!busy) setPage('clients')
          }}
          aria-label="SysOS — ir para clientes"
        >
          <span className="brand-mark">
            <Zap size={24} fill="currentColor" />
          </span>
          <span>
            sys<span className="brand-os">OS</span>
            <span className="brand-dot">.</span>
          </span>
        </a>

        <div className="workspace-label">
          <span className="workspace-icon">
            <Monitor size={17} />
          </span>
          <div>
            <strong>Assistência técnica</strong>
            <span>Espaço de trabalho</span>
          </div>
        </div>

        <div className="nav-label">ESPAÇO DE TRABALHO</div>

        <nav aria-label="Navegação principal">
          <button
            className={`nav-item ${isClients ? 'active' : ''}`}
            disabled={busy || !session}
            onClick={() => setPage('clients')}
            aria-current={isClients ? 'page' : undefined}
          >
            <UsersRound size={19} />
            <span>Clientes</span>
          </button>

          <button
            className={`nav-item ${page === 'equipment' ? 'active' : ''}`}
            disabled={busy || !session}
            onClick={() => setPage('equipment')}
            aria-current={page === 'equipment' ? 'page' : undefined}
          >
            <Monitor size={19} />
            <span>Equipamentos</span>
          </button>

          <button
            className={`nav-item ${page === 'orders' ? 'active' : ''}`}
            disabled={busy || !session}
            onClick={() => setPage('orders')}
            aria-current={page === 'orders' ? 'page' : undefined}
          >
            <ClipboardList size={19} />
            <span>Ordens de serviço</span>
          </button>
          <button className={`nav-item ${page === 'users' ? 'active' : ''}`} disabled={busy || !session} onClick={() => setPage('users')} aria-current={page === 'users' ? 'page' : undefined}>
            <UserRound size={19} /><span>Usuários</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-version">
            <span className="version-dot" />
            SysOS <span>v0.2</span>
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Espaço de trabalho
            <ChevronRight size={14} />
            <strong>Cadastros</strong>
          </div>

          <div className="topbar-right">
            <span className="profile-avatar">
              <UserRound size={18} />
            </span>

            <span className="session-label">
              {session
                ? `${session.user.name} · ${
                    profile === 'TECNICO' ? 'Técnico' : 'Atendente'
                  }`
                : 'Acesso não informado'}
            </span>

            {session && (
              <button
                className="text-button"
                disabled={busy}
                onClick={disconnect}
              >
                Sair
              </button>
            )}
          </div>
        </header>

        <main>
          {!session ? (
            <section className="registry-panel">
              <div className="empty-state">
                <UserRound size={32} />

                <h2>Entrar no SysOS</h2>

                <p>
                  Informe seu e-mail e sua senha de funcionário para acessar
                  o sistema.
                </p>

                <form
                  onSubmit={handleLogin}
                  className="login-form"
                  aria-busy={loginBusy}
                >
                  <fieldset className="form-fields" disabled={loginBusy}>
                    <div className="form-body">
                      <label className="field" htmlFor="login-email">
                        <span>E-mail <span className="required">*</span></span>
                        <input
                          id="login-email"
                          type="email"
                          autoComplete="username"
                          autoFocus
                          required
                          value={email}
                          onChange={event => {
                            setEmail(event.target.value)
                            setLoginError('')
                          }}
                        />
                      </label>

                      <label className="field" htmlFor="login-password">
                        <span>Senha <span className="required">*</span></span>
                        <input
                          id="login-password"
                          type="password"
                          autoComplete="current-password"
                          required
                          maxLength={1024}
                          value={password}
                          onChange={event => {
                            setPassword(event.target.value)
                            setLoginError('')
                          }}
                        />
                      </label>

                      {loginError && (
                        <div className="error-notice" role="alert">
                          {loginError}
                        </div>
                      )}

                      {sessionError && (
                        <div className="error-notice" role="alert">
                          {sessionError}
                        </div>
                      )}
                    </div>

                    <div className="modal-footer">
                      <button
                        type="submit"
                        className="button primary"
                        disabled={loginBusy}
                      >
                        {loginBusy ? 'Entrando...' : 'Entrar'}
                      </button>
                    </div>
                  </fieldset>
                </form>
              </div>
            </section>
          ) : (
            <>
              <div className="page-heading">
                <h1>
                  {isClients
                    ? 'Clientes'
                    : page === 'orders'
                      ? 'Ordens de serviço'
                      : page === 'users' ? 'Usuários' : 'Equipamentos'}
                  <span className="heading-dot">.</span>
                </h1>

                {canCreate && page !== 'orders' && page !== 'users' && (
                  <button
                    className="button primary"
                    disabled={!isClients && !selectedClient}
                    onClick={() =>
                      setDialog(
                        isClients
                          ? { kind: 'client' }
                          : { kind: 'equipment', client: selectedClient! },
                      )
                    }
                  >
                    <Plus size={18} />
                    {isClients ? 'Novo cliente' : 'Novo equipamento'}
                  </button>
                )}
              </div>

              {sessionError && (
                <div className="error-notice" role="alert">
                  {sessionError}
                </div>
              )}

              <div key={sessionVersion}>
                {page === 'users' ? (
                  <UsersPage api={api} canManage={canCreate} onBusyChange={setBusy} onNotice={setNotice} />
                ) : page === 'orders' ? (
                  <OrdersPage
                    api={api}
                    canCreate={canCreate}
                    onBusyChange={setBusy}
                    onNotice={setNotice}
                  />
                ) : isClients || !selectedClient ? (
                  <ClientSearch
                    key={page}
                    revision={clientRevision}
                    api={api}
                    selecting={!isClients}
                    canCreate={canCreate}
                    onSelect={selectClient}
                    onDetails={client =>
                      setDialog({ kind: 'client-detail', client })
                    }
                    onNewClient={() => setDialog({ kind: 'client' })}
                  />
                ) : (
                  <EquipmentPanel
                    key={`${selectedClient.id}:${revision}`}
                    api={api}
                    client={selectedClient}
                    canCreate={canCreate}
                    revision={revision}
                    onNew={() =>
                      setDialog({
                        kind: 'equipment',
                        client: selectedClient,
                      })
                    }
                    onDetails={item =>
                      setDialog({
                        kind: 'equipment-detail',
                        client: selectedClient,
                        code: item.code,
                      })
                    }
                    onChangeClient={() => setSelectedClient(null)}
                  />
                )}
              </div>
            </>
          )}
        </main>
      </div>

      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {notice && (
          <div className="toast">
            <span className="toast-check">
              <Check size={17} />
            </span>
            <span>{notice}</span>
            <button
              className="icon-button"
              aria-label="Dispensar confirmação"
              onClick={() => setNotice('')}
            >
              <X size={17} />
            </button>
          </div>
        )}
      </div>

      {dialog?.kind === 'client' && (
        <Modal title="Novo cliente" busy={busy} onClose={closeDialog}>
          <ClientForm
            onSave={api.createClient}
            onCreated={clientCreated}
            onCancel={closeDialog}
            onBusyChange={setBusy}
          />
        </Modal>
      )}

      {dialog?.kind === 'equipment' && (
        <Modal title="Novo equipamento" busy={busy} onClose={closeDialog}>
          <EquipmentForm
            client={dialog.client}
            onSave={api.createEquipment}
            onCreated={equipmentCreated}
            onCancel={closeDialog}
            onBusyChange={setBusy}
          />
        </Modal>
      )}

      {dialog?.kind === 'client-edit' && (
        <Modal
          title="Editar cliente"
          subtitle={`Identificador ${dialog.client.code}`}
          busy={busy}
          onClose={closeDialog}
        >
          <ClientForm
            key={dialog.client.id}
            initialClient={dialog.client}
            onSave={(input, confirm) =>
              api.updateClient(dialog.client.id, input, confirm)
            }
            onCreated={clientUpdated}
            onCancel={closeDialog}
            onBusyChange={setBusy}
          />
        </Modal>
      )}

      {dialog?.kind === 'equipment-edit' && (
        <Modal
          title="Editar equipamento"
          subtitle={`${dialog.client.name} · código #${dialog.item.code}`}
          busy={busy}
          onClose={closeDialog}
        >
          <EquipmentForm
            key={dialog.item.id}
            client={dialog.client}
            initialEquipment={dialog.item}
            onSave={input =>
              api.updateEquipment(
                dialog.client.id,
                dialog.item.code,
                input,
              )
            }
            onCreated={equipmentUpdated}
            onCancel={closeDialog}
            onBusyChange={setBusy}
          />
        </Modal>
      )}

      {dialog?.kind === 'client-delete' && (
        <Modal title="Excluir cliente" busy={busy} onClose={closeDialog}>
          <DeleteConfirmation
            resource="cliente"
            description={`${dialog.client.name} (${dialog.client.code})`}
            onDelete={() => api.deleteClient(dialog.client.id)}
            onDeleted={() => clientDeleted(dialog.client)}
            onCancel={closeDialog}
            onBusyChange={setBusy}
          />
        </Modal>
      )}

      {dialog?.kind === 'equipment-delete' && (
        <Modal title="Excluir equipamento" busy={busy} onClose={closeDialog}>
          <DeleteConfirmation
            resource="equipamento"
            description={`#${dialog.item.code} · ${dialog.item.type} · cliente ${dialog.client.name} (${dialog.client.code})`}
            onDelete={() =>
              api.deleteEquipment(dialog.client.id, dialog.item.code)
            }
            onDeleted={() => equipmentDeleted(dialog.item)}
            onCancel={closeDialog}
            onBusyChange={setBusy}
          />
        </Modal>
      )}

      {dialog?.kind === 'client-detail' && (
        <Modal
          title={dialog.client.name}
          subtitle={`Cliente ${dialog.client.code}`}
          onClose={closeDialog}
        >
          <ClientDetails
            key={dialog.client.id}
            api={api}
            client={dialog.client}
            onEquipment={selectClient}
            canManage={canCreate}
            onEdit={client =>
              setDialog({ kind: 'client-edit', client })
            }
            onDelete={client =>
              setDialog({ kind: 'client-delete', client })
            }
          />
        </Modal>
      )}

      {dialog?.kind === 'equipment-detail' && (
        <Modal
          title={`Equipamento #${dialog.code}`}
          subtitle={`${dialog.client.name} · cliente ${dialog.client.code}`}
          onClose={closeDialog}
        >
          <EquipmentDetails
            key={`${dialog.client.id}:${dialog.code}`}
            api={api}
            client={dialog.client}
            code={dialog.code}
            canManage={canCreate}
            onEdit={item =>
              setDialog({
                kind: 'equipment-edit',
                client: dialog.client,
                item,
              })
            }
            onDelete={item =>
              setDialog({
                kind: 'equipment-delete',
                client: dialog.client,
                item,
              })
            }
          />
        </Modal>
      )}
    </div>
  )
}
