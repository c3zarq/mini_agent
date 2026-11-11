# MINI AGENT
## Product Requirements Document (PRD)
**Versão:** 0.1<br>
**Status:** Aprovado para planejamento técnico<br>
**Categoria:** Agente local de desenvolvimento assistido por LLM<br>
**Interface:** CLI (Command Line Interface)

---

# 1. Visão geral do produto

O Mini Agent é uma aplicação local de desenvolvimento assistido por inteligência artificial, projetada para operar com modelos de linguagem de pequeno porte (LLMs), executados por meio do Ollama.

Sua finalidade é permitir que modelos locais auxiliem no desenvolvimento de software, oferecendo recursos que não estão disponíveis em uma interação convencional com o Ollama pelo terminal, como persistência de conversas, consulta de arquivos de projetos, criação e edição de código e gerenciamento de tarefas.

A aplicação funcionará como uma camada intermediária entre o usuário, os modelos de linguagem e o sistema de arquivos.

Diferentemente de agentes de desenvolvimento que recebem solicitações amplas e precisam planejar autonomamente todo o trabalho, o Mini Agent terá como princípio a execução de tarefas previamente planejadas, detalhadas e segmentadas de acordo com a capacidade do modelo utilizado.

O sistema será responsável por fornecer o contexto necessário, disponibilizar ferramentas controladas, organizar as operações e acompanhar o progresso do desenvolvimento.

# 2. Problema identificado

Modelos de linguagem pequenos podem apresentar resultados satisfatórios em tarefas específicas quando utilizados diretamente pelo Ollama.

Entretanto, sua utilização em plataformas de desenvolvimento assistido por IA pode apresentar dificuldades, especialmente quando as atividades exigem:

- Interpretação de grandes quantidades de contexto.
- Planejamento de múltiplas operações.
- Utilização de ferramentas externas.
- Manipulação de diversos arquivos.
- Coordenação de tarefas encadeadas.
- Manutenção de contexto durante operações prolongadas.

Essas dificuldades não estão necessariamente relacionadas apenas à capacidade de geração de código, mas também à complexidade operacional exigida do modelo.

O Mini Agent propõe uma abordagem diferente: transferir parte da inteligência operacional para a aplicação, reduzindo as exigências sobre o LLM.

# 3. Objetivos do produto

## 3.1. Objetivo geral

Desenvolver uma aplicação local capaz de executar pequenas tarefas de programação utilizando modelos de linguagem de baixa capacidade, oferecendo persistência, gerenciamento de contexto e manipulação controlada de arquivos.

## 3.2. Objetivos específicos

1. Integrar modelos locais disponibilizados pelo Ollama.
2. Manter conversas persistentes por meio de SQLite.
3. Associar sessões de trabalho a diretórios específicos de projetos.
4. Permitir a consulta de arquivos sob demanda.
5. Permitir a criação e edição controlada de arquivos.
6. Receber tarefas previamente especificadas em documentos Markdown.
7. Acompanhar o andamento de uma Estrutura Analítica do Projeto (EAP).
8. Registrar as operações realizadas pelo agente.
9. Reduzir a quantidade de contexto necessária para cada interação.
10. Permitir experimentações com diferentes modelos locais de pequeno porte.

# 4. Público-alvo e ambiente de utilização

O Mini Agent será inicialmente uma aplicação de uso pessoal e doméstico, sem distribuição comercial prevista.

O usuário possui conhecimentos introdutórios de programação e deseja utilizar modelos locais em um ambiente computacional com recursos limitados.

O sistema deverá priorizar:

- Baixo consumo de recursos computacionais.
- Simplicidade de instalação e utilização.
- Independência de serviços externos.
- Facilidade de manutenção.
- Transparência nas operações.
- Compatibilidade com diferentes modelos disponibilizados pelo Ollama.

O ambiente inicial de desenvolvimento e execução será Linux (Ubuntu).

# 5. Princípios fundamentais

O desenvolvimento deverá respeitar os seguintes princípios:

**5.1. Segmentação de tarefas**

O agente executará uma tarefa por vez. As atividades deverão ser previamente planejadas e divididas em unidades pequenas e objetivas.

**5.2. Contexto sob demanda**

O agente não deverá carregar automaticamente todos os arquivos de um projeto. A consulta será realizada conforme a necessidade identificada durante a execução.

**5.3. Inteligência operacional**

A aplicação será responsável pelo gerenciamento de arquivos, histórico, tarefas, permissões e operações. O LLM será responsável pela interpretação das instruções e pela produção de respostas e propostas de alteração.

**5.4. Autonomia controlada**

O agente poderá analisar arquivos e propor soluções, mas não poderá modificar o projeto sem autorização do usuário.

**5.5. Simplicidade**

A implementação deverá privilegiar soluções diretas, com poucas dependências e baixa complexidade arquitetural.

**5.6. Independência de modelo**

A aplicação não deverá depender exclusivamente de um modelo específico. O usuário poderá selecionar entre os modelos disponíveis no Ollama.

# 6. Escopo funcional do MVP 0.1

O MVP deverá contemplar as seguintes funcionalidades.

## 6.1. Interface de terminal (CLI)

A aplicação deverá oferecer uma interface textual para interação com o usuário.

Deverá permitir:

- Iniciar e encerrar sessões.
- Visualizar informações do projeto.
- Selecionar modelos disponíveis.
- Carregar tarefas.
- Consultar o andamento da EAP.
- Visualizar o histórico de conversas.
- Autorizar ou rejeitar alterações propostas.

A interface deverá priorizar clareza e simplicidade, evitando elementos gráficos complexos.

## 6.2. Integração com Ollama

A aplicação deverá estabelecer comunicação com a API HTTP local do Ollama.

Deverá permitir:

- Identificar os modelos disponíveis.
- Selecionar o modelo utilizado na sessão.
- Enviar mensagens ao modelo.
- Receber e interpretar as respostas.
- Tratar erros de comunicação.
- Identificar situações em que a resposta produzida não corresponde ao formato esperado.

A integração não deverá exigir acesso a serviços externos ou APIs pagas.

## 6.3. Gerenciamento de conversas

As conversas deverão ser persistidas em SQLite.

Cada sessão deverá estar associada a:

- Um projeto.
- Um modelo utilizado.
- Uma sequência de mensagens.
- Uma tarefa, quando aplicável.
- Data e horário das interações.

O usuário deverá conseguir encerrar a aplicação e recuperar uma conversa posteriormente.

O histórico armazenado será utilizado para reconstruir o contexto necessário, respeitando os limites do modelo.

A persistência não deverá depender de funcionalidades de memória próprias do LLM.

## 6.4. Gerenciamento de projetos

O usuário deverá conseguir associar uma sessão a um diretório de projeto.

O agente deverá conhecer o diretório autorizado e utilizar esse caminho como referência para as operações de arquivos.

Não deverá ser necessário carregar previamente todo o conteúdo do projeto.

## 6.5. Consulta de arquivos

O agente deverá dispor de ferramentas para consultar o conteúdo do projeto.

Operações previstas:

- Listar arquivos e diretórios.
- Procurar termos em arquivos.
- Ler arquivos específicos.

As consultas deverão ser realizadas sob demanda, de acordo com as necessidades da tarefa atual.

O acesso deverá respeitar o diretório autorizado.

## 6.6. Criação e edição de arquivos

O agente deverá conseguir propor a criação de novos arquivos e alterações em arquivos existentes.

O fluxo deverá contemplar:

1. Identificação do arquivo de destino.
2. Elaboração da alteração pelo LLM.
3. Apresentação da proposta ao usuário.
4. Aprovação ou rejeição.
5. Aplicação da alteração.
6. Registro da operação no banco de dados.

Nenhuma gravação deverá ocorrer sem aprovação explícita.

## 6.7. Gerenciamento de tarefas Markdown

O sistema deverá utilizar documentos Markdown como formato de entrada das tarefas.

Cada tarefa deverá possuir, preferencialmente, os seguintes elementos:

- Identificador.
- Título.
- Objetivo.
- Contexto.
- Arquivos relevantes.
- Instruções.
- Restrições.
- Resultado esperado.
- Critérios de aceitação.

O agente deverá carregar e interpretar uma tarefa por vez.

O planejamento e a decomposição das atividades serão realizados externamente, por ferramentas ou pessoas com capacidade adequada para essa finalidade.

O Mini Agent não deverá planejar autonomamente a EAP nem distribuir atividades.

## 6.8. Acompanhamento da EAP

O sistema deverá permitir o acompanhamento do desenvolvimento por meio de uma Estrutura Analítica do Projeto.

A EAP será documentada em Markdown e deverá organizar o trabalho hierarquicamente:

Projeto → Etapas → Tarefas.

O SQLite será responsável por armazenar o estado de execução.

Estados previstos para as tarefas:

| Estado | Significado |
|---|---|
| Pendente | A tarefa ainda não foi iniciada. |
| Em execução | A tarefa está sendo executada. |
| Concluída | A execução foi finalizada e validada. |
| Bloqueada | Existe algum impedimento à continuidade. |

O sistema deverá calcular o progresso das etapas e do projeto com base no estado das tarefas.

A interface deverá permitir visualizar:

- Etapa atual.
- Tarefa selecionada.
- Estado das tarefas.
- Percentual de conclusão.
- Tarefas pendentes.
- Tarefas bloqueadas.

O agente não deverá selecionar automaticamente a próxima tarefa.

A seleção e o avanço do plano permanecerão sob controle do usuário.

## 6.9. Histórico de operações

O sistema deverá registrar as principais operações executadas.

Entre elas:

- Leitura de arquivos.
- Criação de arquivos.
- Edição de arquivos.
- Aprovação ou rejeição de alterações.
- Início e conclusão de tarefas.
- Ocorrências de bloqueio.

O registro deverá permitir identificar quais operações foram realizadas e em qual contexto.

# 7. Requisitos não funcionais

## 7.1. Desempenho

A aplicação deverá ser adequada à execução em computadores domésticos com recursos limitados.

A lógica de gerenciamento de tarefas e arquivos deverá apresentar baixo consumo de memória e processamento.

Não será exigido que o aplicativo acelere a inferência do modelo, cuja velocidade dependerá do hardware e do LLM utilizado.

## 7.2. Persistência

As informações relevantes deverão permanecer armazenadas após o encerramento da aplicação.

O banco SQLite deverá ser utilizado para conversas, tarefas, estados e registros de operações.

## 7.3. Manutenibilidade

O código deverá ser organizado em módulos com responsabilidades específicas.

A implementação deverá evitar dependências desnecessárias e abstrações excessivas.

## 7.4. Portabilidade

A aplicação deverá utilizar tecnologias que permitam sua execução em ambientes Linux.

A arquitetura deverá evitar dependências específicas de um único equipamento.

## 7.5. Confiabilidade

O sistema deverá validar as operações solicitadas pelo LLM antes de executá-las.

Respostas inválidas ou incompletas não deverão provocar alterações indevidas no projeto.

# 8. Segurança e permissões

Como a aplicação terá acesso ao sistema de arquivos, deverão existir mecanismos básicos de proteção.

Requisitos:

1. Restringir as operações ao diretório autorizado.
2. Impedir acesso a arquivos externos ao projeto.
3. Não permitir execução de comandos arbitrários pelo sistema operacional.
4. Exigir aprovação antes de qualquer gravação.
5. Validar os caminhos dos arquivos.
6. Registrar as operações executadas.
7. Preservar o conteúdo original até a aprovação das alterações propostas.

A aplicação deverá atuar como intermediária entre o modelo e o sistema operacional, não permitindo que o LLM execute diretamente operações irrestritas.

# 9. Tecnologias previstas

| Tecnologia | Aplicação |
|---|---|
| JavaScript | Linguagem principal. |
| Node.js | Ambiente de execução. |
| Ollama API | Comunicação com modelos locais. |
| SQLite | Banco de dados. |
| better-sqlite3 | Biblioteca de acesso ao SQLite. |
| readline | Interface de terminal. |
| JSON | Protocolo de comunicação estruturada. |
| Markdown | Documentação da EAP e descrição das tarefas. |
| Git | Versionamento do código-fonte. |

Não serão utilizados frameworks web ou bibliotecas de interface gráfica no MVP 0.1.

# 10. Arquitetura conceitual

A aplicação deverá ser organizada em componentes independentes:

| Componente | Responsabilidade |
|---|---|
| CLI | Interação com o usuário. |
| Agent | Coordenação das interações e execução das tarefas. |
| Ollama | Comunicação com os modelos locais. |
| Context | Seleção e gerenciamento das informações enviadas ao modelo. |
| Tasks | Carregamento e gerenciamento das tarefas e da EAP. |
| Files | Consulta, criação e edição de arquivos. |
| Database | Persistência das informações. |

O componente Agent deverá coordenar os demais, mantendo o controle do fluxo de execução.

O modelo deverá interagir com os recursos disponibilizados por meio de um protocolo estruturado, inicialmente baseado em JSON.

A aplicação será responsável por validar as solicitações, executar as operações autorizadas e retornar os resultados ao modelo.

Os detalhes de implementação e comunicação entre componentes serão definidos no documento de arquitetura técnica.

# 11. Fluxo operacional previsto

O funcionamento básico deverá seguir esta sequência:

1. O usuário inicia o Mini Agent.
2. Seleciona ou informa o diretório do projeto.
3. Seleciona um modelo disponível no Ollama.
4. Inicia uma nova conversa ou recupera uma sessão existente.
5. Consulta a EAP e seleciona uma tarefa.
6. A aplicação carrega o documento Markdown correspondente.
7. O agente interpreta as instruções.
8. O modelo solicita a consulta dos arquivos necessários.
9. A aplicação disponibiliza o conteúdo solicitado.
10. O modelo analisa o contexto e propõe uma solução.
11. A aplicação apresenta a alteração ao usuário.
12. O usuário aprova ou rejeita a proposta.
13. A aplicação realiza a gravação, quando autorizada.
14. O sistema registra as operações e atualiza o estado da tarefa.
15. O usuário acompanha o progresso da EAP.

Caso o agente não consiga prosseguir, deverá informar o impedimento e permitir que o usuário intervenha.

# 12. Funcionalidades fora do escopo

As seguintes funcionalidades não serão implementadas na versão 0.1:

- Interface gráfica.
- Desenvolvimento de aplicações web completas.
- Planejamento automático de projetos.
- Decomposição automática de tarefas.
- Execução autônoma de múltiplas tarefas.
- Arquitetura multiagente.
- Execução de comandos arbitrários no terminal.
- Gerenciamento automatizado de Git.
- Integração com serviços de IA em nuvem.
- Indexação vetorial de projetos.
- Sistema avançado de busca semântica.
- Gerenciamento de usuários e permissões múltiplas.
- Distribuição comercial ou publicação em lojas de aplicativos.

Essas funcionalidades poderão ser avaliadas em versões futuras, conforme os resultados obtidos com o MVP.

# 13. Critérios de aceitação do MVP

O Mini Agent 0.1 será considerado funcional quando cumprir os seguintes testes:

| ID | Critério | Resultado esperado |
|---|---|---|
| CA01 | Conexão com Ollama | Aplicação consegue estabelecer comunicação local. |
| CA02 | Seleção de modelo | Usuário consegue identificar e selecionar modelos disponíveis. |
| CA03 | Conversação | Usuário consegue conversar com o modelo pelo terminal. |
| CA04 | Persistência | Conversas são armazenadas e recuperadas pelo SQLite. |
| CA05 | Carregamento de tarefa | Aplicação consegue carregar uma tarefa Markdown. |
| CA06 | Consulta de arquivos | Agente consegue solicitar a leitura de arquivos do projeto. |
| CA07 | Criação de arquivos | Agente consegue propor e criar arquivos mediante aprovação. |
| CA08 | Edição de arquivos | Agente consegue propor e aplicar alterações mediante aprovação. |
| CA09 | Registro de operações | Operações relevantes são armazenadas no SQLite. |
| CA10 | Acompanhamento da EAP | Aplicação apresenta etapas, tarefas e respectivos estados. |
| CA11 | Atualização de progresso | Conclusões validadas atualizam os indicadores de andamento. |
| CA12 | Proteção do projeto | Operações externas ao diretório autorizado são bloqueadas. |

# 14. Estratégia de desenvolvimento

O projeto será desenvolvido incrementalmente, utilizando uma EAP própria.

Cada tarefa deverá possuir descrição objetiva, contexto suficiente, restrições e critérios de aceitação.

O desenvolvimento será realizado manualmente, com assistência do ChatGPT, privilegiando a compreensão do código e a participação ativa do usuário.

Cada etapa deverá ser testada antes do início da seguinte.

O Git será utilizado para controle de versões e recuperação de estados anteriores.

Não serão antecipadas funcionalidades que não sejam necessárias para o funcionamento do MVP.

# 15. Indicadores experimentais

Além dos critérios funcionais, o projeto deverá permitir avaliar a viabilidade da utilização de modelos pequenos em atividades de desenvolvimento.

Serão observados:

- Modelos utilizados e respectivos tamanhos.
- Sucesso na interpretação das tarefas.
- Sucesso na utilização do protocolo estruturado.
- Quantidade de interações necessárias para concluir uma tarefa.
- Quantidade de arquivos consultados.
- Consumo de contexto.
- Ocorrência de respostas inválidas.
- Necessidade de intervenção humana.
- Tempo de execução das tarefas.

Esses indicadores servirão como referência para experimentações e futuras versões.

# 16. Diretriz de evolução

O desenvolvimento do Mini Agent deverá seguir uma abordagem incremental.

A versão 0.1 terá como prioridade demonstrar que um modelo local pequeno consegue executar tarefas reais de programação quando recebe instruções adequadas, contexto controlado e ferramentas específicas.

A evolução do produto deverá ser orientada pelos resultados obtidos durante os testes, e não pela antecipação de funcionalidades complexas.

---

## DEFINIÇÃO DO PRODUTO

**Mini Agent é um executor local de tarefas de desenvolvimento assistido por LLM, projetado para compensar as limitações de modelos pequenos por meio da segmentação de atividades, do gerenciamento de contexto e do controle operacional realizado pela própria aplicação.**

Sua premissa fundamental é:

**Em vez de exigir mais capacidade do modelo, organizar o trabalho para que a capacidade disponível seja suficiente.**
