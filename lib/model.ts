export type Check = {
  name: string;
  status: string;
  conclusion: string | null;
  url: string | null;
};
export type PullRequest = {
  number: number;
  title: string;
  url: string;
  state: string;
  isDraft: boolean;
  updatedAt: string;
  createdAt: string;
  headRefName: string;
  baseRefName: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  reviewDecision: string | null;
  mergeStateStatus: string;
  mergeable: string;
  bodyText: string;
  author: { login: string; avatarUrl: string } | null;
  repository: { nameWithOwner: string };
  stack: { number: number } | null;
  comments: { totalCount: number };
  reviewThreads: {
    totalCount: number;
    nodes: { isResolved: boolean }[];
    pageInfo: { hasNextPage: boolean };
  };
  reviews: { nodes: { state: string; author: { login: string } | null }[] };
  statusCheckRollup: {
    state: string;
    contexts: {
      totalCount: number;
      nodes: (
        | {
            __typename: "CheckRun";
            name: string;
            status: string;
            conclusion: string | null;
            detailsUrl: string | null;
          }
        | {
            __typename: "StatusContext";
            context: string;
            state: string;
            targetUrl: string | null;
          }
      )[];
    };
  } | null;
};
export type Stack = {
  incomplete?: boolean;
  id: string;
  number: number;
  repository: string;
  base: string;
  native: boolean;
  title: string;
  prs: PullRequest[];
  updatedAt: string;
};
export type Dashboard = {
  viewer: { login: string; name: string | null; avatarUrl: string };
  stacks: Stack[];
  standalone: PullRequest[];
  fetchedAt: string;
  warnings: string[];
  totalOpen: number;
};
export type Tone = "red" | "amber" | "green" | "blue" | "gray" | "purple";
export function checks(pr: PullRequest): Check[] {
  return (pr.statusCheckRollup?.contexts.nodes ?? []).map((c) =>
    c.__typename === "CheckRun"
      ? {
          name: c.name,
          status: c.status,
          conclusion: c.conclusion,
          url: c.detailsUrl,
        }
      : {
          name: c.context,
          status: c.state === "PENDING" ? "PENDING" : "COMPLETED",
          conclusion: c.state,
          url: c.targetUrl,
        },
  );
}
export function ci(pr: PullRequest): { label: string; tone: Tone } {
  const state = pr.statusCheckRollup?.state;
  if (state === "FAILURE" || state === "ERROR")
    return { label: "Checks failed", tone: "red" };
  if (state === "PENDING" || state === "EXPECTED")
    return { label: "Checks running", tone: "amber" };
  if (state === "SUCCESS") return { label: "Checks passed", tone: "green" };
  return { label: "No checks", tone: "gray" };
}
export function status(pr: PullRequest): { label: string; tone: Tone } {
  if (pr.state === "MERGED") return { label: "Merged", tone: "purple" };
  if (pr.state === "CLOSED") return { label: "Closed", tone: "gray" };
  if (pr.isDraft) return { label: "Draft", tone: "gray" };
  if (pr.mergeable === "CONFLICTING")
    return { label: "Conflicts", tone: "red" };
  if (ci(pr).tone === "red") return ci(pr);
  if (pr.reviewDecision === "CHANGES_REQUESTED")
    return { label: "Changes requested", tone: "red" };
  if (pr.mergeStateStatus === "BEHIND")
    return { label: "Behind base", tone: "amber" };
  if (ci(pr).tone === "amber") return ci(pr);
  if (pr.reviewDecision === "REVIEW_REQUIRED")
    return { label: "Needs review", tone: "blue" };
  if (ready(pr)) return { label: "Ready", tone: "green" };
  if (pr.mergeStateStatus === "BLOCKED")
    return { label: "Blocked", tone: "amber" };
  return { label: "Open", tone: "blue" };
}
export function ready(pr: PullRequest) {
  return (
    pr.state === "OPEN" &&
    !pr.isDraft &&
    pr.mergeable === "MERGEABLE" &&
    pr.mergeStateStatus === "CLEAN" &&
    ci(pr).tone !== "red" &&
    ci(pr).tone !== "amber" &&
    pr.reviewDecision !== "CHANGES_REQUESTED" &&
    pr.reviewDecision !== "REVIEW_REQUIRED"
  );
}
export function needsAttention(pr: PullRequest) {
  return (
    pr.state === "OPEN" &&
    (pr.mergeable === "CONFLICTING" ||
      ci(pr).tone === "red" ||
      pr.reviewDecision === "CHANGES_REQUESTED" ||
      pr.mergeStateStatus === "BEHIND" ||
      pr.mergeStateStatus === "BLOCKED")
  );
}
export function readyPrefix(stack: Stack) {
  if (stack.incomplete) return 0;
  let count = 0;
  for (const pr of stack.prs) {
    if (pr.state === "MERGED") continue;
    if (!ready(pr)) break;
    count++;
  }
  return count;
}
export function stackStatus(stack: Stack): { label: string; tone: Tone } {
  const open = stack.prs.filter((p) => p.state === "OPEN");
  if (!open.length) return { label: "Complete", tone: "purple" };
  if (open.some(needsAttention))
    return { label: "Needs attention", tone: "red" };
  if (readyPrefix(stack)) return { label: "Ready to land", tone: "green" };
  if (open.every((p) => p.isDraft)) return { label: "Draft", tone: "gray" };
  return { label: "In progress", tone: "blue" };
}
