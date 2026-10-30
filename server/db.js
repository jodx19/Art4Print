'use strict';
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
    console.warn('⚠️  DATABASE_URL is not set — database calls will fail.');
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, idleTimeoutMillis: 10000 });

/** Run a parameterised query and return the rows. */
const q = async (text, params = []) => (await pool.query(text, params)).rows;

/* Idempotent schema — safe to run on every cold start. Append new statements to extend. */
const SCHEMA = [
    `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at BIGINT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        emoji TEXT NOT NULL DEFAULT '',
        sort INTEGER NOT NULL DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '',
        price TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        image TEXT NOT NULL DEFAULT '',
        emoji TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS uploads (
        id SERIAL PRIMARY KEY,
        original_name TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        mime TEXT NOT NULL,
        size INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now())`
];

let ready;
/** Create tables + default categories once per process. */
function init() {
    if (!ready) {
        ready = (async () => {
            for (const sql of SCHEMA) await q(sql);
            const [{ c }] = await q('SELECT COUNT(*)::int c FROM categories');
            if (c === 0) {
                await q(`INSERT INTO categories (name, emoji, sort) VALUES
                    ('ملزمات','📒',1), ('أقلام','✏️',2), ('أوراق','📄',3), ('مستلزمات','🛒',4)`);
            }
            await require('./auth').seedAdmin();
        })().catch((e) => { ready = null; throw e; });
    }
    return ready;
}

module.exports = { q, init };
