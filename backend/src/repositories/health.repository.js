const pool = require("../config/db");

const pingDatabase = async () => {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
};

module.exports = { pingDatabase };
