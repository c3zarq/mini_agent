'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { interpretOperation } = require('../src/operations');

test('Deve interpretar solicitação de leitura automática', () => {
    const response = {
        type: 'tool_call',
        name: 'read_file',
        arguments: {
            path: 'src/server.js'
        }
    };

    const result = interpretOperation(response);

    assert.equal(result.success, true);
    assert.equal(result.type, 'tool_call');
    assert.equal(result.name, 'read_file');
    assert.equal(result.classification, 'automatic');
    assert.deepEqual(result.arguments, response.arguments);
});

test('Deve interpretar solicitação de listagem de arquivos', () => {
    const result = interpretOperation({
        type: 'tool_call',
        name: 'list_files',
        arguments: {
            path: 'src'
        }
    });

    assert.equal(result.success, true);
    assert.equal(result.classification, 'automatic');
});

test('Deve interpretar solicitação de pesquisa de arquivos', () => {
    const result = interpretOperation({
        type: 'tool_call',
        name: 'search_files',
        arguments: {
            term: 'function'
        }
    });

    assert.equal(result.success, true);
    assert.equal(result.classification, 'automatic');
});

test('Deve interpretar proposta de criação de arquivo', () => {
    const response = {
        type: 'proposal',
        name: 'create_file',
        arguments: {
            path: 'src/example.js',
            content: 'console.log("Hello");'
        },
        message: 'Criar novo arquivo.'
    };

    const result = interpretOperation(response);

    assert.equal(result.success, true);
    assert.equal(result.type, 'proposal');
    assert.equal(result.name, 'create_file');
    assert.equal(result.classification, 'approval_required');
    assert.deepEqual(result.arguments, response.arguments);
    assert.equal(result.message, response.message);
});

test('Deve interpretar proposta de substituição de texto', () => {
    const result = interpretOperation({
        type: 'proposal',
        name: 'replace_text',
        arguments: {
            path: 'src/server.js',
            old_text: 'const port = 3000;',
            new_text: 'const port = 4000;'
        },
        message: 'Alterar a porta.'
    });

    assert.equal(result.success, true);
    assert.equal(result.classification, 'approval_required');
});

test('Deve identificar resposta final', () => {
    const result = interpretOperation({
        type: 'final',
        message: 'Análise concluída.'
    });

    assert.equal(result.success, true);
    assert.equal(result.type, 'final');
    assert.equal(result.message, 'Análise concluída.');
    assert.equal(result.name, undefined);
});

test('Deve rejeitar operação desconhecida', () => {
    const result = interpretOperation({
        type: 'tool_call',
        name: 'delete_file',
        arguments: {
            path: 'src/server.js'
        }
    });

    assert.equal(result.success, false);
    assert.match(result.message, /Operação desconhecida/);
});

test('Deve rejeitar operação que exige aprovação como tool_call', () => {
    const result = interpretOperation({
        type: 'tool_call',
        name: 'replace_text',
        arguments: {
            path: 'src/server.js'
        }
    });

    assert.equal(result.success, false);
    assert.match(result.message, /exige aprovação/);
});

test('Deve rejeitar operação automática como proposal', () => {
    const result = interpretOperation({
        type: 'proposal',
        name: 'read_file',
        arguments: {
            path: 'src/server.js'
        },
        message: 'Ler arquivo.'
    });

    assert.equal(result.success, false);
    assert.match(result.message, /operação automática/);
});

test('Deve rejeitar resposta estruturalmente inválida', () => {
    const result = interpretOperation({
        type: 'tool_call',
        name: 'read_file',
        arguments: []
    });

    assert.equal(result.success, false);
    assert.ok(result.errors.length > 0);
});
