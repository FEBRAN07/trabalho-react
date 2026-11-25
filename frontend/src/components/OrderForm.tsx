import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError, errorMessage, type Api } from '../lib/api'
import { displayDate, type Client, type Equipment } from '../lib/registry'
import { validateOrder, type OpenOrder, type OrderErrors, type ServiceOrder } from '../lib/orders'
import { ClientSearch } from './SearchPanels'
import { ClientForm, EquipmentForm, FieldError } from './Forms'

export function OrderForm({ api, onCreated, onCancel, onBusyChange }: {
  api: Api; onCreated: (order: ServiceOrder) => void; onCancel: () => void; onBusyChange: (busy: boolean) => void
}) {
  const [client, setClient] = useState<Client | null>(null)
  const [step, setStep] = useState<'select' | 'client' | 'equipment' | 'order'>('select')
  const [newEquipment, setNewEquipment] = useState<Equipment | undefined>()
  function selectClient(value: Client) { setClient(value); setNewEquipment(undefined); setStep('order') }
  if (step === 'client') return <ClientForm onSave={api.createClient} onCreated={selectClient} onCancel={() => setStep('select')} onBusyChange={onBusyChange} />
  if (!client || step === 'select') return <div className="order-client-picker"><ClientSearch api={api} selecting canCreate onSelect={selectClient} onDetails={selectClient} onNewClient={() => setStep('client')} /><div className="modal-footer"><button className="button secondary" onClick={onCancel}>Cancelar</button></div></div>
  if (step === 'equipment') return <EquipmentForm client={client} onSave={api.createEquipment} onCreated={item => { setNewEquipment(item); setStep('order') }} onCancel={() => setStep('order')} onBusyChange={onBusyChange} />
  return <OrderEntry key={`${client.id}:${newEquipment?.code ?? ''}`} api={api} client={client} initialEquipment={newEquipment} onCreated={onCreated} onCancel={onCancel} onBusyChange={onBusyChange} onChangeClient={() => setStep('select')} onNewEquipment={() => setStep('equipment')} />
}

export function OrderEntry({ api, client, initialEquipment, onCreated, onCancel, onBusyChange, onChangeClient, onNewEquipment }: {
  api: Api; client: Client; initialEquipment?: Equipment; onCreated: (order: ServiceOrder) => void
  onCancel: () => void; onBusyChange: (busy: boolean) => void; onChangeClient: () => void; onNewEquipment: () => void
}) {
  const [equipment, setEquipment] = useState<{ items: Equipment[]; loading: boolean; error: string }>({ items: [], loading: true, error: '' })
  const [retry, setRetry] = useState(0)
  const [code, setCode] = useState(initialEquipment?.code ?? '')
  const [problem, setProblem] = useState('')
  const [errors, setErrors] = useState<OrderErrors>({})
  const [error, setError] = useState('')
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([])
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const pending = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    void api.listEquipment(client.id, controller.signal).then(items => {
      if (!controller.signal.aborted) setEquipment({ items, loading: false, error: '' })
    }).catch(cause => { if (!controller.signal.aborted) setEquipment({ items: [], loading: false, error: errorMessage(cause) }) })
    return () => controller.abort()
  }, [api, client.id, retry])
  function changed() { setErrors({}); setError(''); setOpenOrders([]); setConfirmed(false) }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending.current || equipment.loading || equipment.error) return
    const input = { clientId: client.id, equipmentCode: code, problem }
    const validation = validateOrder(input)
    if (!equipment.items.some(item => item.code === code && item.clientId === client.id)) validation.equipmentCode = 'Selecione um equipamento deste cliente.'
    setErrors(validation)
    if (Object.keys(validation).length || (openOrders.length > 0 && !confirmed)) return
    pending.current = true; setSaving(true); setError(''); onBusyChange(true)
    try { onCreated(await api.createOrder(input, confirmed)) }
    catch (cause) {
      if (cause instanceof ApiError) {
        setErrors(cause.fields)
        if (cause.code === 'EQUIPAMENTO_COM_OS_EM_ABERTO' && cause.openOrders.length) {
          setOpenOrders(cause.openOrders); setConfirmed(false)
        } else setError(cause.message)
      } else setError(errorMessage(cause))
    } finally { pending.current = false; setSaving(false); onBusyChange(false) }
  }
  return <form onSubmit={submit} noValidate aria-busy={saving}><fieldset className="form-fields" disabled={saving}>
    <div className="form-body">
      <div className="order-client-summary"><div><h3>{client.name}</h3><p>Cliente {client.code} · {client.phone || client.email}</p></div><button className="button secondary" type="button" onClick={onChangeClient}>Trocar cliente</button></div>
      <label className="field" htmlFor="order-equipment"><span>Equipamento <span className="required">*</span></span>
        <select autoFocus id="order-equipment" value={code} disabled={equipment.loading || !!equipment.error} onChange={event => { setCode(event.target.value); changed() }} aria-required="true" aria-invalid={!!errors.equipmentCode} aria-describedby="order-equipment-error"><option value="">{equipment.loading ? 'Carregando equipamentos...' : 'Selecione o equipamento'}</option>{equipment.items.map(item => <option key={item.id} value={item.code}>#{item.code} · {[item.type, item.brand, item.model].filter(Boolean).join(' · ')}{item.serial ? ` · série ${item.serial}` : ''}</option>)}</select>
        <FieldError id="order-equipment-error" error={errors.equipmentCode} />
      </label>
      {equipment.loading && <p role="status">Consultando equipamentos deste cliente...</p>}
      {equipment.error && <div className="error-notice" role="alert">{equipment.error}<button className="text-button" type="button" onClick={() => { setEquipment({ items: [], loading: true, error: '' }); setRetry(value => value + 1) }}>Tentar novamente</button></div>}
      {!equipment.loading && !equipment.error && equipment.items.length === 0 && <p>Nenhum equipamento cadastrado para este cliente.</p>}
      <button className="text-button" type="button" onClick={onNewEquipment}>Cadastrar equipamento deste cliente</button>
      <label className="field order-problem-field" htmlFor="order-problem"><span>Problema relatado <span className="required">*</span></span>
        <textarea id="order-problem" rows={5} maxLength={1000} value={problem} onChange={event => { setProblem(event.target.value); changed() }} aria-required="true" aria-invalid={!!errors.problem} aria-describedby="order-problem-error" />
        <FieldError id="order-problem-error" error={errors.problem} />
      </label>
      {openOrders.length > 0 && <div className="duplicate-notice" role="alert"><strong>Este equipamento já possui OS em aberto</strong><ul>{openOrders.map(order => <li key={order.number}><strong>OS #{order.number} · {order.status}</strong><span>{displayDate(order.createdAt)} · {order.problem}</span></li>)}</ul><label className="checkbox"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Conferi as ordens existentes e confirmo a abertura de uma nova OS.</label></div>}
      {error && <div className="error-notice" role="alert">{error}</div>}
    </div>
    <div className="modal-footer"><span><span className="required">*</span> Campo obrigatório</span><div><button className="button secondary" type="button" onClick={onCancel}>Cancelar</button><button className="button primary" type="submit" disabled={equipment.loading || !!equipment.error || equipment.items.length === 0 || (openOrders.length > 0 && !confirmed)}>{saving ? 'Abrindo OS...' : 'Abrir ordem de serviço'}</button></div></div>
  </fieldset></form>
}
