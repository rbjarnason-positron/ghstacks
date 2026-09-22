import { execFile } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import { loadDashboard, loadPullRequest } from "./github.ts";
import type { Dashboard } from "../lib/model.ts";

export function ghApi(endpoint: string, body?: object): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const args = [
      "api",
      endpoint,
      "--hostname",
      "github.com",
      "-H",
      "X-GitHub-Api-Version: 2026-03-10",
    ];
    if (body) args.push("--method", "POST", "--input", "-");
    const child = execFile(
      "gh",
      args,
      { timeout: 60000, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error)
          return reject(
            new Error(
              stderr.trim() ||
                "GitHub is unavailable. Check gh auth status and your connection.",
            ),
          );
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error("GitHub returned an unreadable response."));
        }
      },
    );
    if (body) child.stdin?.end(JSON.stringify(body));
  });
}

let cached: Dashboard | undefined;
let pending: Promise<Dashboard> | undefined;
export async function dashboardHandler(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  const path = req.url?.split("?")[0];
  if (path !== "/api/dashboard" && path !== "/api/pull-request") return next();
  // Use the active local GitHub CLI account. Only serve same-origin loopback requests.
  const host = req.headers.host ?? "";
  const allowed = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host);
  const origin = req.headers.origin;
  if (
    !allowed ||
    (origin && origin !== `http://${host}`) ||
    req.headers["sec-fetch-site"] === "cross-site"
  ) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  if (req.method !== "GET") {
    res.writeHead(405, { Allow: "GET" }).end();
    return;
  }
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    if (path === "/api/pull-request") {
      const params = new URL(req.url!, `http://${host}`).searchParams;
      const repo = params.get("repo") ?? "";
      const number = Number(params.get("number"));
      if (
        !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) ||
        !Number.isSafeInteger(number) ||
        number < 1
      ) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Invalid pull request." }));
        return;
      }
      res.end(JSON.stringify(await loadPullRequest(ghApi, repo, number)));
      return;
    }
    // A short cache and shared in-flight request prevent concurrent refreshes exhausting API quota.
    if (!cached || Date.now() - Date.parse(cached.fetchedAt) > 30000) {
      pending ??= loadDashboard(ghApi).finally(() => {
        pending = undefined;
      });
      cached = await pending;
    }
    res.end(JSON.stringify(cached));
  } catch (error) {
    res.statusCode = 502;
    res.end(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Could not connect to GitHub.",
      }),
    );
  }
}

export function localGithubPlugin() {
  return {
    name: "ghstacks-local-github",
    configureServer(server: {
      middlewares: { use: (handler: typeof dashboardHandler) => void };
    }) {
      server.middlewares.use(dashboardHandler);
    },
    configurePreviewServer(server: {
      middlewares: { use: (handler: typeof dashboardHandler) => void };
    }) {
      server.middlewares.use(dashboardHandler);
    },
  };
}
