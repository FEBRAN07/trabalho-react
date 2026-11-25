import { Router } from 'express';
import { UsuariosController, type UsuariosRepositorio } from './usuariosController';
import { aguardar, exigirPerfil } from '../http/middlewares';

export function criarRotasUsuarios(repo: UsuariosRepositorio): Router {
  const router = Router();
  const controller = new UsuariosController(repo);
  const escrita = exigirPerfil('ATENDENTE');
  const leitura = exigirPerfil('ATENDENTE', 'TECNICO');
  router.post('/', escrita, aguardar(controller.criar));
  router.get('/', leitura, aguardar(controller.listar));
  router.get('/:id', leitura, aguardar(controller.buscar));
  router.put('/:id', escrita, aguardar(controller.atualizar));
  router.delete('/:id', escrita, aguardar(controller.excluir));
  return router;
}
