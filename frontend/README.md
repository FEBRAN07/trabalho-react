# SysOS — Frontend

Interface da aplicação SysOS, apresentada na disciplina de **Desenvolvimento Web** para demonstrar o uso de **React** com entrada e saída de dados de uma API. Desenvolvida com React, TypeScript e Vite, é voltada a computadores e oferece CRUD de clientes e equipamentos, além de abertura e consulta de ordens de serviço. O frontend usa a API Express em `../backend`; clientes e equipamentos são persistidos pelo backend, sem cadastro ou cache em `localStorage`.

## Como o frontend se comunica com a API

- **Entrada de dados:** os formulários são controlados pelo estado do React. Ao cadastrar ou editar um cliente/equipamento, os dados são enviados em JSON por `POST` ou `PUT`. A exclusão usa `DELETE` após confirmação.
- **Saída de dados:** buscas e consultas fazem requisições `GET`. Os resultados da API são armazenados em estado e apresentados nas listas e nos detalhes dos cadastros.
- **Cliente HTTP:** `src/lib/api.ts` centraliza as chamadas com `fetch`, o envio do JWT, a conversão dos dados da API para os modelos da interface e o tratamento de erros.
- **Retorno ao usuário:** a interface apresenta carregamento durante as requisições, confirmação após sucesso e mensagens de erro quando o backend recusa a operação ou está indisponível.

Por exemplo, cadastrar um cliente envia nome e contato para `POST /api/clientes`; a resposta fornece o identificador que será usado nas consultas e no cadastro de seus equipamentos.

## Executar

Requer Node.js 22.13 ou superior e npm. Configure e inicie primeiro o backend conforme [seu README](../backend/README.md), incluindo PostgreSQL, migrações e `JWT_SECRET`.

```bash
# Na pasta frontend
npm ci
cp .env.example .env
npm run dev
```

Abra `http://localhost:5173`. `VITE_API_URL` é a URL pública incluindo `/api`, por padrão `http://localhost:3000/api`. Reinicie o Vite após alterá-la. Não coloque `JWT_SECRET` ou tokens em variáveis `VITE_*`, pois elas são públicas no bundle.

### Acesso ao protótipo

O backend ainda não emite tokens por uma rota de login. Gere o JWT usando a configuração do backend:

```bash
# Em outro terminal, na pasta backend
npm run -s token:dev -- ATENDENTE 1
# Para acesso somente de consulta:
npm run -s token:dev -- TECNICO 2
```

No frontend, clique em **Conectar à API**, informe o token e escolha **Usar token**. O token fica apenas na memória da aba e é enviado como `Authorization: Bearer ...`. Recarregar exige informá-lo novamente. **Encerrar acesso** remove o token e os resultados exibidos, sem invalidar o JWT no servidor (não há endpoint de logout).

A leitura local do perfil controla apenas os botões; a API verifica assinatura, expiração e permissões em todas as requisições. Respostas 401 limpam o acesso e os resultados. Respostas 403 exibem a recusa do backend. Um token informado não é apresentado como prova de autenticação até a API processar as operações.

## Fluxos

### Clientes

- Informe de 2 a 150 caracteres de **nome, telefone ou e-mail** e pressione Buscar/Enter.
- Não existe carregamento inicial nem listagem de todos os clientes. A API retorna até 20 correspondências; refine o termo quando necessário. A paginação visual percorre somente essa resposta.
- A busca não retorna data de cadastro nem quantidade de equipamentos. Essas informações não são inventadas nos resultados. O identificador mostrado é o ID real da API.
- A ação sobre o nome consulta o cadastro por ID. **Equipamentos** seleciona esse cliente para a próxima tela.
- O atendente pode cadastrar cliente. Campos opcionais vazios são omitidos; telefone é exibido com máscara, enquanto a API guarda os dígitos.
- Possíveis duplicidades são determinadas pelo servidor: uma resposta 409 mostra os candidatos. Apenas a confirmação explícita envia `confirmarDuplicidade: true` em uma nova tentativa. Alterar dados revoga a confirmação.

### Equipamentos

1. Abra Equipamentos e busque um cliente.
2. Selecione o cliente. Somente então seus aparelhos são consultados em `GET /api/clientes/:clienteId/equipamentos`.
3. Busque um código interno exato desse cliente ou use **Todos deste cliente** para repetir a consulta dos aparelhos daquele cliente.
4. Para consultar outra pessoa, use **Trocar cliente**. A troca limpa o contexto anterior; respostas antigas são descartadas/canceladas.

O cadastro também exige esse cliente selecionado, mantido fixo no formulário. Os detalhes consultam `GET /api/clientes/:clienteId/equipamentos/:codigoInterno`. Não há busca global por marca, série, modelo ou proprietário. O código interno pode se repetir entre clientes; a identidade usada pelo frontend é o par **cliente + código**, sem gerar códigos próprios.

Os cadastros exibem estado de gravação, impedem submissão repetida durante a requisição e mantêm dados preenchidos em caso de erro. Mensagens e erros de campos do backend são apresentados ao funcionário. A tela não afirma que um cadastro inexistente foi salvo quando a API retorna erro.

### Edição e exclusão

Com token de **ATENDENTE**, abra os detalhes do cliente pelo nome nos resultados da busca, ou os detalhes do equipamento pelo nome/seta na lista do cliente. As ações **Editar** e **Excluir** aparecem após a consulta dos dados atuais. O técnico continua com acesso somente de consulta.

- **Editar:** abre o formulário preenchido e envia `PUT` com todos os campos editáveis. O identificador do cliente e o par cliente/código do equipamento permanecem fixos. Campos opcionais apagados são omitidos no corpo; conforme o contrato de substituição do backend, isso limpa seu valor. No cliente, continua obrigatório manter pelo menos um contato.
- **Duplicidade na edição:** a API desconsidera o próprio cliente e pode retornar 409 por semelhança com outro cadastro. A interface exige confirmação explícita antes de repetir o PUT com `confirmarDuplicidade: true`. Alterar campos revoga a confirmação anterior.
- **Excluir:** abre um diálogo que identifica o alvo. O DELETE só é enviado após **Confirmar exclusão**. O diálogo bloqueia novos envios e fechamento enquanto a operação estiver pendente, e mantém o erro visível se a API recusar.
- **Vínculos:** `CLIENTE_COM_VINCULOS` ou `EQUIPAMENTO_COM_VINCULOS` são apresentados como impedimentos, sem opção de forçar a exclusão. A verificação definitiva pertence ao backend; não é feita apenas a partir da lista visível.
- **Atualização da tela:** após sucesso, a última busca de clientes é refeita quando existir, sem buscar todos os clientes nem usar um termo ainda não submetido. O cliente selecionado é atualizado ou removido conforme necessário. Equipamentos são consultados novamente no mesmo cliente; a consulta por código pode retornar à lista desse cliente após uma alteração.

| Operação | Rota |
|---|---|
| Atualizar cliente | `PUT /api/clientes/:clienteId` |
| Excluir cliente | `DELETE /api/clientes/:clienteId` |
| Atualizar equipamento | `PUT /api/clientes/:clienteId/equipamentos/:codigoInterno` |
| Excluir equipamento | `DELETE /api/clientes/:clienteId/equipamentos/:codigoInterno` |

PUT e DELETE retornam JSON com o cadastro atualizado ou excluído (200). A interface só apresenta sucesso após essa resposta; não remove resultados de forma otimista em caso de erro.

## Ordens de serviço

O menu **Ordens de serviço** integra as rotas descritas no [README do backend](../backend/README.md#ordens-de-serviço). Atendentes abrem e consultam OS; técnicos podem consultar.

### Abrir uma OS

1. Clique em **Nova OS**, busque o cliente por nome/contato e selecione-o. Quando a busca não encontrar o cliente, é possível cadastrá-lo no próprio fluxo.
2. Selecione um dos equipamentos retornados por `GET /api/clientes/:clienteId/equipamentos`. O código é sempre interpretado dentro do cliente escolhido. **Cadastrar equipamento deste cliente** permite incluir um aparelho e voltar à OS.
3. Preencha o problema relatado (obrigatório, até 1000 caracteres) e clique em **Abrir ordem de serviço**.
4. Se o backend responder `409 EQUIPAMENTO_COM_OS_EM_ABERTO`, a tela mostra número, status, data e problema das OS existentes. Só uma confirmação explícita permite repetir o envio com `confirmarOsEmAberto: true`. Alterar equipamento ou problema revoga a confirmação.
5. A tela só apresenta sucesso após a resposta da API e abre a consulta da OS criada. Número, status inicial, data e autor são os valores do servidor; não são campos editáveis.

Os formulários preservam os dados em falhas de gravação, impedem envio repetido e bloqueiam navegação/fechamento enquanto salvam. As consultas de equipamentos são canceladas ao trocar de cliente ou sair do fluxo.

### Consultar

- Ao abrir o menu, são carregadas as OS mais recentes (até 100, conforme a API).
- **Buscar por número** usa `GET /api/ordens-servico/:numero` e funciona independentemente dos filtros de listagem.
- **Selecionar cliente** abre uma busca de clientes, sem listagem global. Combine esse cliente com o **Status** e pressione **Aplicar filtros**; status usa igualdade exata, permite texto e sugere os estados conhecidos do backend. **Todas as OS** limpa os filtros.
- A paginação percorre os resultados recebidos, em grupos de 10. O limite de 100 não representa a quantidade total cadastrada no banco.
- **Detalhes** faz uma nova consulta por número e mostra cliente, contato, equipamento/código/série, problema relatado, status, data e funcionário responsável pela abertura.

| Operação | Rota |
|---|---|
| Abrir | `POST /api/ordens-servico` |
| Listar/filtrar | `GET /api/ordens-servico?clienteId=&status=` |
| Consultar pelo número | `GET /api/ordens-servico/:numero` |

O cadastro envia apenas `clienteId`, `equipamentoCodigoInterno`, `problemaRelatado` e, quando confirmado, `confirmarOsEmAberto`. Não há edição, exclusão ou atualização de status de OS nesta etapa.

### Validação da integração

Os testes de OS estão em `src/lib/orders.test.ts` e `src/components/Orders.test.tsx`. Cobrem URLs/payloads, filtros, confirmação de OS em aberto, mapeamento dos campos, permissões na interface e apresentação dos detalhes. Os testes de componentes usam renderização estática e não substituem uma verificação de cliques em navegador.

```bash
npm test -- --runTestsByPath src/lib/orders.test.ts src/components/Orders.test.tsx
```

Roteiro manual: abrir OS com equipamento do cliente; repetir a abertura para conferir o alerta e a confirmação; mudar o equipamento/problema para revogar a confirmação; consultar por número, filtrar por cliente/status, limpar filtros e conferir detalhes; usar token de técnico para consultar sem botão **Nova OS**; testar número inexistente, token expirado e falha de rede.

O checkout usado nesta integração contém arquivos remanescentes não integrados de login, usuários e inativação. Eles já causavam erros no `npm run build` antes da alteração. Foram preservados. A aplicação importada por `main.tsx`, os arquivos novos e seus testes passaram na verificação de tipos isolada; o bundle Vite e as suítes do frontend atual/OS também foram validados. A suíte completa ainda inclui testes desses remanescentes que dependem de APIs ausentes neste checkout.

## CORS

O backend permite por padrão as origens locais do Vite nas portas 5173 e 4173 (localhost e 127.0.0.1). Outra origem exige configurar `CORS_ORIGINS` no backend. As portas do frontend são fixas para evitar que o Vite troque silenciosamente de porta e seja bloqueado pelo CORS.

## Verificações

```bash
npm test
npm run test:watch
npm run test:coverage
npm run lint
npm run build
npm run preview
```

A suíte Jest testa validações alinhadas ao contrato, formatação de telefone, URLs aninhadas, mapeamento das respostas, Bearer, payloads de POST, confirmação de duplicidade, erros de campos, acesso expirado, falha de rede, cancelamento, PUT/DELETE e renderização dos formulários e estados de consulta. `fetch` é simulado nos testes de contrato; os testes de renderização usam React no ambiente Node, sem navegador.

Os testes do frontend simulam as respostas da API e não mantêm um banco de dados local. Acessos a `localStorage` e `sessionStorage` são bloqueados por mocks, e `fetch` rejeita chamadas sem resposta explicitamente simulada. Assim, os testes não dependem de uma API em execução nem de dados reais. Os mocks são restaurados e o ambiente é reiniciado entre os casos. Testes de renderização não exercitam cliques, submissão de formulários ou efeitos de consulta; esses fluxos continuam no roteiro manual ou exigem uma suíte de interação com DOM.

Na pasta backend, `npm test -- --runInBand cors.test.ts` exercita o Express em memória, sem porta ou PostgreSQL: preflight, origens, JWT, cadastro, duplicidade, busca e separação dos equipamentos por cliente. As suítes HTTP com Supertest precisam de permissão para abrir portas. A integração Prisma exige banco de testes e apaga tabelas, conforme o README do backend.

Roteiro manual com a API e um banco de desenvolvimento:

1. Informar token de atendente e buscar clientes por nome/contato; verificar erro para termo curto e oferta de cadastro para resultado vazio.
2. Cadastrar um cliente, repetir o nome/contato e conferir a confirmação de duplicidade retornada pelo servidor.
3. Selecionar um cliente, cadastrar equipamento e consultar pelo código interno. Trocar para outro cliente e verificar a separação mesmo que os códigos sejam iguais.
4. Usar token de técnico: consultar é permitido, e os botões de cadastro ficam ocultos; POST direto continua bloqueado pelo backend.
5. Editar cliente e equipamento pelos detalhes, limpar campos opcionais e conferir a persistência na nova consulta, sem mudança de identificadores.
6. Tentar excluir um cliente com equipamentos: a API deve impedir e a tela deve manter o erro. Em uma base de desenvolvimento, excluir um equipamento sem vínculos e depois o cliente vazio, conferindo a atualização das buscas.
7. Testar token expirado, backend desligado e erro de gravação; não deve aparecer sucesso falso.

## Estrutura

- `src/lib/orders.ts`: modelo e validação de ordens de serviço.
- `src/components/OrderForm.tsx`: seleção de cliente/equipamento, abertura e confirmação de OS existentes.
- `src/components/Orders.tsx`: listagem, filtros, paginação e consulta individual.
- `src/lib/api.ts`: cliente HTTP e adaptação dos DTOs da API.
- `src/lib/registry.ts`: modelos e validações do frontend, sem persistência local.
- `src/components/SearchPanels.tsx`: consultas de clientes e equipamentos por cliente.
- `src/components/Forms.tsx`: cadastro/edição assíncronos e erros da API.
- `src/components/DeleteConfirmation.tsx`: confirmação de exclusão e tratamento de falhas.
- `src/components/RecordActions.tsx`: ações de edição e exclusão por permissão.
- `src/components/Details.tsx`: consultas individuais.
- `src/App.tsx`: navegação, seleção de cliente e acesso por token.

O escopo inclui CRUD de clientes/equipamentos e abertura/consulta de OS, respeitando vínculos e histórico. Pagamento, entrega, estoque, administração da loja e implementação do login não integram esta etapa.
