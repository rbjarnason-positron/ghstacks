# Stacks

A local browser dashboard for your native GitHub pull request stacks. It uses the active account in the GitHub CLI. Credentials stay in the CLI; they are never sent to the browser or saved by the application.

The source contains no bundled account, repository list, or pull request data. Each person signs in with their own GitHub CLI account; their profile and stacks are discovered at runtime. GitHub responses are cached only in server memory, while saved items and display preferences stay in that browser's local storage.

## Run

Requires Node.js 22.13+ and an authenticated `gh` CLI with access to your repositories.

For a new installation, run `gh auth login --hostname github.com` to connect your own account.

```sh
npm install
gh auth status
npm run dev
```

Open the Local URL printed by the server (normally http://localhost:3000).

For a production build without development tooling:

```sh
npm run build
npm start
```

`PORT=3001 npm start` selects another port. Both modes bind to loopback. Run `gh auth switch` to change the active GitHub account, then sync after the 30-second cache expires.

## Features

- Discovers your open authored PRs across repositories and loads their native stacks, including other authors' and merged layers within those stacks.
- Keeps GitHub's recorded base-to-tip order. Stack names use the title of the first layer.
- Shows CI, reviews, conflicts, branch freshness, drafts, and contiguous prefixes ready to land. GitHub remains authoritative for merge rules.
- Filters by repository, blockers, and ready prefixes; searches titles, branches, stack IDs, and PR numbers.
- Expands long stacks; inspects checks, unresolved review threads, diff sizes, descriptions, and branches.
- Opens PRs and check runs on GitHub; copies branch names and checkout commands.
- Saves favorites and display preferences locally. `/` searches, `j`/`k` navigate, `Esc` closes the inspector, `?` shows shortcuts.
- Refreshes visible tabs every two minutes, supports manual sync, and retains the last successful data when refresh fails.

## Scope and data handling

This is a read-only GitHub dashboard: it does not rebase, merge, approve, comment on, or modify pull requests. It discovers native stacks through your open authored PRs; closed stacks and stacks with no open PR authored by the active user are excluded. Unstacked also includes PRs whose stack metadata could not be loaded, with a visible warning.

GitHub search is capped at 1,000 results; truncation is reported. Individual PR details show up to 100 check contexts and 100 review threads; the UI links to all checks and marks unresolved counts as lower bounds when threads are truncated. Search summaries are lightweight; full descriptions, checks, and threads load on selection.

The local API rejects non-loopback hosts, cross-origin requests, and mutations. No public hosting or token setup is required. Do not expose this server through a public tunnel or reverse proxy.

## Validation

```sh
npm test
npm run typecheck
npm run build
```

Tests cover stack ordering, search pagination, partial API failures, conservative readiness, and local API request validation.

## Sharing the source

Share the source and lockfile, then have each person follow the Run instructions with their own GitHub account. Source publication does not expose the running local dashboard.

Keep generated builds, dependency folders, caches, logs, local environment files, and any screenshots or exports of private GitHub data out of the repository. The ignore rules cover common local files; `.gitattributes` also excludes these from Git source archives. Build the application again after cloning instead of sharing a working-directory backup.

Built with React, TypeScript, vinext/Vite, and Lucide icons. GitHub API references: https://docs.github.com/en/rest/pulls/stacks and https://docs.github.com/en/pull-requests/reference/stacked-pull-requests-apis-and-webhooks.
