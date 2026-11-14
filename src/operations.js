'use strict';

const path = require('node:path');

const { validateResponse } = require('./protocol');

// Operações reconhecidas e suas respectivas classificações
const OPERATIONS = {
    list_files: 'automatic',
    search_files: 'automatic',
    read_file: 'automatic',
    create_file: 'approval_required',
    replace_text: 'approval_required'
};

// Validar os argumentos específicos de criação de arquivo
function validateCreateFileArguments(args) {
    if (
        typeof args.path !== 'string' ||
        !args.path.trim() ||
        path.isAbsolute(args.path) ||
        path.win32.isAbsolute(args.path)
    ) {
        return {
            success: false,
            message: 'O caminho do arquivo deve ser um caminho relativo não vazio.'
        };
    } if (typeof args.content !== 'string') {
        return {
            success: false,
            message: 'O conteúdo do arquivo deve ser um texto.'
        };
    }

    return {
        success: true
    };
}

// Validar os argumentos específicos de substituição de texto
function validateReplaceTextArguments(args) {
    if (
        typeof args.path !== 'string' ||
        !args.path.trim() ||
        path.isAbsolute(args.path) ||
        path.win32.isAbsolute(args.path)
    ) {
        return {
            success: false,
            message: 'O caminho do arquivo deve ser um caminho relativo não vazio.'
        };
    }

    if (
        typeof args.old_text !== 'string' ||
        !args.old_text.trim()
    ) {
        return {
            success: false,
            message: 'O trecho original deve ser um texto não vazio.'
        };
    }

    if (typeof args.new_text !== 'string') {
        return {
            success: false,
            message: 'O novo trecho deve ser um texto.'
        };
    }

    return {
        success: true
    };
}

// Interpretar e classificar uma resposta do modelo
function interpretOperation(response) {

    // Validar a estrutura da resposta
    const validation = validateResponse(response);

    if (!validation.success) {
        return {
            success: false,
            message: 'Resposta fora do protocolo.',
            errors: validation.errors
        };
    }

    // Resposta final não solicita uma operação
    if (validation.type === 'final') {
        return {
            success: true,
            type: 'final',
            message: response.message
        };
    }

    // Verificar se a operação é reconhecida
    const classification = OPERATIONS[response.name];

    if (!classification) {
        return {
            success: false,
            message: `Operação desconhecida: ${response.name}.`
        };
    }

    // Verificar compatibilidade entre tipo e classificação
    if (
        validation.type === 'tool_call' &&
        classification !== 'automatic'
    ) {
        return {
            success: false,
            message: 'A operação exige aprovação e não pode ser solicitada como tool_call.'
        };
    }

    if (
        validation.type === 'proposal' &&
        classification !== 'approval_required'
    ) {
        return {
            success: false,
            message: 'A operação automática não deve ser apresentada como proposta.'
        };
    }

    // Validar argumentos específicos de criação de arquivo
    if (response.name === 'create_file') {
        const argumentsValidation = validateCreateFileArguments(
            response.arguments
        );

        if (!argumentsValidation.success) {
            return argumentsValidation;
        }
    }
    if (response.name === 'replace_text') {
        const argumentsValidation = validateReplaceTextArguments(
            response.arguments
        );

        if (!argumentsValidation.success) {
            return argumentsValidation;
        }
    }

    // Retornar operação interpretada, sem executá-la
    return {
        success: true,
        type: validation.type,
        name: response.name,
        classification,
        arguments: response.arguments,
        ...(validation.type === 'proposal'
            ? { message: response.message }
            : {})
    };
}

module.exports = {
    interpretOperation
};
