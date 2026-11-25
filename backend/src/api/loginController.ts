import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { UsuarioPrismaRepositorio } from '../infra/prismaRepositorios';
import { AppError } from '../shared/erros';
import { gerarHash, possuiHash, verificarSenha } from '../seguranca/senhas';

export type LoginRepositorio = Pick<UsuarioPrismaRepositorio, 'buscarPorEmail' | 'buscarPorId' | 'atualizar'>;
const entrada = z.object({ email: z.string().trim().email(), senha: z.string().min(1).max(1024) }).strict();
// Também deriva um hash quando o e-mail não existe.
const hashAusente = gerarHash('conta-inexistente');

export class LoginController {
  constructor(private readonly repo: LoginRepositorio, private readonly segredo: string) {}

  entrar = async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    const { email, senha } = entrada.parse(req.body);
    const usuario = await this.repo.buscarPorEmail(email);
    const confere = await verificarSenha(senha, usuario?.senha ?? await hashAusente);
    if (!usuario || !confere || !usuario.ativo) {
      throw new AppError(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha inválidos.');
    }
    if (!possuiHash(usuario.senha)) {
      // O repositório aplica o hash ao gravar a senha legada validada.
      const atualizado = await this.repo.atualizar(usuario.id, { senha });
      if (!atualizado) throw new AppError(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha inválidos.');
    }
    const token = jwt.sign({ perfil: usuario.perfil }, this.segredo, {
      algorithm: 'HS256', subject: String(usuario.id), expiresIn: '1h',
    });
    res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email,
      perfil: usuario.perfil, ativo: usuario.ativo, criadoEm: usuario.criadoEm } });
  };
}
