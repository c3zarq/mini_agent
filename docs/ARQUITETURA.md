# MINI AGENT
## Documento 02 — Arquitetura Técnica

**Versão:** 0.1<br>
**Status:** Proposta técnica<br>
**Referência:** PRD Mini Agent 0.1<br>
**Linguagem:** JavaScript<br>
**Ambiente:** Node.js / Linux<br>
**Interface:** CLI

---

# 1. Objetivo da arquitetura

Este documento estabelece a arquitetura técnica do Mini Agent, definindo seus componentes, responsabilidades, comunicação, estrutura de arquivos e mecanismos de persistência.

A arquitetura deverá atender aos requisitos definidos no PRD, priorizando simplicidade, baixo consumo computacional e compatibilidade com modelos de linguagem pequenos executados localmente.

O sistema deverá funcionar como uma camada intermediária entre o usuário, o Ollama e o sistema de arquivos.

Sua responsabilidade principal será organizar e controlar a execução de pequenas tarefas de desenvolvimento, reduzindo a complexidade operacional exigida do modelo de linguagem.

# 2. Diretrizes arquiteturais

A implementação deverá respeitar as seguintes diretrizes:

**2.1. Arquitetura modular**

O sistema será dividido em módulos com responsabilidades específicas, evitando dependências desnecessárias entre componentes.

**2.2. Coordenação centralizada**

O componente Agent será responsável por coordenar o fluxo de execução, solicitando operações aos demais módulos.

**2.3. Contexto progressivo**

As informações serão fornecidas ao modelo conforme a necessidade identificada durante a execução da tarefa.

**2.4. Execução controlada**

O modelo poderá solicitar operações, mas somente a aplicação poderá executá-las.

**2.5. Persistência independente do modelo**

Conversas, tarefas e operações serão armazenadas no SQLite. A memória do modelo não será considerada confiável nem necessária para a continuidade do trabalho.

**2.6. Independência de modelo**

A integração deverá permitir selecionar diferentes modelos disponíveis no Ollama, sem vincular a aplicação a uma família específica.

# 3. Visão geral da arquitetura

A arquitetura será organizada em cinco áreas principais:

1. Interface com o usuário.
2. Gerenciamento do agente.
3. Comunicação com o Ollama.
4. Gerenciamento do sistema de arquivos.
5. Persistência de dados.

Representação conceitual:

```text
                  USUÁRIO
                     |
                     v
              +--------------+
              |     CLI      |
              +--------------+
                     |
                     v
              +--------------+
              |    AGENT     |
              |              |
              | Coordenação  |
              | das tarefas  |
              +--------------+
                     |
          +----------+----------+
          |          |          |
          v          v          v
     +---------+ +--------+ +---------+
     | OLLAMA  | |CONTEXT | |  TASKS  |
     +---------+ +--------+ +---------+
          |          |          |
          v          |          |
        +-----+      |          |
        | LLM |      |          |
        +-----+      |          |
                     |          |
              +------+----------+
              |
       +------+-------+
       |              |
       v              v
   +--------+    +----------+
   | FILES  |    | DATABASE |
   +--------+    +----------+
       |              |
       v              v
   PROJETO          SQLITE
```

A representação indica as responsabilidades principais. A comunicação efetiva entre os módulos será realizada por funções JavaScript.

# 4. Componentes da aplicação

## 4.1. CLI — Interface de terminal

Responsabilidade: estabelecer a comunicação entre o usuário e o sistema.

Funções previstas:

- Apresentar informações da aplicação.
- Receber mensagens.
- Exibir respostas do modelo.
- Permitir seleção de projetos e modelos.
- Carregar tarefas.
- Apresentar o andamento da EAP.
- Solicitar autorização para alterações.
- Recuperar conversas anteriores.

A interface utilizará o módulo nativo `readline` do Node.js.

Não serão utilizadas bibliotecas gráficas ou frameworks de interface.

## 4.2. Agent — Coordenador de execução

Responsabilidade: controlar o fluxo de interação entre o usuário, o modelo e os demais componentes.

O Agent será o núcleo operacional da aplicação.

Funções:

- Receber a solicitação do usuário.
- Identificar a tarefa atual.
- Solicitar o contexto necessário.
- Preparar as mensagens destinadas ao LLM.
- Interpretar a resposta estruturada.
- Identificar solicitações de ferramentas.
- Solicitar operações aos módulos correspondentes.
- Apresentar propostas de alteração.
- Controlar o fluxo de aprovação.
- Registrar os resultados.

O Agent não deverá assumir responsabilidades de planejamento do projeto.

A execução será limitada à tarefa selecionada pelo usuário.

## 4.3. Ollama — Integração com modelos

Responsabilidade: estabelecer comunicação com os modelos locais.

A comunicação será realizada por meio da API HTTP disponibilizada pelo Ollama.

Principais operações:

- Consultar modelos instalados.
- Selecionar o modelo ativo.
- Enviar mensagens.
- Receber respostas.
- Identificar erros de comunicação.

Endpoints previstos:

| Endpoint | Utilização |
|---|---|
| GET /api/tags | Consultar modelos locais. |
| POST /api/chat | Enviar mensagens e receber respostas. |

A API de chat permite fornecer histórico de mensagens e receber respostas estruturadas. O Ollama também disponibiliza suporte a JSON Schema e chamadas de ferramentas, mas o Mini Agent utilizará inicialmente um protocolo próprio de operações em JSON.

Referência: documentação oficial da API Ollama.

https://docs.ollama.com/api

## 4.4. Context — Gerenciamento de contexto

Responsabilidade: selecionar e preparar as informações que serão enviadas ao modelo.

Este componente será especialmente importante para o funcionamento com modelos pequenos.

Funções:

- Recuperar as instruções gerais do agente.
- Carregar a tarefa atual.
- Recuperar mensagens recentes.
- Incorporar resultados de consultas a arquivos.
- Limitar a quantidade de informações enviadas.
- Evitar a repetição desnecessária de contexto.

O Context não deverá enviar automaticamente todos os arquivos do projeto.

O conteúdo será organizado progressivamente, conforme as solicitações do modelo.

## 4.5. Tasks — Gerenciamento de tarefas

Responsabilidade: interpretar e controlar a EAP e as tarefas individuais.

Funções:

- Localizar o arquivo EAP.md.
- Interpretar suas etapas e tarefas.
- Localizar os documentos individuais.
- Carregar uma tarefa selecionada.
- Registrar estados de execução.
- Atualizar o andamento do projeto.
- Calcular indicadores de progresso.

A aplicação não deverá criar ou decompor tarefas automaticamente.

## 4.6. Files — Gerenciamento de arquivos

Responsabilidade: disponibilizar operações controladas sobre o sistema de arquivos.

Operações iniciais:

| Operação | Descrição |
|---|---|
| list_files | Listar arquivos e diretórios. |
| search_files | Procurar termos em arquivos. |
| read_file | Ler o conteúdo de um arquivo. |
| create_file | Propor a criação de um arquivo. |
| replace_text | Propor a substituição de um trecho. |

As operações de leitura poderão ser executadas automaticamente.

As operações de gravação dependerão de aprovação explícita do usuário.

## 4.7. Database — Persistência

Responsabilidade: armazenar as informações necessárias para continuidade do trabalho.

Será utilizado SQLite, acessado pela biblioteca `better-sqlite3`.

Dados armazenados:

- Projetos.
- Conversas.
- Mensagens.
- Etapas da EAP.
- Tarefas.
- Estados de execução.
- Histórico de operações.

A persistência deverá ser independente da disponibilidade e da memória dos modelos.

# 5. Integração e protocolo de comunicação com o LLM

Esta é uma das decisões técnicas mais importantes do projeto.

O Mini Agent não dependerá exclusivamente do mecanismo nativo de tool calling dos modelos.

Embora o Ollama disponibilize chamadas de ferramentas, a capacidade de utilização desse recurso varia conforme o modelo utilizado.

Para o MVP, adotaremos um protocolo próprio de comunicação estruturada.

## 5.1. Protocolo JSON

O modelo deverá produzir respostas em um formato JSON previamente definido.

A aplicação disponibilizará um esquema que identifica três tipos de resposta:

**A. Solicitação de ferramenta**

Exemplo:

```json
{
  "type": "tool_call",
  "name": "read_file",
  "arguments": {
    "path": "src/server.js"
  }
}
```

**B. Proposta de alteração**

Exemplo:

```json
{
  "type": "proposal",
  "name": "replace_text",
  "arguments": {
    "path": "src/server.js",
    "old_text": "const port = 3000;",
    "new_text": "const port = 4000;"
  },
  "message": "Alterar a porta da aplicação."
}
```

**C. Resposta final**

Exemplo:

```json
{
  "type": "final",
  "message": "A análise foi concluída."
}
```

Cada resposta deverá representar uma única operação ou uma resposta final.

Isso reduz a complexidade de interpretação para o modelo e para a aplicação.

## 5.2. Validação das respostas

O fluxo será:

1. O modelo produz uma resposta.
2. A aplicação interpreta o JSON.
3. Valida a estrutura e os campos obrigatórios.
4. Verifica se a operação solicitada é permitida.
5. Executa a operação ou apresenta a proposta.
6. Retorna o resultado ao modelo.

Respostas inválidas não deverão provocar operações no sistema de arquivos.

O Ollama permite utilizar JSON Schema no parâmetro `format` da API, restringindo a estrutura das respostas produzidas. Essa possibilidade será utilizada como recurso adicional, mantendo a validação no Node.js.

A estrutura JSON, por si só, não garante que o modelo tenha escolhido a operação correta. A aplicação continuará responsável pela validação semântica e pela autorização.

Referência: documentação de Structured Outputs do Ollama.

https://docs.ollama.com/capabilities/structured-outputs

## 5.3. Controle de operações

As operações serão divididas em duas categorias:

**Operações automáticas:**

- Listar arquivos.
- Pesquisar conteúdo.
- Ler arquivos.

**Operações mediante aprovação:**

- Criar arquivos.
- Substituir trechos de código.

O modelo não poderá executar diretamente as operações.

Deverá apenas solicitar sua realização por meio do protocolo JSON.

## 5.4. Limitação do ciclo de execução

A aplicação deverá limitar a quantidade de operações consecutivas solicitadas pelo modelo.

Caso o modelo entre em um ciclo de solicitações repetitivas ou ultrapasse o limite estabelecido, o agente deverá interromper a execução e informar o usuário.

Os limites serão ajustados durante os testes com modelos pequenos.

# 6. Gerenciamento de contexto

O gerenciamento de contexto deverá separar duas dimensões:

**Memória persistente:** todo o histórico armazenado no SQLite.

**Contexto ativo:** informações selecionadas para uma interação específica com o modelo.

Essa distinção é fundamental.

O sistema poderá armazenar milhares de mensagens sem precisar enviar todas elas ao modelo.

## 6.1. Composição do contexto

Inicialmente, o contexto poderá conter:

1. Instruções gerais do agente.
2. Identificação do projeto.
3. Descrição da tarefa atual.
4. Mensagens recentes relevantes.
5. Resultados das consultas realizadas.
6. Mensagem atual do usuário.

## 6.2. Consulta sob demanda

Exemplo de funcionamento:

O usuário solicita uma alteração em determinada rota.

O modelo identifica que precisa consultar `routes/produtos.js`.

O Agent solicita ao módulo Files a leitura desse arquivo.

O conteúdo é retornado ao Agent e incorporado ao contexto.

O modelo analisa o conteúdo e decide como prosseguir.

Se precisar consultar outro arquivo, poderá solicitar uma nova leitura.

O sistema não deverá carregar outros arquivos sem necessidade.

## 6.3. Limitação de contexto

O histórico completo será armazenado, mas somente uma parte dele será enviada em cada interação.

Inicialmente, serão utilizados limites configuráveis de mensagens recentes e quantidade de conteúdo dos arquivos.

Não será implementado um sistema complexo de contagem de tokens na primeira versão.

Durante os experimentos, serão observadas as métricas de avaliação de contexto retornadas pelo Ollama, permitindo ajustar os limites.

# 7. Gerenciamento da EAP

A EAP será representada por um documento Markdown.

A estrutura deverá utilizar identificadores estáveis para as etapas e tarefas.

Exemplo:

```text
EAP.md

MINI PROJETO

ETAPA 01 - ESTRUTURA INICIAL
    T001 - Configurar projeto
    T002 - Criar estrutura de diretórios

ETAPA 02 - INTEGRAÇÃO OLLAMA
    T003 - Estabelecer conexão
    T004 - Consultar modelos disponíveis

ETAPA 03 - PERSISTÊNCIA
    T005 - Configurar SQLite
    T006 - Armazenar conversas
```

Cada tarefa deverá possuir um documento individual.

Exemplo:

```text
tasks/
    T001.md
    T002.md
    T003.md
    T004.md
```

## 7.1. Separação entre planejamento e execução

O EAP.md será a referência da estrutura do planejamento.

O SQLite será a referência do estado de execução.

A aplicação não deverá modificar automaticamente a estrutura do EAP.md.

A atualização do plano será realizada por meio de uma operação de sincronização.

Tarefas identificadas por códigos já existentes deverão preservar seus estados registrados no banco.

Novas tarefas serão cadastradas como pendentes.

Alterações estruturais não deverão provocar a exclusão automática do histórico de tarefas anteriores.

## 7.2. Estados das tarefas

Os estados serão:

- pending;
- in_progress;
- completed;
- blocked.

A aplicação permitirá atualizar esses estados.

Uma tarefa somente será considerada concluída após a validação e confirmação do usuário.

Como o MVP não executará comandos de teste automaticamente, a validação poderá envolver testes realizados externamente.

## 7.3. Cálculo do progresso

O percentual de conclusão será calculado pela relação:

```text
Tarefas concluídas
------------------ × 100
Total de tarefas
```

Inicialmente, todas as tarefas terão o mesmo peso.

O progresso das etapas será calculado utilizando a mesma lógica, considerando exclusivamente as tarefas pertencentes à respectiva etapa.

# 8. Persistência e estrutura do banco de dados

Será utilizado SQLite.

O banco será armazenado localmente, em um diretório de dados do usuário, separado dos projetos manipulados pelo agente.

Localização inicial no Linux:

```text
~/.mini-agent/agent.db
```

Isso evita armazenar dados internos da aplicação dentro dos diretórios de projetos.

## 8.1. Estrutura lógica das tabelas

### Tabela: projects

Armazena os projetos cadastrados.

Campos previstos:

- id;
- name;
- root_path;
- created_at.

### Tabela: sessions

Armazena as sessões de trabalho.

Campos previstos:

- id;
- project_id;
- task_id;
- model_name;
- title;
- created_at;
- updated_at.

Cada sessão terá um modelo associado.

A troca de modelo deverá iniciar uma nova sessão, preservando o histórico anterior.

A troca de tarefa também deverá iniciar uma nova sessão de execução, evitando misturar contextos de atividades diferentes.

### Tabela: messages

Armazena as mensagens das conversas.

Campos previstos:

- id;
- session_id;
- role;
- content;
- metadata_json;
- created_at.

Os registros poderão identificar mensagens do usuário, do assistente e resultados de operações.

### Tabela: phases

Armazena as etapas da EAP.

Campos previstos:

- id;
- project_id;
- code;
- title;
- position.

### Tabela: tasks

Armazena as tarefas individuais.

Campos previstos:

- id;
- project_id;
- phase_id;
- code;
- title;
- task_file;
- status;
- created_at;
- updated_at.

### Tabela: operations

Armazena o histórico de operações.

Campos previstos:

- id;
- session_id;
- task_id;
- operation_type;
- target_path;
- status;
- details_json;
- created_at;
- completed_at.

Os estados das operações deverão permitir identificar propostas pendentes, operações aplicadas, rejeitadas e operações que apresentaram falhas.

## 8.2. Relacionamentos

A estrutura seguirá esta organização:

```text
PROJECTS
   |
   +------ PHASES
   |          |
   |          +------ TASKS
   |
   +------ SESSIONS
              |
              +------ MESSAGES
              |
              +------ OPERATIONS
```

As tabelas utilizarão chaves primárias e estrangeiras.

O sistema deverá habilitar a verificação de chaves estrangeiras no SQLite.

As operações que envolverem múltiplas gravações no banco deverão utilizar transações.

# 9. Gerenciamento do sistema de arquivos

O módulo Files será responsável por controlar todas as operações sobre os arquivos dos projetos.

## 9.1. Diretório autorizado

Cada projeto terá um diretório raiz definido pelo usuário.

As operações deverão respeitar esse diretório.

O agente não poderá acessar arquivos externos ao projeto, mesmo que o modelo solicite explicitamente.

## 9.2. Validação de caminhos

Os caminhos informados pelo modelo deverão ser validados pelo Node.js.

A aplicação deverá:

- Resolver caminhos relativos.
- Verificar se o caminho pertence ao diretório autorizado.
- Verificar links simbólicos.
- Impedir acesso externo ao projeto.
- Rejeitar caminhos inválidos.

A validação deverá ocorrer antes da leitura ou gravação.

## 9.3. Arquivos ignorados

As consultas deverão ignorar inicialmente diretórios que normalmente contêm dependências ou dados internos:

- .git
- node_modules
- .mini-agent

A lista poderá ser ampliada posteriormente.

Arquivos binários não deverão ser enviados ao modelo como texto.

## 9.4. Criação de arquivos

Para criar um arquivo:

1. O modelo apresenta uma proposta.
2. A aplicação valida o caminho.
3. A interface apresenta o nome e o conteúdo proposto.
4. O usuário autoriza ou rejeita.
5. A aplicação executa a gravação.
6. O resultado é registrado.

Arquivos existentes não poderão ser sobrescritos por essa operação.

## 9.5. Edição de arquivos

Para modificar um arquivo existente, será utilizada inicialmente a substituição de trechos específicos.

O modelo deverá informar:

- Arquivo de destino.
- Trecho original.
- Novo trecho.

A aplicação deverá verificar se o trecho original existe exatamente uma vez.

Caso não exista ou apareça mais de uma vez, a operação será rejeitada.

Antes da aprovação, a aplicação apresentará uma visualização da alteração.

No momento da gravação, o conteúdo original será verificado novamente para evitar aplicar uma proposta sobre um arquivo que tenha sido modificado desde sua leitura.

# 10. Fluxo operacional de uma tarefa

O fluxo padrão de execução será:

```text
       USUÁRIO SELECIONA TAREFA
                   |
                   v
          CARREGAR ARQUIVO .MD
                   |
                   v
           PREPARAR CONTEXTO
                   |
                   v
            ENVIAR AO LLM
                   |
                   v
           RECEBER RESPOSTA
                   |
                   v
           VALIDAR RESPOSTA
                   |
          +--------+--------+
          |                 |
          v                 v
    SOLICITAR TOOL       PROPOSTA
          |                 |
          v                 v
    EXECUTAR LEITURA    APROVAÇÃO
          |                 |
          v                 v
    RETORNAR CONTEXTO   GRAVAR ARQUIVO
          |                 |
          +--------+--------+
                   |
                   v
             NOVA ANÁLISE
                   |
          +--------+--------+
          |                 |
          v                 v
      CONTINUAR          RESPOSTA
       TAREFA              FINAL
                            |
                            v
                    VALIDAR RESULTADO
                            |
                            v
                    ATUALIZAR STATUS
```

O ciclo poderá se repetir enquanto a tarefa estiver em execução.

Caso o modelo não consiga prosseguir, deverá informar o impedimento.

A aplicação não deverá considerar uma tarefa concluída automaticamente após uma resposta final.

A conclusão dependerá da confirmação do usuário.

# 11. Estrutura de diretórios do Mini Agent

A organização inicial do repositório será:

```text
mini_agent/
│
├── docs/
│   ├── PRD.md
│   ├── ARQUITETURA.md
│   └── EAP.md
│
├── tasks/
│
├── prompts/
│   └── system.md
│
├── src/
│   ├── app.js
│   ├── cli.js
│   ├── agent.js
│   ├── ollama.js
│   ├── context.js
│   ├── tasks.js
│   ├── files.js
│   ├── database.js
│   └── config.js
│
├── tests/
│
├── .gitignore
│
└── package.json
```

## 11.1. Responsabilidades dos arquivos

| Arquivo | Responsabilidade |
|---|---|
| app.js | Inicialização e encerramento da aplicação. |
| cli.js | Interface de terminal. |
| agent.js | Coordenação das tarefas e interações. |
| ollama.js | Comunicação com Ollama. |
| context.js | Preparação do contexto. |
| tasks.js | Carregamento da EAP e tarefas. |
| files.js | Operações no sistema de arquivos. |
| database.js | Persistência SQLite. |
| config.js | Configurações gerais. |
| system.md | Instruções gerais do agente. |

A estrutura representa a organização desejada, mas os arquivos serão criados progressivamente durante o desenvolvimento.

Não será necessário implementar todos os módulos antecipadamente.

## 11.2. Separação dos dados

O código-fonte e a documentação permanecerão no repositório.

O banco de dados de execução será armazenado no diretório local do usuário.

Os projetos manipulados pelo Mini Agent permanecerão independentes da aplicação.

# 12. Interface e comandos

A interface deverá permitir interação por mensagens e comandos específicos.

Comandos iniciais:

| Comando | Função |
|---|---|
| /help | Apresentar ajuda. |
| /project | Consultar ou selecionar projeto. |
| /model | Consultar ou selecionar modelo. |
| /task | Consultar ou carregar tarefa. |
| /eap | Apresentar andamento do projeto. |
| /files | Listar arquivos. |
| /history | Consultar sessões anteriores. |
| /exit | Encerrar aplicação. |

A interface também deverá apresentar informações básicas da sessão:

- Nome do projeto.
- Modelo ativo.
- Tarefa atual.
- Etapa correspondente.
- Estado da tarefa.

# 13. Segurança e integridade

As operações deverão ser controladas exclusivamente pela aplicação.

O LLM não terá acesso direto ao sistema operacional.

O Mini Agent não executará comandos arbitrários no terminal.

As operações de gravação deverão possuir aprovação explícita.

As alterações deverão ser registradas no SQLite.

A aplicação deverá interromper operações quando identificar caminhos externos ao projeto autorizado.

A gravação deverá ser realizada de maneira controlada, preferencialmente utilizando escrita temporária seguida de substituição do arquivo, para reduzir o risco de arquivos parcialmente gravados.

# 14. Tratamento de erros

A aplicação deverá identificar e apresentar mensagens para as seguintes ocorrências:

| Ocorrência | Comportamento esperado |
|---|---|
| Ollama indisponível | Informar falha de conexão. |
| Modelo inexistente | Solicitar seleção de outro modelo. |
| Resposta inválida | Rejeitar e solicitar nova resposta ou interromper. |
| JSON malformado | Não executar a operação. |
| Arquivo inexistente | Informar e permitir nova consulta. |
| Caminho externo | Bloquear operação. |
| Arquivo muito grande | Informar limitação de contexto. |
| Gravação rejeitada | Preservar arquivo original. |
| Falha no SQLite | Interromper operação dependente do banco e informar erro. |
| Ciclo excessivo de operações | Pausar execução e solicitar intervenção. |

# 15. Estratégia de testes

Os testes deverão acompanhar a implementação de cada componente.

Serão utilizados dois níveis de verificação.

**15.1. Testes funcionais dos módulos**

Verificar individualmente:

- Comunicação com Ollama.
- Conexão com SQLite.
- Persistência de mensagens.
- Leitura de arquivos.
- Validação de caminhos.
- Criação de arquivos.
- Substituição de trechos.
- Carregamento da EAP.

Os testes poderão utilizar o módulo nativo `node:test`, evitando a inclusão inicial de um framework adicional.

**15.2. Testes de integração com LLMs**

Utilizar modelos locais de diferentes capacidades.

Observar:

- Interpretação das tarefas.
- Produção de JSON válido.
- Seleção das operações corretas.
- Necessidade de consultas adicionais.
- Qualidade das alterações.
- Quantidade de interações.
- Consumo de contexto.
- Tempo de execução.

O objetivo será identificar quais tarefas podem ser executadas satisfatoriamente por modelos pequenos.

# 16. Decisões técnicas reservadas para evolução

Não serão implementadas inicialmente:

- Interface gráfica.
- Comunicação com APIs externas.
- Tool calling nativo como dependência obrigatória.
- Execução de comandos no terminal.
- Planejamento automático.
- Múltiplos agentes.
- Busca vetorial.
- Indexação automática de projetos.
- Memória semântica de longo prazo.
- Sistema avançado de diff.
- Gerenciamento Git integrado.
- Execução automática de testes.

Essas funcionalidades poderão ser avaliadas após a validação do MVP 0.1.

# 17. Considerações sobre desempenho

A arquitetura deverá privilegiar operações de baixo custo computacional.

As principais estratégias serão:

1. Consultar arquivos somente quando necessário.
2. Limitar o histórico enviado ao modelo.
3. Evitar requisições desnecessárias.
4. Executar uma operação por resposta do modelo.
5. Manter as informações persistidas no SQLite.
6. Evitar processamento em paralelo de múltiplas tarefas.
7. Utilizar respostas estruturadas para reduzir ambiguidades.

A primeira implementação utilizará respostas não transmitidas em streaming, simplificando a interpretação do JSON.

O streaming poderá ser incorporado posteriormente.

# 18. Diretriz de implementação

A construção seguirá uma abordagem incremental orientada pela EAP.

Cada módulo deverá ser desenvolvido, testado e integrado progressivamente.

A implementação deverá privilegiar código simples e compreensível, evitando abstrações que não tragam benefícios concretos.

O desenvolvimento deverá manter correspondência com os requisitos do PRD.

Alterações arquiteturais relevantes deverão ser documentadas antes de modificar a implementação.

---

# DEFINIÇÃO ARQUITETURAL

O Mini Agent será uma aplicação modular, executada localmente, que utilizará o Ollama como mecanismo de inferência e o Node.js como ambiente de coordenação.

O sistema fornecerá ao modelo somente o contexto necessário para executar a tarefa atual, disponibilizando ferramentas controladas para consultar e modificar arquivos.

A aplicação será responsável pela persistência, validação, autorização e acompanhamento das operações.

**O princípio arquitetural fundamental é transferir para o software a complexidade operacional que não precisa ser executada pelo modelo de linguagem.**

Dessa forma, pretende-se ampliar a viabilidade de utilização de LLMs pequenos em atividades práticas de desenvolvimento de software.
