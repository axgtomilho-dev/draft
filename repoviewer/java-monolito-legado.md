# Tarefa: gerar visualizador de fluxos de um monolito Java

Você está na raiz de um repositório Java legado (monolito). Gere uma ferramenta estática que permite navegar visualmente pelos fluxos da aplicação, identificando pontos de entrada (estímulos) e mapeando relações entre classes. A ferramenta será servida via `python -m http.server` rodando na raiz.

## Saída
Crie uma pasta `repoviewer/` na raiz contendo:
- `index.html` — UI principal
- `app.js` — lógica do viewer
- `styles.css` — estilos (ou inline no HTML)
- `data/manifest.json` — índice leve (entry points, classes, edges)
- `data/classes/<fqn>.json` — detalhes por classe, carregados sob demanda
- `README.md` — instruções de uso e limitações

Não modifique nada fora de `repoviewer/`.

## Etapa 1 — Descoberta
Varra arquivos `.java`. **Exclua**:
- `src/test/`, `**/test/`, `**/tests/`
- `*Test.java`, `*Tests.java`, `*IT.java`, `*ITCase.java`
- `target/`, `build/`, `out/`, `.git/`, `.idea/`, `node_modules/`

## Etapa 2 — Pontos de entrada (estímulos)
Identifique e classifique:

**HTTP/REST**
- Spring: `@RestController`, `@Controller`, `@RequestMapping`, `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`
- JAX-RS: `@Path`, `@GET`, `@POST`, `@PUT`, `@DELETE`
- Servlets: `@WebServlet` ou `web.xml`

**Agendados**
- Spring: `@Scheduled` (capture cron/fixedRate/fixedDelay)
- Quartz: classes implementando `Job`

**Mensageria/Eventos**
- `@KafkaListener`, `@RabbitListener`, `@JmsListener`, `@SqsListener`, `@StreamListener`
- `MessageListener` (implementação)
- Spring Events: `@EventListener`, `ApplicationListener`

**Outros**
- WebSocket: `@MessageMapping`, `@SubscribeMapping`
- CLI: `CommandLineRunner`, `ApplicationRunner`, métodos `public static void main`
- gRPC: classes estendendo bases geradas

Para cada entry point capture: `type`, `label` (URL, topic, cron expr, etc.), `classFqn`, `method`, `file`, `line`, `details` (verbo HTTP, grupo de consumer, etc.).

## Etapa 3 — Mapeamento de fluxos (heurístico)
Para cada classe relevante:
1. Identifique dependências injetadas: `@Autowired` em campos, parâmetros de construtor com `final`, `@Inject`, `@Resource`.
2. Para cada método público/protegido, encontre invocações nos campos injetados (`this.servico.metodo(...)`, `servico.metodo(...)`).
3. Construa o grafo dirigido `ClasseA.metodo -> ClasseB.metodo`.
4. Para cada entry point, faça BFS de profundidade máxima 6 e extraia o subgrafo do fluxo.

Parsing leve via regex/scan linha-a-linha é aceitável — não precisa de AST completo. Registre limitações conhecidas no README (reflexão, proxies dinâmicos, herança/polimorfismo, eventos assíncronos).

Classifique cada classe por stereotype: `controller`, `service`, `repository`, `component`, `listener`, `scheduler`, `config`, `other` (via anotações `@Service`, `@Repository`, `@Component`, `@Configuration`).

## Etapa 4 — Estrutura dos dados

**`data/manifest.json`**
```json
{
  "generatedAt": "ISO timestamp",
  "stats": { "entryPoints": 0, "classes": 0, "edges": 0 },
  "entryPoints": [
    { "id": "ep-1", "type": "http|scheduled|messaging|cli|websocket|other",
      "label": "GET /api/orders/{id}", "classFqn": "com.x.OrderController",
      "method": "getOrder", "file": "src/main/.../OrderController.java",
      "line": 42, "details": {} }
  ],
  "classes": [
    { "fqn": "com.x.OrderService", "name": "OrderService", "package": "com.x",
      "file": "...", "stereotype": "service" }
  ],
  "edges": [
    { "from": "com.x.OrderController#getOrder",
      "to": "com.x.OrderService#findById",
      "fromFile": "...", "toFile": "..." }
  ]
}
```

**`data/classes/<fqn>.json`** (lazy)
- Lista de métodos (assinatura + linha)
- Imports/dependências injetadas
- Callers e callees agregados
- Anotações relevantes

## Etapa 5 — Viewer (UI)
HTML + Tailwind via CDN + vanilla JS. Grafos com **Cytoscape.js via CDN** (layout `dagre` ou `cose-bilkent`).

Telas:
- **Sidebar esquerda**: entry points agrupados por tipo, cada um com seu identificador.
- **Painel central**: ao clicar em um entry point, renderiza o grafo do fluxo. Nós coloridos por stereotype.
- **Painel direito**: ao clicar em um nó, mostra detalhes (arquivo, linha, callers, callees, anotações).
- **Busca global** no topo: endpoints, classes, métodos.
- **Filtros**: por tipo de entry point, por package, por stereotype.
- **Modo "grafo completo"**: visão agregada filtrável.

Dark mode opcional, loading states ao carregar JSON sob demanda.

## Etapa 6 — Performance
- Se houver mais de ~500 classes, quebre o manifest em chunks por package.
- Nada de código-fonte completo no manifest — só caminhos e linhas. Se quiser preview de código, faça via fetch sob demanda do arquivo `.java` direto (mesmo HTTP server serve a raiz).
- Cada JSON de classe < 50KB.

## Etapa 7 — README (em `repoviewer/README.md`)
- Como rodar: `python -m http.server 8000` na raiz, acessar `http://localhost:8000/repoviewer/`
- Como regenerar: rodar este prompt novamente
- Limitações do mapeamento heurístico (reflexão, AOP, herança, eventos)
- Glossário das cores/stereotypes no grafo

## Etapa 8 — Validação final
Antes de terminar, reporte no chat:
- Total de entry points por tipo
- Total de classes mapeadas
- Total de edges
- Confirme que abrir `http://localhost:8000/repoviewer/` funciona

## Restrições
- Zero modificação fora de `repoviewer/`
- Zero dependência adicionada ao projeto Java
- Viewer 100% client-side, sem build step
- Apenas CDNs públicas (Cytoscape, dagre layout, Tailwind)
