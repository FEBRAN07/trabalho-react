import { beforeEach, expect, jest, test } from '@jest/globals'
import { createApi } from './api'

const base = 'http://localhost:3000/api'
const usuario = { id: 3, nome: 'Ana', email: 'ana@example.com', perfil: 'ATENDENTE', ativo: true, criadoEm: '2026-10-29', senha: 'não-expor' }
let fetchMock: jest.SpiedFunction<typeof fetch>
beforeEach(() => { fetchMock = jest.spyOn(globalThis, 'fetch') })
function reply(body: unknown, status = 200) { fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status })) }

test('login público envia email/senha sem Bearer, preservando a senha', async () => {
  reply({ token: 'novo-token', usuario })
  const session = await createApi(base, 'antigo-token').login(' ana@example.com ', ' senha ')
  const [url, options] = fetchMock.mock.calls[0]
  expect(url).toBe(`${base}/login`)
  expect(options).toMatchObject({ method: 'POST', cache: 'no-store', credentials: 'omit', headers: { Accept: 'application/json', 'Content-Type': 'application/json' } })
  expect(options?.headers).not.toHaveProperty('Authorization')
  expect(JSON.parse(options!.body as string)).toEqual({ email: usuario.email, senha: ' senha ' })
  expect(session).toMatchObject({ token: 'novo-token', user: { id: '3', name: 'Ana', profile: 'ATENDENTE' } })
  expect(session.user).not.toHaveProperty('senha')
})

test('401 no login apresenta erro sem acionar expiração da sessão', async () => {
  reply({ erro: { codigo: 'CREDENCIAIS_INVALIDAS', mensagem: 'E-mail ou senha inválidos.' } }, 401)
  const unauthorized = jest.fn()
  await expect(createApi(base, '', unauthorized).login(usuario.email, 'errada')).rejects.toMatchObject({ status: 401, message: 'E-mail ou senha inválidos.' })
  expect(unauthorized).not.toHaveBeenCalled()
})

test('token recebido autentica a próxima chamada de cadastro', async () => {
  reply({ token: 'novo-token', usuario }); reply([])
  const session = await createApi(base, '').login(usuario.email, 'senha')
  await createApi(base, session.token).listUsers()
  expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({ Authorization: 'Bearer novo-token' })
})

test.each([null, {}, { token: 123, usuario }, { token: 'jwt' }, { token: '', usuario }, { token: 'jwt', usuario: { ...usuario, perfil: 'ADMIN' } }])('rejeita login com resposta incompleta', async body => {
  reply(body)
  await expect(createApi(base, '').login(usuario.email, 'senha')).rejects.toMatchObject({ code: 'RESPOSTA_INVALIDA' })
})

test('falha de rede não produz sessão', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('network error'))
  await expect(createApi(base, '').login(usuario.email, 'senha')).rejects.toMatchObject({ code: 'FALHA_DE_CONEXAO' })
})
