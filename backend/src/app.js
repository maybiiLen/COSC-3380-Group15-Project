const express = require("express");
const cors = require("cors");
const healthRouter = require("./routes/health.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/health", healthRouter);

module.exports = app;
