'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    calculateProgress
} = require('../src/progress');

// Criar tarefa simulada
function createTask(phaseCode, status, isActive = 1) {
    return {
        phase_code: phaseCode,
        status,
        is_active: isActive
    };
}

// Etapas simuladas
const phases = [
    {
        code: 'P01',
        title: 'Fundação'
    },
    {
        code: 'P02',
        title: 'Desenvolvimento'
    }
];

test('Deve calcular o progresso geral e por etapa', () => {
    const tasks = [
        createTask('P01', 'completed'),
        createTask('P01', 'pending'),
        createTask('P02', 'completed')
    ];

    const result = calculateProgress(tasks, phases);

    assert.equal(result.success, true);

    assert.deepEqual(result.overall, {
        total: 3,
        completed: 2,
        percentage: 66.7
    });

    assert.equal(result.phases[0].total, 2);
    assert.equal(result.phases[0].completed, 1);
    assert.equal(result.phases[0].percentage, 50);

    assert.equal(result.phases[1].total, 1);
    assert.equal(result.phases[1].completed, 1);
    assert.equal(result.phases[1].percentage, 100);
});

test('Deve considerar somente tarefas concluídas no numerador', () => {
    const tasks = [
        createTask('P01', 'pending'),
        createTask('P01', 'in_progress'),
        createTask('P01', 'blocked'),
        createTask('P01', 'completed')
    ];

    const result = calculateProgress(tasks, phases);

    assert.equal(result.success, true);
    assert.equal(result.overall.total, 4);
    assert.equal(result.overall.completed, 1);
    assert.equal(result.overall.percentage, 25);
});

test('Não deve contabilizar tarefas inativas', () => {
    const tasks = [
        createTask('P01', 'completed', 1),
        createTask('P01', 'completed', 0),
        createTask('P02', 'pending', 0)
    ];

    const result = calculateProgress(tasks, phases);

    assert.equal(result.success, true);
    assert.equal(result.overall.total, 1);
    assert.equal(result.overall.completed, 1);
    assert.equal(result.overall.percentage, 100);

    assert.equal(result.phases[0].total, 1);
    assert.equal(result.phases[0].percentage, 100);

    assert.equal(result.phases[1].total, 0);
    assert.equal(result.phases[1].percentage, 0);
});

test('Deve tratar projeto sem tarefas', () => {
    const result = calculateProgress([], phases);

    assert.equal(result.success, true);

    assert.deepEqual(result.overall, {
        total: 0,
        completed: 0,
        percentage: 0
    });

    assert.equal(result.phases.length, 2);
    assert.equal(result.phases[0].percentage, 0);
    assert.equal(result.phases[1].percentage, 0);
});

test('Deve tratar projeto sem tarefas e sem etapas', () => {
    const result = calculateProgress([], []);

    assert.equal(result.success, true);
    assert.equal(result.overall.total, 0);
    assert.equal(result.overall.percentage, 0);
    assert.deepEqual(result.phases, []);
});

test('Deve rejeitar status de tarefa inválido', () => {
    const tasks = [
        createTask('P01', 'invalid')
    ];

    const result = calculateProgress(tasks, phases);

    assert.equal(result.success, false);
    assert.match(result.message, /status de tarefa inválido/);
});

test('Deve rejeitar listas inválidas', () => {
    const invalidTasks = calculateProgress(null, phases);
    const invalidPhases = calculateProgress([], null);

    assert.equal(invalidTasks.success, false);
    assert.equal(invalidPhases.success, false);
});

test('Deve rejeitar etapas duplicadas', () => {
    const duplicatedPhases = [
        ...phases,
        {
            code: 'P01',
            title: 'Outra etapa'
        }
    ];

    const result = calculateProgress([], duplicatedPhases);

    assert.equal(result.success, false);
    assert.match(result.message, /Etapa duplicada/);
});
