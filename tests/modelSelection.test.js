'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable, Writable } = require('node:stream');

const { selectModel } = require('../src/modelSelection');

// Criar saída simulada para os testes
function createOutput() {
    let content = '';

    const output = new Writable({
        write(chunk, encoding, callback) {
            content += chunk.toString();
            callback();
        }
    });

    return {
        output,
        getContent: () => content
    };
}

test('Deve apresentar e selecionar um modelo válido', async () => {
    const { output, getContent } = createOutput();

    const result = await selectModel({
        listModels: async () => ({
            success: true,
            models: [
                { name: 'qwen3:4b' },
                { name: 'gemma3:4b' }
            ]
        }),
        input: Readable.from(['2\n']),
        output
    });

    assert.equal(result.success, true);
    assert.equal(result.model, 'gemma3:4b');
    assert.match(getContent(), /1\. qwen3:4b/);
    assert.match(getContent(), /2\. gemma3:4b/);
});

test('Deve solicitar novamente após seleção inválida', async () => {
    const { output, getContent } = createOutput();

    const result = await selectModel({
        listModels: async () => ({
            success: true,
            models: [
                { name: 'qwen3:4b' },
                { name: 'gemma3:4b' }
            ]
        }),
        input: Readable.from(['abc\n', '5\n', '1\n']),
        output
    });

    assert.equal(result.success, true);
    assert.equal(result.model, 'qwen3:4b');
    assert.equal(
        (getContent().match(/Seleção inválida/g) || []).length,
        2
    );
});

test('Deve tratar falha na consulta de modelos', async () => {
    const result = await selectModel({
        listModels: async () => ({
            success: false,
            message: 'Ollama indisponível.'
        })
    });

    assert.equal(result.success, false);
    assert.match(result.message, /Ollama indisponível/);
});

test('Deve informar quando não existem modelos disponíveis', async () => {
    const result = await selectModel({
        listModels: async () => ({
            success: true,
            models: []
        })
    });

    assert.equal(result.success, false);
    assert.match(result.message, /Nenhum modelo disponível/);
});

test('Deve rejeitar uma lista de modelos inválida', async () => {
    const result = await selectModel({
        listModels: async () => ({
            success: true,
            models: [{ name: '' }]
        })
    });

    assert.equal(result.success, false);
    assert.match(result.message, /Lista de modelos inválida/);
});

test('Deve rejeitar função de listagem inválida', async () => {
    const result = await selectModel({
        listModels: null
    });

    assert.equal(result.success, false);
    assert.match(result.message, /Função de listagem de modelos inválida/);
});

test('Deve tratar encerramento da entrada sem seleção', async () => {
    const result = await selectModel({
        listModels: async () => ({
            success: true,
            models: [{ name: 'qwen3:4b' }]
        }),
        input: Readable.from([])
    });

    assert.equal(result.success, false);
    assert.match(result.message, /encerrada sem escolha/);
});

test('Deve tratar exceção durante a consulta de modelos', async () => {
    const result = await selectModel({
        listModels: async () => {
            throw new Error('Falha simulada.');
        }
    });

    assert.equal(result.success, false);
    assert.match(result.message, /Falha simulada/);
});
