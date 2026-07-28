// Generates sr-Cyrl.json from sr-Latn.json by deterministic Gaj-Latin -> Serbian
// Cyrillic transliteration. Serbian Latin<->Cyrillic is a 1:1 mapping, so the
// Cyrillic locale is generated, never hand-translated — edit sr-Latn.json and
// re-run:  node scripts/transliterate-sr.mjs
//
// Only string *values* are transliterated. Object keys, {{interpolation}}
// placeholders, and brand / technical tokens (Fintrax, API, CSV, model names,
// numbers, sk-… keys) are left in Latin, matching how such tokens are normally
// written inside Serbian Cyrillic text.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const localesDir = join(here, "..", "src", "locales");

// Spans kept verbatim (not transliterated). Order matters: more specific first.
const PROTECTED = new RegExp(
  [
    "\\{\\{[^}]*\\}\\}", // {{interpolation}}
    "sk-[\\w…-]*", // sk-…, sk-ant-…
    "[A-Za-z][A-Za-z0-9]*(?:[.-][A-Za-z0-9]+)+", // gpt-5-mini, claude-sonnet-4-6, llama3.1
    "\\b(?:Fintrax|Trading|Telegram|Ollama|OpenAI|Anthropic|LM|Studio|API|CSV|URL|ID)\\b",
    "\\d+", // bare numbers (212)
    "x{4,}", // xxxxxxxx placeholders
  ].join("|"),
  "g",
);

// Single-letter Gaj-Latin -> Serbian Cyrillic. Digraphs handled separately below.
const MAP = {
  a: "а", b: "б", c: "ц", č: "ч", ć: "ћ", d: "д", đ: "ђ", e: "е", f: "ф",
  g: "г", h: "х", i: "и", j: "ј", k: "к", l: "л", m: "м", n: "н", o: "о",
  p: "п", r: "р", s: "с", š: "ш", t: "т", u: "у", v: "в", z: "з", ž: "ж",
  A: "А", B: "Б", C: "Ц", Č: "Ч", Ć: "Ћ", D: "Д", Đ: "Ђ", E: "Е", F: "Ф",
  G: "Г", H: "Х", I: "И", J: "Ј", K: "К", L: "Л", M: "М", N: "Н", O: "О",
  P: "П", R: "Р", S: "С", Š: "Ш", T: "Т", U: "У", V: "В", Z: "З", Ž: "Ж",
};

function translitChunk(s) {
  // Digraphs first so their letters aren't mapped individually.
  s = s
    .replace(/D[žŽ]/g, "Џ")
    .replace(/dž/g, "џ")
    .replace(/L[jJ]/g, "Љ")
    .replace(/lj/g, "љ")
    .replace(/N[jJ]/g, "Њ")
    .replace(/nj/g, "њ");
  let out = "";
  for (const ch of s) out += MAP[ch] ?? ch;
  return out;
}

function transliterate(text) {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(PROTECTED)) {
    out += translitChunk(text.slice(last, m.index));
    out += m[0]; // keep protected span verbatim
    last = m.index + m[0].length;
  }
  out += translitChunk(text.slice(last));
  return out;
}

function walk(node) {
  if (typeof node === "string") return transliterate(node);
  if (Array.isArray(node)) return node.map(walk);
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = walk(v); // keys untouched
    return out;
  }
  return node;
}

const src = JSON.parse(readFileSync(join(localesDir, "sr-Latn.json"), "utf8"));
const cyrl = walk(src);
writeFileSync(join(localesDir, "sr-Cyrl.json"), JSON.stringify(cyrl, null, 2) + "\n", "utf8");
console.log("Wrote sr-Cyrl.json");
