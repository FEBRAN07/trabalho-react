
import { PrismaClient } from '@prisma/client';
import { carregarConfig } from './config';
import { criarApp } from './http/app';

import {
  ClientePrismaRepositorio,
  EquipamentoPrismaRepositorio,
  UsuarioPrismaRepositorio,
} from './infra/prismaRepositorios';

import { OrdemServicoPrismaRepositorio } from './infra/prismaOrdemServico';

const config = carregarConfig();
const prisma = new PrismaClient();

const contas = new UsuarioPrismaRepositorio(prisma);

const app = criarApp({
  clientes: new ClientePrismaRepositorio(prisma),
  equipamentos: new EquipamentoPrismaRepositorio(prisma),
  ordens: new OrdemServicoPrismaRepositorio(prisma),
  contas,
  jwtSegredo: config.jwtSegredo,
  origensCors: config.origensCors,
});

const servidor = app.listen(config.porta, () => {
  console.log(`SysOS backend ouvindo na porta ${config.porta}`);
});

const encerrar = async () => {
  servidor.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGTERM', () => void encerrar());
process.on('SIGINT', () => void encerrar());
