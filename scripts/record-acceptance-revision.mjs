import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const checkout = git("rev-parse", "HEAD");
const head = process.env.ACCEPTANCE_HEAD_SHA || checkout;
const base = process.env.ACCEPTANCE_BASE_SHA || null;
for (const revision of [head, base].filter(Boolean)) {
  if (!/^[a-f0-9]{40}$/.test(revision))
    throw new Error("Invalid acceptance revision");
}
if (base) git("merge-base", "--is-ancestor", base, head);
const tree = git("rev-parse", "HEAD^{tree}");
if (git("rev-parse", `${head}^{tree}`) !== tree) {
  throw new Error("CI checkout differs from the integrated source commit");
}
const evidence = {
  createdAt: new Date().toISOString(),
  sourceCommit: head,
  integratedMainCommit: base,
  ciCheckoutCommit: checkout,
  testedTree: tree,
  mainIncluded: Boolean(base),
  sourceAndCheckoutTreesMatch: true,
};
await mkdir(".local", { recursive: true });
await writeFile(
  ".local/acceptance-revision.json",
  JSON.stringify(evidence, null, 2),
);
console.log(JSON.stringify(evidence, null, 2));
