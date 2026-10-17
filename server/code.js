import { build } from "esbuild";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import generateModule from "@babel/generator";
import * as t from "@babel/types";
import path from "node:path";
import { fileURLToPath } from "node:url";
const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;
const root = process.cwd();
export function validateFiles(files) {
  if (
    !files ||
    typeof files !== "object" ||
    Array.isArray(files) ||
    Object.keys(files).length > 50
  )
    throw new Error("Expected up to 50 source files");
  let size = 0;
  for (const [name, content] of Object.entries(files)) {
    if (
      !/^src\/[a-zA-Z0-9_./-]+\.(tsx?|jsx?|css|json)$/.test(name) ||
      name.includes("..") ||
      typeof content !== "string"
    )
      throw new Error(`Unsupported file: ${name}`);
    size += content.length;
  }
  if (size > 600000) throw new Error("Project source exceeds 600 KB");
  if (!files["src/App.tsx"]) throw new Error("src/App.tsx is required");
  return files;
}
function visitElements(source, filename, callback) {
  const ast = parse(source, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });
  let index = 0;
  traverse(ast, {
    JSXElement(p) {
      const node = p.node;
      if (
        !t.isJSXIdentifier(node.openingElement.name) ||
        !/^[a-z]/.test(node.openingElement.name.name)
      )
        return;
      callback(node, `${filename}:${index++}`);
    },
  });
  return ast;
}
export function visualEdit(files, elementId, changes) {
  const filename = elementId.slice(0, elementId.lastIndexOf(":"));
  if (!files[filename]) throw new Error("Selected element no longer exists");
  let found = false;
  const ast = visitElements(files[filename], filename, (node, id) => {
    if (id !== elementId) return;
    found = true;
    if (changes.text !== undefined) {
      if (!node.children.every((c) => t.isJSXText(c)))
        throw new Error(
          "This text contains custom code or nested elements. Edit it in Code mode.",
        );
      const escaped = changes.text.replace(
        /[&<>{}]/g,
        (char) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "{": "&#123;",
            "}": "&#125;",
          })[char],
      );
      node.children = [t.jsxText(escaped)];
    }
    if (changes.style && Object.keys(changes.style).length) {
      let attr = node.openingElement.attributes.find(
        (a) => t.isJSXAttribute(a) && a.name.name === "style",
      );
      if (
        attr &&
        (!t.isJSXExpressionContainer(attr.value) ||
          !t.isObjectExpression(attr.value.expression))
      )
        throw new Error(
          "Dynamic styles are preserved. Edit this expression in Code mode.",
        );
      if (!attr) {
        attr = t.jsxAttribute(
          t.jsxIdentifier("style"),
          t.jsxExpressionContainer(t.objectExpression([])),
        );
        node.openingElement.attributes.push(attr);
      }
      for (const [key, value] of Object.entries(changes.style)) {
        const props = attr.value.expression.properties;
        // Append after spreads so the explicit visual override takes precedence without deleting custom code.
        attr.value.expression.properties = props.filter(
          (p) =>
            !(
              t.isObjectProperty(p) &&
              ((t.isIdentifier(p.key) && p.key.name === key) ||
                (t.isStringLiteral(p.key) && p.key.value === key))
            ),
        );
        attr.value.expression.properties.push(
          t.objectProperty(t.identifier(key), t.stringLiteral(value)),
        );
      }
    }
  });
  if (!found) throw new Error("Selected element is stale. Select it again.");
  return {
    ...files,
    [filename]: generate(ast, { retainLines: false }).code + "\n",
  };
}
export async function compile(files, inspect = false) {
  validateFiles(files);
  const result = await build({
    stdin: {
      contents: `import React from 'react';import {createRoot} from 'react-dom/client';import App from './src/App.tsx';createRoot(document.getElementById('root')).render(<App/>);`,
      loader: "tsx",
      resolveDir: root,
    },
    bundle: true,
    write: false,
    outdir: "out",
    format: "iife",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    minify: true,
    logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "project-files",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (args) => {
            if (
              ["import-rule", "url-token"].includes(args.kind) &&
              /^(https:\/\/|data:)/.test(args.path)
            )
              return { path: args.path, external: true };
            if (
              args.namespace !== "project" &&
              args.importer &&
              args.namespace !== ""
            )
              return;
            if (args.importer && args.namespace === "file") return;
            if (/^(react|react-dom)(\/.*)?$/.test(args.path))
              return {
                path: fileURLToPath(import.meta.resolve(args.path)),
                namespace: "file",
              };
            if (!args.path.startsWith("."))
              throw new Error(
                `Package ${args.path} is not available. Phase 1 supports React and React DOM.`,
              );
            const candidate = path.posix.normalize(
              path.posix.join(
                args.namespace === "project"
                  ? path.posix.dirname(args.importer)
                  : "",
                args.path,
              ),
            );
            const resolved = [
              candidate,
              ...[
                ".tsx",
                ".ts",
                ".jsx",
                ".js",
                ".css",
                "/index.tsx",
                "/index.ts",
              ].map((ext) => candidate + ext),
            ].find((p) => Object.hasOwn(files, p));
            if (!resolved) throw new Error(`File not found: ${candidate}`);
            return { path: resolved, namespace: "project" };
          });
          b.onLoad({ filter: /.*/, namespace: "project" }, (args) => {
            let contents = files[args.path];
            if (inspect && /\.[jt]sx?$/.test(args.path))
              contents = generate(
                visitElements(contents, args.path, (node, id) => {
                  node.openingElement.attributes =
                    node.openingElement.attributes.filter(
                      (a) =>
                        !(t.isJSXAttribute(a) && a.name.name === "data-vf-id"),
                    );
                  node.openingElement.attributes.push(
                    t.jsxAttribute(
                      t.jsxIdentifier("data-vf-id"),
                      t.stringLiteral(id),
                    ),
                  );
                }),
              ).code;
            return {
              contents,
              loader:
                args.path.split(".").pop() === "js"
                  ? "jsx"
                  : args.path.split(".").pop(),
            };
          });
        },
      },
    ],
  });
  return {
    js: result.outputFiles.find((f) => f.path.endsWith(".js"))?.text || "",
    css: result.outputFiles.find((f) => f.path.endsWith(".css"))?.text || "",
  };
}
export function previewHtml(bundle, channel) {
  const bridge = `
    const channel = ${JSON.stringify(channel)};
    let selecting = false;
    const send = (type, data) => parent.postMessage({channel, type, ...data}, '*');
    addEventListener('message', e => {
      if (e.source === parent && e.data?.channel === channel) selecting = e.data.selecting;
    });
    addEventListener('error', e => send('error', {message: e.message}));
    addEventListener('unhandledrejection', e => send('error', {message: String(e.reason)}));
    for (const level of ['log', 'warn', 'error']) {
      const original = console[level].bind(console);
      console[level] = (...args) => {
        original(...args);
        send('log', {message: level + ': ' + args.map(x => String(x)).join(' ').slice(0, 2000)});
      };
    }
    document.addEventListener('click', e => {
      if (!(e.target instanceof Element)) return;
      if (!selecting) {
        const anchor = e.target.closest('a[href]');
        const href = anchor?.getAttribute('href');
        if (href?.startsWith('#')) {
          e.preventDefault();
          const target = document.getElementById(href.slice(1));
          if (target) target.scrollIntoView({behavior:'smooth'});
          else if (href === '#') window.scrollTo({top:0,behavior:'smooth'});
        }
        return;
      }
      const el = e.target.closest('[data-vf-id]');
      if (!el) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const s = getComputedStyle(el);
      send('select', {id:el.dataset.vfId, tag:el.tagName.toLowerCase(),
        text:el.textContent.slice(0,500), simple:el.children.length===0,
        style:{color:s.color, backgroundColor:s.backgroundColor, fontSize:s.fontSize,
        padding:s.padding, borderRadius:s.borderRadius, width:s.width}});
    }, true);
    document.addEventListener('mouseover', e => {
      if (selecting && e.target instanceof HTMLElement) {
        const original = e.target.style.outline;
        e.target.style.outline = '2px solid #9b87f5';
        e.target.addEventListener('mouseout', () => e.target.style.outline=original, {once:true});
      }
    });
    send('ready', {});
  `;
  const safe = (s) => s.replace(/<\/script/gi, "<\\/script");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: https:; connect-src 'none'; form-action 'none'; base-uri 'none';"><style>${bundle.css.replace(/<\/style/gi, "<\\/style")}</style></head><body><div id="root"></div><script>${safe(bridge)}</script><script>${safe(bundle.js)}</script></body></html>`;
}
