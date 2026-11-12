'use strict';

const fs = require('node:fs');

// Ler arquivo EAP.md
function readEAP(filePath) {
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
            message: `Erro ao ler EAP: ${error.message}`
        };
    }
}

// Identificar nome do projeto
function parseProjectName(content) {
    if (typeof content !== 'string' || !content.trim()) {
        return {
            success: false,
            message: 'O conteúdo da EAP está vazio ou é inválido.'
        };
    }

    const match = content.match(/^# (.+)$/m);

    if (!match) {
        return {
            success: false,
            message: 'Título principal do projeto não encontrado.'
        };
    }

    return {
        success: true,
        name: match[1].trim()
    };
}

// Identificar etapas da EAP
function parsePhases(content) {
    if (typeof content !== 'string' || !content.trim()) {
        return {
            success: false,
            message: 'O conteúdo da EAP está vazio ou é inválido.'
        };
    }

    const lines = content.split(/\r?\n/);
    const phases = [];

    for (const line of lines) {
        const match = line.match(/^## (P\d{2}) — (.+)$/);

        if (match) {
            phases.push({
                code: match[1],
                title: match[2].trim(),
                position: phases.length + 1
            });
        }
    }

    return {
        success: true,
        phases
    };
}

// Identificar tarefas das etapas
function parseTasks(content) {
    if (typeof content !== 'string' || !content.trim()) {
        return {
            success: false,
            message: 'O conteúdo da EAP está vazio ou é inválido.'
        };
    }

    const lines = content.split(/\r?\n/);
    const tasks = [];
    const errors = [];

    let currentPhase = null;
    let position = 0;

    for (const line of lines) {
        const phaseMatch = line.match(/^## (P\d{2}) — (.+)$/);

        if (phaseMatch) {
            currentPhase = phaseMatch[1];
            position = 0;
            continue;
        }

        // Identificar linhas de tabela que começam com código de tarefa
        if (/^\|\s*T\d{3}\s*\|/.test(line)) {

            if (!currentPhase) {
                errors.push(
                    `Tarefa encontrada fora de uma etapa: ${line.trim()}`
                );
                continue;
            }

            const taskMatch = line.match(
                /^\|\s*(T\d{3})\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/
            );

            if (!taskMatch) {
                errors.push(
                    `Linha de tarefa malformada: ${line.trim()}`
                );
                continue;
            }

            position++;

            tasks.push({
                code: taskMatch[1],
                title: taskMatch[2].trim(),
                expectedResult: taskMatch[3].trim(),
                phaseCode: currentPhase,
                position
            });
        }
    }

    return {
        success: errors.length === 0,
        tasks,
        errors
    };
}

// Validar estrutura e identificadores da EAP
function validateEAP(content) {
    const errors = [];

    const project = parseProjectName(content);
    const phasesResult = parsePhases(content);
    const tasksResult = parseTasks(content);

    if (!project.success) {
        errors.push(project.message);
    }

    if (!phasesResult.success) {
        errors.push(phasesResult.message);
    }

    if (!tasksResult.success) {
        if (tasksResult.errors) {
            errors.push(...tasksResult.errors);
        } else {
            errors.push(tasksResult.message);
        }
    }

    if (errors.length > 0) {
        return {
            success: false,
            errors
        };
    }

    // Verificar etapas duplicadas
    const phaseCodes = phasesResult.phases.map(phase => phase.code);

    const duplicatedPhases = phaseCodes.filter(
        (code, index) => phaseCodes.indexOf(code) !== index
    );

    if (duplicatedPhases.length > 0) {
        errors.push(
            `Identificadores de etapas duplicados: ${[...new Set(duplicatedPhases)].join(', ')}`
        );
    }

    // Verificar tarefas duplicadas
    const taskCodes = tasksResult.tasks.map(task => task.code);

    const duplicatedTasks = taskCodes.filter(
        (code, index) => taskCodes.indexOf(code) !== index
    );

    if (duplicatedTasks.length > 0) {
        errors.push(
            `Identificadores de tarefas duplicados: ${[...new Set(duplicatedTasks)].join(', ')}`
        );
    }

    if (phasesResult.phases.length === 0) {
        errors.push('Nenhuma etapa foi identificada.');
    }

    if (tasksResult.tasks.length === 0) {
        errors.push('Nenhuma tarefa foi identificada.');
    }

    return {
        success: errors.length === 0,
        errors
    };
}

// Interpretar EAP completa
function parseEAP(content) {
    const validation = validateEAP(content);

    if (!validation.success) {
        return {
            success: false,
            errors: validation.errors
        };
    }

    const project = parseProjectName(content);
    const phasesResult = parsePhases(content);
    const tasksResult = parseTasks(content);

    const phases = phasesResult.phases.map(phase => ({
        ...phase,
        tasks: tasksResult.tasks.filter(
            task => task.phaseCode === phase.code
        )
    }));

    return {
        success: true,
        project: {
            name: project.name
        },
        phases
    };
}

module.exports = {
    readEAP,
    parseProjectName,
    parsePhases,
    parseTasks,
    validateEAP,
    parseEAP
};
