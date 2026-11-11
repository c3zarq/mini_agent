# MINI AGENT
## Documento 03 — Estrutura Analítica do Projeto (EAP)

**Versão:** 0.1<br>
**Referências:** PRD 0.1 e Arquitetura Técnica 0.1<br>
**Objetivo:** Desenvolvimento do MVP funcional.

---

# 1. Objetivo da EAP

Este documento organiza o desenvolvimento do Mini Agent em etapas e tarefas menores, permitindo execução incremental, acompanhamento do progresso e validação dos resultados.

A EAP foi estruturada considerando:

- Dependências entre funcionalidades.
- Complexidade de implementação.
- Conhecimentos necessários.
- Capacidade esperada dos modelos locais.
- Facilidade de teste e validação.
- Evolução progressiva da aplicação.

Cada tarefa deverá possuir um documento Markdown individual, contendo instruções detalhadas para sua execução pelo Mini Agent, quando este estiver disponível.

Durante a construção do próprio Mini Agent, as tarefas serão executadas manualmente, com assistência do ChatGPT.

# 2. Organização geral

O projeto está dividido em nove etapas:

| Código | Etapa | Objetivo |
|---|---|---|
| P01 | Estrutura inicial | Preparar o ambiente e estabelecer a estrutura do projeto. |
| P02 | Integração com Ollama | Estabelecer comunicação com os modelos locais. |
| P03 | Persistência | Implementar o banco de dados SQLite. |
| P04 | Projetos e tarefas | Implementar carregamento e gerenciamento da EAP. |
| P05 | Sistema de arquivos e contexto | Permitir consulta controlada aos arquivos. |
| P06 | Núcleo do agente | Implementar o protocolo de comunicação e execução. |
| P07 | Criação e edição de arquivos | Implementar alterações controladas mediante aprovação. |
| P08 | Interface e acompanhamento | Integrar funcionalidades à CLI e apresentar o progresso. |
| P09 | Testes e finalização | Validar o funcionamento e documentar o MVP. |

# 3. EAP detalhada

## P01 — Estrutura inicial

**Objetivo:** preparar o ambiente de desenvolvimento e estabelecer a estrutura básica da aplicação.

| ID | Tarefa | Resultado esperado |
|---|---|---|
| T001 | Inicializar projeto Node.js | Projeto configurado com package.json. |
| T002 | Criar estrutura de diretórios | Diretórios e arquivos iniciais organizados. |
| T003 | Configurar ambiente e dependências | Dependências mínimas instaladas e configuração inicial definida. |
| T004 | Implementar inicialização da aplicação | Aplicação consegue iniciar e encerrar pelo terminal. |

**Critério de conclusão da etapa:** projeto inicializado, organizado e executando corretamente no Ubuntu.

---

## P02 — Integração com Ollama

**Objetivo:** estabelecer comunicação com o Ollama e verificar a compatibilidade com modelos pequenos.

| ID | Tarefa | Resultado esperado |
|---|---|---|
| T005 | Implementar conexão com Ollama | Aplicação consegue consultar a API local. |
| T006 | Consultar modelos disponíveis | Modelos instalados são identificados. |
| T007 | Implementar comunicação com modelo | Aplicação envia mensagens e recebe respostas. |
| T008 | Testar respostas estruturadas JSON | Modelo consegue produzir respostas no protocolo estabelecido. |

**Critério de conclusão da etapa:** aplicação consegue conversar com modelos locais e interpretar respostas estruturadas.

**Observação:** T008 será um ponto de validação experimental. Os testes deverão utilizar preferencialmente modelos de até 1,5 GB, verificando a viabilidade do protocolo antes de avançarmos.

---

## P03 — Persistência SQLite

**Objetivo:** implementar o armazenamento permanente das informações da aplicação.

| ID | Tarefa | Resultado esperado |
|---|---|---|
| T009 | Configurar banco SQLite | Banco local inicializado. |
| T010 | Criar estrutura de tabelas | Tabelas e relacionamentos implementados. |
| T011 | Implementar persistência de projetos e sessões | Projetos e sessões podem ser registrados e recuperados. |
| T012 | Implementar persistência de mensagens | Conversas podem ser armazenadas e recuperadas. |
| T013 | Implementar registro de operações | Histórico de operações pode ser armazenado. |

**Critério de conclusão da etapa:** informações essenciais permanecem disponíveis após o encerramento da aplicação.

---

## P04 — Gerenciamento de projetos e tarefas

**Objetivo:** implementar o carregamento de projetos, documentos Markdown e estrutura da EAP.

| ID | Tarefa | Resultado esperado |
|---|---|---|
| T014 | Implementar cadastro de projetos | Projeto associado a um diretório de trabalho. |
| T015 | Definir formato padronizado da EAP | Estrutura Markdown reconhecida pela aplicação. |
| T016 | Implementar leitura e interpretação da EAP | Etapas e tarefas identificadas. |
| T017 | Definir modelo de documento de tarefa | Template Markdown padronizado. |
| T018 | Implementar carregamento de tarefas | Aplicação consegue interpretar uma tarefa individual. |
| T019 | Implementar sincronização da EAP com SQLite | Tarefas cadastradas e estados preservados. |

**Critério de conclusão da etapa:** aplicação consegue identificar projetos, etapas e tarefas, mantendo seus estados no SQLite.

---

## P05 — Sistema de arquivos e gerenciamento de contexto

**Objetivo:** permitir que o agente consulte arquivos do projeto conforme a necessidade.

| ID | Tarefa | Resultado esperado |
|---|---|---|
| T020 | Implementar validação de caminhos | Acesso restrito ao diretório autorizado. |
| T021 | Implementar listagem de arquivos | Arquivos e diretórios podem ser consultados. |
| T022 | Implementar pesquisa em arquivos | Termos podem ser localizados nos arquivos do projeto. |
| T023 | Implementar leitura de arquivos | Conteúdo de arquivos pode ser disponibilizado ao agente. |
| T024 | Implementar preparação de contexto | Informações necessárias são organizadas para envio ao modelo. |
| T025 | Implementar limitação de contexto | Histórico e conteúdo são controlados antes das requisições. |

**Critério de conclusão da etapa:** agente consegue consultar arquivos específicos sem carregar automaticamente todo o projeto.

---

## P06 — Núcleo do agente

**Objetivo:** implementar a lógica central de interpretação e coordenação das operações.

| ID | Tarefa | Resultado esperado |
|---|---|---|
| T026 | Criar instruções gerais do agente | Prompt de sistema estabelecido. |
| T027 | Implementar protocolo JSON | Estrutura de respostas definida e validada. |
| T028 | Implementar comunicação entre Agent e Ollama | Agent consegue enviar contexto e receber respostas. |
| T029 | Implementar interpretação de operações | Solicitações do modelo são identificadas e classificadas. |
| T030 | Implementar execução de ferramentas de leitura | Agent consegue solicitar operações ao módulo Files. |
| T031 | Implementar ciclo controlado de execução | Modelo pode consultar arquivos e receber resultados sucessivamente. |
| T032 | Implementar limites e tratamento de falhas | Ciclos excessivos e respostas inválidas são controlados. |

**Critério de conclusão da etapa:** o agente consegue receber uma tarefa, consultar arquivos e produzir respostas utilizando o contexto disponível.

---

## P07 — Criação e edição de arquivos

**Objetivo:** permitir que o agente proponha e aplique alterações controladas no projeto.

| ID | Tarefa | Resultado esperado |
|---|---|---|
| T033 | Implementar proposta de criação de arquivos | Modelo consegue apresentar novos arquivos. |
| T034 | Implementar aprovação de criação | Usuário autoriza ou rejeita a criação. |
| T035 | Implementar proposta de edição | Modelo consegue propor substituições de trechos. |
| T036 | Implementar validação de alterações | Aplicação verifica conteúdo original e integridade do arquivo. |
| T037 | Implementar aprovação e gravação de alterações | Alterações autorizadas são aplicadas e registradas. |

**Critério de conclusão da etapa:** agente consegue criar e modificar arquivos mediante autorização explícita do usuário.

---

## P08 — Interface e acompanhamento do projeto

**Objetivo:** integrar os módulos e disponibilizar uma interface funcional pelo terminal.

| ID | Tarefa | Resultado esperado |
|---|---|---|
| T038 | Implementar interface conversacional | Usuário consegue interagir com o agente pelo terminal. |
| T039 | Implementar seleção de modelo | Usuário consegue escolher o modelo ativo. |
| T040 | Implementar comandos de projeto e tarefas | Usuário consegue consultar projetos e selecionar tarefas. |
| T041 | Implementar gerenciamento de sessões | Conversas podem ser iniciadas e recuperadas. |
| T042 | Implementar visualização da EAP | Etapas, tarefas e estados são apresentados. |
| T043 | Implementar cálculo de progresso | Percentuais de conclusão são calculados automaticamente. |
| T044 | Implementar interface de aprovação | Propostas de alteração são apresentadas para autorização. |
| T045 | Implementar ajuda e comandos gerais | Comandos da aplicação são apresentados e funcionais. |

**Critério de conclusão da etapa:** funcionalidades integradas em uma interface de terminal utilizável.

---

## P09 — Testes e finalização

**Objetivo:** validar o funcionamento do MVP e documentar sua utilização.

| ID | Tarefa | Resultado esperado |
|---|---|---|
| T046 | Executar testes individuais dos módulos | Componentes validados isoladamente. |
| T047 | Executar testes integrados | Fluxos completos de execução validados. |
| T048 | Testar com modelos pequenos | Compatibilidade e limitações identificadas. |
| T049 | Avaliar consumo de contexto e desempenho | Dados experimentais registrados. |
| T050 | Corrigir problemas identificados | Falhas relevantes solucionadas. |
| T051 | Produzir documentação de utilização | Instruções de instalação e operação disponíveis. |
| T052 | Validar critérios de aceitação do PRD | Requisitos do MVP verificados. |

**Critério de conclusão da etapa:** aplicação funcional, testada e documentada.

---

# 4. Dependências entre etapas

A sequência principal de desenvolvimento será:

```text
P01 — Estrutura inicial
 |
 v
P02 — Integração com Ollama
 |
 v
P03 — Persistência
 |
 v
P04 — Projetos e tarefas
 |
 v
P05 — Sistema de arquivos e contexto
 |
 v
P06 — Núcleo do agente
 |
 v
P07 — Criação e edição
 |
 v
P08 — Interface e acompanhamento
 |
 v
P09 — Testes e finalização
```

A sequência representa a ordem recomendada.

Algumas atividades poderão ser desenvolvidas em paralelo, desde que suas dependências estejam satisfeitas. Entretanto, considerando o caráter didático do projeto, recomenda-se manter a sequência proposta.

# 5. Padrão de identificação das tarefas

Cada tarefa deverá possuir um identificador único e permanente.

Formato:

`T001`, `T002`, `T003`...

Os arquivos individuais deverão utilizar o identificador como prefixo.

Exemplo:

```text
tasks/
│
├── T001.md
├── T002.md
├── T003.md
├── T004.md
└── ...
```

Os identificadores não deverão ser reutilizados, mesmo quando uma tarefa for removida ou substituída.

# 6. Padrão dos documentos individuais

Cada tarefa deverá possuir um documento Markdown específico.

Estrutura prevista:

```markdown
# T001 — Título da tarefa

## Identificação
Código:
Etapa:
Dependências:

## Objetivo

Descrição do resultado esperado.

## Contexto

Informações necessárias para compreender
a atividade.

## Instruções

Descrição detalhada do trabalho.

## Arquivos envolvidos

Lista de arquivos relevantes.

## Restrições

Limitações que deverão ser respeitadas.

## Critérios de aceitação

Condições necessárias para considerar
a atividade concluída.

## Resultado esperado

Descrição do produto final da tarefa.
```

Os documentos deverão ser suficientemente objetivos para permitir que um modelo pequeno compreenda a atividade sem precisar interpretar toda a EAP.

# 7. Gerenciamento do andamento

O acompanhamento será realizado pelo sistema, utilizando o SQLite.

Estados permitidos:

| Código | Estado |
|---|---|
| pending | Pendente |
| in_progress | Em execução |
| completed | Concluída |
| blocked | Bloqueada |

O EAP.md será utilizado como referência estrutural.

O SQLite armazenará o estado efetivo de execução.

A aplicação deverá calcular automaticamente o percentual de conclusão com base na quantidade de tarefas concluídas.

A estrutura da EAP não deverá ser modificada automaticamente pelo agente.

# 8. Critério geral de conclusão do projeto

O Mini Agent 0.1 será considerado concluído quando:

1. Estabelecer comunicação com o Ollama.
2. Permitir seleção de modelos locais.
3. Manter conversas persistentes.
4. Carregar projetos e tarefas Markdown.
5. Consultar arquivos sob demanda.
6. Preparar contexto para o LLM.
7. Interpretar respostas estruturadas.
8. Criar arquivos mediante aprovação.
9. Editar arquivos mediante aprovação.
10. Registrar as operações realizadas.
11. Acompanhar o progresso da EAP.
12. Demonstrar funcionamento satisfatório com pelo menos um modelo local pequeno.

A validação experimental deverá registrar também as limitações encontradas nos demais modelos testados.

# 9. Diretriz de execução

O desenvolvimento será realizado tarefa por tarefa.

Não será iniciada uma nova tarefa enquanto a anterior não tiver sido testada e validada, salvo decisão expressa de reorganização.

A conclusão de cada atividade deverá ser registrada no SQLite e refletida no acompanhamento da EAP.

As tarefas serão desenvolvidas com participação ativa do usuário, priorizando compreensão, simplicidade e manutenção do código.

---

# DEFINIÇÃO DA EAP

A EAP estabelece uma sequência de 52 tarefas distribuídas em nove etapas, contemplando desde a estrutura inicial até a validação experimental do Mini Agent 0.1.

O trabalho será desenvolvido progressivamente, sem exigir que o modelo de linguagem assuma responsabilidades de planejamento ou coordenação do projeto.

**A EAP é o instrumento de planejamento. O Mini Agent será o executor controlado das tarefas.**
