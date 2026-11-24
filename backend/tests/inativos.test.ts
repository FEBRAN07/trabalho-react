import type { PrismaClient } from '@prisma/client';
import { montar } from './helpers/app';
import { injetar } from './helpers/injetar';
import { ClientePrismaRepositorio, EquipamentoPrismaRepositorio } from '../src/infra/prismaRepositorios';

async function preparar() {
  const ambiente = montar();
  const { banco } = ambiente;
  const a = await banco.criar({ nome: 'Cliente A', telefone: '42999990000', email: null, criadoPorId: 7 });
  const b = await banco.criar({ nome: 'Cliente B', telefone: '42988880000', email: null, criadoPorId: 7 });
  const dados = { tipo: 'Notebook', marca: null, modelo: null, numeroSerie: null, criadoPorId: 7 };
  await banco.criarParaCliente(a.id, dados); await banco.criarParaCliente(a.id, dados); await banco.criarParaCliente(b.id, dados);
  const chamar = (caminho: string, metodo = 'GET', corpo?: unknown) => injetar(ambiente.app, { caminho, metodo, corpo, cabecalhos: ambiente.atendente });
  return { ...ambiente, chamar, a, b };
}

test('cadastros começam ativos; desativação preserva registros, identidade e audita toda a cascata', async () => {
  const { banco, chamar } = await preparar();
  expect(banco.clientes.every(c => c.ativo)).toBe(true);
  expect(banco.equipamentos.every(e => e.ativo)).toBe(true);
  const response = await chamar('/api/clientes/1/desativar', 'POST');
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ id: 1, ativo: false, atualizadoPorId: 7 });
  expect(banco.clientes).toHaveLength(2); expect(banco.equipamentos).toHaveLength(3);
  expect(banco.clientes[1]!.ativo).toBe(true);
  for (const e of banco.equipamentos.filter(e => e.clienteId === 1)) {
    expect(e.ativo).toBe(false); expect(e.atualizadoPorId).toBe(7);
    expect(e.atualizadoEm!.toISOString()).toBe(response.body.atualizadoEm);
  }
  expect(banco.equipamentos.find(e => e.clienteId === 2)!.ativo).toBe(true);
});

test('busca e consulta de clientes escondem inativos por padrão e incluem com opt-in', async () => {
  const { chamar } = await preparar();
  await chamar('/api/clientes/1/desativar', 'POST');
  const ativos = await chamar('/api/clientes?busca=Cliente');
  expect(ativos.body.clientes.map((c: { id: number }) => c.id)).toEqual([2]);
  const todos = await chamar('/api/clientes?busca=Cliente&incluirInativos=true');
  expect(todos.body.clientes.map((c: { ativo: boolean }) => c.ativo)).toEqual([false, true]);
  expect((await chamar('/api/clientes/1')).status).toBe(404);
  expect((await chamar('/api/clientes/1?incluirInativos=true')).body.ativo).toBe(false);
  expect((await chamar('/api/clientes?busca=Cliente&incluirInativos=false')).body.total).toBe(1);
});

test('consultas de equipamentos respeitam o cliente, a situação e a inclusão explícita', async () => {
  const { chamar } = await preparar();
  await chamar('/api/clientes/1/desativar', 'POST');
  expect((await chamar('/api/clientes/1/equipamentos')).status).toBe(404);
  expect((await chamar('/api/clientes/1/equipamentos/1')).status).toBe(404);
  const lista = await chamar('/api/clientes/1/equipamentos?incluirInativos=true');
  expect(lista.body.total).toBe(2);
  expect(lista.body.equipamentos.every((e: { ativo: boolean }) => !e.ativo)).toBe(true);
  expect((await chamar('/api/clientes/1/equipamentos/1?incluirInativos=true')).body.ativo).toBe(false);
  expect((await chamar('/api/clientes/2/equipamentos')).body.total).toBe(1);
  expect((await chamar('/api/clientes/2/equipamentos/1')).body.ativo).toBe(true);
});

test('equipamento inativo de cliente ativo também é filtrado', async () => {
  const { banco, chamar } = await preparar();
  banco.equipamentos[0]!.ativo = false;
  expect((await chamar('/api/clientes/1/equipamentos')).body.total).toBe(1);
  expect((await chamar('/api/clientes/1/equipamentos/1')).status).toBe(404);
  expect((await chamar('/api/clientes/1/equipamentos?incluirInativos=true')).body.total).toBe(2);
});

test('não permite inserir equipamento em cliente inativo nem reativar pelo PUT', async () => {
  const { banco, chamar } = await preparar();
  await chamar('/api/clientes/1/desativar', 'POST');
  const bloqueado = await chamar('/api/clientes/1/equipamentos', 'POST', { tipo: 'Celular' });
  expect(bloqueado.status).toBe(409); expect(bloqueado.body.erro.codigo).toBe('CLIENTE_INATIVO');
  expect(banco.equipamentos).toHaveLength(3);
  const editado = await chamar('/api/clientes/1', 'PUT', { nome: 'Nome alterado', email: 'novo@example.com' });
  expect(editado.status).toBe(200); expect(editado.body.ativo).toBe(false);
  expect((await chamar('/api/clientes/1', 'PUT', { nome: 'Nome alterado', email: 'novo@example.com', ativo: true })).status).toBe(400);
  expect((await chamar('/api/clientes/1/equipamentos/1', 'PUT', { tipo: 'Monitor' })).body.ativo).toBe(false);
});

test('desativação repetida é segura e mantém restrição de exclusão física', async () => {
  const { banco, chamar } = await preparar();
  for (let i = 0; i < 2; i++) expect((await chamar('/api/clientes/1/desativar', 'POST')).status).toBe(200);
  expect(banco.equipamentos).toHaveLength(3);
  expect((await chamar('/api/clientes/1', 'DELETE')).status).toBe(409);
});

test('desativação exige atendente e ID válido', async () => {
  const { app, tecnico, banco, chamar } = await preparar();
  expect((await injetar(app, { caminho: '/api/clientes/1/desativar', metodo: 'POST' })).status).toBe(401);
  expect((await injetar(app, { caminho: '/api/clientes/1/desativar', metodo: 'POST', cabecalhos: tecnico })).status).toBe(403);
  expect((await chamar('/api/clientes/abc/desativar', 'POST')).status).toBe(400);
  expect((await chamar('/api/clientes/999/desativar', 'POST')).status).toBe(404);
  expect(banco.clientes.every(c => c.ativo)).toBe(true);
});

test.each(['/api/clientes?busca=Cliente', '/api/clientes/1', '/api/clientes/1/equipamentos', '/api/clientes/1/equipamentos/1'])('recusa filtro booleano ambíguo em %s', async caminho => {
  const { chamar } = await preparar();
  expect((await chamar(`${caminho}${caminho.includes('?') ? '&' : '?'}incluirInativos=falsee`)).status).toBe(400);
});

test('falha na desativação não informa sucesso nem expõe detalhes internos', async () => {
  const { banco, chamar } = await preparar();
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const falha = jest.spyOn(banco, 'desativar').mockRejectedValue(new Error('SQL interno'));
  try {
    const response = await chamar('/api/clientes/1/desativar', 'POST');
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain('SQL');
    expect(banco.clientes[0]!.ativo).toBe(true);
  } finally { log.mockRestore(); falha.mockRestore(); }
});

test('Prisma usa uma transação para cliente e equipamentos, com auditoria compartilhada', async () => {
  const c = { id: 1, ativo: false, nome: 'Ana', telefone: null, email: 'ana@example.com', criadoEm: new Date(), criadoPorId: 7, atualizadoEm: new Date(), atualizadoPorId: 7 };
  const tx = { cliente: { update: jest.fn().mockResolvedValue(c) }, equipamento: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) } };
  const prisma = { $transaction: jest.fn().mockImplementation(callback => callback(tx)) };
  const repo = new ClientePrismaRepositorio(prisma as unknown as PrismaClient);
  expect((await repo.desativar(1, 7))!.ativo).toBe(false);
  expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  expect(tx.cliente.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { ativo: false, atualizadoEm: expect.any(Date), atualizadoPorId: 7 } });
  expect(tx.equipamento.updateMany).toHaveBeenCalledWith({ where: { clienteId: 1, ativo: true }, data: tx.cliente.update.mock.calls[0]![0].data });
  tx.equipamento.updateMany.mockRejectedValue(new Error('falha na cascata'));
  await expect(repo.desativar(1, 7)).rejects.toThrow('falha na cascata');
});

test('Prisma filtra antes de limitar clientes e respeita ativos nas consultas de equipamentos', async () => {
  const prisma = { cliente: { findMany: jest.fn().mockResolvedValue([]) }, equipamento: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) } };
  const clientes = new ClientePrismaRepositorio(prisma as unknown as PrismaClient);
  const equipamentos = new EquipamentoPrismaRepositorio(prisma as unknown as PrismaClient);
  await clientes.buscarPorTexto('Ana', 20);
  expect(prisma.cliente.findMany.mock.calls[0]![0]).toMatchObject({ where: { ativo: true }, take: 20 });
  await clientes.buscarPorTexto('Ana', 20, true);
  expect(prisma.cliente.findMany.mock.calls[1]![0].where).not.toHaveProperty('ativo');
  await equipamentos.listarPorCliente(1);
  expect(prisma.equipamento.findMany.mock.calls[0]![0].where).toEqual({ clienteId: 1, ativo: true, cliente: { ativo: true } });
  await equipamentos.buscar(1, 1, true);
  expect(prisma.equipamento.findUnique.mock.calls[0]![0].where).toEqual({ clienteId_codigoInterno: { clienteId: 1, codigoInterno: 1 } });
});

test('cadastro Prisma exige cliente ativo dentro da mesma transação que gera o código', async () => {
  const tx = { cliente: { update: jest.fn().mockRejectedValue({ code: 'P2025' }) }, equipamento: { create: jest.fn() } };
  const prisma = { $transaction: jest.fn().mockImplementation(callback => callback(tx)) };
  const repo = new EquipamentoPrismaRepositorio(prisma as unknown as PrismaClient);
  expect(await repo.criarParaCliente(1, { tipo: 'Notebook', marca: null, modelo: null, numeroSerie: null, criadoPorId: 7 })).toBeNull();
  expect(tx.cliente.update.mock.calls[0]![0].where).toEqual({ id: 1, ativo: true });
  expect(tx.equipamento.create).not.toHaveBeenCalled();
});

test('reabilitar restaura cliente e seus equipamentos nas buscas padrão sem afetar outros clientes', async () => {
  const { banco, chamar } = await preparar();
  await chamar('/api/clientes/1/desativar', 'POST');
  await chamar('/api/clientes/2/desativar', 'POST');
  const resposta = await chamar('/api/clientes/1/reabilitar', 'POST');
  expect(resposta.status).toBe(200);
  expect(resposta.body).toMatchObject({ id: 1, ativo: true, atualizadoPorId: 7 });
  expect((await chamar('/api/clientes?busca=Cliente')).body.clientes.map((c: { id: number }) => c.id)).toEqual([1]);
  expect((await chamar('/api/clientes/1/equipamentos')).body.total).toBe(2);
  for (const equipamento of banco.equipamentos.filter(e => e.clienteId === 1)) {
    expect(equipamento.ativo).toBe(true);
    expect(equipamento.atualizadoEm!.toISOString()).toBe(resposta.body.atualizadoEm);
  }
  expect(banco.equipamentos.find(e => e.clienteId === 2)!.ativo).toBe(false);
  expect((await chamar('/api/clientes/1/reabilitar', 'POST')).status).toBe(200);
  expect((await chamar('/api/clientes/1/equipamentos', 'POST', { tipo: 'Monitor' })).status).toBe(201);
});

test('reabilitação exige atendente, ID válido e cliente existente', async () => {
  const { app, tecnico, chamar } = await preparar();
  expect((await injetar(app, { caminho: '/api/clientes/1/reabilitar', metodo: 'POST' })).status).toBe(401);
  expect((await injetar(app, { caminho: '/api/clientes/1/reabilitar', metodo: 'POST', cabecalhos: tecnico })).status).toBe(403);
  expect((await chamar('/api/clientes/abc/reabilitar', 'POST')).status).toBe(400);
  expect((await chamar('/api/clientes/999/reabilitar', 'POST')).status).toBe(404);
});

test('Prisma reabilita cliente e equipamentos dentro da mesma transação', async () => {
  const c = { id: 1, ativo: true, nome: 'Ana', telefone: null, email: 'ana@example.com', criadoEm: new Date(), criadoPorId: 7, atualizadoEm: new Date(), atualizadoPorId: 7 };
  const tx = { cliente: { update: jest.fn().mockResolvedValue(c) }, equipamento: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) } };
  const prisma = { $transaction: jest.fn().mockImplementation(callback => callback(tx)) };
  expect((await new ClientePrismaRepositorio(prisma as unknown as PrismaClient).reabilitar(1, 7))!.ativo).toBe(true);
  expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  expect(tx.cliente.update.mock.calls[0]![0].data.ativo).toBe(true);
  expect(tx.equipamento.updateMany).toHaveBeenCalledWith({ where: { clienteId: 1, ativo: false }, data: tx.cliente.update.mock.calls[0]![0].data });
});
