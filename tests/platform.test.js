import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/app.js";
import {
  compile,
  visualEdit,
  validateFiles,
  previewHtml,
} from "../server/code.js";
import { starterFiles, blankFiles } from "../server/templates.js";
import { generateProposal } from "../server/ai.js";
import JSZip from "jszip";

test("Real React compilation, visual source edits, and code preservation", async () => {
  const bundle = await compile(starterFiles, true);
  assert.ok(bundle.js.includes("data-vf-id"));
  assert.ok(bundle.js.length > 10000);
  assert.ok(bundle.css.includes(".hero"));
  const edited = visualEdit(blankFiles, "src/App.tsx:1", {
    text: "A new idea",
    style: { color: "#ff0000" },
  });
  assert.match(edited["src/App.tsx"], /A new idea/);
  assert.match(edited["src/App.tsx"], /#ff0000/);
  await compile(edited);
  const special = visualEdit(blankFiles, "src/App.tsx:1", {
    text: "<Hello> & {world}",
  });
  await compile(special);
  assert.match(special["src/App.tsx"], /&lt;Hello&gt; &amp; &#123;world&#125;/);
  const custom = {
    "src/App.tsx": `import React from 'react';export default function App(){ const color='red';return <button onClick={()=>alert('keep me')} style={{color}}>Click me</button> }`,
  };
  const updated = visualEdit(custom, "src/App.tsx:0", {
    style: { padding: "10px" },
  });
  assert.match(updated["src/App.tsx"], /keep me/);
  assert.match(updated["src/App.tsx"], /color,/);
  const dynamic = {
    "src/App.tsx": `import React from 'react';export default function App(){const styles={};return <div style={styles}><span>Hello</span></div>}`,
  };
  assert.throws(
    () => visualEdit(dynamic, "src/App.tsx:0", { style: { padding: "2px" } }),
    /Dynamic styles/,
  );
  assert.throws(
    () => visualEdit(dynamic, "src/App.tsx:0", { text: "overwrite" }),
    /custom code or nested/,
  );
  assert.throws(
    () => validateFiles({ ...blankFiles, "src/../../secret.ts": "x" }),
    /Unsupported/,
  );
  await assert.rejects(
    compile({
      "src/App.tsx": `import fs from 'node:fs';export default function App(){return <div>{fs.readFileSync('/etc/passwd')}</div>}`,
    }),
    /not available/,
  );
  const html = previewHtml(bundle, "test-channel");
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /form-action 'none'/);
});

test("AI adapters send actual images and parse source changes without applying them", async () => {
  const calls = [];
  const mockFetch = async (url, options) => {
    calls.push({
      url,
      body: JSON.parse(options.body),
      headers: options.headers,
    });
    return {
      ok: true,
      json: async () =>
        url.includes("anthropic")
          ? {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    summary: "A change",
                    questions: [],
                    files: blankFiles,
                  }),
                },
              ],
            }
          : {
              output: [
                {
                  content: [
                    {
                      type: "output_text",
                      text: JSON.stringify({
                        summary: "A change",
                        questions: [],
                        files: blankFiles,
                      }),
                    },
                  ],
                },
              ],
            },
    };
  };
  const image = "data:image/png;base64,aGVsbG8=";
  for (const provider of ["openai", "anthropic"]) {
    const result = await generateProposal(
      { provider, apiKey: "test-key", model: "test-model" },
      { prompt: "Build this", files: blankFiles, image },
      mockFetch,
    );
    assert.equal(result.files["src/App.tsx"], blankFiles["src/App.tsx"]);
  }
  assert.equal(calls[0].body.input[0].content[0].image_url, image);
  assert.equal(calls[1].body.messages[0].content[0].source.data, "aGVsbG8=");
  await assert.rejects(
    generateProposal({}, { prompt: "x", files: blankFiles }),
    /Connect an AI provider/,
  );
  await assert.rejects(
    generateProposal(
      { provider: "openai", apiKey: "secret", model: "model" },
      { prompt: "x", files: blankFiles },
      async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: "bad secret" } }),
      }),
    ),
    /\[redacted\]/,
  );
});

test("OpenAI JSON mode explicitly requests JSON in input messages with and without an image", async () => {
  for (const image of [undefined, "data:image/png;base64,aGVsbG8="]) {
    await generateProposal(
      { provider: "openai", apiKey: "test-key", model: "test-model" },
      {
        prompt: "Make the heading larger",
        files: {
          "src/App.tsx":
            "export default function App() { return <h1>Hello</h1>; }",
        },
        image,
      },
      async (_url, options) => {
        const body = JSON.parse(options.body);
        assert.equal(body.text.format.type, "json_object");
        const inputText = body.input
          .flatMap((message) => message.content)
          .filter((part) => part.type === "input_text")
          .map((part) => part.text)
          .join("\n");
        // Check only actual input text: the instructions and format fields do not count.
        assert.match(inputText, /\bJSON\b/i);
        assert.match(inputText, /Make the heading larger/);
        assert.equal(
          body.input[0].content.filter((part) => part.type === "input_image")
            .length,
          image ? 1 : 0,
        );
        return {
          ok: true,
          json: async () => ({
            output: [
              {
                content: [
                  {
                    type: "output_text",
                    text: '{"summary":"Ready","questions":[],"files":{}}',
                  },
                ],
              },
            ],
          }),
        };
      },
    );
  }
});

test("Authenticated end-to-end project lifecycle, proposal approval, isolation and export", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "visionforge-test-"));
  let aiInput;
  const { app, db } = createApp({
    directory,
    ai: async (config, input) => {
      aiInput = input;
      return {
        summary: "Change heading",
        questions: [],
        files: {
          "src/App.tsx": input.files["src/App.tsx"].replace(
            "Your next big idea.",
            "AI-generated heading",
          ),
        },
      };
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let cookie = "";
  async function request(path, method = "GET", body, customCookie = cookie) {
    const r = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", cookie: customCookie },
      body: method === "GET" ? undefined : JSON.stringify(body || {}),
    });
    if (r.headers.get("set-cookie"))
      cookie = r.headers.get("set-cookie").split(";")[0];
    return {
      status: r.status,
      data: r.headers.get("content-type")?.includes("json")
        ? await r.json()
        : await r.arrayBuffer(),
    };
  }
  assert.equal((await request("/projects")).status, 401);
  assert.equal(
    (
      await request("/auth/register", "POST", {
        name: "Builder",
        email: "one@example.com",
        password: "long-password",
      })
    ).status,
    200,
  );
  const ownerCookie = cookie;
  let p = (await request("/projects", "POST", { name: "Test project" })).data;
  const original = p.files;
  assert.equal(
    (await request("/projects/" + p.id + "/preview", "POST")).status,
    200,
  );
  const changed = {
    ...p.files,
    "src/App.tsx": p.files["src/App.tsx"].replace(
      "Your next big idea.",
      "Manual edit",
    ),
  };
  p = (
    await request("/projects/" + p.id + "/files", "PUT", {
      files: changed,
      revision: 0,
    })
  ).data;
  assert.equal(p.revision, 1);
  assert.equal(
    (
      await request("/projects/" + p.id + "/files", "PUT", {
        files: original,
        revision: 0,
      })
    ).status,
    409,
  );
  const h = (await request("/projects/" + p.id + "/history")).data;
  assert.equal(h.length, 1);
  p = (
    await request(
      "/projects/" + p.id + "/history/" + h[0].id + "/restore",
      "POST",
      { revision: p.revision },
    )
  ).data;
  assert.deepEqual(p.files, original);
  const proposed = (
    await request("/projects/" + p.id + "/generate", "POST", {
      prompt: "Change heading",
    })
  ).data;
  assert.deepEqual((await request("/projects/" + p.id)).data.files, original);
  assert.equal(aiInput.prompt, "Change heading");
  p = (
    await request(
      "/projects/" + p.id + "/proposals/" + proposed.id + "/apply",
      "POST",
    )
  ).data;
  assert.match(p.files["src/App.tsx"], /AI-generated heading/);
  const stale = (
    await request("/projects/" + p.id + "/generate", "POST", {
      prompt: "Change again",
    })
  ).data;
  p = (
    await request("/projects/" + p.id + "/files", "PUT", {
      files: p.files,
      revision: p.revision,
    })
  ).data;
  assert.equal(
    (
      await request(
        "/projects/" + p.id + "/proposals/" + stale.id + "/apply",
        "POST",
      )
    ).status,
    409,
  );
  const zipResult = await request("/projects/" + p.id + "/export");
  const zip = await JSZip.loadAsync(zipResult.data);
  assert.equal(
    await zip.file("src/App.tsx").async("string"),
    p.files["src/App.tsx"],
  );
  assert.ok(zip.file("Dockerfile"));
  assert.ok(zip.file("package.json"));
  assert.equal(
    (
      await request("/settings", "PUT", {
        provider: "openai",
        model: "test-model",
        apiKey: "private-test-key",
      })
    ).status,
    200,
  );
  const settings = (await request("/settings")).data;
  assert.equal(settings.configured, true);
  assert.equal(settings.apiKey, undefined);
  assert.ok(
    !db
      .prepare("SELECT value FROM settings")
      .get()
      .value.includes("private-test-key"),
  );
  assert.equal(
    (
      await request("/projects/" + p.id + "/image", "PUT", {
        image: "data:image/png;base64,aGVsbG8=",
      })
    ).status,
    400,
  );
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
  assert.equal(
    (await request("/projects/" + p.id + "/image", "PUT", { image: png }))
      .status,
    200,
  );
  assert.equal((await request("/projects/" + p.id)).data.image, png);
  await request("/auth/register", "POST", {
    email: "two@example.com",
    password: "long-password",
  });
  assert.equal((await request("/projects/" + p.id)).status, 404);
  assert.equal((await request("/projects/" + p.id + "/export")).status, 404);
  assert.equal(
    (
      await request("/projects/" + p.id + "/files", "PUT", {
        files: original,
        revision: p.revision,
      })
    ).status,
    404,
  );
  const evil = await fetch(base + "/projects", {
    method: "POST",
    headers: {
      cookie: ownerCookie,
      "Content-Type": "application/json",
      Origin: "https://evil.example",
    },
    body: JSON.stringify({ name: "bad" }),
  });
  assert.equal(evil.status, 403);
  cookie = ownerCookie;
  assert.equal((await request("/projects/" + p.id, "DELETE")).status, 200);
  assert.equal((await request("/projects/" + p.id)).status, 404);
  await request("/auth/logout", "POST");
  assert.equal((await request("/auth/me")).status, 401);
});
