import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { test } from "node:test";
import { createCourseServer } from "../scripts/static-server.mjs";

test("local course server serves pages and rejects repository access", async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), "pi-tutorial-server-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const site = join(temporary, "site");
  await mkdir(site);
  await writeFile(join(site, "index.html"), "<h1>课程</h1>");
  await writeFile(join(site, "lesson.mjs"), "export const lesson = 1;");
  await writeFile(join(temporary, "private.txt"), "outside site");
  await symlink(join(temporary, "private.txt"), join(site, "linked.txt"));
  const server = await createCourseServer(site);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;

  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type"), /text\/html/);
  assert.equal(await page.text(), "<h1>课程</h1>");
  const head = await fetch(base, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  const script = await fetch(`${base}/lesson.mjs`);
  assert.match(script.headers.get("content-type"), /text\/javascript/);

  for (const path of ["/.git/config", "/%2e%2e%2fprivate.txt", "/linked.txt", "/missing", "/%00", "/%5cprivate.txt"]) {
    const result = await fetch(`${base}${path}`);
    assert.equal(result.status, 404, path);
    assert.equal(await result.text(), "", path);
  }
  assert.equal((await fetch(`${base}/%E0%A4`)).status, 400);
  const post = await fetch(base, { method: "POST" });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("allow"), "GET, HEAD");
});
