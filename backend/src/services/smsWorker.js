const pool = require("../config/db")
const nodemailer = require("nodemailer")

const GATEWAY_EMAIL = process.env.SMS_GATEWAY_EMAIL
const GATEWAY_PASS = process.env.SMS_GATEWAY_APP_PASSWORD
const GATEWAY_RECIPIENT = process.env.SMS_GATEWAY_RECIPIENT // e.g. 7325244336@vzwpix.com
const NOTIFY_EMAIL = process.env.SMS_NOTIFY_EMAIL // direct email fallback

let transporter = null

if (GATEWAY_EMAIL && GATEWAY_PASS) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: GATEWAY_EMAIL, pass: GATEWAY_PASS },
  })
  console.log("[SMS Worker] Configured — SMS via", GATEWAY_RECIPIENT || "none", "| Email to", NOTIFY_EMAIL || "none")
} else {
  console.log("[SMS Worker] No credentials — SMS will stay in queue only")
}

let workerTimer = null

async function processSmsQueue() {
  if (!transporter) return

  try {
    const { rows } = await pool.query(`
      UPDATE sms_queue
         SET status = 'sending'
       WHERE sms_id IN (
         SELECT sms_id FROM sms_queue
          WHERE status = 'queued'
          ORDER BY
            CASE priority WHEN 'highest' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
            queued_at ASC
          LIMIT 5
       )
       RETURNING *
    `)

    for (const sms of rows) {
      try {
        const body = `[${sms.recipient_name || "Staff"}] ${sms.message_body}`
        const sends = []

        // 1) SMS via carrier gateway (may be throttled)
        if (GATEWAY_RECIPIENT) {
          sends.push(
            transporter.sendMail({
              from: GATEWAY_EMAIL,
              to: GATEWAY_RECIPIENT,
              subject: "",
              text: body.slice(0, 160),
            }).then(() => console.log(`[SMS Worker] SMS sent sms_id=${sms.sms_id}`))
             .catch(err => console.log(`[SMS Worker] SMS failed sms_id=${sms.sms_id}: ${err.message}`))
          )
        }

        // 2) Email notification (reliable fallback)
        if (NOTIFY_EMAIL) {
          const priorityLabel = sms.priority === 'highest' ? 'URGENT' : sms.priority === 'high' ? 'HIGH' : 'INFO'
          sends.push(
            transporter.sendMail({
              from: GATEWAY_EMAIL,
              to: NOTIFY_EMAIL,
              subject: `[CougarRide ${priorityLabel}] ${sms.message_body.slice(0, 80)}`,
              text: `Priority: ${sms.priority.toUpperCase()}\nTo: ${sms.recipient_name || "Staff"} (${sms.recipient_phone})\n\n${sms.message_body}\n\n— CougarRide Maintenance Alert System`,
            }).then(() => console.log(`[SMS Worker] Email sent sms_id=${sms.sms_id}`))
             .catch(err => console.log(`[SMS Worker] Email failed sms_id=${sms.sms_id}: ${err.message}`))
          )
        }

        await Promise.all(sends)

        await pool.query(
          `UPDATE sms_queue SET status = 'sent', sent_at = NOW() WHERE sms_id = $1`,
          [sms.sms_id]
        )
      } catch (err) {
        console.log(`[SMS Worker] Failed sms_id=${sms.sms_id}: ${err.message}`)
        await pool.query(
          `UPDATE sms_queue SET status = 'failed' WHERE sms_id = $1`,
          [sms.sms_id]
        )
      }
    }
  } catch (err) {
    console.log("[SMS Worker] Queue poll error:", err.message)
  }
}

function startSmsWorker(intervalMs = 5000) {
  if (workerTimer) return
  workerTimer = setInterval(processSmsQueue, intervalMs)
  processSmsQueue()
  console.log(`[SMS Worker] Started — polling every ${intervalMs / 1000}s`)
}

function stopSmsWorker() {
  if (workerTimer) {
    clearInterval(workerTimer)
    workerTimer = null
    console.log("[SMS Worker] Stopped")
  }
}

module.exports = { startSmsWorker, stopSmsWorker }
