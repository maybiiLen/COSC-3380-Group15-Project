const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const healthRouter = require("./routes/health.routes");
const authRouter = require("./routes/auth.routes");

const app = express();

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);

module.exports = app;
