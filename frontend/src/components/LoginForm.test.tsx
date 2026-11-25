import { expect, jest, test } from '@jest/globals'
import { renderToStaticMarkup } from 'react-dom/server'
import { LoginForm } from './LoginForm'

test('formulário usa email e senha, sem solicitar token nem chamar API antes do envio', () => {
  const onLogin = jest.fn<Parameters<typeof LoginForm>[0]['onLogin']>()
  const html = renderToStaticMarkup(<LoginForm onLogin={onLogin} onConnected={jest.fn()} onBusyChange={jest.fn()} />)
  expect(html).toContain('type="email"')
  expect(html).toContain('type="password"')
  expect(html).toContain('autoComplete="username"')
  expect(html).toContain('autoComplete="current-password"')
  expect(html).toContain('Entrar')
  expect(html).not.toContain('Token')
  expect(onLogin).not.toHaveBeenCalled()
})
