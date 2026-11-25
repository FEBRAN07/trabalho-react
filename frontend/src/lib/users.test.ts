import { beforeEach, expect, jest, test } from '@jest/globals'
import { createApi } from './api'
import { validateUser } from './users'

const dto = { id: 3, nome: 'Ana', email: 'ana@example.com', perfil: 'ATENDENTE', ativo: true, criadoEm: '2026-10-29T12:00:00Z', senha: 'não-expor' }
const input = { name: ' Ana ', email: ' ana@example.com ', profile: 'ATENDENTE' as const, active: true, password: ' senha com espaços ' }
const base = 'http://localhost:3000/api'
let fetchMock: jest.SpiedFunction<typeof fetch>
beforeEach(() => { fetchMock = jest.spyOn(globalThis, 'fetch') })
function reply(body: unknown, status = 200) { fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status })) }

test('lista usuários como array e descarta senha na conversão das respostas', async () => {
  reply([dto])
  const users = await createApi(base, 'jwt').listUsers()
  expect(users).toEqual([{ id: '3', name: 'Ana', email: dto.email, profile: 'ATENDENTE', active: true, createdAt: dto.criadoEm }])
  expect(fetchMock.mock.calls[0]).toEqual([`${base}/usuarios`, expect.objectContaining({ headers: { Accept: 'application/json', Authorization: 'Bearer jwt' }, cache: 'no-store', credentials: 'omit' })])
})

test('GET individual usa id e encaminha AbortSignal', async () => {
  reply(dto)
  const controller = new AbortController()
  await createApi(base, 'jwt').getUser('3', controller.signal)
  expect(fetchMock.mock.calls[0]).toEqual([`${base}/usuarios/3`, expect.objectContaining({ signal: controller.signal })])
})

test('POST envia apenas os campos de cadastro, preservando os espaços da senha', async () => {
  reply(dto, 201)
  const user = await createApi(base, 'jwt').createUser(input)
  const [url, options] = fetchMock.mock.calls[0]
  expect(url).toBe(`${base}/usuarios`)
  expect(options?.method).toBe('POST')
  expect(JSON.parse(options!.body as string)).toEqual({ nome: 'Ana', email: dto.email, perfil: 'ATENDENTE', senha: input.password })
  expect(user).not.toHaveProperty('password')
})

test('PUT permite mudar perfil e inativar sem reenviar senha', async () => {
  reply({ ...dto, perfil: 'TECNICO', ativo: false })
  const result = await createApi(base, 'jwt').updateUser('3', { ...input, password: '', profile: 'TECNICO', active: false })
  const [url, options] = fetchMock.mock.calls[0]
  expect(url).toBe(`${base}/usuarios/3`)
  expect(options?.method).toBe('PUT')
  expect(JSON.parse(options!.body as string)).toEqual({ nome: 'Ana', email: dto.email, perfil: 'TECNICO', ativo: false })
  expect(result).toMatchObject({ profile: 'TECNICO', active: false })
})

test('PUT envia nova senha somente quando preenchida', async () => {
  reply(dto)
  await createApi(base, 'jwt').updateUser('3', input)
  expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string).senha).toBe(input.password)
})

test('DELETE lê mensagem de sucesso, sem tentar converter em cadastro excluído', async () => {
  reply({ mensagem: 'Usuário excluído com sucesso.' })
  await expect(createApi(base, 'jwt').deleteUser('3')).resolves.toBeUndefined()
  expect(fetchMock.mock.calls[0]).toEqual([`${base}/usuarios/3`, expect.objectContaining({ method: 'DELETE' })])
  expect(fetchMock.mock.calls[0][1]?.body).toBeUndefined()
})

test.each(['getUser', 'updateUser', 'deleteUser'] as const)('%s rejeita id inválido sem chamar a API', async method => {
  const api = createApi(base, 'jwt')
  await expect(method === 'updateUser' ? api[method]('../3', input) : api[method]('../3')).rejects.toMatchObject({ status: 400 })
  expect(fetchMock).not.toHaveBeenCalled()
})

test.each([400, 403, 404, 409, 500])('preserva erro textual de usuários (%s)', async status => {
  reply({ erro: 'Mensagem retornada pela API.' }, status)
  await expect(createApi(base, 'jwt').updateUser('3', input)).rejects.toMatchObject({ status, message: 'Mensagem retornada pela API.' })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('conflito de exclusão não tenta forçar nem remover vínculos', async () => {
  reply({ erro: 'Usuário possui vínculos.' }, 409)
  await expect(createApi(base, 'jwt').deleteUser('3')).rejects.toMatchObject({ status: 409, message: 'Usuário possui vínculos.' })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('401 em usuários invalida a sessão', async () => {
  reply({ erro: { mensagem: 'Token expirado.' } }, 401)
  const unauthorized = jest.fn()
  await expect(createApi(base, 'jwt', unauthorized).listUsers()).rejects.toMatchObject({ status: 401 })
  expect(unauthorized).toHaveBeenCalledTimes(1)
})

test('exige nome, email e senha no cadastro e permite senha vazia na edição', () => {
  expect(validateUser({ ...input, name: ' ', email: 'inválido', password: '' })).toEqual({ name: expect.any(String), email: expect.any(String), password: expect.any(String) })
  expect(validateUser({ ...input, password: '' }, true)).toEqual({})
  expect(validateUser(input)).toEqual({})
})
