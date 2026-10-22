import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowUp,
  ArrowUpRight,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Download,
  FileCode2,
  Folder,
  Globe,
  History,
  ImagePlus,
  Layers,
  LayoutGrid,
  Loader2,
  LogOut,
  Maximize2,
  Monitor,
  Moon,
  MousePointer2,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  MessageSquare,
  Square,
  Sun,
  Tablet,
  Trash2,
  Upload,
  SlidersHorizontal,
  X,
  RefreshCw,
  Save,
  Terminal,
  CircleHelp,
  Paintbrush,
  PanelRightClose,
} from "lucide-react";
import {
  api,
  type Files,
  type Message,
  type Project,
  type Proposal,
  type User,
} from "./api";
const CodeEditor = lazy(() => import("./CodeEditor"));
const CodeDiff = lazy(() =>
  import("./CodeEditor").then((m) => ({ default: m.CodeDiff })),
);
type Selection = {
  id: string;
  tag: string;
  text: string;
  simple: boolean;
  style: Record<string, string>;
};
function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="logo">
      <span className="logo-mark">
        <Code2 size={20} />
      </span>
      {!compact && (
        <>
          <span>
            VisionForge<span className="logo-ai">AI</span>
          </span>
          <span className="beta">BETA</span>
        </>
      )}
    </div>
  );
}
function IconButton({
  label,
  children,
  onClick,
  active = false,
  disabled = false,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      className={"icon-button " + (active ? "active" : "")}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={"modal " + (wide ? "wide" : "")}
      onCancel={onClose}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <IconButton label="Close dialog" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [loaded, setLoaded] = useState(false),
    [project, setProject] = useState<Project | null>(null),
    [settings, setSettings] = useState(false),
    [light, setLight] = useState(localStorage.getItem("vf-theme") !== "dark"),
    [toast, setToast] = useState("");
  useEffect(() => {
    api<User>("/auth/me")
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = light ? "light" : "dark";
    localStorage.setItem("vf-theme", light ? "light" : "dark");
  }, [light]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 6500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const logout = async () => {
    await api("/auth/logout", "POST");
    setProject(null);
    setUser(null);
  };
  if (!loaded)
    return (
      <div className="loading-screen">
        <Logo />
        <Loader2 className="spin" />
      </div>
    );
  return (
    <>
      {!user ? (
        <Auth onLogin={setUser} />
      ) : project ? (
        <Workspace
          project={project}
          onProject={setProject}
          onBack={() => setProject(null)}
          onSettings={() => setSettings(true)}
          light={light}
          toggleTheme={() => setLight(!light)}
          notify={setToast}
        />
      ) : (
        <Dashboard
          user={user}
          onOpen={setProject}
          onSettings={() => setSettings(true)}
          onLogout={logout}
          light={light}
          toggleTheme={() => setLight(!light)}
          notify={setToast}
        />
      )}
      {settings && (
        <SettingsModal onClose={() => setSettings(false)} notify={setToast} />
      )}{" "}
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </>
  );
}
function Auth({ onLogin }: { onLogin: (u: User) => void }) {
  const [register, setRegister] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      onLogin(
        await api("/auth/" + (register ? "register" : "login"), "POST", data),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-story">
        <Logo />
        <div className="auth-intro">
          <span className="eyebrow">WEBSITE WORKSPACE</span>
          <h1>
            Design, code,
            <br />
            and preview.
          </h1>
          <p>
            A workspace for building websites.
            <br />
            Start from a reference or edit your source directly.
          </p>
          <div className="auth-features">
            <div>
              <span>01</span> Visual editing
            </div>
            <div>
              <span>02</span> Source code access
            </div>
            <div>
              <span>03</span> Project history and export
            </div>
          </div>
        </div>
        <small>VisionForge · Local workspace</small>
      </div>
      <div className="auth-form-wrap">
        <span className="eyebrow">ACCOUNT</span>
        <h2>{register ? "Create an account" : "Sign in"}</h2>
        <p>
          {register
            ? "Create your account to start building with VisionForge."
            : "Sign in and pick up where you left off."}
        </p>
        <form onSubmit={submit}>
          {register && (
            <label>
              Your name
              <input
                name="name"
                placeholder="Alex Morgan"
                required
                maxLength={80}
                autoComplete="name"
              />
            </label>
          )}
          <label>
            Email address
            <input
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              placeholder="At least 10 characters"
              minLength={10}
              maxLength={200}
              autoComplete={register ? "new-password" : "current-password"}
              required
            />
          </label>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <button className="primary full" disabled={busy}>
            {busy ? (
              <Loader2 size={16} className="spin" />
            ) : register ? (
              "Create workspace"
            ) : (
              "Sign in"
            )}
            {!busy && <ArrowUpRight size={17} />}
          </button>
        </form>
        <p className="auth-switch">
          {register ? "Already have an account?" : "New to VisionForge?"}{" "}
          <button
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register ? "Sign in" : "Create an account"}
          </button>
        </p>
        <div className="privacy-note">
          <ShieldCheck size={17} />
          <span>
            Your projects stay in your local workspace.
            <br />
            Connect your own AI provider when you’re ready.
          </span>
        </div>
      </div>
    </div>
  );
}
function Dashboard({
  user,
  onOpen,
  onSettings,
  onLogout,
  light,
  toggleTheme,
  notify,
}: {
  user: User;
  onOpen: (p: Project) => void;
  onSettings: () => void;
  onLogout: () => void;
  light: boolean;
  toggleTheme: () => void;
  notify: (s: string) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]),
    [search, setSearch] = useState(""),
    [creating, setCreating] = useState(false),
    [busy, setBusy] = useState(false);
  const refresh = () =>
    api<Project[]>("/projects")
      .then(setProjects)
      .catch((e) => notify(e.message));
  useEffect(() => {
    refresh();
  }, []);
  const create = async (name: string, template = "blank") => {
    setBusy(true);
    try {
      onOpen(await api("/projects", "POST", { name, template }));
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  async function remove(p: Project) {
    if (
      !confirm(`Delete “${p.name}” and all its history? This cannot be undone.`)
    )
      return;
    try {
      await api("/projects/" + p.id, "DELETE");
      refresh();
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return (
    <div className="dashboard">
      <aside className="dash-sidebar">
        <Logo />
        <div className="workspace-label">
          <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
          <div>
            {user.name}’s workspace<small>Personal workspace</small>
          </div>
        </div>
        <span className="nav-label">WORKSPACE</span>
        <button className="side-nav active">
          <LayoutGrid size={17} /> All projects <span>{projects.length}</span>
        </button>
        <button className="side-nav" onClick={onSettings}>
          <Settings size={17} /> AI settings
        </button>
        <div className="side-bottom">
          <div className="local-note">
            <ShieldCheck size={18} />
            <b>Local workspace</b>
            <p>
              Projects saved locally.
              <br />
              Export at any time.
            </p>
          </div>
          <button className="side-nav" onClick={toggleTheme}>
            {light ? <Moon size={17} /> : <Sun size={17} />}{" "}
            {light ? "Dark" : "Light"} appearance
          </button>
          <button className="side-nav" onClick={onLogout}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>
      <main className="dash-content">
        <header>
          <span>
            Workspace <ChevronRight size={14} /> All projects
          </span>
          <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
        </header>
        <div className="dash-inner">
          <div className="dash-title">
            <div>
              <div className="eyebrow">WORKSPACE</div>
              <h1>Projects</h1>
              <p>Create a website or continue an existing project.</p>
            </div>
            <button className="primary" onClick={() => setCreating(true)}>
              <Plus size={17} /> New project
            </button>
          </div>
          <div className="start-grid">
            <button onClick={() => setCreating(true)}>
              <span className="start-icon purple">
                <MessageSquare />
              </span>
              <h3>
                Start with a prompt <ArrowUpRight size={17} />
              </h3>
              <p>Describe the website you want to build.</p>
            </button>
            <button
              onClick={() => create("Untitled image project")}
              disabled={busy}
            >
              <span className="start-icon blue">
                <ImagePlus />
              </span>
              <h3>
                Upload a reference <ArrowUpRight size={17} />
              </h3>
              <p>Turn a screenshot into editable code.</p>
            </button>
            <button
              onClick={() => create("Atelier — Studio website", "atelier")}
              disabled={busy}
            >
              <span className="start-icon green">
                <LayoutGrid />
              </span>
              <h3>
                Explore a starter <ArrowUpRight size={17} />
              </h3>
              <p>Open a working React studio website.</p>
            </button>
          </div>
          <div className="projects-header">
            <h2>
              All projects <span>{projects.length}</span>
            </h2>
            <label className="search">
              <Search size={15} />
              <input
                placeholder="Search projects…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          {!projects.length ? (
            <div className="empty-projects">
              <div className="empty-art">
                <Folder size={36} />
                <MessageSquare size={18} />
              </div>
              <h3>No projects yet</h3>
              <p>
                Create your first project, or explore the Atelier starter
                <br />
                to try the visual editor and live code preview.
              </p>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => create("Atelier — Studio website", "atelier")}
              >
                Open starter project <ArrowUpRight size={15} />
              </button>
            </div>
          ) : (
            <div className="project-grid">
              {projects
                .filter((p) =>
                  p.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((p, i) => (
                  <article className="project-card" key={p.id}>
                    <button
                      className={"project-cover cover-" + (i % 3)}
                      onClick={async () => {
                        try {
                          onOpen(await api("/projects/" + p.id));
                        } catch (e) {
                          notify((e as Error).message);
                        }
                      }}
                    >
                      <div className="cover-browser">
                        <span />
                        <span />
                        <span />
                        <div className="cover-layout">
                          <i />
                          <i />
                          <i />
                        </div>
                      </div>
                      <span className="project-type">
                        <Code2 size={11} /> React project
                      </span>
                    </button>
                    <div className="project-card-info">
                      <h3>{p.name}</h3>
                      <small>
                        Edited {new Date(p.updated_at).toLocaleDateString()}
                      </small>
                      <div className="project-actions">
                        <IconButton
                          label="Duplicate project"
                          onClick={async () => {
                            try {
                              await api("/projects", "POST", {
                                name: p.name + " copy",
                                duplicateId: p.id,
                              });
                              refresh();
                            } catch (e) {
                              notify((e as Error).message);
                            }
                          }}
                        >
                          <Copy size={14} />
                        </IconButton>
                        <IconButton
                          label="Delete project"
                          onClick={() => remove(p)}
                        >
                          <Trash2 size={14} />
                        </IconButton>
                      </div>
                    </div>
                  </article>
                ))}
            </div>
          )}
          <div className="dash-footer">
            <span>
              <span className="status-dot" /> Local workspace connected
            </span>
            <span>VisionForge</span>
          </div>
        </div>
      </main>
      {creating && (
        <Modal title="Create a project" onClose={() => setCreating(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              create(String(f.get("name")));
            }}
          >
            <p>Add a name. You can upload references in the editor.</p>
            <label>
              Project name
              <input
                name="name"
                autoFocus
                placeholder="Untitled project"
                required
                maxLength={100}
              />
            </label>
            <button className="primary full" disabled={busy}>
              {busy ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <Plus size={16} />
              )}{" "}
              Create project
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
function SettingsModal({
  onClose,
  notify,
}: {
  onClose: () => void;
  notify: (s: string) => void;
}) {
  const [provider, setProvider] = useState("openai"),
    [model, setModel] = useState(""),
    [key, setKey] = useState(""),
    [configured, setConfigured] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    api("/settings")
      .then((c) => {
        setProvider(c.provider);
        setModel(c.model);
        setConfigured(c.configured);
      })
      .catch((e) => setError(e.message));
  }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/settings", "PUT", {
        provider,
        model,
        apiKey: key || undefined,
      });
      notify("AI settings saved. The next generation will use this model.");
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Connect your AI" onClose={onClose}>
      <div className="settings-banner">
        <ShieldCheck size={22} />
        <div>
          <b>Your key stays on the server</b>
          <p>
            Encrypted at rest. Never included in project exports or browser
            bundles.
          </p>
        </div>
      </div>
      <form onSubmit={save}>
        <label>
          Provider
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setConfigured(false);
              setKey("");
              setModel("");
            }}
          >
            <option value="openai">OpenAI · Responses API</option>
            <option value="anthropic">Anthropic · Messages API</option>
          </select>
        </label>
        <label>
          Vision-capable model
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Enter a model ID from your provider"
            required
            maxLength={120}
          />
        </label>
        <label>
          API key{" "}
          {configured && <span className="green-text">· Connected</span>}
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={
              configured
                ? "Leave blank to keep your saved key"
                : "Paste your API key"
            }
            autoComplete="off"
            required={!configured}
          />
        </label>
        <p className="muted small">
          Generation sends project source, your prompt, and attached references
          to this provider. API usage is billed by your provider.
        </p>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          {configured && (
            <button
              type="button"
              className="secondary"
              onClick={async () => {
                try {
                  await api("/settings", "DELETE");
                  setConfigured(false);
                  setKey("");
                  notify("Provider disconnected");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Disconnect
            </button>
          )}
          <button className="primary" disabled={busy}>
            {busy ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <Check size={16} />
            )}{" "}
            Save configuration
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Workspace({
  project: p,
  onProject,
  onBack,
  onSettings,
  light,
  toggleTheme,
  notify,
}: {
  project: Project;
  onProject: (p: Project) => void;
  onBack: () => void;
  onSettings: () => void;
  light: boolean;
  toggleTheme: () => void;
  notify: (s: string) => void;
}) {
  const [mode, setMode] = useState<"design" | "code">("design"),
    [tab, setTab] = useState<"files" | "reference">("files"),
    [rightTab, setRightTab] = useState<"assistant" | "properties">("assistant"),
    [device, setDevice] = useState("desktop"),
    [selecting, setSelecting] = useState(false),
    [selection, setSelection] = useState<Selection | null>(null),
    [preview, setPreview] = useState({ html: "", channel: "" }),
    [building, setBuilding] = useState(false),
    [buildError, setBuildError] = useState(""),
    [logs, setLogs] = useState<string[]>([]),
    [consoleOpen, setConsoleOpen] = useState(false),
    [draft, setDraft] = useState<Files>(p.files),
    [file, setFile] = useState("src/App.tsx"),
    [saving, setSaving] = useState(false),
    [prompt, setPrompt] = useState(""),
    [messages, setMessages] = useState<Message[]>([]),
    [generating, setGenerating] = useState(false),
    [proposal, setProposal] = useState<Proposal | null>(null),
    [review, setReview] = useState(false),
    [history, setHistory] = useState<any[] | null>(null),
    [zoom, setZoom] = useState(100),
    [hideLeft, setHideLeft] = useState(false),
    [hideRight, setHideRight] = useState(() => window.innerWidth < 600),
    [reference, setReference] = useState<string | null>(p.image),
    [configured, setConfigured] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null),
    imageInput = useRef<HTMLInputElement>(null),
    messagesEnd = useRef<HTMLDivElement>(null),
    buildSequence = useRef(0);
  const dirty = JSON.stringify(draft) !== JSON.stringify(p.files);
  const refreshMessages = () =>
    api<Message[]>(`/projects/${p.id}/messages`)
      .then(setMessages)
      .catch((e) => notify(e.message));
  useEffect(() => {
    setDraft(p.files);
    setSelection(null);
  }, [p.revision]);
  useEffect(() => {
    refreshMessages();
    api<Proposal | null>(`/projects/${p.id}/proposals`)
      .then(setProposal)
      .catch((e) => notify(e.message));
    api("/settings")
      .then((s) => setConfigured(s.configured))
      .catch(() => {});
  }, [p.id]);
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, generating, proposal]);
  const build = useCallback(async () => {
    const seq = ++buildSequence.current;
    setBuilding(true);
    setBuildError("");
    try {
      const result = await api(`/projects/${p.id}/preview`, "POST");
      if (seq !== buildSequence.current) return;
      setPreview(result);
      setLogs((l) => [
        ...l.slice(-49),
        `✓ Compiled revision ${result.revision} in ${result.duration} ms`,
      ]);
    } catch (e) {
      if (seq === buildSequence.current) {
        setBuildError((e as Error).message);
        setLogs((l) => [...l.slice(-49), "✕ " + (e as Error).message]);
      }
    } finally {
      if (seq === buildSequence.current) setBuilding(false);
    }
  }, [p.id, p.revision]);
  useEffect(() => {
    build();
  }, [build]);
  useEffect(() => {
    const handle = (e: MessageEvent) => {
      if (
        e.source !== frame.current?.contentWindow ||
        e.data?.channel !== preview.channel
      )
        return;
      if (e.data.type === "select") {
        setSelection(e.data);
        setRightTab("properties");
        setHideRight(false);
      }
      if (e.data.type === "error") {
        setLogs((l) => [
          ...l.slice(-49),
          "✕ Runtime: " + String(e.data.message),
        ]);
        setConsoleOpen(true);
      }
      if (e.data.type === "log") {
        setLogs((l) => [
          ...l.slice(-49),
          String(e.data.message).slice(0, 2000),
        ]);
      }
      if (e.data.type === "ready")
        frame.current?.contentWindow?.postMessage(
          { channel: preview.channel, selecting },
          "*",
        );
    };
    window.addEventListener("message", handle);
    frame.current?.contentWindow?.postMessage(
      { channel: preview.channel, selecting },
      "*",
    );
    return () => window.removeEventListener("message", handle);
  }, [preview, selecting]);
  const save = useCallback(async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      const updated = await api(`/projects/${p.id}/files`, "PUT", {
        files: draft,
        revision: p.revision,
      });
      onProject(updated);
      notify("Source saved. Preview is rebuilding.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [draft, dirty, p.id, p.revision]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("keydown", key);
    window.addEventListener("beforeunload", leave);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("beforeunload", leave);
    };
  }, [save, dirty]);
  async function upload(file: File) {
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 5000000
    ) {
      notify("Choose a PNG, JPEG, or WebP under 5 MB.");
      return;
    }
    try {
      const url = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      await api(`/projects/${p.id}/image`, "PUT", { image: url });
      setReference(url);
      setTab("reference");
      notify("Reference attached. Describe your website, then generate.");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function generate() {
    if (!prompt.trim() || generating) return;
    if (dirty) {
      notify("Save your source edits before asking AI to modify them.");
      return;
    }
    setGenerating(true);
    setProposal(null);
    const input = prompt;
    setPrompt("");
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: "user", content: input },
    ]);
    try {
      const result = await api<Proposal>(`/projects/${p.id}/generate`, "POST", {
        prompt: input,
        selection: selection?.id,
      });
      setProposal(result);
      await refreshMessages();
      setConfigured(true);
    } catch (e) {
      notify((e as Error).message);
      setPrompt(input);
      await refreshMessages();
    } finally {
      setGenerating(false);
    }
  }
  async function apply() {
    if (!proposal) return;
    setSaving(true);
    try {
      const updated = await api(
        `/projects/${p.id}/proposals/${proposal.id}/apply`,
        "POST",
      );
      onProject(updated);
      setReview(false);
      setProposal(null);
      notify("Changes applied. Previous source is saved in version history.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function openHistory() {
    try {
      setHistory(await api(`/projects/${p.id}/history`));
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function exportZip() {
    if (dirty) {
      notify("Save your source changes before exporting.");
      return;
    }
    try {
      const res = await fetch(`/api/projects/${p.id}/export`);
      if (!res.ok) throw new Error((await res.json()).error);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = p.name.replace(/[^a-z0-9-]/gi, "-") + ".zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify("Complete React source exported.");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  function separatePreview() {
    const win = window.open("", "_blank");
    if (!win) {
      notify("Allow pop-ups to open the preview.");
      return;
    }
    win.opener = null;
    win.document.title = p.name + " — Preview";
    win.document.body.style.margin = "0";
    const iframe = win.document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts allow-forms");
    iframe.style.cssText = "width:100%;height:100vh;border:0";
    iframe.srcdoc = preview.html;
    win.document.body.appendChild(iframe);
  }
  return (
    <div className="editor-shell">
      <header className="editor-header">
        <button
          className="back-logo"
          title="All projects"
          onClick={() => {
            if (!dirty || confirm("Leave without saving your source edits?"))
              onBack();
          }}
        >
          <Logo compact />
        </button>
        <span className="header-divider" />
        <button
          className="project-name"
          onClick={async () => {
            const name = window.prompt("Rename project", p.name);
            if (name?.trim())
              try {
                onProject(
                  await api(`/projects/${p.id}`, "PATCH", {
                    name: name.trim(),
                  }),
                );
              } catch (e) {
                notify((e as Error).message);
              }
          }}
        >
          {p.name}
          <ChevronDown size={14} />
        </button>
        <span className="saved-status">
          {dirty ? (
            <>
              <span className="unsaved-dot" /> Unsaved
            </>
          ) : (
            <>
              <Check size={12} /> Saved
            </>
          )}
        </span>
        <div className="editor-mode">
          <button
            className={mode === "design" ? "active" : ""}
            onClick={() => setMode("design")}
          >
            <MousePointer2 size={14} /> Design
          </button>
          <button
            className={mode === "code" ? "active" : ""}
            onClick={() => setMode("code")}
          >
            <Code2 size={15} /> Code
          </button>
        </div>
        <div className="header-actions">
          <IconButton label="Version history" onClick={openHistory}>
            <History size={17} />
          </IconButton>
          <IconButton label="Toggle theme" onClick={toggleTheme}>
            {light ? <Moon size={17} /> : <Sun size={17} />}
          </IconButton>
          <button
            className="secondary small-button"
            onClick={save}
            disabled={!dirty || saving}
          >
            <Save size={14} />
            {saving ? "Saving" : "Save"}
          </button>
          <button className="primary small-button" onClick={exportZip}>
            <Download size={14} /> Export <ChevronDown size={12} />
          </button>
        </div>
      </header>
      <div className="editor-body">
        <nav className="tool-rail">
          <IconButton
            label="Project files"
            active={tab === "files" && !hideLeft}
            onClick={() => {
              setTab("files");
              setHideLeft(false);
            }}
          >
            <Folder size={20} />
          </IconButton>
          <IconButton
            label="Reference image"
            active={tab === "reference" && !hideLeft}
            onClick={() => {
              setTab("reference");
              setHideLeft(false);
            }}
          >
            <ImagePlus size={20} />
          </IconButton>
          <div className="rail-separator" />
          <IconButton
            label="Select an element"
            active={selecting}
            onClick={() => {
              setSelecting(!selecting);
              setMode("design");
            }}
          >
            <MousePointer2 size={20} />
          </IconButton>
          <IconButton
            label="AI assistant"
            active={rightTab === "assistant" && !hideRight}
            onClick={() => {
              setRightTab("assistant");
              setHideRight(false);
            }}
          >
            <MessageSquare size={20} />
          </IconButton>
          <div className="rail-bottom">
            <IconButton label="AI provider settings" onClick={onSettings}>
              <Settings size={19} />
            </IconButton>
            <IconButton
              label="Editor help"
              onClick={() =>
                notify(
                  "Select: click the cursor tool, then an element. Code: edit and press Ctrl+S. AI: review changes before applying. History: restore previous source.",
                )
              }
            >
              <CircleHelp size={19} />
            </IconButton>
          </div>
        </nav>
        {!hideLeft && (
          <aside className="left-panel">
            <div className="panel-heading">
              <span>Project explorer</span>
              <IconButton
                label="Collapse explorer"
                onClick={() => setHideLeft(true)}
              >
                <PanelLeftClose size={15} />
              </IconButton>
            </div>
            <div className="left-tabs">
              <button
                className={tab === "files" ? "active" : ""}
                onClick={() => setTab("files")}
              >
                Files
              </button>
              <button
                className={tab === "reference" ? "active" : ""}
                onClick={() => setTab("reference")}
              >
                Reference {reference && <span className="tiny-dot" />}
              </button>
            </div>
            {tab === "files" ? (
              <>
                <div className="file-tree">
                  <div className="tree-root">
                    <ChevronDown size={13} />
                    <Folder size={14} /> src{" "}
                    <button
                      aria-label="Create file"
                      title="Create file"
                      onClick={() => {
                        const name = window.prompt(
                          "Source file path (e.g. src/components/Card.tsx)",
                        );
                        if (!name) return;
                        if (
                          !/^src\/[a-zA-Z0-9_./-]+\.(tsx?|jsx?|css|json)$/.test(
                            name,
                          ) ||
                          name.includes("..")
                        )
                          return notify(
                            "Use a source path under src/ with a supported extension.",
                          );
                        if (draft[name] !== undefined)
                          return notify("This file already exists.");
                        setDraft({ ...draft, [name]: "" });
                        setFile(name);
                        setMode("code");
                      }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  {Object.keys(draft).map((f) => (
                    <div
                      key={f}
                      className={"file-row " + (file === f ? "active" : "")}
                    >
                      <button
                        onClick={() => {
                          setFile(f);
                          setMode("code");
                        }}
                      >
                        <FileCode2
                          size={14}
                          className={
                            f.endsWith("css") ? "css-icon" : "tsx-icon"
                          }
                        />
                        {f.replace("src/", "")}{" "}
                        {draft[f] !== p.files[f] && (
                          <span className="tiny-dot" />
                        )}
                      </button>
                      {f !== "src/App.tsx" && (
                        <button
                          className="file-delete"
                          aria-label={"Delete " + f}
                          onClick={() => {
                            if (confirm("Delete " + f + "?")) {
                              const copy = { ...draft };
                              delete copy[f];
                              setDraft(copy);
                              setFile("src/App.tsx");
                              setMode("code");
                            }
                          }}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="project-details">
                  <span className="section-label">PROJECT DETAILS</span>
                  <div>
                    <span>Framework</span>
                    <b>
                      <span className="react-symbol">⚛</span> React
                    </b>
                  </div>
                  <div>
                    <span>Language</span>
                    <b>TypeScript</b>
                  </div>
                  <div>
                    <span>Files</span>
                    <b>{Object.keys(draft).length}</b>
                  </div>
                  <div>
                    <span>Version</span>
                    <b>Revision {p.revision}</b>
                  </div>
                </div>
              </>
            ) : (
              <div
                className="reference-panel"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files[0]) upload(e.dataTransfer.files[0]);
                }}
              >
                {reference ? (
                  <>
                    <img src={reference} alt="Uploaded website reference" />
                    <button
                      className="secondary full"
                      onClick={() => imageInput.current?.click()}
                    >
                      <Upload size={14} /> Replace reference
                    </button>
                    <button
                      className="text-button"
                      onClick={async () => {
                        try {
                          await api(`/projects/${p.id}/image`, "PUT", {
                            image: null,
                          });
                          setReference(null);
                        } catch (e) {
                          notify((e as Error).message);
                        }
                      }}
                    >
                      Remove reference
                    </button>
                  </>
                ) : (
                  <button
                    className="upload-area"
                    onClick={() => imageInput.current?.click()}
                  >
                    <ImagePlus size={30} />
                    <b>Upload a reference</b>
                    <span>
                      Upload a screenshot,
                      <br />
                      wireframe, or sketch
                    </span>
                    <small>PNG, JPG, WEBP · Up to 5 MB</small>
                  </button>
                )}
                <p className="muted small">
                  Attached references are included in your next AI request.
                  Describe any behavior the image doesn’t show.
                </p>
              </div>
            )}
            <div className="left-panel-bottom">
              <span className="status-dot" /> Source files available{" "}
              <ShieldCheck size={13} />
            </div>
          </aside>
        )}
        <main className="center-panel">
          <div className="canvas-toolbar">
            <div className="canvas-breadcrumb">
              <Globe size={14} />
              <span>
                {mode === "design" ? "Live canvas" : file.split("/").pop()}
              </span>
              <span className="slash">/</span>
              <span className="muted">
                {mode === "design" ? "Home" : "Source"}
              </span>
            </div>
            <div className="device-controls">
              {(
                [
                  ["desktop", Monitor],
                  ["tablet", Tablet],
                  ["mobile", Smartphone],
                ] as const
              ).map(([name, Icon]) => (
                <IconButton
                  key={String(name)}
                  label={String(name) + " preview"}
                  active={device === name}
                  onClick={() => setDevice(String(name))}
                >
                  <Icon size={15} />
                </IconButton>
              ))}
            </div>
            <div className="canvas-actions">
              <button
                className="zoom-select"
                onClick={() =>
                  setZoom((z) => (z === 100 ? 80 : z === 80 ? 60 : 100))
                }
              >
                {zoom}%<ChevronDown size={11} />
              </button>
              <IconButton label="Refresh preview" onClick={build}>
                <RefreshCw size={14} className={building ? "spin" : ""} />
              </IconButton>
              <IconButton
                label="Open preview in new tab"
                onClick={separatePreview}
                disabled={!preview.html}
              >
                <ArrowUpRight size={16} />
              </IconButton>
              {hideRight && (
                <IconButton
                  label="Show assistant"
                  onClick={() => setHideRight(false)}
                >
                  <MessageSquare size={16} />
                </IconButton>
              )}
            </div>
          </div>
          <div className={"work-area " + (mode === "code" ? "split-code" : "")}>
            <div className="code-pane" hidden={mode !== "code"}>
              <div className="code-file-tab">
                <FileCode2 size={13} />
                {file}
                <span>{dirty ? "●" : ""}</span>
                <small>Ctrl + S to update preview</small>
              </div>
              <Suspense
                fallback={
                  <div className="loading-screen">
                    <Loader2 className="spin" />
                  </div>
                }
              >
                {mode === "code" && (
                  <CodeEditor
                    file={file}
                    value={draft[file] || ""}
                    onChange={(value) =>
                      setDraft((d) => ({ ...d, [file]: value }))
                    }
                    light={light}
                  />
                )}
              </Suspense>
            </div>
            <div className="canvas-surround">
              <div className="canvas-page-label">
                <span>
                  {device === "desktop"
                    ? "Desktop"
                    : device === "tablet"
                      ? "Tablet"
                      : "Mobile"}{" "}
                  <span className="muted">
                    ·{" "}
                    {device === "mobile"
                      ? "390"
                      : device === "tablet"
                        ? "768"
                        : "Responsive"}
                  </span>
                </span>
                <span>
                  <span className="status-dot" />{" "}
                  {building
                    ? "Compiling…"
                    : buildError
                      ? "Build failed"
                      : "Live preview"}
                </span>
              </div>
              <div
                className={
                  "preview-frame " + (selecting ? "selection-mode" : "")
                }
                style={{
                  width:
                    device === "mobile"
                      ? 390
                      : device === "tablet"
                        ? 768
                        : "100%",
                  zoom: zoom / 100,
                }}
              >
                {preview.html && (
                  <iframe
                    ref={frame}
                    title="Website live preview"
                    sandbox="allow-scripts allow-forms"
                    srcDoc={preview.html}
                  />
                )}{" "}
                {!preview.html && !buildError && (
                  <div className="preview-loading">
                    <Loader2 className="spin" />
                    <p>Compiling your project…</p>
                  </div>
                )}
                {buildError && (
                  <div className="build-error">
                    <Code2 size={26} />
                    <h3>Build failed</h3>
                    <pre>{buildError}</pre>
                    <button
                      className="secondary"
                      onClick={() => setMode("code")}
                    >
                      Open source code
                    </button>
                  </div>
                )}
              </div>
              <div className="canvas-hint">
                {selecting ? (
                  <>
                    <MousePointer2 size={12} /> Click any element to edit its
                    properties
                  </>
                ) : (
                  <>
                    <MousePointer2 size={12} /> Your website is interactive. Use
                    the select tool to edit.
                  </>
                )}
              </div>
            </div>
          </div>
          <div className={"console-panel " + (consoleOpen ? "expanded" : "")}>
            <button
              className="console-toggle"
              onClick={() => setConsoleOpen(!consoleOpen)}
            >
              <Terminal size={13} /> Console{" "}
              <span className="console-count">{logs.length}</span>
              <span className="console-build">
                {buildError
                  ? "Build failed"
                  : building
                    ? "Compiling…"
                    : "React runtime"}
              </span>
              <ChevronDown size={13} />
            </button>
            {consoleOpen && (
              <div className="console-output">
                {logs.map((l, i) => (
                  <div
                    className={l.startsWith("✕") ? "error-text" : ""}
                    key={i}
                  >
                    {l}
                  </div>
                ))}
                <button className="text-button" onClick={() => setLogs([])}>
                  Clear console
                </button>
              </div>
            )}
          </div>
        </main>
        {!hideRight && (
          <aside className="right-panel">
            <div className="right-tabs">
              <button
                className={rightTab === "assistant" ? "active" : ""}
                onClick={() => setRightTab("assistant")}
              >
                <MessageSquare size={14} /> AI assistant
              </button>
              <button
                className={rightTab === "properties" ? "active" : ""}
                onClick={() => setRightTab("properties")}
              >
                Properties
              </button>
              <IconButton
                label="Collapse properties"
                onClick={() => setHideRight(true)}
              >
                <PanelRightClose size={14} />
              </IconButton>
            </div>
            {rightTab === "assistant" ? (
              <>
                <div className="assistant-content">
                  {messages.length === 0 ? (
                    <div className="assistant-welcome">
                      <h2>Project assistant</h2>
                      <p>
                        Describe a change to your website.
                        <br />
                        Review the proposed code before applying it.
                      </p>
                      <div className="suggestions">
                        {[
                          "Make this website feel more minimal",
                          "Add a responsive pricing section",
                          "Change the palette to warm neutrals",
                        ].map((s, i) => (
                          <button key={s} onClick={() => setPrompt(s)}>
                            {i === 0 ? (
                              <Paintbrush size={14} />
                            ) : i === 1 ? (
                              <LayoutGrid size={14} />
                            ) : (
                              <SlidersHorizontal size={14} />
                            )}
                            <span>{s}</span>
                            <ArrowUpRight size={12} />
                          </button>
                        ))}
                      </div>
                      <div className="assistant-note">
                        <Code2 size={15} />
                        <p>
                          Changes require your approval.
                          <br />
                          <span>Review the diff before applying.</span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="messages">
                      {messages.map((m) => (
                        <div key={m.id} className={"message " + m.role}>
                          <div className="message-label">
                            {m.role === "assistant" ? (
                              <>
                                <MessageSquare size={13} /> VisionForge
                              </>
                            ) : (
                              <>You</>
                            )}
                          </div>
                          <p>{m.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {generating && (
                    <div className="thinking">
                      <Loader2 size={15} className="spin" />
                      <span>Generating proposed changes…</span>
                    </div>
                  )}
                  {proposal && Object.keys(proposal.files).length > 0 && (
                    <div className="proposal-card">
                      <div>
                        <FileCode2 size={15} />
                        <b>
                          {Object.keys(proposal.files).length} proposed file
                          changes
                        </b>
                      </div>
                      <p>
                        {proposal.buildError
                          ? "Build errors found. Your source is unchanged."
                          : "Compilation passed. Ready for your review."}
                      </p>
                      <button
                        className="secondary full"
                        onClick={() => setReview(true)}
                      >
                        Review changes <ArrowUpRight size={13} />
                      </button>
                    </div>
                  )}
                  <div ref={messagesEnd} />
                </div>
                <div className="composer-wrap">
                  {selection && (
                    <div className="context-tag">
                      <MousePointer2 size={11} />
                      {selection.tag} selected
                      <button
                        aria-label="Clear selection"
                        onClick={() => setSelection(null)}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  )}
                  <div className="composer">
                    <textarea
                      aria-label="Message AI assistant"
                      placeholder="Describe a change…"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          generate();
                        }
                      }}
                    />
                    <div className="composer-actions">
                      <IconButton
                        label="Attach reference image"
                        onClick={() => imageInput.current?.click()}
                      >
                        <Plus size={17} />
                      </IconButton>
                      {reference && (
                        <span className="attached">
                          <ImagePlus size={11} /> 1 reference
                        </span>
                      )}
                      <button
                        className="send-button"
                        aria-label="Generate changes"
                        disabled={!prompt.trim() || generating || dirty}
                        onClick={generate}
                      >
                        {generating ? (
                          <Loader2 size={15} className="spin" />
                        ) : (
                          <ArrowUp size={17} />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="provider-line">
                    <button onClick={onSettings}>
                      <span
                        className={configured ? "status-dot" : "tiny-dot"}
                      />
                      {configured
                        ? "AI provider connected"
                        : "Connect AI provider"}
                      <ChevronDown size={10} />
                    </button>
                    <span>↵ to send</span>
                  </div>
                  <span className="ai-footnote">
                    Changes are saved to project history.
                  </span>
                </div>
              </>
            ) : (
              <Properties
                selection={selection}
                onSelect={() => {
                  setSelecting(true);
                  setMode("design");
                }}
                onApply={async (changes) => {
                  if (!selection) return;
                  if (dirty) throw new Error("Save your code edits first.");
                  const updated = await api(
                    `/projects/${p.id}/visual`,
                    "POST",
                    { elementId: selection.id, changes, revision: p.revision },
                  );
                  onProject(updated);
                  notify("Element updated in source code.");
                }}
              />
            )}
          </aside>
        )}
      </div>
      <footer className="editor-status">
        <span>
          <span className="status-dot" /> Workspace connected{" "}
          <span className="status-divider">|</span>
          <Code2 size={11} /> React + TypeScript
        </span>
        <span>
          {selection ? selection.tag + " selected" : "No element selected"}
          <span className="status-divider">|</span>
          <ShieldCheck size={11} /> Sandboxed preview
        </span>
      </footer>
      <input
        ref={imageInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          if (e.target.files?.[0]) upload(e.target.files[0]);
          e.target.value = "";
        }}
      />
      {review && proposal && (
        <ReviewModal
          proposal={proposal}
          files={p.files}
          onClose={() => setReview(false)}
          onApply={apply}
          busy={saving}
          dirty={dirty}
        />
      )}
      {history && (
        <Modal title="Version history" onClose={() => setHistory(null)}>
          <p className="muted small">
            Every source change saves the previous version. Restoring also saves
            your current source.
          </p>
          {history.length === 0 ? (
            <div className="empty-small">
              <History size={25} />
              <p>Your first edit will create a snapshot.</p>
            </div>
          ) : (
            <div className="history-list">
              {history.map((h) => (
                <div key={h.id}>
                  <div>
                    <b>{h.label}</b>
                    <small>{new Date(h.created_at).toLocaleString()}</small>
                  </div>
                  <button
                    className="secondary"
                    disabled={dirty}
                    onClick={async () => {
                      if (
                        !confirm(
                          "Restore this snapshot? Your current source will be saved in history.",
                        )
                      )
                        return;
                      try {
                        onProject(
                          await api(
                            `/projects/${p.id}/history/${h.id}/restore`,
                            "POST",
                            { revision: p.revision },
                          ),
                        );
                        setHistory(null);
                        notify("Previous version restored.");
                      } catch (e) {
                        notify((e as Error).message);
                      }
                    }}
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
function Properties({
  selection,
  onSelect,
  onApply,
}: {
  selection: Selection | null;
  onSelect: () => void;
  onApply: (changes: unknown) => Promise<void>;
}) {
  const [text, setText] = useState(""),
    [style, setStyle] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setText(selection?.text || "");
    setStyle({});
    setError("");
  }, [selection]);
  if (!selection)
    return (
      <div className="empty-properties">
        <span className="empty-selection">
          <MousePointer2 size={26} />
        </span>
        <h3>Element properties</h3>
        <p>
          Select an element on the canvas
          <br />
          to edit its properties.
        </p>
        <button className="secondary" onClick={onSelect}>
          <MousePointer2 size={14} /> Select an element
        </button>
        <small>Styles update the actual source code.</small>
      </div>
    );
  return (
    <form
      className="properties-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await onApply({
            ...(selection.simple && text !== selection.text ? { text } : {}),
            style,
          });
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="selected-element">
        <Square size={16} />
        <b>{selection.tag}</b>
        <span>Selected element</span>
      </div>
      <div className="property-section">
        <span className="section-label">CONTENT</span>
        {selection.simple ? (
          <label>
            Text
            <textarea value={text} onChange={(e) => setText(e.target.value)} />
          </label>
        ) : (
          <p className="muted small">
            This element contains nested content. Select a child to edit text,
            or use Code mode.
          </p>
        )}
      </div>
      <div className="property-section">
        <span className="section-label">APPEARANCE</span>
        {[
          ["color", "Text color"],
          ["backgroundColor", "Background"],
          ["fontSize", "Font size"],
          ["padding", "Padding"],
          ["borderRadius", "Corner radius"],
          ["width", "Width"],
        ].map(([key, label]) => (
          <label className="property-field" key={key}>
            <span>{label}</span>
            <input
              value={style[key] ?? selection.style[key] ?? ""}
              onChange={(e) => setStyle({ ...style, [key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      {error && <div className="error">{error}</div>}
      <button
        className="primary full"
        disabled={
          busy || (!Object.keys(style).length && text === selection.text)
        }
      >
        {busy ? <Loader2 className="spin" size={14} /> : <Check size={14} />}{" "}
        Apply to source
      </button>
      <p className="muted small">
        Custom expressions and event handlers are preserved. Dynamic styles can
        be edited in Code mode.
      </p>
    </form>
  );
}
function ReviewModal({
  proposal,
  files,
  onClose,
  onApply,
  busy,
  dirty,
}: {
  proposal: Proposal;
  files: Files;
  onClose: () => void;
  onApply: () => void;
  busy: boolean;
  dirty: boolean;
}) {
  const [file, setFile] = useState(Object.keys(proposal.files)[0]);
  return (
    <Modal title="Review AI changes" onClose={onClose} wide>
      <p className="review-summary">{proposal.summary}</p>
      {proposal.buildError ? (
        <div className="error">
          <b>Compilation failed</b>
          <pre>{proposal.buildError}</pre>
        </div>
      ) : (
        <div className="review-passed">
          <Check size={14} /> Compilation passed · Review behavior in the
          preview after applying.
        </div>
      )}
      <div className="review-tabs">
        {Object.keys(proposal.files).map((f) => (
          <button
            key={f}
            className={file === f ? "active" : ""}
            onClick={() => setFile(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="diff-area">
        <Suspense fallback={<Loader2 className="spin" />}>
          <CodeDiff
            file={file}
            before={files[file] || ""}
            after={proposal.files[file]}
          />
        </Suspense>
      </div>
      <div className="modal-actions">
        <span className="muted small">
          A snapshot will preserve your current source.
        </span>
        <button className="secondary" onClick={onClose}>
          Keep reviewing later
        </button>
        <button
          className="primary"
          disabled={busy || !!proposal.buildError || dirty}
          onClick={onApply}
        >
          {busy ? <Loader2 size={15} className="spin" /> : <Check size={15} />}{" "}
          Apply changes
        </button>
      </div>
    </Modal>
  );
}
