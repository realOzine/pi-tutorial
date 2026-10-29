// Check local resources and anchors in this repository's authored HTML files.
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { extname, relative, resolve, sep } from "node:path";

const root = fileURLToPath(new URL("../site/", import.meta.url));
const entries = await readdir(root, { recursive: true });
const pages = entries.filter((entry) => entry.endsWith(".html"));
assert(pages.includes("index.html"), "课程首页缺失");
assert(pages.includes("lessons/01-agent-loop.html"), "第一课缺失");
let links = 0;
for (const page of pages) {
  const html = await readFile(resolve(root, page), "utf8");
  assert.match(html, /<html\b[^>]*lang="zh(?:-CN)?"/i, `${page}: 缺少中文语言标记`);
  assert.match(html, /<title>[^<]+<\/title>/i, `${page}: 缺少标题`);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, `${page}: 重复的 id`);
  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const destination = match[1];
    if (/^(?:https?:|mailto:|zed:|data:)/.test(destination)) continue;
    const url = new URL(destination, `http://course.local/${page}`);
    assert.equal(url.origin, "http://course.local", `${page}: 不支持的链接 ${destination}`);
    const local = decodeURIComponent(url.pathname);
    const target = resolve(root, `.${local}${local.endsWith("/") ? "index.html" : ""}`);
    assert(!relative(root, target).startsWith(`..${sep}`), `${page}: 链接超出 site/`);
    assert((await stat(target)).isFile(), `${page}: ${destination} 不是文件`);
    if (url.hash && extname(target) === ".html") {
      const content = await readFile(target, "utf8");
      const anchor = decodeURIComponent(url.hash.slice(1));
      assert(content.includes(`id="${anchor}"`), `${page}: 找不到锚点 ${destination}`);
    }
    links += 1;
  }
}
console.log(`页面检查通过：${pages.length} 个 HTML，${links} 个本地资源或锚点。外部链接未在此脚本中联网验证。`);
