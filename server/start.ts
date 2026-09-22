import { startProdServer } from "vinext/server/prod-server";
import { dashboardHandler } from "./local-github.ts";
import type { IncomingMessage, ServerResponse } from "node:http";
const port = Number(process.env.PORT || 3000);
const { server } = await startProdServer({ port, host: "127.0.0.1" });
const handlers = server.listeners("request") as ((
  req: IncomingMessage,
  res: ServerResponse,
) => void)[];
server.removeAllListeners("request");
server.on("request", (req, res) => {
  void dashboardHandler(req, res, () => {
    for (const handler of handlers) handler(req, res);
  });
});
console.log(`Stacks is ready at http://localhost:${port}`);
