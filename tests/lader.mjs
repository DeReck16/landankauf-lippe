// Testlader für `node --test`: übersetzt TypeScript mit dem Compiler aus
// node_modules (inkl. Parameter-Properties, die Node allein nicht kann), löst
// den Pfad-Alias „@/…“ und Importe ohne Dateiendung auf und ersetzt die
// Next.js-Server-APIs durch einfache Attrappen (tests/stubs). Aufruf: npm test
import { createRequire, registerHooks } from "node:module";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STUBS = path.join(ROOT, "tests", "stubs");
const ERSATZ = {
  "server-only": "server-only.mjs",
  "next/cache": "next-cache.mjs",
  "next/headers": "next-headers.mjs",
  "next/navigation": "next-navigation.mjs",
  "next/server": "next-server.mjs",
};

function mitEndung(basis) {
  for (const e of ["", ".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx"]) {
    const p = basis + e;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (ERSATZ[specifier]) return { url: pathToFileURL(path.join(STUBS, ERSATZ[specifier])).href, shortCircuit: true };
    if (specifier.startsWith("@/")) {
      const p = mitEndung(path.join(ROOT, specifier.slice(2)));
      if (p) return { url: pathToFileURL(p).href, shortCircuit: true };
    }
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:") && !context.parentURL.includes("/node_modules/")) {
      const p = mitEndung(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
      if (p) return { url: pathToFileURL(p).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith("file:") && /\.(ts|tsx)$/.test(url) && !url.includes("/node_modules/")) {
      const datei = fileURLToPath(url);
      const out = ts.transpileModule(readFileSync(datei, "utf8"), {
        fileName: datei,
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          isolatedModules: true,
          esModuleInterop: true,
        },
      });
      return { format: "module", source: out.outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
