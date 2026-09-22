import type { Dashboard, PullRequest, Stack } from "../lib/model.ts";

export type Transport = (endpoint: string, body?: object) => Promise<unknown>;
type NativeStack = {
  number: number;
  open: boolean;
  base: { ref: string };
  pull_requests: { number: number }[];
};
type SearchData = {
  viewer: Dashboard["viewer"];
  search: {
    issueCount: number;
    nodes: PullRequest[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};
const fields = `number title url state isDraft updatedAt createdAt headRefName baseRefName additions deletions changedFiles bodyText
  reviewDecision mergeStateStatus mergeable author { login avatarUrl } repository { nameWithOwner } stack { number }
  comments { totalCount } reviewThreads(first:100) { totalCount nodes { isResolved } pageInfo { hasNextPage } }
  reviews(last:20) { nodes { state author { login } } }
  statusCheckRollup { state contexts(first:100) { totalCount nodes { __typename ... on CheckRun { name status conclusion detailsUrl } ... on StatusContext { context state targetUrl } } } }`;
const summaryFields = `number title url state isDraft updatedAt createdAt headRefName baseRefName additions deletions changedFiles
  reviewDecision mergeStateStatus mergeable author { login avatarUrl } repository { nameWithOwner } stack { number }
  comments { totalCount } reviewThreads { totalCount } statusCheckRollup { state contexts { totalCount } }`;
function summary(pr: PullRequest): PullRequest {
  return {
    ...pr,
    bodyText: "",
    reviews: { nodes: [] },
    reviewThreads: {
      ...pr.reviewThreads,
      nodes: [],
      pageInfo: { hasNextPage: true },
    },
    statusCheckRollup: pr.statusCheckRollup
      ? {
          ...pr.statusCheckRollup,
          contexts: { ...pr.statusCheckRollup.contexts, nodes: [] },
        }
      : null,
  };
}
export async function loadPullRequest(
  api: Transport,
  repo: string,
  number: number,
): Promise<PullRequest> {
  const [owner, name] = repo.split("/");
  const data = await graphql<{
    repository: { pullRequest: PullRequest | null } | null;
  }>(
    api,
    `query($owner:String!,$name:String!,$number:Int!) { repository(owner:$owner,name:$name) { pullRequest(number:$number) { ${fields} } } }`,
    { owner, name, number },
  );
  if (!data.repository?.pullRequest)
    throw new Error("This pull request is unavailable.");
  return data.repository.pullRequest;
}

async function graphql<T>(
  api: Transport,
  query: string,
  variables: object = {},
): Promise<T> {
  const response = (await api("graphql", { query, variables })) as {
    data: T;
    errors?: { message: string }[];
  };
  if (response.errors?.length)
    throw new Error(
      response.errors.map((e: { message: string }) => e.message).join("; "),
    );
  return response.data;
}

export async function loadDashboard(api: Transport): Promise<Dashboard> {
  const owned = new Map<string, PullRequest>();
  let cursor: string | null = null;
  let viewer: Dashboard["viewer"] | undefined;
  let totalOpen = 0;
  const warnings: string[] = [];
  // GitHub search caps results at 1,000. Report truncation instead of hiding it.
  for (let page = 0; page < 20; page++) {
    const data: SearchData = await graphql<SearchData>(
      api,
      `query($cursor:String) { viewer { login name avatarUrl }
      search(query:"is:pr is:open author:@me",type:ISSUE,first:50,after:$cursor) {
        issueCount pageInfo { hasNextPage endCursor } nodes { ... on PullRequest { ${summaryFields} } }
      } }`,
      { cursor },
    );
    viewer = data.viewer;
    totalOpen = data.search.issueCount;
    for (const pr of data.search.nodes as PullRequest[])
      if (pr.number)
        owned.set(`${pr.repository.nameWithOwner}#${pr.number}`, summary(pr));
    if (!data.search.pageInfo.hasNextPage) break;
    cursor = data.search.pageInfo.endCursor;
  }
  if (totalOpen > owned.size)
    warnings.push(
      "GitHub search did not return every open pull request (the maximum is 1,000). Some stacks may be missing.",
    );
  const repos = [
    ...new Set(
      [...owned.values()]
        .filter((p) => p.stack)
        .map((p) => p.repository.nameWithOwner),
    ),
  ];
  const stacks: Stack[] = [];
  const assigned = new Set<string>();
  // Preserve the API's bottom-to-top order; never infer ordering from PR numbers.
  for (const repo of repos) {
    try {
      const native: NativeStack[] = [];
      for (let page = 1; ; page++) {
        const batch = (await api(
          `repos/${repo}/stacks?per_page=100&page=${page}`,
        )) as NativeStack[];
        native.push(...batch);
        if (batch.length < 100) break;
      }
      const relevant = native.filter(
        (s) =>
          s.open &&
          s.pull_requests.some((p: { number: number }) =>
            owned.has(`${repo}#${p.number}`),
          ),
      );
      const missing = [
        ...new Set<number>(
          relevant.flatMap((s) =>
            s.pull_requests.map((p: { number: number }) => p.number),
          ),
        ),
      ].filter((n) => !owned.has(`${repo}#${n}`));
      const [owner, name] = repo.split("/");
      for (let offset = 0; offset < missing.length; offset += 20) {
        const batch = missing.slice(offset, offset + 20);
        const data = await graphql<{
          repository: Record<string, PullRequest | null>;
        }>(
          api,
          `query { repository(owner:${JSON.stringify(owner)},name:${JSON.stringify(name)}) { ${batch.map((n) => `p${n}:pullRequest(number:${n}) { ${summaryFields} }`).join("\n")} } }`,
        );
        for (const pr of Object.values(data.repository) as PullRequest[])
          if (pr) owned.set(`${repo}#${pr.number}`, summary(pr));
      }
      for (const s of relevant) {
        const prs = s.pull_requests
          .map((p: { number: number }) => owned.get(`${repo}#${p.number}`))
          .filter(Boolean) as PullRequest[];
        if (prs.length !== s.pull_requests.length)
          warnings.push(`Stack #${s.number} has inaccessible layers.`);
        if (!prs.length) continue;
        for (const pr of prs) assigned.add(`${repo}#${pr.number}`);
        stacks.push({
          id: `${repo}:${s.number}`,
          number: s.number,
          repository: repo,
          base: s.base.ref,
          native: true,
          incomplete: prs.length !== s.pull_requests.length,
          title: prs[0].title,
          prs,
          updatedAt: prs
            .map((p) => p.updatedAt)
            .sort()
            .at(-1)!,
        });
      }
    } catch (error) {
      warnings.push(
        `${repo}: ${error instanceof Error ? error.message : "Could not load stacks"}`,
      );
    }
  }
  const standalone = [...owned.values()].filter(
    (p) =>
      p.state === "OPEN" &&
      p.author?.login === viewer?.login &&
      !assigned.has(`${p.repository.nameWithOwner}#${p.number}`),
  );
  if (standalone.some((p) => p.stack))
    warnings.push(
      "Some native stack memberships could not be loaded. Their PRs appear under Unstacked until the next successful sync.",
    );
  if (!viewer)
    throw new Error(
      "GitHub did not return an authenticated account. Run gh auth login.",
    );
  return {
    viewer,
    stacks: stacks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    standalone,
    fetchedAt: new Date().toISOString(),
    warnings,
    totalOpen,
  };
}
