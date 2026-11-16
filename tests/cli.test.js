'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { Readable, Writable } = require('node:stream');

const {
    startCLI,
    formatAgentResult,
    formatEAP,
    formatProgress
} = require('../src/cli');

// Capturar a saída da interface
function createOutput() {
    let content = '';

    const output = new Writable({
        write(chunk, encoding, callback) {
            content += chunk.toString();
            callback();
        }
    });

    return {
        output,
        getContent: () => content
    };
}

// Dependências simuladas para os testes da CLI
const cliDependencies = {
    getSession: () => ({
        success: true,
        session: {
            id: 1,
            project_id: 10
        }
    }),

    getProject: () => ({
        success: true,
        project: {
            id: 10,
            name: 'Projeto de teste',
            root_path: '/tmp/projeto-teste'
        }
    }),

    listProjects: () => ({
        success: true,
        projects: [
            {
                id: 10,
                name: 'Projeto de teste',
                root_path: '/tmp/projeto-teste'
            },
            {
                id: 20,
                name: 'Outro projeto',
                root_path: '/tmp/outro-projeto'
            }
        ]
    }),

    listTasks: () => ({
        success: true,
        tasks: [
            {
                code: 'T018',
                title: 'Implementar testes',
                status: 'in_progress'
            }
        ]
    }),

    loadTask: () => ({
        success: true,
        task: { code: 'T018' }
    }),

    saveMessage: () => ({
        success: true
    })
};

test('Deve formatar uma resposta final do agente', () => {
    const result = formatAgentResult({
        success: true,
        type: 'final',
        response: {
            message: 'Análise concluída.'
        }
    });

    assert.equal(result, 'Agente: Análise concluída.');
});

test('Deve formatar uma proposta de operação', () => {
    const result = formatAgentResult({
        success: true,
        type: 'proposal',
        response: {
            message: 'Criar um arquivo.'
        },
        proposal: {
            name: 'create_file',
            arguments: {
                path: 'src/example.js'
            }
        }
    });

    assert.match(result, /Criar um arquivo/);
    assert.match(result, /create_file/);
    assert.match(result, /src\/example.js/);
});

test('Deve formatar a estrutura hierárquica da EAP', () => {
    const result = formatEAP({
        success: true,
        project: {
            name: 'Projeto Alpha'
        },
        phases: [
            {
                code: 'P01',
                title: 'Fundação',
                tasks: [
                    {
                        code: 'T001',
                        title: 'Configurar ambiente',
                        expectedResult: 'Ambiente preparado.'
                    }
                ]
            },
            {
                code: 'P02',
                title: 'Desenvolvimento',
                tasks: [
                    {
                        code: 'T002',
                        title: 'Implementar módulo',
                        expectedResult: 'Módulo funcional.'
                    }
                ]
            }
        ]
    });

    assert.match(result, /EAP: Projeto Alpha/);
    assert.match(result, /P01 — Fundação/);
    assert.match(result, /T001 — Configurar ambiente/);
    assert.match(result, /Ambiente preparado/);
    assert.match(result, /P02 — Desenvolvimento/);
    assert.match(result, /T002 — Implementar módulo/);
    assert.match(result, /Módulo funcional/);
});

test('Deve formatar o progresso geral e por etapa', () => {
    const result = formatProgress({
        success: true,
        overall: {
            total: 10,
            completed: 7,
            percentage: 70
        },
        phases: [
            {
                code: 'P01',
                title: 'Fundação',
                total: 4,
                completed: 4,
                percentage: 100
            },
            {
                code: 'P02',
                title: 'Desenvolvimento',
                total: 6,
                completed: 3,
                percentage: 50
            }
        ]
    });

    assert.match(result, /Progresso do projeto/);
    assert.match(result, /Geral: 70% \(7\/10 tarefas concluídas\)/);
    assert.match(result, /P01 — Fundação: 100%/);
    assert.match(result, /P02 — Desenvolvimento: 50%/);
});

test('Deve informar quando não existem etapas', () => {
    const result = formatProgress({
        success: true,
        overall: {
            total: 0,
            completed: 0,
            percentage: 0
        },
        phases: []
    });

    assert.match(result, /Geral: 0%/);
    assert.match(result, /Nenhuma etapa encontrada/);
});

test('Deve apresentar erros de cálculo do progresso', () => {
    const result = formatProgress({
        success: false,
        message: 'Falha ao consultar tarefas.'
    });

    assert.match(result, /Erro ao calcular progresso/);
    assert.match(result, /Falha ao consultar tarefas/);
});

test('Deve apresentar erros de interpretação da EAP', () => {
    const result = formatEAP({
        success: false,
        errors: ['Título principal não encontrado.']
    });

    assert.match(result, /Erro ao interpretar EAP/);
    assert.match(result, /Título principal não encontrado/);
});

test('Deve rejeitar estrutura inválida da EAP', () => {
    const result = formatEAP({
        success: true,
        project: null,
        phases: []
    });

    assert.equal(result, 'Erro: estrutura da EAP inválida.');
});

test('Deve apresentar falhas retornadas pelo agente', () => {
    const result = formatAgentResult({
        success: false,
        message: 'Servidor indisponível.'
    });

    assert.equal(result, 'Erro: Servidor indisponível.');
});

test('Deve rejeitar retorno inválido do agente', () => {
    const result = formatAgentResult(null);

    assert.equal(result, 'Erro: retorno inválido do agente.');
});

test('Deve processar mensagens sucessivas', async () => {
    const input = Readable.from([
        'Primeira mensagem\n',
        'Segunda mensagem\n'
    ]);

    const { output, getContent } = createOutput();

    const receivedMessages = [];

    const result = await startCLI({
        runAgent: async params => {
            receivedMessages.push(params);

            return {
                success: true,
                type: 'final',
                response: {
                    message: 'Mensagem processada.'
                }
            };
        },
        model: 'qwen3:4b',
        sessionId: 1,
        ...cliDependencies,
        input,
        output
    });

    assert.equal(result.success, true);
    assert.equal(receivedMessages.length, 2);

    assert.deepEqual(receivedMessages[0], {
        model: 'qwen3:4b',
        sessionId: 1,
        userMessage: 'Primeira mensagem'
    });

    assert.deepEqual(receivedMessages[1], {
        model: 'qwen3:4b',
        sessionId: 1,
        userMessage: 'Segunda mensagem'
    });

    assert.equal(
        (getContent().match(/Mensagem processada/g) || []).length,
        2
    );

    assert.match(getContent(), /Interface encerrada/);
});

test('Deve ignorar mensagens vazias', async () => {
    const input = Readable.from([
        '\n',
        '   \n',
        'Mensagem válida\n'
    ]);

    const { output, getContent } = createOutput();

    let calls = 0;

    const result = await startCLI({
        runAgent: async () => {
            calls++;

            return {
                success: true,
                type: 'final',
                response: {
                    message: 'Processada.'
                }
            };
        },
        model: 'qwen3:4b',
        sessionId: 1,
        ...cliDependencies,
        input,
        output
    });

    assert.equal(result.success, true);
    assert.equal(calls, 1);
    assert.match(getContent(), /Processada/);
});

test('Deve continuar após falha retornada pelo agente', async () => {
    const input = Readable.from([
        'Primeira mensagem\n',
        'Segunda mensagem\n'
    ]);

    const { output, getContent } = createOutput();

    let calls = 0;

    const result = await startCLI({
        runAgent: async () => {
            calls++;

            if (calls === 1) {
                return {
                    success: false,
                    message: 'Falha simulada.'
                };
            }

            return {
                success: true,
                type: 'final',
                response: {
                    message: 'Segunda mensagem processada.'
                }
            };
        },
        model: 'qwen3:4b',
        sessionId: 1,
        ...cliDependencies,
        input,
        output
    });

    assert.equal(result.success, true);
    assert.equal(calls, 2);
    assert.match(getContent(), /Falha simulada/);
    assert.match(getContent(), /Segunda mensagem processada/);
});

test('Deve continuar após exceção do agente', async () => {
    const input = Readable.from([
        'Primeira mensagem\n',
        'Segunda mensagem\n'
    ]);

    const { output, getContent } = createOutput();

    let calls = 0;

    const result = await startCLI({
        runAgent: async () => {
            calls++;

            if (calls === 1) {
                throw new Error('Erro interno simulado.');
            }

            return {
                success: true,
                type: 'final',
                response: {
                    message: 'Processamento recuperado.'
                }
            };
        },
        model: 'qwen3:4b',
        sessionId: 1,
        ...cliDependencies,
        input,
        output
    });

    assert.equal(result.success, true);
    assert.equal(calls, 2);
    assert.match(getContent(), /Erro interno simulado/);
    assert.match(getContent(), /Processamento recuperado/);
});

test('Deve executar os comandos de listagem sem chamar o agente', async () => {
    const input = Readable.from([
        '/projetos\n',
        '/tarefas\n'
    ]);

    const { output, getContent } = createOutput();

    let agentCalls = 0;
    let projectIdUsed;

    const result = await startCLI({
        runAgent: async () => {
            agentCalls++;
            return {};
        },
        model: 'qwen3:4b',
        sessionId: 1,
        ...cliDependencies,
        listTasks: projectId => {
            projectIdUsed = projectId;
            return cliDependencies.listTasks();
        },
        input,
        output
    });

    assert.equal(result.success, true);
    assert.equal(agentCalls, 0);
    assert.equal(projectIdUsed, 10);

    assert.match(getContent(), /Projeto de teste \(projeto atual\)/);
    assert.match(getContent(), /Outro projeto/);
    assert.match(getContent(), /T018 - Implementar testes \[in_progress\]/);
    assert.match(getContent(), /\/tmp\/projeto-teste/);
    assert.match(getContent(), /\/tmp\/outro-projeto/);
});

test('Deve selecionar uma tarefa e enviá-la como contexto ao agente', async () => {
    const input = Readable.from([
        '/tarefa T018\n',
        'Analisar esta tarefa\n',
        '/tarefa\n'
    ]);

    const { output, getContent } = createOutput();

    let loadTaskParams;
    let agentParams;

    const result = await startCLI({
        runAgent: async params => {
            agentParams = params;

            return {
                success: true,
                type: 'final',
                response: {
                    message: 'Análise concluída.'
                }
            };
        },
        model: 'qwen3:4b',
        sessionId: 1,
        ...cliDependencies,
        loadTask: (...params) => {
            loadTaskParams = params;
            return cliDependencies.loadTask();
        },
        input,
        output
    });

    assert.equal(result.success, true);

    assert.deepEqual(loadTaskParams, [
        10,
        'T018',
        '/tmp/projeto-teste'
    ]);

    assert.deepEqual(agentParams, {
        model: 'qwen3:4b',
        sessionId: 1,
        userMessage: 'Analisar esta tarefa',
        taskCode: 'T018'
    });

    assert.match(getContent(), /Tarefa T018 selecionada como contexto/);
    assert.match(getContent(), /Tarefa selecionada: T018/);
    assert.match(getContent(), /Análise concluída/);
});

test('Não deve selecionar uma tarefa inválida', async () => {
    const input = Readable.from([
        '/tarefa T999\n',
        'Analisar projeto\n'
    ]);

    const { output, getContent } = createOutput();

    let agentParams;

    const result = await startCLI({
        runAgent: async params => {
            agentParams = params;

            return {
                success: true,
                type: 'final',
                response: {
                    message: 'Mensagem processada.'
                }
            };
        },
        model: 'qwen3:4b',
        sessionId: 1,
        ...cliDependencies,
        loadTask: () => ({
            success: false,
            message: 'Tarefa não encontrada.'
        }),
        input,
        output
    });

    assert.equal(result.success, true);

    assert.match(getContent(), /Erro: Tarefa não encontrada/);
    assert.match(getContent(), /Mensagem processada/);

    assert.deepEqual(agentParams, {
        model: 'qwen3:4b',
        sessionId: 1,
        userMessage: 'Analisar projeto'
    });

    assert.doesNotMatch(getContent(), /Tarefa T999 selecionada/);
});

test('Deve rejeitar configuração inválida', async () => {
    const result = await startCLI({
        runAgent: async () => ({}),
        model: '',
        sessionId: 1
    });

    assert.equal(result.success, false);
    assert.equal(result.message, 'Modelo não informado.');
});

test('Deve visualizar a EAP do projeto atual sem chamar o agente', async () => {
    const capturedOutput = createOutput();

    let agentCalled = false;
    let receivedPath;
    let receivedContent;

    await startCLI({
        runAgent: async () => {
            agentCalled = true;
        },
        model: 'qwen3:4b',
        sessionId: 1,
        input: Readable.from(['/eap\n']),
        output: capturedOutput.output,
        ...cliDependencies,

        readEAP: (filePath) => {
            receivedPath = filePath;

            return {
                success: true,
                content: 'Conteúdo da EAP'
            };
        },

        parseEAP: (content) => {
            receivedContent = content;

            return {
                success: true,
                project: {
                    name: 'Projeto Alpha'
                },
                phases: [
                    {
                        code: 'P01',
                        title: 'Fundação',
                        tasks: [
                            {
                                code: 'T001',
                                title: 'Configurar ambiente',
                                expectedResult: 'Ambiente preparado.'
                            }
                        ]
                    }
                ]
            };
        }
    });

    assert.equal(
        receivedPath,
        '/tmp/projeto-teste/docs/EAP.md'
    );

    assert.equal(receivedContent, 'Conteúdo da EAP');
    assert.equal(agentCalled, false);

    const content = capturedOutput.getContent();

    assert.match(content, /EAP: Projeto Alpha/);
    assert.match(content, /P01 — Fundação/);
    assert.match(content, /T001 — Configurar ambiente/);
    assert.match(content, /Ambiente preparado/);
});

test('Deve informar falha ao ler o arquivo da EAP', async () => {
    const capturedOutput = createOutput();

    let parseCalled = false;
    let agentCalled = false;

    await startCLI({
        runAgent: async () => {
            agentCalled = true;
        },
        model: 'qwen3:4b',
        sessionId: 1,
        input: Readable.from(['/eap\n']),
        output: capturedOutput.output,
        ...cliDependencies,

        readEAP: () => ({
            success: false,
            message: 'Arquivo EAP não encontrado.'
        }),

        parseEAP: () => {
            parseCalled = true;
        }
    });

    const content = capturedOutput.getContent();

    assert.match(content, /Erro ao ler EAP/);
    assert.match(content, /Arquivo EAP não encontrado/);
    assert.equal(parseCalled, false);
    assert.equal(agentCalled, false);
});

test('Deve informar falha ao interpretar a EAP', async () => {
    const capturedOutput = createOutput();

    let agentCalled = false;

    await startCLI({
        runAgent: async () => {
            agentCalled = true;
        },
        model: 'qwen3:4b',
        sessionId: 1,
        input: Readable.from(['/eap\n']),
        output: capturedOutput.output,
        ...cliDependencies,

        readEAP: () => ({
            success: true,
            content: 'Conteúdo inválido'
        }),

        parseEAP: () => ({
            success: false,
            errors: [
                'Título principal não encontrado.'
            ]
        })
    });

    const content = capturedOutput.getContent();

    assert.match(content, /Erro ao interpretar EAP/);
    assert.match(content, /Título principal não encontrado/);
    assert.equal(agentCalled, false);
});

test('Deve consultar o progresso do projeto sem chamar o agente', async () => {
    const capturedOutput = createOutput();

    let agentCalled = false;
    let receivedProjectId;
    let receivedPath;
    let receivedContent;
    let receivedTasks;
    let receivedPhases;

    const tasks = [
        {
            code: 'T001',
            phase_code: 'P01',
            status: 'completed',
            is_active: 1
        },
        {
            code: 'T002',
            phase_code: 'P01',
            status: 'pending',
            is_active: 1
        }
    ];

    const phases = [
        {
            code: 'P01',
            title: 'Fundação'
        }
    ];

    await startCLI({
        runAgent: async () => {
            agentCalled = true;
        },
        model: 'qwen3:4b',
        sessionId: 1,
        input: Readable.from(['/progresso\n']),
        output: capturedOutput.output,
        ...cliDependencies,

        listTasks: projectId => {
            receivedProjectId = projectId;

            return {
                success: true,
                tasks
            };
        },

        readEAP: filePath => {
            receivedPath = filePath;

            return {
                success: true,
                content: 'Conteúdo da EAP'
            };
        },

        parseEAP: content => {
            receivedContent = content;

            return {
                success: true,
                phases
            };
        },

            calculateProgress: (taskList, phaseList) => {
	        receivedTasks = taskList;
	        receivedPhases = phaseList;

	        return {
                success: true,
                overall: {
                    total: 2,
                    completed: 1,
                    percentage: 50
                },
                phases: [
                    {
                        code: 'P01',
                        title: 'Fundação',
                        total: 2,
                        completed: 1,
                        percentage: 50
                    }
                ]
            };
        }
    });

    assert.equal(receivedProjectId, 10);
    assert.equal(receivedPath, '/tmp/projeto-teste/docs/EAP.md');
    assert.equal(receivedContent, 'Conteúdo da EAP');
    assert.deepEqual(receivedTasks, tasks);
    assert.deepEqual(receivedPhases, phases);
    assert.equal(agentCalled, false);

    const content = capturedOutput.getContent();

    assert.match(content, /Progresso do projeto/);
    assert.match(content, /Geral: 50% \(1\/2 tarefas concluídas\)/);
    assert.match(content, /P01 — Fundação: 50%/);
});

test('Deve informar falha ao consultar tarefas para o progresso', async () => {
    const capturedOutput = createOutput();

    let readEAPCalled = false;
    let agentCalled = false;

    await startCLI({
        runAgent: async () => {
            agentCalled = true;
        },
        model: 'qwen3:4b',
        sessionId: 1,
        input: Readable.from(['/progresso\n']),
        output: capturedOutput.output,
        ...cliDependencies,

        listTasks: () => ({
            success: false,
            message: 'Falha simulada na consulta.'
        }),

        readEAP: () => {
            readEAPCalled = true;
        }
    });

    const content = capturedOutput.getContent();

    assert.match(content, /Erro ao consultar tarefas/);
    assert.match(content, /Falha simulada na consulta/);
    assert.equal(readEAPCalled, false);
    assert.equal(agentCalled, false);
});

test('Deve informar falha ao ler EAP durante consulta do progresso', async () => {
    const capturedOutput = createOutput();

    let parseCalled = false;
    let agentCalled = false;

    await startCLI({
        runAgent: async () => {
            agentCalled = true;
        },
        model: 'qwen3:4b',
        sessionId: 1,
        input: Readable.from(['/progresso\n']),
        output: capturedOutput.output,
        ...cliDependencies,

        listTasks: () => ({
            success: true,
            tasks: []
        }),

        readEAP: () => ({
            success: false,
            message: 'Arquivo EAP não encontrado.'
        }),

        parseEAP: () => {
            parseCalled = true;
        }
    });

    const content = capturedOutput.getContent();

    assert.match(content, /Erro ao ler EAP/);
    assert.match(content, /Arquivo EAP não encontrado/);
    assert.equal(parseCalled, false);
    assert.equal(agentCalled, false);
});

test('Deve apresentar, bloquear e aprovar uma proposta pendente', async () => {
    const input = Readable.from([
        'Criar um arquivo\n',
        'Enviar outra solicitação\n',
        '/aprovar\n',
        'Continuar a conversa\n'
    ]);

    const { output, getContent } = createOutput();

    const proposal = {
        name: 'create_file',
        arguments: {
            path: 'src/example.js',
            content: 'console.log("Olá");'
        }
    };

    const agentMessages = [];
    const persistedMessages = [];
    let approvalParams;

    const result = await startCLI({
        runAgent: async params => {
            agentMessages.push(params.userMessage);

            if (agentMessages.length === 1) {
                return {
                    success: true,
                    type: 'proposal',
                    response: {
                        message: 'Posso criar o arquivo solicitado.'
                    },
                    proposal
                };
            }

            return {
                success: true,
                type: 'final',
                response: {
                    message: 'Conversa retomada.'
                }
            };
        },

        approveProposal: (...params) => {
            approvalParams = params;

            return {
                success: true,
                status: 'created',
                message: 'Arquivo criado com sucesso.'
            };
        },

        saveMessage: (...params) => {
            persistedMessages.push(params);
            return { success: true };
        },

        model: 'qwen3:4b',
        sessionId: 1,
        ...cliDependencies,
        
        approveProposal: (...params) => {
            approvalParams = params;

            return {
                success: true,
                status: 'created',
                message: 'Arquivo criado com sucesso.'
            };
        },

        saveMessage: (...params) => {
            persistedMessages.push(params);
            return { success: true };
        },
        input,
        output
    });

    assert.equal(result.success, true);

    assert.deepEqual(agentMessages, [
        'Criar um arquivo',
        'Continuar a conversa'
    ]);

    assert.deepEqual(approvalParams, [
        proposal,
        'approve',
        '/tmp/projeto-teste'
    ]);

    assert.equal(persistedMessages.length, 1);
    assert.equal(persistedMessages[0][0], 1);
    assert.equal(persistedMessages[0][1], 'assistant');
    assert.match(persistedMessages[0][2], /aprovou a proposta/);
    assert.match(persistedMessages[0][2], /src\/example.js/);
    assert.match(persistedMessages[0][2], /created/);

    const content = getContent();

    assert.match(content, /Posso criar o arquivo solicitado/);
    assert.match(content, /create_file/);
    assert.match(content, /\/aprovar ou \/rejeitar/);
    assert.match(content, /aguardando decisão/);
    assert.match(content, /Arquivo criado com sucesso/);
    assert.match(content, /Conversa retomada/);
});

test('Deve rejeitar uma proposta sem executar a operação', async () => {
    const input = Readable.from([
        'Criar um arquivo\n',
        '/rejeitar\n',
        'Continuar a conversa\n'
    ]);

    const { output, getContent } = createOutput();

    const proposal = {
        name: 'create_file',
        arguments: {
            path: 'src/example.js',
            content: 'console.log("Olá");'
        }
    };

    const agentMessages = [];
    const persistedMessages = [];
    let approvalParams;

    const result = await startCLI({
        runAgent: async params => {
            agentMessages.push(params.userMessage);

            if (agentMessages.length === 1) {
                return {
                    success: true,
                    type: 'proposal',
                    response: {
                        message: 'Proposta de criação de arquivo.'
                    },
                    proposal
                };
            }

            return {
                success: true,
                type: 'final',
                response: {
                    message: 'Conversa retomada.'
                }
            };
        },

        approveProposal: (...params) => {
            approvalParams = params;

            return {
                success: true,
                status: 'rejected',
                proposal
            };
        },

        saveMessage: (...params) => {
            persistedMessages.push(params);
            return { success: true };
        },

        model: 'qwen3:4b',
        sessionId: 1,
        ...cliDependencies,
        
        approveProposal: (...params) => {
            approvalParams = params;

            return {
                success: true,
                status: 'created',
                message: 'Arquivo criado com sucesso.'
            };
        },

        saveMessage: (...params) => {
            persistedMessages.push(params);
            return { success: true };
        },
        input,
        output
    });

    assert.equal(result.success, true);

    assert.deepEqual(agentMessages, [
        'Criar um arquivo',
        'Continuar a conversa'
    ]);

    assert.deepEqual(approvalParams, [
        proposal,
        'reject',
        '/tmp/projeto-teste'
    ]);

    assert.equal(persistedMessages.length, 1);
    assert.equal(persistedMessages[0][0], 1);
    assert.equal(persistedMessages[0][1], 'assistant');
    assert.match(persistedMessages[0][2], /rejeitou a proposta/);
    assert.match(persistedMessages[0][2], /Nenhuma alteração foi realizada/);

    const content = getContent();

    assert.match(content, /Proposta rejeitada/);
    assert.match(content, /Nenhuma alteração foi realizada/);
    assert.match(content, /Conversa retomada/);
});

test('Deve avisar quando falhar ao persistir o resultado da aprovação', async () => {
    const input = Readable.from([
        'Criar um arquivo\n',
        '/aprovar\n'
    ]);

    const { output, getContent } = createOutput();

    const proposal = {
        name: 'create_file',
        arguments: {
            path: 'src/example.js',
            content: 'console.log("Olá");'
        }
    };

    let approvalCalls = 0;
    let persistenceCalls = 0;

    const result = await startCLI({
        runAgent: async () => ({
            success: true,
            type: 'proposal',
            response: {
                message: 'Proposta de criação.'
            },
            proposal
        }),

        approveProposal: () => {
            approvalCalls++;
            return {
                success: true,
                status: 'created',
                message: 'Arquivo criado com sucesso.'
            };
        },

        saveMessage: () => {
            persistenceCalls++;
            return {
                success: false,
                message: 'Falha simulada no banco.'
            };
        },

        model: 'qwen3:4b',
        sessionId: 1,
        ...cliDependencies,
        
        approveProposal: () => {
            approvalCalls++;
            return {
                success: true,
                status: 'created',
                message: 'Arquivo criado com sucesso.'
            };
        },

        saveMessage: () => {
            persistenceCalls++;
            return {
                success: false,
                message: 'Falha simulada no banco.'
            };
        },
        input,
        output
    });

    assert.equal(result.success, true);
    assert.equal(approvalCalls, 1);
    assert.equal(persistenceCalls, 1);

    const content = getContent();

    assert.match(content, /Arquivo criado com sucesso/);
    assert.match(content, /não foi possível registrar o resultado no histórico/);
    assert.match(content, /Falha simulada no banco/);
});

test('Deve rejeitar comandos de decisão sem proposta pendente', async () => {
    const input = Readable.from([
        '/aprovar\n',
        '/rejeitar\n',
        'Mensagem normal\n'
    ]);

    const { output, getContent } = createOutput();

    let agentCalls = 0;
    let approvalCalls = 0;

    const result = await startCLI({
        runAgent: async () => {
            agentCalls++;

            return {
                success: true,
                type: 'final',
                response: {
                    message: 'Mensagem processada.'
                }
            };
        },

        approveProposal: () => {
            approvalCalls++;

            return {
                success: true,
                status: 'created'
            };
        },

        model: 'qwen3:4b',
        sessionId: 1,
        ...cliDependencies,
        input,
        output
    });

    assert.equal(result.success, true);
    assert.equal(agentCalls, 1);
    assert.equal(approvalCalls, 0);

    const content = getContent();

    assert.equal(
        (content.match(/Não existe proposta pendente/g) || []).length,
        2
    );

    assert.match(content, /Mensagem processada/);
    assert.match(content, /Interface encerrada/);
});

test('Deve encerrar proposta após falha na aprovação e continuar a sessão', async () => {
    const input = Readable.from([
        'Criar um arquivo\n',
        '/aprovar\n',
        '/aprovar\n',
        'Continuar a conversa\n'
    ]);

    const { output, getContent } = createOutput();

    const proposal = {
        name: 'create_file',
        arguments: {
            path: 'src/example.js',
            content: 'console.log("Olá");'
        }
    };

    let agentCalls = 0;
    let approvalCalls = 0;

    const result = await startCLI({
        runAgent: async () => {
            agentCalls++;

            if (agentCalls === 1) {
                return {
                    success: true,
                    type: 'proposal',
                    response: {
                        message: 'Proposta de criação.'
                    },
                    proposal
                };
            }

            return {
                success: true,
                type: 'final',
                response: {
                    message: 'Conversa retomada.'
                }
            };
        },

        approveProposal: () => {
            approvalCalls++;

            return {
                success: false,
                message: 'Arquivo de destino já existe.'
            };
        },

        model: 'qwen3:4b',
        sessionId: 1,
        ...cliDependencies,
        input,
        output
    });

    assert.equal(result.success, true);
    assert.equal(agentCalls, 2);
    assert.equal(approvalCalls, 1);

    const content = getContent();

    assert.match(content, /Erro na decisão/);
    assert.match(content, /Arquivo de destino já existe/);
    assert.match(content, /Não existe proposta pendente/);
    assert.match(content, /Conversa retomada/);
});

test('Deve continuar a sessão após exceção durante a aprovação', async () => {
    const input = Readable.from([
        'Criar um arquivo\n',
        '/aprovar\n',
        '/rejeitar\n',
        'Continuar a conversa\n'
    ]);

    const { output, getContent } = createOutput();

    const proposal = {
        name: 'create_file',
        arguments: {
            path: 'src/example.js',
            content: 'console.log("Olá");'
        }
    };

    let agentCalls = 0;
    let approvalCalls = 0;

    const result = await startCLI({
        runAgent: async () => {
            agentCalls++;

            if (agentCalls === 1) {
                return {
                    success: true,
                    type: 'proposal',
                    response: {
                        message: 'Proposta de criação.'
                    },
                    proposal
                };
            }

            return {
                success: true,
                type: 'final',
                response: {
                    message: 'Conversa retomada.'
                }
            };
        },

        approveProposal: () => {
            approvalCalls++;
            throw new Error('Falha inesperada na aprovação.');
        },

        model: 'qwen3:4b',
        sessionId: 1,
        ...cliDependencies,
        input,
        output
    });

    assert.equal(result.success, true);
    assert.equal(agentCalls, 2);
    assert.equal(approvalCalls, 1);

    const content = getContent();

    assert.match(content, /Falha inesperada na aprovação/);
    assert.match(content, /Não existe proposta pendente/);
    assert.match(content, /Conversa retomada/);
});

test('Deve apresentar a ajuda sem chamar o agente', async () => {
    const input = Readable.from(['/ajuda\n']);
    const { output, getContent } = createOutput();

    let agentCalls = 0;

    const result = await startCLI({
        runAgent: async () => {
            agentCalls++;
            return {};
        },
        model: 'qwen3:4b',
        sessionId: 1,
        ...cliDependencies,
        input,
        output
    });

    assert.equal(result.success, true);
    assert.equal(agentCalls, 0);

    const content = getContent();

    assert.match(content, /Comandos disponíveis/);
    assert.match(content, /\/ajuda/);
    assert.match(content, /\/sair/);
    assert.match(content, /\/projetos/);
    assert.match(content, /\/tarefas/);
    assert.match(content, /\/tarefa CODE/);
    assert.match(content, /\/eap/);
    assert.match(content, /\/progresso/);
    assert.match(content, /\/aprovar/);
    assert.match(content, /\/rejeitar/);
    assert.match(content, /mensagens.*agente/i);
});

test('Deve identificar comandos desconhecidos sem chamar o agente', async () => {
    const input = Readable.from([
        '/comando-inexistente\n',
        'Mensagem normal\n'
    ]);

    const { output, getContent } = createOutput();

    let agentCalls = 0;

    const result = await startCLI({
        runAgent: async params => {
            agentCalls++;

            assert.equal(params.userMessage, 'Mensagem normal');

            return {
                success: true,
                type: 'final',
                response: {
                    message: 'Mensagem processada.'
                }
            };
        },
        model: 'qwen3:4b',
        sessionId: 1,
        ...cliDependencies,        

	approveProposal: (...params) => {
	    // implementação simulada do teste
	},

	saveMessage: (...params) => {
	    persistedMessages.push(params);
	    return { success: true };
	},

	input,
	output        
    });

    assert.equal(result.success, true);
    assert.equal(agentCalls, 1);

    const content = getContent();

    assert.match(content, /Comando desconhecido/);
    assert.match(content, /\/ajuda/);
    assert.match(content, /Mensagem processada/);
});

test('Deve permitir ajuda e encerramento com proposta pendente', async () => {
    const input = Readable.from([
        'Criar um arquivo\n',
        '/ajuda\n',
        '/sair\n',
        'Mensagem que não deve ser processada\n'
    ]);

    const { output, getContent } = createOutput();

    let agentCalls = 0;
    let approvalCalls = 0;

    const result = await startCLI({
        runAgent: async () => {
            agentCalls++;

            return {
                success: true,
                type: 'proposal',
                response: {
                    message: 'Proposta de criação de arquivo.'
                },
                proposal: {
                    name: 'create_file',
                    arguments: {
                        path: 'src/example.js',
                        content: 'console.log("Olá");'
                    }
                }
            };
        },

        approveProposal: () => {
            approvalCalls++;

            return {
                success: true,
                status: 'created'
            };
        },

        model: 'qwen3:4b',
        sessionId: 1,
        ...cliDependencies,
        input,
        output
    });

    assert.equal(result.success, true);
    assert.equal(agentCalls, 1);
    assert.equal(approvalCalls, 0);

    const content = getContent();

    assert.match(content, /Comandos disponíveis/);
    assert.match(content, /Interface encerrada/);
    assert.doesNotMatch(content, /Mensagem que não deve ser processada/);
});
