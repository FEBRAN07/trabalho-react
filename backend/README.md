# SysOS — Backend

API REST da aplicação SysOS, apresentada na disciplina de **Desenvolvimento Web**. O backend recebe os dados enviados pelo frontend React, realiza validações e operações no PostgreSQL e devolve respostas JSON para apresentação na interface.

Desenvolvido com **TypeScript, Node.js, Express, Prisma e PostgreSQL**, com testes em **Jest**. Disponibiliza CRUD de clientes, equipamentos e usuários, além de abertura e consulta de ordens de serviço. Cada equipamento pertence a um cliente e é identificado pelo par `clienteId` + `codigoInterno`.

## Pré-requisitos

- Node.js **20.6 ou superior** (os scripts usam `--env-file`).
- PostgreSQL acessível (local, Docker ou Render).

## Configuração

1. Crie o arquivo `.env` a partir do exemplo.

   PowerShell (Windows):

   ```powershell
   copy .env.example .env
   ```

   Bash (Linux/Mac):

   ```bash
   cp .env.example .env
   ```

2. Preencha as variáveis no `.env`:

   | Variável | O que colocar |
   |---|---|
   | `DATABASE_URL` | URL do PostgreSQL, no formato `postgresql://USUARIO:SENHA@HOST:PORTA/BANCO?schema=public` |
   | `JWT_SECRET` | Texto aleatório com no mínimo 32 caracteres |
   | `CORS_ORIGINS` | Origens HTTP/HTTPS exatas do frontend, separadas por vírgula e sem barra final; opcional no desenvolvimento local |

   Para gerar o `JWT_SECRET`:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

> O `.env` não deve ir para o repositório (já está no `.gitignore`). Os scripts
> `dev`, `token:dev` e `test:int` leem o `.env` automaticamente.

## Como rodar

```bash
npm ci
npx prisma generate
npx prisma migrate deploy   # aplica as migrations de prisma/migrations
npm run dev                 # http://localhost:3000
```

> **Já tinha o banco criado antes do CRUD?** Rode `npx prisma generate` e
> `npx prisma migrate deploy` de novo: a migration `0002_crud_atualizacao`
> acrescenta as colunas de alteração (`atualizadoEm` e `atualizadoPorId`) sem
> apagar nem alterar os dados existentes.

## Testes

```bash
npm run typecheck
npm test            # regras e rotas (repositório em memória, sem banco)
npm run test:cov    # relatório de cobertura
npm run test:int    # integração com PostgreSQL real
```

> **Atenção:** `npm run test:int` lê a `DATABASE_URL` do `.env` e executa
> `TRUNCATE` nas tabelas de clientes, equipamentos e ordens de serviço, **apagando os dados
> existentes**. Use um banco de testes.

Sem `DATABASE_URL` carregada, a suíte de integração é ignorada (aparece como
`skipped` em `npm test`).

## Autenticação

`POST /api/login` é público e recebe `{ "email": "nome@exemplo.com", "senha": "sua senha" }`. Retorna JWT de uma hora e os dados públicos do funcionário. Conta inativa, e-mail inexistente ou senha incorreta retornam 401.

As demais rotas `/api` exigem `Authorization: Bearer <token>`. O middleware verifica assinatura, expiração e o cadastro atual do funcionário: exclusão/inativação ou mudança de perfil invalida o acesso na chamada seguinte. Trocar apenas a senha não revoga tokens existentes. O frontend mantém a sessão em memória e não solicita token manual.

### Primeiro funcionário

A migração `20261125000100_usuarios` cria a tabela de usuários. Aplique as migrações conforme a configuração inicial. Para cadastrar o primeiro funcionário, defina `ADMIN_NOME`, `ADMIN_EMAIL` e `ADMIN_SENHA` no `.env` do backend; opcionalmente `ADMIN_PERFIL` (`ATENDENTE` por padrão). Execute:

```bash
npm run usuario:inicial
```

Depois, entre no frontend com esse e-mail/senha e use o menu **Usuários** para os próximos cadastros. O script não altera um usuário que já tenha o mesmo e-mail. O comando `token:dev` permanece disponível para ferramentas de desenvolvimento; o id/perfil do token precisa corresponder a um usuário ativo existente.

Permissões de acesso: escrita (`POST`, `PUT` e `DELETE`) só para
`ATENDENTE`; leitura (`GET`) para `ATENDENTE` e `TECNICO`.

## Endpoints

| Método e rota | Perfil | Descrição |
|---|---|---|
| `POST /api/login` | público | Autentica funcionário ativo por e-mail/senha |
| `POST /api/usuarios` | atendente | Cadastra funcionário com nome, e-mail, senha e perfil |
| `GET /api/usuarios` | ambos | Lista funcionários, em ordem de nome |
| `GET /api/usuarios/:id` | ambos | Consulta funcionário pelo identificador |
| `PUT /api/usuarios/:id` | atendente | Altera nome, e-mail, senha, perfil e/ou situação |
| `DELETE /api/usuarios/:id` | atendente | Exclui funcionário, se não houver vínculos |
| `POST /api/clientes` | atendente | Cadastra cliente (nome + ao menos um contato). Responde `409` se houver possível duplicidade; para confirmar, repita com `"confirmarDuplicidade": true` |
| `GET /api/clientes?busca=` | ambos | Busca por nome, telefone ou e-mail; sem resultado devolve `ofertaCadastro: true` |
| `GET /api/clientes/:clienteId` | ambos | Consulta um cliente |
| `PUT /api/clientes/:clienteId` | atendente | Altera o cliente (mesmo corpo do `POST`). O `id` não muda. Duplicidade com **outro** cliente responde `409`; confirme com `"confirmarDuplicidade": true` |
| `DELETE /api/clientes/:clienteId` | atendente | Exclui o cliente **sem equipamentos nem OS**; com vínculos responde `409 CLIENTE_COM_VINCULOS` |
| `POST /api/clientes/:clienteId/equipamentos` | atendente | Cadastra equipamento (só `tipo` é obrigatório; o código interno é gerado) |
| `GET /api/clientes/:clienteId/equipamentos` | ambos | Lista os equipamentos do cliente (para reaproveitar) |
| `GET /api/clientes/:clienteId/equipamentos/:codigoInterno` | ambos | Consulta um equipamento |
| `PUT /api/clientes/:clienteId/equipamentos/:codigoInterno` | atendente | Altera o equipamento (mesmo corpo do `POST`). Dono e código interno não mudam |
| `DELETE /api/clientes/:clienteId/equipamentos/:codigoInterno` | atendente | Exclui o equipamento **sem OS vinculada**; com vínculos responde `409 EQUIPAMENTO_COM_VINCULOS` |

`GET /health` não exige login e não expõe dados.

### Usuários

POST recebe `nome`, `email`, `senha` e `perfil` (`ATENDENTE` ou `TECNICO`); o cadastro começa ativo. PUT de usuários aceita campos parciais, incluindo `ativo` booleano. Omitir senha mantém o hash atual; senha vazia é inválida. E-mails são normalizados para minúsculas. Duplicidade em POST/PUT retorna 409.

As respostas de cadastro, consulta e edição incluem apenas `id`, `nome`, `email`, `perfil`, `ativo` e `criadoEm`. Nunca incluem senha ou hash. DELETE retorna 200 com `{ "mensagem": "Usuário excluído com sucesso." }`; vínculos retornam 409 e usuário inexistente, 404.

As senhas usam scrypt com salt aleatório. Cadastros antigos em texto são convertidos após um login válido. As rotas de usuários ficam dentro do roteador autenticado, antes do tratamento de rota desconhecida, com as mesmas regras de CORS das demais rotas.

```bash
npm test -- --runInBand usuarios.test.ts login.test.ts cors.test.ts
```

Essas suítes exercitam o Express em memória, com repositórios simulados e sem PostgreSQL. Testes remanescentes de inativação de clientes/equipamentos (`tests/inativos.test.ts`) ainda dependem de métodos ausentes neste branch e afetam a verificação de tipos da suíte completa.

### Como funcionam a alteração e a exclusão de clientes/equipamentos

- **`PUT` substitui os dados editáveis** (não é parcial): envie o cadastro
  completo. Num cliente, omitir um contato o remove, desde que reste ao menos
  um. Num equipamento, `marca`, `modelo` e `numeroSerie` omitidos ou
  vazios passam a nulos; só `tipo` é obrigatório.
- **Campos que nunca mudam:** `id` do cliente, `clienteId` e `codigoInterno` do
  equipamento, e `criadoEm`/`criadoPorId`.
  Enviá-los no corpo resulta em `400`. Não há transferência de equipamento para
  outro cliente.
- **Quem alterou e quando:** a resposta traz `atualizadoEm` e
  `atualizadoPorId` (nulos enquanto o cadastro nunca foi alterado).
- **Exclusão e histórico:** nada apaga o histórico. O banco recusa a
  exclusão de cliente que tenha equipamentos ou OS, e de
  equipamento que tenha OS. Para excluir um cliente com equipamentos, exclua
  antes os equipamentos que não tenham OS. Apenas cadastros sem vínculos podem ser excluídos.
- **Códigos não são reaproveitados:** o `id` do cliente e o `codigoInterno` do
  equipamento excluídos nunca são reutilizados por novos cadastros.
- **Resposta do `DELETE`:** `200` com o cadastro excluído em JSON (não `204`),
  para o cliente HTTP do frontend, que sempre lê o corpo da resposta.

A busca de clientes exige um termo com 2 a 150 caracteres e retorna no máximo 20 resumos (id, nome e contatos), sem data de cadastro. Não há listagem global. O código interno de equipamento é único **por cliente**, por isso todas as consultas e cadastros exigem `clienteId` na URL.

### Exemplos

PowerShell (Windows): copie o campo `token` da resposta do login para `$TOKEN` e defina `$h = @{ Authorization = "Bearer $TOKEN" }` antes dos exemplos abaixo:

```powershell
$body = @{ nome = "Maria da Silva"; telefone = "(42) 99999-1234" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/clientes -Headers $h `
  -ContentType "application/json" -Body ([Text.Encoding]::UTF8.GetBytes($body))

$body = @{ tipo = "Notebook"; marca = "Dell" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/clientes/1/equipamentos -Headers $h `
  -ContentType "application/json" -Body ([Text.Encoding]::UTF8.GetBytes($body))

# Alterar o cliente 1 (PUT substitui os dados editáveis)
$body = @{ nome = "Maria Souza"; email = "maria@exemplo.com" } | ConvertTo-Json
Invoke-RestMethod -Method Put -Uri http://localhost:3000/api/clientes/1 -Headers $h `
  -ContentType "application/json" -Body ([Text.Encoding]::UTF8.GetBytes($body))

# Alterar o equipamento 1 do cliente 1
$body = @{ tipo = "Notebook"; marca = "Lenovo"; modelo = "IdeaPad" } | ConvertTo-Json
Invoke-RestMethod -Method Put -Uri http://localhost:3000/api/clientes/1/equipamentos/1 -Headers $h `
  -ContentType "application/json" -Body ([Text.Encoding]::UTF8.GetBytes($body))

# Excluir o equipamento e depois o cliente
Invoke-RestMethod -Method Delete -Uri http://localhost:3000/api/clientes/1/equipamentos/1 -Headers $h
Invoke-RestMethod -Method Delete -Uri http://localhost:3000/api/clientes/1 -Headers $h
```

> No PowerShell, `Invoke-RestMethod` mostra só o status em respostas de erro.
> Para ver o corpo, envolva a chamada em `try { ... } catch { $_.ErrorDetails.Message }`.

Bash (Linux/Mac):

```bash
curl -X POST localhost:3000/api/clientes -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nome":"Maria da Silva","telefone":"(42) 99999-1234"}'

curl -X POST localhost:3000/api/clientes/1/equipamentos -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tipo":"Notebook","marca":"Dell"}'

curl -X PUT localhost:3000/api/clientes/1 -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nome":"Maria Souza","email":"maria@exemplo.com"}'

curl -X DELETE localhost:3000/api/clientes/1/equipamentos/1 -H "Authorization: Bearer $TOKEN"
curl -X DELETE localhost:3000/api/clientes/1 -H "Authorization: Bearer $TOKEN"
```

### Formato dos erros

```json
{ "erro": { "codigo": "...", "mensagem": "...", "detalhes": "..." } }
```

As respostas de erro nunca incluem stack trace, SQL ou nomes de tabela.

## Deploy (Render)

| Campo | Valor |
|---|---|
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm run migrate:deploy && npm start` |
| Variáveis de ambiente | `DATABASE_URL` e `JWT_SECRET`, definidas no painel (nunca no repositório) |

## Estrutura

```
prisma/            schema.prisma e migration SQL
src/dominio/       tipos, interfaces de repositório e validação (zod)
src/servicos/      operações e validações de clientes, equipamentos e OS
src/infra/         repositórios Prisma (única camada que conhece o banco)
src/http/          app Express, autenticação/perfil e tratamento de erros
tests/             Jest + Supertest; tests/integracao exige PostgreSQL
```

## Integração com o frontend e CORS

O frontend em `../frontend` usa `VITE_API_URL=http://localhost:3000/api` e autentica por e-mail/senha em `POST /api/login`, mantendo o JWT recebido apenas na memória da aba.

Por padrão, o backend aceita as origens `http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:4173` e `http://127.0.0.1:4173`. Para outra origem, configure `CORS_ORIGINS` com valores exatos separados por vírgula, por exemplo `https://sysos.example`. A configuração substitui a lista padrão; valor vazio não permite origens de navegador.

O middleware trata preflight `OPTIONS` antes do JWT, permite `GET`, `POST`, `PUT` e `DELETE` com `Authorization` e `Content-Type` e expõe `Location`. As operações protegidas exigem token e perfil; o login é público; respostas de erro para origens permitidas também recebem CORS. Não usa coringa nem cookies. Chamadas sem `Origin` (como scripts e ferramentas de API) continuam sujeitas à autenticação das rotas `/api`.

```bash
npm test -- --runInBand cors.test.ts
```

Essa suíte usa o Express e os serviços reais com repositórios em memória e injeção HTTP sem abrir portas. Ela verifica CORS, preservação do JWT nas operações efetivas e os contratos de cadastro/busca usados pelo frontend. Os demais testes HTTP continuam usando Supertest. A suíte de CORS não depende de PostgreSQL.

## Ordens de serviço

A API permite abrir e consultar ordens de serviço. As rotas usam a mesma autenticação JWT das demais operações.

| Método e rota | Perfil | Descrição |
|---|---|---|
| `POST /api/ordens-servico` | atendente | Abre uma OS; retorna `201` com os dados e o cabeçalho `Location` |
| `GET /api/ordens-servico?clienteId=&status=` | ambos | Lista até 100 OS, mais recentes primeiro, com filtros opcionais por cliente e status |
| `GET /api/ordens-servico/:numero` | ambos | Consulta uma OS pelo número |

Exemplo de corpo para abertura:

```json
{
  "clienteId": 1,
  "equipamentoCodigoInterno": 1,
  "problemaRelatado": "Não liga"
}
```

Cliente, equipamento do mesmo cliente e problema relatado são obrigatórios. O problema deve ter de 1 a 1000 caracteres. O número, a data, o autor e o status inicial **Aguardando Diagnóstico** são definidos pelo servidor.

Se já houver OS em aberto para o equipamento, a API retorna `409 EQUIPAMENTO_COM_OS_EM_ABERTO`, com as ordens existentes em `erro.detalhes.ordensEmAberto`. Para confirmar a abertura de outra ordem, repita a requisição acrescentando `"confirmarOsEmAberto": true`. OS com status `Concluída` ou `Cancelada` não entram nesse alerta.

As respostas de abertura e consulta incluem número, status, problema relatado, data, autor e os dados do cliente e do equipamento. A listagem retorna `{ "total": 2, "ordens": [ ... ] }`. O filtro de status usa igualdade exata. Não há rotas de edição ou exclusão de OS.

A migração `0003_ordem_servico` cria a tabela de ordens de serviço. Para atualizar um banco existente, execute `npx prisma generate` e `npx prisma migrate deploy` na pasta backend.
