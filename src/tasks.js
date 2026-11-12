'use strict';

const fs = require('node:fs');

// Ler documento individual de tarefa
function readTask(filePath) {
    if (typeof filePath !== 'string' || !filePath.trim()) {
        return {
            success: false,
            message: 'O caminho do arquivo é obrigatório.'
        };
    }

    try {
        const content = fs.readFileSync(filePath, 'utf8');

        return {
            success: true,
            content
        };

    } catch (error) {
        return {
            success: false,
            message: `Erro ao ler tarefa: ${error.message}`
        };
    }
}

// Identificar código e título da tarefa
function parseTaskHeader(content) {
    if (typeof content !== 'string' || !content.trim()) {
        return {
            success: false,
            message: 'O conteúdo da tarefa está vazio ou é inválido.'
        };
    }

    const firstLine = content
        .split(/\r?\n/)
        .find(line => line.trim());

    const match = firstLine.match(/^# (T\d{3}) — (.+)$/);

    if (!match) {
        return {
            success: false,
            message: 'Cabeçalho da tarefa inválido ou não encontrado.'
        };
    }

    return {
        success: true,
        code: match[1],
        title: match[2].trim()
    };
}

// Identificar etapa e status da tarefa
function parseTaskMetadata(content) {
    if (typeof content !== 'string' || !content.trim()) {
        return {
            success: false,
            message: 'O conteúdo da tarefa está vazio ou é inválido.'
        };
    }

    const phaseMatch = content.match(
        /^\*\*Etapa:\*\*\s*(P\d{2}) — (.+)$/m
    );

    const statusMatch = content.match(
        /^\*\*Status:\*\*\s*(.+)$/m
    );

    if (!phaseMatch) {
        return {
            success: false,
            message: 'Identificação da etapa não encontrada ou inválida.'
        };
    }

    if (!statusMatch) {
        return {
            success: false,
            message: 'Status da tarefa não encontrado.'
        };
    }

    return {
        success: true,
        phaseCode: phaseMatch[1],
        phaseTitle: phaseMatch[2].trim(),
        status: statusMatch[1].trim()
    };
}

// Interpretar seções do documento
function parseTaskSections(content) {
    if (typeof content !== 'string' || !content.trim()) {
        return {
            success: false,
            message: 'O conteúdo da tarefa está vazio ou é inválido.'
        };
    }

    const lines = content.split(/\r?\n/);
    const sections = {};
    let currentSection = null;

    for (const line of lines) {
        const headingMatch = line.match(/^## (.+)$/);

        if (headingMatch) {
            currentSection = headingMatch[1].trim();
            sections[currentSection] = [];
            continue;
        }

        if (currentSection) {
            sections[currentSection].push(line);
        }
    }

    for (const section in sections) {
        sections[section] = sections[section].join('\n').trim();
    }

    return {
        success: true,
        sections
    };
}

// Validar estrutura do documento de tarefa
function validateTask(content) {
    const header = parseTaskHeader(content);
    const metadata = parseTaskMetadata(content);
    const sectionsResult = parseTaskSections(content);

    const errors = [];

    if (!header.success) {
        errors.push(header.message);
    }

    if (!metadata.success) {
        errors.push(metadata.message);
    }

    if (!sectionsResult.success) {
        errors.push(sectionsResult.message);
    }

    if (errors.length > 0) {
        return {
            success: false,
            errors
        };
    }

    const requiredSections = [
        'Objetivo',
        'Atividades',
        'Critérios de conclusão'
    ];

    for (const section of requiredSections) {
        if (!sectionsResult.sections[section]) {
            errors.push(`Seção obrigatória ausente ou vazia: ${section}`);
        }
    }

    return {
        success: errors.length === 0,
        errors
    };
}

// Interpretar documento completo de tarefa
function parseTask(content) {
    const validation = validateTask(content);

    if (!validation.success) {
        return {
            success: false,
            errors: validation.errors
        };
    }

    const header = parseTaskHeader(content);
    const metadata = parseTaskMetadata(content);
    const sections = parseTaskSections(content);

    return {
        success: true,
        task: {
            code: header.code,
            title: header.title,
            phaseCode: metadata.phaseCode,
            phaseTitle: metadata.phaseTitle,
            status: metadata.status,
            sections: sections.sections
        }
    };
}

module.exports = {
    readTask,
    parseTaskHeader,
    parseTaskMetadata,
    parseTaskSections,
    validateTask,
    parseTask
};
