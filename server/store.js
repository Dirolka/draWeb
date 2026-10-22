import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";

export function createStore(directory = process.env.DATA_DIR || "data") {
  mkdirSync(directory, { recursive: true });
  const keyPath = resolve(directory, "master.key");
  if (!process.env.VISIONFORGE_MASTER_KEY && !existsSync(keyPath))
    writeFileSync(keyPath, randomBytes(32).toString("hex"), { mode: 0o600 });
  const key = Buffer.from(
    process.env.VISIONFORGE_MASTER_KEY || readFileSync(keyPath, "utf8").trim(),
    "hex",
  );
  if (key.length !== 32)
    throw new Error("Master key must be 64 hexadecimal characters");
  const db = new DatabaseSync(resolve(directory, "visionforge.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS settings(user_id TEXT PRIMARY KEY REFERENCES users(id),value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,files TEXT NOT NULL,image TEXT,revision INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS snapshots(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,files TEXT NOT NULL,label TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS proposals(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,revision INTEGER NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,role TEXT NOT NULL,content TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,user_id TEXT,project_id TEXT,action TEXT NOT NULL,created_at TEXT NOT NULL);
  `);
  return {
    db,
    seal(value) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const body = Buffer.concat([
        cipher.update(JSON.stringify(value)),
        cipher.final(),
      ]);
      return [iv, cipher.getAuthTag(), body]
        .map((b) => b.toString("base64"))
        .join(".");
    },
    unseal(value) {
      const [iv, tag, body] = value
        .split(".")
        .map((x) => Buffer.from(x, "base64"));
      const cipher = createDecipheriv("aes-256-gcm", key, iv);
      cipher.setAuthTag(tag);
      return JSON.parse(
        Buffer.concat([cipher.update(body), cipher.final()]).toString(),
      );
    },
  };
}
export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  return timingSafeEqual(
    scryptSync(password, salt, 64),
    Buffer.from(hash, "hex"),
  );
}
export const tokenHash = (token) =>
  createHash("sha256").update(token).digest("hex");
