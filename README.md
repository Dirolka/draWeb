# Draweb (VisionForge AI)

A working Phase 1 visual React development workspace. The platform runs locally with a Node API, React/TypeScript frontend, SQLite persistence, Monaco editor, and real model-provider integrations. It is an MVP foundation, not the entire four-phase production platform.

## Diploma project

Draweb helps users turn a website idea or reference image into an editable React prototype. Target users are people prototyping websites who need to inspect generated source and refine the result visually. The expected outcome of the current phase is a locally runnable workspace with source editing, reviewed AI changes, persistence, preview and export.

The current implementation is a Phase 1 MVP. The existing application/package name is VisionForge AI; the repository name is Draweb.

### Team and project links

| Role | Member | Responsibilities |
| --- | --- | --- |
| Repository contributor | Zholdubayev Diyar ([Dirolka](https://github.com/Dirolka)) | Initial local import; detailed component ownership to be confirmed by the team |
| Second student | [cybertora](https://github.com/cybertora) (full name to be supplied) | Responsibilities to be agreed and recorded before new tasks |
| Supervisor | To be supplied | Academic supervision and agreed review checkpoints |

- YouTrack project: to be supplied.
- Project documentation: [documentation index](docs/README.md).
- Contribution process: [CONTRIBUTING.md](CONTRIBUTING.md).
- Import history: [development history](docs/development-history.md).

Member details, links and responsibilities above are incomplete; they must be filled in before a pre-defense submission. The import does not establish authorship of every existing component.

## Run

Requires **Node.js 24+**.

```sh
npm ci
npm run dev
```

Open **http://localhost:3000**. Create an account and choose **Explore a starter** to open a working React website, or create a blank project.

```sh
npm test       # compiler, AI adapter, and API integration tests
npm run build # TypeScript check and production frontend bundle
npm run test:browser # isolated browser workflow; requires installed Google Chrome and dist/
npm start     # serve the production bundle and API
```

The server binds to loopback by default. `PORT` changes the listening port. Environment variables must be set in the process; `.env.example` documents optional settings and is not automatically loaded.

## Try the complete workflow

1. Create an account. Accounts and sessions are stored in SQLite.
2. Open **AI settings** and configure OpenAI or Anthropic, your API key, and a vision-capable model ID available to your account. API keys stay encrypted on the server. You pay your provider for model usage.

   Suggested OpenAI model: `gpt-5.4-mini`, which supports image input and coding tasks. Model selection is saved per account in Settings, not hardcoded in the frontend. See the [model documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini).
3. Create a project. Upload a PNG, JPEG, or WebP reference (up to 5 MB), and describe the website and its behavior in the assistant.
4. The server sends the reference and source to the provider and validates the returned files. Proposed changes compile before review. Invalid responses and provider errors are displayed; no generated success is simulated.
5. Review the file diff and approve it. Applying changes updates actual source, saves a snapshot, and rebuilds the preview. Ambiguous behavior can return clarification questions instead.
6. Toggle the select tool and click an element in the preview. Edit text, color, background, size, padding, width, or corner radius. **Apply to source** changes the JSX AST, preserving unrelated code. Dynamic style expressions and nested text are explicitly protected.
7. Open **Code**, edit or create source files, and press **Ctrl/Cmd+S**. The preview compiles the saved source. Syntax/build failures appear in the canvas; runtime errors appear in Console. Source remains editable even when it fails compilation.
8. Test responsive widths, click real links, and submit local React forms. The Atelier starter explicitly labels its local-only form behavior.
9. Use **Version history** to restore earlier source. Conflicting updates from another tab are rejected rather than overwritten.
10. **Export** downloads a ZIP containing all source, a Vite package manifest, HTML entry, README, environment template, and Dockerfile. Run `npm install && npm run dev` in the extracted project.

## Implemented scope

- Registration, login/logout, scrypt password hashing, expiring HttpOnly sessions.
- Per-user project creation, listing/search, rename, duplication, deletion, persistent files and references.
- Server-side encrypted OpenAI Responses and Anthropic Messages adapters; real image and text input; persisted conversation history.
- AI proposals, source diffs, explicit approval, compilation checks, stale-proposal rejection, snapshots and restore.
- JSX-aware visual editing of static text and styles without deleting custom handlers or expressions.
- Locally bundled Monaco with file creation/deletion, syntax diagnostics, formatting command, autocomplete, search, and split preview.
- Real compiled React preview, desktop/tablet/mobile widths, zoom, element selection, runtime errors, external preview tab.
- Dark/light themes, responsive dashboard, collapsible panels, and full-source ZIP export.

## Architecture

The platform UI uses a restrained, neutral design: system typography, flat surfaces, thin borders, and a monochrome palette in both light and dark themes. New sessions default to the light theme; an existing appearance preference is preserved. The platform does not restyle user project source or exported websites.

| Module | Responsibility |
| --- | --- |
| `server/app.js` | Authenticated API, project ownership, revision checks, snapshots, uploads, exports |
| `server/store.js` | SQLite schema, password hashing, authenticated encryption |
| `server/ai.js` | Provider-independent request/response boundary and proposal validation |
| `server/code.js` | Restricted in-memory bundler, JSX AST editing, sandbox preview document |
| `server/templates.js` | Executable starter projects |
| `src/App.tsx` | Dashboard, authentication, editor, AI review, properties and settings |
| `src/CodeEditor.tsx` | Monaco and local language workers |
| `tests/platform.test.js` | Compiler, preservation, adapter contracts and authenticated API workflow |

Generation never executes server-side user code, installs requested packages, or accesses project paths on disk. Project files are stored as data and bundled through a virtual filesystem. Only React/React DOM packages are supported in the Phase 1 runtime. The bundler resolves relative imports between allowed source files and rejects other packages or filesystem imports.

The preview iframe has `sandbox="allow-scripts allow-forms"` without same-origin privileges. Form events can run React handlers; CSP `form-action 'none'` blocks network submissions. The CSP also blocks fetch/XHR and external scripts; HTTPS images and Google Fonts are allowed. Selection messages are checked against both iframe identity and a random channel. No credentials are sent to generated code. The separate preview tab uses the same iframe sandbox.

## Persistence and credentials

Runtime files live in ignored `data/` (or `DATA_DIR`):

- `visionforge.sqlite` and SQLite WAL files: accounts, projects, snapshots, messages, settings, audit records.
- `master.key`: randomly generated AES-256-GCM encryption key. Keep it with your database backup. Losing it makes saved provider keys unreadable.

Set `VISIONFORGE_MASTER_KEY` to a 64-character hexadecimal key to use an externally managed key. Protect the data directory with OS access controls. Settings never return saved key values. Exports never contain platform credentials. Set `SECURE_COOKIES=true` when serving over HTTPS; reverse-proxy deployment and trust configuration require additional setup.

## Verification and limits

Automated tests use an isolated temporary database and controlled AI responses. They exercise actual HTTP endpoints and actual React compilation. They do **not** establish live model quality or provider availability. Live screenshot-to-code output requires a configured paid provider and must be reviewed for visual fidelity and behavior.

The browser verification script serves the production build against a temporary database, uses headless Chrome, and cleans up its accounts and files. Screenshots are written under ignored `test-results/`.

This release is not hardened for public multi-tenant hosting. The iframe isolates browser privileges, but it is not a CPU/memory-limited container; an infinite loop can stall its browser process. Rate limits are in-memory. SQLite is a single-host database. Password reset, email verification, MFA, quotas, distributed job queues, accessibility audits, operational monitoring and production load tests remain to be implemented.

Monaco provides syntax diagnostics and built-in editor commands; browser semantic TypeScript diagnostics are disabled until project dependency types are loaded into its worker. Compilation checks are not behavioral test results. The platform never claims generated application tests passed just because code compiles.

## Next phases

- **Phase 2:** drawing/sketch conversion, component drag-and-drop, layers/groups, undo/redo, breakpoint-specific property editing, robust AST reconciliation and dependency-aware TypeScript diagnostics.
- **Phase 3:** isolated container runtimes with resource limits, backend generation/execution, database schemas and migrations, generated authentication and end-to-end application testing.
- **Phase 4:** GitHub export, provider deployment adapters, collaboration, shared revision control, production security and performance work.

These capabilities are not represented by fake active controls. No deployment occurs from the Phase 1 UI.

## Provider references

OpenAI JSON mode requires an explicit JSON instruction in the input messages. The adapter includes it for both text-only and image requests, in addition to its developer instructions. If an older running server reports that input messages must contain `json`, restart it after updating and retry generation; adding `json` to your own prompt is unnecessary.

- [OpenAI image inputs](https://developers.openai.com/api/docs/guides/images-vision)
- [OpenAI Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create)
- [Anthropic vision](https://platform.claude.com/docs/en/build-with-claude/vision)
- [esbuild API](https://esbuild.github.io/api/)
