
``` javascript
datadog-log-scout/
├── package.json
├── .env
├── src/
│   ├── config.js
│   ├── datadogClient.js
│   └── main.js


---

package.json

{
  "name": "datadog-log-scout",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/main.js"
  },
  "dependencies": {
    "axios": "^1.7.0",
    "dotenv": "^16.4.0",
    "fs-extra": "^11.2.0"
  }
}


---

.env

DD_SITE=datadoghq.com
DD_API_KEY=your_api_key
DD_APP_KEY=your_app_key
CLIENT_USER_ID=775255555278836
FROM=2025-10-06T00:00:00Z
TO=2025-10-09T23:59:59Z
ERROR_QUERY=status:error


---

src/config.js

import dotenv from "dotenv";
dotenv.config();

export default {
  site: process.env.DD_SITE,
  apiKey: process.env.DD_API_KEY,
  appKey: process.env.DD_APP_KEY,
  clientUserId: process.env.CLIENT_USER_ID,
  from: process.env.FROM,
  to: process.env.TO,
  errorQuery: process.env.ERROR_QUERY || "status:error",
  outDir: "./out-logs"
};


---

src/datadogClient.js

import axios from "axios";

export class DatadogClient {
  constructor({ site, apiKey, appKey }) {
    this.baseUrl = `https://api.${site}/api/v2/logs/events/search`;
    this.headers = {
      "Content-Type": "application/json",
      "DD-API-KEY": apiKey,
      "DD-APPLICATION-KEY": appKey
    };
  }

  async fetchAll(query, from, to) {
    let all = [];
    let cursor = null;
    do {
      const body = {
        filter: { from, to, query },
        page: { limit: 1000, cursor }
      };
      const { data } = await axios.post(this.baseUrl, body, { headers: this.headers });
      if (Array.isArray(data.data)) all.push(...data.data);
      cursor = data?.meta?.page?.after || null;
    } while (cursor);
    return all;
  }
}


---

src/main.js

import fs from "fs-extra";
import config from "./config.js";
import { DatadogClient } from "./datadogClient.js";

const dd = new DatadogClient(config);

(async () => {
  await fs.ensureDir(config.outDir);

  const baseQuery = `*:${config.clientUserId} ${config.errorQuery}`;
  const errorLogs = await dd.fetchAll(baseQuery, config.from, config.to);

  const correlationIds = [
    ...new Set(
      errorLogs
        .map(l => l?.attributes?.attributes?.correlationId)
        .filter(Boolean)
    )
  ];

  const pendingLogs = [];
  for (const cid of correlationIds) {
    const q = `@correlationId:${cid} @input.proposal.mediationStatus:PENDING`;
    const logs = await dd.fetchAll(q, config.from, config.to);
    for (const log of logs) {
      const id = log.id || Date.now().toString();
      await fs.writeJson(`${config.outDir}/${id}.json`, log, { spaces: 2 });
      pendingLogs.push(log);
    }
  }

  if (pendingLogs.length > 0) {
    const ndjson = pendingLogs.map(l => JSON.stringify(l)).join("\n");
    await fs.writeFile(`${config.outDir}/pending-logs.ndjson`, ndjson);
  }

  console.log(`✅ Finalizado. ${pendingLogs.length} logs PENDING salvos em ${config.outDir}`);
})();
```


--


Sim — dá pra automatizar tudo isso via Logs Search API do Datadog, sem tocar em Pipelines. A ideia é transformar seu passo-a-passo manual num pequeno “scout” que:

1. Busca por clientUserId dentro de uma janela de tempo.


2. Filtra os logs com erro e extrai todos os correlationId distintos.


3. Para cada correlationId, roda nova busca (@correlationId:<id>) e filtra por @input.proposal.mediationStatus:PENDING.


4. Salva o JSON completo de cada log elegível (um arquivo por evento + um NDJSON agregando tudo).



A API v2 permite exatamente isso (com paginação por cursor) e funciona com DD-API-KEY + DD-APPLICATION-KEY. Exemplos de corpo/headers e paginação estão na doc oficial. 


---

Opção A — utilitário Java 11 / Spring Boot 2.7 (CLI)

Sem dependências externas além do que o Spring já traz (Jackson). Usa java.net.http.HttpClient.

Como usar

Variáveis de ambiente:

DD_SITE (ex.: datadoghq.com, datadoghq.eu, ddog-gov.com)

DD_API_KEY

DD_APP_KEY


Parâmetros:

--clientUserId=775255555278836

--from=2025-10-06T00:00:00Z

--to=2025-10-09T23:59:59Z

(opcional) --queryError=status:error ou o que você considerar “erro”



Cria arquivos em ./out-logs/.

package com.example.ddlogscout;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.boot.*;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.io.IOException;
import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

@SpringBootApplication
public class DdLogScoutApp implements CommandLineRunner {

    private static final String SEARCH_PATH = "/api/v2/logs/events/search";
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(20)).build();
    private final ObjectMapper om = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    public static void main(String[] args) { SpringApplication.run(DdLogScoutApp.class, args); }

    @Override public void run(String... args) throws Exception {
        Map<String, String> params = parseArgs(args);
        String clientUserId = required(params, "clientUserId");
        String from = required(params, "from");
        String to = required(params, "to");
        String errorQuery = params.getOrDefault("queryError", "status:error");

        String site = env("DD_SITE");
        String apiKey = env("DD_API_KEY");
        String appKey = env("DD_APP_KEY");
        String baseUrl = "https://api." + site + SEARCH_PATH;

        Files.createDirectories(Paths.get("out-logs"));

        // 1) Busca inicial por clientUserId + erro
        String initialQuery = String.format("*:%s %s", clientUserId, errorQuery); // full-text + seu filtro de erro
        List<JsonNode> errorLogs = fetchAll(baseUrl, apiKey, appKey, initialQuery, from, to);

        // 2) Extrai correlationIds
        Set<String> correlationIds = errorLogs.stream()
            .map(ev -> ev.path("attributes").path("attributes").path("correlationId").asText(null))
            .filter(Objects::nonNull)
            .collect(Collectors.toCollection(LinkedHashSet::new));

        if (correlationIds.isEmpty()) {
            System.out.println("Nenhum correlationId encontrado a partir do clientUserId.");
            return;
        }

        // 3) Para cada correlationId, busca PENDING e salva JSONs
        List<JsonNode> allPending = new ArrayList<>();
        for (String cid : correlationIds) {
            String q = "@correlationId:" + cid + " @input.proposal.mediationStatus:PENDING";
            List<JsonNode> logs = fetchAll(baseUrl, apiKey, appKey, q, from, to);
            for (JsonNode ev : logs) {
                allPending.add(ev);
                String id = ev.path("id").asText(UUID.randomUUID().toString());
                Path file = Paths.get("out-logs", id + ".json");
                Files.writeString(file, om.writerWithDefaultPrettyPrinter().writeValueAsString(ev));
            }
        }

        // 4) Agrega em NDJSON
        if (!allPending.isEmpty()) {
            Path ndjson = Paths.get("out-logs", "pending-logs.ndjson");
            StringBuilder sb = new StringBuilder();
            for (JsonNode ev : allPending) {
                sb.append(om.writeValueAsString(ev)).append("\n");
            }
            Files.writeString(ndjson, sb.toString());
            System.out.printf("OK! %d logs PENDING salvos em %s%n", allPending.size(), ndjson.toAbsolutePath());
        } else {
            System.out.println("Nenhum log com mediationStatus=PENDING encontrado para os correlationIds.");
        }
    }

    private List<JsonNode> fetchAll(String url, String apiKey, String appKey, String query, String from, String to) throws IOException, InterruptedException {
        List<JsonNode> out = new ArrayList<>();
        String cursor = null;
        do {
            ObjectNode body = om.createObjectNode();
            ObjectNode filter = body.putObject("filter");
            filter.put("from", from);
            filter.put("to", to);
            filter.put("query", query);

            ObjectNode page = body.putObject("page");
            page.put("limit", 1000);
            if (cursor != null) page.put("cursor", cursor);

            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .header("DD-API-KEY", apiKey)
                .header("DD-APPLICATION-KEY", appKey)
                .POST(HttpRequest.BodyPublishers.ofString(om.writeValueAsString(body)))
                .build();

            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) {
                throw new RuntimeException("Erro Datadog: " + resp.statusCode() + " - " + resp.body());
            }
            JsonNode json = om.readTree(resp.body());
            JsonNode data = json.path("data");
            if (data.isArray()) data.forEach(out::add);

            cursor = json.path("meta").path("page").path("after").asText(null); // próximo cursor
        } while (cursor != null);

        return out;
    }

    private static String required(Map<String, String> p, String k) {
        if (!p.containsKey(k) || p.get(k).isBlank()) throw new IllegalArgumentException("Parâmetro obrigatório: " + k);
        return p.get(k);
    }
    private static String env(String k) { String v = System.getenv(k); if (v == null || v.isBlank()) throw new IllegalArgumentException("Env obrigatório: " + k); return v; }
    private static Map<String, String> parseArgs(String[] args) {
        Map<String, String> m = new HashMap<>();
        for (String a : args) if (a.startsWith("--")) {
            int i = a.indexOf('=');
            if (i > 2) m.put(a.substring(2, i), a.substring(i + 1));
        }
        return m;
    }
}

A consulta usa full-text com *:<termo> e key:value como no Explorer. Você pode ajustar a query de “erro” conforme seu padrão (por exemplo level:error ou @severity:ERROR). 

A paginação usa meta.page.after → page.cursor como a doc recomenda. 


> Observação: alguns logs podem não ter correlationId. O código já lida com isso e segue para os próximos.




---

Opção B — cURL rápido (para validar a ideia)

1. Buscar erros por clientUserId numa janela absoluta (evita problemas de now durante paginação):



curl -s -X POST "https://api.${DD_SITE}/api/v2/logs/events/search" \
 -H "Content-Type: application/json" \
 -H "DD-API-KEY: $DD_API_KEY" \
 -H "DD-APPLICATION-KEY: $DD_APP_KEY" \
 -d '{
   "filter":{"from":"2025-10-06T00:00:00Z","to":"2025-10-09T23:59:59Z","query":"*:775255555278836 status:error"},
   "page":{"limit":50}
 }'

Use o campo meta.page.after para paginar repetindo a mesma chamada com "page":{"cursor":"<after>","limit":50}. 

2. Com um correlationId em mãos, rodar:



curl -s -X POST "https://api.${DD_SITE}/api/v2/logs/events/search" \
 -H "Content-Type: application/json" \
 -H "DD-API-KEY: $DD_API_KEY" \
 -H "DD-APPLICATION-KEY: $DD_APP_KEY" \
 -d '{
   "filter":{"from":"2025-10-06T00:00:00Z","to":"2025-10-09T23:59:59Z","query":"@correlationId:a1a45611-589a-4735-990c-0c4188e5e96e @input.proposal.mediationStatus:PENDING"},
   "page":{"limit":1000}
 }' > out-logs/pending.json

A saída já é o JSON completo dos eventos. 


---

Extras que ajudam no dia-a-dia

Janela de tempo absoluta (ISO-8601) quando paginar (evite now-15m). 

NDJSON: facilite ingestão posterior (jq/grep) salvando 1 evento por linha.

Fallback quando não houver correlationId: rode direto *:clientUserId @input.proposal.mediationStatus:PENDING na mesma janela — às vezes resolve em serviços que quebram a propagação.

Permissões: requer API key + Application key válidas com leitura. 


Se quiser, eu já te devolvo um pom.xml/build.gradle enxuto e um README com comandos de execução (ou adapto para rodar como spring-boot:run).


-- 

Sim — dá pra transformar esse processo num agente autônomo de IA que:

1. Monitora o Datadog periodicamente (ou sob demanda),


2. Executa buscas inteligentes de logs,


3. Analisa os resultados (detecção de erro, inconsistência de correlationId, etc.),


4. E gera relatórios ou envia alertas — tudo de forma conversacional ou automatizada.



Abaixo estão três níveis de implementação possíveis, do mais simples ao mais avançado:


---

🧩 1️⃣ Agente local simples (Node.js + LLM API)

Estrutura mínima:

datadog-ai-agent/
├── package.json
├── .env
├── src/
│   ├── config.js
│   ├── datadogClient.js
│   ├── aiAgent.js
│   └── main.js

Objetivo: o aiAgent.js recebe os logs (via datadogClient.js), usa um modelo de linguagem (ex. OpenAI GPT-4o-mini ou GPT-5-preview) para interpretar o contexto e decidir se há correlação, erro, status PENDING, etc.

Exemplo simplificado:

// src/aiAgent.js
import OpenAI from "openai";

export class AiAgent {
  constructor(apiKey) {
    this.client = new OpenAI({ apiKey });
  }

  async analyze(logs) {
    const prompt = `
      You are an observability assistant.
      Given the following Datadog logs, find:
      - all correlationIds where mediationStatus is PENDING
      - possible propagation breaks or inconsistent correlationIds
      - summarize errors found
      Return JSON: { pendingCorrelationIds:[], summary:"..." }

      Logs:
      ${JSON.stringify(logs).slice(0, 8000)} // truncar pra custo
    `;
    const completion = await this.client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });
    return JSON.parse(completion.choices[0].message.content);
  }
}

E o main.js integra tudo:

import { DatadogClient } from "./datadogClient.js";
import { AiAgent } from "./aiAgent.js";
import config from "./config.js";
import fs from "fs-extra";

const dd = new DatadogClient(config);
const ai = new AiAgent(process.env.OPENAI_API_KEY);

(async () => {
  const logs = await dd.fetchAll(`*:${config.clientUserId}`, config.from, config.to);
  const analysis = await ai.analyze(logs);
  await fs.writeJson("./analysis-result.json", analysis, { spaces: 2 });
  console.log("✅ Analysis done:", analysis);
})();

💡 Vantagem: não precisa de infra; executa sob demanda e gera análises enriquecidas.
⚙️ Desvantagem: depende de API externa e limitado ao tamanho dos logs enviados.


---

🧠 2️⃣ Agente persistente / observador (cron + LLM + memória)

Usa cron job ou worker que roda a cada N minutos.

Mantém estado local (último timestamp processado).

Gera relatórios incrementais.

Envia mensagens em Slack / Discord / e-mail quando detecta:

Novo correlationId com PENDING sem follow-up;

Logs de erro sem correlação;

Diferenças de payload entre microserviços.



💡 Pode usar LangChain.js ou LlamaIndex.js para ter memória contextual e parsers semânticos.


---

🧩 3️⃣ Agente corporativo observável (Datadog + Webhook + AI Gateway)

Fluxo de produção:

1. Datadog alert → dispara Webhook para seu agente (ex: via AWS Lambda, Cloud Run, ou API Node).


2. Agente consome logs adicionais via Datadog API.


3. Modelo de linguagem processa logs + contexto (ex. status do cliente, histórico de incidentes).


4. Agente responde automaticamente com:

Diagnóstico (erro em qual microserviço, perda de correlationId, payload suspeito);

JSON dos logs relevantes;

Recomendações de ação (ex. “verificar Catalog-MS”, “policy-listener não respondeu”).



5. Integra com Slack / Confluence / Jira para criar tickets automáticos.




---

🧭 Tecnologias indicadas

OpenAI GPT-4o-mini / GPT-5-preview → para raciocínio sobre logs.

LangChain.js → orquestra agentes com memória e ferramentas.

Datadog Logs API v2 → coleta.

Redis ou SQLite → armazenar estado / último timestamp.

Express.js → se quiser receber Webhooks.

Slack API ou Jira REST → para alertas automáticos.



---

Se quiser, posso te montar a versão 1 (Node + OpenAI) completa e funcional — com aiAgent.js lendo os logs, interpretando e gerando um sumário JSON em minutos.
Quer que eu monte essa versão inicial?

