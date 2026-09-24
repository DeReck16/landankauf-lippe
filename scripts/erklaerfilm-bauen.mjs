// Baut den Erklärfilm (public/video/) aus den JSX-Quellen in video-quelle/.
//
//   node scripts/erklaerfilm-bauen.mjs
//
// Früher wurde das JSX bei jedem Besuch im Browser übersetzt (Babel + React-
// Entwicklerversion von unpkg, Schriften von Google). Jetzt: vorab übersetzt,
// React-Produktionsversion und Schriften selbst gehostet → keine Anfragen an
// Dritte, deutlich weniger Ladezeit.
//
// Die Dateien bleiben klassische Skripte (keine Module): Komponenten wie
// <Stage> oder <SceneIntro> sind wie früher globale Funktionen, React und
// ReactDOM kommen aus public/video/vendor/.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REIHENFOLGE = [
  "animations.jsx",
  "photo-placeholder.jsx",
  "scenes-intro.jsx",
  "scenes-value.jsx",
  "scenes-vns.jsx",
  "scenes-cta.jsx",
  "app.jsx",
];

const quelle = REIHENFOLGE.map((f) => `// ── ${f}\n${readFileSync(join("video-quelle", f), "utf8")}`).join("\n\n");
const tmp = join(mkdtempSync(join(tmpdir(), "erklaerfilm-")), "film.jsx");
writeFileSync(tmp, quelle);

execFileSync(
  "npx",
  [
    "--yes",
    "esbuild@0.25.10",
    tmp,
    "--loader:.jsx=jsx",
    "--jsx=transform",
    "--jsx-factory=React.createElement",
    "--jsx-fragment=React.Fragment",
    "--target=es2018",
    "--minify-whitespace",
    "--minify-syntax",
    "--charset=utf8",
    "--outfile=public/video/film.js",
  ],
  { stdio: "inherit" },
);
console.log("public/video/film.js geschrieben");
