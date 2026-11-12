'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
    readEAP,
    parseProjectName,
    parsePhases,
    parseTasks,
    validateEAP,
    parseEAP
} = require('../src/eap');

const eapPath = path.join(__dirname, '../docs/EAP.md');
const original = readEAP(eapPath);

// Leitura da EAP
test('Deve ler o arquivo EAP.md', () => {
    assert.equal(original.success, true);
});

// Tratamento de arquivo inexistente
test('Deve tratar arquivo inexistente', () => {
    const result = readEAP('arquivo-inexistente.md');
    assert.equal(result.success, false);
});

// Identificação do projeto
test('Deve identificar o nome do projeto', () => {
    const result = parseProjectName(original.content);
    assert.equal(result.success, true);
    assert.equal(result.name, 'MINI AGENT');
});

// Identificação das etapas
test('Deve identificar as nove etapas', () => {
    const result = parsePhases(original.content);
    assert.equal(result.success, true);
    assert.equal(result.phases.length, 9);
});

// Identificação das tarefas
test('Deve identificar as 52 tarefas', () => {
    const result = parseTasks(original.content);
    assert.equal(result.success, true);
    assert.equal(result.tasks.length, 52);
});

// Validação da EAP original
test('Deve validar a EAP original', () => {
    const result = validateEAP(original.content);
    assert.equal(result.success, true);
    assert.deepEqual(result.errors, []);
});

// Identificação de tarefas fora de etapa
test('Deve identificar tarefa fora de etapa', () => {
    const content = `
# TESTE

| T001 | Tarefa inválida | Resultado |

## P01 — Primeira etapa
`;

    const result = parseTasks(content);

    assert.equal(result.success, false);
    assert.match(result.errors[0], /fora de uma etapa/);
});

// Identificação de linha malformada
test('Deve identificar linha de tarefa malformada', () => {
    const content = `
# TESTE

## P01 — Primeira etapa

| T001 | Tarefa sem resultado |
`;

    const result = parseTasks(content);

    assert.equal(result.success, false);
    assert.match(result.errors[0], /malformada/);
});

// Identificação de códigos duplicados
test('Deve identificar identificadores duplicados', () => {
    const content = `
# TESTE

## P01 — Primeira etapa

| ID | Tarefa | Resultado esperado |
|---|---|---|
| T001 | Primeira tarefa | Resultado 1 |

## P01 — Segunda etapa

| ID | Tarefa | Resultado esperado |
|---|---|---|
| T001 | Segunda tarefa | Resultado 2 |
`;

    const result = validateEAP(content);

    assert.equal(result.success, false);
    assert.ok(result.errors.some(error => error.includes('etapas duplicados')));
    assert.ok(result.errors.some(error => error.includes('tarefas duplicados')));
});

// Interpretação completa
test('Deve interpretar a EAP completa', () => {
    const result = parseEAP(original.content);

    assert.equal(result.success, true);
    assert.equal(result.project.name, 'MINI AGENT');
    assert.equal(result.phases.length, 9);
});
