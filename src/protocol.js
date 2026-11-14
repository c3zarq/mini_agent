'use strict';

// Verificar se o valor é um objeto válido para arguments
function isArgumentsObject(value) {
    return (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
    );
}

// Validar uma resposta conforme o protocolo JSON
function validateResponse(response) {
    const errors = [];

    if (
        response === null ||
        typeof response !== 'object' ||
        Array.isArray(response)
    ) {
        return {
            success: false,
            errors: ['A resposta deve ser um objeto JSON.']
        };
    }

    switch (response.type) {
        case 'tool_call':
            if (
                typeof response.name !== 'string' ||
                !response.name.trim()
            ) {
                errors.push('O campo name deve ser um texto não vazio.');
            }

            if (!isArgumentsObject(response.arguments)) {
                errors.push('O campo arguments deve ser um objeto.');
            }
            break;

        case 'proposal':
            if (
                typeof response.name !== 'string' ||
                !response.name.trim()
            ) {
                errors.push('O campo name deve ser um texto não vazio.');
            }

            if (!isArgumentsObject(response.arguments)) {
                errors.push('O campo arguments deve ser um objeto.');
            }

            if (
                typeof response.message !== 'string' ||
                !response.message.trim()
            ) {
                errors.push('O campo message deve ser um texto não vazio.');
            }
            break;

        case 'final':
            if (
                typeof response.message !== 'string' ||
                !response.message.trim()
            ) {
                errors.push('O campo message deve ser um texto não vazio.');
            }
            break;

        default:
            errors.push('Tipo de resposta desconhecido.');
    }

    if (errors.length > 0) {
        return {
            success: false,
            errors
        };
    }

    return {
        success: true,
        type: response.type
    };
}

module.exports = {
    validateResponse
};
