import assert from "node:assert/strict";
import test from "node:test";
import { dashboardHandler } from "../server/local-github.ts";
import type { IncomingMessage, ServerResponse } from "node:http";
async function request(url: string, headers: object, method = "GET") {
  const output = { status: 200, body: "", next: false };
  const res = {
    setHeader() {},
    statusCode: 200,
    writeHead(status: number) {
      this.statusCode = status;
      return this;
    },
    end(body = "") {
      output.status = this.statusCode;
      output.body = body;
    },
  };
  await dashboardHandler(
    { url, headers, method } as IncomingMessage,
    res as unknown as ServerResponse,
    () => {
      output.next = true;
    },
  );
  return output;
}
test("rejects non-loopback hosts and cross-origin credential access", async () => {
  for (const headers of [
    { host: "evil.example" },
    { host: "localhost:3000", origin: "https://evil.example" },
    { host: "localhost:3000", "sec-fetch-site": "cross-site" },
  ])
    assert.equal((await request("/api/dashboard", headers)).status, 403);
});
test("adapter does not accept mutations", async () => {
  assert.equal(
    (await request("/api/dashboard", { host: "localhost:3000" }, "POST"))
      .status,
    405,
  );
});
test("validates repository and PR parameters before invoking gh", async () => {
  for (const url of [
    "/api/pull-request?repo=../../etc&number=10",
    "/api/pull-request?repo=example/repo&number=-1",
    "/api/pull-request?repo=example/repo&number=NaN",
  ])
    assert.equal((await request(url, { host: "localhost:3000" })).status, 400);
});
test("unrelated paths pass through to the application", async () => {
  assert.equal((await request("/", { host: "localhost:3000" })).next, true);
});
