import { criarApp } from '../src/http/app';
import { criarRotasUsuarios } from '../src/api/usuariosRoutes';
import { UsuariosRepositorio } from '../src/api/usuariosController';
import { BancoMemoria } from './helpers/memoria';
import { SEGREDO, token } from './helpers/app';
import { injetar } from './helpers/injetar';

const usuario = { id: 3, nome: 'Ana', email: 'ana@example.com', senha: 'segredo', perfil: 'ATENDENTE' as const, ativo: true, criadoEm: new Date('2026-10-29') };
function montar() {
  const repo: jest.Mocked<UsuariosRepositorio> = { criar: jest.fn().mockResolvedValue(usuario), listarTodos: jest.fn().mockResolvedValue([usuario]), buscarPorId: jest.fn().mockResolvedValue(usuario), atualizar: jest.fn().mockResolvedValue(usuario), excluir: jest.fn().mockResolvedValue(true) };
  const banco = new BancoMemoria();
  const app = criarApp({ clientes: banco, equipamentos: banco, jwtSegredo: SEGREDO, usuarios: criarRotasUsuarios(repo) });
  const chamar = (metodo = 'GET', caminho = '/api/usuarios', corpo?: unknown, perfil: 'ATENDENTE' | 'TECNICO' = 'ATENDENTE') => injetar(app, { metodo, caminho, corpo, cabecalhos: { Authorization: `Bearer ${token(perfil)}`, Origin: 'http://localhost:5173' } });
  return { app, repo, chamar };
}
const entrada = { nome: 'Ana', email: 'ana@example.com', senha: 'segredo', perfil: 'ATENDENTE' };

test('roteador fica antes do 404 e protegido por JWT', async () => {
  const { app, chamar, repo } = montar();
  expect((await injetar(app, { caminho: '/api/usuarios' })).status).toBe(401);
  expect(repo.listarTodos).not.toHaveBeenCalled();
  const response = await chamar();
  expect(response.status).toBe(200);
  expect(response.body[0]).toMatchObject({ nome: 'Ana', ativo: true });
  expect(response.body[0]).not.toHaveProperty('senha');
  expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
});

test.each(['GET', 'POST', 'PUT'])('%s devolve apenas dados públicos de usuário', async metodo => {
  const { chamar } = montar();
  const response = await chamar(metodo, metodo === 'POST' ? '/api/usuarios' : '/api/usuarios/3', metodo === 'GET' ? undefined : entrada);
  expect(response.status).toBe(metodo === 'POST' ? 201 : 200);
  expect(response.body).not.toHaveProperty('senha');
  expect(response.body.id).toBe(3);
});

test.each(['POST', 'PUT', 'DELETE'])('técnico não pode %s', async metodo => {
  const { chamar, repo } = montar();
  expect((await chamar(metodo, metodo === 'POST' ? '/api/usuarios' : '/api/usuarios/3', entrada, 'TECNICO')).status).toBe(403);
  expect(repo.criar).not.toHaveBeenCalled(); expect(repo.atualizar).not.toHaveBeenCalled(); expect(repo.excluir).not.toHaveBeenCalled();
});

test('técnico pode listar e consultar', async () => {
  const { chamar } = montar();
  expect((await chamar('GET', '/api/usuarios', undefined, 'TECNICO')).status).toBe(200);
  expect((await chamar('GET', '/api/usuarios/3', undefined, 'TECNICO')).status).toBe(200);
});

test('PUT parcial preserva senha omitida e permite mudar situação e perfil', async () => {
  const { chamar, repo } = montar();
  expect((await chamar('PUT', '/api/usuarios/3', { nome: 'Ana Souza', perfil: 'TECNICO', ativo: false })).status).toBe(200);
  expect(repo.atualizar).toHaveBeenCalledWith(3, { nome: 'Ana Souza', perfil: 'TECNICO', ativo: false });
});

test.each(['POST', 'PUT'])('%s trata e-mail duplicado como 409', async metodo => {
  const { chamar, repo } = montar();
  repo.criar.mockRejectedValue({ code: 'P2002' }); repo.atualizar.mockRejectedValue({ code: 'P2002' });
  expect((await chamar(metodo, metodo === 'POST' ? '/api/usuarios' : '/api/usuarios/3', entrada)).status).toBe(409);
});

test('retorna 404 em consulta, atualização e exclusão de usuário inexistente', async () => {
  const { chamar, repo } = montar();
  repo.buscarPorId.mockResolvedValue(null); repo.atualizar.mockResolvedValue(null); repo.excluir.mockResolvedValue(false);
  for (const metodo of ['GET', 'PUT', 'DELETE']) expect((await chamar(metodo, '/api/usuarios/3', metodo === 'PUT' ? entrada : undefined)).status).toBe(404);
});

test('DELETE devolve mensagem; vínculos devolvem 409', async () => {
  const { chamar, repo } = montar();
  expect((await chamar('DELETE', '/api/usuarios/3')).body).toEqual({ mensagem: 'Usuário excluído com sucesso.' });
  repo.excluir.mockRejectedValue(new Error('EM_USO'));
  expect((await chamar('DELETE', '/api/usuarios/3')).status).toBe(409);
});

test.each([{ ...entrada, perfil: 'ADMIN' }, { ...entrada, email: 'inválido' }, { ...entrada, senha: '' }, { ...entrada, id: 99 }])('rejeita cadastro inválido e campos imutáveis', async corpo => {
  const { chamar, repo } = montar();
  expect((await chamar('POST', '/api/usuarios', corpo)).status).toBe(400);
  expect(repo.criar).not.toHaveBeenCalled();
});

test('id inválido e campos imutáveis não chegam ao repositório', async () => {
  const { chamar, repo } = montar();
  expect((await chamar('GET', '/api/usuarios/abc')).status).toBe(400);
  expect((await chamar('PUT', '/api/usuarios/3', { id: 9 })).status).toBe(400);
  expect(repo.atualizar).not.toHaveBeenCalled();
});

test('preflight permite CRUD de usuários sem JWT', async () => {
  const { app } = montar();
  expect((await injetar(app, { metodo: 'OPTIONS', caminho: '/api/usuarios/3', cabecalhos: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'authorization,content-type' } })).status).toBe(204);
});
