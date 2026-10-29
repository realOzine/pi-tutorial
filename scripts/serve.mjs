import { fileURLToPath } from "node:url";
import { createCourseServer } from "./static-server.mjs";

const server = await createCourseServer(fileURLToPath(new URL("../site/", import.meta.url)));
server.on("error", (error) => {
  console.error(`课程服务启动失败：${error.message}`);
  process.exitCode = 1;
});
server.listen(4173, "127.0.0.1", () => {
  console.log("Pi 课程：http://127.0.0.1:4173");
  console.log("仅提供 site/ 中的页面；按 Ctrl+C 停止。");
});
