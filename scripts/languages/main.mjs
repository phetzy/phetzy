// Fetch language bytes for every repo the configured owners own, then write dark and light cards.
// Usage: GH_TOKEN=<token> node scripts/languages/main.mjs
// The token needs read access to each owner's repos, including private ones when includePrivate is set.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { aggregate, renderCard } from "./lib.mjs";

const root = new URL("../../", import.meta.url);

const QUERY = `
  query($login: String!, $cursor: String, $privacy: RepositoryPrivacy) {
    repositoryOwner(login: $login) {
      repositories(first: 100, after: $cursor, isFork: false, ownerAffiliations: OWNER, privacy: $privacy) {
        pageInfo { hasNextPage endCursor }
        nodes {
          name
          isFork
          owner { login }
          languages(first: 100) { edges { size node { name color } } }
        }
      }
    }
  }`;

async function graphql(token, variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables }),
  });
  const body = await res.json();
  if (!res.ok || body.errors) {
    throw new Error(`GitHub GraphQL failed for ${variables.login}: ${JSON.stringify(body.errors ?? body)}`);
  }
  return body.data;
}

async function reposFor(token, login, includePrivate) {
  const repos = [];
  let cursor = null;
  do {
    const data = await graphql(token, { login, cursor, privacy: includePrivate ? null : "PUBLIC" });
    if (!data.repositoryOwner) throw new Error(`Owner not found: ${login}`);
    const page = data.repositoryOwner.repositories;
    repos.push(...page.nodes);
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);
  return repos;
}

const token = process.env.GH_TOKEN;
if (!token) throw new Error("Set GH_TOKEN to a token that can read every configured owner's repos");

const config = JSON.parse(await readFile(new URL("languages.config.json", root), "utf8"));
const repos = [];
for (const owner of config.owners) {
  const owned = await reposFor(token, owner, config.includePrivate);
  console.log(`${owner}: ${owned.length} repos`);
  repos.push(...owned);
}

const { languages, total } = aggregate(repos, config);
console.log(languages.map((l) => `${l.name} ${l.percent}%`).join(", "), `(${total} bytes)`);

await mkdir(new URL("assets/", root), { recursive: true });
for (const theme of ["dark", "light"]) {
  await writeFile(new URL(`assets/languages-${theme}.svg`, root), renderCard(languages, theme));
}
