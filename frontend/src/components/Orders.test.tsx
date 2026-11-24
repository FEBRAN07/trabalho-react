import { expect, jest, test } from '@jest/globals'
import { renderToStaticMarkup } from 'react-dom/server'
import { OrdersPage, OrderRecord, OrderTable } from './Orders'
import { OrderEntry, OrderForm } from './OrderForm'
import { createApi } from '../lib/api'
import type { ServiceOrder } from '../lib/orders'

const api = createApi('http://localhost:3000/api', 'jwt')
const order: ServiceOrder = { number: '32', status: 'Aguardando Diagnóstico', problem: 'Não liga\nTela apagada', createdAt: '2026-11-24T12:00:00Z', createdBy: '7', client: { id: '3', name: 'Ana', phone: '(42) 99922-2222', email: '' }, equipment: { code: '1', type: 'Notebook', brand: 'Dell', model: '', serial: '' } }

test('tela permite filtros e consulta por número; abertura só para atendente', () => {
  const props = { api, onBusyChange: jest.fn(), onNotice: jest.fn() }
  expect(renderToStaticMarkup(<OrdersPage {...props} canCreate />)).toContain('Nova OS')
  const html = renderToStaticMarkup(<OrdersPage {...props} canCreate={false} />)
  expect(html).not.toContain('Nova OS')
  expect(html).toContain('Buscar por número')
  expect(html).toContain('Selecionar cliente')
  expect(html).toContain('Status')
  expect(html).toContain('Consultando ordens de serviço...')
})

test('formulário começa pela busca explícita do cliente', () => {
  const html = renderToStaticMarkup(<OrderForm api={api} onCreated={jest.fn()} onCancel={jest.fn()} onBusyChange={jest.fn()} />)
  expect(html).toContain('Selecione o cliente')
  expect(html).not.toContain('order-equipment')
})

test('formulário fixa cliente, aguarda seus equipamentos e limita problema a mil caracteres', () => {
  const html = renderToStaticMarkup(<OrderEntry api={api} client={{ id: '3', code: '#3', name: 'Ana', phone: '', email: 'ana@example.com' }} onCreated={jest.fn()} onCancel={jest.fn()} onBusyChange={jest.fn()} onChangeClient={jest.fn()} onNewEquipment={jest.fn()} />)
  expect(html).toContain('Cliente #3')
  expect(html).toContain('Trocar cliente')
  expect(html).toContain('Consultando equipamentos deste cliente...')
  expect(html).toContain('maxLength="1000"')
  expect(html).toContain('Cadastrar equipamento deste cliente')
  expect(html).not.toContain('order-status-filter')
})

test('detalhes exibem dados do servidor e apenas consulta', () => {
  const html = renderToStaticMarkup(<OrderRecord order={order} />)
  expect(html).toContain('Aguardando Diagnóstico')
  expect(html).toContain('Não liga\nTela apagada')
  expect(html).toContain('código #1 do cliente #3')
  expect(html).toContain('Funcionário #7')
  expect(html).not.toContain('Excluir')
  expect(html).not.toContain('Editar')
})

test('tabela diferencia equipamentos de mesmo código pelos clientes', () => {
  const html = renderToStaticMarkup(<OrderTable orders={[order, { ...order, number: '33', client: { ...order.client, id: '4', name: 'João' } }]} onDetails={jest.fn()} />)
  expect(html).toContain('Código #1 · cliente #3')
  expect(html).toContain('Código #1 · cliente #4')
})
