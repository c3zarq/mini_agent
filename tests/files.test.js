'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    validatePath,
    listFiles,
    searchFiles,
    readFile,
    createFile,
    writeFile
} = require('../src/files');

// Preparar diretórios temporários para os testes
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-agent-'));
const projectRoot = path.join(tempRoot, 'projeto');
const externalRoot = path.join(tempRoot, 'externo');

fs.mkdirSync(projectRoot);
fs.mkdirSync(externalRoot);

fs.writeFileSync(path.join(projectRoot, 'arquivo.txt'), 'Conteúdo interno');
fs.writeFileSync(path.join(externalRoot, 'arquivo.txt'), 'Conteúdo externo');

// Criar links simbólicos para os testes
fs.symlinkSync(
    path.join(externalRoot, 'arquivo.txt'),
    path.join(projectRoot, 'link-externo.txt')
);

fs.symlinkSync(
    path.join(projectRoot, 'arquivo.txt'),
    path.join(projectRoot, 'link-interno.txt')
);

test.after(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
});

// Caminho interno válido
test('Deve aceitar arquivos dentro do projeto', () => {
    const result = validatePath(projectRoot, 'arquivo.txt');

    assert.equal(result.success, true);
    assert.equal(result.path, fs.realpathSync(path.join(projectRoot, 'arquivo.txt')));
});

// Caminho absoluto interno
test('Deve aceitar caminhos absolutos dentro do projeto', () => {
    const result = validatePath(
        projectRoot,
        path.join(projectRoot, 'arquivo.txt')
    );

    assert.equal(result.success, true);
});

// Caminho externo
test('Deve rejeitar caminhos absolutos externos', () => {
    const result = validatePath(
        projectRoot,
        path.join(externalRoot, 'arquivo.txt')
    );

    assert.equal(result.success, false);
});

// Tentativa de escapar com ../
test('Deve rejeitar caminhos que utilizem ../ para sair do projeto', () => {
    const result = validatePath(
        projectRoot,
        '../externo/arquivo.txt'
    );

    assert.equal(result.success, false);
});

// Link simbólico externo
test('Deve rejeitar links simbólicos que apontem para fora do projeto', () => {
    const result = validatePath(projectRoot, 'link-externo.txt');

    assert.equal(result.success, false);
});

// Link simbólico interno
test('Deve aceitar links simbólicos que apontem para dentro do projeto', () => {
    const result = validatePath(projectRoot, 'link-interno.txt');

    assert.equal(result.success, true);
});

// Caminho inexistente
test('Deve rejeitar caminhos inexistentes', () => {
    const result = validatePath(projectRoot, 'inexistente.txt');

    assert.equal(result.success, false);
});

// Entradas inválidas
test('Deve rejeitar entradas inválidas', () => {
    assert.equal(validatePath('', 'arquivo.txt').success, false);
    assert.equal(validatePath(projectRoot, '').success, false);
    assert.equal(validatePath(projectRoot, null).success, false);
    assert.equal(validatePath(null, 'arquivo.txt').success, false);
});

// Listagem de diretório
test('Deve listar arquivos e diretórios do projeto', () => {
    fs.mkdirSync(path.join(projectRoot, 'subdiretorio'));

    fs.writeFileSync(
        path.join(projectRoot, 'outro-arquivo.txt'),
        'Outro conteúdo'
    );

    const result = listFiles(projectRoot);

    assert.equal(result.success, true);
    assert.ok(Array.isArray(result.files));

    const file = result.files.find(item => item.name === 'arquivo.txt');
    const directory = result.files.find(item => item.name === 'subdiretorio');

    assert.equal(file.type, 'file');
    assert.equal(directory.type, 'directory');
});

// Listagem de subdiretório
test('Deve listar o conteúdo de um subdiretório', () => {
    const result = listFiles(projectRoot, 'subdiretorio');

    assert.equal(result.success, true);
    assert.deepEqual(result.files, []);
});

// Caminho inexistente
test('Deve rejeitar a listagem de diretório inexistente', () => {
    const result = listFiles(projectRoot, 'nao-existe');

    assert.equal(result.success, false);
});

// Caminho correspondente a arquivo
test('Deve rejeitar a listagem de um arquivo', () => {
    const result = listFiles(projectRoot, 'arquivo.txt');

    assert.equal(result.success, false);
});

// Caminho externo
test('Deve rejeitar a listagem de diretório externo', () => {
    const result = listFiles(
        projectRoot,
        externalRoot
    );

    assert.equal(result.success, false);
});

// Entradas inválidas
test('Deve rejeitar parâmetros inválidos na listagem', () => {
    assert.equal(listFiles('', '.').success, false);
    assert.equal(listFiles(projectRoot, null).success, false);
});

// Pesquisa textual em arquivos
test('Deve localizar termos em arquivos do projeto', () => {
    fs.writeFileSync(
        path.join(projectRoot, 'pesquisa.txt'),
        'Primeira linha\nTermo encontrado\nTerceira linha'
    );

    const result = searchFiles(projectRoot, 'Termo encontrado');

    assert.equal(result.success, true);
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].lineNumber, 2);
    assert.equal(result.results[0].line, 'Termo encontrado');
});

// Pesquisa recursiva
test('Deve pesquisar arquivos em subdiretórios', () => {
    const subdirectory = path.join(projectRoot, 'subdiretorio');

    fs.mkdirSync(subdirectory, { recursive: true });

    fs.writeFileSync(
        path.join(subdirectory, 'interno.txt'),
        'Conteúdo da pesquisa recursiva'
    );

    const result = searchFiles(projectRoot, 'pesquisa recursiva');

    assert.equal(result.success, true);
    assert.equal(result.results.length, 1);
    assert.ok(result.results[0].path.endsWith('interno.txt'));
});

// Termo não encontrado
test('Deve retornar lista vazia quando o termo não for encontrado', () => {
    const result = searchFiles(projectRoot, 'termo inexistente');

    assert.equal(result.success, true);
    assert.deepEqual(result.results, []);
});

// Pesquisa com diferenciação entre maiúsculas e minúsculas
test('Deve diferenciar maiúsculas e minúsculas', () => {
    const result = searchFiles(projectRoot, 'CONTEÚDO INTERNO');

    assert.equal(result.success, true);
    assert.deepEqual(result.results, []);
});

// Arquivo binário
test('Deve ignorar arquivos binários', () => {
    fs.writeFileSync(
        path.join(projectRoot, 'binario.dat'),
        Buffer.from([0x41, 0x00, 0x42])
    );

    const result = searchFiles(projectRoot, 'A');

    assert.equal(result.success, true);
    assert.equal(
        result.results.some(item => item.path.endsWith('binario.dat')),
        false
    );
});

// Link simbólico externo
test('Não deve pesquisar arquivos por links simbólicos externos', () => {
    const result = searchFiles(projectRoot, 'Conteúdo externo');

    assert.equal(result.success, true);
    assert.deepEqual(result.results, []);
});

// Caminho externo
test('Deve rejeitar diretórios externos na pesquisa', () => {
    const result = searchFiles(
        projectRoot,
        'Conteúdo externo',
        externalRoot
    );

    assert.equal(result.success, false);
});

// Caminho correspondente a arquivo
test('Deve rejeitar pesquisa iniciada em um arquivo', () => {
    const result = searchFiles(
        projectRoot,
        'Conteúdo interno',
        'arquivo.txt'
    );

    assert.equal(result.success, false);
});

// Entradas inválidas
test('Deve rejeitar parâmetros inválidos na pesquisa', () => {
    assert.equal(searchFiles('', 'termo').success, false);
    assert.equal(searchFiles(projectRoot, '').success, false);
    assert.equal(searchFiles(projectRoot, null).success, false);
    assert.equal(searchFiles(projectRoot, 'termo', null).success, false);
});

// Leitura de arquivo
test('Deve ler o conteúdo de um arquivo do projeto', () => {
    const result = readFile(projectRoot, 'arquivo.txt');

    assert.equal(result.success, true);
    assert.equal(result.content, 'Conteúdo interno');
    assert.ok(result.path.endsWith('arquivo.txt'));
});

// Leitura de arquivo em subdiretório
test('Deve ler arquivos em subdiretórios', () => {
    const subdirectory = path.join(projectRoot, 'subdiretorio');
    const filePath = path.join(subdirectory, 'leitura.txt');

    fs.mkdirSync(subdirectory, { recursive: true });
    fs.writeFileSync(filePath, 'Conteúdo do subdiretório');

    const result = readFile(projectRoot, 'subdiretorio/leitura.txt');

    assert.equal(result.success, true);
    assert.equal(result.content, 'Conteúdo do subdiretório');
});

// Arquivo inexistente
test('Deve rejeitar a leitura de arquivos inexistentes', () => {
    const result = readFile(projectRoot, 'inexistente.txt');

    assert.equal(result.success, false);
});

// Caminho correspondente a diretório
test('Deve rejeitar a leitura de diretórios', () => {
    const result = readFile(projectRoot, 'subdiretorio');

    assert.equal(result.success, false);
});

// Caminho externo
test('Deve rejeitar a leitura de arquivos externos', () => {
    const result = readFile(projectRoot, path.join(externalRoot, 'arquivo.txt'));

    assert.equal(result.success, false);
});

// Link simbólico externo
test('Deve rejeitar a leitura por links simbólicos externos', () => {
    const result = readFile(projectRoot, 'link-externo.txt');

    assert.equal(result.success, false);
});

// Entradas inválidas
test('Deve rejeitar parâmetros inválidos na leitura', () => {
    assert.equal(readFile('', 'arquivo.txt').success, false);
    assert.equal(readFile(projectRoot, '').success, false);
    assert.equal(readFile(projectRoot, null).success, false);
    assert.equal(readFile(null, 'arquivo.txt').success, false);
});

// Criação de arquivo
test('Deve criar um arquivo dentro do projeto', () => {
    const result = createFile(
        projectRoot,
        'novo-arquivo.txt',
        'Novo conteúdo'
    );

    assert.equal(result.success, true);
    assert.equal(result.message, 'Arquivo criado com sucesso.');
    assert.equal(
        fs.readFileSync(
            path.join(projectRoot, 'novo-arquivo.txt'),
            'utf8'
        ),
        'Novo conteúdo'
    );
});

// Impedir sobrescrita
test('Deve impedir a sobrescrita de arquivos existentes', () => {
    const result = createFile(
        projectRoot,
        'arquivo.txt',
        'Conteúdo modificado'
    );

    assert.equal(result.success, false);
    assert.equal(
        fs.readFileSync(path.join(projectRoot, 'arquivo.txt'), 'utf8'),
        'Conteúdo interno'
    );
});

// Caminho absoluto
test('Deve rejeitar caminhos absolutos na criação', () => {
    const result = createFile(
        projectRoot,
        path.join(projectRoot, 'absoluto.txt'),
        'Conteúdo'
    );

    assert.equal(result.success, false);
});

// Diretório pai inexistente
test('Deve rejeitar criação em diretório inexistente', () => {
    const result = createFile(
        projectRoot,
        'nao-existe/novo.txt',
        'Conteúdo'
    );

    assert.equal(result.success, false);
});

// Link simbólico externo
test('Deve rejeitar criação por link simbólico externo', () => {
    const result = createFile(
        projectRoot,
        'link-externo.txt/novo.txt',
        'Conteúdo'
    );

    assert.equal(result.success, false);
});

// Conteúdo inválido
test('Deve rejeitar conteúdo que não seja texto', () => {
    const result = createFile(
        projectRoot,
        'invalido.txt',
        null
    );

    assert.equal(result.success, false);
});

// Gravação de arquivo existente
test('Deve atualizar o conteúdo de um arquivo existente', () => {
    const result = writeFile(
        projectRoot,
        'arquivo.txt',
        'Conteúdo atualizado',
        'Conteúdo interno'
    );

    assert.equal(result.success, true);
    assert.equal(
        fs.readFileSync(path.join(projectRoot, 'arquivo.txt'), 'utf8'),
        'Conteúdo atualizado'
    );
});

// Conteúdo desatualizado
test('Deve impedir gravação quando o arquivo foi modificado', () => {
    const filePath = path.join(projectRoot, 'arquivo.txt');

    fs.writeFileSync(filePath, 'Conteúdo alterado externamente');

    const result = writeFile(
        projectRoot,
        'arquivo.txt',
        'Nova versão',
        'Conteúdo atualizado'
    );

    assert.equal(result.success, false);
    assert.match(result.message, /modificado desde a validação/i);
    assert.equal(
        fs.readFileSync(filePath, 'utf8'),
        'Conteúdo alterado externamente'
    );
});

// Arquivo inexistente
test('Deve rejeitar gravação em arquivo inexistente', () => {
    const result = writeFile(
        projectRoot,
        'inexistente.txt',
        'Novo conteúdo',
        ''
    );

    assert.equal(result.success, false);
});

// Caminho externo
test('Deve rejeitar gravação fora do projeto', () => {
    const result = writeFile(
        projectRoot,
        path.join(externalRoot, 'arquivo.txt'),
        'Conteúdo alterado',
        'Conteúdo externo'
    );

    assert.equal(result.success, false);
});

// Conteúdo inválido
test('Deve rejeitar parâmetros de conteúdo inválidos na gravação', () => {
    assert.equal(
        writeFile(projectRoot, 'arquivo.txt', null, 'Conteúdo').success,
        false
    );

    assert.equal(
        writeFile(projectRoot, 'arquivo.txt', 'Novo conteúdo', null).success,
        false
    );
});
