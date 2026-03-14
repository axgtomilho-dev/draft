# Especificação do Sistema — Gestão de Envolvimentos

**Versão:** 2.0  
**Data:** Março 2025  
**Status:** Rascunho

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Glossário](#2-glossário)
3. [Entidades](#3-entidades)
4. [Autenticação e Primeiro Acesso](#4-autenticação-e-primeiro-acesso)
5. [Regras de Negócio](#5-regras-de-negócio)
6. [Fluxo de Status](#6-fluxo-de-status)
7. [SLAs](#7-slas)
8. [Casos de Uso](#8-casos-de-uso)
9. [Estrutura de Telas](#9-estrutura-de-telas)
10. [Considerações Técnicas](#10-considerações-técnicas)

---

## 1. Visão Geral

### Contexto

Uma squad mantém um ecossistema de aplicações compartilhado — composto por APIs REST, bancos de dados MongoDB, consumers e producers Kafka e API Gateways — que processa dados de múltiplos produtos da empresa.

Outras squads precisam atuar nesse ecossistema para adicionar, alterar ou corrigir funcionalidades de seus respectivos produtos. Para isso, existe um processo estruturado de solicitação, aprovação, implementação e implantação, que este sistema tem como objetivo gerenciar e dar visibilidade.

### Problema

Sem um sistema centralizado, o processo ocorre de forma dispersa, sem rastreamento de SLAs, sem histórico auditável das decisões e sem visibilidade do que está em andamento. Quando múltiplos envolvimentos ocorrem em paralelo e precisam compor uma mesma release, a falta de coordenação gera riscos de conflito e retrabalho.

### Objetivo

Centralizar a gestão dos envolvimentos entre squads, oferecendo visibilidade em tempo real do fluxo, rastreamento de SLAs e histórico completo de cada solicitação.

---

## 2. Glossário

| Termo | Definição |
|---|---|
| **Envolvimento** | Unidade de trabalho que representa uma solicitação formal de contribuição ao ecossistema por uma squad externa |
| **Squad Mantenedora** | Squad responsável por manter o ecossistema compartilhado e por revisar e aprovar os envolvimentos |
| **Squad Contribuidora** | Squad externa que solicita e implementa alterações no ecossistema |
| **Pull Request (PR)** | Solicitação de merge de código em um repositório do ecossistema, vinculada a um envolvimento |
| **Release** | Agrupamento de envolvimentos prontos para implantação conjunta em produção |
| **SLA** | Prazo máximo definido para uma etapa específica do processo |
| **Código de Implantação** | Identificador gerado pelo pipeline CI/CD associado a um PR após o merge, usado para rastreabilidade da implantação |
| **Board** | Visão principal do sistema, em formato de esteira kanban, exibindo os envolvimentos por status |

---

## 3. Entidades

### 3.1 Squad

Representa uma squad da empresa. Cadastrada diretamente no banco de dados; não há interface de CRUD para esta entidade na versão inicial.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | Integer (sequencial) | Identificador único |
| `nome` | String | Nome da squad |
| `descricao` | String | Descrição da squad e sua área de atuação |

---

### 3.2 Usuario

Representa um usuário autenticado no sistema.

| Campo | Tipo | Descrição |
|---|---|---|
| `email` | String | E-mail da conta Microsoft do usuário. Utilizado como identificador único |
| `squad_id` | Integer | Referência à squad à qual o usuário pertence |

O registro do usuário é criado automaticamente no primeiro login. Alterações de squad são feitas diretamente no banco de dados; não há interface de CRUD para esta entidade na versão inicial.

---

### 3.3 Envolvimento

Entidade central do sistema. Representa uma solicitação formal de contribuição ao ecossistema.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | Integer (sequencial) | Sim | Identificador único. Formato de exibição: `ENV-{id}` |
| `titulo` | String (máx. 50 caracteres) | Sim | Título objetivo da necessidade |
| `descricao` | Text | Sim | Descrição detalhada do que precisa ser feito, motivação e impacto esperado |
| `squad_contribuidora_id` | Integer | Sim | Referência à squad solicitante |
| `squad_mantenedora_id` | Integer | Sim | Referência à squad responsável pelo ecossistema |
| `usuario_contribuidor` | String (email) | Sim | E-mail do usuário que criou o envolvimento |
| `usuario_mantenedor` | String (email) | Não | E-mail do usuário da squad mantenedora responsável pelo envolvimento |
| `data_criacao` | DateTime | Sim | Preenchida automaticamente no momento da criação |
| `data_previsao_implantacao` | Date | Não | Data prevista para implantação em produção |
| `data_encerramento` | DateTime | Não | Preenchida automaticamente quando o envolvimento atinge o status `IMPLANTADO` ou `CANCELADO` |
| `status_atual` | Enum | Sim | Status corrente. Ver seção 6.1 |
| `historico_status` | List\<HistoricoStatus\> | Sim | Registro imutável de todas as transições de status |
| `prioridade` | Enum | Sim | `BAIXA`, `MEDIA`, `ALTA` |
| `complexidade` | Enum | Sim | `P` (Pequeno), `M` (Médio), `G` (Grande) |
| `pull_requests` | List\<PullRequest\> | Não | Pull requests vinculados ao envolvimento |

#### 3.3.1 HistoricoStatus (Envolvimento)

Registro imutável de cada transição de status do envolvimento.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | Integer (sequencial) | Sim | Identificador único |
| `status` | Enum | Sim | Status registrado neste evento |
| `data_inicio` | DateTime | Sim | Momento em que o status foi ativado |
| `data_fim` | DateTime | Não | Momento em que o status foi encerrado. Nulo se for o status atual |
| `usuario` | String (email) | Sim | Usuário que realizou a transição |
| `observacao` | Text | Não | Observação ou justificativa registrada na transição |

---

### 3.4 Pull Request

Representa um pull request em um repositório do ecossistema, vinculado a um envolvimento.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | Integer (sequencial) | Sim | Identificador único interno |
| `id_envolvimento` | Integer | Sim | Referência ao envolvimento pai |
| `repo` | String | Sim | Nome do repositório onde o PR foi aberto |
| `repo_id_pull_request` | String | Sim | ID do PR no sistema de versionamento (ex: GitHub/GitLab) |
| `descricao` | String | Sim | Descrição do que foi implementado |
| `status_atual` | Enum | Sim | Status corrente do PR. Ver seção 6.2 |
| `historico_status` | List\<HistoricoStatus\> | Sim | Registro imutável de todas as transições de status |
| `codigo_implantacao` | String | Não | Código gerado pelo pipeline CI/CD após o merge, utilizado para rastreabilidade em produção |

#### 3.4.1 HistoricoStatus (Pull Request)

Mesma estrutura do histórico do Envolvimento. Registro imutável de cada transição de status do PR.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | Integer (sequencial) | Sim | Identificador único |
| `status` | Enum | Sim | Status registrado neste evento |
| `data_inicio` | DateTime | Sim | Momento em que o status foi ativado |
| `data_fim` | DateTime | Não | Momento em que o status foi encerrado |
| `usuario` | String (email) | Sim | Usuário que realizou a transição |
| `observacao` | Text | Não | Observação ou justificativa registrada na transição |

---

### 3.5 Release

Agrupa envolvimentos prontos para implantação conjunta, permitindo orquestrar deploys que envolvem múltiplas squads.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | Integer (sequencial) | Sim | Identificador único |
| `nome` | String | Sim | Nome ou versão da release. Ex: `v2.4.1` |
| `status` | Enum | Sim | `PLANEJADA`, `EM_HOMOLOG`, `AGUARDANDO_IMPLANTACAO`, `IMPLANTADA`, `CANCELADA` |
| `envolvimentos` | List\<Integer\> | Sim | IDs dos envolvimentos que compõem esta release |
| `data_planejada_producao` | Date | Não | Data planejada para implantação em produção |
| `data_implantacao_real` | DateTime | Não | Data e hora efetiva da implantação |
| `responsavel` | String (email) | Não | Usuário responsável pela condução da release |
| `observacoes` | Text | Não | Notas de orquestração, plano de rollback e informações relevantes |

---

## 4. Autenticação e Primeiro Acesso

### 4.1 Login

O acesso ao sistema é realizado via conta Microsoft (Microsoft Entra ID). Não há cadastro manual de usuários.

### 4.2 Primeiro Login

No primeiro acesso, após a autenticação bem-sucedida com a conta Microsoft, o sistema verifica se existe um registro de `Usuario` para o e-mail autenticado.

Caso não exista, o sistema apresenta ao usuário uma tela de seleção de squad com a pergunta: **"A qual squad você pertence?"**. O usuário seleciona sua squad a partir da lista de squads cadastradas no sistema. O sistema então cria o registro de `Usuario` com o e-mail e a squad selecionada, e redireciona o usuário para o board.

### 4.3 Acessos Subsequentes

Nos acessos seguintes, o sistema autentica o usuário e o redireciona diretamente para o board, sem necessidade de nova seleção de squad.

### 4.4 Alteração de Squad

Caso um usuário precise alterar sua squad, a mudança é realizada diretamente no banco de dados. Não há interface para esta operação na versão inicial.

---

## 5. Regras de Negócio

- Um usuário pode criar um envolvimento direcionado a qualquer squad mantenedora, inclusive a sua própria. Neste caso, a squad contribuidora e a squad mantenedora terão o mesmo valor.

- Ao criar um envolvimento, os seguintes campos são preenchidos automaticamente com base no usuário autenticado e na squad do board selecionado: `squad_contribuidora` (squad do usuário logado), `squad_mantenedora` (squad selecionada no board), `usuario_contribuidor` (e-mail do usuário logado).

- Um usuário pode visualizar e alterar qualquer envolvimento cuja `squad_mantenedora` ou `squad_contribuidora` seja a sua squad.

- Um envolvimento não pode ser removido. O encerramento sem implantação ocorre exclusivamente pela transição para o status `CANCELADO`.

---

## 6. Fluxo de Status

### 6.1 Status do Envolvimento

```
RASCUNHO
  └──► AGUARDANDO_APROVACAO
         └──► EM_ANALISE
                ├──► APROVADO
                │      └──► EM_DESENVOLVIMENTO
                │              └──► AGUARDANDO_REVISAO_PR
                │                     └──► EM_REVISAO
                │                            ├──► EM_DESENVOLVIMENTO  (ajustes solicitados)
                │                            └──► AGUARDANDO_HOMOLOG
                │                                   └──► EM_HOMOLOG
                │                                          └──► AGUARDANDO_IMPLANTACAO
                │                                                 └──► IMPLANTADO
                └──► CANCELADO (a partir de qualquer status anterior a IMPLANTADO)
```

| Status | Descrição |
|---|---|
| `RASCUNHO` | Estado inicial. Envolvimento criado mas ainda não submetido para aprovação |
| `AGUARDANDO_APROVACAO` | Envolvimento submetido. Aguarda avaliação da squad mantenedora. Início do SLA de aprovação |
| `EM_ANALISE` | Squad mantenedora está avaliando o escopo e a viabilidade |
| `APROVADO` | Escopo aprovado. Squad contribuidora pode iniciar as implementações |
| `EM_DESENVOLVIMENTO` | Implementações em andamento nos repositórios do ecossistema |
| `AGUARDANDO_REVISAO_PR` | PRs prontos. Aguarda revisão da squad mantenedora. Início do SLA de revisão |
| `EM_REVISAO` | Squad mantenedora está revisando os pull requests |
| `AGUARDANDO_HOMOLOG` | PRs mergeados na branch `develop`. Aguarda criação da branch de release e deploy em homologação |
| `EM_HOMOLOG` | Alterações deployadas em homologação. Testes em andamento |
| `AGUARDANDO_IMPLANTACAO` | Homologação aprovada. Release planejada para produção |
| `IMPLANTADO` | Deploy em produção realizado com sucesso. `data_encerramento` preenchida automaticamente |
| `CANCELADO` | Envolvimento encerrado sem implantação. `data_encerramento` preenchida automaticamente |

---

### 6.2 Status do Pull Request

```
ABERTO
  └──► EM_REVISAO
         ├──► AGUARDANDO_AJUSTES
         │      └──► EM_REVISAO  (após ajustes aplicados)
         ├──► APROVADO
         │      └──► MERGED
         └──► REJEITADO
```

| Status | Descrição |
|---|---|
| `ABERTO` | PR criado no repositório e registrado no sistema |
| `EM_REVISAO` | Squad mantenedora iniciou a revisão do PR |
| `AGUARDANDO_AJUSTES` | Revisão identificou pontos a corrigir. Aguarda a squad contribuidora |
| `APROVADO` | PR aprovado pela squad mantenedora. Pronto para merge |
| `MERGED` | Código mergeado na branch `develop`. Deploy automático em dev realizado |
| `REJEITADO` | PR rejeitado. Não será mergeado |

---

## 7. SLAs

| SLA | Status de Início | Status de Fim | Prazo |
|---|---|---|---|
| Avaliação de Envolvimento | `AGUARDANDO_APROVACAO` | `APROVADO` ou `CANCELADO` | **3 dias úteis** |
| Revisão de Pull Requests | `AGUARDANDO_REVISAO_PR` | `AGUARDANDO_HOMOLOG` ou retorno para `EM_DESENVOLVIMENTO` | **5 dias úteis** |

O sistema deve exibir o tempo decorrido em cada SLA e sinalizar visualmente quando o prazo estiver próximo de vencer ou já tiver sido ultrapassado.

---

## 8. Casos de Uso

### UC-01 — Primeiro Acesso

**Ator:** Usuário (qualquer squad)  
**Pré-condição:** Usuário possui conta Microsoft válida e ainda não tem registro no sistema  
**Fluxo:**
1. Usuário acessa o sistema e realiza autenticação via conta Microsoft
2. Sistema detecta que não existe registro para o e-mail autenticado
3. Sistema apresenta seleção de squad: "A qual squad você pertence?"
4. Usuário seleciona sua squad
5. Sistema cria o registro de `Usuario` e redireciona para o board

---

### UC-02 — Criar Envolvimento

**Ator:** Usuário autenticado  
**Pré-condição:** Usuário autenticado com squad registrada  
**Fluxo:**
1. Usuário clica em "Criar Envolvimento" no header do board
2. Sistema abre o formulário com os campos `squad_contribuidora`, `squad_mantenedora` e `usuario_contribuidor` pré-preenchidos
3. Usuário preenche título, descrição, prioridade, complexidade e opcionalmente a data de previsão de implantação
4. Usuário pode escolher salvar como `RASCUNHO` ou submeter diretamente para `AGUARDANDO_APROVACAO`
5. Sistema cria o envolvimento e registra o primeiro evento no histórico de status

---

### UC-03 — Avaliar Envolvimento

**Ator:** Usuário da squad mantenedora  
**Pré-condição:** Envolvimento no status `AGUARDANDO_APROVACAO`  
**Fluxo:**
1. Usuário abre o detalhe do envolvimento
2. Usuário pode mover o envolvimento para `EM_ANALISE`, `APROVADO` ou `CANCELADO`, registrando observação opcional em qualquer transição

---

### UC-04 — Registrar Pull Request

**Ator:** Usuário da squad contribuidora  
**Pré-condição:** Envolvimento no status `APROVADO` ou `EM_DESENVOLVIMENTO`  
**Fluxo:**
1. Usuário abre o detalhe do envolvimento e adiciona um novo PR
2. Preenche: repositório, ID do PR no repositório e descrição
3. Sistema registra o PR com status `ABERTO`

---

### UC-05 — Solicitar Revisão de PRs

**Ator:** Usuário da squad contribuidora  
**Pré-condição:** Envolvimento no status `EM_DESENVOLVIMENTO`  
**Fluxo:**
1. Usuário indica que as implementações estão prontas
2. Sistema transiciona o envolvimento para `AGUARDANDO_REVISAO_PR` e inicia o SLA de revisão

---

### UC-06 — Revisar Pull Request

**Ator:** Usuário da squad mantenedora  
**Pré-condição:** Envolvimento no status `EM_REVISAO`, PR no status `ABERTO` ou `EM_REVISAO`  
**Fluxo:**
1. Usuário abre o detalhe do PR
2. Usuário pode: aprovar, solicitar ajustes (com observação), mergear (informando o `codigo_implantacao`) ou rejeitar

---

### UC-07 — Cancelar Envolvimento

**Ator:** Usuário da squad mantenedora ou contribuidora  
**Pré-condição:** Envolvimento em qualquer status exceto `IMPLANTADO`  
**Fluxo:**
1. Usuário aciona o cancelamento no detalhe do envolvimento
2. Sistema solicita o motivo (observação obrigatória)
3. Sistema transiciona para `CANCELADO` e preenche `data_encerramento`

---

### UC-08 — Confirmar Implantação

**Ator:** Usuário da squad mantenedora  
**Pré-condição:** Envolvimento no status `AGUARDANDO_IMPLANTACAO`  
**Fluxo:**
1. Usuário confirma que o deploy em produção foi realizado com sucesso
2. Sistema transiciona para `IMPLANTADO` e preenche `data_encerramento`

---

## 9. Estrutura de Telas

### 9.1 Tela de Seleção de Squad (primeiro acesso)

Exibida apenas no primeiro login. Apresenta a lista de squads cadastradas para que o usuário selecione a sua.

---

### 9.2 Board (tela principal)

Exibida após o login. Apresenta os envolvimentos em formato de esteira kanban, organizados por status.

**Header do board:**
- Seletor de squad mantenedora: filtra o board exibindo apenas os envolvimentos cuja `squad_mantenedora` seja a squad selecionada. Ao carregar o board, o seletor é inicializado com a squad do usuário logado.
- Botão de criar envolvimento: abre o formulário de criação com `squad_mantenedora` pré-preenchida com o valor do seletor.

**Colunas do board (na ordem do fluxo):**
1. Rascunho
2. Aguardando Aprovação
3. Em Análise
4. Em Desenvolvimento
5. Aguardando Revisão PR
6. Em Revisão PR
7. Aguardando Homolog
8. Em Homolog
9. Aguardando Implantação
10. Implantado
11. Cancelado

**Cada card exibe:**
- ID e título do envolvimento
- Squad contribuidora
- Prioridade e complexidade
- SLA em andamento (quando aplicável)
- Quantidade de PRs vinculados

---

### 9.3 Detalhe do Envolvimento

Exibida ao acessar um envolvimento. Contém todas as informações do envolvimento, a lista de PRs vinculados, o histórico completo de status e as ações disponíveis para o usuário autenticado.

---

### 9.4 Detalhe do Pull Request

Acessível a partir da lista de PRs do envolvimento. Exibe os dados do PR, o histórico de status e as ações disponíveis.

---

### 9.5 Releases

Visão de agrupamento dos envolvimentos por release. Cada release exibe seus envolvimentos, status e datas planejadas e realizadas de implantação.

---

## 10. Considerações Técnicas

### 10.1 Autenticação

A autenticação é realizada exclusivamente via Microsoft Entra ID (Azure Active Directory). O sistema não gerencia senhas ou cadastro manual de usuários.

### 10.2 Dados iniciais (seed)

As squads são cadastradas diretamente no banco de dados, sem interface de administração na versão inicial. O sistema deve ser inicializado com as squads necessárias antes do primeiro acesso dos usuários.

### 10.3 Estratégia de Branching dos Repositórios

O sistema reflete a seguinte estratégia de branches nos repositórios do ecossistema:

| Branch | Propósito |
|---|---|
| `develop` | Recebe os merges dos PRs aprovados. Deploy automático no ambiente de **dev** |
| `release/*` | Criada a partir de `main` com as alterações selecionadas do `develop`. Deploy automático em **homolog** |
| `main` | Branch de produção. Atualizada após implantação bem-sucedida |

### 10.4 Auditoria

Todos os eventos de transição de status — de envolvimentos e de pull requests — são imutáveis após registrados. O histórico preserva usuário, data/hora e observação de cada transição.

### 10.5 Paralelismo

O sistema suporta múltiplos envolvimentos simultâneos em qualquer combinação de status, de qualquer combinação de squads contribuidoras direcionados a uma mesma squad mantenedora.

### 10.6 Notificações (escopo futuro)

Fora do escopo desta versão. Recomenda-se avaliar para versões seguintes:

- Notificação à squad mantenedora ao receber um novo envolvimento para aprovação
- Notificação à squad contribuidora ao ter envolvimento aprovado ou com ajustes solicitados
- Notificação à squad mantenedora ao receber PRs para revisão
- Alerta de SLA próximo do vencimento ou vencido

---

*Fim da especificação v2.0*
