'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { main } = require('../src/app');

// Executar teste sem produzir mensagens no terminal
async function silenceConsole(callback) {
    const originalLog = console.log;
    const originalError = console.error;

    console.log = () => {};
    console.error = () => {};

    try {
        return await callback();
    } finally {
        console.log = originalLog;
        console.error = originalError;
    }
}

const project = {
    id: 1,
    name: 'Projeto Alpha',
    root_path: '/tmp/projeto-alpha'
};

test('Deve criar uma sessão e inicializar a CLI', async () => {
    let receivedOptions;
    let receivedSelectionOptions;
    let receivedModelOptions;
    let receivedCreation;
    let databaseClosed = false;

    const result = await silenceConsole(() => main({
        selectProjectAndSession: async options => {
            receivedSelectionOptions = options;

            return {
                success: true,
                project,
                choice: 'new',
                session: null
            };
        },

        selectModel: async options => {
            receivedModelOptions = options;

            return {
                success: true,
                model: 'qwen3:4b'
            };
        },

        listProjects: () => ({ success: true, projects: [project] }),
        listSessions: () => ({ success: true, sessions: [] }),
        listModels: async () => ({
            success: true,
            models: [{ name: 'qwen3:4b' }]
        }),

        createSession: (projectId, model) => {
            receivedCreation = { projectId, model };

            return {
                success: true,
                session: {
                    id: 10,
                    project_id: projectId,
                    model
                }
            };
        },

        launchCLI: async options => {
            receivedOptions = options;
            return { success: true };
        },

        closeDB: () => {
            databaseClosed = true;
        }
    }));

    assert.equal(result.success, true);
    assert.equal(typeof receivedSelectionOptions.listProjects, 'function');
    assert.equal(typeof receivedSelectionOptions.listSessions, 'function');
    assert.equal(typeof receivedModelOptions.listModels, 'function');
    assert.deepEqual(receivedCreation, {
        projectId: 1,
        model: 'qwen3:4b'
    });
    assert.equal(receivedOptions.model, 'qwen3:4b');
    assert.equal(receivedOptions.sessionId, 10);
    assert.equal(typeof receivedOptions.runAgent, 'function');
    assert.equal(databaseClosed, true);
});

test('Deve recuperar sessão existente sem selecionar novo modelo', async () => {
    let modelSelectionStarted = false;
    let receivedOptions;
    let databaseClosed = false;

    const result = await silenceConsole(() => main({
        selectProjectAndSession: async () => ({
            success: true,
            project,
            choice: 'existing',
            session: {
                id: 20,
                project_id: 1,
                model: 'gemma3:4b'
            }
        }),

        selectModel: async () => {
            modelSelectionStarted = true;
            return { success: true, model: 'qwen3:4b' };
        },

        createSession: () => {
            throw new Error('Não deveria criar uma sessão.');
        },

        launchCLI: async options => {
            receivedOptions = options;
            return { success: true };
        },

        closeDB: () => {
            databaseClosed = true;
        }
    }));

    assert.equal(result.success, true);
    assert.equal(modelSelectionStarted, false);
    assert.equal(receivedOptions.sessionId, 20);
    assert.equal(receivedOptions.model, 'gemma3:4b');
    assert.equal(databaseClosed, true);
});

test('Não deve continuar quando a seleção de projeto ou sessão falhar', async () => {
    let cliStarted = false;
    let databaseClosed = false;

    const result = await silenceConsole(() => main({
        selectProjectAndSession: async () => ({
            success: false,
            message: 'Falha na seleção.'
        }),

        launchCLI: async () => {
            cliStarted = true;
            return { success: true };
        },

        closeDB: () => {
            databaseClosed = true;
        }
    }));

    assert.equal(result.success, false);
    assert.match(result.message, /Falha na seleção/);
    assert.equal(cliStarted, false);
    assert.equal(databaseClosed, true);
});

test('Não deve criar sessão quando a seleção de modelo falhar', async () => {
    let sessionCreated = false;
    let databaseClosed = false;

    const result = await silenceConsole(() => main({
        selectProjectAndSession: async () => ({
            success: true,
            project,
            choice: 'new',
            session: null
        }),

        selectModel: async () => ({
            success: false,
            message: 'Ollama indisponível.'
        }),

        createSession: () => {
            sessionCreated = true;
        },

        closeDB: () => {
            databaseClosed = true;
        }
    }));

    assert.equal(result.success, false);
    assert.match(result.message, /Ollama indisponível/);
    assert.equal(sessionCreated, false);
    assert.equal(databaseClosed, true);
});

test('Deve tratar falha na criação da sessão', async () => {
    let cliStarted = false;
    let databaseClosed = false;

    const result = await silenceConsole(() => main({
        selectProjectAndSession: async () => ({
            success: true,
            project,
            choice: 'new',
            session: null
        }),

        selectModel: async () => ({
            success: true,
            model: 'qwen3:4b'
        }),

        createSession: () => ({
            success: false,
            message: 'Falha ao criar sessão.'
        }),

        launchCLI: async () => {
            cliStarted = true;
            return { success: true };
        },

        closeDB: () => {
            databaseClosed = true;
        }
    }));

    assert.equal(result.success, false);
    assert.match(result.message, /Falha ao criar sessão/);
    assert.equal(cliStarted, false);
    assert.equal(databaseClosed, true);
});

test('Não deve iniciar CLI com sessão existente inválida', async () => {
    let cliStarted = false;
    let databaseClosed = false;

    const result = await silenceConsole(() => main({
        selectProjectAndSession: async () => ({
            success: true,
            project,
            choice: 'existing',
            session: {
                id: 20,
                project_id: 2,
                model: 'gemma3:4b'
            }
        }),

        launchCLI: async () => {
            cliStarted = true;
            return { success: true };
        },

        closeDB: () => {
            databaseClosed = true;
        }
    }));

    assert.equal(result.success, false);
    assert.match(result.message, /Sessão selecionada inválida/);
    assert.equal(cliStarted, false);
    assert.equal(databaseClosed, true);
});

test('Deve encerrar o banco após falha na CLI', async () => {
    let databaseClosed = false;

    const result = await silenceConsole(() => main({
        selectProjectAndSession: async () => ({
            success: true,
            project,
            choice: 'existing',
            session: {
                id: 20,
                project_id: 1,
                model: 'gemma3:4b'
            }
        }),

        launchCLI: async () => {
            throw new Error('Falha simulada na CLI.');
        },

        closeDB: () => {
            databaseClosed = true;
        }
    }));

    assert.equal(result.success, false);
    assert.match(result.message, /Falha simulada na CLI/);
    assert.equal(databaseClosed, true);
});
