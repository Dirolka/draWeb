import Editor, { DiffEditor, loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import CssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
(self as any).MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    return label === "typescript" || label === "javascript"
      ? new TsWorker()
      : label === "css"
        ? new CssWorker()
        : label === "json"
          ? new JsonWorker()
          : new EditorWorker();
  },
};
loader.config({ monaco });
monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
  jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
  allowNonTsExtensions: true,
  target: monaco.languages.typescript.ScriptTarget.ESNext,
  moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
});
// Dependency type packages are not installed inside the browser worker; keep syntax diagnostics.
monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: true,
});
const language = (file: string) =>
  file.endsWith(".css")
    ? "css"
    : file.endsWith(".json")
      ? "json"
      : "typescript";
export default function CodeEditor({
  file,
  value,
  onChange,
  light,
}: {
  file: string;
  value: string;
  onChange: (v: string) => void;
  light: boolean;
}) {
  return (
    <Editor
      path={file}
      value={value}
      language={language(file)}
      theme={light ? "light" : "vs-dark"}
      onChange={(v) => onChange(v || "")}
      options={{
        fontSize: 12,
        minimap: { enabled: false },
        padding: { top: 16 },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: "on",
      }}
    />
  );
}
export function CodeDiff({
  file,
  before,
  after,
}: {
  file: string;
  before: string;
  after: string;
}) {
  return (
    <DiffEditor
      original={before}
      modified={after}
      language={language(file)}
      theme="vs-dark"
      options={{
        readOnly: true,
        minimap: { enabled: false },
        renderSideBySide: true,
        fontSize: 12,
        automaticLayout: true,
      }}
    />
  );
}
