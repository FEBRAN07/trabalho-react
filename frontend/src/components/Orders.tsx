import { useEffect, useState, type FormEvent } from 'react'
import { errorMessage, type Api } from '../lib/api'
import { displayDate, validateId, type Client } from '../lib/registry'
import type { OrderFilters, ServiceOrder } from '../lib/orders'
import { Modal } from './Modal'
import { ClientSearch } from './SearchPanels'
import { OrderForm } from './OrderForm'
import { ChevronLeft, ChevronRight, Plus } from './Icons'

export function OrderRecord({ order }: { order: ServiceOrder }) {
  return <div className="detail-body"><dl className="detail-grid">
    <div><dt>Número</dt><dd>#{order.number}</dd></div><div><dt>Status</dt><dd>{order.status}</dd></div>
    <div><dt>Cadastrada em</dt><dd>{displayDate(order.createdAt)}</dd></div><div><dt>Cadastrada por</dt><dd>Funcionário #{order.createdBy}</dd></div>
    <div><dt>Cliente</dt><dd>{order.client.name} · #{order.client.id}</dd></div><div><dt>Contato</dt><dd>{[order.client.phone, order.client.email].filter(Boolean).join(' · ') || 'Não informado'}</dd></div>
    <div><dt>Equipamento</dt><dd>{[order.equipment.type, order.equipment.brand, order.equipment.model].filter(Boolean).join(' · ')} · código #{order.equipment.code} do cliente #{order.client.id}</dd></div><div><dt>Número de série</dt><dd>{order.equipment.serial || 'Não informado'}</dd></div>
  </dl><div className="order-problem"><h3>Problema relatado</h3><p>{order.problem}</p></div></div>
}

export function OrderDetails({ api, number }: { api: Api; number: string }) {
  const [state, setState] = useState<{ order?: ServiceOrder; error?: string }>({})
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void api.getOrder(number, controller.signal).then(order => {
      if (!controller.signal.aborted) setState({ order })
    }).catch(cause => { if (!controller.signal.aborted) setState({ error: errorMessage(cause) }) })
    return () => controller.abort()
  }, [api, number, retry])
  if (state.error) return <div className="detail-body error-notice" role="alert">{state.error}<button className="text-button" onClick={() => { setState({}); setRetry(value => value + 1) }}>Tentar novamente</button></div>
  if (!state.order) return <div className="detail-body" role="status">Consultando ordem de serviço...</div>
  return <OrderRecord order={state.order} />
}

export function OrderTable({ orders, onDetails }: { orders: ServiceOrder[]; onDetails: (number: string) => void }) {
  return <div className="table-wrap"><table className="orders-table"><thead><tr><th>OS / STATUS</th><th>CLIENTE</th><th>EQUIPAMENTO</th><th>CADASTRADA EM</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{orders.map(order => <tr key={order.number}>
    <td><button className="row-name" onClick={() => onDetails(order.number)}>OS #{order.number}</button><span className="record-code order-status">{order.status}</span></td>
    <td>{order.client.name}<span className="record-code">Cliente #{order.client.id}</span></td><td>{[order.equipment.type, order.equipment.brand, order.equipment.model].filter(Boolean).join(' · ')}<span className="record-code">Código #{order.equipment.code} · cliente #{order.client.id}</span></td>
    <td>{displayDate(order.createdAt)}</td><td><button className="button secondary" onClick={() => onDetails(order.number)}>Detalhes</button></td>
  </tr>)}</tbody></table></div>
}

type Query = { number?: string; filters: OrderFilters }
export function OrdersPage({ api, canCreate, onBusyChange, onNotice }: { api: Api; canCreate: boolean; onBusyChange: (busy: boolean) => void; onNotice: (message: string) => void }) {
  const [number, setNumber] = useState('')
  const [client, setClient] = useState<Client | null>(null)
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState<Query>({ filters: {} })
  const [revision, setRevision] = useState(0)
  const [page, setPage] = useState(1)
  const [validation, setValidation] = useState('')
  const [result, setResult] = useState<{ orders: ServiceOrder[]; loading: boolean; error: string }>({ orders: [], loading: true, error: '' })
  const [dialog, setDialog] = useState<'new' | 'client' | { number: string } | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    const request = query.number ? api.getOrder(query.number, controller.signal).then(order => [order]) : api.listOrders(query.filters, controller.signal).then(data => data.orders)
    void request.then(orders => { if (!controller.signal.aborted) setResult({ orders, loading: false, error: '' }) })
      .catch(cause => { if (!controller.signal.aborted) setResult({ orders: [], loading: false, error: errorMessage(cause) }) })
    return () => controller.abort()
  }, [api, query, revision])
  function load(nextQuery: Query) { setValidation(''); setPage(1); setResult({ orders: [], loading: true, error: '' }); setQuery(nextQuery) }
  function searchNumber(event: FormEvent) {
    event.preventDefault()
    if (!validateId(number.trim())) { setValidation('Informe um número de OS válido.'); return }
    load({ number: number.trim(), filters: {} })
  }
  function filter(event: FormEvent) { event.preventDefault(); setNumber(''); load({ filters: { ...(client ? { clientId: client.id } : {}), ...(status.trim() ? { status: status.trim() } : {}) } }) }
  function busyChanged(value: boolean) { setBusy(value); onBusyChange(value) }
  function close() { if (!busy) setDialog(null) }
  const pages = Math.max(1, Math.ceil(result.orders.length / 10))
  return <>
    <section className="registry-panel" aria-labelledby="orders-title">
      <div className="panel-heading"><h2 id="orders-title">Consultar ordens de serviço</h2>{canCreate && <button className="button primary" onClick={() => setDialog('new')}><Plus size={18} />Nova OS</button>}</div>
      <form className="toolbar" onSubmit={searchNumber} role="search" aria-label="Buscar OS por número"><div className="search-field"><input aria-label="Número da OS" inputMode="numeric" placeholder="Número da ordem de serviço" value={number} onChange={event => setNumber(event.target.value)} /></div><button className="button primary" type="submit" disabled={result.loading}>Buscar por número</button></form>
      <form className="order-filters" onSubmit={filter} aria-label="Filtrar ordens de serviço">
        <div className="order-filter-client"><span>{client ? `${client.name} · ${client.code}` : 'Todos os clientes'}</span><button type="button" className="button secondary" onClick={() => setDialog('client')}>Selecionar cliente</button>{client && <button type="button" className="text-button" onClick={() => setClient(null)}>Limpar cliente</button>}</div>
        <label className="field" htmlFor="order-status-filter">Status<input id="order-status-filter" maxLength={40} placeholder="Todos os status" list="order-status-options" value={status} onChange={event => setStatus(event.target.value)} /><datalist id="order-status-options"><option value="Aguardando Diagnóstico" /><option value="Concluída" /><option value="Cancelada" /></datalist></label>
        <button className="button primary" type="submit" disabled={result.loading}>Aplicar filtros</button><button className="button secondary" type="button" disabled={result.loading} onClick={() => { setNumber(''); setClient(null); setStatus(''); load({ filters: {} }) }}>Todas as OS</button>
      </form>
      {query.number && <p className="panel-message">Consulta por número: OS #{query.number}.</p>}
      {(validation || result.error) && <div className="panel-message error-notice" role="alert">{validation || result.error}{result.error && <button className="text-button" onClick={() => { setResult({ orders: [], loading: true, error: '' }); setRevision(value => value + 1) }}>Tentar novamente</button>}</div>}
      {result.loading && <div className="empty-state" role="status">Consultando ordens de serviço...</div>}
      {!result.loading && !result.error && (result.orders.length ? <><OrderTable orders={result.orders.slice((page - 1) * 10, page * 10)} onDetails={value => setDialog({ number: value })} /><div className="table-footer"><span>{result.orders.length} resultado(s){!query.number && ' · limite de 100; refine os filtros se necessário.'}</span><div className="pagination"><button aria-label="Página anterior" disabled={page === 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={16} /></button><span>Página {page} de {pages}</span><button aria-label="Próxima página" disabled={page >= pages} onClick={() => setPage(value => value + 1)}><ChevronRight size={16} /></button></div></div></> : <div className="empty-state"><h3>Nenhuma ordem de serviço encontrada</h3></div>)}
    </section>
    {dialog === 'client' && <Modal title="Filtrar por cliente" wide onClose={close}><div className="order-client-picker"><ClientSearch api={api} selecting canCreate={false} onSelect={value => { setClient(value); setDialog(null) }} onDetails={value => { setClient(value); setDialog(null) }} onNewClient={() => {}} /></div></Modal>}
    {dialog === 'new' && canCreate && <Modal title="Nova ordem de serviço" wide busy={busy} onClose={close}><OrderForm api={api} onBusyChange={busyChanged} onCancel={close} onCreated={order => {
      onNotice(`Ordem de serviço #${order.number} aberta com sucesso.`)
      load({ filters: query.filters }); setRevision(value => value + 1); setDialog({ number: order.number })
    }} /></Modal>}
    {dialog && typeof dialog === 'object' && <Modal title={`Ordem de serviço #${dialog.number}`} wide onClose={close}><OrderDetails key={dialog.number} api={api} number={dialog.number} /></Modal>}
  </>
}
