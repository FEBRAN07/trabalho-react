
import express, { Express, Router } from 'express';

import { OrdemServicoRepositorio } from '../dominio/ordemServico';
import {
  ClienteRepositorio,
  EquipamentoRepositorio,
} from '../dominio/tipos';

import {
  buscaSchema,
  clienteSchema,
  equipamentoSchema,
  idParam,
} from '../dominio/validacao';

import { ClienteServico } from '../servicos/clienteServico';
import { EquipamentoServico } from '../servicos/equipamentoServico';
import { OrdemServicoServico } from '../servicos/ordemServicoServico';

import { AppError } from '../shared/erros';

import {
  aguardar,
  autenticar,
  exigirPerfil,
  tratarErros,
} from './middlewares';

import { cors, ORIGENS_PADRAO } from './cors';
import { criarRotasOs } from './rotasOs';
import { LoginController } from '../api/loginController';
import { UsuarioPrismaRepositorio } from '../infra/prismaRepositorios';

export interface Dependencias {
  clientes: ClienteRepositorio;
  equipamentos: EquipamentoRepositorio;
  ordens: OrdemServicoRepositorio;

  contas: Pick<
    UsuarioPrismaRepositorio,
    'buscarPorEmail' | 'buscarPorId' | 'atualizar'
  >;

  jwtSegredo: string;
  origensCors?: readonly string[];
}

const ESCRITA = exigirPerfil('ATENDENTE');
const LEITURA = exigirPerfil('ATENDENTE', 'TECNICO');

export function criarApp(dep: Dependencias): Express {
  const app = express();

  app.disable('x-powered-by');

  app.use(cors(dep.origensCors ?? ORIGENS_PADRAO));
  app.use(express.json({ limit: '10kb' }));

  // Login público: não exige JWT.
  const loginController = new LoginController(
    dep.contas,
    dep.jwtSegredo,
  );

  app.post(
    '/api/login',
    aguardar(loginController.entrar),
  );

  // Verificação de saúde.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const clienteServico = new ClienteServico(dep.clientes);

  const equipamentoServico = new EquipamentoServico(
    dep.clientes,
    dep.equipamentos,
  );

  const ordemServico = new OrdemServicoServico(
    dep.clientes,
    dep.equipamentos,
    dep.ordens,
  );

  // Todas as demais rotas da API exigem autenticação.
  const api = Router();

  api.use(autenticar(dep.jwtSegredo));

  // CLIENTES

  api.post(
    '/clientes',
    ESCRITA,
    aguardar(async (req, res) => {
      const entrada = clienteSchema.parse(req.body);

      const criado = await clienteServico.cadastrar(
        entrada,
        req.usuario!,
      );

      res
        .status(201)
        .location(`/api/clientes/${criado.id}`)
        .json(criado);
    }),
  );

  api.get(
    '/clientes',
    LEITURA,
    aguardar(async (req, res) => {
      const { busca } = buscaSchema.parse(req.query);

      res.json(await clienteServico.buscar(busca));
    }),
  );

  api.get(
    '/clientes/:clienteId',
    LEITURA,
    aguardar(async (req, res) => {
      const id = idParam.parse(req.params['clienteId']);

      res.json(await clienteServico.obter(id));
    }),
  );

  api.put(
    '/clientes/:clienteId',
    ESCRITA,
    aguardar(async (req, res) => {
      const id = idParam.parse(req.params['clienteId']);
      const entrada = clienteSchema.parse(req.body);

      res.json(
        await clienteServico.atualizar(
          id,
          entrada,
          req.usuario!,
        ),
      );
    }),
  );

  api.delete(
    '/clientes/:clienteId',
    ESCRITA,
    aguardar(async (req, res) => {
      const id = idParam.parse(req.params['clienteId']);

      res.json(await clienteServico.excluir(id));
    }),
  );

  // EQUIPAMENTOS

  api.post(
    '/clientes/:clienteId/equipamentos',
    ESCRITA,
    aguardar(async (req, res) => {
      const clienteId = idParam.parse(req.params['clienteId']);
      const entrada = equipamentoSchema.parse(req.body);

      const criado = await equipamentoServico.cadastrar(
        clienteId,
        entrada,
        req.usuario!,
      );

      res
        .status(201)
        .location(
          `/api/clientes/${clienteId}/equipamentos/${criado.codigoInterno}`,
        )
        .json(criado);
    }),
  );

  api.get(
    '/clientes/:clienteId/equipamentos',
    LEITURA,
    aguardar(async (req, res) => {
      const clienteId = idParam.parse(req.params['clienteId']);

      const lista = await equipamentoServico.listar(clienteId);

      res.json({
        total: lista.length,
        equipamentos: lista,
      });
    }),
  );

  api.get(
    '/clientes/:clienteId/equipamentos/:codigoInterno',
    LEITURA,
    aguardar(async (req, res) => {
      const clienteId = idParam.parse(req.params['clienteId']);
      const codigo = idParam.parse(req.params['codigoInterno']);

      res.json(
        await equipamentoServico.obter(clienteId, codigo),
      );
    }),
  );

  api.put(
    '/clientes/:clienteId/equipamentos/:codigoInterno',
    ESCRITA,
    aguardar(async (req, res) => {
      const clienteId = idParam.parse(req.params['clienteId']);
      const codigo = idParam.parse(req.params['codigoInterno']);
      const entrada = equipamentoSchema.parse(req.body);

      res.json(
        await equipamentoServico.atualizar(
          clienteId,
          codigo,
          entrada,
          req.usuario!,
        ),
      );
    }),
  );

  api.delete(
    '/clientes/:clienteId/equipamentos/:codigoInterno',
    ESCRITA,
    aguardar(async (req, res) => {
      const clienteId = idParam.parse(req.params['clienteId']);
      const codigo = idParam.parse(req.params['codigoInterno']);

      res.json(
        await equipamentoServico.excluir(clienteId, codigo),
      );
    }),
  );

  // ORDENS DE SERVIÇO

  api.use(
    '/ordens-servico',
    criarRotasOs(ordemServico),
  );

  // Rota não encontrada.
  api.use((_req, _res, next) => {
    next(
      new AppError(
        404,
        'ROTA_NAO_ENCONTRADA',
        'Recurso não encontrado.',
      ),
    );
  });

  app.use('/api', api);

  app.use(tratarErros);

  return app;
}