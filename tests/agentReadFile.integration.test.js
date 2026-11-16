'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const Database = require('better-sqlite3');

test('Deve ler arquivo, incorporar resultado ao contexto e produzir resposta final', () => {
    const tempRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'mini-agent-read-integration-')
    );

    const homeDir = path.join(tempRoot, 'home');
    const projectRoot = path.join(tempRoot, 'projeto');
    const databasePath = path.join(
        homeDir,
        '.mini-agent',
        'agent.db'
    );

    const fileContent = 'O Mini Agent utiliza Node.js e SQLite.';

    fs.mkdirSync(homeDir, { recursive: true });
    fs.mkdirSync(projectRoot, { recursive: true });

    fs.writeFileSync(
        path.join(projectRoot, 'documento.txt'),
        fileContent,
        'utf8'
    );

    const childScript = `
'use strict';

const assert = require('node:assert/strict');

const {
    createProject,
    createSession,
    listMessages,
    closeDatabase
} = require('./src/database');

const { createAgent } = require('./src/agent');

const projectRoot = process.env.MINI_AGENT_TEST_PROJECT_ROOT;
const expectedContent = 'O Mini Agent utiliza Node.js e SQLite.';

void (async () => {
    const projectResult = createProject(
        'Projeto de leitura integrada',
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

    let chatCalls = 0;
    let resultReturnedToContext = false;

    const runAgent = createAgent({
        chat: async (model, messages, options) => {
            chatCalls++;

            assert.equal(model, 'modelo-teste');
            assert.equal(options.format, 'json');

            if (chatCalls === 1) {
                return {
                    success: true,
                    model: 'modelo-teste',
                    message: {
                        role: 'assistant',
                        content: {
                            type: 'tool_call',
                            name: 'read_file',
                            arguments: {
                                path: 'documento.txt'
                            }
                        }
                    }
                };
            }

            if (chatCalls === 2) {
                const toolMessages = messages.filter(
                    message => message.role === 'tool'
                );

                assert.equal(toolMessages.length, 1);

                const toolResult = JSON.parse(
                    toolMessages[0].content
                );

                assert.equal(toolResult.success, true);
                assert.equal(toolResult.content, expectedContent);
                assert.ok(toolResult.path.endsWith('documento.txt'));

                resultReturnedToContext = true;

                return {
                    success: true,
                    model: 'modelo-teste',
                    message: {
                        role: 'assistant',
                        content: {
                            type: 'final',
                            message: 'O documento informa que o Mini Agent utiliza Node.js e SQLite.'
                        }
                    }
                };
            }

            throw new Error('Quantidade inesperada de consultas ao modelo.');
        }
    });

    const result = await runAgent({
        model: 'modelo-teste',
        sessionId: sessionResult.session.id,
        userMessage: 'Leia o arquivo documento.txt e informe seu conteúdo.'
    });

    assert.equal(result.success, true, result.message);
    assert.equal(result.type, 'final');

    assert.equal(
        result.response.message,
        'O documento informa que o Mini Agent utiliza Node.js e SQLite.'
    );

    assert.equal(chatCalls, 2);
    assert.equal(resultReturnedToContext, true);

    // Verificar as mensagens persistidas durante o ciclo.
    const historyResult = listMessages(sessionResult.session.id);

    assert.equal(historyResult.success, true);
    assert.equal(historyResult.messages.length, 4);

    assert.deepEqual(
        historyResult.messages.map(message => message.role),
        ['user', 'assistant', 'tool', 'assistant']
    );

    assert.match(
        historyResult.messages[2].content,
        /O Mini Agent utiliza Node.js e SQLite/
    );

    assert.match(
        historyResult.messages[3].content,
        /"type":"final"/
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

            assert.equal(messages.length, 4);

            assert.deepEqual(
                messages.map(message => message.role),
                ['user', 'assistant', 'tool', 'assistant']
            );

            assert.match(
                messages[2].content,
                /O Mini Agent utiliza Node.js e SQLite/
            );

            assert.match(
                messages[3].content,
                /"type":"final"/
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

test('Deve bloquear a leitura de arquivo externo ao projeto', () => {
    const tempRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'mini-agent-security-')
    );

    const homeDir = path.join(tempRoot, 'home');
    const projectRoot = path.join(tempRoot, 'projeto');
    const externalPath = path.join(tempRoot, 'externo.txt');
    const databasePath = path.join(
        homeDir,
        '.mini-agent',
        'agent.db'
    );

    const secret = 'CONTEUDO_CONFIDENCIAL_FORA_DO_PROJETO';

    fs.mkdirSync(homeDir, { recursive: true });
    fs.mkdirSync(projectRoot, { recursive: true });
    fs.writeFileSync(externalPath, secret, 'utf8');

    const childScript = `
'use strict';

const assert = require('node:assert/strict');

const {
    createProject,
    createSession,
    listMessages,
    closeDatabase
} = require('./src/database');

const { createAgent } = require('./src/agent');

const projectRoot = process.env.MINI_AGENT_TEST_PROJECT_ROOT;

void (async () => {
    const projectResult = createProject(
        'Projeto de segurança',
        projectRoot
    );

    assert.equal(projectResult.success, true, projectResult.message);

    const sessionResult = createSession(
        projectResult.project.id,
        'modelo-teste'
    );

    assert.equal(sessionResult.success, true, sessionResult.message);

    const runAgent = createAgent({
        chat: async () => ({
            success: true,
            model: 'modelo-teste',
            message: {
                role: 'assistant',
                content: {
                    type: 'tool_call',
                    name: 'read_file',
                    arguments: {
                        path: '../externo.txt'
                    }
                }
            }
        })
    });

    const result = await runAgent({
        model: 'modelo-teste',
        sessionId: sessionResult.session.id,
        userMessage: 'Leia o arquivo externo.'
    });

    // A execução deve ser interrompida na etapa de ferramentas.
    assert.equal(result.success, false);
    assert.equal(result.stage, 'tools');
    assert.match(result.message, /Acesso negado/);

    // O resultado da tentativa bloqueada deve ser persistido.
    const historyResult = listMessages(sessionResult.session.id);

    assert.equal(historyResult.success, true);
    assert.equal(historyResult.messages.length, 3);

    assert.deepEqual(
        historyResult.messages.map(message => message.role),
        ['user', 'assistant', 'tool']
    );

    const toolResult = JSON.parse(
        historyResult.messages[2].content
    );

    assert.equal(toolResult.success, false);
    assert.match(toolResult.message, /Acesso negado/);
    assert.equal('content' in toolResult, false);

    assert.doesNotMatch(
        historyResult.messages[2].content,
        /CONTEUDO_CONFIDENCIAL_FORA_DO_PROJETO/
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
                'Falha no teste de segurança.'
        );

        // Confirmar que o arquivo externo permanece intacto.
        assert.equal(fs.readFileSync(externalPath, 'utf8'), secret);

        // Confirmar o registro da tentativa bloqueada após reabrir o banco.
        const db = new Database(databasePath, {
            readonly: true
        });

        try {
            const messages = db.prepare(`
                SELECT role, content
                FROM messages
                ORDER BY id
            `).all();

            assert.equal(messages.length, 3);
            assert.equal(messages[2].role, 'tool');

            assert.match(messages[2].content, /Acesso negado/);

            assert.doesNotMatch(
                messages[2].content,
                /CONTEUDO_CONFIDENCIAL_FORA_DO_PROJETO/
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

test('Deve bloquear aprovação de proposta com caminho externo ao projeto', () => {
    const tempRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'mini-agent-security-')
    );

    const homeDir = path.join(tempRoot, 'home');
    const projectRoot = path.join(tempRoot, 'projeto');
    const externalPath = path.join(tempRoot, 'arquivo-fora.txt');
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

const { startCLI } = require('./src/cli');

const projectRoot = process.env.MINI_AGENT_TEST_PROJECT_ROOT;

void (async () => {
    const projectResult = createProject(
        'Projeto de segurança',
        projectRoot
    );

    assert.equal(projectResult.success, true, projectResult.message);

    const sessionResult = createSession(
        projectResult.project.id,
        'modelo-teste'
    );

    assert.equal(sessionResult.success, true, sessionResult.message);

    let outputText = '';

    const input = Readable.from([
        Buffer.from('Criar arquivo\\n/aprovar\\n/sair\\n')
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

        runAgent: async () => ({
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
                    path: '../arquivo-fora.txt',
                    content: 'Conteúdo que não deve ser gravado.'
                },
                message: 'Posso criar este arquivo?'
            }
        })
    });

    assert.equal(result.success, true, result.message);

    // A CLI deve informar o bloqueio da operação.
    assert.match(outputText, /Acesso negado/);

    // A tentativa deve ser registrada no histórico.
    const historyResult = listMessages(sessionResult.session.id);

    assert.equal(historyResult.success, true);
    assert.equal(historyResult.messages.length, 1);

    assert.match(
        historyResult.messages[0].content,
        /não foi concluída/
    );

    assert.match(
        historyResult.messages[0].content,
        /Acesso negado/
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
                'Falha no teste de segurança.'
        );

        // Confirmar que o arquivo externo não foi criado.
        assert.equal(fs.existsSync(externalPath), false);

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
                /não foi concluída/
            );

            assert.match(
                messages[0].content,
                /Acesso negado/
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
