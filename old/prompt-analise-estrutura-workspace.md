Você deve analisar uma pasta contendo múltiplos repositórios de software e gerar documentação estrutural dos projetos encontrados.

Objetivo:
Gerar um arquivo Markdown chamado:

estrutura.md

E também gerar um segundo arquivo:

estrutura-prompt.md

O arquivo "estrutura-prompt.md" deve conter um prompt completo que permita atualizar futuramente o "estrutura.md" após alterações nos repositórios, mantendo exatamente a mesma estrutura, regras e formato.

Regras obrigatórias:

1. Escopo permitido

- Analise somente a pasta raiz informada e seus subdiretórios.
- Nunca acesse arquivos ou diretórios fora desse caminho.
- Nunca percorra outras unidades, discos, compartilhamentos de rede ou diretórios externos.
- Não seguir links simbólicos que apontem para fora da árvore atual.

2. Segurança

Não executar:

- exclusão
- movimentação
- renomeação
- alteração de conteúdo
- alteração de permissões
- instalação de dependências
- compilação
- build
- testes
- scripts
- containers
- aplicações
- processos externos

Permitido apenas:

- leitura de nomes
- leitura de estrutura
- leitura de metadados
- leitura de arquivos de configuração
- leitura de arquivos de código-fonte para identificação estrutural

Exceção única:

Os únicos arquivos que podem ser criados ou alterados são:

- estrutura.md
- estrutura-prompt.md

Nenhum outro arquivo pode ser criado ou modificado.

3. Linguagens e tecnologias a reconhecer

Identificar automaticamente tecnologias encontradas, incluindo mas não limitado a:

Linguagens:

- Java
- Kotlin
- Javascript
- Typescript
- Node.js
- Python
- SQL
- Go
- C#
- VB
- PHP
- Rust
- C
- C++
- Shell
- HTML
- CSS

Frameworks e ferramentas:

- Spring Boot
- NestJS
- React
- Next.js
- Angular
- Express
- Fastify
- Hibernate
- Gradle
- Maven
- npm
- yarn
- pnpm
- Docker
- Kubernetes
- Kafka
- Redis
- PostgreSQL
- MySQL
- MongoDB
- RabbitMQ
- Terraform
- AWS
- Firebase

4. Arquivos importantes a analisar

Analisar principalmente:

Java/Kotlin:

- pom.xml
- build.gradle
- build.gradle.kts
- settings.gradle
- settings.gradle.kts
- application.yml
- application.yaml
- application.properties

Javascript/Node:

- package.json
- package-lock.json
- yarn.lock
- pnpm-lock.yaml
- tsconfig.json

Python:

- requirements.txt
- pyproject.toml
- setup.py

Infraestrutura:

- Dockerfile
- docker-compose.yml
- compose.yml
- terraform files
- kubernetes yaml files

Controle:

- README.md
- .gitignore
- .editorconfig

5. Ignorar por padrão

Pastas:

- .git
- node_modules
- target
- build
- dist
- out
- bin
- obj
- .idea
- .vscode
- .gradle
- .m2
- .npm
- .yarn
- cache
- tmp
- temp
- coverage
- logs
- vendor
- .next

Arquivos:

- *.class
- *.jar
- *.war
- *.dll
- *.exe
- *.tmp
- *.cache
- *.log
- *.lock

6. Para cada repositório encontrado identificar

Informações gerais

- nome
- caminho relativo
- linguagem principal
- tecnologias encontradas
- framework principal
- tipo de projeto

Exemplos:

- backend
- frontend
- biblioteca
- microsserviço
- API
- worker
- CLI
- aplicação desktop
- infraestrutura

Estrutura

Identificar:

- diretórios principais
- módulos
- subprojetos
- pacotes importantes
- organização geral

Dependências

Listar:

- dependências principais
- bibliotecas relevantes
- banco de dados
- mensageria
- ferramentas de infraestrutura

APIs

Se identificável:

- endpoints
- controllers
- rotas
- consumers
- producers
- eventos

Banco de dados

Se identificável:

- entidades
- migrations
- scripts SQL
- schemas

Arquitetura

Inferir quando possível:

- monolito
- microsserviços
- arquitetura hexagonal
- MVC
- Clean Architecture
- DDD
- event-driven
- CQRS

Indicar nível de confiança:

- alto
- médio
- baixo

Nunca inventar informações.

7. Estrutura obrigatória do arquivo estrutura.md

Estrutura dos repositórios

Resumo geral

- total de repositórios
- linguagens encontradas
- frameworks encontrados
- tecnologias encontradas

---

Repositório: nome-do-repositorio

Informações gerais

...

Tecnologias

...

Estrutura

...

Dependências principais

...

APIs

...

Banco de dados

...

Arquitetura inferida

...

Observações

...

---

Estatísticas gerais

- total de projetos por linguagem
- total por framework
- tecnologias mais frequentes
- padrões arquiteturais encontrados

8. Estrutura obrigatória do arquivo estrutura-prompt.md

Gerar um prompt que:

- atualize apenas informações alteradas
- mantenha formato idêntico do estrutura.md
- preserve seções existentes
- adicione novos repositórios
- remova repositórios excluídos
- recalcule estatísticas
- mantenha mesmas regras de segurança
- mantenha mesmas regras de escopo
- mantenha listas de exclusão
- nunca modificar arquivos além de:
  - estrutura.md
  - estrutura-prompt.md

9. Restrições finais

- Não assumir tecnologias sem evidência.
- Não abrir conteúdo desnecessário.
- Não acessar caminhos externos.
- Não executar código.
- Não executar scripts.
- Não instalar nada.
- Não modificar arquivos fora dos dois arquivos autorizados.
- Mostrar inicialmente quais diretórios serão analisados e quais serão ignorados.
