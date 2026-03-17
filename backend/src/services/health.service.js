const { pingDatabase } = require("../repositories/health.repository");

const checkHealth = async () => {
  const dbStatus = await pingDatabase();
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    database: dbStatus ? "connected" : "disconnected",
  };
};

module.exports = { checkHealth };
