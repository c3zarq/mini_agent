'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
    readFile,
    createFile,
    writeFile
} = require('./files');

// Verificar se um caminho pertence ao projeto
function validateDestination(projectRoot, requestedPath) {
    if (
        typeof projectRoot !== 'string' ||
        !projectRoot.trim() ||
        typeof requestedPath !== 'string' ||
        !requestedPath.trim() ||
        path.isAbsolute(requestedPath) ||
        path.win32.isAbsolute(requestedPath)
    ) {
        return {
            success: false,
            message: 'Diretório ou caminho de destino inválido.'
        };
    }

    try {
        // Resolver o diretório autorizado
        const realRoot = fs.realpathSync(projectRoot);

        if (!fs.statSync(realRoot).isDirectory()) {
            return {
                success: false,
                message: 'O diretório autorizado é inválido.'
            };
        }

        // Resolver o destino solicitado
        const destination = path.resolve(realRoot, requestedPath);
        const parent = path.dirname(destination);

        // Validar o diretório pai e resolver links simbólicos
        const realParent = fs.realpathSync(parent);

        const relativeParent = path.relative(realRoot, realParent);
        
        if (!fs.statSync(realParent).isDirectory()) {
           return {
               success: false,
               message: 'O diretório de destino não é válido.'
           };
        }

        if (
            relativeParent === '..' ||
            relativeParent.startsWith(`..${path.sep}`) ||
            path.isAbsolute(relativeParent)
        ) {
            return {
                success: false,
                message: 'Acesso negado: destino fora do projeto.'
            };
        }

        // Reconstruir o destino usando o diretório real
        const realDestination = path.join(
            realParent,
            path.basename(destination)
        );

        // Impedir a criação sobre qualquer destino existente
        try {
            fs.lstatSync(realDestination);

            return {
                success: false,
                message: 'O destino já existe e não pode ser sobrescrito.'
            };

        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }

        return {
            success: true,
            path: realDestination
        };

    } catch (error) {
        return {
            success: false,
            message: `Não foi possível validar o destino: ${error.message}`
        };
    }
}

// Validar a estrutura da proposta
function validateProposal(proposal) {
    if (
        typeof proposal !== 'object' ||
        proposal === null ||
        Array.isArray(proposal) ||
        proposal.success !== true ||
        proposal.type !== 'proposal' ||
        proposal.name !== 'create_file' ||
        proposal.classification !== 'approval_required' ||
        typeof proposal.arguments !== 'object' ||
        proposal.arguments === null ||
        Array.isArray(proposal.arguments) ||
        typeof proposal.arguments.path !== 'string' ||
        !proposal.arguments.path.trim() ||
        typeof proposal.arguments.content !== 'string' ||
        typeof proposal.message !== 'string' ||
        !proposal.message.trim()
    ) {
        return {
            success: false,
            message: 'Proposta de criação inválida.'
        };
    }

    return {
        success: true
    };
}

// Validar se uma proposta de edição pode ser aplicada
function validateEditProposal(proposal, projectRoot) {
    // Validar a estrutura da proposta
    if (
        typeof proposal !== 'object' ||
        proposal === null ||
        Array.isArray(proposal) ||
        proposal.success !== true ||
        proposal.type !== 'proposal' ||
        proposal.name !== 'replace_text' ||
        proposal.classification !== 'approval_required' ||
        typeof proposal.arguments !== 'object' ||
        proposal.arguments === null ||
        Array.isArray(proposal.arguments) ||
        typeof proposal.arguments.path !== 'string' ||
        !proposal.arguments.path.trim() ||
        path.isAbsolute(proposal.arguments.path) ||
        path.win32.isAbsolute(proposal.arguments.path) ||
        typeof proposal.arguments.old_text !== 'string' ||
        !proposal.arguments.old_text.trim() ||
        typeof proposal.arguments.new_text !== 'string' ||
        typeof proposal.message !== 'string' ||
        !proposal.message.trim()
    ) {
        return {
            success: false,
            message: 'Proposta de edição inválida.'
        };
    }

    // Ler o arquivo e validar o caminho
    const file = readFile(
        projectRoot,
        proposal.arguments.path
    );

    if (!file.success) {
        return file;
    }

    // Localizar todas as ocorrências do trecho original
    const positions = [];
    let position = file.content.indexOf(
        proposal.arguments.old_text
    );

    while (position !== -1) {
        positions.push(position);

        // Avançar uma posição para identificar sobreposições
        position = file.content.indexOf(
            proposal.arguments.old_text,
            position + 1
        );
    }

    // Rejeitar trecho inexistente
    if (positions.length === 0) {
        return {
            success: false,
            message: 'O trecho original não foi encontrado no arquivo.'
        };
    }

    // Rejeitar ocorrências ambíguas
    if (positions.length > 1) {
        return {
            success: false,
            message: 'O trecho original ocorre mais de uma vez no arquivo.'
        };
    }

    // Retornar dados da validação sem modificar o arquivo
    return {
        success: true,
        status: 'valid',
        proposal,
        path: file.path,
        content: file.content,
        matchIndex: positions[0],
        occurrences: positions.length
    };
}

// Processar a decisão do usuário e executar a operação aprovada
function approveProposal(proposal, decision, projectRoot) {
    // Exigir uma decisão explícita
    if (decision !== 'approve' && decision !== 'reject') {
        return {
            success: false,
            message: 'Decisão inválida. Informe approve ou reject.'
        };
    }

    // Validar a proposta conforme o tipo de operação
    let validation;

    if (proposal?.name === 'create_file') {
        validation = validateProposal(proposal);
    } else if (proposal?.name === 'replace_text') {
        validation = validateEditProposal(proposal, projectRoot);
    } else {
        return {
            success: false,
            message: 'Tipo de proposta não reconhecido.'
        };
    }

    if (!validation.success) {
        return validation;
    }

    // Registrar rejeição sem executar nenhuma operação
    if (decision === 'reject') {
        return {
            success: true,
            status: 'rejected',
            proposal
        };
    }

    // Executar criação de arquivo
    if (proposal.name === 'create_file') {
        // Revalidar o destino imediatamente antes da criação
        const destinationValidation = validateDestination(
            projectRoot,
            proposal.arguments.path
        );

        if (!destinationValidation.success) {
            return destinationValidation;
        }

        const result = createFile(
            projectRoot,
            proposal.arguments.path,
            proposal.arguments.content
        );

        if (!result.success) {
            return result;
        }

        return {
            success: true,
            status: 'created',
            proposal,
            destination: result.path,
            message: 'Arquivo criado com sucesso.'
        };
    }

    // Executar edição de arquivo
    if (proposal.name === 'replace_text') {
        // Preparar o conteúdo atualizado
        const oldText = proposal.arguments.old_text;
        const newText = proposal.arguments.new_text;

        const updatedContent =
            validation.content.slice(0, validation.matchIndex) +
            newText +
            validation.content.slice(
                validation.matchIndex + oldText.length
            );

        // Gravar somente se o conteúdo continuar igual ao validado
        const result = writeFile(
            projectRoot,
            proposal.arguments.path,
            updatedContent,
            validation.content
        );

        if (!result.success) {
            return result;
        }

        return {
            success: true,
            status: 'updated',
            proposal,
            destination: result.path,
            message: 'Arquivo atualizado com sucesso.'
        };
    }
}

module.exports = {
    approveProposal,
    validateEditProposal
};
