import jwt from 'jsonwebtoken';
import { criarApp } from '../src/http/app';
import { criarRotasUsuarios } from '../src/api/usuariosRoutes';
import type { UsuariosRepositorio } from '../src/api/usuariosController';
import type { LoginRepositorio } from '../src/api/loginController';
import { gerarHash, verificarSenha } from '../src/seguranca/senhas';
import { UsuarioPrismaRepositorio } from '../src/infra/prismaRepositorios';
import type { PrismaClient } from '@prisma/client';
import { BancoMemoria } from './helpers/memoria';
import { SEGREDO } from './helpers/app';
import { injetar } from './helpers/injetar';

const usuario = { id: 3, nome: 'Ana', email: 'ana@example.com', senha: ' senha ', perfil: 'ATENDENTE' as const, ativo: true, criadoEm: new Date('2026-10-29') };
function montar() {
  const repo: jest.Mocked<LoginRepositorio & UsuariosRepositorio> = {
    buscarPorEmail: jest.fn().mockResolvedValue({ ...usuario }), buscarPorId: jest.fn().mockResolvedValue({ ...usuario }),
    atualizar: jest.fn().mockResolvedValue({ ...usuario }), criar: jest.fn().mockResolvedValue(usuario),
    listarTodos: jest.fn().mockResolvedValue([usuario]), excluir: jest.fn().mockResolvedValue(true),
  };
  const banco = new BancoMemoria();
  const app = criarApp({ clientes: banco, equipamentos: banco, ordens: banco, jwtSegredo: SEGREDO, contas: repo, usuarios: criarRotasUsuarios(repo) });
  const login = (corpo: unknown = { email: 'ana@example.com', senha: ' senha ' }) => injetar(app, {
    metodo: 'POST', caminho: '/api/login', corpo, cabecalhos: { Origin: 'http://localhost:5173' },
  });
  return { app, repo, login };
}

test('login público emite JWT de uma hora e não devolve senha', async () => {
  const { login, repo, app } = montar();
  repo.buscarPorEmail.mockResolvedValue({ ...usuario, senha: await gerarHash(' senha ') });
  const response = await login({ email: ' ana@example.com ', senha: ' senha ' });
  expect(response.status).toBe(200);
  expect(repo.buscarPorEmail).toHaveBeenCalledWith('ana@example.com');
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  expect(response.body.usuario).not.toHaveProperty('senha');
  const payload = jwt.verify(response.body.token, SEGREDO) as jwt.JwtPayload;
  expect(payload.sub).toBe('3'); expect(payload.perfil).toBe('ATENDENTE');
  expect(payload.exp! - payload.iat!).toBe(3600);
  expect(repo.atualizar).not.toHaveBeenCalled();
  expect((await injetar(app, { caminho: '/api/usuarios', cabecalhos: { Authorization: `Bearer ${response.body.token}` } })).status).toBe(200);
});

test.each(['ausente', 'senha errada', 'inativo'])('credenciais inválidas (%s) têm o mesmo erro, sem token', async motivo => {
  const { login, repo } = montar();
  if (motivo === 'ausente') repo.buscarPorEmail.mockResolvedValue(null);
  if (motivo === 'inativo') repo.buscarPorEmail.mockResolvedValue({ ...usuario, ativo: false });
  const response = await login({ email: usuario.email, senha: motivo === 'senha errada' ? 'senha' : usuario.senha });
  expect(response.status).toBe(401);
  expect(response.body).toEqual({ erro: { codigo: 'CREDENCIAIS_INVALIDAS', mensagem: 'E-mail ou senha inválidos.' } });
  expect(repo.atualizar).not.toHaveBeenCalled();
});

test('senha legada é convertida apenas após login válido', async () => {
  const { login, repo } = montar();
  expect((await login()).status).toBe(200);
  expect(repo.atualizar).toHaveBeenCalledWith(3, { senha: usuario.senha });
});

test.each([{}, { email: 'inválido', senha: 'x' }, { email: usuario.email, senha: '' }, { email: usuario.email, senha: 'x', perfil: 'ATENDENTE' }, { email: usuario.email, senha: 'x'.repeat(1025) }])('login rejeita corpo inválido antes de consultar o banco', async corpo => {
  const { login, repo } = montar();
  expect((await login(corpo)).status).toBe(400);
  expect(repo.buscarPorEmail).not.toHaveBeenCalled();
});

test('demais rotas continuam protegidas e técnico autenticado não escreve', async () => {
  const { app, login, repo } = montar();
  repo.buscarPorEmail.mockResolvedValue({ ...usuario, perfil: 'TECNICO' });
  repo.buscarPorId.mockResolvedValue({ ...usuario, perfil: 'TECNICO' });
  const response = await login();
  expect((await injetar(app, { caminho: '/api/usuarios' })).status).toBe(401);
  const cabecalhos = { Authorization: `Bearer ${response.body.token}` };
  expect((await injetar(app, { caminho: '/api/usuarios', cabecalhos })).status).toBe(200);
  expect((await injetar(app, { metodo: 'POST', caminho: '/api/usuarios', cabecalhos, corpo: {} })).status).toBe(403);
});

test.each(['inativo', 'excluído', 'perfil alterado'])('JWT não mantém acesso de usuário %s', async motivo => {
  const { app, login, repo } = montar();
  const response = await login();
  repo.buscarPorId.mockResolvedValue(motivo === 'excluído' ? null : { ...usuario, ativo: motivo !== 'inativo', perfil: motivo === 'perfil alterado' ? 'TECNICO' : 'ATENDENTE' });
  expect((await injetar(app, { caminho: '/api/usuarios', cabecalhos: { Authorization: `Bearer ${response.body.token}` } })).status).toBe(401);
});

test('preflight do login é público e origem não autorizada é recusada', async () => {
  const { app, repo } = montar();
  expect((await injetar(app, { metodo: 'OPTIONS', caminho: '/api/login', cabecalhos: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } })).status).toBe(204);
  expect((await injetar(app, { metodo: 'POST', caminho: '/api/login', cabecalhos: { Origin: 'https://invalida.example' }, corpo: { email: usuario.email, senha: usuario.senha } })).status).toBe(403);
  expect(repo.buscarPorEmail).not.toHaveBeenCalled();
});

test('senha cadastrada e alterada é persistida com hash; edição sem senha a preserva', async () => {
  const prisma = { usuario: { create: jest.fn().mockResolvedValue(usuario), update: jest.fn().mockResolvedValue(usuario), findUnique: jest.fn().mockResolvedValue(usuario) } };
  const repo = new UsuarioPrismaRepositorio(prisma as unknown as PrismaClient);
  await repo.criar({ nome: usuario.nome, email: usuario.email, perfil: usuario.perfil, senha: usuario.senha });
  const hash = prisma.usuario.create.mock.calls[0]![0].data.senha;
  expect(hash).toMatch(/^scrypt\$/);
  expect(await verificarSenha(usuario.senha, hash)).toBe(true);
  expect(await verificarSenha('senha', hash)).toBe(false);
  await repo.atualizar(3, { senha: 'nova senha' });
  expect(await verificarSenha('nova senha', prisma.usuario.update.mock.calls[0]![0].data.senha)).toBe(true);
  await repo.atualizar(3, { nome: 'Ana Souza' });
  expect(prisma.usuario.update.mock.calls[1]![0].data).toEqual({ nome: 'Ana Souza' });
  await repo.buscarPorEmail(usuario.email);
  expect(prisma.usuario.findUnique).toHaveBeenCalledWith({ where: { email: usuario.email } });
});

test('hash usa salt diferente por senha e hash malformado falha fechado', async () => {
  expect(await gerarHash('senha')).not.toBe(await gerarHash('senha'));
  expect(await verificarSenha('senha', 'scrypt$invalido$123')).toBe(false);
});

test('tokens expirados ou assinados com outro segredo não consultam dados protegidos', async () => {
  const { app, repo } = montar();
  const expirado = jwt.sign({ perfil: 'ATENDENTE' }, SEGREDO, { subject: '3', expiresIn: -1 });
  const falso = jwt.sign({ perfil: 'ATENDENTE' }, 'outro-segredo', { subject: '3', expiresIn: '1h' });
  for (const token of [expirado, falso]) {
    expect((await injetar(app, { caminho: '/api/usuarios', cabecalhos: { Authorization: `Bearer ${token}` } })).status).toBe(401);
  }
  expect(repo.listarTodos).not.toHaveBeenCalled();
});

test('falha no banco não gera sessão nem expõe erro interno', async () => {
  const { login, repo } = montar();
  repo.buscarPorEmail.mockRejectedValue(new Error('SQL sensível'));
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const response = await login();
    expect(response.status).toBe(500);
    expect(response.body).not.toHaveProperty('token');
    expect(JSON.stringify(response.body)).not.toContain('SQL');
  } finally { log.mockRestore(); }
});
