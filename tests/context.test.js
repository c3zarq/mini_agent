'use strict';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Preparar ambiente temporário
const tempHome = fs.mkdtempSync(
    path.join(os.tmpdir(), 'mini-agent-context-')
);

process.env.HOME = tempHome;

// Importar módulos após configurar HOME
const {
    db,
    createProject,
    createSession,
    saveMessage,
    closeDatabase
} = require('../src/database');

const {
    buildContext,
    loadTask,
    formatFileResults,
    limitHistory,
    limitFileResults
} = require('../src/context');

let projectId;
let sessionId;
let projectRoot;

// Preparar projeto e sessão de teste
before(() => {
    projectRoot = path.join(tempHome, 'project');

    fs.mkdirSync(
        path.join(projectRoot, 'tasks'),
        { recursive: true }
    );

    const taskTemplate = fs.readFileSync(
    path.join(__dirname, '..', 'tasks', 'TEMPLATE.md'),
    'utf8'
    );

    const taskDocument = taskTemplate
        .replace(
            '# T000 — Título da tarefa',
            '# T001 — Inicializar projeto Node.js'
        )
        .replace(
            '**Etapa:** P00 — Nome da etapa',
            '**Etapa:** P01 — Estrutura inicial'
        );

    fs.writeFileSync(
        path.join(projectRoot, 'tasks', 'T001.md'),
        taskDocument
    );

    const projectResult = createProject(
        'Projeto de teste',
        projectRoot
    );

    assert.equal(projectResult.success, true);
    projectId = projectResult.project.id;

    const sessionResult = createSession(projectId, 'modelo-teste');

    assert.equal(sessionResult.success, true);
    sessionId = sessionResult.session.id;
});

// Limpar mensagens antes de cada teste
beforeEach(() => {
    db.prepare('DELETE FROM messages').run();
});

// Encerrar banco e remover ambiente temporário
after(() => {
    closeDatabase();
    fs.rmSync(tempHome, { recursive: true, force: true });
});

// Testar preparação básica do contexto
test('Deve preparar o contexto básico do projeto', () => {
    const result = buildContext({
        sessionId,
        userMessage: 'Olá, Mini Agent!'
    });

    assert.equal(result.success, true);
    assert.ok(Array.isArray(result.messages));

    assert.equal(result.messages[0].role, 'system');
    assert.match(result.messages[0].content, /Mini Agent/);

    assert.match(
        result.messages[1].content,
        /Projeto de teste/
    );

    assert.equal(
        result.messages.at(-1).content,
        'Olá, Mini Agent!'
    );
});

// Testar recuperação do histórico da conversa
test('Deve incluir o histórico da sessão em ordem cronológica', () => {
    saveMessage(sessionId, 'user', 'Primeira pergunta');
    saveMessage(sessionId, 'assistant', 'Primeira resposta');

    const result = buildContext({
        sessionId,
        userMessage: 'Segunda pergunta'
    });

    assert.equal(result.success, true);

    const messages = result.messages;

    assert.ok(
        messages.some(message =>
            message.content === 'Primeira pergunta'
        )
    );

    assert.ok(
        messages.some(message =>
            message.content === 'Primeira resposta'
        )
    );

    assert.equal(
        messages.at(-1).content,
        'Segunda pergunta'
    );
});

// Testar carregamento da tarefa atual
test('Deve incluir a tarefa atual no contexto', () => {
    db.prepare(`
        INSERT INTO tasks (
            project_id,
            code,
            phase_code,
            title,
            expected_result,
            position
        )
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        projectId,
        'T001',
        'P01',
        'Inicializar projeto Node.js',
        'Projeto inicializado',
        1
    );

    const result = buildContext({
        sessionId,
        taskCode: 'T001',
        userMessage: 'Vamos trabalhar nesta tarefa.'
    });
    
    assert.equal(result.success, true);

    const taskMessage = result.messages.find(message =>
        message.content.startsWith('Tarefa atual:')
    );

    assert.ok(taskMessage);
    assert.match(taskMessage.content, /Inicializar projeto Node.js/);
});

// Testar inclusão de resultados de consultas a arquivos
test('Deve incluir resultados de arquivos no contexto', () => {
    const result = buildContext({
        sessionId,
        userMessage: 'Analise este arquivo.',
        fileResults: [
            {
                path: 'src/app.js',
                lineNumber: 10,
                line: 'const app = require("./cli");'
            }
        ]
    });

    assert.equal(result.success, true);

    const fileMessage = result.messages.find(message =>
        message.content.startsWith(
            'Resultados de consultas a arquivos:'
        )
    );

    assert.ok(fileMessage);
    assert.match(fileMessage.content, /src\/app.js/);
    assert.match(fileMessage.content, /const app/);

    const historyIndex = result.messages.findIndex(message =>
        message.content === 'Primeira pergunta'
    );

    const fileIndex = result.messages.indexOf(fileMessage);

    if (historyIndex !== -1) {
        assert.ok(fileIndex < historyIndex);
    }
});

// Testar rejeição de sessão inválida
test('Deve rejeitar identificador de sessão inválido', () => {
    const result = buildContext({
        sessionId: 0,
        userMessage: 'Teste'
    });

    assert.equal(result.success, false);
    assert.match(result.message, /sessão inválido/i);
});

// Testar rejeição de mensagem vazia
test('Deve rejeitar mensagem vazia', () => {
    const result = buildContext({
        sessionId,
        userMessage: '   '
    });

    assert.equal(result.success, false);
    assert.match(result.message, /mensagem do usuário é obrigatória/i);
});

// Testar rejeição de tarefa inexistente
test('Deve rejeitar tarefa não cadastrada', () => {
    const result = buildContext({
        sessionId,
        taskCode: 'T999',
        userMessage: 'Teste'
    });

    assert.equal(result.success, false);
    assert.match(result.message, /Tarefa T999 não encontrada/i);
});

// Testar limitação do histórico
test('Deve preservar o histórico quando estiver abaixo do limite', () => {
    const messages = [
        { role: 'user', content: 'Mensagem 1' },
        { role: 'assistant', content: 'Mensagem 2' }
    ];

    const result = limitHistory(messages, 20);

    assert.equal(result.length, 2);
    assert.deepEqual(result, messages);
});

test('Deve manter as mensagens mais recentes dentro do limite', () => {
    const messages = Array.from({ length: 30 }, (_, index) => ({
        role: 'user',
        content: `Mensagem ${index + 1}`
    }));

    const result = limitHistory(messages, 20);

    assert.equal(result.length, 20);
    assert.equal(result[0].content, 'Mensagem 11');
    assert.equal(result.at(-1).content, 'Mensagem 30');
});

test('Deve preservar a ordem cronológica do histórico limitado', () => {
    const messages = [
        { role: 'user', content: 'Primeira' },
        { role: 'assistant', content: 'Segunda' },
        { role: 'user', content: 'Terceira' }
    ];

    const result = limitHistory(messages, 2);

    assert.equal(result[0].content, 'Segunda');
    assert.equal(result[1].content, 'Terceira');
});

test('Deve retornar histórico vazio quando o limite for zero', () => {
    const messages = [
        { role: 'user', content: 'Mensagem 1' }
    ];

    const result = limitHistory(messages, 0);

    assert.deepEqual(result, []);
});

test('Deve rejeitar entradas inválidas na limitação do histórico', () => {
    assert.deepEqual(limitHistory(null), []);
    assert.deepEqual(limitHistory([], -1), []);
    assert.deepEqual(limitHistory([], 1.5), []);
});

// Testes de limitação dos resultados de arquivos

test('Deve retornar null quando não houver resultados de arquivos', () => {
    assert.equal(limitFileResults(null), null);
    assert.equal(limitFileResults([]), null);
});

test('Deve preservar resultados menores que os limites', () => {
    const results = [
        {
            path: 'src/app.js',
            content: 'console.log("Teste");'
        }
    ];

    const result = limitFileResults(results);

    assert.ok(result.includes('src/app.js'));
    assert.ok(result.includes('console.log'));
    assert.ok(!result.includes('[resultado truncado]'));
});

test('Deve truncar resultados que ultrapassem o limite individual', () => {
    const results = [
        {
            path: 'src/app.js',
            content: 'A'.repeat(100)
        }
    ];

    const result = limitFileResults(results, 50, 1000);

    assert.ok(result.includes('[resultado truncado]'));
    assert.ok(result.length <= 50 + 'Resultado 1:\n'.length);
});

test('Deve respeitar o limite total de caracteres', () => {
    const results = [
        { path: 'arquivo1.js', content: 'A'.repeat(40) },
        { path: 'arquivo2.js', content: 'B'.repeat(40) },
        { path: 'arquivo3.js', content: 'C'.repeat(40) }
    ];

    const result = limitFileResults(results, 1000, 120);

    assert.ok(result.length <= 120);
});

test('Deve rejeitar limites inválidos', () => {
    const results = [
        { path: 'arquivo.js', content: 'Teste' }
    ];

    assert.equal(limitFileResults(results, 0, 100), null);
    assert.equal(limitFileResults(results, 100, 0), null);
    assert.equal(limitFileResults(results, 1.5, 100), null);
    assert.equal(limitFileResults(results, 100, -1), null);
});

test('Não deve modificar os resultados originais', () => {
    const results = [
        { path: 'arquivo.js', content: 'Conteúdo original' }
    ];

    const original = structuredClone(results);

    limitFileResults(results);

    assert.deepEqual(results, original);
});

