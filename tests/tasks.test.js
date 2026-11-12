'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
    readTask,
    parseTaskHeader,
    parseTaskMetadata,
    parseTaskSections,
    validateTask,
    parseTask
} = require('../src/tasks');

const taskPath = path.join(__dirname, '../tasks/T018.md');
const original = readTask(taskPath);

// Leitura do documento
test('Deve ler o documento T018.md', () => {
    assert.equal(original.success, true);
});

// Tratamento de arquivo inexistente
test('Deve tratar arquivo inexistente', () => {
    const result = readTask('arquivo-inexistente.md');
    assert.equal(result.success, false);
});

// Identificação do código e título
test('Deve identificar código e título da tarefa', () => {
    const result = parseTaskHeader(original.content);

    assert.equal(result.success, true);
    assert.equal(result.code, 'T018');
    assert.equal(result.title, 'Implementar carregamento de tarefas');
});

// Identificação dos metadados
test('Deve identificar etapa e status', () => {
    const result = parseTaskMetadata(original.content);

    assert.equal(result.success, true);
    assert.equal(result.phaseCode, 'P04');
    assert.equal(result.phaseTitle, 'Gerenciamento de projetos e tarefas');
    assert.equal(result.status, 'Concluida');
});

// Interpretação das seções
test('Deve interpretar as seções do documento', () => {
    const result = parseTaskSections(original.content);

    assert.equal(result.success, true);
    assert.ok(result.sections.Objetivo);
    assert.ok(result.sections.Atividades);
    assert.ok(result.sections['Critérios de conclusão']);
    assert.ok(result.sections.Restrições);
});

// Validação do documento original
test('Deve validar o documento T018', () => {
    const result = validateTask(original.content);

    assert.equal(result.success, true);
    assert.deepEqual(result.errors, []);
});

// Identificação de cabeçalho inválido
test('Deve identificar cabeçalho inválido', () => {
    const result = parseTaskHeader('# T18 — Teste');

    assert.equal(result.success, false);
});

// Identificação de seção obrigatória ausente
test('Deve identificar seções obrigatórias ausentes', () => {
    const content = `# T999 — Teste

**Etapa:** P04 — Testes
**Status:** Pendente

## Objetivo

Teste.
`;

    const result = validateTask(content);

    assert.equal(result.success, false);
    assert.ok(result.errors.some(error => error.includes('Atividades')));
    assert.ok(result.errors.some(error => error.includes('Critérios de conclusão')));
});

// Aceitação de seções opcionais ausentes
test('Deve aceitar documento sem seções opcionais', () => {
    const content = `# T999 — Teste

**Etapa:** P04 — Testes
**Status:** Pendente

## Objetivo

Teste.

## Atividades

1. Executar teste.

## Critérios de conclusão

- Teste aprovado.
`;

    const result = parseTask(content);

    assert.equal(result.success, true);
    assert.equal(result.task.sections.Restrições, undefined);
});

// Interpretação completa
test('Deve interpretar a tarefa completa', () => {
    const result = parseTask(original.content);

    assert.equal(result.success, true);
    assert.equal(result.task.code, 'T018');
    assert.equal(result.task.phaseCode, 'P04');
    assert.equal(result.task.status, 'Concluida');
});
