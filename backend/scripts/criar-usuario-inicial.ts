
import { PrismaClient } from '@prisma/client';
import { UsuarioPrismaRepositorio } from '../src/infra/prismaRepositorios';
import type { Perfil } from '../src/dominio/tipos';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const nome = process.env.ADMIN_NOME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const senha = process.env.ADMIN_SENHA;
  const perfil = (process.env.ADMIN_PERFIL ?? 'ATENDENTE') as Perfil;

  if (!nome || !email || !senha) {
    throw new Error(
      'Informe ADMIN_NOME, ADMIN_EMAIL e ADMIN_SENHA no arquivo .env.',
    );
  }

  if (!['ATENDENTE', 'TECNICO'].includes(perfil)) {
    throw new Error('ADMIN_PERFIL deve ser ATENDENTE ou TECNICO.');
  }

  const repo = new UsuarioPrismaRepositorio(prisma);

  const existente = await repo.buscarPorEmail(email);

  if (existente) {
    console.log(`Já existe um usuário cadastrado com o e-mail ${email}.`);
    return;
  }

  const usuario = await repo.criar({
    nome,
    email,
    senha,
    perfil,
  });

  console.log('Funcionário inicial cadastrado com sucesso!');
  console.log(`ID: ${usuario.id}`);
  console.log(`Nome: ${usuario.nome}`);
  console.log(`E-mail: ${usuario.email}`);
  console.log(`Perfil: ${usuario.perfil}`);
}

main()
  .catch((erro: unknown) => {
    console.error('Erro ao cadastrar funcionário inicial:', erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
