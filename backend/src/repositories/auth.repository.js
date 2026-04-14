const pool = require("../config/db");
const crypto = require("crypto");

const hashToken = (rawToken) =>
  crypto.createHash("sha256").update(rawToken).digest("hex");

const findUserByEmail = async (email) => {
  const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  return rows[0] || null;
};

const findUserById = async (id) => {
  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return rows[0] || null;
};

// Atomically creates a users row + customers row in one transaction
const registerCustomerWithUser = async ({ email, passwordHash, fullName, dateOfBirth, phone }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [user] } = await client.query(
      "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'customer') RETURNING id, email, role, created_at",
      [email, passwordHash]
    );

    const { rows: [customer] } = await client.query(
      "INSERT INTO customers (email, full_name, date_of_birth, phone, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING customer_id, full_name, email",
      [email, fullName, dateOfBirth, phone, user.id]
    );

    await client.query("COMMIT");
    return { user, customer };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

// Atomically creates a users row + employees row in one transaction
const registerEmployeeWithUser = async ({ email, passwordHash, fullName, role, hourlyRate }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [user] } = await client.query(
      "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, created_at",
      [email, passwordHash, role]
    );

    const { rows: [employee] } = await client.query(
      "INSERT INTO employees (email, full_name, role, user_id, hourly_rate) VALUES ($1, $2, $3, $4, $5) RETURNING employee_id, full_name, email, role, hourly_rate",
      [email, fullName, role, user.id, hourlyRate || null]
    );

    await client.query("COMMIT");
    return { user, employee };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const findCustomerByUserId = async (userId) => {
  const { rows } = await pool.query(
    "SELECT customer_id, full_name, email FROM customers WHERE user_id = $1",
    [userId]
  );
  return rows[0] || null;
};

const findEmployeeByUserId = async (userId) => {
  const { rows } = await pool.query(
    "SELECT employee_id, full_name, email FROM employees WHERE user_id = $1",
    [userId]
  );
  return rows[0] || null;
};

const findRefreshToken = async (rawToken) => {
  const { rows } = await pool.query(
    "SELECT * FROM refresh_tokens WHERE token_hash = $1 AND expires_at > NOW()",
    [hashToken(rawToken)]
  );
  return rows[0] || null;
};

const createRefreshToken = async ({ rawToken, userId, familyId, expiresAt }) => {
  await pool.query(
    "INSERT INTO refresh_tokens (family_id, token_hash, user_id, expires_at) VALUES ($1, $2, $3, $4)",
    [familyId, hashToken(rawToken), userId, expiresAt]
  );
};

const markTokenUsed = async (tokenId) => {
  await pool.query("UPDATE refresh_tokens SET used = TRUE WHERE id = $1", [tokenId]);
};

const deleteTokenFamily = async (familyId) => {
  await pool.query("DELETE FROM refresh_tokens WHERE family_id = $1", [familyId]);
};

module.exports = {
  findUserByEmail,
  findUserById,
  registerCustomerWithUser,
  registerEmployeeWithUser,
  findCustomerByUserId,
  findEmployeeByUserId,
  findRefreshToken,
  createRefreshToken,
  markTokenUsed,
  deleteTokenFamily,
};
