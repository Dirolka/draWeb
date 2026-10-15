import { createApp } from "./app.js";
import express from "express";
import path from "node:path";
const { app } = createApp();
if (process.argv.includes("--production")) {
  app.use(express.static("dist"));
  app.get("/{*path}", (req, res) =>
    res.sendFile(path.resolve("dist/index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 3000);
app.listen(port, "127.0.0.1", () =>
  console.log(`VisionForge AI is running at http://localhost:${port}`),
);
