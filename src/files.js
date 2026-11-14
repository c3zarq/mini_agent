'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Verificar se um caminho pertence ao diretório autorizado
function validatePath(projectRoot, requestedPath) {
    if (
        typeof projectRoot !== 'string' ||
        !projectRoot.trim() ||
        typeof requestedPath !== 'string' ||
        !requestedPath.trim()
    ) {
        return {
            success: false,
            message: 'Diretório raiz e caminho solicitado são obrigatórios.'
        };
    }

    try {
        // Obter o caminho real do diretório autorizado
        const realRoot = fs.realpathSync(projectRoot);

        if (!fs.statSync(realRoot).isDirectory()) {
            return {
                success: false,
                message: 'O diretório autorizado é inválido.'
            };
        }

        // Resolver o caminho solicitado
        const absolutePath = path.resolve(realRoot, requestedPath);

        // Resolver links simbólicos e obter o caminho físico real
        const realPath = fs.realpathSync(absolutePath);

        // Verificar se o caminho está dentro do diretório autorizado
        const relativePath = path.relative(realRoot, realPath);

        if (
            relativePath === '..' ||
            relativePath.startsWith(`..${path.sep}`) ||
            path.isAbsolute(relativePath)
        ) {
            return {
                success: false,
                message: 'Acesso negado: caminho fora do diretório autorizado.'
            };
        }

        return {
            success: true,
            path: realPath
        };

    } catch (error) {
        return {
            success: false,
            message: `Não foi possível validar o caminho: ${error.message}`
        };
    }
}

// Listar arquivos e diretórios de um caminho autorizado
function listFiles(projectRoot, requestedPath = '.') {
    // Validar o caminho solicitado
    const validation = validatePath(projectRoot, requestedPath);

    if (!validation.success) {
        return validation;
    }

    try {
        // Verificar se o caminho corresponde a um diretório
        const stats = fs.statSync(validation.path);

        if (!stats.isDirectory()) {
            return {
                success: false,
                message: 'O caminho informado não corresponde a um diretório.'
            };
        }

        // Obter os itens do diretório sem percorrer subdiretórios
        const entries = fs.readdirSync(validation.path, {
            withFileTypes: true
        });

        const files = entries.map(entry => ({
            name: entry.name,
            path: path.join(validation.path, entry.name),
            type: entry.isDirectory() ? 'directory' : 'file'
        }));

        return {
            success: true,
            path: validation.path,
            files
        };

    } catch (error) {
        return {
            success: false,
            message: `Erro ao listar diretório: ${error.message}`
        };
    }
}

// Pesquisar termos nos arquivos do projeto autorizado
function searchFiles(projectRoot, searchTerm, requestedPath = '.') {
    if (typeof searchTerm !== 'string' || !searchTerm.trim()) {
        return {
            success: false,
            message: 'O termo de pesquisa é obrigatório.'
        };
    }

    // Validar o diretório inicial
    const validation = validatePath(projectRoot, requestedPath);

    if (!validation.success) {
        return validation;
    }

    try {
        if (!fs.statSync(validation.path).isDirectory()) {
            return {
                success: false,
                message: 'O caminho informado não corresponde a um diretório.'
            };
        }
    } catch (error) {
        return {
            success: false,
            message: `Erro ao acessar diretório: ${error.message}`
        };
    }

    const results = [];
    const errors = [];
    const term = searchTerm.trim();

    // Percorrer diretórios e pesquisar nos arquivos
    function searchDirectory(directory) {
        let entries;

        try {
            entries = fs.readdirSync(directory, {
                withFileTypes: true
            });
        } catch (error) {
            errors.push({
                path: directory,
                message: error.message
            });
            return;
        }

        for (const entry of entries) {
            const entryPath = path.join(directory, entry.name);

            // Ignorar links simbólicos
            if (entry.isSymbolicLink()) {
                continue;
            }

            // Pesquisar recursivamente nos subdiretórios
            if (entry.isDirectory()) {
                const validation = validatePath(projectRoot, entryPath);

                if (validation.success) {
                    searchDirectory(validation.path);
                }

                continue;
            }

            // Processar somente arquivos regulares
            if (!entry.isFile()) {
                continue;
            }

            const validation = validatePath(projectRoot, entryPath);

            if (!validation.success) {
                continue;
            }

            try {
                const content = fs.readFileSync(validation.path);

                // Ignorar arquivos binários
                if (content.includes(0)) {
                    continue;
                }

                const lines = content.toString('utf8').split(/\r?\n/);

                lines.forEach((line, index) => {
                    if (line.includes(term)) {
                        results.push({
                            path: validation.path,
                            lineNumber: index + 1,
                            line: line.trim()
                        });
                    }
                });

            } catch (error) {
                errors.push({
                    path: validation.path,
                    message: error.message
                });
            }
        }
    }

    searchDirectory(validation.path);

    return {
        success: true,
        term,
        results,
        errors
    };
}

// Ler o conteúdo de um arquivo do projeto autorizado
function readFile(projectRoot, requestedPath) {
    // Validar o caminho solicitado
    const validation = validatePath(projectRoot, requestedPath);

    if (!validation.success) {
        return validation;
    }

    try {
        // Verificar se o caminho corresponde a um arquivo
        const stats = fs.statSync(validation.path);

        if (!stats.isFile()) {
            return {
                success: false,
                message: 'O caminho informado não corresponde a um arquivo.'
            };
        }

        // Ler o conteúdo do arquivo como texto UTF-8
        const content = fs.readFileSync(validation.path, 'utf8');

        return {
            success: true,
            path: validation.path,
            content
        };

    } catch (error) {
        return {
            success: false,
            message: `Erro ao ler arquivo: ${error.message}`
        };
    }
}

// Criar um arquivo dentro do projeto autorizado
function createFile(projectRoot, requestedPath, content) {
    if (
        typeof requestedPath !== 'string' ||
        !requestedPath.trim() ||
        path.isAbsolute(requestedPath) ||
        path.win32.isAbsolute(requestedPath) ||
        typeof content !== 'string'
    ) {
        return {
            success: false,
            message: 'Caminho ou conteúdo inválido para criação do arquivo.'
        };
    }

    // Validar o diretório pai
    const parentPath = path.dirname(requestedPath);
    const parentValidation = validatePath(projectRoot, parentPath);

    if (!parentValidation.success) {
        return parentValidation;
    }

    try {
        if (!fs.statSync(parentValidation.path).isDirectory()) {
            return {
                success: false,
                message: 'O diretório de destino não é válido.'
            };
        }

        const destination = path.join(
            parentValidation.path,
            path.basename(requestedPath)
        );

        // Criar exclusivamente se o destino não existir
        const descriptor = fs.openSync(destination, 'wx');

        try {
            fs.writeFileSync(descriptor, content, 'utf8');
        } finally {
            fs.closeSync(descriptor);
        }

        return {
            success: true,
            path: destination,
            message: 'Arquivo criado com sucesso.'
        };

    } catch (error) {
        return {
            success: false,
            message: `Erro ao criar arquivo: ${error.message}`
        };
    }
}

// Gravar alterações em um arquivo existente do projeto autorizado
function writeFile(projectRoot, requestedPath, content, expectedContent) {
    if (
        typeof requestedPath !== 'string' ||
        !requestedPath.trim() ||
        path.isAbsolute(requestedPath) ||
        path.win32.isAbsolute(requestedPath)
    ) {
        return {
            success: false,
            message: 'O caminho deve ser relativo ao projeto.'
        };
    }
    if (
        typeof content !== 'string' ||
        typeof expectedContent !== 'string'
    ) {
        return {
            success: false,
            message: 'Conteúdo inválido para gravação.'
        };
    }

    // Validar o caminho solicitado
    const validation = validatePath(projectRoot, requestedPath);

    if (!validation.success) {
        return validation;
    }

    let descriptor;

    try {
        // Abrir o arquivo existente para leitura e escrita
        descriptor = fs.openSync(validation.path, 'r+');

        // Confirmar que o destino é um arquivo regular
        if (!fs.fstatSync(descriptor).isFile()) {
            return {
                success: false,
                message: 'O destino não corresponde a um arquivo regular.'
            };
        }

        // Conferir se o conteúdo continua igual ao esperado
        const currentContent = fs.readFileSync(
            descriptor,
            'utf8'
        );

        if (currentContent !== expectedContent) {
            return {
                success: false,
                message: 'O arquivo foi modificado desde a validação da proposta.'
            };
        }

        // Substituir o conteúdo do arquivo
        fs.ftruncateSync(descriptor, 0);

        fs.writeSync(
            descriptor,
            content,
            0,
            'utf8'
        );

        fs.ftruncateSync(
            descriptor,
            Buffer.byteLength(content, 'utf8')
        );

        return {
            success: true,
            path: validation.path,
            message: 'Arquivo atualizado com sucesso.'
        };

    } catch (error) {
        return {
            success: false,
            message: `Erro ao gravar arquivo: ${error.message}`
        };

    } finally {
        if (descriptor !== undefined) {
            fs.closeSync(descriptor);
        }
    }
}

module.exports = {
    validatePath,
    listFiles,
    searchFiles,
    readFile,
    createFile,
    writeFile
};
