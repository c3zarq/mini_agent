'use strict';

const readline = require('node:readline');

// Selecionar um modelo disponível no Ollama
async function selectModel({
    listModels,
    input = process.stdin,
    output = process.stdout,
    createInterface = readline.createInterface
} = {}) {
    if (typeof listModels !== 'function') {
        return {
            success: false,
            message: 'Função de listagem de modelos inválida.'
        };
    }

    let rl;

    try {
        // Consultar modelos disponíveis
        const result = await listModels();

        if (!result || !result.success) {
            return {
                success: false,
                message: result?.message || 'Falha ao consultar modelos.'
            };
        }

        if (
            !Array.isArray(result.models) ||
            !result.models.every(model =>
                model &&
                typeof model.name === 'string' &&
                model.name.trim()
            )
        ) {
            return {
                success: false,
                message: 'Lista de modelos inválida.'
            };
        }

        if (result.models.length === 0) {
            return {
                success: false,
                message: 'Nenhum modelo disponível no Ollama.'
            };
        }

        // Criar interface de entrada
        rl = createInterface({
            input,
            output,
            terminal: Boolean(input.isTTY && output.isTTY)
        });

        output.write('Modelos disponíveis:\n');

        result.models.forEach((model, index) => {
            output.write(`${index + 1}. ${model.name}\n`);
        });

        output.write('\n');

        // Receber e validar a seleção
        for await (const line of rl) {
            const selection = line.trim();

            const selectedIndex = /^\d+$/.test(selection)
                ? Number(selection) - 1
                : -1;

            if (
                selectedIndex < 0 ||
                selectedIndex >= result.models.length
            ) {
                output.write('Seleção inválida. Tente novamente.\n');
                output.write('Escolha o número do modelo: ');
                continue;
            }

            return {
                success: true,
                model: result.models[selectedIndex].name
            };
        }

        return {
            success: false,
            message: 'Seleção de modelo encerrada sem escolha.'
        };

    } catch (error) {
        return {
            success: false,
            message: `Falha na seleção do modelo: ${error.message}`
        };

    } finally {
        if (rl) {
            rl.close();
        }
    }
}

module.exports = {
    selectModel
};
