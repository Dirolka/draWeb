import express from "express";
import { randomUUID, randomBytes } from "node:crypto";
import JSZip from "jszip";
import { z } from "zod";
import {
  createStore,
  hashPassword,
  verifyPassword,
  tokenHash,
} from "./store.js";
import { starterFiles, blankFiles } from "./templates.js";
import { compile, previewHtml, validateFiles, visualEdit } from "./code.js";
import { generateProposal } from "./ai.js";

const now = () => new Date().toISOString();
const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
export function createApp({ directory, ai = generateProposal } = {}) {
  const app = express();
  const store = createStore(directory);
  const { db } = store;
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
    });
    if (req.path.startsWith("/api")) {
      res.set("Cache-Control", "no-store");
      const origin = req.get("origin");
      if (origin && origin !== `${req.protocol}://${req.get("host")}`)
        return res.status(403).json({ error: "Cross-origin request blocked" });
      if (
        !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
        !req.is("application/json")
      )
        return res.status(415).json({ error: "JSON requests required" });
    }
    next();
  });
  app.use(express.json({ limit: "8mb" }));
  const attempts = new Map();
  function limit(key, max, period) {
    const time = Date.now();
    const bucket = attempts.get(key);
    if (!bucket || bucket.until < time) {
      attempts.set(key, { count: 1, until: time + period });
    } else if (++bucket.count > max)
      throw fail("Too many requests. Please try again later.", 429);
    if (attempts.size > 10000)
      for (const [key, value] of attempts)
        if (value.until < time) attempts.delete(key);
  }
  app.use("/api", (req, res, next) => {
    try {
      limit(`api:${req.ip}`, 500, 60000);
      next();
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));
  function session(res, user) {
    const token = randomBytes(32).toString("hex");
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      tokenHash(token),
      user.id,
      Date.now() + 604800000,
    );
    res.cookie("vf_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.SECURE_COOKIES === "true",
      maxAge: 604800000,
      path: "/",
    });
    res.json({ id: user.id, name: user.name, email: user.email });
  }
  const credentials = z.object({
    email: z
      .string()
      .email()
      .max(200)
      .transform((s) => s.toLowerCase()),
    password: z.string().min(10).max(200),
    name: z.string().trim().min(1).max(80).optional(),
  });
  app.post("/api/auth/register", (req, res) => {
    limit(`auth:${req.ip}`, 20, 900000);
    const input = credentials.parse(req.body);
    if (db.prepare("SELECT id FROM users WHERE email=?").get(input.email))
      throw fail("Unable to create this account. Try signing in.");
    const user = {
      id: randomUUID(),
      name: input.name || input.email.split("@")[0],
      email: input.email,
    };
    db.prepare("INSERT INTO users VALUES(?,?,?,?)").run(
      user.id,
      user.email,
      user.name,
      hashPassword(input.password),
    );
    session(res, user);
  });
  app.post("/api/auth/login", (req, res) => {
    limit(`auth:${req.ip}`, 20, 900000);
    const input = credentials.parse(req.body);
    const user = db
      .prepare("SELECT * FROM users WHERE email=?")
      .get(input.email);
    if (!user || !verifyPassword(input.password, user.password))
      throw fail("Invalid email or password", 401);
    session(res, user);
  });
  app.use("/api", (req, res, next) => {
    const token = req.headers.cookie
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("vf_session="))
      ?.slice(11);
    const user =
      token &&
      db
        .prepare(
          "SELECT users.id,users.name,users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?",
        )
        .get(tokenHash(token), Date.now());
    if (!user) return res.status(401).json({ error: "Please sign in" });
    req.user = user;
    req.sessionToken = tokenHash(token);
    next();
  });
  app.get("/api/auth/me", (req, res) => res.json(req.user));
  app.post("/api/auth/logout", (req, res) => {
    db.prepare("DELETE FROM sessions WHERE token=?").run(req.sessionToken);
    res.clearCookie("vf_session", { path: "/" });
    res.json({ ok: true });
  });
  const config = (id) => {
    const row = db
      .prepare("SELECT value FROM settings WHERE user_id=?")
      .get(id);
    return row
      ? store.unseal(row.value)
      : { provider: "openai", model: "", apiKey: "" };
  };
  app.get("/api/settings", (req, res) => {
    const c = config(req.user.id);
    res.json({ provider: c.provider, model: c.model, configured: !!c.apiKey });
  });
  app.put("/api/settings", (req, res) => {
    const input = z
      .object({
        provider: z.enum(["openai", "anthropic"]),
        model: z.string().trim().min(1).max(120),
        apiKey: z.string().max(500).optional(),
      })
      .parse(req.body);
    const old = config(req.user.id);
    const apiKey =
      input.apiKey || (old.provider === input.provider ? old.apiKey : "");
    if (!apiKey) throw fail("An API key is required");
    db.prepare(
      "INSERT INTO settings VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET value=excluded.value",
    ).run(req.user.id, store.seal({ ...input, apiKey }));
    res.json({ configured: true });
  });
  app.delete("/api/settings", (req, res) => {
    db.prepare("DELETE FROM settings WHERE user_id=?").run(req.user.id);
    res.json({ ok: true });
  });
  const audit = (req, action) =>
    db
      .prepare(
        "INSERT INTO audit(user_id,project_id,action,created_at) VALUES(?,?,?,?)",
      )
      .run(req.user.id, req.params.id || null, action, now());
  const readProject = (id, userId) => {
    const p = db
      .prepare("SELECT * FROM projects WHERE id=? AND user_id=?")
      .get(id, userId);
    if (!p) throw fail("Project not found", 404);
    return { ...p, files: JSON.parse(p.files) };
  };
  function save(req, files, label) {
    validateFiles(files);
    const p = readProject(req.params.id, req.user.id);
    if (req.body.revision !== p.revision)
      throw fail("Project changed in another tab. Reload before editing.", 409);
    db.exec("BEGIN");
    try {
      db.prepare("INSERT INTO snapshots VALUES(?,?,?,?,?)").run(
        randomUUID(),
        p.id,
        JSON.stringify(p.files),
        label,
        now(),
      );
      db.prepare(
        "UPDATE projects SET files=?,revision=revision+1,updated_at=? WHERE id=?",
      ).run(JSON.stringify(files), now(), p.id);
      audit(req, label);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    return readProject(p.id, req.user.id);
  }
  app.get("/api/projects", (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT id,name,revision,created_at,updated_at FROM projects WHERE user_id=? ORDER BY updated_at DESC",
        )
        .all(req.user.id),
    ),
  );
  app.post("/api/projects", (req, res) => {
    const input = z
      .object({
        name: z.string().trim().min(1).max(100),
        template: z.enum(["blank", "atelier"]).default("blank"),
        duplicateId: z.string().optional(),
      })
      .parse(req.body);
    const files = input.duplicateId
      ? readProject(input.duplicateId, req.user.id).files
      : input.template === "atelier"
        ? starterFiles
        : blankFiles;
    const id = randomUUID();
    const date = now();
    db.prepare(
      "INSERT INTO projects(id,user_id,name,files,created_at,updated_at) VALUES(?,?,?,?,?,?)",
    ).run(id, req.user.id, input.name, JSON.stringify(files), date, date);
    res.status(201).json(readProject(id, req.user.id));
  });
  app.get("/api/projects/:id", (req, res) =>
    res.json(readProject(req.params.id, req.user.id)),
  );
  app.patch("/api/projects/:id", (req, res) => {
    readProject(req.params.id, req.user.id);
    const { name } = z
      .object({ name: z.string().trim().min(1).max(100) })
      .parse(req.body);
    db.prepare("UPDATE projects SET name=?,updated_at=? WHERE id=?").run(
      name,
      now(),
      req.params.id,
    );
    res.json(readProject(req.params.id, req.user.id));
  });
  app.delete("/api/projects/:id", (req, res) => {
    readProject(req.params.id, req.user.id);
    db.prepare("DELETE FROM projects WHERE id=?").run(req.params.id);
    audit(req, "Deleted project");
    res.json({ ok: true });
  });
  app.put("/api/projects/:id/files", (req, res) => {
    res.json(save(req, req.body.files, "Saved source code"));
  });
  app.post("/api/projects/:id/visual", (req, res) => {
    const input = z
      .object({
        elementId: z.string().max(250),
        revision: z.number(),
        changes: z.object({
          text: z.string().max(5000).optional(),
          style: z
            .object({
              color: z.string().max(100).optional(),
              backgroundColor: z.string().max(100).optional(),
              fontSize: z.string().max(100).optional(),
              padding: z.string().max(100).optional(),
              borderRadius: z.string().max(100).optional(),
              width: z.string().max(100).optional(),
            })
            .optional(),
        }),
      })
      .parse(req.body);
    const p = readProject(req.params.id, req.user.id);
    res.json(
      save(
        req,
        visualEdit(p.files, input.elementId, input.changes),
        `Edited ${input.elementId}`,
      ),
    );
  });
  app.post("/api/projects/:id/preview", async (req, res) => {
    const p = readProject(req.params.id, req.user.id);
    const channel = randomUUID();
    const start = Date.now();
    const bundle = await compile(p.files, true);
    res.json({
      html: previewHtml(bundle, channel),
      channel,
      duration: Date.now() - start,
      revision: p.revision,
    });
  });
  app.put("/api/projects/:id/image", (req, res) => {
    readProject(req.params.id, req.user.id);
    const { image } = z
      .object({ image: z.string().max(7000000).nullable() })
      .parse(req.body);
    if (image) {
      const match = image.match(
        /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/,
      );
      if (!match) throw fail("Upload a PNG, JPEG, or WebP image");
      const buffer = Buffer.from(match[2], "base64");
      if (buffer.length > 5000000) throw fail("Images must be under 5 MB");
      const valid =
        match[1] === "png"
          ? buffer
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : match[1] === "jpeg"
            ? buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
            : buffer.toString("ascii", 0, 4) === "RIFF" &&
              buffer.toString("ascii", 8, 12) === "WEBP";
      if (!valid) throw fail("Image content does not match its type");
    }
    db.prepare("UPDATE projects SET image=? WHERE id=?").run(
      image,
      req.params.id,
    );
    res.json({ ok: true });
  });
  app.get("/api/projects/:id/messages", (req, res) => {
    readProject(req.params.id, req.user.id);
    res.json(
      db
        .prepare(
          "SELECT * FROM messages WHERE project_id=? ORDER BY created_at,rowid",
        )
        .all(req.params.id),
    );
  });
  app.get("/api/projects/:id/proposals", (req, res) => {
    const p = readProject(req.params.id, req.user.id);
    const row = db
      .prepare(
        "SELECT * FROM proposals WHERE project_id=? AND revision=? ORDER BY rowid DESC LIMIT 1",
      )
      .get(p.id, p.revision);
    res.json(
      row
        ? { ...JSON.parse(row.payload), id: row.id, revision: row.revision }
        : null,
    );
  });
  const busy = new Set();
  app.post("/api/projects/:id/generate", async (req, res) => {
    const p = readProject(req.params.id, req.user.id);
    const input = z
      .object({
        prompt: z.string().trim().min(1).max(12000),
        selection: z.string().max(250).nullable().optional(),
      })
      .parse(req.body);
    if (busy.has(req.user.id))
      throw fail("A generation is already running", 409);
    limit(`ai:${req.user.id}`, 30, 3600000);
    busy.add(req.user.id);
    try {
      const messages = db
        .prepare(
          "SELECT role,content FROM messages WHERE project_id=? ORDER BY created_at DESC LIMIT 10",
        )
        .all(p.id)
        .reverse();
      db.prepare("INSERT INTO messages VALUES(?,?,?,?,?)").run(
        randomUUID(),
        p.id,
        "user",
        input.prompt,
        now(),
      );
      const proposal = await ai(config(req.user.id), {
        ...input,
        files: p.files,
        image: p.image,
        messages,
      });
      const merged = { ...p.files, ...proposal.files };
      validateFiles(merged);
      let buildError = null;
      if (Object.keys(proposal.files).length)
        try {
          await compile(merged);
        } catch (e) {
          buildError = e.message;
        }
      const payload = { ...proposal, buildError };
      const id = randomUUID();
      db.prepare("INSERT INTO proposals VALUES(?,?,?,?,?)").run(
        id,
        p.id,
        p.revision,
        JSON.stringify(payload),
        now(),
      );
      db.prepare("INSERT INTO messages VALUES(?,?,?,?,?)").run(
        randomUUID(),
        p.id,
        "assistant",
        proposal.summary +
          (proposal.questions.length
            ? "\n\n" + proposal.questions.join("\n")
            : ""),
        now(),
      );
      audit(req, "Generated proposed changes");
      res.json({ ...payload, id, revision: p.revision });
    } finally {
      busy.delete(req.user.id);
    }
  });
  app.post(
    "/api/projects/:id/proposals/:proposalId/apply",
    async (req, res) => {
      const p = readProject(req.params.id, req.user.id);
      const row = db
        .prepare("SELECT * FROM proposals WHERE id=? AND project_id=?")
        .get(req.params.proposalId, p.id);
      if (!row) throw fail("Proposal not found", 404);
      if (row.revision !== p.revision)
        throw fail(
          "This proposal is stale. Generate again using the current source.",
          409,
        );
      const payload = JSON.parse(row.payload);
      if (payload.buildError)
        throw fail("Resolve the proposed build errors before applying");
      const merged = { ...p.files, ...payload.files };
      await compile(merged);
      req.body.revision = row.revision;
      const updated = save(
        req,
        merged,
        "Applied AI: " + payload.summary.slice(0, 100),
      );
      db.prepare("DELETE FROM proposals WHERE id=?").run(row.id);
      res.json(updated);
    },
  );
  app.get("/api/projects/:id/history", (req, res) => {
    readProject(req.params.id, req.user.id);
    res.json(
      db
        .prepare(
          "SELECT id,label,created_at FROM snapshots WHERE project_id=? ORDER BY rowid DESC LIMIT 100",
        )
        .all(req.params.id),
    );
  });
  app.post("/api/projects/:id/history/:snapshotId/restore", (req, res) => {
    readProject(req.params.id, req.user.id);
    const snap = db
      .prepare("SELECT * FROM snapshots WHERE id=? AND project_id=?")
      .get(req.params.snapshotId, req.params.id);
    if (!snap) throw fail("Snapshot not found", 404);
    res.json(save(req, JSON.parse(snap.files), "Restored version"));
  });
  app.get("/api/projects/:id/export", async (req, res) => {
    const p = readProject(req.params.id, req.user.id);
    const zip = new JSZip();
    for (const [name, content] of Object.entries(p.files))
      zip.file(name, content);
    zip.file(
      "package.json",
      JSON.stringify(
        {
          name: "visionforge-project",
          version: "1.0.0",
          private: true,
          type: "module",
          scripts: {
            dev: "vite",
            build: "vite build",
            preview: "vite preview",
          },
          dependencies: { react: "^19.1.0", "react-dom": "^19.1.0" },
          devDependencies: { vite: "^6.3.0", typescript: "^5.8.0" },
        },
        null,
        2,
      ),
    );
    zip.file(
      "index.html",
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>My website</title></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>',
    );
    zip.file(
      "tsconfig.json",
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "ESNext",
            moduleResolution: "Bundler",
            jsx: "react-jsx",
            esModuleInterop: true,
            skipLibCheck: true,
          },
        },
        null,
        2,
      ),
    );
    zip.file(".dockerignore", "node_modules\ndist\n.env\n.git\n");
    zip.file(
      "main.tsx",
      `import React from 'react';import {createRoot} from 'react-dom/client';import App from './src/App';createRoot(document.getElementById('root')!).render(<App/>);`,
    );
    zip.file(
      "README.md",
      "# " +
        p.name +
        "\n\nRun `npm install`, then `npm run dev`. Production: `npm run build`.\n\nThis export contains the complete React frontend. No backend or database was generated by the Phase 1 runtime.\n",
    );
    zip.file(".gitignore", "node_modules/\ndist/\n.env\n");
    zip.file(
      ".env.example",
      "# Never put private credentials in VITE_ variables.\n",
    );
    zip.file(
      "Dockerfile",
      "FROM node:24-alpine AS build\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\nCOPY . .\nRUN npm run build\nFROM nginx:alpine\nCOPY --from=build /app/dist /usr/share/nginx/html\nEXPOSE 80\n",
    );
    res
      .set({
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="visionforge-project.zip"',
      })
      .send(await zip.generateAsync({ type: "nodebuffer" }));
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "API endpoint not found" }),
  );
  app.use((error, req, res, next) => {
    res.status(error.status || (error instanceof z.ZodError ? 400 : 400)).json({
      error:
        error instanceof z.ZodError
          ? error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ")
          : error.message || "Request failed",
    });
  });
  return { app, db };
}
