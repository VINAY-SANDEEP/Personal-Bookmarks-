/**
 * Bookmark Manager REST API
 * Single-file Express.js + SQLite implementation
 */

require("dotenv").config();
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const { body, validationResult } = require("express-validator");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const app = express();
app.use(express.json());

// ========================
// Database Setup (SQLite)
// ========================
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "bookmarks.db");

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error("DB Connection Error:", err.message);
  else console.log("📦 SQLite connected");
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL
    )
  `);
});

// ========================
// Routes
// ========================

// CREATE bookmark
app.post(
  "/bookmarks",
  body("url").isURL().withMessage("Invalid URL"),
  body("title").notEmpty().withMessage("Title is required"),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { url, title, description } = req.body;
    const id = uuidv4();
    const created_at = new Date().toISOString();

    db.run(
      `INSERT INTO bookmarks (id, url, title, description, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, url, title, description || null, created_at],
      (err) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: "Database error" });
        }

        res.status(201).json({
          id,
          url,
          title,
          description,
          created_at,
        });
      }
    );
  }
);

// READ all bookmarks
app.get("/bookmarks", (req, res) => {
  db.all(`SELECT * FROM bookmarks`, [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Database error" });
    }
    res.status(200).json(rows);
  });
});

// READ bookmark by ID
app.get("/bookmarks/:id", (req, res) => {
  db.get(
    `SELECT * FROM bookmarks WHERE id = ?`,
    [req.params.id],
    (err, row) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Database error" });
      }
      if (!row) {
        return res.status(404).json({ message: "Bookmark not found" });
      }
      res.status(200).json(row);
    }
  );
});

// UPDATE bookmark
app.put(
  "/bookmarks/:id",
  body("url").optional().isURL().withMessage("Invalid URL"),
  body("title").optional().notEmpty().withMessage("Title cannot be empty"),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { url, title, description } = req.body;

    db.get(
      `SELECT * FROM bookmarks WHERE id = ?`,
      [req.params.id],
      (err, bookmark) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: "Database error" });
        }
        if (!bookmark) {
          return res.status(404).json({ message: "Bookmark not found" });
        }

        const updatedBookmark = {
          url: url ?? bookmark.url,
          title: title ?? bookmark.title,
          description: description ?? bookmark.description,
        };

        db.run(
          `UPDATE bookmarks
           SET url = ?, title = ?, description = ?
           WHERE id = ?`,
          [
            updatedBookmark.url,
            updatedBookmark.title,
            updatedBookmark.description,
            req.params.id,
          ],
          (err) => {
            if (err) {
              console.error(err);
              return res.status(500).json({ message: "Database error" });
            }

            res.status(200).json({
              ...bookmark,
              ...updatedBookmark,
            });
          }
        );
      }
    );
  }
);

// DELETE bookmark
app.delete("/bookmarks/:id", (req, res) => {
  db.run(
    `DELETE FROM bookmarks WHERE id = ?`,
    [req.params.id],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Database error" });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: "Bookmark not found" });
      }
      res.status(204).send();
    }
  );
});

// ========================
// Global Error Handler
// ========================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Internal Server Error" });
});

// ========================
// Server Start
// ========================
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
