'use strict';

const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let db;
let createProject;
let listTasks;
let closeDatabase;
let projectId;
let tempHome;

// Preparar ambiente isolado
before(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-agent-test-'));
    process.env.HOME = tempHome;

    ({
        db,
        createProject,
        listTasks,
        closeDatabase
    } = require('../src/database'));

    const result = createProject('Projeto de teste', '/tmp/projeto-teste');

    assert.equal(result.success, true);

    projectId = result.project.id;
});

// Limpar tarefas antes de cada teste
beforeEach(() => {
    db.prepare('DELETE FROM tasks').run();
});

// Encerrar banco e remover ambiente temporário
after(() => {
    closeDatabase();
    fs.rmSync(tempHome, { recursive: true, force: true });
});

// Inserir tarefa diretamente no banco
function insertTask({
    code,
    phaseCode,
    title,
    expectedResult = 'Resultado esperado de teste',
    position,
    status = 'pending',
    isActive = 1
}) {
    db.prepare(`
        INSERT INTO tasks (
            project_id,
            code,
            phase_code,
            title,
            expected_result,
            position,
            status,
            is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        projectId,
        code,
        phaseCode,
        title,
        expectedResult,
        position,
        status,
        isActive
    );
}

test('Deve rejeitar identificador de projeto inválido', () => {
    const result = listTasks(0);

    assert.equal(result.success, false);
    assert.match(result.message, /inválido/i);
});

test('Deve rejeitar projeto inexistente', () => {
    const result = listTasks(999999);

    assert.equal(result.success, false);
    assert.match(result.message, /não encontrado/i);
});

test('Deve listar somente tarefas ativas', () => {
    insertTask({
        code: 'T001',
        phaseCode: 'P01',
        title: 'Tarefa ativa',
        position: 1
    });

    insertTask({
        code: 'T002',
        phaseCode: 'P01',
        title: 'Tarefa inativa',
        position: 2,
        isActive: 0
    });

    const result = listTasks(projectId);

    assert.equal(result.success, true);
    assert.equal(result.tasks.length, 1);
    assert.equal(result.tasks[0].code, 'T001');
});

test('Deve ordenar tarefas por etapa e posição', () => {
    insertTask({
        code: 'T003',
        phaseCode: 'P02',
        title: 'Terceira tarefa',
        position: 1
    });

    insertTask({
        code: 'T002',
        phaseCode: 'P01',
        title: 'Segunda tarefa',
        position: 2
    });

    insertTask({
        code: 'T001',
        phaseCode: 'P01',
        title: 'Primeira tarefa',
        position: 1
    });

    const result = listTasks(projectId);

    assert.equal(result.success, true);

    assert.deepEqual(
        result.tasks.map(task => task.code),
        ['T001', 'T002', 'T003']
    );
});

test('Deve preservar o estado das tarefas', () => {
    insertTask({
        code: 'T001',
        phaseCode: 'P01',
        title: 'Tarefa em andamento',
        position: 1,
        status: 'in_progress'
    });

    const result = listTasks(projectId);

    assert.equal(result.success, true);
    assert.equal(result.tasks[0].status, 'in_progress');
});
