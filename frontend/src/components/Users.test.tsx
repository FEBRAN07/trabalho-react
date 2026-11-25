import { expect, jest, test } from '@jest/globals'
import { renderToStaticMarkup } from 'react-dom/server'
import { UserForm, UserTable, UsersPage } from './Users'
import { DeleteConfirmation } from './DeleteConfirmation'
import { createApi } from '../lib/api'
import type { User } from '../lib/users'

const user: User = { id: '3', name: 'Ana', email: 'ana@example.com', profile: 'TECNICO', active: false, createdAt: '2026-10-29T12:00:00Z' }
const api = createApi('http://localhost:3000/api', 'jwt')
const callbacks = { onSave: jest.fn<Parameters<typeof UserForm>[0]['onSave']>(), onSaved: jest.fn(), onCancel: jest.fn(), onBusyChange: jest.fn() }

test('edição preenche dados e situação, mantendo senha vazia e id fora dos campos editáveis', () => {
  const html = renderToStaticMarkup(<UserForm initialUser={user} {...callbacks} />)
  expect(html).toContain('value="Ana"')
  expect(html).toContain('value="ana@example.com"')
  expect(html).toContain('value="TECNICO" selected=""')
  expect(html).toContain('value="inactive" selected=""')
  expect(html).toContain('type="password"')
  expect(html).toContain('Deixe em branco para manter a senha atual.')
  expect(html).not.toContain('user-id')
  expect(callbacks.onSave).not.toHaveBeenCalled()
})

test('cadastro exige senha e oferece apenas os perfis suportados', () => {
  const html = renderToStaticMarkup(<UserForm {...callbacks} />)
  expect(html).toContain('Cadastrar usuário')
  expect(html).toContain('Atendente')
  expect(html).toContain('Técnico')
  expect(html).not.toContain('Nova senha')
  expect(html).not.toContain('user-status')
})

test('tabela diferencia perfil e situação sem mostrar credenciais', () => {
  const html = renderToStaticMarkup(<UserTable users={[user]} onDetails={jest.fn()} />)
  expect(html).toContain('Técnico')
  expect(html).toContain('Inativo')
  expect(html).toContain('Ver detalhes')
  expect(html).not.toContain('Senha')
})

test('novo usuário só aparece para atendentes e tela identifica carregamento', () => {
  const props = { api, onBusyChange: jest.fn(), onNotice: jest.fn() }
  expect(renderToStaticMarkup(<UsersPage {...props} canManage />)).toContain('Novo usuário')
  const html = renderToStaticMarkup(<UsersPage {...props} canManage={false} />)
  expect(html).not.toContain('Novo usuário')
  expect(html).toContain('Consultando usuários...')
  expect(html).toContain('Filtrar usuários')
})

test('excluir exige confirmação explícita do usuário correto', () => {
  const onDelete = jest.fn<() => Promise<unknown>>()
  const html = renderToStaticMarkup(<DeleteConfirmation resource="usuário" description="Ana (#3)" onDelete={onDelete} onDeleted={jest.fn()} onCancel={jest.fn()} />)
  expect(html).toContain('Ana (#3)')
  expect(html).toContain('Usuários com vínculos')
  expect(html).toContain('Confirmar exclusão')
  expect(onDelete).not.toHaveBeenCalled()
})
