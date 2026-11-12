'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Criar ambiente isolado para os testes
const tempHome = fs.mkdtempSync(
    path.join(os.tmpdir(), 'mini-agent-test-')
);

process.env.HOME = tempHome;

// Importar módulos após configurar o ambiente
const {
    db,
    createProject,
    closeDatabase
} = require('../src/database');

const { syncTasks } = require('../src/taskSync');

let projectId;

// Preparar projeto de teste
test.before(() => {
    const result = createProject(
        'Projeto de teste taskSync',
        path.join(tempHome, 'projeto')
    );

    assert.equal(result.success, true);

    projectId = result.project.id;
});

// Limpar tarefas antes de cada teste
test.beforeEach(() => {
    db.prepare(`
        DELETE FROM tasks
        WHERE project_id = ?
    `).run(projectId);
});

// Encerrar banco e remover ambiente temporário
test.after(() => {
    closeDatabase();

    fs.rmSync(tempHome, {
        recursive: true,
        force: true
    });
});

// EAP fictícia para testes
function createTestEAP() {
    return {
        success: true,
        phases: [
            {
                code: 'P01',
                tasks: [
                    {
                        code: 'X001',
                        title: 'Criar estrutura',
                        expectedResult: 'Estrutura criada',
                        position: 1
                    },
                    {
                        code: 'X002',
                        title: 'Configurar banco',
                        expectedResult: 'Banco configurado',
                        position: 2
                    }
                ]
            }
        ]
    };
}

// Testar cadastro inicial
test('Deve cadastrar tarefas novas da EAP', () => {
    const result = syncTasks(projectId, createTestEAP());

    assert.equal(result.success, true);
    assert.equal(result.created, 2);
    assert.equal(result.updated, 0);
    assert.equal(result.total, 2);

    const tasks = db.prepare(`
        SELECT code, status, is_active
        FROM tasks
        WHERE project_id = ?
        ORDER BY code
    `).all(projectId);

    assert.equal(tasks.length, 2);
    assert.equal(tasks[0].status, 'pending');
    assert.equal(tasks[0].is_active, 1);
});

// Testar sincronização repetida
test('Não deve duplicar tarefas em sincronizações repetidas', () => {
    const eap = createTestEAP();

    const first = syncTasks(projectId, eap);
    const second = syncTasks(projectId, eap);

    assert.equal(first.created, 2);
    assert.equal(second.created, 0);
    assert.equal(second.updated, 2);

    const total = db.prepare(`
        SELECT COUNT(*) AS total
        FROM tasks
        WHERE project_id = ?
    `).get(projectId);

    assert.equal(total.total, 2);
});

// Testar preservação do estado de execução
test('Deve preservar o estado da tarefa durante a sincronização', () => {
    const eap = createTestEAP();

    syncTasks(projectId, eap);

    // Alterar estado operacional da primeira tarefa
    db.prepare(`
        UPDATE tasks
        SET status = ?
        WHERE project_id = ? AND code = ?
    `).run('completed', projectId, 'X001');

    // Sincronizar novamente
    const result = syncTasks(projectId, eap);

    assert.equal(result.success, true);

    const task = db.prepare(`
        SELECT status
        FROM tasks
        WHERE project_id = ? AND code = ?
    `).get(projectId, 'X001');

    assert.equal(task.status, 'completed');
});

// Testar desativação de tarefa removida da EAP
test('Deve desativar tarefas removidas sem apagá-las do banco', () => {
    const eap = createTestEAP();

    syncTasks(projectId, eap);

    // Criar uma EAP sem a tarefa X002
    const updatedEAP = createTestEAP();
    updatedEAP.phases[0].tasks = [
        updatedEAP.phases[0].tasks[0]
    ];

    const result = syncTasks(projectId, updatedEAP);

    assert.equal(result.success, true);

    const task = db.prepare(`
        SELECT status, is_active
        FROM tasks
        WHERE project_id = ? AND code = ?
    `).get(projectId, 'X002');

    assert.ok(task);
    assert.equal(task.is_active, 0);
    assert.equal(task.status, 'pending');
});


// Testar reativação de tarefa anteriormente removida
test('Deve reativar tarefas que retornam à EAP sem duplicá-las', () => {
    const eap = createTestEAP();

    syncTasks(projectId, eap);

    // Remover X002 da EAP
    const reducedEAP = createTestEAP();
    reducedEAP.phases[0].tasks = [
        reducedEAP.phases[0].tasks[0]
    ];

    syncTasks(projectId, reducedEAP);

    // Retornar à EAP original
    const result = syncTasks(projectId, eap);

    assert.equal(result.success, true);
    assert.equal(result.created, 0);
    assert.equal(result.updated, 2);

    const task = db.prepare(`
        SELECT status, is_active
        FROM tasks
        WHERE project_id = ? AND code = ?
    `).get(projectId, 'X002');

    assert.ok(task);
    assert.equal(task.is_active, 1);
    assert.equal(task.status, 'pending');

    const total = db.prepare(`
        SELECT COUNT(*) AS total
        FROM tasks
        WHERE project_id = ?
    `).get(projectId);

    assert.equal(total.total, 2);
});

// Testar inclusão de nova tarefa na EAP
test('Deve cadastrar novas tarefas adicionadas à EAP', () => {
    const eap = createTestEAP();

    syncTasks(projectId, eap);

    // Adicionar uma nova tarefa
    eap.phases[0].tasks.push({
        code: 'X003',
        title: 'Implementar sincronização',
        expectedResult: 'Sincronização implementada',
        position: 3
    });

    const result = syncTasks(projectId, eap);

    assert.equal(result.success, true);
    assert.equal(result.created, 1);
    assert.equal(result.updated, 2);
    assert.equal(result.total, 3);

    const task = db.prepare(`
        SELECT status, is_active
        FROM tasks
        WHERE project_id = ? AND code = ?
    `).get(projectId, 'X003');

    assert.ok(task);
    assert.equal(task.status, 'pending');
    assert.equal(task.is_active, 1);
});

// Testar validação de dados inválidos
test('Deve rejeitar identificadores e EAPs inválidos', () => {
    const eap = createTestEAP();

    const invalidProject = syncTasks(0, eap);
    assert.equal(invalidProject.success, false);

    const invalidEAP = syncTasks(projectId, null);
    assert.equal(invalidEAP.success, false);

    const invalidPhases = syncTasks(projectId, {
        success: true,
        phases: 'inválido'
    });

    assert.equal(invalidPhases.success, false);
});

// Testar validação de etapas malformadas
test('Deve rejeitar etapas da EAP sem lista de tarefas', () => {
    const invalidEAP = {
        success: true,
        phases: [
            {
                code: 'P01'
            }
        ]
    };

    const result = syncTasks(projectId, invalidEAP);

    assert.equal(result.success, false);
    assert.match(result.message, /estrutura das etapas/i);
});

// Testar rollback quando ocorre erro durante a sincronização
test('Deve desfazer alterações quando a sincronização falhar', () => {
    const eap = createTestEAP();

    syncTasks(projectId, eap);

    const invalidEAP = createTestEAP();

    invalidEAP.phases[0].tasks.push({
        code: 'X003',
        title: '',
        expectedResult: 'Resultado inválido',
        position: 3
    });

    const result = syncTasks(projectId, invalidEAP);

    assert.equal(result.success, false);

    const tasks = db.prepare(`
        SELECT code
        FROM tasks
        WHERE project_id = ?
        ORDER BY code
    `).all(projectId);

    assert.deepEqual(
        tasks.map(task => task.code),
        ['X001', 'X002']
    );
});
