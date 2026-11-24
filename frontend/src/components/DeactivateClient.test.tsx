import { expect, jest, test } from '@jest/globals'
import { renderToStaticMarkup } from 'react-dom/server'
import { DeactivateClient } from './DeactivateClient'
import { ClientSearch, EquipmentPanel } from './SearchPanels'
import { createApi } from '../lib/api'
const client = { id: '7', code: '#7', name: 'Ana', phone: '', email: 'ana@example.com', active: false }

test('confirmação identifica cliente e informa cascata, sem executar antes de confirmar', () => {
  const onDeactivate = jest.fn<() => Promise<typeof client>>()
  const html = renderToStaticMarkup(<DeactivateClient client={client} onDeactivate={onDeactivate} onDeactivated={jest.fn()} onCancel={jest.fn()} onBusyChange={jest.fn()} />)
  expect(html).toContain('Ana (#7)')
  expect(html).toContain('Todos os equipamentos deste cliente também serão desativados')
  expect(html).toContain('Confirmar desativação')
  expect(html).toContain('Cancelar')
  expect(onDeactivate).not.toHaveBeenCalled()
})

test('buscas oferecem inclusão de inativos e cliente inativo não recebe cadastro de equipamento', () => {
  const api = createApi('http://localhost:3000/api', 'jwt')
  const html = renderToStaticMarkup(<ClientSearch api={api} canCreate onSelect={jest.fn()} onDetails={jest.fn()} onNewClient={jest.fn()} />)
  expect(html).toContain('Incluir inativos')
  expect(html).not.toContain('checked=""')
  const equipment = renderToStaticMarkup(<EquipmentPanel api={api} client={client} canCreate revision={0} onNew={jest.fn()} onDetails={jest.fn()} onChangeClient={jest.fn()} />)
  expect(equipment).toContain('Inativo')
  expect(equipment).toContain('checked=""')
  expect(equipment).not.toContain('Cadastrar equipamento')
})

test('reabilitação pede confirmação e informa restauração dos equipamentos', () => {
  const onReactivate = jest.fn<() => Promise<typeof client>>()
  const html = renderToStaticMarkup(<DeactivateClient reactivate client={client} onDeactivate={onReactivate} onDeactivated={jest.fn()} onCancel={jest.fn()} onBusyChange={jest.fn()} />)
  expect(html).toContain('Confirmar reabilitação')
  expect(html).toContain('todos os seus equipamentos voltarão a ficar ativos')
  expect(html).toContain('Ana (#7)')
  expect(onReactivate).not.toHaveBeenCalled()
})
