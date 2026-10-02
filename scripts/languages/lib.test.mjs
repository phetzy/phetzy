import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, renderCard } from "./lib.mjs";

const repo = (owner, name, langs, extra = {}) => ({
  name,
  owner: { login: owner },
  isFork: false,
  languages: {
    edges: Object.entries(langs).map(([lang, size]) => ({
      size,
      node: { name: lang, color: `#${lang.length}${lang.length}${lang.length}` },
    })),
  },
  ...extra,
});

const config = { owners: ["me", "org"], excludeRepos: [], excludeLanguages: [], top: 8 };

test("sums bytes per language across owners and sorts largest first", () => {
  const { languages, total } = aggregate(
    [repo("me", "a", { Go: 100, CSS: 50 }), repo("org", "b", { TypeScript: 300, Go: 50 })],
    config,
  );
  assert.equal(total, 500);
  assert.deepEqual(
    languages.map((l) => [l.name, l.size, l.percent]),
    [["TypeScript", 300, 60], ["Go", 150, 30], ["CSS", 50, 10]],
  );
});

test("skips forks, repos of other owners, excluded repos, and excluded languages", () => {
  const { languages } = aggregate(
    [
      repo("me", "kept", { Go: 10, HTML: 90 }),
      repo("me", "fork", { Rust: 1000 }, { isFork: true }),
      repo("stranger", "collab", { Java: 1000 }),
      repo("Me", "Dots", { SCSS: 1000 }),
    ],
    { ...config, excludeRepos: ["me/dots"], excludeLanguages: ["html"] },
  );
  assert.deepEqual(languages.map((l) => l.name), ["Go"]);
});

test("keeps the top N and folds the remainder into Other", () => {
  const { languages } = aggregate(
    [repo("me", "a", { A: 40, B: 30, C: 20, D: 10 })],
    { ...config, top: 2 },
  );
  assert.deepEqual(
    languages.map((l) => [l.name, l.percent]),
    [["A", 40], ["B", 30], ["Other", 30]],
  );
});

test("card lists each language with its percentage and escapes markup", () => {
  const svg = renderCard(
    [
      { name: "C#", color: "#178600", size: 2, percent: 66.7 },
      { name: "<b>&", color: null, size: 1, percent: 33.3 },
    ],
    "dark",
  );
  assert.match(svg, /^<svg[^>]*xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(svg, />C# 66.7%</);
  assert.match(svg, />&lt;b&gt;&amp; 33.3%</);
  assert.doesNotMatch(svg, /<b>/);
});

test("light and dark cards use different backgrounds", () => {
  const langs = [{ name: "Go", color: "#00ADD8", size: 1, percent: 100 }];
  assert.notEqual(renderCard(langs, "dark"), renderCard(langs, "light"));
});

test("refuses to draw an empty card so a failed fetch cannot blank the profile", () => {
  assert.throws(() => renderCard([], "dark"), /no language data/i);
});
