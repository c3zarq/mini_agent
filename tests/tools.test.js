'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const files = require('../src/files');
const { createToolExecutor } = require('../src/tools');

// Criar uma operação interpretada para os testes
function createOperation(name, args = {}) {
    return {
        success: true,
        type: 'tool_call',
        name,
        classification: 'automatic',
        arguments: args
    };
}

// Criar executor com dependências simuladas
function createTestExecutor(overrides = {}) {
    return createToolExecutor({
        getProject: () => ({
            success: true,
            project: {
                root_path: '/projeto-teste'
            }
        }),
        listFiles: () => ({ success: true, files: [] }),
        searchFiles: () => ({ success: true, results: [] }),
        readFile: () => ({ success: true, content: 'conteúdo' }),
        ...overrides
    });
}

test('Deve executar list_files com o diretório autorizado', () => {
    let received;

    const executeTool = createTestExecutor({
        listFiles: (...args) => {
            received = args;
            return { success: true, files: [] };
        }
    });

    const result = executeTool(
        createOperation('list_files', { path: 'src' }),
        1
    );

    assert.equal(result.success, true);
    assert.deepEqual(received, ['/projeto-teste', 'src']);
});

test('Deve executar list_files com caminho padrão', () => {
    let received;

    const executeTool = createTestExecutor({
        listFiles: (...args) => {
            received = args;
            return { success: true, files: [] };
        }
    });

    executeTool(createOperation('list_files'), 1);

    assert.deepEqual(received, ['/projeto-teste', '.']);
});

test('Deve executar search_files com termo e caminho', () => {
    let received;

    const executeTool = createTestExecutor({
        searchFiles: (...args) => {
            received = args;
            return { success: true, results: [] };
        }
    });

    const result = executeTool(
        createOperation('search_files', {
            term: 'function',
            path: 'src'
        }),
        1
    );

    assert.equal(result.success, true);
    assert.deepEqual(received, [
        '/projeto-teste',
        'function',
        'src'
    ]);
});

test('Deve executar read_file com o caminho solicitado', () => {
    let received;

    const executeTool = createTestExecutor({
        readFile: (...args) => {
            received = args;
            return { success: true, content: 'conteúdo' };
        }
    });

    const result = executeTool(
        createOperation('read_file', {
            path: 'src/server.js'
        }),
        1
    );

    assert.equal(result.success, true);
    assert.deepEqual(received, [
        '/projeto-teste',
        'src/server.js'
    ]);
});

test('Deve rejeitar operação inválida', () => {
    const executeTool = createTestExecutor();

    const result = executeTool(null, 1);

    assert.equal(result.success, false);
});

test('Deve rejeitar operação que não seja tool_call', () => {
    const executeTool = createTestExecutor();

    const result = executeTool({
        ...createOperation('read_file', { path: 'src/server.js' }),
        type: 'proposal'
    }, 1);

    assert.equal(result.success, false);
    assert.match(result.message, /tool_call/);
});

test('Deve rejeitar operação que não seja automática', () => {
    const executeTool = createTestExecutor();

    const result = executeTool({
        ...createOperation('create_file'),
        classification: 'approval_required'
    }, 1);

    assert.equal(result.success, false);
    assert.match(result.message, /automática/);
});

test('Deve rejeitar ferramenta desconhecida', () => {
    const executeTool = createTestExecutor();

    const result = executeTool(
        createOperation('delete_file'),
        1
    );

    assert.equal(result.success, false);
    assert.match(result.message, /não reconhecida/);
});

test('Deve rejeitar identificador de projeto inválido', () => {
    let consulted = false;

    const executeTool = createTestExecutor({
        getProject: () => {
            consulted = true;
            return {
                success: true,
                project: { root_path: '/projeto-teste' }
            };
        }
    });

    const result = executeTool(
        createOperation('read_file', { path: 'src/server.js' }),
        0
    );

    assert.equal(result.success, false);
    assert.equal(consulted, false);
});

test('Deve rejeitar projeto inexistente', () => {
    const executeTool = createTestExecutor({
        getProject: () => ({
            success: true,
            project: null
        })
    });

    const result = executeTool(
        createOperation('read_file', { path: 'src/server.js' }),
        1
    );

    assert.equal(result.success, false);
    assert.match(result.message, /Projeto não encontrado/);
});

test('Deve rejeitar argumentos inválidos', () => {
    const executeTool = createTestExecutor();

    const result = executeTool({
        ...createOperation('read_file'),
        arguments: []
    }, 1);

    assert.equal(result.success, false);
    assert.match(result.message, /Argumentos/);
});

test('Deve impedir leitura fora do diretório autorizado', () => {
    const temporaryRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'mini-agent-')
    );

    try {
        const projectRoot = path.join(temporaryRoot, 'projeto');
        const outsideFile = path.join(temporaryRoot, 'outside.txt');

        fs.mkdirSync(projectRoot);
        fs.writeFileSync(outsideFile, 'conteúdo externo');

        const executeTool = createTestExecutor({
            getProject: () => ({
                success: true,
                project: {
                    root_path: projectRoot
                }
            }),
            readFile: files.readFile
        });

        const result = executeTool(
            createOperation('read_file', {
                path: '../outside.txt'
            }),
            1
        );

        assert.equal(result.success, false);
        assert.match(result.message, /Acesso negado/);

    } finally {
        fs.rmSync(temporaryRoot, {
            recursive: true,
            force: true
        });
    }
});
