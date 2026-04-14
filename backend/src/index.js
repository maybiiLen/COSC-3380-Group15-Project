require("dotenv").config();
const app = require("./app");
const { startSmsWorker } = require("./services/smsWorker");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startSmsWorker(5000); // Poll sms_queue every 5 seconds
});
