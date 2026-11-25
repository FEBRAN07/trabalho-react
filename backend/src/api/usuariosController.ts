import type { Request, Response } from 'express';
import { z } from 'zod';
import type { UsuarioPrismaRepositorio } from '../infra/prismaRepositorios';
import { idParam } from '../dominio/validacao';
import { AppError } from '../shared/erros';

export type UsuariosRepositorio = Pick<UsuarioPrismaRepositorio, 'criar' | 'listarTodos' | 'buscarPorId' | 'atualizar' | 'excluir'>;
const cadastro = z.object({
  nome: z.string().trim().min(1), email: z.string().trim().email(),
  senha: z.string().min(1).max(1024), perfil: z.enum(['ATENDENTE', 'TECNICO']),
}).strict();
const alteracao = cadastro.partial().extend({ ativo: z.boolean().optional() });
function publico({ id, nome, email, perfil, ativo, criadoEm }: Awaited<ReturnType<UsuariosRepositorio['criar']>>) {
  return { id, nome, email, perfil, ativo, criadoEm };
}
function duplicidade(error: unknown): never {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
    throw new AppError(409, 'EMAIL_DUPLICADO', 'E-mail já cadastrado.');
  }
  throw error;
}
const inexistente = () => new AppError(404, 'USUARIO_NAO_ENCONTRADO', 'Usuário não encontrado.');

export class UsuariosController {
  constructor(private readonly repo: UsuariosRepositorio) {}
  criar = async (req: Request, res: Response): Promise<void> => {
    const dados = cadastro.parse(req.body);
    try { res.status(201).json(publico(await this.repo.criar(dados))); }
    catch (error) { duplicidade(error); }
  };
  listar = async (_req: Request, res: Response): Promise<void> => {
    res.json((await this.repo.listarTodos()).map(publico));
  };
  buscar = async (req: Request, res: Response): Promise<void> => {
    const usuario = await this.repo.buscarPorId(idParam.parse(req.params.id));
    if (!usuario) throw inexistente();
    res.json(publico(usuario));
  };
  atualizar = async (req: Request, res: Response): Promise<void> => {
    const id = idParam.parse(req.params.id);
    const dados = alteracao.parse(req.body);
    try {
      const usuario = await this.repo.atualizar(id, dados);
      if (!usuario) throw inexistente();
      res.json(publico(usuario));
    } catch (error) { duplicidade(error); }
  };
  excluir = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!await this.repo.excluir(idParam.parse(req.params.id))) throw inexistente();
      res.json({ mensagem: 'Usuário excluído com sucesso.' });
    } catch (error) {
      if (error instanceof Error && error.message === 'EM_USO') {
        throw new AppError(409, 'USUARIO_COM_VINCULOS', 'Usuário possui vínculos.');
      }
      throw error;
    }
  };
}
