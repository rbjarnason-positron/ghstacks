import assert from "node:assert/strict";
import test from "node:test";
import { loadDashboard, loadPullRequest } from "../server/github.ts";
const makePr = (number: number, stack: number | null = 42) => ({
  number,
  title: `Layer ${number}`,
  repository: { nameWithOwner: "example/repo" },
  author: { login: "me" },
  stack: stack ? { number: stack } : null,
  state: "OPEN",
  updatedAt: `2026-09-${number === 3 ? "22" : "21"}T12:00:00Z`,
  reviewThreads: { totalCount: 0 },
  statusCheckRollup: null,
});
const viewer = { login: "me", name: "Me", avatarUrl: "" };

test("paginates authored PRs and preserves native order including other authors", async () => {
  const calls: string[] = [];
  const result = await loadDashboard(async (endpoint, input) => {
    const body = input as { query: string; variables: Record<string, unknown> };
    calls.push(endpoint);
    if (body?.query.includes("search(")) {
      const second = body.variables.cursor === "page2";
      return {
        data: {
          viewer,
          search: {
            issueCount: 3,
            nodes: second ? [makePr(3)] : [makePr(10), makePr(7, null)],
            pageInfo: {
              hasNextPage: !second,
              endCursor: second ? null : "page2",
            },
          },
        },
      };
    }
    if (endpoint.startsWith("repos/"))
      return [
        {
          number: 42,
          open: true,
          base: { ref: "main" },
          pull_requests: [{ number: 10 }, { number: 2 }, { number: 3 }],
        },
        {
          number: 999,
          open: true,
          base: { ref: "main" },
          pull_requests: [{ number: 80 }],
        },
      ];
    return {
      data: {
        repository: {
          p2: {
            ...makePr(2),
            state: "MERGED",
            author: { login: "someone-else" },
          },
        },
      },
    };
  });
  assert.equal(calls.length, 4);
  assert.equal(result.stacks.length, 1);
  assert.deepEqual(
    result.stacks[0].prs.map((p) => p.number),
    [10, 2, 3],
  );
  assert.deepEqual(
    result.standalone.map((p) => p.number),
    [7],
  );
  assert.equal(result.stacks[0].updatedAt, "2026-09-22T12:00:00Z");
  assert.equal(result.warnings.length, 0);
});
test("stack endpoint failure is reported and authored PRs remain visible", async () => {
  const result = await loadDashboard(async (endpoint) => {
    if (endpoint === "graphql")
      return {
        data: {
          viewer,
          search: {
            issueCount: 1,
            nodes: [makePr(10)],
            pageInfo: { hasNextPage: false },
          },
        },
      };
    throw new Error("API unavailable");
  });
  assert.equal(result.stacks.length, 0);
  assert.equal(result.standalone.length, 1);
  assert.match(result.warnings[0], /API unavailable/);
});
test("GraphQL failures are not presented as an empty workspace", async () => {
  await assert.rejects(
    loadDashboard(async () => ({
      errors: [{ message: "Authentication required" }],
    })),
    /Authentication required/,
  );
});
test("empty authored search does not enumerate unrelated repositories", async () => {
  let count = 0;
  const d = await loadDashboard(async () => {
    count++;
    return {
      data: {
        viewer,
        search: { issueCount: 0, nodes: [], pageInfo: { hasNextPage: false } },
      },
    };
  });
  assert.equal(count, 1);
  assert.deepEqual(d.stacks, []);
  assert.deepEqual(d.standalone, []);
});
test("detailed PR query uses variables and surfaces missing PRs", async () => {
  await assert.rejects(
    loadPullRequest(
      async (endpoint, input) => {
        const body = input as {
          query: string;
          variables: Record<string, unknown>;
        };
        assert.equal(endpoint, "graphql");
        assert.deepEqual(body.variables, {
          owner: "example",
          name: "repo",
          number: 10,
        });
        return { data: { repository: { pullRequest: null } } };
      },
      "example/repo",
      10,
    ),
    /unavailable/,
  );
});
