import { beforeEach, expect, jest, test } from '@jest/globals'
import { createApi, orderFromApi, type OrderDto } from './api'
import { validateOrder } from './orders'

const base = 'http://localhost:3000/api'
const dto: OrderDto = { numero: 32, status: 'Aguardando Diagnóstico', problemaRelatado: 'Não liga', criadoEm: '2026-11-24T12:00:00Z', criadoPorId: 7, cliente: { id: 3, nome: 'Ana', telefone: '42999222222', email: null }, equipamento: { codigoInterno: 1, tipo: 'Notebook', marca: 'Dell', modelo: null, numeroSerie: null } }
const input = { clientId: '3', equipmentCode: '1', problem: ' Não liga ' }
let fetchMock: jest.SpiedFunction<typeof fetch>
beforeEach(() => { fetchMock = jest.spyOn(globalThis, 'fetch') })
function reply(body: unknown, status = 200) { fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status })) }

test('adapta dados da OS e mantém o par cliente/código do equipamento', () => {
  expect(orderFromApi(dto)).toEqual({ number: '32', status: dto.status, problem: 'Não liga', createdAt: dto.criadoEm, createdBy: '7', client: { id: '3', name: 'Ana', phone: '(42) 99922-2222', email: '' }, equipment: { code: '1', type: 'Notebook', brand: 'Dell', model: '', serial: '' } })
})

test('abertura envia apenas cliente, código e problema; número, status e autor vêm do backend', async () => {
  reply(dto, 201)
  const order = await createApi(base, 'jwt').createOrder(input)
  const [url, options] = fetchMock.mock.calls[0]
  expect(url).toBe(`${base}/ordens-servico`)
  expect(options).toMatchObject({ method: 'POST', headers: { Authorization: 'Bearer jwt', 'Content-Type': 'application/json' }, credentials: 'omit', cache: 'no-store' })
  expect(JSON.parse(options!.body as string)).toEqual({ clienteId: 3, equipamentoCodigoInterno: 1, problemaRelatado: 'Não liga' })
  expect(order.number).toBe('32')
})

test('409 mostra OS existentes e só confirma nova abertura quando solicitado', async () => {
  reply({ erro: { codigo: 'EQUIPAMENTO_COM_OS_EM_ABERTO', mensagem: 'Confira as ordens.', detalhes: { ordensEmAberto: [{ numero: 31, status: dto.status, problemaRelatado: 'Tela apagada', criadoEm: dto.criadoEm }] } } }, 409)
  const api = createApi(base, 'jwt')
  await expect(api.createOrder(input)).rejects.toMatchObject({ code: 'EQUIPAMENTO_COM_OS_EM_ABERTO', openOrders: [{ number: '31', status: dto.status, problem: 'Tela apagada', createdAt: dto.criadoEm }] })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  reply(dto, 201)
  await api.createOrder(input, true)
  expect(JSON.parse(fetchMock.mock.calls[1][1]!.body as string).confirmarOsEmAberto).toBe(true)
})

test('lista recente e filtros opcionais usam a mesma rota e status codificado', async () => {
  const api = createApi(base, 'jwt')
  reply({ total: 1, ordens: [dto] }); reply({ total: 1, ordens: [dto] })
  expect((await api.listOrders()).orders[0].number).toBe('32')
  await api.listOrders({ clientId: '3', status: ' Aguardando Diagnóstico ' })
  expect(fetchMock.mock.calls[0][0]).toBe(`${base}/ordens-servico`)
  const url = new URL(fetchMock.mock.calls[1][0] as string)
  expect(url.searchParams.get('clienteId')).toBe('3')
  expect(url.searchParams.get('status')).toBe(dto.status)
})

test('consulta por número encaminha cancelamento e não faz escrita', async () => {
  reply(dto)
  const controller = new AbortController()
  await createApi(base, 'jwt').getOrder('32', controller.signal)
  expect(fetchMock.mock.calls[0]).toEqual([`${base}/ordens-servico/32`, expect.objectContaining({ signal: controller.signal })])
  expect(fetchMock.mock.calls[0][1]?.method).toBeUndefined()
})

test('erros do backend são associados aos campos da OS', async () => {
  reply({ erro: { codigo: 'DADOS_INVALIDOS', mensagem: 'Revise os campos.', detalhes: [{ campo: 'clienteId', mensagem: 'Cliente inválido.' }, { campo: 'equipamentoCodigoInterno', mensagem: 'Equipamento inválido.' }, { campo: 'problemaRelatado', mensagem: 'Problema obrigatório.' }] } }, 400)
  await expect(createApi(base, 'jwt').createOrder(input)).rejects.toMatchObject({ fields: { clientId: 'Cliente inválido.', equipmentCode: 'Equipamento inválido.', problem: 'Problema obrigatório.' } })
})

test.each([401, 403, 404, 500])('abertura que falha (%s) não informa sucesso nem repete a chamada', async status => {
  reply({ erro: { codigo: 'ERRO', mensagem: 'Operação recusada.' } }, status)
  const unauthorized = jest.fn()
  await expect(createApi(base, 'jwt', unauthorized).createOrder(input)).rejects.toMatchObject({ status, message: 'Operação recusada.' })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(unauthorized).toHaveBeenCalledTimes(status === 401 ? 1 : 0)
})

test('validação recusa identidade inválida, problema vazio ou acima do limite', async () => {
  expect(validateOrder({ clientId: '', equipmentCode: '', problem: ' ' })).toEqual({ clientId: expect.any(String), equipmentCode: expect.any(String), problem: expect.any(String) })
  expect(validateOrder({ ...input, problem: 'x'.repeat(1000) })).toEqual({})
  await expect(createApi(base, 'jwt').createOrder({ ...input, problem: 'x'.repeat(1001) })).rejects.toMatchObject({ status: 400 })
  await expect(createApi(base, 'jwt').getOrder('../32')).rejects.toMatchObject({ status: 400 })
  await expect(createApi(base, 'jwt').listOrders({ clientId: '-1' })).rejects.toMatchObject({ status: 400 })
  await expect(createApi(base, 'jwt').listOrders({ status: 'x'.repeat(41) })).rejects.toMatchObject({ status: 400 })
  expect(fetchMock).not.toHaveBeenCalled()
})

test('não busca nem abre OS sem sessão', async () => {
  const api = createApi(base, '')
  await expect(api.listOrders()).rejects.toMatchObject({ status: 401 })
  await expect(api.createOrder(input)).rejects.toMatchObject({ status: 401 })
  expect(fetchMock).not.toHaveBeenCalled()
})
