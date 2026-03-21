const { Router } = require("express");
const { register, registerEmployee, login, refresh, logout } = require("../controllers/auth.controller");
const validate = require("../middleware/validate");
const verifyToken = require("../middleware/verifyToken");
const verifyRole = require("../middleware/verifyRole");
const { registerSchema, registerEmployeeSchema, loginSchema } = require("../validators/auth.validators");

const router = Router();

router.post("/register",          validate(registerSchema),         register);
router.post("/register/employee", verifyToken, verifyRole("admin"), validate(registerEmployeeSchema), registerEmployee);
router.post("/login",             validate(loginSchema),            login);
router.post("/refresh",           refresh);
router.post("/logout",            logout);

module.exports = router;
