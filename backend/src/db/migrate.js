require("dotenv").config();
const pool = require("../config/db");

const migrations = [
  {
    name: "001_create_users",
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        email         VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role          VARCHAR(50) NOT NULL DEFAULT 'staff',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
  },
  {
    name: "002_create_refresh_tokens",
    sql: `
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id          SERIAL PRIMARY KEY,
        family_id   UUID NOT NULL,
        token_hash  TEXT NOT NULL UNIQUE,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        used        BOOLEAN NOT NULL DEFAULT FALSE,
        expires_at  TIMESTAMPTZ NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_id ON refresh_tokens(family_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id   ON refresh_tokens(user_id);
    `,
  },
  {
    name: "003_add_user_id_to_customers",
    sql: `
      ALTER TABLE customers
        ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
    `,
  },
  {
    name: "004_add_user_id_to_employees",
    sql: `
      ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
    `,
  },
  {
    name: "005_customers_phone_to_bigint",
    sql: `ALTER TABLE customers ALTER COLUMN phone TYPE BIGINT;`,
  },
  {
    name: "006_widen_customers_varchar_columns",
    sql: `
      ALTER TABLE customers ALTER COLUMN email TYPE VARCHAR(255);
      ALTER TABLE customers ALTER COLUMN full_name TYPE VARCHAR(255);
    `,
  },
  {
    name: "007_widen_employees_varchar_columns",
    sql: `
      ALTER TABLE employees ALTER COLUMN email TYPE VARCHAR(255);
      ALTER TABLE employees ALTER COLUMN full_name TYPE VARCHAR(255);
    `,
  },
];

const run = async () => {
  const client = await pool.connect();

  try {
    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(255) NOT NULL UNIQUE,
        run_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    for (const migration of migrations) {
      const { rows } = await client.query(
        "SELECT id FROM _migrations WHERE name = $1",
        [migration.name]
      );

      if (rows.length > 0) {
        console.log(`  skipped  ${migration.name}`);
        continue;
      }

      await client.query("BEGIN");
      await client.query(migration.sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [migration.name]);
      await client.query("COMMIT");
      console.log(`  applied  ${migration.name}`);
    }

    console.log("\nMigrations complete.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

run();
