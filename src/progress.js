'use strict';

const VALID_STATUSES = [
    'pending',
    'in_progress',
    'completed',
    'blocked'
];

// Calcular o progresso geral e por etapa
function calculateProgress(tasks, phases) {
    if (!Array.isArray(tasks)) {
        return {
            success: false,
            message: 'A lista de tarefas é inválida.'
        };
    }

    if (!Array.isArray(phases)) {
        return {
            success: false,
            message: 'A lista de etapas é inválida.'
        };
    }

    const phaseMap = new Map();

    // Preparar as etapas, inclusive as que não possuem tarefas
    for (const phase of phases) {
        if (
            !phase ||
            typeof phase.code !== 'string' ||
            !phase.code.trim() ||
            typeof phase.title !== 'string' ||
            !phase.title.trim()
        ) {
            return {
                success: false,
                message: 'Estrutura de etapa inválida.'
            };
        }

        if (phaseMap.has(phase.code)) {
            return {
                success: false,
                message: `Etapa duplicada: ${phase.code}.`
            };
        }

        phaseMap.set(phase.code, {
            code: phase.code,
            title: phase.title,
            total: 0,
            completed: 0
        });
    }

    let total = 0;
    let completed = 0;

    // Contabilizar somente tarefas ativas
    for (const task of tasks) {
        if (
            !task ||
            ![0, 1].includes(task.is_active)
        ) {
            return {
                success: false,
                message: 'Estrutura ou situação de tarefa inválida.'
            };
        }

        if (task.is_active === 0) {
            continue;
        }

        if (
            typeof task.phase_code !== 'string' ||
            !task.phase_code.trim() ||
            !VALID_STATUSES.includes(task.status)
        ) {
            return {
                success: false,
                message: 'Etapa ou status de tarefa inválido.'
            };
        }

        // Preservar tarefas vinculadas a etapas não encontradas na EAP
        if (!phaseMap.has(task.phase_code)) {
            phaseMap.set(task.phase_code, {
                code: task.phase_code,
                title: 'Etapa não encontrada na EAP',
                total: 0,
                completed: 0
            });
        }

        const phase = phaseMap.get(task.phase_code);

        phase.total++;
        total++;

        if (task.status === 'completed') {
            phase.completed++;
            completed++;
        }
    }

    // Calcular percentual com uma casa decimal
    function percentage(done, count) {
        if (count === 0) {
            return 0;
        }

        return Math.round((done / count) * 1000) / 10;
    }

    const phaseResults = Array.from(phaseMap.values()).map(phase => ({
        ...phase,
        percentage: percentage(
            phase.completed,
            phase.total
        )
    }));

    return {
        success: true,
        overall: {
            total,
            completed,
            percentage: percentage(completed, total)
        },
        phases: phaseResults
    };
}

module.exports = {
    calculateProgress
};
