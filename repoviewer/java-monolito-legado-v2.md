# Tarefa: gerar visualizador de fluxos de um monolito Java

Você está na raiz de um repositório Java legado (monolito) qualquer — não
assuma stack específica além de "código Java compilável com Maven ou Gradle".
Gere uma ferramenta **estática, client-side, sem build step** que permite
navegar visualmente pelos fluxos da aplicação, identificando pontos de entrada
(estímulos) e mapeando relações entre classes. A ferramenta será servida via
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

## Saída

Crie uma pasta `repoviewer/` na raiz contendo:

- `generate.py` — gerador (scanner Java) em Python.
- `index.html` — **página inicial** com overview do repositório (ver Etapa 6).
- `explorer.html` — visualizador principal de entry points / grafo de fluxos.
- `app.js` — lógica do explorer.
- `styles.css` — estilos compartilhados.
- `data/overview.json` — dados resumidos do projeto (nome, descrição, módulos,
  entidades de domínio, estatísticas).
- `data/manifest.json` — índice de entry points / classes / edges.
- `data/classes/<fqn>.json` — detalhes por classe, carregados sob demanda.
- `README.md` — instruções de uso, regeneração e limitações.

**Não modifique nada fora de `repoviewer/`** (com exceção opcional de criar
`.claude/launch.json` se você for usar a Preview do Claude Code para validar).

## Etapa 1 — Descoberta

Detecte automaticamente:

- **Build tool**: presença de `pom.xml` (Maven), `build.gradle`/`build.gradle.kts`
  (Gradle), ou `settings.gradle*` (multi-module Gradle).
- Versão do java
- **Diretórios fonte**: padrão é `src/main/java`, mas em multi-módulo pode
  haver `<modulo>/src/main/java`. Inclua **todos**.
- **Nome e descrição** do projeto: tente extrair de
  `<artifactId>` + `<description>` no `pom.xml` raiz, ou `rootProject.name` +
  README, ou nome do diretório como fallback.

Varra arquivos `.java` em todos os roots de fonte. **Exclua**:

- `src/test/**`, `**/test/**`, `**/tests/**`, `**/it/**`
- `*Test.java`, `*Tests.java`, `*IT.java`, `*ITCase.java`, `*ITTest.java`
- `target/`, `build/`, `out/`, `bin/`, `.git/`, `.idea/`, `.gradle/`,
  `node_modules/`, `generated-sources/`, `generated/`

Se o projeto tiver classes geradas por plugin (`@Generated`, `protobuf`,
`jOOQ`, `MapStruct`, `Lombok @Builder` em código compilado), elas geralmente
estão sob `target/generated-sources/` e já são excluídas. Caso apareçam no
fonte (raro), o gerador deve tolerá-las — não pode falhar.

## Etapa 2 — Pontos de entrada (estímulos)

Identifique e classifique:

**HTTP/REST**
- Spring: `@RestController`, `@Controller`, `@RequestMapping`, `@GetMapping`,
  `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`.
  Suporte tanto a forma positional (`@GetMapping("/x")`) quanto nomeada
  (`@GetMapping(path = "/x", method = RequestMethod.GET)`).
- JAX-RS: `@Path`, `@GET`, `@POST`, `@PUT`, `@DELETE`, `@HEAD`, `@OPTIONS`.
- Servlets: `@WebServlet` ou `web.xml`.
- Micronaut/Quarkus: `@Controller`, `@Get`, `@Post`, etc.

**Agendados**
- Spring: `@Scheduled` (capture `cron`, `fixedRate`, `fixedDelay`).
  **Resolva referências a constantes** (`@Scheduled(cron = MY_CRON)` onde
  `MY_CRON` é `static final String` na mesma classe).
- Quartz: classes implementando `Job` / `StatefulJob`.
- JobRunr/Camel: anotações específicas.

**Mensageria/Eventos**
- `@KafkaListener`, `@RabbitListener`, `@JmsListener`, `@SqsListener`,
  `@StreamListener`, `@SendTo`.
- Implementações de `MessageListener`.
- Spring Events: `@EventListener`, `ApplicationListener`.
- AWS Lambda: classes implementando `RequestHandler<I, O>`.

**Outros**
- WebSocket: `@MessageMapping`, `@SubscribeMapping`,
  `@OnOpen`/`@OnMessage` (JSR-356).
- CLI: `CommandLineRunner`, `ApplicationRunner`, métodos
  `public static void main`.
- gRPC: classes estendendo bases geradas (`*ImplBase`).
- GraphQL: `@QueryMapping`, `@MutationMapping`, `@SchemaMapping`,
  `@DgsQuery`, `@DgsMutation`.

Para cada entry point capture: `type`, `label` (URL completa, topic, cron
expr, etc.), `classFqn`, `method`, `file`, `line`, `details` (verbo HTTP,
consumer group, payload type, etc.).

## Etapa 3 — Mapeamento de fluxos (heurístico)

Para cada classe relevante:

1. Identifique dependências injetadas:
   - `@Autowired` em campos.
   - **Construtor injection**: parâmetros do construtor (com ou sem `final`).
     Resolva o nome do campo via `this.fieldName = paramName`.
   - `@Inject` (JSR-330), `@Resource` (JSR-250), `@RequiredArgsConstructor`
     (Lombok — todos os `final` viram parâmetros do construtor gerado).
   - Setter injection (`@Autowired` em `setX(...)`).
2. Para cada método público/protegido, encontre invocações em campos
   injetados (`this.servico.metodo(...)`, `servico.metodo(...)`).
3. **Adicione edges para self-calls**: quando um método chama outro método
   da própria classe (ex.: controller delegando para método privado), trate
   como aresta `Class#m1 → Class#m2`. Sem isso a BFS dá dead-end em
   delegações internas.
4. Construa o grafo dirigido `ClasseA#metodo → ClasseB#metodo`.
5. Para cada entry point, faça BFS de profundidade máxima 6 e extraia o
   subgrafo do fluxo.

Parsing leve via regex/scan linha-a-linha é aceitável — não precisa de AST
completo. **Pitfalls confirmados na prática** que seu gerador deve evitar:

- **Não zere strings antes de parsear anotações.** Se você fizer
  `strip_comments_and_strings` em sequência, perde os argumentos de
  `@RequestMapping("/api")` → vira `@RequestMapping(    )`. Mantenha
  duas variantes do fonte: uma com comentários removidos (para parsing
  estrutural e de anotações) e outra adicionalmente com strings zeradas
  (apenas para detecção de invocações dentro de bodies).
- **Aceite invocações multi-linha.** A regex de invocação deve permitir
  whitespace em volta do `.`:
  ```
  customService\n    .findById(...)
  ```
  Use algo como `\b(?:this\s*\.\s*)?(\w+)\s*\.\s*(\w+)\s*\(`.
- **Resolva constantes `static final String/long/int`** dentro da própria
  classe para que cron expressions, topics e paths apareçam literais no
  label do entry point.
- **Dedup edges**: o mesmo método pode chamar o mesmo target em várias
  linhas; mantenha uma aresta única na visualização e capture todas as
  linhas no painel de detalhes.
- **Method-references** (`list.forEach(svc::foo)`) são úteis e simples de
  capturar: regex `\b(\w+)::(\w+)`.

Classifique cada classe por stereotype: `controller`, `service`,
`repository`, `component`, `listener`, `scheduler`, `config`, `entity`,
`dto`, `other`. Use heurísticas combinadas (anotação `@Service`,
`@Repository`, etc. + nome — `*Service`, `*Repository`, `*Resource`,
`*Controller`, `*Scheduled`, `*Listener`).

Para **entity** especificamente, detecte:
- `@Entity` (JPA), `@Document` (Mongo/Spring Data),
  `@Table` (JPA — geralmente acompanha `@Entity`).

Registre limitações conhecidas no README (reflexão, proxies dinâmicos,
herança/polimorfismo, eventos assíncronos, AOP).

## Etapa 4 — Estrutura dos dados

**`data/overview.json`** (novo — alimenta a home page)
```json
{
  "project": {
    "name": "nome detectado do pom/gradle",
    "description": "descrição do pom/gradle ou primeiras linhas do README",
    "buildTool": "maven|gradle|unknown",
    "javaVersion": "17|11|8|unknown",
    "modules": ["modulo-a", "modulo-b"]
  },
  "stats": {
    "files": 0,
    "classes": 0,
    "entryPoints": { "http": 0, "scheduled": 0, "messaging": 0, "cli": 0,
                     "websocket": 0, "other": 0 },
    "edges": 0,
    "entities": 0,
    "repositories": 0,
    "services": 0,
    "controllers": 0
  },
  "mainAreas": [
    {
      "name": "users",
      "summary": "agrupamento inferido por prefixo de path /api/users/* ou por subpacote",
      "entryPointCount": 12,
      "controllers": ["com.x.UserResource"],
      "domainEntities": ["com.x.domain.User"]
    }
  ],
  "domainEntities": [
    {
      "fqn": "com.x.domain.User",
      "name": "User",
      "file": "src/main/java/com/x/domain/User.java",
      "tableName": "users",
      "package": "com.x.domain",
      "fields": [
        { "name": "id", "type": "Long", "annotations": ["@Id"] }
      ],
      "relationships": [
        { "kind": "OneToMany", "field": "orders", "target": "com.x.domain.Order" }
      ],
      "repository": "com.x.repository.UserRepository"
    }
  ]
}
```

Heurísticas para o overview:
- **mainAreas**: agrupe entry points HTTP por primeiro segmento de path
  (`/api/users/...` → `users`); como fallback, agrupe por subpacote
  (`com.x.users.*`). Liste até 12 áreas, ordenadas por número de entry
  points decrescente.
- **domainEntities**: classes `@Entity`/`@Document`. Capture
  `@Column`, `@Id`, `@OneToMany`, `@ManyToOne`, `@ManyToMany`,
  `@OneToOne`, `@JoinColumn`. Para cada entity, tente parear com seu
  `*Repository` via convenção de nome (`User` → `UserRepository`).

**`data/manifest.json`**
```json
{
  "generatedAt": "ISO timestamp",
  "stats": { "entryPoints": 0, "classes": 0, "edges": 0,
             "byType": { "http": 0, "scheduled": 0 } },
  "entryPoints": [
    { "id": "ep-1", "type": "http",
      "label": "GET /api/orders/{id}",
      "classFqn": "com.x.OrderController", "method": "getOrder",
      "file": "src/main/.../OrderController.java", "line": 42,
      "details": { "verb": "GET", "path": "/api/orders/{id}" } }
  ],
  "entrySubgraphs": {
    "ep-1": { "nodes": [...], "edges": [...] }
  },
  "classes": [
    { "fqn": "com.x.OrderService", "name": "OrderService",
      "package": "com.x", "file": "...", "stereotype": "service",
      "typeKind": "class" }
  ],
  "edges": [
    { "from": "com.x.OrderController#getOrder",
      "to": "com.x.OrderService#findById",
      "fromFqn": "...", "toFqn": "...",
      "fromMethod": "...", "toMethod": "...",
      "fromFile": "...", "toFile": "...", "line": 42 }
  ]
}
```

**`data/classes/<fqn>.json`** (lazy)
- Lista de métodos (assinatura + linha + anotações).
- Dependências injetadas (campo → tipo FQN).
- Callers e callees agregados por método.
- Anotações de classe.

> Limite o tamanho por JSON de classe. Se uma classe tiver mais de ~30
> métodos, inclua apenas os que têm callers/callees ou anotações
> relevantes; reporte `totalMethods` vs `methodsShown` no JSON.

## Etapa 5 — Página inicial (overview)

`index.html` é o ponto de entrada. Deve ser **enxuto**, focado em dar ao
leitor uma ideia rápida do projeto antes de mergulhar no grafo. Contém:

1. **Cabeçalho**: nome do projeto, build tool detectada, versão Java.
2. **Descrição curta** (do `pom.xml`/README/inferida).
3. **Cards de estatísticas** (uma linha): classes, entry points (por
   tipo), edges, entidades de domínio.
4. **Principais áreas/módulos**: cards/lista mostrando cada `mainArea`
   com nome, contagem de entry points e controllers principais. Clicar em
   uma área leva ao `explorer.html` com filtro pré-aplicado.
5. **Entidades de domínio**: tabela ou grid lateral listando as
   entidades JPA/Mongo identificadas — nome, package, repositório
   associado, número de relacionamentos. Clicar leva ao explorer com a
   classe selecionada.
6. **Botão "Explorar fluxos"** que abre `explorer.html`.
7. **Aviso explícito** de que o mapa é heurístico e link para a seção de
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
- **Painel direito**: ao clicar em um nó, mostra detalhes da classe
  (anotações, dependências injetadas, método selecionado, callers,
  callees, link para o `.java`).
- **Busca global** no topo: endpoints, classes, métodos, entidades.
- **Filtros**: por tipo de entry point, por package, por stereotype.
- **Modo "grafo completo"**: visão agregada por classe (não por método)
  filtrável. Útil para enxergar acoplamento macro.
- **Link "← Visão geral"** que volta para `index.html`.

Dark mode opcional, loading states ao carregar JSON sob demanda. O
explorer aceita parâmetros via query string (`?area=users`,
`?entity=com.x.domain.User`, `?entry=ep-12`) para deep-link da home.

## Etapa 7 — Performance

- Se houver mais de ~500 classes, mantenha um único `manifest.json`
  comprimido (sem indent) e quebre apenas em chunks se passar de ~3 MB.
- Nada de código-fonte completo no manifest — só caminhos e linhas. Se
  quiser preview de código, faça via fetch sob demanda do arquivo `.java`
  direto (o HTTP server serve a raiz do repositório).
- Cada JSON de classe deve idealmente ficar abaixo de 50 KB; para classes
  protobuf/auto-geradas que estoure, aplique o filtro de `Etapa 4` para
  reduzir.
- Layout `dagre` em mais de ~300 nós fica pesado — caia em `cose` no modo
  grafo completo.

## Etapa 8 — README (em `repoviewer/README.md`)

Conteúdo mínimo:

- Como rodar: `python -m http.server 8000` na raiz, acessar
  `http://localhost:8000/repoviewer/`.
- Como regenerar: `python repoviewer/generate.py` (ou comando equivalente
  se você optou por outra runtime).
- Limitações do mapeamento heurístico (reflexão, AOP, herança, eventos
  assíncronos, lambdas com captura de variável local, builders
  fluentes).
- Glossário das cores/stereotypes no grafo.
- Para que serve a página inicial vs o explorer.

## Etapa 9 — Validação final

Antes de terminar, **valide concretamente** o resultado:

1. Reporte no chat:
   - Build tool detectada, versão Java, número de módulos.
   - Total de entry points por tipo.
   - Total de classes mapeadas.
   - Total de edges.
   - Número de entidades de domínio identificadas.
2. Inicie um HTTP server local (`python -m http.server`) e confirme
   que `http://localhost:<port>/repoviewer/` carrega `index.html` sem
   erros no console. Se você tiver acesso a um headless browser, abra
   e capture o console.
3. Clique em pelo menos um entry point com fluxo profundo (depth ≥ 3) e
   confirme que o grafo expande e os detalhes carregam.
4. Se algum dos números estiver claramente zerado quando não deveria
   (ex.: zero HTTP entry points num repo Spring claramente cheio de
   controllers), pare, investigue, e corrija o gerador antes de
   declarar concluído.

## Restrições

- Zero modificação fora de `repoviewer/` (`.claude/launch.json` é
  opcional e permitido).
- Zero dependências adicionadas ao projeto Java (sem mexer em `pom.xml`/
  `build.gradle`).
- Viewer 100% client-side, sem build step.
- Apenas CDNs públicas (Tailwind, Cytoscape, dagre).
- Gerador depende apenas da stdlib Python 3.8+.

## Resumo de boas práticas aprendidas

- Detecte shell antes; no Windows nunca rode scans grandes em cmd.exe.
- Separe "strip comments" de "strip strings" — anotações guardam strings
  importantes.
- Trate self-calls como arestas; sem isso BFS perde fluxos onde o
  controller delega internamente.
- Aceite invocações com `.` em outra linha.
- Resolva constantes para mostrar cron/topic literais.
- Limite o tamanho dos JSON por classe — filtre métodos sem flow.
- A página inicial é para orientar; o explorer é para investigar. Não
  misture.
