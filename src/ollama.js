'use strict';

const OLLAMA_URL = process.env.OLLAMA_HOST || 'http://localhost:11434';

async function checkConnection() {
    try {
        const response = await fetch(OLLAMA_URL, {
            signal: AbortSignal.timeout(5000)
        });

        const message = (await response.text()).trim();

        if (!response.ok) {
            return {
                connected: false,
                message: `Ollama respondeu com HTTP ${response.status}.`
            };
        }

        if (message !== 'Ollama is running') {
            return {
                connected: false,
                message: 'Resposta inesperada do servidor Ollama.'
            };
        }

        return {
            connected: true,
            message: 'Ollama is running'
        };

    } catch (error) {
        return {
            connected: false,
            message: error.name === 'TimeoutError'
                ? 'Tempo limite de conexão com Ollama excedido.'
                : `Falha ao conectar com Ollama: ${error.message}`
        };
    }
}

async function listModels() {
    try {
        const response = await fetch(`${OLLAMA_URL}/api/tags`, {
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
            return {
                success: false,
                message: `Ollama respondeu com HTTP ${response.status}.`
            };
        }

        const data = await response.json();

        if (!Array.isArray(data.models)) {
            return {
                success: false,
                message: 'Formato inesperado na resposta do Ollama.'
            };
        }

        return {
            success: true,
            models: data.models
        };

    } catch (error) {
        return {
            success: false,
            message: error.name === 'TimeoutError'
                ? 'Tempo limite de consulta excedido.'
                : `Falha ao consultar modelos: ${error.message}`
        };
    }
}

async function chat(model, messages, options = {}) {
    if (typeof model !== 'string' || !model.trim()) {
        return {
            success: false,
            message: 'Nome do modelo inválido.'
        };
    }

    const validRoles = ['system', 'user', 'assistant', 'tool'];

    if (
        !Array.isArray(messages) ||
        messages.length === 0 ||
        !messages.every(message =>
            message &&
            validRoles.includes(message.role) &&
            typeof message.content === 'string'
        )
    ) {
        return {
            success: false,
            message: 'Lista de mensagens inválida.'
        };
    }

    if (
        !options ||
        typeof options !== 'object' ||
        (options.format !== undefined && options.format !== 'json')
    ) {
        return {
            success: false,
            message: 'Opções de resposta inválidas.'
        };
    }

    try {
        const response = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
    		model,
   		messages,
    		stream: false,
    		...(options.format === 'json' ? { format: 'json' } : {})
	    }),
            signal: AbortSignal.timeout(300000)
        });

        const raw = await response.text();

        let data;

        try {
            data = JSON.parse(raw);
        } catch {
            return {
                success: false,
                message: 'Resposta inválida do servidor Ollama.'
            };
        }

        if (!response.ok) {
            return {
                success: false,
                message: `Ollama respondeu com HTTP ${response.status}: ${data.error || 'Erro desconhecido.'}`
            };
        }

        if (
            !data.message ||
            typeof data.message.content !== 'string'
        ) {
            return {
                success: false,
                message: 'Formato inesperado na resposta do modelo.'
            };
        }

        let content = data.message.content;

        if (options.format === 'json') {
            try {
                content = JSON.parse(content);
            } catch {
                return {
                    success: false,
                    message: 'O modelo retornou um JSON inválido.'
                };
            }
        }

        return {
            success: true,
            model: data.model,
            message: {
                role: data.message.role,
                content
            }
        };

    } catch (error) {
        return {
            success: false,
            message: error.name === 'TimeoutError'
                ? 'Tempo limite de resposta do modelo excedido.'
                : `Falha ao enviar mensagem ao Ollama: ${error.message}`
        };
    }
}

module.exports = {
    checkConnection,
    listModels,
    chat
};
