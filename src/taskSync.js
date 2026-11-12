'use strict';

const { db, getProject } = require('./database');

// Validar os dados necessários para sincronização
function validateSyncData(projectId, eap) {
    if (!Number.isInteger(projectId) || projectId <= 0) {
        return {
            success: false,
            message: 'Identificador de projeto inválido.'
        };
    }

    if (!eap || eap.success !== true || !Array.isArray(eap.phases)) {
        return {
            success: false,
            message: 'Estrutura da EAP inválida.'
        };
    }

    const projectResult = getProject(projectId);

    if (!projectResult.success || !projectResult.project) {
        return {
            success: false,
            message: 'Projeto não encontrado no banco de dados.'
        };
    }

    return {
        success: true,
        project: projectResult.project
    };
}

// Organizar tarefas da EAP em uma lista única
function flattenEAPTasks(eap) {
    const tasks = [];

    for (const phase of eap.phases) {
        for (const task of phase.tasks) {
            tasks.push({
                code: task.code,
                phaseCode: phase.code,
                title: task.title,
                expectedResult: task.expectedResult,
                position: task.position
            });
        }
    }

    return tasks;
}

// Cadastrar ou atualizar uma tarefa no SQLite
function saveTask(projectId, task) {
        if (
		!Number.isInteger(projectId) ||
		projectId <= 0 ||
		!task ||
		typeof task.code !== 'string' ||
		!task.code.trim() ||
		typeof task.phaseCode !== 'string' ||
		!task.phaseCode.trim() ||
		typeof task.title !== 'string' ||
		!task.title.trim() ||
		typeof task.expectedResult !== 'string' ||
		!task.expectedResult.trim() ||
		!Number.isInteger(task.position) ||
		task.position <= 0
	    ) {
        return {
            success: false,
            message: 'Dados da tarefa inválidos.'
        };
    }
    try {
        const existing = db.prepare(`
            SELECT id, status
            FROM tasks
            WHERE project_id = ? AND code = ?
        `).get(projectId, task.code);

        if (!existing) {
            const result = db.prepare(`
                INSERT INTO tasks (
                    project_id,
                    code,
                    phase_code,
                    title,
                    expected_result,
                    position
                )
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(
                projectId,
                task.code,
                task.phaseCode,
                task.title,
                task.expectedResult,
                task.position
            );

            return {
                success: true,
                action: 'created',
                id: Number(result.lastInsertRowid)
            };
        }

        db.prepare(`
            UPDATE tasks
            SET
                phase_code = ?,
                title = ?,
                expected_result = ?,
                position = ?,
                is_active = 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            task.phaseCode,
            task.title,
            task.expectedResult,
            task.position,
            existing.id
        );

        return {
            success: true,
            action: 'updated',
            id: existing.id
        };

    } catch (error) {
        return {
            success: false,
            message: `Erro ao salvar tarefa: ${error.message}`
        };
    }
}

// Sincronizar tarefas da EAP com o SQLite
function syncTasks(projectId, eap) {
    const validation = validateSyncData(projectId, eap);

    if (!validation.success) {
        return validation;
    }

    if (
        !eap.phases.every(phase =>
            phase &&
            typeof phase.code === 'string' &&
            Array.isArray(phase.tasks)
        )
    ) {
        return {
            success: false,
            message: 'Estrutura das etapas da EAP inválida.'
        };
    }

    if (!validation.success) {
        return validation;
    }

    const tasks = flattenEAPTasks(eap);

    try {
        const synchronize = db.transaction(() => {
            let created = 0;
            let updated = 0;

            // Cadastrar ou atualizar tarefas da EAP
            for (const task of tasks) {
                const result = saveTask(projectId, task);

                if (!result.success) {
                    throw new Error(result.message);
                }

                if (result.action === 'created') {
                    created++;
                } else {
                    updated++;
                }
            }

            // Desativar tarefas que não existem mais na EAP
            const taskCodes = tasks.map(task => task.code);

            if (taskCodes.length > 0) {
                const placeholders = taskCodes.map(() => '?').join(', ');

                db.prepare(`
                    UPDATE tasks
                    SET
                        is_active = 0,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE project_id = ?
                    AND code NOT IN (${placeholders})
                    AND is_active = 1
                `).run(projectId, ...taskCodes);

            } else {
                db.prepare(`
                    UPDATE tasks
                    SET
                        is_active = 0,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE project_id = ?
                    AND is_active = 1
                `).run(projectId);
            }

            return {
                success: true,
                created,
                updated,
                total: tasks.length
            };
        });

        return synchronize();

    } catch (error) {
        return {
            success: false,
            message: `Erro ao sincronizar tarefas: ${error.message}`
        };
    }
}

module.exports = {
    validateSyncData,
    flattenEAPTasks,
    saveTask,
    syncTasks
};
