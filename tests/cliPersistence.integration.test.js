'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const Database = require('better-sqlite3');

test('Deve persistir a rejeição de uma proposta em SQLite real', () => {
    const tempRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'mini-agent-integration-')
    );

    const homeDir = path.join(tempRoot, 'home');
    const projectRoot = path.join(tempRoot, 'projeto');
    const databasePath = path.join(
        homeDir,
        '.mini-agent',
        'agent.db'
    );

    fs.mkdirSync(homeDir, { recursive: true });
    fs.mkdirSync(projectRoot, { recursive: true });

    const childScript = `
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Readable, Writable } = require('node:stream');

const {
    createProject,
    createSession,
    listMessages,
    closeDatabase
} = require('./src/database');

const { startCLI } = require('./src/cli');

const projectRoot = process.env.MINI_AGENT_TEST_PROJECT_ROOT;

void (async () => {
    const projectResult = createProject(
        'Projeto de integração',
        projectRoot
    );

    assert.equal(
        projectResult.success,
        true,
        projectResult.message
    );

    const sessionResult = createSession(
        projectResult.project.id,
        'modelo-teste'
    );

    assert.equal(
        sessionResult.success,
        true,
        sessionResult.message
    );

    let agentCalls = 0;
    let outputText = '';

    const input = Readable.from([
        Buffer.from('Criar um arquivo\\n/rejeitar\\n/sair\\n')
    ]);

    const output = new Writable({
        write(chunk, encoding, callback) {
            outputText += chunk.toString();
            callback();
        }
    });

    const result = await startCLI({
        model: 'modelo-teste',
        sessionId: sessionResult.session.id,

        input,
        output,

        runAgent: async () => {
            agentCalls++;

            return {
                success: true,
                type: 'proposal',
                response: {
                    message: 'Solicito autorização para criar um arquivo.'
                },
                proposal: {
                    success: true,
                    type: 'proposal',
                    name: 'create_file',
                    classification: 'approval_required',
                    arguments: {
                        path: 'arquivo-nao-criado.txt',
                        content: 'Conteúdo de teste'
                    },
                    message: 'Posso criar este arquivo?'
                }
            };
        }
    });

    assert.equal(result.success, true, result.message);
    assert.equal(agentCalls, 1);

    const historyResult = listMessages(sessionResult.session.id);

    assert.equal(historyResult.success, true);
    assert.equal(historyResult.messages.length, 1);

    assert.equal(historyResult.messages[0].role, 'assistant');

    assert.match(
        historyResult.messages[0].content,
        /usuário rejeitou a proposta/
    );

    assert.match(outputText, /Proposta rejeitada/);

    assert.equal(
        fs.existsSync(
            path.join(projectRoot, 'arquivo-nao-criado.txt')
        ),
        false
    );
})()
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(closeDatabase);
`;

    try {
        const execution = spawnSync(
            process.execPath,
            ['-e', childScript],
            {
                cwd: path.resolve(__dirname, '..'),
                env: {
                    ...process.env,
                    HOME: homeDir,
                    MINI_AGENT_TEST_PROJECT_ROOT: projectRoot
                },
                encoding: 'utf8',
                timeout: 15000
            }
        );

        assert.ifError(execution.error);

        assert.equal(
            execution.status,
            0,
            execution.stderr || execution.stdout || 'Falha no processo de integração.'
        );

        // Reabrir o banco após o encerramento do processo filho.
        const db = new Database(databasePath, {
            readonly: true
        });

        try {
            const messages = db.prepare(`
                SELECT role, content
                FROM messages
                ORDER BY id
            `).all();

            assert.equal(messages.length, 1);
            assert.equal(messages[0].role, 'assistant');

            assert.match(
                messages[0].content,
                /usuário rejeitou a proposta/
            );
        } finally {
            db.close();
        }

        assert.equal(
            fs.existsSync(
                path.join(projectRoot, 'arquivo-nao-criado.txt')
            ),
            false
        );

    } finally {
        fs.rmSync(tempRoot, {
            recursive: true,
            force: true
        });
    }
});

test('Deve criar arquivo e persistir a aprovação em SQLite real', () => {
    const tempRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'mini-agent-integration-')
    );

    const homeDir = path.join(tempRoot, 'home');
    const projectRoot = path.join(tempRoot, 'projeto');
    const databasePath = path.join(
        homeDir,
        '.mini-agent',
        'agent.db'
    );

    fs.mkdirSync(homeDir, { recursive: true });
    fs.mkdirSync(projectRoot, { recursive: true });

    const childScript = `
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Readable, Writable } = require('node:stream');

const {
    createProject,
    createSession,
    listMessages,
    closeDatabase
} = require('./src/database');

const { startCLI } = require('./src/cli');

const projectRoot = process.env.MINI_AGENT_TEST_PROJECT_ROOT;
const filePath = path.join(projectRoot, 'arquivo-criado.txt');

void (async () => {
    const projectResult = createProject(
        'Projeto de integração',
        projectRoot
    );

    assert.equal(
        projectResult.success,
        true,
        projectResult.message
    );

    const sessionResult = createSession(
        projectResult.project.id,
        'modelo-teste'
    );

    assert.equal(
        sessionResult.success,
        true,
        sessionResult.message
    );

    let agentCalls = 0;
    let outputText = '';

    const input = Readable.from([
        Buffer.from('Criar um arquivo\\n/aprovar\\n/sair\\n')
    ]);

    const output = new Writable({
        write(chunk, encoding, callback) {
            outputText += chunk.toString();
            callback();
        }
    });

    const result = await startCLI({
        model: 'modelo-teste',
        sessionId: sessionResult.session.id,
        input,
        output,

        runAgent: async () => {
            agentCalls++;

            return {
                success: true,
                type: 'proposal',
                response: {
                    message: 'Solicito autorização para criar um arquivo.'
                },
                proposal: {
                    success: true,
                    type: 'proposal',
                    name: 'create_file',
                    classification: 'approval_required',
                    arguments: {
                        path: 'arquivo-criado.txt',
                        content: 'Conteúdo aprovado pelo usuário.'
                    },
                    message: 'Posso criar este arquivo?'
                }
            };
        }
    });

    assert.equal(result.success, true, result.message);
    assert.equal(agentCalls, 1);

    // Confirmar a criação real do arquivo.
    assert.equal(fs.existsSync(filePath), true);

    assert.equal(
        fs.readFileSync(filePath, 'utf8'),
        'Conteúdo aprovado pelo usuário.'
    );

    // Confirmar a apresentação do resultado na CLI.
    assert.match(outputText, /Arquivo criado com sucesso/);

    // Confirmar a persistência do resultado no SQLite.
    const historyResult = listMessages(sessionResult.session.id);

    assert.equal(historyResult.success, true);
    assert.equal(historyResult.messages.length, 1);
    assert.equal(historyResult.messages[0].role, 'assistant');

    assert.match(
        historyResult.messages[0].content,
        /usuário aprovou a proposta/
    );

    assert.match(
        historyResult.messages[0].content,
        /Resultado: created/
    );

    assert.match(
        historyResult.messages[0].content,
        /Arquivo criado com sucesso/
    );
})()
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(closeDatabase);
`;

    try {
        const execution = spawnSync(
            process.execPath,
            ['-e', childScript],
            {
                cwd: path.resolve(__dirname, '..'),
                env: {
                    ...process.env,
                    HOME: homeDir,
                    MINI_AGENT_TEST_PROJECT_ROOT: projectRoot
                },
                encoding: 'utf8',
                timeout: 15000
            }
        );

        assert.ifError(execution.error);

        assert.equal(
            execution.status,
            0,
            execution.stderr || execution.stdout ||
                'Falha no processo de integração.'
        );

        // Confirmar que o arquivo continua existindo após o processo filho.
        const createdFile = path.join(
            projectRoot,
            'arquivo-criado.txt'
        );

        assert.equal(fs.existsSync(createdFile), true);

        assert.equal(
            fs.readFileSync(createdFile, 'utf8'),
            'Conteúdo aprovado pelo usuário.'
        );

        // Reabrir o banco após o encerramento do processo filho.
        const db = new Database(databasePath, {
            readonly: true
        });

        try {
            const messages = db.prepare(`
                SELECT role, content
                FROM messages
                ORDER BY id
            `).all();

            assert.equal(messages.length, 1);
            assert.equal(messages[0].role, 'assistant');

            assert.match(
                messages[0].content,
                /usuário aprovou a proposta/
            );

            assert.match(
                messages[0].content,
                /Resultado: created/
            );

            assert.match(
                messages[0].content,
                /Arquivo criado com sucesso/
            );
        } finally {
            db.close();
        }

    } finally {
        fs.rmSync(tempRoot, {
            recursive: true,
            force: true
        });
    }
});

test('Não deve executar proposta pendente ao encerrar a CLI', () => {
    const tempRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'mini-agent-pending-')
    );

    const homeDir = path.join(tempRoot, 'home');
    const projectRoot = path.join(tempRoot, 'projeto');
    const filePath = path.join(projectRoot, 'arquivo-pendente.txt');
    const databasePath = path.join(
        homeDir,
        '.mini-agent',
        'agent.db'
    );

    fs.mkdirSync(homeDir, { recursive: true });
    fs.mkdirSync(projectRoot, { recursive: true });

    const childScript = `
'use strict';

const assert = require('node:assert/strict');
const { Readable, Writable } = require('node:stream');

const {
    createProject,
    createSession,
    listMessages,
    closeDatabase
} = require('./src/database');

const { createAgent } = require('./src/agent');
const { startCLI } = require('./src/cli');

const projectRoot = process.env.MINI_AGENT_TEST_PROJECT_ROOT;

void (async () => {
    const projectResult = createProject(
        'Projeto de proposta pendente',
        projectRoot
    );

    assert.equal(projectResult.success, true, projectResult.message);

    const sessionResult = createSession(
        projectResult.project.id,
        'modelo-teste'
    );

    assert.equal(sessionResult.success, true, sessionResult.message);

    let chatCalls = 0;
    let outputText = '';

    const runAgent = createAgent({
        chat: async () => {
            chatCalls++;

            return {
                success: true,
                model: 'modelo-teste',
                message: {
                    role: 'assistant',
                    content: {
                        type: 'proposal',
                        name: 'create_file',
                        arguments: {
                            path: 'arquivo-pendente.txt',
                            content: 'Conteúdo sem aprovação.'
                        },
                        message: 'Posso criar este arquivo?'
                    }
                }
            };
        }
    });

    const input = Readable.from([
        Buffer.from('Criar arquivo\\n/sair\\n')
    ]);

    const output = new Writable({
        write(chunk, encoding, callback) {
            outputText += chunk.toString();
            callback();
        }
    });

    const result = await startCLI({
        model: 'modelo-teste',
        sessionId: sessionResult.session.id,
        runAgent,
        input,
        output
    });

    assert.equal(result.success, true, result.message);
    assert.equal(chatCalls, 1);

    // A CLI deve apresentar a proposta e solicitar decisão.
    assert.match(outputText, /Aguardando sua decisão/);

    // A interface deve encerrar normalmente.
    assert.match(outputText, /Interface encerrada/);

    // Não deve apresentar confirmação de criação.
    assert.doesNotMatch(outputText, /Arquivo criado com sucesso/);

    // A proposta permanece registrada, sem resultado de aprovação.
    const historyResult = listMessages(sessionResult.session.id);

    assert.equal(historyResult.success, true);
    assert.equal(historyResult.messages.length, 2);

    assert.deepEqual(
        historyResult.messages.map(message => message.role),
        ['user', 'assistant']
    );

    const proposal = JSON.parse(
        historyResult.messages[1].content
    );

    assert.equal(proposal.type, 'proposal');
    assert.equal(proposal.name, 'create_file');

})()
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(closeDatabase);
`;

    try {
        const execution = spawnSync(
            process.execPath,
            ['-e', childScript],
            {
                cwd: path.resolve(__dirname, '..'),
                env: {
                    ...process.env,
                    HOME: homeDir,
                    MINI_AGENT_TEST_PROJECT_ROOT: projectRoot
                },
                encoding: 'utf8',
                timeout: 15000
            }
        );

        assert.ifError(execution.error);

        assert.equal(
            execution.status,
            0,
            execution.stderr || execution.stdout ||
                'Falha no teste de proposta pendente.'
        );

        // Confirmar que nenhum arquivo foi criado.
        assert.equal(fs.existsSync(filePath), false);

        // Reabrir o banco após o encerramento do processo filho.
        const db = new Database(databasePath, {
            readonly: true
        });

        try {
            const messages = db.prepare(`
                SELECT role, content
                FROM messages
                ORDER BY id
            `).all();

            assert.equal(messages.length, 2);

            assert.deepEqual(
                messages.map(message => message.role),
                ['user', 'assistant']
            );

            const proposal = JSON.parse(messages[1].content);

            assert.equal(proposal.type, 'proposal');
            assert.equal(proposal.name, 'create_file');

        } finally {
            db.close();
        }

    } finally {
        fs.rmSync(tempRoot, {
            recursive: true,
            force: true
        });
    }
});
