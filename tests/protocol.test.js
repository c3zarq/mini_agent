'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { validateResponse } = require('../src/protocol');

test('Deve validar uma solicitação de ferramenta', () => {
    const response = {
        type: 'tool_call',
        name: 'read_file',
        arguments: {
            path: 'src/server.js'
        }
    };

    assert.deepEqual(validateResponse(response), {
        success: true,
        type: 'tool_call'
    });
});

test('Deve validar uma proposta de alteração', () => {
    const response = {
        type: 'proposal',
        name: 'replace_text',
        arguments: {
            path: 'src/server.js',
            old_text: 'const port = 3000;',
            new_text: 'const port = 4000;'
        },
        message: 'Alterar a porta da aplicação.'
    };

    assert.deepEqual(validateResponse(response), {
        success: true,
        type: 'proposal'
    });
});

test('Deve validar uma resposta final', () => {
    const response = {
        type: 'final',
        message: 'A análise foi concluída.'
    };

    assert.deepEqual(validateResponse(response), {
        success: true,
        type: 'final'
    });
});

test('Deve rejeitar valores que não sejam objetos', () => {
    const invalidValues = [
        null,
        [],
        'texto',
        123,
        true
    ];

    for (const value of invalidValues) {
        assert.equal(validateResponse(value).success, false);
    }
});

test('Deve rejeitar tipos de resposta desconhecidos', () => {
    const result = validateResponse({
        type: 'unknown'
    });

    assert.equal(result.success, false);
    assert.ok(result.errors.length > 0);
});

test('Deve rejeitar tool_call sem name válido', () => {
    const invalidNames = [
        undefined,
        '',
        '   ',
        123
    ];

    for (const name of invalidNames) {
        const result = validateResponse({
            type: 'tool_call',
            name,
            arguments: {}
        });

        assert.equal(result.success, false);
    }
});

test('Deve rejeitar tool_call sem arguments válido', () => {
    const invalidArguments = [
        undefined,
        null,
        [],
        'texto',
        123
    ];

    for (const args of invalidArguments) {
        const result = validateResponse({
            type: 'tool_call',
            name: 'read_file',
            arguments: args
        });

        assert.equal(result.success, false);
    }
});

test('Deve rejeitar proposal sem message válido', () => {
    const invalidMessages = [
        undefined,
        '',
        '   ',
        123
    ];

    for (const message of invalidMessages) {
        const result = validateResponse({
            type: 'proposal',
            name: 'replace_text',
            arguments: {},
            message
        });

        assert.equal(result.success, false);
    }
});

test('Deve rejeitar final sem message válido', () => {
    const invalidMessages = [
        undefined,
        '',
        '   ',
        123
    ];

    for (const message of invalidMessages) {
        const result = validateResponse({
            type: 'final',
            message
        });

        assert.equal(result.success, false);
    }
});

test('Deve identificar múltiplos erros na mesma resposta', () => {
    const result = validateResponse({
        type: 'proposal',
        name: '',
        arguments: [],
        message: ''
    });

    assert.equal(result.success, false);
    assert.equal(result.errors.length, 3);
});
