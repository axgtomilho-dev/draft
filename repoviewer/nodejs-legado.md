# Tarefa: gerar visualizador de fluxos de um backend Node.js

Você está na raiz de um repositório Node.js backend qualquer — não assuma
framework específico além de "código JavaScript ou TypeScript executável com
Node 16+ e gerenciado por npm/yarn/pnpm". Pode ser Express, NestJS, Fastify,
Koa, Hapi, AdonisJS, Sails, tRPC ou um híbrido. Gere uma ferramenta
**estática, client-side, sem build step** que permite navegar visualmente
pelos fluxos da aplicação, identificando pontos de entrada (estímulos) e
mapeando relações entre módulos/classes. A ferramenta será servida via
`python -m http.server` (ou equivalente) rodando na raiz do repositório.

## Etapa 0 — Ambiente de execução

**Antes de qualquer comando**, identifique o sistema operacional e o shell
disponível:

- **Linux/macOS:** use bash/zsh diretamente.
- **Windows:** **não use** `cmd.exe` / MS-DOS — ele tem ferramentas pobres
  (sem `find` POSIX, sem `grep`, sem pipes confiáveis). Identifique, em
  ordem de preferência:
  1. **Git Bash** (vem com `git for Windows`, normalmente em
     `C:\Program Files\Git\bin\bash.exe`).
  2. **WSL** (`wsl --status` retorna 0 se instalado e configurado).
  3. **PowerShell 7+** (`pwsh`) — aceitável; sintaxe diferente de bash.
  4. Windows PowerShell 5.x — última opção, evite redirecionar stderr
     de processos nativos.

  Reporte qual shell você escolheu e use-o consistentemente para todos os
  comandos de scan/scripting. Se nenhum shell POSIX estiver disponível, peça
  ao usuário para instalar Git Bash antes de prosseguir.

- **Python 3.8+** é obrigatório para o gerador. Se não estiver no PATH,
  reporte e peça ao usuário para instalar antes de prosseguir.
- **Não execute** `npm install`, `yarn`, `pnpm install` nem nenhum script
  do projeto. O scan é puramente estático e não depende de `node_modules/`
  resolvido.

## Saída

Crie uma pasta `repoviewer/` na raiz contendo:

- `generate.py` — gerador (scanner JS/TS) em Python.
- `index.html` — **página inicial** com overview do repositório (ver Etapa 5).
- `explorer.html` — visualizador principal de entry points / grafo de fluxos.
- `app.js` — lógica do explorer.
- `styles.css` — estilos compartilhados.
- `data/overview.json` — dados resumidos do projeto (nome, descrição, pacotes,
  entidades de domínio, estatísticas).
- `data/manifest.json` — índice de entry points / módulos / edges.
- `data/modules/<id>.json` — detalhes por módulo/classe, carregados sob demanda.
- `README.md` — instruções de uso, regeneração e limitações.

**Não modifique nada fora de `repoviewer/`** (com exceção opcional de criar
`.claude/launch.json` se você for usar a Preview do Claude Code para validar).

## Etapa 1 — Descoberta

Detecte automaticamente:

- **Gerenciador de pacotes**: presença de `package-lock.json` (npm),
  `yarn.lock` (Yarn), `pnpm-lock.yaml` (pnpm), `bun.lockb` (Bun).
- **Linguagem dominante**: relação entre arquivos `.ts`/`.tsx` vs `.js`/`.mjs`
  /`.cjs`. Reporte qual prevalece.
- **Sistema de módulos**: olhe `"type": "module"` em `package.json` (ESM por
  padrão) e a presença de `import`/`export` vs `require`/`module.exports`.
- **TypeScript config**: existência de `tsconfig.json`, `tsconfig.base.json`.
  Capture `compilerOptions.baseUrl`, `paths`, `rootDir`, `outDir` para
  resolver imports com aliases (`@app/*`, `~/*`).
- **Monorepo**: presença de `pnpm-workspace.yaml`, `lerna.json`, `nx.json`,
  `turbo.json`, ou `workspaces` em `package.json`. Inclua **todos** os
  pacotes de backend; ignore pacotes claramente frontend (`react`, `next`,
  `vite`, `vue` como dependência principal sem indício de servidor).
- **Framework dominante**: detecte por dependências em `package.json`
  (`express`, `@nestjs/core`, `fastify`, `koa`, `@hapi/hapi`,
  `@adonisjs/core`, `sails`, `@trpc/server`, `apollo-server-*`,
  `mercurius`, `restify`, `feathers`, etc.). Pode haver mais de um.
- **Versão do Node**: `engines.node` em `package.json` ou `.nvmrc`.
- **Nome e descrição**: `name` + `description` do `package.json` raiz; se
  vazio, README; fallback nome do diretório.
- **Diretórios fonte**: padrão é `src/`, mas pode ser `lib/`, `app/`,
  `server/`, `api/`, ou raiz direta. Inclua também `apps/*/src` e
  `packages/*/src` em monorepos.

Varra arquivos `.js`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts`, `.cts` em todos
os roots. **Exclua**:

- `**/node_modules/**`, `**/dist/**`, `**/build/**`, `**/out/**`,
  `**/.next/**`, `**/.nuxt/**`, `**/.turbo/**`, `**/.cache/**`,
  `**/coverage/**`, `.git/`, `.idea/`, `.vscode/`.
- Testes: `**/*.test.{js,ts,jsx,tsx}`, `**/*.spec.{js,ts,jsx,tsx}`,
  `**/__tests__/**`, `**/__mocks__/**`, `**/test/**`, `**/tests/**`,
  `**/e2e/**`, `**/cypress/**`, `**/playwright/**`.
- Declarações puras de tipo: `**/*.d.ts` (não contêm runtime).
- Migrations e seeds quando claramente isolados (`migrations/`, `seeds/`)
  podem ser **incluídos** mas marcados com stereotype `migration` — eles
  raramente fazem parte do fluxo de execução.

Se o projeto tiver código gerado (`prisma generate`, `nest build`,
`graphql-codegen`), os artefatos costumam ficar em `dist/`, `node_modules/.prisma/`
ou `src/generated/`. Os dois primeiros já são excluídos; tolere o último —
o gerador não pode falhar.

## Etapa 2 — Pontos de entrada (estímulos)

Identifique e classifique. **Lembre que decoradores (NestJS, TypeORM,
TypeGraphQL) só existem em TypeScript** — em JS puro, procure registros
imperativos.

**HTTP/REST**

- **Express/Connect**: chamadas em objetos do tipo `app`, `router`,
  `Router()`: `app.get(...)`, `app.post(...)`, `router.put(...)`, etc.
  Cubra também `app.use('/prefix', subRouter)` para reconstruir o caminho
  completo. Capture o callback (named function, arrow inline, ou referência
  a handler em outro módulo).
- **Fastify**: `fastify.get`, `fastify.post`, `fastify.route({ method, url })`.
  Plugins via `fastify.register(plugin, { prefix: '/x' })`.
- **Koa / koa-router**: `router.get(...)`, `router.post(...)`,
  `app.use(router.routes())`.
- **Hapi**: `server.route({ method, path, handler })`.
- **NestJS**: `@Controller('prefix')` na classe + `@Get`, `@Post`, `@Put`,
  `@Delete`, `@Patch`, `@All`, `@Options`, `@Head` nos métodos. Composição
  do path = prefixo do controller + arg do decorator do método.
- **AdonisJS**: `Route.get`, `Route.post`, `Route.resource` (em `start/routes.ts`).
- **Restify**: `server.get`, `server.post`, etc.
- **tRPC**: routers `t.router({ ... })` com procedures `.query` / `.mutation`.
- **Apollo / Mercurius / NestJS GraphQL**: ver bloco GraphQL abaixo.
- **Next.js / Nuxt server routes** (se aparecerem em projeto majoritariamente
  backend): handlers exportados em `pages/api/**`, `app/api/**/route.ts`,
  `server/api/**`.

**Agendados**

- `node-cron`: `cron.schedule('* * * * *', fn)`.
- `node-schedule`: `schedule.scheduleJob(rule, fn)`.
- `agenda` / `agendash`: `agenda.define('job-name', fn)` + `agenda.every('5 minutes', 'job-name')`.
- `bull` / `bullmq`: `new Queue('name')` + `new Worker('name', processor)`.
  O **Worker** é o entry point; capture o nome da queue.
- NestJS Schedule: `@Cron('* * * * *')`, `@Interval(ms)`, `@Timeout(ms)`.
- AdonisJS Scheduler / Adonis Ace commands recorrentes.
- **Resolva referências a constantes** (`@Cron(MY_CRON)` / `cron.schedule(MY_CRON, ...)`)
  quando `MY_CRON` for `const MY_CRON = '...'` no mesmo arquivo ou importado de
  um arquivo de constantes simples (string literal direta).

**Mensageria/Eventos**

- **Kafka**: `kafkajs` (`consumer.subscribe({ topic })` + `consumer.run({ eachMessage })`),
  `node-rdkafka`, `@nestjs/microservices` (`@MessagePattern`, `@EventPattern`).
- **RabbitMQ**: `amqplib` (`channel.consume(queue, fn)`),
  `@golevelup/nestjs-rabbitmq` (`@RabbitSubscribe({ queue, routingKey })`),
  `rascal`, `amqp-connection-manager`.
- **AWS SQS**: `sqs-consumer` (`Consumer.create({ queueUrl, handleMessage })`),
  `@ssut/nestjs-sqs` (`@SqsMessageHandler`).
- **AWS SNS / EventBridge** handlers expostos via Lambda.
- **Redis pub/sub**: `redis.subscribe(channel, fn)`, `ioredis` equivalents.
- **NATS**: `nats.subscribe(subject, fn)`.
- **MQTT**: `mqtt.on('message', fn)` + `mqtt.subscribe(topic)`.
- **EventEmitter** customizado: `emitter.on('eventName', fn)` quando o
  emissor é compartilhado (ex.: `@nestjs/event-emitter` `@OnEvent('user.created')`).
- **AWS Lambda handlers**: `export const handler = async (event) => ...` em
  arquivos referenciados por `serverless.yml`, `template.yaml` (SAM), ou
  `functions/*` no projeto.

**WebSocket / Realtime**

- **Socket.io**: `io.on('connection', socket => { socket.on('event', fn) })`.
- **ws**: `wss.on('connection', ws => { ws.on('message', fn) })`.
- **NestJS**: `@WebSocketGateway()` + `@SubscribeMessage('event')`.
- **GraphQL Subscriptions**: `@Subscription` (NestJS / TypeGraphQL) ou campos
  `Subscription` em SDL.

**CLI**

- `commander` (`program.command('name').action(fn)`),
- `yargs` (`.command('name', desc, builder, handler)`),
- `oclif` (classes estendendo `Command`),
- `nest-commander` (`@Command({ name })`),
- AdonisJS Ace: classes estendendo `BaseCommand`.
- Scripts standalone com `if (require.main === module)` ou `import.meta.url ===
  pathToFileURL(process.argv[1]).href` (ESM) — capture o arquivo e a função `main`.
- Scripts listados em `package.json` `"scripts"` que apontem para arquivos do
  próprio repo (não globalmente instalados).

**GraphQL**

- **Apollo Server / standalone**: `resolvers = { Query: { ... }, Mutation: { ... } }`.
  Capture cada chave de `Query`, `Mutation`, `Subscription`.
- **type-graphql**: `@Resolver(() => Type)` + `@Query`, `@Mutation`, `@Subscription`,
  `@FieldResolver`.
- **NestJS GraphQL**: `@Resolver()` + `@Query`, `@Mutation`, `@Subscription`,
  `@ResolveField`.
- **Mercurius / fastify-gql**: resolvers registrados via plugin.

**gRPC**

- `@grpc/grpc-js` com `server.addService(definition, { rpcName: handler })`.
- NestJS gRPC: `@GrpcMethod('Service', 'Method')`, `@GrpcStreamMethod`.

Para cada entry point capture: `type`, `label` (URL completa, topic, cron
expr, evento, queue, etc.), `moduleId` (caminho do arquivo + nome
exportado), `handler` (nome da função/método), `file`, `line`, `details`
(verbo HTTP, queue name, consumer group, payload schema quando inferível).

## Etapa 3 — Mapeamento de fluxos (heurístico)

Identidade de nó: como Node.js não tem FQN como Java, use
`<caminho-relativo>::<nomeExportado>` (ex.: `src/users/user.service.ts::UserService`)
ou `<caminho-relativo>::default` para default exports. Para funções soltas
exportadas, use o próprio nome.

Para cada arquivo relevante:

1. **Resolva imports** para mapear símbolos a arquivos:
   - ESM: `import X from './foo'`, `import { Y } from './bar'`,
     `import * as Z from './baz'`, re-exports `export { X } from './foo'`,
     barrel files (`index.ts` que re-exporta tudo).
   - CJS: `const X = require('./foo')`, `const { Y } = require('./bar')`,
     `const Z = require('./baz').default`.
   - Aliases do `tsconfig.json` `paths` e `package.json` `imports` (`#internal/*`).
   - Workspaces de monorepo: `import { X } from '@org/pkg'` deve resolver
     para `packages/pkg/src/index.ts` (ou o `main`/`exports` do `package.json`
     daquele pacote).
   - **Não tente resolver pacotes em `node_modules`** — apenas marque a
     dependência como externa e ignore para o grafo.

2. **Identifique dependências injetadas** (NestJS / inversify / awilix / typedi):
   - **Construtor injection (NestJS)**: parâmetros do construtor com tipo TS.
     `constructor(private readonly users: UsersService) {}`. Resolva o tipo
     `UsersService` via imports do arquivo. Modificadores `private`/`public`/
     `readonly` em parâmetros geram propriedades automaticamente.
   - `@Inject(TOKEN)` quando o tipo não é uma classe (interfaces, strings).
   - **inversify**: `@inject(TYPES.Foo)` em construtor.
   - **awilix**: parâmetros nomeados resolvidos por container (`({ userService }) => ...`).
   - **typedi**: `@Service()` + `Container.get(...)`.

3. **Identifique invocações** dentro de cada função/método:
   - Em campos injetados: `this.users.findById(...)` →
     edge `CurrentClass#thisMethod → UsersService#findById`.
   - Em símbolos importados:
     - Função/módulo importado: `userService.findById(...)` quando
       `userService` é importado.
     - Default export chamado: `findById(...)` se `findById` foi importado por nome.
   - **Self-calls**: `this.helper(...)` ou chamada a função do mesmo arquivo
     deve gerar edge interno. Sem isso a BFS dá dead-end em delegações.
   - **Method-references**: `arr.map(this.transform)`,
     `arr.forEach(svc.process)` — capture `obj.method` mesmo sem `()` quando
     for argumento de função.

4. Construa o grafo dirigido `Origem#metodo → Destino#metodo`.

5. Para cada entry point, faça BFS de profundidade máxima 6 e extraia o
   subgrafo do fluxo.

Parsing leve via regex/scan linha-a-linha é aceitável — não precisa de AST
completo. Se quiser, pode usar `esprima`/`acorn`/`@typescript-eslint/parser`,
mas só se conseguir invocá-los **sem `npm install` no projeto-alvo** (ex.:
binários globais do usuário). Caso contrário, fique em regex + heurística.

**Pitfalls confirmados na prática** que seu gerador deve evitar:

- **Não zere strings antes de parsear decoradores e chamadas de rota.** Se
  você fizer `strip_comments_and_strings` em sequência, perde os argumentos
  de `@Get('/api/users')` ou `app.get('/api/users', ...)`. Mantenha duas
  variantes do fonte: uma com comentários removidos (para parsing
  estrutural e de decoradores) e outra adicionalmente com strings zeradas
  (apenas para detecção de invocações dentro de bodies de função).
- **Template literals com expressões** (`` `/users/${id}` ``) podem aparecer
  em paths — preserve-os literais no label e marque como dinâmico.
- **Aceite invocações multi-linha**:
  ```
  this.userService
    .findById(id)
    .then(...)
  ```
  Use algo como `\b(?:this\s*\.\s*)?(\w+)\s*\.\s*(\w+)\s*\(` permitindo
  whitespace e quebra de linha em volta do `.`.
- **Encadeamento longo**: `userService.findById(id).then(u => mailer.send(u))`
  produz duas chamadas relevantes (`findById`, `send`); ambas devem virar
  edges.
- **Optional chaining** (`obj?.method?.()`) deve ser detectado da mesma
  forma que chamadas normais.
- **Async/await** não muda a topologia: `await this.users.findById(id)`
  é exatamente uma chamada `users.findById`.
- **Desestruturação na importação**: `const { findById } = require('./svc')`
  ou `import { findById } from './svc'` — `findById(...)` no body deve
  resolver para `./svc::findById`.
- **Default export ambíguo**: `import users from './users'` pode ser
  classe, função, ou objeto. Faça best-effort: olhe a forma de uso
  (`users.findById` → trate como objeto/instância; `users(req, res)` →
  trate como função-handler).
- **Resolva constantes string/number** dentro do mesmo arquivo (ex.:
  `const QUEUE = 'orders'` usado em `new Worker(QUEUE, ...)` deve aparecer
  como label `orders`).
- **Dedup edges**: o mesmo método pode chamar o mesmo target em várias
  linhas; mantenha uma aresta única na visualização e capture todas as
  linhas no painel de detalhes.
- **Re-exports / barrel files**: `export * from './user.service'` em
  `index.ts` significa que `import { UsersService } from './users'` deve
  resolver para `./users/user.service.ts`. Sem isso, metade dos imports
  fica não-resolvida em projetos NestJS típicos.
- **Type-only imports** (`import type { X } from './...'`) **não geram
  edges em runtime** — ignore-os no grafo (mas pode usá-los para tipagem
  de DI).

Classifique cada módulo/classe por stereotype: `controller`, `service`,
`repository`, `module` (NestJS `@Module`), `gateway` (WebSocket),
`middleware`, `guard`, `interceptor`, `pipe`, `filter`/`exception-filter`,
`resolver` (GraphQL), `entity`/`schema`/`model`, `dto`, `command` (CLI),
`handler` (Lambda/event), `migration`, `config`, `util`, `other`.

Use heurísticas combinadas:
- Decoradores (`@Controller`, `@Service`/`@Injectable`, `@Resolver`,
  `@WebSocketGateway`, `@Catch`, etc.).
- Sufixo de nome (`*Controller`, `*Service`, `*Repository`, `*Resolver`,
  `*Gateway`, `*Middleware`, `*Guard`, `*Pipe`, `*Filter`, `*Module`,
  `*Dto`, `*Entity`, `*Schema`, `*Model`).
- Localização (`controllers/`, `services/`, `repositories/`, `entities/`,
  `dtos/`, `middlewares/`, `guards/`, `resolvers/`).

Para **entity/schema** especificamente, detecte:
- **TypeORM**: `@Entity()` em classe, `@Column`, `@PrimaryGeneratedColumn`,
  `@OneToMany`, `@ManyToOne`, `@ManyToMany`, `@OneToOne`, `@JoinColumn`,
  `@JoinTable`.
- **Mongoose**: `new Schema({ ... })`, `mongoose.model('Name', schema)`.
  Também `@Schema()`, `@Prop()` do `@nestjs/mongoose`.
- **Sequelize**: classes com `Model.init({ ... })` ou `@Table` + `@Column`
  do `sequelize-typescript`.
- **Prisma**: parseie `prisma/schema.prisma` separadamente — extraia
  `model X { ... }` e suas relações. Não há classe TS correspondente; trate
  como entidade pura referenciada por nome.
- **MikroORM**: `@Entity()`, `@Property`, `@OneToMany`, etc.
- **Objection.js**: classes estendendo `Model` com `static get tableName`,
  `static get relationMappings`.

Registre limitações conhecidas no README (resolução dinâmica via
container, `require(variableString)`, monkey-patching, eventos via
`EventEmitter` arbitrário, middlewares anônimos inline, tipos genéricos,
proxies, decorators custom não-padrão, plugins de framework com
side-effects).

## Etapa 4 — Estrutura dos dados

**`data/overview.json`** (alimenta a home page)
```json
{
  "project": {
    "name": "nome detectado do package.json",
    "description": "description do package.json ou primeiras linhas do README",
    "packageManager": "npm|yarn|pnpm|bun|unknown",
    "language": "typescript|javascript|mixed",
    "moduleSystem": "esm|cjs|mixed",
    "nodeVersion": "20|18|16|unknown",
    "frameworks": ["nestjs", "express"],
    "monorepo": { "tool": "pnpm-workspaces|nx|turbo|lerna|none",
                  "packages": ["apps/api", "packages/shared"] }
  },
  "stats": {
    "files": 0,
    "modules": 0,
    "entryPoints": { "http": 0, "scheduled": 0, "messaging": 0,
                     "websocket": 0, "cli": 0, "graphql": 0, "grpc": 0,
                     "other": 0 },
    "edges": 0,
    "entities": 0,
    "repositories": 0,
    "services": 0,
    "controllers": 0,
    "resolvers": 0,
    "gateways": 0
  },
  "mainAreas": [
    {
      "name": "users",
      "summary": "agrupamento por prefixo /api/users/* ou por subpasta src/users",
      "entryPointCount": 12,
      "controllers": ["src/users/users.controller.ts::UsersController"],
      "domainEntities": ["src/users/user.entity.ts::User"]
    }
  ],
  "domainEntities": [
    {
      "id": "src/users/user.entity.ts::User",
      "name": "User",
      "file": "src/users/user.entity.ts",
      "tableOrCollection": "users",
      "orm": "typeorm|mongoose|sequelize|prisma|mikroorm|objection",
      "fields": [
        { "name": "id", "type": "number", "annotations": ["@PrimaryGeneratedColumn"] }
      ],
      "relationships": [
        { "kind": "OneToMany", "field": "orders",
          "target": "src/orders/order.entity.ts::Order" }
      ],
      "repository": "src/users/users.repository.ts::UsersRepository"
    }
  ]
}
```

Heurísticas para o overview:
- **mainAreas**: agrupe entry points HTTP por primeiro segmento de path
  (`/api/users/...` → `users`); como fallback, agrupe pela primeira pasta
  abaixo do root de fonte (`src/users/*`). Para NestJS, considere também
  o nome do `@Module`. Liste até 12 áreas, ordenadas por número de entry
  points decrescente.
- **domainEntities**: classes com decorador de ORM ou modelos Prisma. Para
  cada entity, tente parear com seu repositório/serviço via convenção de
  nome (`User` → `UsersRepository`, `UsersService`).
- **repository** em Node muitas vezes é só uma classe `*Service` que usa
  diretamente `@InjectRepository(User)` ou Prisma client. Conte como
  repository quando houver injeção explícita de repositório, e como service
  caso contrário.

**`data/manifest.json`**
```json
{
  "generatedAt": "ISO timestamp",
  "stats": { "entryPoints": 0, "modules": 0, "edges": 0,
             "byType": { "http": 0, "scheduled": 0 } },
  "entryPoints": [
    { "id": "ep-1", "type": "http",
      "label": "GET /api/orders/:id",
      "moduleId": "src/orders/orders.controller.ts::OrdersController",
      "handler": "getOrder",
      "file": "src/orders/orders.controller.ts", "line": 42,
      "details": { "verb": "GET", "path": "/api/orders/:id",
                   "framework": "nestjs" } }
  ],
  "entrySubgraphs": {
    "ep-1": { "nodes": [...], "edges": [...] }
  },
  "modules": [
    { "id": "src/orders/orders.service.ts::OrdersService",
      "name": "OrdersService",
      "file": "src/orders/orders.service.ts",
      "package": "src/orders",
      "stereotype": "service",
      "kind": "class",
      "exportName": "OrdersService",
      "isDefault": false }
  ],
  "edges": [
    { "from": "src/orders/orders.controller.ts::OrdersController#getOrder",
      "to": "src/orders/orders.service.ts::OrdersService#findById",
      "fromModule": "...", "toModule": "...",
      "fromMethod": "getOrder", "toMethod": "findById",
      "fromFile": "...", "toFile": "...", "line": 42 }
  ]
}
```

**`data/modules/<id>.json`** (lazy)
- Lista de métodos/funções exportadas (assinatura + linha + decoradores).
- Dependências injetadas / imports relevantes (símbolo → arquivo de origem).
- Callers e callees agregados por método.
- Decoradores de classe / metadados de módulo (NestJS `@Module` providers/imports/exports).

> O `id` no nome do arquivo deve ser sanitizado (substitua `/`, `:` por `_`).
> Limite o tamanho por JSON. Se uma classe tiver mais de ~30 métodos, inclua
> apenas os que têm callers/callees ou decoradores relevantes; reporte
> `totalMethods` vs `methodsShown` no JSON.

## Etapa 5 — Página inicial (overview)

`index.html` é o ponto de entrada. Deve ser **enxuto**, focado em dar ao
leitor uma ideia rápida do projeto antes de mergulhar no grafo. Contém:

1. **Cabeçalho**: nome do projeto, framework(s) detectado(s), linguagem
   (TS/JS), versão Node, sistema de módulos.
2. **Descrição curta** (do `package.json`/README/inferida).
3. **Cards de estatísticas** (uma linha): módulos, entry points (por
   tipo), edges, entidades de domínio.
4. **Principais áreas/módulos**: cards/lista mostrando cada `mainArea`
   com nome, contagem de entry points e controllers principais. Clicar em
   uma área leva ao `explorer.html` com filtro pré-aplicado.
5. **Entidades de domínio**: tabela ou grid lateral listando as
   entidades ORM identificadas — nome, arquivo, ORM, repositório
   associado, número de relacionamentos. Clicar leva ao explorer com a
   classe selecionada.
6. **Indicador de monorepo** (se aplicável): liste os pacotes detectados
   com contagem de entry points por pacote.
7. **Botão "Explorar fluxos"** que abre `explorer.html`.
8. **Aviso explícito** de que o mapa é heurístico e link para a seção de
   limitações no `README.md`.

Mantenha a página em uma única coluna, sem grafo, sem dependências de
Cytoscape — só Tailwind via CDN e vanilla JS para hidratar o
`overview.json`. Dark mode opcional, herdado do system preference.

## Etapa 6 — Viewer (explorer.html)

HTML + Tailwind via CDN + vanilla JS. Grafos com **Cytoscape.js via CDN**
(layout `dagre` para fluxos individuais, `cose` para grafo agregado).

Telas:

- **Sidebar esquerda**: entry points agrupados por tipo, com filtro de
  texto e chips para alternar tipos visíveis.
- **Painel central**: ao clicar em um entry point, renderiza o grafo do
  fluxo (BFS até depth ajustável, default 6). Nós coloridos por stereotype.
- **Painel direito**: ao clicar em um nó, mostra detalhes do módulo
  (decoradores/anotações, dependências injetadas, método selecionado,
  callers, callees, link para o arquivo fonte).
- **Busca global** no topo: endpoints, módulos, métodos, entidades.
- **Filtros**: por tipo de entry point, por pasta/pacote, por stereotype,
  por framework (útil em apps multi-framework).
- **Modo "grafo completo"**: visão agregada por módulo (não por método)
  filtrável. Útil para enxergar acoplamento macro.
- **Link "← Visão geral"** que volta para `index.html`.

Dark mode opcional, loading states ao carregar JSON sob demanda. O
explorer aceita parâmetros via query string (`?area=users`,
`?entity=src/users/user.entity.ts::User`, `?entry=ep-12`) para deep-link
da home.

## Etapa 7 — Performance

- Se houver mais de ~500 módulos, mantenha um único `manifest.json`
  comprimido (sem indent) e quebre apenas em chunks se passar de ~3 MB.
- Nada de código-fonte completo no manifest — só caminhos e linhas. Se
  quiser preview de código, faça via fetch sob demanda do arquivo direto
  (o HTTP server serve a raiz do repositório). **Atenção**: alguns
  servidores não servem `.ts` por default — verifique o MIME type ou
  documente que o usuário precisa rodar `python -m http.server` que
  serve qualquer arquivo.
- Cada JSON de módulo deve idealmente ficar abaixo de 50 KB; para arquivos
  gigantes (`schema.prisma` ou modelos auto-gerados), aplique o filtro de
  Etapa 4 para reduzir.
- Layout `dagre` em mais de ~300 nós fica pesado — caia em `cose` no modo
  grafo completo.

## Etapa 8 — README (em `repoviewer/README.md`)

Conteúdo mínimo:

- Como rodar: `python -m http.server 8000` na raiz, acessar
  `http://localhost:8000/repoviewer/`.
- Como regenerar: `python repoviewer/generate.py`.
- Limitações do mapeamento heurístico:
  - Resolução de DI dinâmica (containers customizados, factories).
  - `require(variableString)` / `import(expression)` dinâmicos.
  - Plugins de framework com side-effects (Fastify plugins, Express
    middlewares anônimos).
  - Eventos via `EventEmitter` quando emissor/listener estão em arquivos
    desconectados.
  - Tipagem genérica (`Repository<User>`) — capturada como `Repository`
    apenas.
  - Decorators custom não-padrão.
  - Re-exports profundos via barrel files podem confundir resolução.
  - Code splitting / lazy modules (`import()` dinâmico).
  - Prisma: relações estão em `schema.prisma`, não em código TS.
- Glossário das cores/stereotypes no grafo.
- Para que serve a página inicial vs o explorer.

## Etapa 9 — Validação final

Antes de terminar, **valide concretamente** o resultado:

1. Reporte no chat:
   - Gerenciador de pacotes, linguagem dominante, sistema de módulos,
     framework(s), versão Node, monorepo (sim/não + pacotes).
   - Total de entry points por tipo.
   - Total de módulos mapeados.
   - Total de edges.
   - Número de entidades de domínio identificadas (e por ORM).
2. Inicie um HTTP server local (`python -m http.server`) e confirme
   que `http://localhost:<port>/repoviewer/` carrega `index.html` sem
   erros no console. Se você tiver acesso a um headless browser, abra
   e capture o console.
3. Clique em pelo menos um entry point com fluxo profundo (depth ≥ 3) e
   confirme que o grafo expande e os detalhes carregam.
4. Se algum dos números estiver claramente zerado quando não deveria
   (ex.: zero HTTP entry points num projeto NestJS claramente cheio de
   `@Controller`, ou zero edges num projeto com DI evidente), pare,
   investigue, e corrija o gerador antes de declarar concluído.
5. Sanity check de aliases: se o projeto tem `tsconfig.json` com `paths`
   e mais de ~20% dos imports ficaram não-resolvidos, o resolver de
   aliases provavelmente está quebrado — corrija.

## Restrições

- Zero modificação fora de `repoviewer/` (`.claude/launch.json` é
  opcional e permitido).
- Zero dependências adicionadas ao projeto Node (sem mexer em
  `package.json` / lockfiles).
- Zero execução de scripts do projeto (`npm install`, `npm run build`, etc.).
- Viewer 100% client-side, sem build step.
- Apenas CDNs públicas (Tailwind, Cytoscape, dagre).
- Gerador depende apenas da stdlib Python 3.8+.

## Resumo de boas práticas aprendidas

- Detecte shell antes; no Windows nunca rode scans grandes em cmd.exe.
- Separe "strip comments" de "strip strings" — decoradores e chamadas
  de rota guardam strings importantes (paths, queue names, cron exprs).
- Trate self-calls como arestas; sem isso BFS perde fluxos onde o
  controller delega internamente.
- Aceite invocações com `.` em outra linha e encadeamento longo.
- Resolva constantes string/number locais para mostrar cron/topic/path
  literais.
- Resolva aliases do `tsconfig.json` `paths` e workspaces de monorepo —
  sem isso a maioria dos imports fica não-resolvida.
- Type-only imports não geram edges; ignore no grafo.
- Limite o tamanho dos JSON por módulo — filtre métodos sem flow.
- Em projetos multi-framework (Express + NestJS, ou app + workers), o
  explorer precisa de filtro por framework.
- A página inicial é para orientar; o explorer é para investigar. Não
  misture.
