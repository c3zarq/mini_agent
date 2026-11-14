'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    approveProposal,
    validateEditProposal
} = require('../src/approval');

// Preparar diretórios temporários
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-agent-'));
const projectRoot = path.join(tempRoot, 'projeto');
const externalRoot = path.join(tempRoot, 'externo');

fs.mkdirSync(projectRoot);
fs.mkdirSync(externalRoot);

fs.writeFileSync(
    path.join(projectRoot, 'existente.txt'),
    'Conteúdo original'
);

fs.writeFileSync(
    path.join(externalRoot, 'externo.txt'),
    'Conteúdo externo'
);

// Criar link simbólico externo
fs.symlinkSync(
    externalRoot,
    path.join(projectRoot, 'link-externo')
);

// Proposta válida para os testes
function createProposal(requestedPath = 'novo-arquivo.txt') {
    return {
        success: true,
        type: 'proposal',
        name: 'create_file',
        classification: 'approval_required',
        arguments: {
            path: requestedPath,
            content: 'Conteúdo de teste'
        },
        message: 'Posso criar este arquivo?'
    };
}

test.after(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
});

// Proposta válida de edição para os testes
function createEditProposal(
    requestedPath = 'existente.txt',
    oldText = 'Conteúdo original',
    newText = 'Conteúdo atualizado'
) {
    return {
        success: true,
        type: 'proposal',
        name: 'replace_text',
        classification: 'approval_required',
        arguments: {
            path: requestedPath,
            old_text: oldText,
            new_text: newText
        },
        message: 'Posso editar este arquivo?'
    };
}

// Aprovação e criação efetiva
test('Deve aprovar e criar um arquivo válido', () => {
    const proposal = createProposal();

    const result = approveProposal(
        proposal,
        'approve',
        projectRoot
    );

    assert.equal(result.success, true);
    assert.equal(result.status, 'created');
    assert.equal(result.proposal, proposal);
    assert.equal(
        result.destination,
        path.join(projectRoot, 'novo-arquivo.txt')
    );

    // A aprovação deve gravar o conteúdo proposto
    assert.equal(
        fs.readFileSync(
            path.join(projectRoot, 'novo-arquivo.txt'),
            'utf8'
        ),
        'Conteúdo de teste'
    );
});

// Rejeição válida
test('Deve rejeitar uma proposta válida', () => {
    const proposal = createProposal('rejeitado.txt');

    const result = approveProposal(
        proposal,
        'reject',
        projectRoot
    );

    assert.equal(result.success, true);
    assert.equal(result.status, 'rejected');
    assert.equal(result.proposal, proposal);

    // A rejeição não deve criar o arquivo
    assert.equal(
        fs.existsSync(path.join(projectRoot, 'rejeitado.txt')),
        false
    );
});

// Decisão ausente
test('Deve rejeitar a ausência de decisão', () => {
    const result = approveProposal(
        createProposal(),
        undefined,
        projectRoot
    );

    assert.equal(result.success, false);
});

// Decisão inválida
test('Deve rejeitar decisões inválidas', () => {
    const result = approveProposal(
        createProposal(),
        'yes',
        projectRoot
    );

    assert.equal(result.success, false);
});

// Proposta inválida
test('Deve rejeitar propostas inválidas', () => {
    assert.equal(
        approveProposal(null, 'approve', projectRoot).success,
        false
    );

    assert.equal(
        approveProposal({}, 'approve', projectRoot).success,
        false
    );

    const proposal = createProposal();
    proposal.name = 'read_file';

    assert.equal(
        approveProposal(proposal, 'approve', projectRoot).success,
        false
    );
});

// Caminho absoluto
test('Deve rejeitar propostas com caminhos absolutos', () => {
    const proposal = createProposal(
        path.join(projectRoot, 'novo-arquivo.txt')
    );

    const result = approveProposal(
        proposal,
        'approve',
        projectRoot
    );

    assert.equal(result.success, false);
});

// Tentativa de escapar do projeto
test('Deve rejeitar destinos externos com ../', () => {
    const proposal = createProposal('../externo/novo-arquivo.txt');

    const result = approveProposal(
        proposal,
        'approve',
        projectRoot
    );

    assert.equal(result.success, false);
});

// Link simbólico externo
test('Deve rejeitar destinos através de links simbólicos externos', () => {
    const proposal = createProposal(
        'link-externo/novo-arquivo.txt'
    );

    const result = approveProposal(
        proposal,
        'approve',
        projectRoot
    );

    assert.equal(result.success, false);
});

// Destino já existente
test('Deve rejeitar destinos que já existem', () => {
    const proposal = createProposal('existente.txt');

    const result = approveProposal(
        proposal,
        'approve',
        projectRoot
    );

    assert.equal(result.success, false);

    // O conteúdo original deve permanecer intacto
    assert.equal(
        fs.readFileSync(
            path.join(projectRoot, 'existente.txt'),
            'utf8'
        ),
        'Conteúdo original'
    );
});

// Diretório pai inexistente
test('Deve rejeitar destinos cujo diretório pai não existe', () => {
    const proposal = createProposal(
        'nao-existe/novo-arquivo.txt'
    );

    const result = approveProposal(
        proposal,
        'approve',
        projectRoot
    );

    assert.equal(result.success, false);
});

// Diretório autorizado inválido
test('Deve rejeitar diretórios autorizados inexistentes', () => {
    const result = approveProposal(
        createProposal(),
        'approve',
        path.join(tempRoot, 'inexistente')
    );

    assert.equal(result.success, false);
});

// Diretório pai que corresponde a um arquivo
test('Deve rejeitar destinos cujo diretório pai seja um arquivo', () => {
    const proposal = createProposal(
        'existente.txt/novo-arquivo.txt'
    );

    const result = approveProposal(
        proposal,
        'approve',
        projectRoot
    );

    assert.equal(result.success, false);
});

// Proposta de edição válida
test('Deve validar proposta com ocorrência única do trecho original', () => {
    const proposal = createEditProposal();

    const result = validateEditProposal(proposal, projectRoot);

    assert.equal(result.success, true);
    assert.equal(result.status, 'valid');
    assert.equal(result.proposal, proposal);
    assert.equal(result.content, 'Conteúdo original');
    assert.equal(result.matchIndex, 0);
    assert.equal(result.occurrences, 1);

    // A validação não deve modificar o arquivo
    assert.equal(
        fs.readFileSync(path.join(projectRoot, 'existente.txt'), 'utf8'),
        'Conteúdo original'
    );
});

// Trecho original inexistente
test('Deve rejeitar trecho original não encontrado', () => {
    const proposal = createEditProposal(
        'existente.txt',
        'trecho inexistente'
    );

    const result = validateEditProposal(proposal, projectRoot);

    assert.equal(result.success, false);
    assert.match(result.message, /não foi encontrado/i);
});

// Trecho original repetido
test('Deve rejeitar trecho original com múltiplas ocorrências', () => {
    const duplicatePath = path.join(projectRoot, 'duplicado.txt');

    fs.writeFileSync(duplicatePath, 'abc abc');

    const proposal = createEditProposal(
        'duplicado.txt',
        'abc'
    );

    const result = validateEditProposal(proposal, projectRoot);

    assert.equal(result.success, false);
    assert.match(result.message, /mais de uma vez/i);
});

// Ocorrências sobrepostas
test('Deve identificar ocorrências sobrepostas do trecho original', () => {
    const overlapPath = path.join(projectRoot, 'sobreposto.txt');

    fs.writeFileSync(overlapPath, 'aaaa');

    const proposal = createEditProposal(
        'sobreposto.txt',
        'aa'
    );

    const result = validateEditProposal(proposal, projectRoot);

    assert.equal(result.success, false);
    assert.match(result.message, /mais de uma vez/i);
});

// Arquivo inexistente
test('Deve rejeitar proposta para arquivo inexistente', () => {
    const proposal = createEditProposal('inexistente.txt');

    const result = validateEditProposal(proposal, projectRoot);

    assert.equal(result.success, false);
});

// Diretório em vez de arquivo
test('Deve rejeitar proposta cujo destino seja um diretório', () => {
    const proposal = createEditProposal('.');

    const result = validateEditProposal(proposal, projectRoot);

    assert.equal(result.success, false);
});

// Caminho absoluto
test('Deve rejeitar propostas de edição com caminho absoluto', () => {
    const proposal = createEditProposal(
        path.join(projectRoot, 'existente.txt')
    );

    const result = validateEditProposal(proposal, projectRoot);

    assert.equal(result.success, false);
});

// Link simbólico externo
test('Deve rejeitar propostas de edição por link simbólico externo', () => {
    const proposal = createEditProposal(
        'link-externo/externo.txt',
        'Conteúdo externo'
    );

    const result = validateEditProposal(proposal, projectRoot);

    assert.equal(result.success, false);
});

// Proposta inválida
test('Deve rejeitar propostas de edição estruturalmente inválidas', () => {
    const proposal = createEditProposal();
    proposal.arguments.old_text = '';

    const result = validateEditProposal(proposal, projectRoot);

    assert.equal(result.success, false);
});

// Rejeição de proposta de edição
test('Deve rejeitar uma proposta de edição sem modificar o arquivo', () => {
    const proposal = createEditProposal();

    const result = approveProposal(
        proposal,
        'reject',
        projectRoot
    );

    assert.equal(result.success, true);
    assert.equal(result.status, 'rejected');

    assert.equal(
        fs.readFileSync(
            path.join(projectRoot, 'existente.txt'),
            'utf8'
        ),
        'Conteúdo original'
    );
});

// Aprovação e edição efetiva
test('Deve aprovar e aplicar uma edição válida', () => {
    const proposal = createEditProposal();

    const result = approveProposal(
        proposal,
        'approve',
        projectRoot
    );

    assert.equal(result.success, true);
    assert.equal(result.status, 'updated');
    assert.equal(result.proposal, proposal);
    assert.equal(
        result.destination,
        path.join(projectRoot, 'existente.txt')
    );

    assert.equal(
        fs.readFileSync(
            path.join(projectRoot, 'existente.txt'),
            'utf8'
        ),
        'Conteúdo atualizado'
    );
});

// Aprovação de edição que remove um trecho
test('Deve permitir substituir um trecho por conteúdo vazio', () => {
    const filePath = path.join(projectRoot, 'remocao.txt');

    fs.writeFileSync(filePath, 'Início REMOVER fim');

    const proposal = createEditProposal(
        'remocao.txt',
        'REMOVER',
        ''
    );

    const result = approveProposal(
        proposal,
        'approve',
        projectRoot
    );

    assert.equal(result.success, true);
    assert.equal(result.status, 'updated');

    assert.equal(
        fs.readFileSync(filePath, 'utf8'),
        'Início  fim'
    );
});

// Revalidar edição após alteração externa
test('Deve impedir edição quando o trecho original muda antes da aprovação', () => {
    const filePath = path.join(projectRoot, 'alteracao-externa.txt');

    fs.writeFileSync(filePath, 'Versão original');

    const proposal = createEditProposal(
        'alteracao-externa.txt',
        'Versão original',
        'Versão atualizada'
    );

    // Validação inicial da proposta
    const validation = validateEditProposal(
        proposal,
        projectRoot
    );

    assert.equal(validation.success, true);

    // Simular alteração externa antes da aprovação
    fs.writeFileSync(filePath, 'Conteúdo alterado externamente');

    const result = approveProposal(
        proposal,
        'approve',
        projectRoot
    );

    assert.equal(result.success, false);

    // O conteúdo externo deve permanecer intacto
    assert.equal(
        fs.readFileSync(filePath, 'utf8'),
        'Conteúdo alterado externamente'
    );
});
