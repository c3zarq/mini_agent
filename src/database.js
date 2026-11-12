'use strict';

const Database = require('better-sqlite3');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

// Diretório de armazenamento
const DATA_DIR = path.join(os.homedir(), '.mini-agent');

// Arquivo do banco de dados
const DB_PATH = path.join(DATA_DIR, 'agent.db');

// Criar diretório caso não exista
fs.mkdirSync(DATA_DIR, { recursive: true });

// Abrir conexão com SQLite
const db = new Database(DB_PATH);

// Habilitar chaves estrangeiras
db.pragma('foreign_keys = ON');

// Criar estrutura das tabelas
db.exec(`

    CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        root_path TEXT NOT NULL UNIQUE,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        task_code TEXT,
        model TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (project_id)
            REFERENCES projects(id)
            ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (session_id)
            REFERENCES sessions(id)
            ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS operations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        input TEXT,
        output TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (session_id)
            REFERENCES sessions(id)
            ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        code TEXT NOT NULL,
        phase_code TEXT NOT NULL,
        title TEXT NOT NULL,
        expected_result TEXT NOT NULL,
        position INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

        UNIQUE (project_id, code),

        CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),

        FOREIGN KEY (project_id)
            REFERENCES projects(id)
            ON DELETE CASCADE
    );

`);

// Cadastrar projeto
function createProject(name, rootPath) {
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
        const result = db.prepare(`
            INSERT INTO projects (name, root_path)
            VALUES (?, ?)
        `).run(name.trim(), rootPath.trim());

        return {
            success: true,
            project: getProject(Number(result.lastInsertRowid)).project
        };

    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return {
                success: false,
                message: 'Já existe um projeto cadastrado com esse caminho.'
            };
        }

        return {
            success: false,
            message: `Erro ao cadastrar projeto: ${error.message}`
        };
    }
}

// Listar projetos
function listProjects() {
    try {
        const projects = db.prepare(`
            SELECT * FROM projects
            ORDER BY id
        `).all();

        return {
            success: true,
            projects
        };

    } catch (error) {
        return {
            success: false,
            message: `Erro ao listar projetos: ${error.message}`
        };
    }
}

// Consultar projeto pelo identificador
function getProject(id) {
    if (!Number.isInteger(id) || id <= 0) {
        return {
            success: false,
            message: 'Identificador de projeto inválido.'
        };
    }

    try {
        const project = db.prepare(`
            SELECT * FROM projects
            WHERE id = ?
        `).get(id);

        return {
            success: true,
            project: project || null
        };

    } catch (error) {
        return {
            success: false,
            message: `Erro ao consultar projeto: ${error.message}`
        };
    }
}

// Criar sessão
function createSession(projectId, model) {
    if (
        !Number.isInteger(projectId) ||
        projectId <= 0 ||
        typeof model !== 'string' ||
        !model.trim()
    ) {
        return {
            success: false,
            message: 'Dados da sessão inválidos.'
        };
    }

    try {
        const project = getProject(projectId);

        if (!project.success || !project.project) {
            return {
                success: false,
                message: 'Projeto não encontrado.'
            };
        }

        const result = db.prepare(`
            INSERT INTO sessions (project_id, model)
            VALUES (?, ?)
        `).run(projectId, model.trim());

        const session = db.prepare(`
            SELECT * FROM sessions WHERE id = ?
        `).get(Number(result.lastInsertRowid));

        return {
            success: true,
            session
        };

    } catch (error) {
        return {
            success: false,
            message: `Erro ao criar sessão: ${error.message}`
        };
    }
}

// Consultar sessão
function getSession(id) {
    if (!Number.isInteger(id) || id <= 0) {
        return {
            success: false,
            message: 'Identificador de sessão inválido.'
        };
    }

    try {
        const session = db.prepare(`
            SELECT * FROM sessions
            WHERE id = ?
        `).get(id);

        return {
            success: true,
            session: session || null
        };

    } catch (error) {
        return {
            success: false,
            message: `Erro ao consultar sessão: ${error.message}`
        };
    }
}

// Listar sessões de um projeto
function listSessions(projectId) {
    if (!Number.isInteger(projectId) || projectId <= 0) {
        return {
            success: false,
            message: 'Identificador de projeto inválido.'
        };
    }

    try {
        const project = getProject(projectId);

        if (!project.success || !project.project) {
            return {
                success: false,
                message: 'Projeto não encontrado.'
            };
        }

        const sessions = db.prepare(`
            SELECT * FROM sessions
            WHERE project_id = ?
            ORDER BY id
        `).all(projectId);

        return {
            success: true,
            sessions
        };

    } catch (error) {
        return {
            success: false,
            message: `Erro ao listar sessões: ${error.message}`
        };
    }
}

// Salvar operação
function saveOperation(sessionId, type, status, input = null, output = null) {
    const validStatuses = ['pending', 'in_progress', 'completed', 'blocked'];

    if (
        !Number.isInteger(sessionId) ||
        sessionId <= 0 ||
        typeof type !== 'string' ||
        !type.trim() ||
        !validStatuses.includes(status) ||
        (input !== null && typeof input !== 'string') ||
        (output !== null && typeof output !== 'string')
    ) {
        return {
            success: false,
            message: 'Dados da operação inválidos.'
        };
    }

    try {
        const session = getSession(sessionId);

        if (!session.success || !session.session) {
            return {
                success: false,
                message: 'Sessão não encontrada.'
            };
        }

        const result = db.prepare(`
            INSERT INTO operations (session_id, type, status, input, output)
            VALUES (?, ?, ?, ?, ?)
        `).run(sessionId, type.trim(), status, input, output);

        const operation = db.prepare(`
            SELECT * FROM operations WHERE id = ?
        `).get(Number(result.lastInsertRowid));

        return {
            success: true,
            operation
        };

    } catch (error) {
        return {
            success: false,
            message: `Erro ao salvar operação: ${error.message}`
        };
    }
}

// Listar operações de uma sessão
function listOperations(sessionId) {
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return {
            success: false,
            message: 'Identificador de sessão inválido.'
        };
    }

    try {
        const session = getSession(sessionId);

        if (!session.success || !session.session) {
            return {
                success: false,
                message: 'Sessão não encontrada.'
            };
        }

        const operations = db.prepare(`
            SELECT * FROM operations
            WHERE session_id = ?
            ORDER BY id
        `).all(sessionId);

        return {
            success: true,
            operations
        };

    } catch (error) {
        return {
            success: false,
            message: `Erro ao listar operações: ${error.message}`
        };
    }
}

// Salvar mensagem
function saveMessage(sessionId, role, content) {
    const validRoles = ['system', 'user', 'assistant', 'tool'];

    if (
        !Number.isInteger(sessionId) ||
        sessionId <= 0 ||
        !validRoles.includes(role) ||
        typeof content !== 'string' ||
        !content.trim()
    ) {
        return {
            success: false,
            message: 'Dados da mensagem inválidos.'
        };
    }

    try {
        const session = db.prepare(`
            SELECT id FROM sessions WHERE id = ?
        `).get(sessionId);

        if (!session) {
            return {
                success: false,
                message: 'Sessão não encontrada.'
            };
        }

        const result = db.prepare(`
            INSERT INTO messages (session_id, role, content)
            VALUES (?, ?, ?)
        `).run(sessionId, role, content);

        const message = db.prepare(`
            SELECT * FROM messages WHERE id = ?
        `).get(Number(result.lastInsertRowid));

        return {
            success: true,
            message
        };

    } catch (error) {
        return {
            success: false,
            message: `Erro ao salvar mensagem: ${error.message}`
        };
    }
}

// Listar mensagens de uma sessão
function listMessages(sessionId) {
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return {
            success: false,
            message: 'Identificador de sessão inválido.'
        };
    }

    try {
        const session = db.prepare(`
            SELECT id FROM sessions WHERE id = ?
        `).get(sessionId);

        if (!session) {
            return {
                success: false,
                message: 'Sessão não encontrada.'
            };
        }

        const messages = db.prepare(`
            SELECT * FROM messages
            WHERE session_id = ?
            ORDER BY id
        `).all(sessionId);

        return {
            success: true,
            messages
        };

    } catch (error) {
        return {
            success: false,
            message: `Erro ao listar mensagens: ${error.message}`
        };
    }
}

// Encerrar conexão
function closeDatabase() {
    if (db.open) {
        db.close();
    }
}

module.exports = {
    db,
    createProject,
    listProjects,
    getProject,
    createSession,
    getSession,
    listSessions,
    saveOperation,
    listOperations,
    saveMessage,
    listMessages,
    closeDatabase
};
