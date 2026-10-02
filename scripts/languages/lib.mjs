// Pure logic for the languages card: no network, no filesystem, so it can be tested directly.

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Sum language bytes across repos and return the top languages by share.
 * Repos are GraphQL Repository nodes with `owner.login`, `isFork`, and `languages.edges`.
 */
export function aggregate(repos, { owners, excludeRepos = [], excludeLanguages = [], top = 8 }) {
  const ownerSet = new Set(owners.map((o) => o.toLowerCase()));
  const skipRepos = new Set(excludeRepos.map((r) => r.toLowerCase()));
  const skipLangs = new Set(excludeLanguages.map((l) => l.toLowerCase()));
  const byName = new Map();

  for (const repo of repos) {
    const owner = repo.owner.login.toLowerCase();
    // Repository listings can include repos the owner only collaborates on; count owned ones only.
    if (repo.isFork || !ownerSet.has(owner)) continue;
    if (skipRepos.has(`${owner}/${repo.name.toLowerCase()}`)) continue;
    for (const { size, node } of repo.languages.edges) {
      if (skipLangs.has(node.name.toLowerCase())) continue;
      const entry = byName.get(node.name) ?? { name: node.name, color: node.color, size: 0 };
      entry.size += size;
      byName.set(node.name, entry);
    }
  }

  const sorted = [...byName.values()].sort((a, b) => b.size - a.size);
  const total = sorted.reduce((sum, l) => sum + l.size, 0);
  const languages = sorted.slice(0, top);
  const rest = sorted.slice(top).reduce((sum, l) => sum + l.size, 0);
  if (rest > 0) languages.push({ name: "Other", color: null, size: rest });
  for (const l of languages) l.percent = total ? round1((l.size / total) * 100) : 0;
  return { languages, total };
}

const THEMES = {
  // Catppuccin Mocha and Latte, matching the github-readme-stats cards in the README.
  dark: { bg: "#1e1e2e", title: "#cba6f7", text: "#cdd6f4", track: "#313244", fallback: "#6c7086" },
  light: { bg: "#eff1f5", title: "#8839ef", text: "#4c4f69", track: "#ccd0da", fallback: "#9ca0b0" },
};

const escapeXml = (s) =>
  String(s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]);

/** Draw a compact two-column card: title, one stacked bar, then a legend. */
export function renderCard(languages, themeName) {
  if (languages.length === 0) throw new Error("No language data to draw");
  const t = THEMES[themeName];
  const width = 300;
  const pad = 25;
  const barWidth = width - pad * 2;
  const rows = Math.ceil(languages.length / 2);
  const height = 90 + rows * 20;
  const font = "font-family=\"'Segoe UI', Ubuntu, -apple-system, BlinkMacSystemFont, sans-serif\"";
  const colorOf = (l) => escapeXml(l.color ?? t.fallback);

  let x = pad;
  const segments = languages
    .map((l) => {
      const w = (l.percent / 100) * barWidth;
      const rect = `<rect x="${x.toFixed(2)}" y="55" width="${w.toFixed(2)}" height="8" fill="${colorOf(l)}"/>`;
      x += w;
      return rect;
    })
    .join("");

  const legend = languages
    .map((l, i) => {
      const lx = pad + (i % 2) * 130;
      const ly = 90 + Math.floor(i / 2) * 20;
      return (
        `<circle cx="${lx + 5}" cy="${ly - 4}" r="5" fill="${colorOf(l)}"/>` +
        `<text x="${lx + 15}" y="${ly}" ${font} font-size="11" fill="${t.text}">${escapeXml(l.name)} ${l.percent}%</text>`
      );
    })
    .join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Most used languages">` +
    `<rect width="${width}" height="${height}" rx="4.5" fill="${t.bg}"/>` +
    `<text x="${pad}" y="35" ${font} font-size="18" font-weight="600" fill="${t.title}">Most Used Languages</text>` +
    `<clipPath id="bar"><rect x="${pad}" y="55" width="${barWidth}" height="8" rx="5"/></clipPath>` +
    `<g clip-path="url(#bar)"><rect x="${pad}" y="55" width="${barWidth}" height="8" fill="${t.track}"/>${segments}</g>` +
    legend +
    `</svg>\n`
  );
}
