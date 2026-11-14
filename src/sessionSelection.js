'use strict';

const readline = require('node:readline');

// Selecionar projeto e sessão
async function selectProjectAndSession({
    listProjects,
    listSessions,
    input = process.stdin,
    output = process.stdout,
    createInterface = readline.createInterface
} = {}) {

    // Validar dependências
    if (
        typeof listProjects !== 'function' ||
        typeof listSessions !== 'function' ||
        typeof createInterface !== 'function' ||
        !output ||
        typeof output.write !== 'function'
    ) {
        return {
            success: false,
            message: 'Dependências para seleção de projeto e sessão inválidas.'
        };
    }

    let rl;

    // Fila de respostas recebidas
    const answers = [];
    const pendingAnswers = [];
    let inputClosed = false;

    // Ler uma resposta, preservando entradas recebidas antecipadamente
    function ask(question) {
        output.write(question);

        if (answers.length > 0) {
            return Promise.resolve(answers.shift());
        }

        if (inputClosed) {
            return Promise.resolve(null);
        }

        return new Promise(resolve => {
            pendingAnswers.push(resolve);
        });
    }

    // Armazenar ou entregar uma resposta recebida
    function handleLine(line) {
        if (pendingAnswers.length > 0) {
            pendingAnswers.shift()(line);
        } else {
            answers.push(line);
        }
    }

    // Tratar encerramento da entrada
    function handleClose() {
        inputClosed = true;

        while (pendingAnswers.length > 0) {
            pendingAnswers.shift()(null);
        }
    }

    // Solicitar uma opção numérica válida
    async function askSelection(question, min, max) {
        while (true) {
            const answer = await ask(question);

            if (answer === null) {
                return null;
            }

            const selection = Number(answer.trim());

            if (
                Number.isInteger(selection) &&
                selection >= min &&
                selection <= max
            ) {
                return selection;
            }

            output.write('Seleção inválida. Tente novamente.\n');
        }
    }

    try {
        rl = createInterface({ input, output });
        rl.on('line', handleLine);
        rl.on('close', handleClose);

        // Consultar projetos cadastrados
        const projectsResult = await listProjects();

        if (!projectsResult || projectsResult.success !== true) {
            return {
                success: false,
                message: projectsResult?.message ||
                    'Não foi possível consultar os projetos.'
            };
        }

        if (
            !Array.isArray(projectsResult.projects) ||
            projectsResult.projects.some(project =>
                !project ||
                !Number.isInteger(project.id) ||
                project.id <= 0 ||
                typeof project.name !== 'string' ||
                !project.name.trim()
            )
        ) {
            return {
                success: false,
                message: 'A lista de projetos retornada é inválida.'
            };
        }

        const projects = projectsResult.projects;

        if (projects.length === 0) {
            return {
                success: false,
                message: 'Nenhum projeto cadastrado.'
            };
        }

        // Apresentar projetos
        output.write('Projetos disponíveis:\n');

        projects.forEach((project, index) => {
            output.write(`${index + 1} - ${project.name}\n`);
        });

        // Selecionar projeto
        const projectSelection = await askSelection(
            'Selecione um projeto: ',
            1,
            projects.length
        );

        if (projectSelection === null) {
            return {
                success: false,
                message: 'Entrada encerrada pelo usuário.'
            };
        }

        const project = projects[projectSelection - 1];

        // Consultar sessões do projeto
        const sessionsResult = await listSessions(project.id);

        if (!sessionsResult || sessionsResult.success !== true) {
            return {
                success: false,
                message: sessionsResult?.message ||
                    'Não foi possível consultar as sessões.'
            };
        }

        if (
            !Array.isArray(sessionsResult.sessions) ||
            sessionsResult.sessions.some(session =>
                !session ||
                !Number.isInteger(session.id) ||
                session.id <= 0 ||
                typeof session.model !== 'string' ||
                !session.model.trim()
            )
        ) {
            return {
                success: false,
                message: 'A lista de sessões retornada é inválida.'
            };
        }

        const sessions = sessionsResult.sessions;

        // Sem sessões: iniciar uma nova conversa
        if (sessions.length === 0) {
            output.write('\nNenhuma sessão encontrada para este projeto.\n');

            return {
                success: true,
                project,
                choice: 'new',
                session: null
            };
        }

        // Apresentar sessões existentes
        output.write('\nSessões disponíveis:\n');
        output.write('0 - Iniciar nova conversa\n');

        sessions.forEach((session, index) => {
            output.write(
                `${index + 1} - Sessão ${session.id} | Modelo: ${session.model}\n`
            );
        });

        // Selecionar nova conversa ou sessão existente
        const sessionSelection = await askSelection(
            'Selecione uma sessão ou 0 para nova conversa: ',
            0,
            sessions.length
        );

        if (sessionSelection === null) {
            return {
                success: false,
                message: 'Entrada encerrada pelo usuário.'
            };
        }

        if (sessionSelection === 0) {
            return {
                success: true,
                project,
                choice: 'new',
                session: null
            };
        }

        return {
            success: true,
            project,
            choice: 'existing',
            session: sessions[sessionSelection - 1]
        };

    } catch (error) {
        return {
            success: false,
            message: `Erro na seleção de projeto e sessão: ${error.message}`
        };

    } finally {
        if (rl) {
            rl.close();
        }
    }
}

module.exports = {
    selectProjectAndSession
};
