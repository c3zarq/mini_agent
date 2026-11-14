'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createAgent } = require('../src/agent');

// Preparar contexto simulado
function mockContext() {
    return {
        success: true,
        messages: [
            {
                role: 'system',
                content: 'Instruções do agente.'
            },
            {
                role: 'user',
                content: 'Analise o projeto.'
            }
        ]
    };
}

// Preparar resposta simulada do Ollama
function mockOllama(response) {
    return {
        success: true,
        model: 'qwen3:4b',
        message: {
            role: 'assistant',
            content: response
        }
    };
}

test('Deve executar o fluxo completo do Agent', async () => {
    const expectedResponse = {
        type: 'final',
        message: 'Análise concluída.'
    };

    let receivedMessages;
    let receivedOptions;

    const runAgent = createAgent({
        buildContext: () => mockContext(),

        chat: async (model, messages, options) => {
            receivedMessages = messages;
            receivedOptions = options;

            return mockOllama(expectedResponse);
        }
    });

    const result = await runAgent({
        model: 'qwen3:4b',
        sessionId: 1,
        userMessage: 'Analise o projeto.'
    });

    assert.equal(result.success, true);
    assert.equal(result.model, 'qwen3:4b');
    assert.equal(result.type, 'final');
    assert.deepEqual(result.response, expectedResponse);

    assert.deepEqual(receivedMessages.slice(0, 2), mockContext().messages);

    assert.deepEqual(receivedMessages[2], {
        role: 'assistant',
        content: JSON.stringify(expectedResponse)
    });
    assert.deepEqual(receivedOptions, { format: 'json' });
});

test('Deve interromper o fluxo quando o contexto falhar', async () => {
    let chatCalled = false;

    const runAgent = createAgent({
        buildContext: () => ({
            success: false,
            message: 'Sessão não encontrada.'
        }),

        chat: async () => {
            chatCalled = true;
        }
    });

    const result = await runAgent({
        model: 'qwen3:4b',
        sessionId: 999,
        userMessage: 'Analise o projeto.'
    });

    assert.equal(result.success, false);
    assert.equal(result.stage, 'context');
    assert.equal(result.message, 'Sessão não encontrada.');
    assert.equal(chatCalled, false);
});

test('Deve tratar falha na comunicação com Ollama', async () => {
    const runAgent = createAgent({
        buildContext: () => mockContext(),

        chat: async () => ({
            success: false,
            message: 'Servidor Ollama indisponível.'
        })
    });

    const result = await runAgent({
        model: 'qwen3:4b',
        sessionId: 1,
        userMessage: 'Analise o projeto.'
    });

    assert.equal(result.success, false);
    assert.equal(result.stage, 'ollama');
    assert.equal(result.message, 'Servidor Ollama indisponível.');
});

test('Deve rejeitar resposta fora do protocolo', async () => {
    const runAgent = createAgent({
        buildContext: () => mockContext(),

        chat: async () => mockOllama({
            type: 'unknown',
            message: 'Resposta inválida.'
        })
    });

    const result = await runAgent({
        model: 'qwen3:4b',
        sessionId: 1,
        userMessage: 'Analise o projeto.'
    });

    assert.equal(result.success, false);
    assert.equal(result.stage, 'protocol');
    assert.ok(result.errors.length > 0);
});

test('Deve tratar exceção durante a preparação do contexto', async () => {
    const runAgent = createAgent({
        buildContext: () => {
            throw new Error('Erro interno de contexto.');
        }
    });

    const result = await runAgent({
        model: 'qwen3:4b',
        sessionId: 1,
        userMessage: 'Analise o projeto.'
    });

    assert.equal(result.success, false);
    assert.equal(result.stage, 'context');
    assert.match(result.message, /Erro interno de contexto/);
});

test('Deve tratar exceção durante a comunicação com Ollama', async () => {
    const runAgent = createAgent({
        buildContext: () => mockContext(),

        chat: async () => {
            throw new Error('Falha de conexão.');
        }
    });

    const result = await runAgent({
        model: 'qwen3:4b',
        sessionId: 1,
        userMessage: 'Analise o projeto.'
    });

    assert.equal(result.success, false);
    assert.equal(result.stage, 'ollama');
    assert.match(result.message, /Falha de conexão/);
});

test('Deve executar uma ferramenta e receber resposta final', async () => {
    const responses = [
        {
            type: 'tool_call',
            name: 'list_files',
            arguments: {
                path: 'src'
            }
        },
        {
            type: 'final',
            message: 'Arquivos analisados.'
        }
    ];

    const receivedMessages = [];
    const savedMessages = [];
    let toolExecutions = 0;

    const runAgent = createAgent({
        buildContext: () => mockContext(),

        getSession: () => ({
            success: true,
            session: {
                project_id: 1
            }
        }),

        saveMessage: (sessionId, role, content) => {
            savedMessages.push({ role, content });

            return { success: true };
        },

        executeTool: (operation, projectId) => {
            toolExecutions++;

            assert.equal(operation.name, 'list_files');
            assert.equal(projectId, 1);

            return {
                success: true,
                files: ['agent.js', 'context.js']
            };
        },

        chat: async (model, messages) => {
            receivedMessages.push([...messages]);

            return mockOllama(responses.shift());
        }
    });

    const result = await runAgent({
        model: 'qwen3:4b',
        sessionId: 1,
        userMessage: 'Liste os arquivos de src.'
    });

    assert.equal(result.success, true);
    assert.equal(result.type, 'final');
    assert.equal(toolExecutions, 1);
    assert.equal(receivedMessages.length, 2);

    assert.deepEqual(receivedMessages[1].slice(-2), [
        {
            role: 'assistant',
            content: JSON.stringify({
                type: 'tool_call',
                name: 'list_files',
                arguments: { path: 'src' }
            })
        },
        {
            role: 'tool',
            content: JSON.stringify({
                success: true,
                files: ['agent.js', 'context.js']
            })
        }
    ]);

    assert.deepEqual(
        savedMessages.map(message => message.role),
        ['user', 'assistant', 'tool', 'assistant']
    );
});

test('Deve executar duas ferramentas sucessivamente', async () => {
    const responses = [
        {
            type: 'tool_call',
            name: 'list_files',
            arguments: { path: 'src' }
        },
        {
            type: 'tool_call',
            name: 'read_file',
            arguments: { path: 'src/agent.js' }
        },
        {
            type: 'final',
            message: 'Análise concluída.'
        }
    ];

    const receivedMessages = [];
    const executedTools = [];

    const runAgent = createAgent({
        buildContext: () => mockContext(),

        getSession: () => ({
            success: true,
            session: { project_id: 1 }
        }),

        saveMessage: () => ({
            success: true
        }),

        executeTool: (operation, projectId) => {
            executedTools.push(operation.name);

            if (operation.name === 'list_files') {
                return {
                    success: true,
                    files: ['agent.js', 'context.js']
                };
            }

            return {
                success: true,
                content: 'Conteúdo do agent.js'
            };
        },

        chat: async (model, messages) => {
            receivedMessages.push([...messages]);

            return mockOllama(responses.shift());
        }
    });

    const result = await runAgent({
        model: 'qwen3:4b',
        sessionId: 1,
        userMessage: 'Analise os arquivos do projeto.'
    });

    assert.equal(result.success, true);
    assert.equal(result.type, 'final');

    assert.deepEqual(executedTools, [
        'list_files',
        'read_file'
    ]);

    assert.equal(receivedMessages.length, 3);

    // A terceira consulta deve preservar as duas interações anteriores.
    assert.deepEqual(
        receivedMessages[2].slice(-4).map(message => message.role),
        ['assistant', 'tool', 'assistant', 'tool']
    );
});

test('Deve retornar proposta sem executar a operação', async () => {
    let toolExecuted = false;
    const savedMessages = [];

    const proposal = {
        type: 'proposal',
        name: 'create_file',
        arguments: {
            path: 'src/example.js',
            content: 'console.log("teste");'
        },
        message: 'Posso criar este arquivo?'
    };

    const runAgent = createAgent({
        buildContext: () => mockContext(),

        getSession: () => ({
            success: true,
            session: { project_id: 1 }
        }),

        saveMessage: (sessionId, role, content) => {
            savedMessages.push({ role, content });
            return { success: true };
        },

        executeTool: () => {
            toolExecuted = true;
            return { success: true };
        },

        chat: async () => mockOllama(proposal)
    });

    const result = await runAgent({
        model: 'qwen3:4b',
        sessionId: 1,
        userMessage: 'Crie um arquivo de exemplo.'
    });

    assert.equal(result.success, true);
    assert.equal(result.type, 'proposal');
    assert.deepEqual(result.response, proposal);
    assert.equal(toolExecuted, false);

    assert.deepEqual(
        savedMessages.map(message => message.role),
        ['user', 'assistant']
    );
});

test('Deve interromper o ciclo ao atingir o limite de ferramentas', async () => {
    let chatCalls = 0;
    let toolCalls = 0;
    const savedMessages = [];

    const runAgent = createAgent({
        buildContext: () => mockContext(),

        maxIterations: 2,

        getSession: () => ({
            success: true,
            session: { project_id: 1 }
        }),

        saveMessage: (sessionId, role, content) => {
            savedMessages.push({ role, content });
            return { success: true };
        },

        executeTool: () => {
            toolCalls++;

            return {
                success: true,
                files: ['agent.js']
            };
        },

        chat: async () => {
            chatCalls++;

            return mockOllama({
                type: 'tool_call',
                name: 'list_files',
                arguments: { path: 'src' }
            });
        }
    });

    const result = await runAgent({
        model: 'qwen3:4b',
        sessionId: 1,
        userMessage: 'Liste os arquivos.'
    });

    assert.equal(result.success, false);
    assert.equal(result.stage, 'cycle');
    assert.equal(toolCalls, 2);
    assert.equal(chatCalls, 3);
    assert.equal(result.iterations, 2);

    assert.deepEqual(
        savedMessages.map(message => message.role),
        ['user', 'assistant', 'tool', 'assistant', 'tool', 'assistant', 'tool']
    );
});

test('Deve interromper o ciclo quando a ferramenta retornar falha', async () => {
    let chatCalls = 0;
    const savedMessages = [];

    const runAgent = createAgent({
        buildContext: () => mockContext(),

        getSession: () => ({
            success: true,
            session: { project_id: 1 }
        }),

        saveMessage: (sessionId, role, content) => {
            savedMessages.push({ role, content });
            return { success: true };
        },

        executeTool: () => ({
            success: false,
            message: 'Falha ao ler o arquivo.'
        }),

        chat: async () => {
            chatCalls++;

            if (chatCalls === 1) {
                return mockOllama({
                    type: 'tool_call',
                    name: 'read_file',
                    arguments: { path: 'src/inexistente.js' }
                });
            }

            return mockOllama({
                type: 'final',
                message: 'Não foi possível ler o arquivo solicitado.'
            });
        }
    });

    const result = await runAgent({
        model: 'qwen3:4b',
        sessionId: 1,
        userMessage: 'Leia o arquivo.'
    });

    assert.equal(result.success, false);
    assert.equal(result.stage, 'tools');
    assert.match(result.message, /Falha ao ler o arquivo/);
    assert.equal(chatCalls, 1);

    const toolMessage = savedMessages.find(
        message => message.role === 'tool'
    );

    assert.ok(toolMessage);
    assert.match(toolMessage.content, /Falha ao ler o arquivo/);
});

test('Deve interromper o ciclo quando ocorrer exceção na ferramenta', async () => {
    let chatCalls = 0;
    const savedMessages = [];

    const runAgent = createAgent({
        buildContext: () => mockContext(),

        getSession: () => ({
            success: true,
            session: { project_id: 1 }
        }),

        saveMessage: (sessionId, role, content) => {
            savedMessages.push({ role, content });
            return { success: true };
        },

        executeTool: () => {
            throw new Error('Erro inesperado na ferramenta.');
        },

        chat: async () => {
            chatCalls++;

            if (chatCalls === 1) {
                return mockOllama({
                    type: 'tool_call',
                    name: 'read_file',
                    arguments: { path: 'src/example.js' }
                });
            }

            return mockOllama({
                type: 'final',
                message: 'A ferramenta apresentou um erro inesperado.'
            });
        }
    });

    const result = await runAgent({
        model: 'qwen3:4b',
        sessionId: 1,
        userMessage: 'Leia o arquivo.'
    });

    assert.equal(result.success, false);
    assert.equal(result.stage, 'tools');
    assert.match(result.message, /Erro inesperado na ferramenta/);
    assert.equal(chatCalls, 1);

    const toolMessage = savedMessages.find(
        message => message.role === 'tool'
    );

    assert.ok(toolMessage);
    assert.match(toolMessage.content, /Erro inesperado na ferramenta/);
});

test('Deve interromper o ciclo quando falhar ao persistir resultado da ferramenta', async () => {
    let chatCalls = 0;
    const savedMessages = [];

    const runAgent = createAgent({
        buildContext: () => mockContext(),

        getSession: () => ({
            success: true,
            session: { project_id: 1 }
        }),

        saveMessage: (sessionId, role, content) => {
            if (role === 'tool') {
                return {
                    success: false,
                    message: 'Falha ao salvar resultado da ferramenta.'
                };
            }

            savedMessages.push({ role, content });
            return { success: true };
        },

        executeTool: () => ({
            success: true,
            files: ['agent.js']
        }),

        chat: async () => {
            chatCalls++;

            return mockOllama({
                type: 'tool_call',
                name: 'list_files',
                arguments: { path: 'src' }
            });
        }
    });

    const result = await runAgent({
        model: 'qwen3:4b',
        sessionId: 1,
        userMessage: 'Liste os arquivos.'
    });

    assert.equal(result.success, false);
    assert.equal(result.stage, 'persistence');
    assert.match(result.message, /Falha ao salvar resultado/);

    assert.equal(chatCalls, 1);

    assert.deepEqual(
        savedMessages.map(message => message.role),
        ['user', 'assistant']
    );
});

test('Deve interromper o ciclo quando falhar ao persistir resposta do modelo', async () => {
    let chatCalls = 0;
    const savedMessages = [];

    const runAgent = createAgent({
        buildContext: () => mockContext(),

        getSession: () => ({
            success: true,
            session: { project_id: 1 }
        }),

        saveMessage: (sessionId, role, content) => {
            if (role === 'assistant') {
                return {
                    success: false,
                    message: 'Falha ao salvar resposta do modelo.'
                };
            }

            savedMessages.push({ role, content });
            return { success: true };
        },

        chat: async () => {
            chatCalls++;

            return mockOllama({
                type: 'final',
                message: 'Resposta final do agente.'
            });
        }
    });

    const result = await runAgent({
        model: 'qwen3:4b',
        sessionId: 1,
        userMessage: 'Responda.'
    });

    assert.equal(result.success, false);
    assert.equal(result.stage, 'persistence');
    assert.match(result.message, /Falha ao salvar resposta/);

    assert.equal(chatCalls, 1);

    assert.deepEqual(
        savedMessages.map(message => message.role),
        ['user']
    );
});

test('Deve rejeitar configuração inválida de maxModelCalls', async () => {
    let contextCalled = false;

    const runAgent = createAgent({
        maxModelCalls: 0,

        buildContext: () => {
            contextCalled = true;
            return mockContext();
        }
    });

    const result = await runAgent({
        model: 'qwen3:4b',
        sessionId: 1,
        userMessage: 'Analise o projeto.'
    });

    assert.equal(result.success, false);
    assert.equal(result.stage, 'configuration');
    assert.match(result.message, /maxModelCalls/);
    assert.equal(contextCalled, false);
});

test('Deve interromper o ciclo ao atingir maxModelCalls', async () => {
    let modelCalls = 0;
    let toolCalls = 0;

    const runAgent = createAgent({
        maxModelCalls: 1,

        buildContext: () => mockContext(),

        getSession: () => ({
            success: true,
            session: { project_id: 1 }
        }),

        saveMessage: () => ({ success: true }),

        chat: async () => {
            modelCalls++;

            if (modelCalls === 1) {
                return mockOllama({
                    type: 'tool_call',
                    name: 'list_files',
                    arguments: { path: '.' }
                });
            }

            return mockOllama({
                type: 'final',
                message: 'Concluído.'
            });
        },

        executeTool: async () => {
            toolCalls++;
            return { success: true, files: [] };
        }
    });

    const result = await runAgent({
        model: 'qwen3:4b',
        sessionId: 1,
        userMessage: 'Analise o projeto.'
    });

    assert.equal(result.success, false);
    assert.equal(result.stage, 'cycle');
    assert.match(result.message, /maxModelCalls/);
    assert.equal(modelCalls, 1);
    assert.equal(toolCalls, 1);
});

test('Deve rejeitar retorno malformado do Ollama', async () => {
    let validationCalled = false;
    let toolCalled = false;

    const runAgent = createAgent({
        buildContext: () => mockContext(),

        getSession: () => ({
            success: true,
            session: { project_id: 1 }
        }),

        saveMessage: () => ({ success: true }),

        chat: async () => ({
            success: true,
            model: 'qwen3:4b'
            // Retorno sem a propriedade message
        }),

        validateResponse: () => {
            validationCalled = true;
            return { success: true };
        },

        executeTool: async () => {
            toolCalled = true;
            return { success: true };
        }
    });

    const result = await runAgent({
        model: 'qwen3:4b',
        sessionId: 1,
        userMessage: 'Analise o projeto.'
    });

    assert.equal(result.success, false);
    assert.equal(result.stage, 'ollama');
    assert.match(result.message, /retorno|formato/i);
    assert.equal(validationCalled, false);
    assert.equal(toolCalled, false);
});

test('Deve rejeitar parâmetros de execução inválidos antes de preparar o contexto', async () => {
    let contextCalled = false;

    const runAgent = createAgent({
        buildContext: () => {
            contextCalled = true;
            return mockContext();
        }
    });

    const invalidInputs = [
        { model: '', sessionId: 1, userMessage: 'Analisar.' },
        { model: 'qwen3:4b', sessionId: 0, userMessage: 'Analisar.' },
        { model: 'qwen3:4b', sessionId: 1, userMessage: '   ' },
        {
            model: 'qwen3:4b',
            sessionId: 1,
            userMessage: 'Analisar.',
            taskCode: 123
        },
        {
            model: 'qwen3:4b',
            sessionId: 1,
            userMessage: 'Analisar.',
            fileResults: {}
        }
    ];

    for (const input of invalidInputs) {
        const result = await runAgent(input);

        assert.equal(result.success, false);
        assert.equal(result.stage, 'input');
        assert.ok(result.message);
    }

    assert.equal(contextCalled, false);
});

test('Deve fornecer mensagem quando Ollama falhar sem descrição', async () => {
    const runAgent = createAgent({
        buildContext: () => mockContext(),

        getSession: () => ({
            success: true,
            session: { project_id: 1 }
        }),

        saveMessage: () => ({ success: true }),

        chat: async () => ({
            success: false
        })
    });

    const result = await runAgent({
        model: 'qwen3:4b',
        sessionId: 1,
        userMessage: 'Analise o projeto.'
    });

    assert.equal(result.success, false);
    assert.equal(result.stage, 'ollama');
    assert.equal(typeof result.message, 'string');
    assert.ok(result.message.trim().length > 0);
});

test('Deve tratar retorno nulo do Ollama sem lançar exceção', async () => {
    const runAgent = createAgent({
        buildContext: () => mockContext(),

        getSession: () => ({
            success: true,
            session: { project_id: 1 }
        }),

        saveMessage: () => ({ success: true }),

        chat: async () => null
    });

    const result = await runAgent({
        model: 'qwen3:4b',
        sessionId: 1,
        userMessage: 'Analise o projeto.'
    });

    assert.equal(result.success, false);
    assert.equal(result.stage, 'ollama');
    assert.match(result.message, /formato inesperado/i);
});

test('Deve tratar exceção durante a persistência da mensagem', async () => {
    let chatCalls = 0;

    const runAgent = createAgent({
        buildContext: () => mockContext(),

        getSession: () => ({
            success: true,
            session: { project_id: 1 }
        }),

        saveMessage: () => {
            throw new Error('Banco de dados indisponível.');
        },

        chat: async () => {
            chatCalls++;
            return mockOllama({
                type: 'final',
                message: 'Resposta final.'
            });
        }
    });

    const result = await runAgent({
        model: 'qwen3:4b',
        sessionId: 1,
        userMessage: 'Analise o projeto.'
    });

    assert.equal(result.success, false);
    assert.equal(result.stage, 'persistence');
    assert.match(result.message, /Banco de dados indisponível/);
    assert.equal(chatCalls, 0);
});
