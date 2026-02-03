const path = require("path");
const fs = require("fs");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "moderator.db");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS daily_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      tickets_replied INTEGER NOT NULL,
      work_start TEXT NOT NULL,
      work_end TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS response_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      user_message_time TEXT NOT NULL,
      reply_time TEXT NOT NULL,
      response_ms INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  );
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const runAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function handleResult(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ id: this.lastID, changes: this.changes });
    });
  });

const allAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });

const getAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });

const parseDateTime = (value) => new Date(value);

app.post("/api/daily", async (req, res) => {
  try {
    const { date, ticketsReplied, workStart, workEnd } = req.body;
    if (!date || ticketsReplied === undefined || !workStart || !workEnd) {
      res.status(400).json({ error: "Missing required fields." });
      return;
    }

    const result = await runAsync(
      `INSERT INTO daily_stats (date, tickets_replied, work_start, work_end)
       VALUES (?, ?, ?, ?)` ,
      [date, Number(ticketsReplied), workStart, workEnd]
    );

    res.json({ id: result.id });
  } catch (error) {
    res.status(500).json({ error: "Failed to save daily stats." });
  }
});

app.get("/api/daily", async (_req, res) => {
  try {
    const rows = await allAsync(
      `SELECT * FROM daily_stats ORDER BY date DESC, created_at DESC`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to load daily stats." });
  }
});

app.put("/api/daily/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { date, ticketsReplied, workStart, workEnd } = req.body;
    const result = await runAsync(
      `UPDATE daily_stats
       SET date = ?, tickets_replied = ?, work_start = ?, work_end = ?
       WHERE id = ?`,
      [date, Number(ticketsReplied), workStart, workEnd, id]
    );
    res.json({ updated: result.changes });
  } catch (error) {
    res.status(500).json({ error: "Failed to update daily stats." });
  }
});

app.delete("/api/daily/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await runAsync(`DELETE FROM daily_stats WHERE id = ?`, [id]);
    res.json({ deleted: result.changes });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete daily stats." });
  }
});

app.post("/api/responses", async (req, res) => {
  try {
    const { date, userMessageTime, replyTime } = req.body;
    if (!date || !userMessageTime || !replyTime) {
      res.status(400).json({ error: "Missing required fields." });
      return;
    }

    const start = parseDateTime(userMessageTime);
    const end = parseDateTime(replyTime);
    const responseMs = Math.max(0, end - start);

    const result = await runAsync(
      `INSERT INTO response_logs (date, user_message_time, reply_time, response_ms)
       VALUES (?, ?, ?, ?)` ,
      [date, userMessageTime, replyTime, responseMs]
    );

    res.json({ id: result.id, responseMs });
  } catch (error) {
    res.status(500).json({ error: "Failed to save response log." });
  }
});

app.get("/api/responses", async (_req, res) => {
  try {
    const rows = await allAsync(
      `SELECT * FROM response_logs ORDER BY date DESC, created_at DESC`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to load response logs." });
  }
});

app.put("/api/responses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { date, userMessageTime, replyTime } = req.body;
    const responseMs = Math.max(0, parseDateTime(replyTime) - parseDateTime(userMessageTime));
    const result = await runAsync(
      `UPDATE response_logs
       SET date = ?, user_message_time = ?, reply_time = ?, response_ms = ?
       WHERE id = ?`,
      [date, userMessageTime, replyTime, responseMs, id]
    );
    res.json({ updated: result.changes });
  } catch (error) {
    res.status(500).json({ error: "Failed to update response log." });
  }
});

app.delete("/api/responses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await runAsync(`DELETE FROM response_logs WHERE id = ?`, [id]);
    res.json({ deleted: result.changes });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete response log." });
  }
});

app.get("/api/analytics", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const rangeFilter = startDate && endDate ? `WHERE date BETWEEN ? AND ?` : "";
    const rangeParams = startDate && endDate ? [startDate, endDate] : [];

    const overall = await getAsync(
      `SELECT
        AVG(response_ms) AS avg_response_ms,
        MIN(response_ms) AS fastest_response_ms,
        MAX(response_ms) AS slowest_response_ms,
        COUNT(*) AS total_responses
       FROM response_logs`
    );

    const perDayResponses = await allAsync(
      `SELECT date, AVG(response_ms) AS avg_response_ms, COUNT(*) AS total_responses
       FROM response_logs
       GROUP BY date
       ORDER BY date DESC`
    );

    const ticketsPerDay = await allAsync(
      `SELECT date, SUM(tickets_replied) AS tickets_replied
       FROM daily_stats
       ${rangeFilter}
       GROUP BY date
       ORDER BY date DESC`,
      rangeParams
    );

    const totalTicketsInRangeRow = await getAsync(
      `SELECT SUM(tickets_replied) AS total_tickets
       FROM daily_stats
       ${rangeFilter}`,
      rangeParams
    );

    res.json({
      overall,
      perDayResponses,
      ticketsPerDay,
      totalTicketsInRange: totalTicketsInRangeRow?.total_tickets || 0
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load analytics." });
  }
});

app.get("/api/export/daily", async (_req, res) => {
  try {
    const rows = await allAsync(
      `SELECT date, tickets_replied, work_start, work_end, created_at FROM daily_stats ORDER BY date DESC`
    );
    const header = "date,tickets_replied,work_start,work_end,created_at\n";
    const body = rows
      .map(
        (row) =>
          `${row.date},${row.tickets_replied},${row.work_start},${row.work_end},${row.created_at}`
      )
      .join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=daily_stats.csv");
    res.send(header + body);
  } catch (error) {
    res.status(500).json({ error: "Failed to export daily stats." });
  }
});

app.get("/api/export/responses", async (_req, res) => {
  try {
    const rows = await allAsync(
      `SELECT date, user_message_time, reply_time, response_ms, created_at FROM response_logs ORDER BY date DESC`
    );
    const header = "date,user_message_time,reply_time,response_ms,created_at\n";
    const body = rows
      .map(
        (row) =>
          `${row.date},${row.user_message_time},${row.reply_time},${row.response_ms},${row.created_at}`
      )
      .join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=response_logs.csv");
    res.send(header + body);
  } catch (error) {
    res.status(500).json({ error: "Failed to export response logs." });
  }
});

app.listen(PORT, () => {
  console.log(`Moderator logger running on http://localhost:${PORT}`);
});
