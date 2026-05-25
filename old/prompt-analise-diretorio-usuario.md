Sua tarefa é executar SOMENTE operações de leitura dentro da pasta do meu usuário no Windows e gerar um relatório em formato Markdown chamado estrutura.md contendo a estrutura dos meus arquivos pessoais.
Salve as instrucoes desse prompt em arquivo separado chamado estrutura-prompt.md para poder ser executado e atualizar o arquivo estrutura.md

Regras obrigatórias:

1. Escopo permitido:
- Acesse apenas a pasta raiz do usuário atual:
  %USERPROFILE%
- Nunca acesse caminhos fora dela.
- Não percorra discos adicionais, outras partições, unidades de rede, compartilhamentos ou outras pastas do sistema.

2. Segurança:
- Não modificar, mover, renomear ou excluir arquivos (unicas exceções: estrutura.md e estrutura-prompt.md)
- Não executar programas.
- Não criar arquivos temporários fora do arquivo final solicitado.
- Não alterar permissões.
- Não instalar nada.
- Não abrir documentos para ler conteúdo interno.
- Apenas coletar metadados do sistema de arquivos.

3. O relatório deve incluir:
- Estrutura hierárquica de diretórios.
- Nome dos arquivos.
- Tamanho dos arquivos.
- Data de última modificação.
- Quantidade de itens por diretório.
- Resumo final contendo:
    - Total de diretórios
    - Total de arquivos
    - Espaço utilizado
    - Maiores diretórios
    - Tipos de arquivo mais comuns

4. Priorizar conteúdo pessoal:
Incluir normalmente:

- Documents
- Desktop
- Downloads
- Pictures
- Videos
- Music
- Projects
- Workspace
- Dev
- Source
- Git
- Repositories
- OneDrive (somente conteúdo do usuário)
- arquivos .md
- arquivos .txt
- arquivos .pdf
- arquivos .doc/.docx
- arquivos .xls/.xlsx
- arquivos .ppt/.pptx
- arquivos .jpg/.png/.webp
- arquivos .zip/.rar
- código-fonte:
  .java
  .kt
  .ts
  .js
  .go
  .py
  .cs
  .sql
  .html
  .css
  .json
  .yaml
  .yml

5. Ignorar por padrão:

Pastas:

- AppData\Local\Temp
- AppData\Local\Packages
- AppData\Local\Microsoft
- AppData\LocalLow
- AppData\Roaming\Microsoft
- .gradle
- .m2
- .npm
- .yarn
- node_modules
- .git
- target
- build
- dist
- out
- bin
- obj
- .idea
- .vscode
- cache
- tmp
- temp

Arquivos:

- *.dll
- *.sys
- *.exe
- *.msi
- *.tmp
- *.log
- *.lock
- *.cache

6. Exceções importantes:
Mesmo em diretórios normalmente ignorados, incluir apenas arquivos relevantes de configuração pessoal, por exemplo:

- .gitconfig
- .zshrc
- .bashrc
- .npmrc
- .editorconfig
- settings.json
- docker-compose.yml
- compose.yml
- application.yml
- application.properties

7. Saída:
Gerar um único arquivo:

personal-files-report.md

Formato:

# Inventário de arquivos pessoais

## Resumo geral

...

## Estrutura de diretórios

### Desktop
- arquivo.ext
- tamanho
- última modificação

### Documents
...

## Estatísticas

...

8. Antes de iniciar:
Mostre quais diretórios serão analisados e quais serão ignorados.

9. Nunca leia conteúdo interno de documentos.
Somente nomes, caminhos e metadados do sistema de arquivos.
