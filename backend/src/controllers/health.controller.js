const { checkHealth } = require("../services/health.service");

const getHealth = async (req, res) => {
  try {
    const result = await checkHealth();
    res.json(result);
  } catch (error) {
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
};

module.exports = { getHealth };
