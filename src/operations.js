'use strict';

const { validateResponse } = require('./protocol');

// Operações reconhecidas e suas respectivas classificações
const OPERATIONS = {
    list_files: 'automatic',
    search_files: 'automatic',
    read_file: 'automatic',
    create_file: 'approval_required',
    replace_text: 'approval_required'
};

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
