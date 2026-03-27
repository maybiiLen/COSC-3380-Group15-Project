require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("../config/db");

async function createAccounts() {
  const hash = await bcrypt.hash("CougarRide2026!", 10);

  const accounts = [
    ["admin@cougarride.com", hash, "admin"],
    ["manager@cougarride.com", hash, "manager"],
    ["staff@cougarride.com", hash, "staff"],
    ["customer@cougarride.com", hash, "customer"],
  ];

  for (const [email, pw, role] of accounts) {
    await pool.query(
      "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING",
      [email, pw, role]
    );
    console.log(`  created ${role}: ${email}`);
  }

  console.log("\nAll accounts created! Password: CougarRide2026!");
  await pool.end();
}

createAccounts().catch((e) => {
  console.error(e);
  process.exit(1);
});