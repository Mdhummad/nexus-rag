import { createRequire } from "module";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync, existsSync } from "fs";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../data");
const DB_PATH = join(DATA_DIR, "nexus.db");

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

let _db = null;

export function getDb() {
    if (!_db) {
        _db = new Database(DB_PATH);
        // WAL mode = concurrent reads don't block writes
        _db.pragma("journal_mode = WAL");
        _db.pragma("foreign_keys = ON");
        _db.pragma("synchronous = NORMAL");
        _initSchema(_db);
        console.log(`[DB] SQLite ready → ${DB_PATH}`);
    }
    return _db;
}

function _initSchema(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS papers (
            id           TEXT PRIMARY KEY,
            filename     TEXT NOT NULL,
            title        TEXT,
            authors      TEXT,          -- JSON array
            abstract     TEXT,
            year         INTEGER,
            total_pages  INTEGER DEFAULT 0,
            total_chunks INTEGER DEFAULT 0,
            status       TEXT    DEFAULT 'ready',
            uploaded_at  TEXT    NOT NULL
        );
    `);
}

// ── Paper CRUD ────────────────────────────────────────────────────────────────

export function insertPaper(paper) {
    getDb().prepare(`
        INSERT INTO papers
            (id, filename, title, authors, abstract, year, total_pages, total_chunks, status, uploaded_at)
        VALUES
            (@id, @filename, @title, @authors, @abstract, @year, @totalPages, @totalChunks, @status, @uploadedAt)
    `).run({
        id:          paper.id,
        filename:    paper.filename,
        title:       paper.title    ?? null,
        authors:     paper.authors  ? JSON.stringify(paper.authors) : null,
        abstract:    paper.abstract ?? null,
        year:        paper.year     ?? null,
        totalPages:  paper.totalPages  ?? 0,
        totalChunks: paper.totalChunks ?? 0,
        status:      paper.status   ?? "ready",
        uploadedAt:  paper.uploadedAt,
    });
    return paper;
}

export function getAllPapers() {
    return getDb()
        .prepare("SELECT * FROM papers ORDER BY uploaded_at DESC")
        .all()
        .map(_deserialize);
}

export function getPaperById(id) {
    const row = getDb().prepare("SELECT * FROM papers WHERE id = ?").get(id);
    return row ? _deserialize(row) : null;
}

export function deletePaperById(id) {
    getDb().prepare("DELETE FROM papers WHERE id = ?").run(id);
}

function _deserialize(row) {
    return {
        id:          row.id,
        filename:    row.filename,
        title:       row.title,
        authors:     row.authors ? JSON.parse(row.authors) : null,
        abstract:    row.abstract,
        year:        row.year,
        totalPages:  row.total_pages,
        totalChunks: row.total_chunks,
        status:      row.status,
        uploadedAt:  row.uploaded_at,
    };
}
