'use strict';

const { version } = require('../package.json');

const { runAgent: defaultAgent } = require('./agent');
const { startCLI } = require('./cli');

const {
    listProjects: defaultListProjects,
    listSessions: defaultListSessions,
    createSession: defaultCreateSession,
    closeDatabase
} = require('./database');

const { listModels: defaultListModels } = require('./ollama');
const { selectModel: defaultSelectModel } = require('./modelSelection');

const {
    selectProjectAndSession: defaultSelectProjectAndSession
} = require('./sessionSelection');

// Inicializar a aplicação
async function main({
    runAgent = defaultAgent,
    launchCLI = startCLI,
    selectProjectAndSession = defaultSelectProjectAndSession,
    listProjects = defaultListProjects,
    listSessions = defaultListSessions,
    selectModel = defaultSelectModel,
    listModels = defaultListModels,
    createSession = defaultCreateSession,
    closeDB = closeDatabase
} = {}) {
    console.log(`Mini Agent v${version}`);
    console.log('Inicializando aplicação...\n');

    try {
        // Selecionar projeto e sessão
        const selection = await selectProjectAndSession({
            listProjects,
            listSessions
        });

        if (!selection || selection.success !== true) {
            const message =
                selection?.message ||
                'Não foi possível selecionar um projeto e uma sessão.';

            console.error(message);

            return {
                success: false,
                message
            };
        }

        const project = selection.project;

        if (
            !project ||
            !Number.isInteger(project.id) ||
            project.id <= 0
        ) {
            const message = 'Projeto selecionado inválido.';

            console.error(message);

            return {
                success: false,
                message
            };
        }

        let sessionId;
        let model;

        // Criar uma nova conversa
        if (selection.choice === 'new') {

            // Selecionar modelo disponível
            const modelSelection = await selectModel({ listModels });

            if (
                !modelSelection ||
                modelSelection.success !== true ||
                typeof modelSelection.model !== 'string' ||
                !modelSelection.model.trim()
            ) {
                const message =
                    modelSelection?.message ||
                    'Não foi possível selecionar um modelo válido.';

                console.error(message);

                return {
                    success: false,
                    message
                };
            }

            model = modelSelection.model;

            // Criar sessão no banco de dados
            const creation = await createSession(project.id, model);

            if (
                !creation ||
                creation.success !== true ||
                !creation.session ||
                !Number.isInteger(creation.session.id) ||
                creation.session.id <= 0 ||
                creation.session.project_id !== project.id ||
                creation.session.model !== model
            ) {
                const message =
                    creation?.message ||
                    'Não foi possível criar uma sessão válida.';

                console.error(message);

                return {
                    success: false,
                    message
                };
            }

            sessionId = creation.session.id;

        // Recuperar uma conversa existente
        } else if (selection.choice === 'existing') {
            const session = selection.session;

            if (
                !session ||
                !Number.isInteger(session.id) ||
                session.id <= 0 ||
                session.project_id !== project.id ||
                typeof session.model !== 'string' ||
                !session.model.trim()
            ) {
                const message = 'Sessão selecionada inválida.';

                console.error(message);

                return {
                    success: false,
                    message
                };
            }

            sessionId = session.id;
            model = session.model;

        } else {
            const message = 'Opção de sessão inválida.';

            console.error(message);

            return {
                success: false,
                message
            };
        }

        // Iniciar interface conversacional
        return await launchCLI({
            runAgent,
            model,
            sessionId
        });

    } catch (error) {
        const message = `Falha na aplicação: ${error.message}`;

        console.error(message);

        return {
            success: false,
            message
        };

    } finally {
        // Encerrar conexão com o banco de dados
        closeDB();
    }
}

if (require.main === module) {
    main().then(result => {
        if (!result.success) {
            process.exitCode = 1;
        }
    });
}

module.exports = { main };
