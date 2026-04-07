const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const healthRouter = require("./routes/health.routes");
const authRouter = require("./routes/auth.routes");
const ridesRouter = require("./routes/rides.routes")
const maintenanceRouter = require("./routes/maintenance.routes")
const employeesRouter = require("./routes/employees.routes")
const reportsRouter = require("./routes/reports.routes")
const ticketsRouter = require("./routes/tickets.routes")

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/rides", ridesRouter)
app.use("/api/maintenance", maintenanceRouter)
app.use("/api/employees", employeesRouter)
app.use("/api/reports", reportsRouter)
app.use("/api/tickets", ticketsRouter)

module.exports = app;