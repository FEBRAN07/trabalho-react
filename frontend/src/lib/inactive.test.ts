import { beforeEach, expect, jest, test } from '@jest/globals'
import { createApi } from './api'
const base = 'http://localhost:3000/api'
const client = { id: 7, nome: 'Ana', telefone: null, email: 'ana@example.com', ativo: false }
const item = { clienteId: 7, codigoInterno: 1, tipo: 'Notebook', marca: null, modelo: null, numeroSerie: null, criadoEm: '2026-10-29', ativo: false }
let fetchMock: jest.SpiedFunction<typeof fetch>
beforeEach(() => { fetchMock = jest.spyOn(globalThis, 'fetch') })
function reply(body: unknown, status = 200) { fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status })) }

test('desativa com POST autenticado, sem apagar nem enviar dados editáveis', async () => {
  reply(client)
  const result = await createApi(base, 'jwt').deactivateClient('7')
  expect(result.active).toBe(false)
  expect(fetchMock.mock.calls[0]).toEqual([`${base}/clientes/7/desativar`, expect.objectContaining({ method: 'POST', headers: { Accept: 'application/json', Authorization: 'Bearer jwt' } })])
  expect(fetchMock.mock.calls[0][1]?.body).toBeUndefined()
})

test('busca solicita inclusão de inativos explicitamente e mantém sua situação', async () => {
  reply({ clientes: [client], total: 1, ofertaCadastro: false })
  const result = await createApi(base, 'jwt').searchClients('Ana', undefined, true)
  expect(fetchMock.mock.calls[0][0]).toBe(`${base}/clientes?busca=Ana&incluirInativos=true`)
  expect(result.clients[0].active).toBe(false)
})

test('consulta individual e equipamentos preservam escopo do cliente e incluem inativos só com opt-in', async () => {
  reply(client); reply({ equipamentos: [item] }); reply(item)
  const api = createApi(base, 'jwt')
  await api.getClient('7', undefined, true)
  expect((await api.listEquipment('7', undefined, true))[0].active).toBe(false)
  expect((await api.getEquipment('7', '1', undefined, true)).active).toBe(false)
  expect(fetchMock.mock.calls.map(call => call[0])).toEqual([`${base}/clientes/7?incluirInativos=true`, `${base}/clientes/7/equipamentos?incluirInativos=true`, `${base}/clientes/7/equipamentos/1?incluirInativos=true`])
})

test.each([401, 403, 404, 500])('desativação com falha %s não devolve sucesso nem força nova tentativa', async status => {
  reply({ erro: { mensagem: 'Não foi possível desativar.' } }, status)
  await expect(createApi(base, 'jwt').deactivateClient('7')).rejects.toMatchObject({ status, message: 'Não foi possível desativar.' })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('reabilita por POST e usa a situação retornada pelo backend', async () => {
  reply({ ...client, ativo: true })
  expect((await createApi(base, 'jwt').reactivateClient('7')).active).toBe(true)
  expect(fetchMock.mock.calls[0]).toEqual([`${base}/clientes/7/reabilitar`, expect.objectContaining({ method: 'POST' })])
})
