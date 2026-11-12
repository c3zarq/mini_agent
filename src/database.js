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
    closeDatabase
};
