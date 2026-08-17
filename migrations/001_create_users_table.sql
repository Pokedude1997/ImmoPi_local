-- Migration 001: Create users table
-- This migration creates the users table for multi-user authentication

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_id ON users(id);

-- Insert into migrations_applied tracking table
INSERT OR IGNORE INTO migrations_applied (migration_name, applied_at) 
VALUES ('001_create_users_table', datetime('now'));
