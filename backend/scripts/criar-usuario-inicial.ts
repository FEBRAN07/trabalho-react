import { PrismaClient } from '@prisma/client';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { stdin, stdout } from 'node:process';
import { z } from 'zod';
import { UsuarioPrismaRepositorio } from '../src/infra/prismaRepositorios';

/** Provisionamento local: não cria rota pública de cadastro. */
async function main() {
  const prisma = new PrismaClient();
  let ocultar = false;
  const saida = new Writable({ write(chunk, _encoding, callback) { if (!ocultar) stdout.write(chunk); callback(); } });
  const entrada = createInterface({ input: stdin, output: saida, terminal: !!stdin.isTTY });
  try {
    if (await prisma.usuario.count()) throw new Error('Já existem usuários. Cadastre novos funcionários pela tela Usuários.');
    const nome = z.string().trim().min(1).parse(await entrada.question('Nome: '));
    const email = z.string().trim().email().parse(await entrada.question('E-mail: '));
    stdout.write('Senha: ');
    ocultar = true;
    const senha = z.string().min(1).max(1024).parse(await entrada.question(''));
    stdout.write('\nConfirme a senha: ');
    const confirmacao = await entrada.question('');
    if (senha !== confirmacao) throw new Error('As senhas não conferem. Informe a mesma senha nas duas linhas.');
    ocultar = false; stdout.write('\n');
    const usuario = await new UsuarioPrismaRepositorio(prisma).criar({ nome, email, senha, perfil: 'ATENDENTE' });
    console.log(`Atendente inicial criado: ${usuario.email} (#${usuario.id}).`);
  } finally {
    ocultar = false; entrada.close(); saida.end(); await prisma.$disconnect();
  }
}
main().catch(() => {
  console.error('Não foi possível criar o atendente inicial. Confira os dados, a confirmação da senha, a conexão e se já existem usuários.');
  process.exitCode = 1;
});
