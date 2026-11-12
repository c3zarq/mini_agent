'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { createProject } = require('./database');

// Cadastrar projeto
function registerProject(name, rootPath) {
    if (
        typeof name !== 'string' ||
        !name.trim() ||
        typeof rootPath !== 'string' ||
        !rootPath.trim()
    ) {
        return {
            success: false,
            message: 'Nome e caminho do projeto são obrigatórios.'
        };
    }

    try {
        const absolutePath = path.resolve(rootPath.trim());
        const stats = fs.statSync(absolutePath);

        if (!stats.isDirectory()) {
            return {
                success: false,
                message: 'O caminho informado não corresponde a um diretório.'
            };
        }

        return createProject(name.trim(), absolutePath);

    } catch (error) {
        if (error.code === 'ENOENT') {
            return {
                success: false,
                message: 'O diretório informado não existe.'
            };
        }

        return {
            success: false,
            message: `Erro ao cadastrar projeto: ${error.message}`
        };
    }
}

module.exports = {
    registerProject
};
