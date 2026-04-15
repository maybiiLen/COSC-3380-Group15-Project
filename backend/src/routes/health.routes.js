const { Router } = require("../lib/router");
const { getHealth } = require("../controllers/health.controller");

const router = Router();

router.get("/", getHealth);

module.exports = router;
