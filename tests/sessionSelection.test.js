'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable, Writable } = require('node:stream');

const {
    selectProjectAndSession
} = require('../src/sessionSelection');

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

const projects = [
    { id: 1, name: 'Projeto Alpha' },
    { id: 2, name: 'Projeto Beta' }
];

test('Deve apresentar e selecionar um projeto sem sessões', async () => {
    const { output, getContent } = createOutput();

    const result = await selectProjectAndSession({
        listProjects: async () => ({
            success: true,
            projects
        }),
        listSessions: async () => ({
            success: true,
            sessions: []
        }),
        input: Readable.from(['2\n']),
        output
    });

    assert.equal(result.success, true);
    assert.equal(result.project.id, 2);
    assert.equal(result.choice, 'new');
    assert.equal(result.session, null);
    assert.match(getContent(), /Projeto Alpha/);
    assert.match(getContent(), /Projeto Beta/);
    assert.match(getContent(), /Nenhuma sessão encontrada/);
});

test('Deve permitir iniciar uma nova conversa', async () => {
    const { output } = createOutput();

    const result = await selectProjectAndSession({
        listProjects: async () => ({
            success: true,
            projects: [projects[0]]
        }),
        listSessions: async () => ({
            success: true,
            sessions: [
                { id: 10, project_id: 1, model: 'qwen3:4b' },
                { id: 11, project_id: 1, model: 'gemma3:4b' }
            ]
        }),
        input: Readable.from(['1\n', '0\n']),
        output
    });

    assert.equal(result.success, true);
    assert.equal(result.project.id, 1);
    assert.equal(result.choice, 'new');
    assert.equal(result.session, null);
});

test('Deve selecionar uma sessão existente', async () => {
    const { output, getContent } = createOutput();

    const result = await selectProjectAndSession({
        listProjects: async () => ({
            success: true,
            projects: [projects[0]]
        }),
        listSessions: async () => ({
            success: true,
            sessions: [
                { id: 10, project_id: 1, model: 'qwen3:4b' },
                { id: 11, project_id: 1, model: 'gemma3:4b' }
            ]
        }),
        input: Readable.from(['1\n', '2\n']),
        output
    });

    assert.equal(result.success, true);
    assert.equal(result.choice, 'existing');
    assert.equal(result.session.id, 11);
    assert.equal(result.session.model, 'gemma3:4b');
    assert.match(getContent(), /Sessão 10/);
    assert.match(getContent(), /Sessão 11/);
});

test('Deve solicitar novamente após seleção inválida', async () => {
    const { output, getContent } = createOutput();

    const result = await selectProjectAndSession({
        listProjects: async () => ({
            success: true,
            projects: [projects[0]]
        }),
        listSessions: async () => ({
            success: true,
            sessions: [
                { id: 10, project_id: 1, model: 'qwen3:4b' }
            ]
        }),
        input: Readable.from(['abc\n', '5\n', '1\n', '9\n', '0\n']),
        output
    });

    assert.equal(result.success, true);
    assert.equal(result.choice, 'new');
    assert.equal(
        (getContent().match(/Seleção inválida/g) || []).length,
        3
    );
});

test('Deve tratar falha na consulta de projetos', async () => {
    const result = await selectProjectAndSession({
        listProjects: async () => ({
            success: false,
            message: 'Falha ao consultar projetos.'
        }),
        listSessions: async () => ({
            success: true,
            sessions: []
        })
    });

    assert.equal(result.success, false);
    assert.match(result.message, /Falha ao consultar projetos/);
});

test('Deve informar quando não existem projetos cadastrados', async () => {
    const result = await selectProjectAndSession({
        listProjects: async () => ({
            success: true,
            projects: []
        }),
        listSessions: async () => ({
            success: true,
            sessions: []
        })
    });

    assert.equal(result.success, false);
    assert.match(result.message, /Nenhum projeto cadastrado/);
});

test('Deve tratar falha na consulta de sessões', async () => {
    const result = await selectProjectAndSession({
        listProjects: async () => ({
            success: true,
            projects: [projects[0]]
        }),
        listSessions: async () => ({
            success: false,
            message: 'Falha ao consultar sessões.'
        }),
        input: Readable.from(['1\n'])
    });

    assert.equal(result.success, false);
    assert.match(result.message, /Falha ao consultar sessões/);
});

test('Deve tratar encerramento da entrada sem seleção', async () => {
    const result = await selectProjectAndSession({
        listProjects: async () => ({
            success: true,
            projects: [projects[0]]
        }),
        listSessions: async () => ({
            success: true,
            sessions: []
        }),
        input: Readable.from([])
    });

    assert.equal(result.success, false);
    assert.match(result.message, /Entrada encerrada/);
});

test('Deve rejeitar dependências inválidas', async () => {
    const result = await selectProjectAndSession({
        listProjects: null,
        listSessions: () => ({
            success: true,
            sessions: []
        })
    });

    assert.equal(result.success, false);
    assert.match(result.message, /Dependências.*inválidas/);
});

test('Deve tratar exceção durante a consulta de projetos', async () => {
    const result = await selectProjectAndSession({
        listProjects: async () => {
            throw new Error('Falha simulada.');
        },
        listSessions: async () => ({
            success: true,
            sessions: []
        })
    });

    assert.equal(result.success, false);
    assert.match(result.message, /Falha simulada/);
});
