'use strict';

const database = require('./database');
const files = require('./files');

// Criar executor de ferramentas com dependências configuráveis
function createToolExecutor({
    getProject = database.getProject,
    listFiles = files.listFiles,
    searchFiles = files.searchFiles,
    readFile = files.readFile
} = {}) {

    // Executar uma operação automática de leitura
    function executeTool(operation, projectId) {

        // Validar a operação recebida
        if (
            !operation ||
            typeof operation !== 'object' ||
            Array.isArray(operation) ||
            operation.success !== true
        ) {
            return {
                success: false,
                message: 'Operação inválida ou não interpretada.'
            };
        }

        // Aceitar somente solicitações de ferramentas
        if (operation.type !== 'tool_call') {
            return {
                success: false,
                message: 'Somente solicitações tool_call podem ser executadas.'
            };
        }

        // Aceitar somente operações automáticas
        if (operation.classification !== 'automatic') {
            return {
                success: false,
                message: 'A operação não está classificada como automática.'
            };
        }

        // Validar os argumentos
        const args = operation.arguments;

        if (
            !args ||
            typeof args !== 'object' ||
            Array.isArray(args)
        ) {
            return {
                success: false,
                message: 'Argumentos da operação inválidos.'
            };
        }

        // Verificar se a ferramenta é reconhecida
        const allowedTools = [
            'list_files',
            'search_files',
            'read_file'
        ];

        if (!allowedTools.includes(operation.name)) {
            return {
                success: false,
                message: `Ferramenta não reconhecida: ${operation.name}.`
            };
        }

        // Validar o identificador do projeto
        if (!Number.isInteger(projectId) || projectId <= 0) {
            return {
                success: false,
                message: 'Identificador de projeto inválido.'
            };
        }

        try {
            // Recuperar o projeto cadastrado
            const projectResult = getProject(projectId);

            if (!projectResult.success) {
                return projectResult;
            }

            if (!projectResult.project) {
                return {
                    success: false,
                    message: 'Projeto não encontrado.'
                };
            }

            // Obter o diretório raiz autorizado
            const rootPath = projectResult.project.root_path;

            if (typeof rootPath !== 'string' || !rootPath.trim()) {
                return {
                    success: false,
                    message: 'Diretório raiz do projeto inválido.'
                };
            }

            // Executar a ferramenta correspondente
            switch (operation.name) {

                case 'list_files':
                    return listFiles(
                        rootPath,
                        args.path === undefined ? '.' : args.path
                    );

                case 'search_files':
                    return searchFiles(
                        rootPath,
                        args.term,
                        args.path === undefined ? '.' : args.path
                    );

                case 'read_file':
                    return readFile(
                        rootPath,
                        args.path
                    );

                default:
                    return {
                        success: false,
                        message: 'Operação não permitida.'
                    };
            }

        } catch (error) {
            return {
                success: false,
                message: `Erro ao executar ferramenta: ${error.message}`
            };
        }
    }

    return executeTool;
}

// Executor padrão
const executeTool = createToolExecutor();

module.exports = {
    createToolExecutor,
    executeTool
};
