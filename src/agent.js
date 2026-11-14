'use strict';

const context = require('./context');
const ollama = require('./ollama');
const protocol = require('./protocol');
const operations = require('./operations');
const tools = require('./tools');
const database = require('./database');

// Criar o coordenador do agente
function createAgent({
    buildContext = context.buildContext,
    chat = ollama.chat,
    validateResponse = protocol.validateResponse,
    interpretOperation = operations.interpretOperation,
    executeTool = tools.executeTool,
    getSession = database.getSession,
    saveMessage = database.saveMessage,
    maxIterations = 10,
    maxModelCalls = 10
} = {}) {

    return async function runAgent({
        model,
        sessionId,
        userMessage,
        taskCode = null,
        fileResults = []
    } = {}) {

        let stage = 'context';
        
        // Validar os parâmetros de execução
	if (
	    typeof model !== 'string' ||
	    !model.trim() ||
	    !Number.isInteger(sessionId) ||
	    sessionId <= 0 ||
	    typeof userMessage !== 'string' ||
	    !userMessage.trim() ||
	    (taskCode !== null && typeof taskCode !== 'string') ||
	    !Array.isArray(fileResults)
	) {
	    return {
		success: false,
		stage: 'input',
		message: 'Parâmetros de execução inválidos.'
	    };
	}

        // Validar o limite de execuções de ferramentas
        if (!Number.isInteger(maxIterations) || maxIterations < 0) {
            return {
                success: false,
                stage: 'configuration',
                message: 'Limite de iterações inválido.'
            };
        }
        
        // Validar o limite de consultas ao modelo
        if (!Number.isInteger(maxModelCalls) || maxModelCalls < 1) {
            return {
                success: false,
                stage: 'configuration',
                message: 'Limite de consultas ao modelo (maxModelCalls) inválido.'
            };
        }

        // Persistir uma mensagem no histórico
        function persistMessage(role, content) {
            const result = saveMessage(sessionId, role, content);

            if (!result.success) {
                return {
                    success: false,
                    message: result.message
                };
            }

            return {
                success: true
            };
        }

        // Converter resultados em conteúdo textual
        function serializeContent(content) {
            if (typeof content === 'string') {
                return content;
            }

            return JSON.stringify(content) ?? String(content);
        }

        try {
            // Preparar o contexto da conversa
            const contextResult = buildContext({
                sessionId,
                taskCode,
                userMessage,
                fileResults
            });

            if (!contextResult.success) {
                return {
                    success: false,
                    stage,
                    message: contextResult.message
                };
            }

            const messages = contextResult.messages;

            // Recuperar o projeto associado à sessão
            stage = 'session';

            const sessionResult = getSession(sessionId);

            if (!sessionResult.success || !sessionResult.session) {
                return {
                    success: false,
                    stage,
                    message: sessionResult.message || 'Sessão não encontrada.'
                };
            }

            const projectId = sessionResult.session.project_id;

            // Persistir a mensagem atual do usuário
            stage = 'persistence';

            const userSave = persistMessage(
                'user',
                userMessage.trim()
            );

            if (!userSave.success) {
                return {
                    success: false,
                    stage,
                    message: userSave.message
                };
            }

            // Controlar a quantidade de ferramentas executadas
            let iterations = 0;
            
            // Controlar a quantidade de consultas ao modelo
	    let modelCalls = 0;

            // Iniciar ciclo de execução
            while (true) {

                // Consultar o modelo
		stage = 'cycle';

		if (modelCalls >= maxModelCalls) {
		    return {
			success: false,
			stage,
			message: 'Limite de consultas ao modelo (maxModelCalls) atingido.',
			modelCalls
		    };
		}

		modelCalls++;

		stage = 'ollama';

		const ollamaResult = await chat(
				    model,
				    messages,
				    { format: 'json' }
				);

                // Validar a estrutura básica do retorno do Ollama
		if (
		    typeof ollamaResult !== 'object' ||
		    ollamaResult === null ||
		    Array.isArray(ollamaResult)
		) {
		    return {
			success: false,
			stage: 'ollama',
			message: 'Formato inesperado no retorno da comunicação com Ollama.'
		    };
		}

		// Tratar falhas de comunicação
		if (ollamaResult.success === false) {
		    const errorMessage =
			typeof ollamaResult.message === 'string' &&
			ollamaResult.message.trim()
			    ? ollamaResult.message
			    : 'Falha na comunicação com Ollama sem descrição.';

		    return {
			success: false,
			stage: 'ollama',
			message: errorMessage
		    };
		}

		// Rejeitar envelopes sem indicação válida de sucesso
		if (ollamaResult.success !== true) {
		    return {
			success: false,
			stage: 'ollama',
			message: 'Retorno inválido da comunicação com Ollama.'
		    };
		}
                
                // Validar a estrutura do retorno do Ollama
		if (
		    typeof ollamaResult !== 'object' ||
		    ollamaResult === null ||
		    Array.isArray(ollamaResult) ||
		    typeof ollamaResult.model !== 'string' ||
		    !ollamaResult.model.trim() ||
		    typeof ollamaResult.message !== 'object' ||
		    ollamaResult.message === null ||
		    Array.isArray(ollamaResult.message) ||
		    ollamaResult.message.role !== 'assistant' ||
		    typeof ollamaResult.message.content !== 'object' ||
		    ollamaResult.message.content === null ||
		    Array.isArray(ollamaResult.message.content)
		) {
		    return {
			success: false,
			stage: 'ollama',
			message: 'Formato inesperado no retorno da comunicação com Ollama.'
		    };
		}

                // Validar a resposta recebida
                stage = 'protocol';

                const response = ollamaResult.message.content;
                const validation = validateResponse(response);

                if (!validation.success) {
                    return {
                        success: false,
                        stage,
                        message: 'O modelo retornou uma resposta fora do protocolo.',
                        errors: validation.errors
                    };
                }

                // Persistir a resposta válida do modelo
                stage = 'persistence';

                const assistantContent = serializeContent(response);

                const assistantSave = persistMessage(
                    'assistant',
                    assistantContent
                );

                if (!assistantSave.success) {
                    return {
                        success: false,
                        stage,
                        message: assistantSave.message
                    };
                }
                
                // Acrescentar a resposta do modelo ao contexto
		messages.push({
    		    role: 'assistant',
    		    content: assistantContent
		});

                // Interpretar a resposta
                stage = 'operations';

                const operation = interpretOperation(response);

                if (!operation.success) {
                    return {
                        success: false,
                        stage,
                        message: operation.message,
                        errors: operation.errors || []
                    };
                }

                // Encerrar quando o modelo produzir uma resposta final
                if (operation.type === 'final') {
                    return {
                        success: true,
                        model: ollamaResult.model,
                        type: 'final',
                        response
                    };
                }

                // Retornar propostas sem executá-las
                if (operation.type === 'proposal') {
                    return {
                        success: true,
                        model: ollamaResult.model,
                        type: 'proposal',
                        response,
                        proposal: operation
                    };
                }

                // Verificar o limite de execuções
                stage = 'tools';

                let toolResult;

                if (iterations >= maxIterations) {
                    toolResult = {
                        success: false,
                        message: 'Limite de execuções de ferramentas atingido.'
                    };

                } else {
                    // Executar a ferramenta autorizada
                    try {
                        toolResult = await executeTool(
                            operation,
                            projectId
                        );

                    } catch (error) {
                        toolResult = {
                            success: false,
                            message: `Erro ao executar ferramenta: ${error.message}`
                        };
                    }

                    iterations++;
                }

                // Converter o resultado em texto
                const toolContent = serializeContent(toolResult);

                // Persistir o resultado da ferramenta
                stage = 'persistence';

                const toolSave = persistMessage(
                    'tool',
                    toolContent
                );

                if (!toolSave.success) {
                    return {
                        success: false,
                        stage,
                        message: toolSave.message
                    };
                }

                // Acrescentar o resultado ao contexto da conversa
                messages.push({
                    role: 'tool',
                    content: toolContent
                });

                // Encerrar se o limite foi atingido
                if (iterations > maxIterations ||
                    (iterations === maxIterations &&
                     toolResult.message === 'Limite de execuções de ferramentas atingido.')) {

                    return {
                        success: false,
                        stage: 'cycle',
                        message: 'Limite de execuções de ferramentas atingido.',
                        iterations
                    };
                }
                
                // Encerrar se a ferramenta apresentar falha
		if (!toolResult || toolResult.success !== true) {
		    stage = 'tools';

		    return {
			success: false,
			stage,
			message: toolResult?.message ||
			    'A execução da ferramenta não foi concluída com sucesso.',
			iterations
		    };
		}

                // O ciclo continua com uma nova consulta ao modelo
            }

        } catch (error) {
            return {
                success: false,
                stage,
                message: `Falha na etapa ${stage}: ${error.message}`
            };
        }
    };
}

// Instância padrão do agente
const runAgent = createAgent();

module.exports = {
    createAgent,
    runAgent
};
