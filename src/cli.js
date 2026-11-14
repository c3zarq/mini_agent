'use strict';

const readline = require('node:readline');

const {
    listProjects: defaultListProjects,
    getSession: defaultGetSession,
    getProject: defaultGetProject,
    listTasks: defaultListTasks
} = require('./database');

const {
    loadTask: defaultLoadTask
} = require('./context');

const {
    readEAP: defaultReadEAP,
    parseEAP: defaultParseEAP
} = require('./eap');

const {
    calculateProgress: defaultCalculateProgress
} = require('./progress');

const {
    approveProposal: defaultApproveProposal
} = require('./approval');

const path = require('node:path');

// Formatar o resultado retornado pelo agente
function formatAgentResult(result) {
    if (!result || typeof result !== 'object') {
        return 'Erro: retorno inválido do agente.';
    }

    if (!result.success) {
        return `Erro: ${result.message || 'Falha durante o processamento.'}`;
    }

    if (result.type === 'final') {
        const message = result.response?.message;

        if (typeof message !== 'string' || !message.trim()) {
            return 'Erro: resposta final sem mensagem.';
        }

        return `Agente: ${message}`;
    }

    if (result.type === 'proposal') {
        const response = result.response || {};
        const proposal = result.proposal || {};

        const message = typeof response.message === 'string'
            ? response.message
            : 'O agente apresentou uma proposta.';

        const name = typeof proposal.name === 'string'
            ? proposal.name
            : 'Operação não identificada';

        const args = JSON.stringify(
            proposal.arguments ?? {},
            null,
            2
        );

        return [
            `Agente: ${message}`,
            `Proposta: ${name}`,
            `Argumentos:\n${args}`
        ].join('\n');
    }

    return 'Erro: tipo de retorno do agente desconhecido.';
}

// Formatar listagem de projetos
function formatProjects(result, currentProjectId) {
    if (!result.success) {
        return `Erro ao listar projetos: ${result.message}`;
    }

    if (result.projects.length === 0) {
        return 'Nenhum projeto cadastrado.';
    }

    const lines = ['Projetos cadastrados:'];

    for (const project of result.projects) {
        const current = project.id === currentProjectId
            ? ' (projeto atual)'
            : '';

        lines.push(
	    `${project.id} - ${project.name}${current}`,
	    `  Diretório: ${project.root_path}`
	);
    }

    return lines.join('\n');
}

// Formatar listagem de tarefas
function formatTasks(result) {
    if (!result.success) {
        return `Erro ao listar tarefas: ${result.message}`;
    }

    if (result.tasks.length === 0) {
        return 'Nenhuma tarefa ativa neste projeto.';
    }

    const lines = ['Tarefas ativas:'];

    for (const task of result.tasks) {
        lines.push(
            `${task.code} - ${task.title} [${task.status}]`
        );
    }

    return lines.join('\n');
}

// Formatar visualização da EAP
function formatEAP(result) {
    if (!result || !result.success) {
        const errors = result?.errors;

        return `Erro ao interpretar EAP: ${
            Array.isArray(errors)
                ? errors.join('; ')
                : 'Estrutura inválida.'
        }`;
    }

    if (
        !result.project ||
        typeof result.project.name !== 'string' ||
        !Array.isArray(result.phases)
    ) {
        return 'Erro: estrutura da EAP inválida.';
    }

    const lines = [
        `EAP: ${result.project.name}`
    ];

    for (const phase of result.phases) {
        lines.push(
            '',
            `${phase.code} — ${phase.title}`
        );

        for (const task of phase.tasks) {
            lines.push(
                `  ${task.code} — ${task.title}`,
                `    Resultado esperado: ${task.expectedResult}`
            );
        }
    }

    return lines.join('\n');
}

// Formatar indicadores de progresso
function formatProgress(result) {
    if (!result || !result.success) {
        return `Erro ao calcular progresso: ${
            result?.message || 'Resultado inválido.'
        }`;
    }

    if (
        !result.overall ||
        !Array.isArray(result.phases)
    ) {
        return 'Erro: estrutura do progresso inválida.';
    }

    const { total, completed, percentage } = result.overall;

    if (
        !Number.isFinite(total) ||
        !Number.isFinite(completed) ||
        !Number.isFinite(percentage)
    ) {
        return 'Erro: indicadores gerais inválidos.';
    }

    const lines = [
        'Progresso do projeto:',
        `Geral: ${percentage}% (${completed}/${total} tarefas concluídas)`,
        '',
        'Progresso por etapa:'
    ];

    if (result.phases.length === 0) {
        lines.push('Nenhuma etapa encontrada.');
    }

    for (const phase of result.phases) {
        if (
            !phase ||
            typeof phase.code !== 'string' ||
            typeof phase.title !== 'string' ||
            !Number.isFinite(phase.total) ||
            !Number.isFinite(phase.completed) ||
            !Number.isFinite(phase.percentage)
        ) {
            return 'Erro: indicador de etapa inválido.';
        }

        lines.push(
            `${phase.code} — ${phase.title}: ${phase.percentage}% ` +
            `(${phase.completed}/${phase.total} tarefas concluídas)`
        );
    }

    return lines.join('\n');
}

// Iniciar interface conversacional
async function startCLI({
    runAgent,
    model,
    sessionId,
    input = process.stdin,
    output = process.stdout,
    createInterface = readline.createInterface,
    prompt = 'Você: ',
    listProjects = defaultListProjects,
    getSession = defaultGetSession,
    listTasks = defaultListTasks,
    getProject = defaultGetProject,
    loadTask = defaultLoadTask,
    readEAP = defaultReadEAP,
    parseEAP = defaultParseEAP,
    calculateProgress = defaultCalculateProgress,
    approveProposal = defaultApproveProposal
} = {}) {
    if (typeof runAgent !== 'function') {
        return {
            success: false,
            message: 'Função do agente inválida.'
        };
    }

    if (typeof model !== 'string' || !model.trim()) {
        return {
            success: false,
            message: 'Modelo não informado.'
        };
    }

    if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return {
            success: false,
            message: 'Identificador de sessão inválido.'
        };
    }

    if (
        typeof listProjects !== 'function' ||
        typeof getSession !== 'function' ||
        typeof listTasks !== 'function' ||
        typeof getProject !== 'function' ||
        typeof loadTask !== 'function' ||
        typeof readEAP !== 'function' ||
	typeof parseEAP !== 'function' ||
	typeof calculateProgress !== 'function' ||
	typeof approveProposal !== 'function'
    ) {
        return {
            success: false,
            message: 'Funções de consulta do projeto inválidas.'
        };
    }

    let rl;
    let currentTaskCode = null;
    let pendingProposal = null;

    try {
        const sessionResult = getSession(sessionId);

        if (!sessionResult.success || !sessionResult.session) {
            return {
                success: false,
                message: 'Não foi possível recuperar a sessão atual.'
            };
        }

        const session = sessionResult.session;

        const projectResult = getProject(session.project_id);

        if (!projectResult.success || !projectResult.project) {
            return {
                success: false,
                message: 'Projeto da sessão não encontrado.'
            };
        }

        const currentProject = projectResult.project;

        rl = createInterface({
            input,
            output,
            terminal: Boolean(input.isTTY && output.isTTY)
        });

        // Tratar interrupção pelo teclado
        rl.on('SIGINT', () => {
            output.write('\nInterrupção recebida. Encerrando...\n');
            rl.close();
        });

        output.write('Conversa iniciada. Ctrl+C ou Ctrl+D para encerrar.\n');
        output.write(prompt);

        // Processar mensagens sequencialmente
        for await (const line of rl) {
            const userMessage = line.trim();

            if (!userMessage) {
                output.write(prompt);
                continue;
            }
            
            // Apresentar ajuda da interface
	    if (userMessage === '/ajuda') {
	        const help = [
		    'Comandos disponíveis:',
		    '',
		    '/ajuda       — Apresentar esta ajuda.',
		    '/sair        — Encerrar a interface.',
		    '/projetos    — Listar projetos cadastrados.',
		    '/tarefas     — Listar tarefas do projeto atual.',
		    '/tarefa      — Consultar a tarefa selecionada.',
		    '/tarefa CODE — Selecionar uma tarefa como contexto.',
		    '/eap         — Apresentar a estrutura do projeto.',
		    '/progresso   — Consultar o progresso do projeto.',
		    '/aprovar     — Aprovar uma proposta pendente.',
		    '/rejeitar    — Rejeitar uma proposta pendente.',
		    '',
		    'Mensagens que não começam com / são encaminhadas ao agente.',
		    'Ctrl+C ou Ctrl+D também encerram a interface.'
	        ].join('\n');

	        output.write(`${help}\n`);
	        output.write(prompt);
	        continue;
	    }

	    // Encerrar a interface
	    if (userMessage === '/sair') {
	        output.write('Encerrando interface...\n');
	        rl.close();
	        break;
	    }
            
            // Visualizar a EAP do projeto atual
            if (userMessage === '/eap') {
                const eapPath = path.join(
                    currentProject.root_path,
                    'docs',
                    'EAP.md'
                );

                const fileResult = readEAP(eapPath);

                if (!fileResult.success) {
                    output.write(
                        `Erro ao ler EAP: ${fileResult.message}\n`
                    );
                } else {
                    const eapResult = parseEAP(fileResult.content);

                    output.write(`${formatEAP(eapResult)}\n`);
                }

                output.write(prompt);
                continue;
            }

            // Consultar progresso do projeto atual
            if (userMessage === '/progresso') {
                const taskResult = listTasks(currentProject.id);

                if (!taskResult.success) {
                    output.write(
                        `Erro ao consultar tarefas: ${taskResult.message}\n`
                    );
                    output.write(prompt);
                    continue;
                }

                const eapPath = path.join(
                    currentProject.root_path,
                    'docs',
                    'EAP.md'
                );

                const fileResult = readEAP(eapPath);

                if (!fileResult.success) {
                    output.write(
                        `Erro ao ler EAP: ${fileResult.message}\n`
                    );
                    output.write(prompt);
                    continue;
                }

                const eapResult = parseEAP(fileResult.content);

                if (!eapResult.success) {
                    const errors = Array.isArray(eapResult.errors)
                        ? eapResult.errors.join('; ')
                        : eapResult.message || 'Estrutura inválida.';

                    output.write(
                        `Erro ao interpretar EAP: ${errors}\n`
                    );
                    output.write(prompt);
                    continue;
                }

                const progressResult = calculateProgress(
                    taskResult.tasks,
                    eapResult.phases
                );

                output.write(`${formatProgress(progressResult)}\n`);
                output.write(prompt);
                continue;
            }
            
            // Aprovar proposta pendente
	    if (userMessage === '/aprovar' || userMessage === '/rejeitar') {
	        if (!pendingProposal) {
		    output.write('Não existe proposta pendente.\n');
		    output.write(prompt);
		    continue;
	        }

	        const decision = userMessage === '/aprovar'
		    ? 'approve'
		    : 'reject';

	        try {
		    const result = approveProposal(
		        pendingProposal,
		        decision,
		        currentProject.root_path
		    );

		    if (!result.success) {
		        output.write(`Erro na decisão: ${result.message}\n`);
		    } else if (result.status === 'rejected') {
		        output.write('Proposta rejeitada. Nenhuma alteração foi realizada.\n');
		    } else {
		        output.write(`${result.message}\n`);
		    }

	        } catch (error) {
		    output.write(`Erro ao processar decisão: ${error.message}\n`);

	        } finally {
		    pendingProposal = null;
	        }

	        output.write(prompt);
	        continue;
	    }

	    // Comandos internos
            if (userMessage === '/projetos') {
                const result = listProjects();

                output.write(
                    `${formatProjects(result, currentProject.id)}\n`
                );

                output.write(prompt);
                continue;
            }

            if (userMessage === '/tarefas') {
                const result = listTasks(currentProject.id);

                output.write(`${formatTasks(result)}\n`);
                output.write(prompt);
                continue;
            }

            if (userMessage === '/tarefa') {
                output.write(
                    currentTaskCode
                        ? `Tarefa selecionada: ${currentTaskCode}\n`
                        : 'Nenhuma tarefa selecionada.\n'
                );

                output.write(prompt);
                continue;
            }

            if (userMessage.startsWith('/tarefa ')) {
                const taskCode = userMessage
                    .slice('/tarefa '.length)
                    .trim();

                if (!taskCode || /\s/.test(taskCode)) {
                    output.write('Informe um código de tarefa válido.\n');
                } else {
                    const result = loadTask(
                        currentProject.id,
                        taskCode,
                        currentProject.root_path
                    );

                    if (!result.success) {
                        output.write(`Erro: ${result.message}\n`);
                    } else {
                        currentTaskCode = taskCode;

                        output.write(
                            `Tarefa ${taskCode} selecionada como contexto.\n`
                        );
                    }
                }

                output.write(prompt);
                continue;
            }
            
            // Identificar comandos desconhecidos
	    if (userMessage.startsWith('/')) {
	        output.write(
		    'Comando desconhecido. Consulte /ajuda para ver os comandos disponíveis.\n'
	        );
	        output.write(prompt);
	        continue;
            }
            
            // Impedir novas mensagens enquanto houver proposta pendente
	    if (pendingProposal) {
	        output.write(
		    'Existe uma proposta aguardando decisão. ' +
		    'Utilize /aprovar ou /rejeitar antes de continuar.\n'
	        );
	        output.write(prompt);
	        continue;
	    }

            // Mensagem conversacional
            try {
                const result = await runAgent({
                    model,
                    sessionId,
                    userMessage,
                    ...(currentTaskCode
                        ? { taskCode: currentTaskCode }
                        : {})
                });

                output.write(`${formatAgentResult(result)}\n`);

		if (result?.success && result.type === 'proposal') {
		    pendingProposal = result.proposal;

		    output.write(
			'Aguardando sua decisão: utilize /aprovar ou /rejeitar.\n'
		    );
		}

            } catch (error) {
                output.write(
                    `Erro ao processar mensagem: ${error.message}\n`
                );
            }

            output.write(prompt);
        }

        output.write('\nInterface encerrada.\n');

        return {
            success: true
        };

    } catch (error) {
        const message = `Falha na interface: ${error.message}`;

        output.write(`${message}\n`);

        return {
            success: false,
            message
        };

    } finally {
        if (rl) {
            rl.close();
        }
    }
}

module.exports = {
    startCLI,
    formatAgentResult,
    formatProjects,
    formatTasks,
    formatEAP,
    formatProgress
};
