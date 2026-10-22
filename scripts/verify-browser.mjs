import { chromium } from "@playwright/test";
import { createApp } from "../server/app.js";
import express from "express";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import JSZip from "jszip";

// Uses installed Chrome. All accounts and projects are isolated in a temporary database.
const directory = mkdtempSync(path.join(tmpdir(), "vf-browser-"));
const { app, db } = createApp({ directory });
app.use(express.static("dist"));
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base);
  await page.getByLabel("Your name", { exact: true }).fill("Browser Tester");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("browser@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("browser-testing-password");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open starter project", exact: true })
    .click();
  const preview = page.frameLocator('iframe[title="Website live preview"]');
  await preview
    .getByRole("heading", { name: "Good design. Great possibilities." })
    .waitFor();
  console.log("PASS registration, project creation, compiled React preview");

  // Verify hash navigation stays in the generated document, and React events run.
  await preview.getByRole("link", { name: "Let's talk" }).click();
  await preview
    .getByPlaceholder("Your email address")
    .fill("inquiry@example.com");
  await preview.getByRole("button", { name: "Let's connect" }).click();
  await preview
    .getByRole("status")
    .filter({ hasText: "This demo confirms locally" })
    .waitFor();
  console.log("PASS preview navigation and actual form event handling");

  await page
    .getByRole("button", { name: "Select an element", exact: true })
    .click();
  await preview
    .getByText("Leave your email to join our local project inquiry list.")
    .click();
  await page
    .getByRole("textbox", { name: "Text", exact: true })
    .fill("Edited <visually> & {safely}");
  await page
    .getByRole("textbox", { name: "Text color", exact: true })
    .fill("#546d40");
  await page
    .getByRole("button", { name: "Apply to source", exact: true })
    .click();
  await preview
    .getByText("Edited <visually> & {safely}", { exact: true })
    .waitFor();
  console.log(
    "PASS visual text/style edits, special characters and source synchronization",
  );

  await page.getByRole("button", { name: "Code", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Editor content" });
  await editor.waitFor();
  // Monaco paints text above its accessibility textarea; focus the textarea for keyboard editing.
  await editor.focus();
  await page.keyboard.press("Control+End");
  await page.keyboard.insertText("\n// Preserved manual source edit\n");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByRole("button", { name: "Save", exact: true })
    .waitFor({ state: "visible" });
  await page.waitForFunction(
    () => document.querySelector("button[title]") !== null,
  );
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloadEvent;
  const zip = await JSZip.loadAsync(
    await (await import("node:fs/promises")).readFile(await download.path()),
  );
  const source = await zip.file("src/App.tsx").async("string");
  assert.match(source, /Preserved manual source edit/);
  assert.match(source, /&lt;visually&gt;/);
  assert.ok(zip.file("Dockerfile"));
  assert.equal(
    JSON.parse(await zip.file("tsconfig.json").async("string")).compilerOptions
      .jsx,
    "react-jsx",
  );
  console.log("PASS Monaco editing, saved source and complete ZIP export");

  await page.getByRole("button", { name: "Design", exact: true }).click();
  await page
    .getByRole("button", { name: "Reference image", exact: true })
    .click();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "reference.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
  await page.getByAltText("Uploaded website reference").waitFor();
  await page
    .getByRole("button", { name: "AI assistant", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Message AI assistant" })
    .fill("Generate a website from this reference");
  await page
    .getByRole("button", { name: "Generate changes", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Connect an AI provider in Settings" })
    .waitFor();
  console.log("PASS persisted image upload and honest missing-provider error");

  await page
    .getByRole("button", { name: "mobile preview", exact: true })
    .click();
  assert.equal(
    await page.locator("iframe").evaluate((el) => el.clientWidth),
    388,
  );
  await page
    .getByRole("button", { name: "desktop preview", exact: true })
    .click();
  await page.getByRole("button", { name: "Toggle theme", exact: true }).click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await page.getByRole("button", { name: "Toggle theme", exact: true }).click();
  await page.getByRole("button", { name: "Files", exact: true }).click();
  await page
    .getByRole("button", { name: "Select an element", exact: true })
    .click();
  mkdirSync("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/editor-desktop.png" });
  await page.getByRole("button", { name: "All projects", exact: true }).click();
  await page.reload();
  await page
    .getByRole("heading", { name: "Atelier — Studio website" })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/dashboard-mobile.png" });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  assert.equal(overflow, false);
  assert.deepEqual(errors, []);
  console.log(
    "PASS session/project persistence, responsive layout, themes; no browser exceptions",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(directory, { recursive: true, force: true });
}
