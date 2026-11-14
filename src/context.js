'use strict';

const { readFile } = require('./files');

const fs = require('node:fs');
const path = require('node:path');

const {
    getSession,
    getProject,
    listMessages,
    db
} = require('./database');

// Limites de contexto
const MAX_HISTORY_MESSAGES = 20;
const MAX_FILE_CHARS = 4000;
const MAX_TOTAL_FILE_CHARS = 12000;

// Limitar histórico preservando as mensagens mais recentes
function limitHistory(messages, maxMessages = MAX_HISTORY_MESSAGES) {
    if (!Array.isArray(messages)) {
        return [];
    }

    if (!Number.isInteger(maxMessages) || maxMessages < 0) {
        return [];
    }

    if (maxMessages === 0) {
        return [];
    }

    return messages.slice(-maxMessages);
}

const { parseTask } = require('./tasks');

// Carregar instruções gerais do agente
function loadSystemPrompt() {
    const promptPath = path.join(__dirname, '..', 'prompts', 'system.md');

    try {
        const content = fs.readFileSync(promptPath, 'utf8');

        if (!content.trim()) {
            return {
                success: false,
                message: 'O arquivo de instruções gerais está vazio.'
            };
        }

        return {
            success: true,
            content
        };

    } catch (error) {
        return {
            success: false,
            message: `Erro ao carregar instruções gerais: ${error.message}`
        };
    }
}

// Recuperar tarefa atual do projeto
function loadTask(projectId, taskCode, projectRoot) {
    if (!taskCode) {
        return {
            success: true,
            task: null
        };
    }

    const taskRecord = db.prepare(`
        SELECT *
        FROM tasks
        WHERE project_id = ?
        AND code = ?
        AND is_active = 1
    `).get(projectId, taskCode);

    if (!taskRecord) {
        return {
            success: false,
            message: `Tarefa ${taskCode} não encontrada no projeto.`
        };
    }

    const taskPath = path.join(
        'tasks',
        `${taskCode}.md`
    );

    const fileResult = readFile(projectRoot, taskPath);

    if (!fileResult.success) {
        return {
            success: false,
            message: `Erro ao carregar documento da tarefa: ${fileResult.message}`
        };
    }

    const parsed = parseTask(fileResult.content);

    if (!parsed.success) {
        return {
            success: false,
            message: `Documento da tarefa inválido: ${parsed.errors.join('; ')}`
        };
    }

    return {
        success: true,
        task: {
            ...taskRecord,
            details: parsed.task
        }
    };    
}

// Limitar resultados de consultas a arquivos
function limitFileResults(
    fileResults,
    maxPerFile = MAX_FILE_CHARS,
    maxTotal = MAX_TOTAL_FILE_CHARS
) {
    if (!Array.isArray(fileResults) || fileResults.length === 0) {
        return null;
    }

    if (
        !Number.isInteger(maxPerFile) ||
        maxPerFile <= 0 ||
        !Number.isInteger(maxTotal) ||
        maxTotal <= 0
    ) {
        return null;
    }

    const formattedResults = [];
    let totalChars = 0;

    for (let index = 0; index < fileResults.length; index++) {
        const prefix = `Resultado ${index + 1}:\n`;
        const separator = formattedResults.length > 0 ? '\n\n' : '';
        const available = maxTotal - totalChars - separator.length;

        if (available <= prefix.length) {
            break;
        }

        const content = JSON.stringify(fileResults[index], null, 2);
        const limit = Math.min(maxPerFile, available - prefix.length);
        const marker = '\n...[resultado truncado]';

        let formattedContent = content;

        if (content.length > limit) {
            if (limit <= marker.length) {
                formattedContent = marker.slice(0, limit);
            } else {
                formattedContent =
                    content.slice(0, limit - marker.length) + marker;
            }
        }

        const formatted = prefix + formattedContent;

        formattedResults.push(formatted);
        totalChars += separator.length + formatted.length;
    }

    return formattedResults.join('\n\n');
}

// Manter a função de formatação como interface pública
function formatFileResults(fileResults) {
    return limitFileResults(fileResults);
}

// Preparar contexto da conversa
function buildContext({
    sessionId,
    taskCode = null,
    userMessage,
    fileResults = []
} = {}) {
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return {
            success: false,
            message: 'Identificador de sessão inválido.'
        };
    }

    if (typeof userMessage !== 'string' || !userMessage.trim()) {
        return {
            success: false,
            message: 'A mensagem do usuário é obrigatória.'
        };
    }

    try {
        const prompt = loadSystemPrompt();

        if (!prompt.success) {
            return prompt;
        }

        const sessionResult = getSession(sessionId);

        if (!sessionResult.success || !sessionResult.session) {
            return {
                success: false,
                message: 'Sessão não encontrada.'
            };
        }

        const session = sessionResult.session;

        const projectResult = getProject(session.project_id);

        if (!projectResult.success || !projectResult.project) {
            return {
                success: false,
                message: 'Projeto associado à sessão não encontrado.'
            };
        }

        const project = projectResult.project;

        const messages = [
            {
                role: 'system',
                content: prompt.content
            },
            {
                role: 'system',
                content: `Projeto atual: ${project.name}\nDiretório: ${project.root_path}`
            }
        ];

	const currentTaskCode = taskCode || session.task_code;

        if (currentTaskCode) {
            const taskResult = loadTask(
    		project.id,
    		currentTaskCode,
    		project.root_path
	    );

            if (!taskResult.success) {
                return taskResult;
            }

            messages.push({
                role: 'system',
                content: `Tarefa atual:\n${JSON.stringify(taskResult.task, null, 2)}`
            });
        }
        
        const formattedFiles = formatFileResults(fileResults);

        if (formattedFiles) {
            messages.push({
                role: 'system',
                content: `Resultados de consultas a arquivos:\n${formattedFiles}`
            });
        }

        const historyResult = listMessages(sessionId);

        if (!historyResult.success) {
            return historyResult;
        }

        const recentMessages = limitHistory(historyResult.messages);

	for (const message of recentMessages) {
            messages.push({
                role: message.role,
                content: message.content
            });
        }

        messages.push({
            role: 'user',
            content: userMessage.trim()
        });

        return {
            success: true,
            messages
        };

    } catch (error) {
        return {
            success: false,
            message: `Erro ao preparar contexto: ${error.message}`
        };
    }
}

module.exports = {
    loadSystemPrompt,
    loadTask,
    formatFileResults,
    limitHistory,
    limitFileResults,
    buildContext
};
