/**
 * dump-db.cjs — portable SQL dump of the populated CougarRide database
 *
 * Why not pg_dump? Windows builds of psql/pg_dump 17 can't negotiate TLS/SNI
 * with Neon's endpoints. This script uses the same @neondatabase/serverless
 * client the app uses, which works reliably.
 *
 * Usage:
 *   cd backend
 *   node scripts/dump-db.cjs > ../database-dump.sql
 *
 * The output file is self-contained: DROPs + CREATE TABLEs + INSERTs
 * + sequence resets + all trigger functions and triggers from migrate.js.
 * Safe to load into any empty Postgres instance.
 */
require("dotenv").config()
const fs = require("fs")
const path = require("path")
const pool = require("../src/config/db")

const OUT = process.stdout
const SKIP_TABLES = new Set(["_migrations"]) // don't dump migration bookkeeping

function esc(v) {
  if (v === null || v === undefined) return "NULL"
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE"
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL"
  if (v instanceof Date) return `'${v.toISOString()}'`
  if (Buffer.isBuffer(v)) return `'\\x${v.toString("hex")}'::bytea`
  if (typeof v === "object") return `'${String(JSON.stringify(v)).replace(/'/g, "''")}'::jsonb`
  // string — escape single quotes
  return `'${String(v).replace(/'/g, "''")}'`
}

function write(s) { OUT.write(s) }

async function main() {
  write(`-- ═══════════════════════════════════════════════════════════════\n`)
  write(`-- CougarRide — Populated Database Dump\n`)
  write(`-- Generated: ${new Date().toISOString()}\n`)
  write(`-- Postgres dialect (tested on Neon serverless Postgres)\n`)
  write(`-- ═══════════════════════════════════════════════════════════════\n\n`)
  write(`SET client_min_messages = warning;\n`)
  write(`SET statement_timeout   = 0;\n`)
  write(`SET lock_timeout        = 0;\n`)
  write(`SET idle_in_transaction_session_timeout = 0;\n`)
  write(`SET standard_conforming_strings = on;\n`)
  write(`SET check_function_bodies = false;\n\n`)

  // 1) Discover tables in dependency order
  const { rows: tablesAll } = await pool.query(`
    SELECT c.oid, c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
     ORDER BY c.relname
  `)
  const tables = tablesAll.filter(t => !SKIP_TABLES.has(t.table_name))
  const tableNames = tables.map(t => t.table_name)

  // 2) Drop in reverse order (children first) then recreate
  write(`-- ─── DROP EXISTING OBJECTS (reverse dependency) ───\n`)
  for (const t of [...tableNames].reverse()) {
    write(`DROP TABLE IF EXISTS "${t}" CASCADE;\n`)
  }
  write(`\n`)

  // 3) CREATE TABLE for each
  write(`-- ─── SCHEMA ───\n`)
  for (const t of tableNames) {
    const ddl = await buildCreateTable(t)
    write(ddl + "\n\n")
  }

  // 4) Table data — topological order based on foreign key dependencies
  const order = await topoSortTables(tableNames)
  write(`-- ─── DATA ───\n`)
  for (const t of order) {
    await dumpData(t)
  }

  // 5) Reset sequences so future inserts don't collide with dumped PKs
  write(`-- ─── SEQUENCE RESETS ───\n`)
  await dumpSequenceResets()
  write(`\n`)

  // 6) Append the trigger/function definitions from migrate.js so the dump is
  //    functionally complete (includes triggers + notification helper + guards).
  write(`-- ─── TRIGGERS + STORED FUNCTIONS ───\n`)
  write(`-- Copied from backend/src/db/migrate.js (latest applied state).\n`)
  appendTriggersFromMigrations()

  write(`\n-- END OF DUMP\n`)
}

// ─── helpers ──────────────────────────────────────────────────────────

async function buildCreateTable(tableName) {
  const { rows: cols } = await pool.query(`
    SELECT column_name, data_type, udt_name, is_nullable, column_default,
           character_maximum_length, numeric_precision, numeric_scale
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position
  `, [tableName])

  const pieces = cols.map(c => {
    let type = c.data_type
    if (type === "character varying" && c.character_maximum_length)
      type = `VARCHAR(${c.character_maximum_length})`
    else if (type === "numeric" && c.numeric_precision)
      type = c.numeric_scale ? `NUMERIC(${c.numeric_precision},${c.numeric_scale})` : `NUMERIC(${c.numeric_precision})`
    else if (type === "timestamp with time zone") type = "TIMESTAMPTZ"
    else if (type === "timestamp without time zone") type = "TIMESTAMP"
    else if (type === "USER-DEFINED") type = c.udt_name
    else if (type === "ARRAY") type = c.udt_name.replace(/^_/, "") + "[]"

    let line = `  "${c.column_name}" ${type.toUpperCase()}`
    if (c.column_default) line += ` DEFAULT ${c.column_default}`
    if (c.is_nullable === "NO") line += ` NOT NULL`
    return line
  })

  // PRIMARY KEY
  const { rows: pkRows } = await pool.query(`
    SELECT a.attname
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
     WHERE i.indrelid = ('public.' || $1)::regclass AND i.indisprimary
     ORDER BY array_position(i.indkey, a.attnum)
  `, [tableName])
  if (pkRows.length > 0) {
    pieces.push(`  PRIMARY KEY (${pkRows.map(r => `"${r.attname}"`).join(", ")})`)
  }

  // UNIQUE constraints (other than PK)
  const { rows: uq } = await pool.query(`
    SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
     WHERE conrelid = ('public.' || $1)::regclass AND contype = 'u'
  `, [tableName])
  for (const u of uq) pieces.push(`  CONSTRAINT "${u.conname}" ${u.def}`)

  // CHECK constraints
  const { rows: ck } = await pool.query(`
    SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
     WHERE conrelid = ('public.' || $1)::regclass AND contype = 'c'
  `, [tableName])
  for (const c of ck) pieces.push(`  CONSTRAINT "${c.conname}" ${c.def}`)

  // FOREIGN KEYS
  const { rows: fk } = await pool.query(`
    SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
     WHERE conrelid = ('public.' || $1)::regclass AND contype = 'f'
  `, [tableName])
  for (const f of fk) pieces.push(`  CONSTRAINT "${f.conname}" ${f.def}`)

  return `CREATE TABLE "${tableName}" (\n${pieces.join(",\n")}\n);`
}

async function topoSortTables(names) {
  // Simple topological sort by FK edges; tables with no deps first
  const deps = new Map(names.map(n => [n, new Set()]))
  for (const name of names) {
    const { rows } = await pool.query(`
      SELECT cl2.relname AS references_table
        FROM pg_constraint c
        JOIN pg_class cl  ON cl.oid = c.conrelid
        JOIN pg_class cl2 ON cl2.oid = c.confrelid
       WHERE c.contype = 'f' AND cl.relname = $1
    `, [name])
    for (const r of rows) if (r.references_table !== name && deps.has(r.references_table))
      deps.get(name).add(r.references_table)
  }
  const out = []
  const visited = new Set()
  function visit(n) {
    if (visited.has(n)) return
    visited.add(n)
    for (const d of deps.get(n) || []) visit(d)
    out.push(n)
  }
  for (const n of names) visit(n)
  return out
}

async function dumpData(tableName) {
  const { rows: cols } = await pool.query(`
    SELECT column_name
      FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1
     ORDER BY ordinal_position
  `, [tableName])
  const colNames = cols.map(c => `"${c.column_name}"`).join(", ")
  const { rows } = await pool.query(`SELECT * FROM "${tableName}"`)
  if (rows.length === 0) {
    write(`-- (no rows in ${tableName})\n\n`)
    return
  }
  write(`-- ${tableName}: ${rows.length} row(s)\n`)
  for (const r of rows) {
    const vals = cols.map(c => esc(r[c.column_name])).join(", ")
    write(`INSERT INTO "${tableName}" (${colNames}) VALUES (${vals});\n`)
  }
  write(`\n`)
}

async function dumpSequenceResets() {
  const { rows } = await pool.query(`
    SELECT sequence_name FROM information_schema.sequences
     WHERE sequence_schema = 'public'
  `)
  for (const s of rows) {
    // Find owning table.column
    const { rows: dep } = await pool.query(`
      SELECT t.relname AS table_name, a.attname AS column_name
        FROM pg_depend d
        JOIN pg_class s_cl ON s_cl.oid = d.objid
        JOIN pg_class t    ON t.oid    = d.refobjid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
       WHERE s_cl.relkind = 'S' AND s_cl.relname = $1
       LIMIT 1
    `, [s.sequence_name])
    if (dep.length === 0) continue
    const { table_name, column_name } = dep[0]
    if (SKIP_TABLES.has(table_name)) continue
    const { rows: [{ max_val }] } = await pool.query(
      `SELECT COALESCE(MAX("${column_name}"), 0) AS max_val FROM "${table_name}"`
    )
    write(`SELECT setval('"${s.sequence_name}"', ${Math.max(1, Number(max_val))}, ${Number(max_val) > 0});\n`)
  }
}

function appendTriggersFromMigrations() {
  const migratePath = path.join(__dirname, "..", "src", "db", "migrate.js")
  const src = fs.readFileSync(migratePath, "utf8")
  // Extract every sql: `...` block that creates/replaces a function or trigger.
  // For simplicity we emit the entire concatenated SQL from every migration
  // whose SQL mentions CREATE OR REPLACE FUNCTION or CREATE TRIGGER — this
  // covers all 4 triggers, the notification helper, and related drops.
  const blocks = [...src.matchAll(/name:\s*["']([^"']+)["'][^`]*`([\s\S]*?)`/g)]
  for (const [, name, sql] of blocks) {
    if (/CREATE (OR REPLACE )?FUNCTION|CREATE TRIGGER/i.test(sql)) {
      write(`\n-- migration: ${name}\n`)
      write(sql.trim() + "\n")
    }
  }
}

main().catch(err => {
  console.error("Dump failed:", err)
  process.exit(1)
}).finally(() => pool.end())
