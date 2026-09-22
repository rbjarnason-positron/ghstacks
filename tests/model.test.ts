import assert from "node:assert/strict";
import test from "node:test";
import {
  ci,
  needsAttention,
  ready,
  readyPrefix,
  stackStatus,
  status,
} from "../lib/model.ts";
import type { PullRequest, Stack } from "../lib/model.ts";
export function pr(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    number: 10,
    title: "Layer",
    url: "https://github.com/example/repo/pull/10",
    state: "OPEN",
    isDraft: false,
    updatedAt: "2026-09-22T12:00:00Z",
    createdAt: "2026-09-20T12:00:00Z",
    headRefName: "feature",
    baseRefName: "main",
    additions: 1,
    deletions: 0,
    changedFiles: 1,
    reviewDecision: "APPROVED",
    mergeStateStatus: "CLEAN",
    mergeable: "MERGEABLE",
    bodyText: "",
    author: { login: "me", avatarUrl: "" },
    repository: { nameWithOwner: "example/repo" },
    stack: { number: 42 },
    comments: { totalCount: 0 },
    reviewThreads: {
      totalCount: 0,
      nodes: [],
      pageInfo: { hasNextPage: false },
    },
    reviews: { nodes: [] },
    statusCheckRollup: {
      state: "SUCCESS",
      contexts: { totalCount: 0, nodes: [] },
    },
    ...overrides,
  };
}
function stack(prs: PullRequest[]): Stack {
  return {
    id: "example/repo:42",
    number: 42,
    repository: "example/repo",
    base: "main",
    native: true,
    title: "Stack",
    prs,
    updatedAt: prs[0].updatedAt,
  };
}

test("ready prefix stops at the first blocker, even when upper layers pass", () => {
  assert.equal(
    readyPrefix(stack([pr({ mergeStateStatus: "BEHIND" }), pr()])),
    0,
  );
  assert.equal(
    readyPrefix(stack([pr(), pr({ reviewDecision: "REVIEW_REQUIRED" }), pr()])),
    1,
  );
});
test("merged layers are skipped, closed unmerged layers block the prefix", () => {
  assert.equal(readyPrefix(stack([pr({ state: "MERGED" }), pr()])), 1);
  assert.equal(readyPrefix(stack([pr({ state: "CLOSED" }), pr()])), 0);
});
test("unknown mergeability, conflicts, drafts, reviews and queued checks never count as ready", () => {
  for (const p of [
    pr({ mergeable: "UNKNOWN" }),
    pr({ mergeable: "CONFLICTING" }),
    pr({ isDraft: true }),
    pr({ reviewDecision: "CHANGES_REQUESTED" }),
    pr({ reviewDecision: "REVIEW_REQUIRED" }),
    pr({
      statusCheckRollup: {
        state: "PENDING",
        contexts: { totalCount: 0, nodes: [] },
      },
    }),
  ])
    assert.equal(ready(p), false);
});
test("no checks are unknown rather than represented as passing", () => {
  assert.deepEqual(ci(pr({ statusCheckRollup: null })), {
    label: "No checks",
    tone: "gray",
  });
});
test("failed checks take priority over approval and branch freshness", () => {
  const p = pr({
    statusCheckRollup: {
      state: "FAILURE",
      contexts: { totalCount: 1, nodes: [] },
    },
  });
  assert.equal(status(p).label, "Checks failed");
  assert.equal(needsAttention(p), true);
  assert.equal(ready(p), false);
});
test("drafts retain their draft marker while failing checks remain attention-worthy", () => {
  const p = pr({ isDraft: true, mergeable: "CONFLICTING" });
  assert.equal(status(p).label, "Draft");
  assert.equal(needsAttention(p), true);
});
test("a stack with an upper blocker shows attention even if a lower prefix is ready", () => {
  const s = stack([pr(), pr({ mergeStateStatus: "BEHIND" })]);
  assert.equal(readyPrefix(s), 1);
  assert.equal(stackStatus(s).label, "Needs attention");
});

test("an inaccessible layer makes merge readiness unknown", () => {
  assert.equal(readyPrefix({ ...stack([pr()]), incomplete: true }), 0);
});
