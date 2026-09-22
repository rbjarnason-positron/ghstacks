"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  explainStatus,
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleAlert,
  CircleCheck,
  Clock3,
  Copy,
  ExternalLink,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Inbox,
  Keyboard,
  Layers3,
  ListFilter,
  LoaderCircle,
  MessageSquare,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Star,
  Terminal,
  X,
  XCircle,
} from "./icons";
import {
  checks,
  ci,
  needsAttention,
  readyPrefix,
  stackStatus,
  status,
} from "../lib/model";
import type { Dashboard, PullRequest, Stack, Tone } from "../lib/model";
import Link from "next/link";

type Filter = "all" | "attention" | "ready";
function ago(date: string) {
  const m = Math.max(0, Math.floor((Date.now() - Date.parse(date)) / 60000));
  return m < 1
    ? "just now"
    : m < 60
      ? `${m}m ago`
      : m < 1440
        ? `${Math.floor(m / 60)}h ago`
        : `${Math.floor(m / 1440)}d ago`;
}
function Badge({ label, tone = "gray" }: { label: string; tone?: Tone }) {
  return (
    <span className={`badge ${tone}`} title={explainStatus(label)}>
      <i />
      {label}
    </span>
  );
}
function StateIcon({ pr }: { pr: PullRequest }) {
  const s = status(pr);
  const Icon =
    pr.state === "MERGED"
      ? GitMerge
      : s.tone === "red"
        ? XCircle
        : s.tone === "green"
          ? CircleCheck
          : s.tone === "amber"
            ? Clock3
            : GitPullRequest;
  return (
    <Icon
      size={15}
      className={`ink-${s.tone}`}
      tooltip={explainStatus(s.label)}
      aria-label={s.label}
    />
  );
}
const ext = { target: "_blank", rel: "noreferrer noopener" };

export default function Home() {
  const [detail, setDetail] = useState<{ key: string; pr: PullRequest } | null>(
      null,
    ),
    [detailFailure, setDetailFailure] = useState<{
      key: string;
      message: string;
    } | null>(null);
  const [data, setData] = useState<Dashboard | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [section, setSection] = useState<"stacks" | "standalone" | "saved">(
      "stacks",
    ),
    [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState(""),
    [repo, setRepo] = useState("all"),
    [sort, setSort] = useState("updated");
  const [selectedId, setSelectedId] = useState(""),
    [selectedPr, setSelectedPr] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]),
    [saved, setSaved] = useState<string[]>([]);
  const [compact, setCompact] = useState(false),
    [auto, setAuto] = useState(true),
    [help, setHelp] = useState(false),
    [settings, setSettings] = useState(false),
    [toast, setToast] = useState("");
  const searchRef = useRef<HTMLInputElement>(null),
    dialogRef = useRef<HTMLDialogElement>(null),
    busy = useRef(false);
  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const body = (await response.json()) as Dashboard & { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not sync GitHub.");
      setData(body);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sync GitHub.");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);
  // Browser preferences must load after hydration so server and client markup agree.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    refresh();
    try {
      const p = JSON.parse(
        localStorage.getItem("ghstacks.preferences") || "{}",
      );
      if (Array.isArray(p.saved))
        setSaved(p.saved.filter((s: unknown) => typeof s === "string"));
      if (typeof p.compact === "boolean") setCompact(p.compact);
      if (typeof p.auto === "boolean") setAuto(p.auto);
    } catch {}
  }, [refresh]);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 120000);
    return () => clearInterval(t);
  }, [auto, refresh]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (help) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [help]);
  function prefs(p: object) {
    try {
      localStorage.setItem(
        "ghstacks.preferences",
        JSON.stringify({ saved, compact, auto, ...p }),
      );
    } catch {
      setToast("Your browser could not save this preference.");
    }
  }
  function save(id: string) {
    const next = saved.includes(id)
      ? saved.filter((s) => s !== id)
      : [...saved, id];
    setSaved(next);
    prefs({ saved: next });
  }
  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast(`${label} copied`);
    } catch {
      setToast("Clipboard unavailable. Select and copy the text instead.");
    }
  }
  const standalone = useMemo<Stack[]>(
    () =>
      data?.standalone.map((p) => ({
        id: `${p.repository.nameWithOwner}:pr:${p.number}`,
        number: p.number,
        repository: p.repository.nameWithOwner,
        base: p.baseRefName,
        native: false,
        title: p.title,
        prs: [p],
        updatedAt: p.updatedAt,
      })) ?? [],
    [data],
  );
  const all = useMemo(
    () => [...(data?.stacks ?? []), ...standalone],
    [data, standalone],
  );
  const source =
    section === "standalone"
      ? standalone
      : section === "saved"
        ? all.filter((s) => saved.includes(s.id))
        : (data?.stacks ?? []);
  const repos = [...new Set(all.map((s) => s.repository))].sort();
  const visible = source
    .filter(
      (s) =>
        (repo === "all" || repo === s.repository) &&
        `${s.title} ${s.number} ${s.repository} ${s.base} ${s.prs.map((p) => `${p.title} ${p.number} ${p.headRefName}`).join(" ")}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()) &&
        (filter !== "attention" || s.prs.some(needsAttention)) &&
        (filter !== "ready" || readyPrefix(s) > 0),
    )
    .sort((a, b) =>
      sort === "size"
        ? b.prs.length - a.prs.length
        : sort === "attention"
          ? Number(b.prs.some(needsAttention)) -
              Number(a.prs.some(needsAttention)) ||
            b.updatedAt.localeCompare(a.updatedAt)
          : b.updatedAt.localeCompare(a.updatedAt),
    );
  const selected = all.find((s) => s.id === selectedId),
    summaryPr =
      selected?.prs.find((p) => p.number === selectedPr) ??
      selected?.prs.find((p) => p.state === "OPEN") ??
      selected?.prs[0];
  const detailKey =
    selected && summaryPr
      ? `${selected.repository}:${summaryPr.number}:${data?.fetchedAt}`
      : "";
  const pr = detail?.key === detailKey ? detail.pr : summaryPr;
  const detailsLoaded = detail?.key === detailKey;
  const detailError =
    detailFailure?.key === detailKey ? detailFailure.message : "";
  const detailRepo = selected?.repository,
    detailNumber = summaryPr?.number;
  useEffect(() => {
    if (!detailKey || !detailRepo || !detailNumber) return;
    const controller = new AbortController();
    fetch(
      `/api/pull-request?repo=${encodeURIComponent(detailRepo)}&number=${detailNumber}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        const body = (await r.json()) as PullRequest & { error?: string };
        if (!r.ok)
          throw new Error(body.error || "Could not load pull request details.");
        return body;
      })
      .then((body) => {
        if (!controller.signal.aborted) setDetail({ key: detailKey, pr: body });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setDetailFailure({ key: detailKey, message: e.message });
      });
    return () => controller.abort();
  }, [detailKey, detailRepo, detailNumber]);
  function select(s: Stack, p?: PullRequest) {
    setSelectedId(s.id);
    setSelectedPr(
      p?.number ??
        s.prs.find((p) => p.state === "OPEN")?.number ??
        s.prs[0]?.number ??
        null,
    );
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          'input,textarea,select,[contenteditable="true"]',
        ) ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        help
      )
        return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "?") {
        e.preventDefault();
        setHelp(true);
      }
      if (e.key === "Escape") {
        setSelectedId("");
        setSettings(false);
      }
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const i = visible.findIndex((s) => s.id === selectedId);
        const s =
          visible[
            Math.max(
              0,
              Math.min(visible.length - 1, i + (e.key === "j" ? 1 : -1)),
            )
          ];
        if (s) {
          select(s);
          document
            .getElementById(`stack-${s.id}`)
            ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible, selectedId, help]);
  const attention =
      data?.stacks.filter((s) => s.prs.some(needsAttention)).length ?? 0,
    ready = data?.stacks.filter((s) => readyPrefix(s) > 0).length ?? 0;
  const review =
    data?.stacks
      .flatMap((s) => s.prs)
      .filter(
        (p) =>
          p.state === "OPEN" &&
          !p.isDraft &&
          p.reviewDecision === "REVIEW_REQUIRED",
      ).length ?? 0;
  function navigate(s: typeof section) {
    setSection(s);
    setFilter("all");
    setSelectedId("");
  }
  function metric(f: Filter) {
    navigate("stacks");
    setFilter(f);
    setRepo("all");
    setQuery("");
  }
  return (
    <div className={`app ${compact ? "compact" : ""}`}>
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span>
            <Layers3 size={24} />
          </span>
          stacks<b>.</b>
        </Link>
        <div className="workspace">
          <span className="workspace-avatar">
            {data?.viewer.name?.[0] ?? "G"}
          </span>
          <div>
            <strong>Personal workspace</strong>
            <small>
              {data ? "GitHub connected" : "Connecting to GitHub"}
              <i
                className={data ? "online" : "offline"}
                title={
                  data
                    ? "Connected to your GitHub account"
                    : "Waiting for the GitHub connection"
                }
              />
            </small>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {(
            [
              ["stacks", "My stacks", Layers3, data?.stacks.length],
              ["standalone", "Unstacked", GitPullRequest, standalone.length],
              [
                "saved",
                "Saved",
                Star,
                all.filter((s) => saved.includes(s.id)).length,
              ],
            ] as const
          ).map(([id, label, Icon, count]) => (
            <button
              key={id}
              className={`nav-item ${section === id ? "active" : ""}`}
              onClick={() => navigate(id)}
            >
              <Icon
                size={18}
                tooltip={
                  id === "stacks"
                    ? "Show your native GitHub stacks"
                    : id === "standalone"
                      ? "Show open pull requests outside a loaded native stack"
                      : "Show stacks and pull requests you have saved"
                }
              />
              <span>{label}</span>
              <small>{count ?? "–"}</small>
            </button>
          ))}
        </nav>
        <div className="nav-label repo-label">
          REPOSITORIES<span>{repos.length}</span>
        </div>
        <div className="repo-nav">
          <button
            className={repo === "all" ? "chosen" : ""}
            onClick={() => setRepo("all")}
          >
            <i className="repo-dot all-dot" />
            All repositories
          </button>
          {repos.map((r, i) => (
            <button
              key={r}
              className={repo === r ? "chosen" : ""}
              title={r}
              onClick={() => setRepo(repo === r ? "all" : r)}
            >
              <i className={`repo-dot color-${i % 4}`} />
              <span>{r.split("/")[1]}</span>
              <small>{all.filter((s) => s.repository === r).length}</small>
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="quiet-note">
            <GitBranch size={21} />
            <strong>Small changes. Big picture.</strong>
            <p>
              Every layer, from first commit
              <br />
              to the finish line.
            </p>
          </div>
          <button className="nav-item" onClick={() => setHelp(true)}>
            <Keyboard size={18} />
            <span>Keyboard shortcuts</span>
            <kbd>?</kbd>
          </button>
          <div className="profile">
            <span>
              {data?.viewer.name
                ?.split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("") ?? "GH"}
            </span>
            <div>
              <strong>{data?.viewer.name ?? "Your workspace"}</strong>
              <small>
                {data ? `@${data.viewer.login}` : "Connecting to GitHub"}
              </small>
            </div>
            <a
              href={
                data
                  ? `https://github.com/${data.viewer.login}`
                  : "https://github.com"
              }
              {...ext}
              aria-label="GitHub profile"
              title="GitHub profile"
            >
              <ArrowUpRight size={15} />
            </a>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <Layers3 size={16} />
            <span>Workspace</span>
            <ChevronRight
              size={13}
              tooltip="Your current location within the workspace"
            />
            <strong>
              {section === "stacks"
                ? "My stacks"
                : section === "saved"
                  ? "Saved"
                  : "Unstacked"}
            </strong>
          </div>
          <div className="topbar-right">
            <span>
              <i
                className={error ? "offline" : "online"}
                title={
                  error
                    ? "The latest GitHub sync failed"
                    : "GitHub connection status"
                }
              />
              {error
                ? "Sync interrupted"
                : data
                  ? "Connected to GitHub"
                  : "Connecting"}
            </span>
            <a
              href="https://github.com/pulls"
              {...ext}
              className="icon-button"
              aria-label="Open GitHub pull requests"
              title="Open GitHub pull requests"
            >
              <ExternalLink size={17} />
            </a>
          </div>
        </header>
        <main>
          <section className="page-heading">
            <div>
              <div className="eyebrow">YOUR GITHUB FLIGHT DECK</div>
              <h1>
                {section === "stacks"
                  ? "Your work, in order."
                  : section === "saved"
                    ? "Keep the important close."
                    : "Room to build on."}
              </h1>
              <p>
                {section === "stacks"
                  ? "A clear path from a stack of changes to a shipped idea."
                  : section === "saved"
                    ? "The stacks and pull requests you’re keeping an eye on."
                    : "Your open pull requests outside a loaded native stack."}
              </p>
            </div>
            <button
              className="button refresh"
              disabled={loading}
              onClick={refresh}
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} />
              {loading ? "Syncing…" : "Sync GitHub"}
            </button>
          </section>
          <section className="stats" aria-label="Stack overview">
            <button className="stat" onClick={() => metric("all")}>
              <span>
                <Layers3 size={16} />
                Active stacks
              </span>
              <div>
                <strong>{data?.stacks.length ?? "—"}</strong>
                <small>across your repositories</small>
              </div>
              <div className="stat-track">
                <i className="blue-track" style={{ width: "100%" }} />
              </div>
            </button>
            <button className="stat" onClick={() => metric("attention")}>
              <span>
                <CircleAlert size={16} />
                Needs attention
              </span>
              <div>
                <strong>{data ? attention : "—"}</strong>
                <small>stacks with blockers</small>
              </div>
              <div className="stat-track">
                <i
                  className="red-track"
                  style={{
                    width: `${data?.stacks.length ? (attention / data.stacks.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </button>
            <button className="stat" onClick={() => metric("ready")}>
              <span>
                <CheckCheck size={16} />
                Ready to land
              </span>
              <div>
                <strong>{data ? ready : "—"}</strong>
                <small>with a clear first layer</small>
              </div>
              <div className="stat-track">
                <i
                  className="green-track"
                  style={{
                    width: `${data?.stacks.length ? (ready / data.stacks.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </button>
            <div className="stat">
              <span>
                <MessageSquare size={16} />
                Awaiting review
              </span>
              <div>
                <strong>{data ? review : "—"}</strong>
                <small>pull requests in stacks</small>
              </div>
              <div className="review-track">
                {Array.from({ length: 8 }, (_, i) => (
                  <i key={i} />
                ))}
              </div>
            </div>
          </section>
          {error && (
            <div className="notice error-notice" role="alert">
              <CircleAlert size={18} />
              <div>
                <strong>
                  {data
                    ? "Sync failed. Showing the last successful update."
                    : "Couldn’t connect to GitHub."}
                </strong>
                <p>{error}</p>
                {!data && (
                  <p>
                    Check your connection and run <code>gh auth login</code> in
                    your terminal, then retry.
                  </p>
                )}
              </div>
              <button
                className="text-button"
                onClick={refresh}
                disabled={loading}
              >
                Retry
              </button>
            </div>
          )}
          {data?.warnings.map((w) => (
            <div className="notice" role="status" key={w}>
              <CircleAlert size={16} />
              <span>{w}</span>
            </div>
          ))}
          <section className="work-area">
            <div className="section-title">
              <div>
                <h2>
                  {section === "stacks"
                    ? "My stacks"
                    : section === "saved"
                      ? "Saved for later"
                      : "Unstacked pull requests"}
                </h2>
                <span>{source.length}</span>
              </div>
              <small>
                <Clock3
                  size={12}
                  tooltip="Time since the last successful GitHub sync"
                />
                {data
                  ? `Synced ${ago(data.fetchedAt)}`
                  : "Fetching your workspace"}
              </small>
            </div>
            <div className="toolbar">
              <div className="tabs" role="group" aria-label="Filter stacks">
                {(
                  [
                    ["all", "All"],
                    ["attention", "Needs attention"],
                    ["ready", "Ready to land"],
                  ] as const
                ).map(([f, label]) => (
                  <button
                    key={f}
                    className={filter === f ? "active" : ""}
                    aria-pressed={filter === f}
                    onClick={() => setFilter(f)}
                  >
                    {f === "attention" && <i />}
                    {label}
                    {f === "all" && <span>{source.length}</span>}
                  </button>
                ))}
              </div>
              <div className="view-controls">
                <select
                  aria-label="Sort stacks"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="updated">Recently updated</option>
                  <option value="attention">Attention first</option>
                  <option value="size">Largest stacks</option>
                </select>
                <div className="settings-wrap">
                  <button
                    className="icon-button"
                    aria-label="Display settings"
                    title="Display settings"
                    aria-expanded={settings}
                    onClick={() => setSettings(!settings)}
                  >
                    <Settings2 size={17} />
                  </button>
                  {settings && (
                    <div className="settings-popover">
                      <strong>Display preferences</strong>
                      <label>
                        <input
                          type="checkbox"
                          checked={compact}
                          onChange={(e) => {
                            setCompact(e.target.checked);
                            prefs({ compact: e.target.checked });
                          }}
                        />
                        Compact stack cards
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={auto}
                          onChange={(e) => {
                            setAuto(e.target.checked);
                            prefs({ auto: e.target.checked });
                          }}
                        />
                        Auto-sync every 2 minutes
                      </label>
                      <small>Saved on this device.</small>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="search-row">
              <div className="search">
                <Search size={17} />
                <input
                  ref={searchRef}
                  aria-label="Search stacks"
                  placeholder="Find a stack, pull request, or branch…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query ? (
                  <button
                    className="icon-button"
                    aria-label="Clear search"
                    title="Clear search"
                    onClick={() => setQuery("")}
                  >
                    <X size={14} tooltip="Clear the search text" />
                  </button>
                ) : (
                  <kbd>/</kbd>
                )}
              </div>
              <div className="repo-select">
                <ListFilter size={15} />
                <select
                  aria-label="Filter repository"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                >
                  <option value="all">All repositories</option>
                  {repos.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={`content-grid ${selected ? "with-detail" : ""}`}>
              <div className="stack-list">
                {loading && !data && (
                  <div className="empty-state">
                    <LoaderCircle size={30} className="spin" />
                    <h3>Putting your stacks in order</h3>
                    <p>
                      Gathering pull requests, reviews, and check results from
                      GitHub.
                    </p>
                    <div className="loading-lines">
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                )}
                {!loading && !data && (
                  <div className="empty-state">
                    <GitBranch size={32} />
                    <h3>Your workspace is waiting</h3>
                    <p>Connect GitHub to see your real stacks here.</p>
                    <button className="button" onClick={refresh}>
                      <RefreshCw size={15} />
                      Try again
                    </button>
                  </div>
                )}
                {data && !visible.length && (
                  <div className="empty-state">
                    <Inbox size={34} />
                    <h3>
                      {section === "saved" && !source.length
                        ? "A little space for your priorities"
                        : filter === "ready"
                          ? "Nothing ready to land just yet"
                          : "No stacks in this view"}
                    </h3>
                    <p>
                      {section === "saved" && !source.length
                        ? "Star a stack or pull request to find it here."
                        : "Try another filter, repository, or search."}
                    </p>
                    <button
                      className="button"
                      onClick={() => {
                        setQuery("");
                        setFilter("all");
                        setRepo("all");
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                )}
                {visible.map((s) => {
                  const open = s.prs.filter((p) => p.state === "OPEN");
                  const shown = expanded.includes(s.id)
                    ? s.prs
                    : s.prs.slice(0, compact ? 0 : 3);
                  return (
                    <article
                      key={s.id}
                      id={`stack-${s.id}`}
                      className={`stack-card ${selectedId === s.id ? "selected" : ""}`}
                    >
                      <div className="card-heading">
                        <div>
                          <span>{s.repository}</span>
                          <i>/</i>
                          <small>
                            {s.native ? "STACK" : "PR"} {s.number}
                          </small>
                        </div>
                        <button
                          className={`icon-button ${saved.includes(s.id) ? "is-saved" : ""}`}
                          aria-label={`${saved.includes(s.id) ? "Unsave" : "Save"} ${s.title}`}
                          aria-pressed={saved.includes(s.id)}
                          onClick={() => save(s.id)}
                        >
                          <Star
                            tooltip={
                              saved.includes(s.id)
                                ? "Remove this item from Saved"
                                : "Save this item for quick access later"
                            }
                            size={16}
                            fill={
                              saved.includes(s.id) ? "currentColor" : "none"
                            }
                          />
                        </button>
                      </div>
                      <button className="stack-title" onClick={() => select(s)}>
                        <h3>{s.title}</h3>
                        <ArrowUpRight
                          size={17}
                          tooltip="Open the stack inspector to explore its layers"
                        />
                      </button>
                      <div className="stack-summary">
                        <Badge {...stackStatus(s)} />
                        <span>
                          <Layers3 size={13} />
                          {s.prs.length}{" "}
                          {s.prs.length === 1 ? "layer" : "layers"}
                        </span>
                        <span className="updated">
                          Updated {ago(s.updatedAt)}
                        </span>
                      </div>
                      <div
                        className="stack-map"
                        aria-label="Stack order from base to tip"
                      >
                        <span className="base-label" title={s.base}>
                          <GitBranch
                            size={12}
                            tooltip={`Base branch: ${s.base}. The first layer builds on this branch.`}
                          />
                          {["main", "master"].includes(s.base)
                            ? s.base
                            : "base"}
                        </span>
                        <i className="map-line" />
                        {s.prs.slice(0, 26).map((p, i) => (
                          <div className="map-segment" key={p.number}>
                            <button
                              title={`Layer ${i + 1}: #${p.number} ${p.title} — ${explainStatus(status(p).label)}`}
                              aria-label={`Inspect layer ${i + 1}, ${p.title}`}
                              onClick={() => select(s, p)}
                              className={`map-node ${status(p).tone} ${selectedId === s.id && pr?.number === p.number ? "current" : ""}`}
                            >
                              {p.state === "MERGED" ||
                              status(p).tone === "green" ? (
                                <Check
                                  size={10}
                                  tooltip={`Layer ${i + 1}: ${explainStatus(status(p).label)}`}
                                />
                              ) : status(p).tone === "red" ? (
                                <X
                                  size={9}
                                  tooltip={`Layer ${i + 1}: ${explainStatus(status(p).label)}`}
                                />
                              ) : (
                                <i />
                              )}
                            </button>
                            {i < Math.min(s.prs.length, 26) - 1 && (
                              <i className="map-line" />
                            )}
                          </div>
                        ))}
                        {s.prs.length > 26 && (
                          <small>+{s.prs.length - 26}</small>
                        )}
                        <span className="tip-label">tip</span>
                      </div>
                      {shown.length > 0 && (
                        <div className="pr-rows">
                          {shown.map((p, i) => (
                            <button
                              className={`pr-row ${selectedId === s.id && pr?.number === p.number ? "current" : ""}`}
                              key={p.number}
                              onClick={() => select(s, p)}
                            >
                              <span className="layer-number">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                              <StateIcon pr={p} />
                              <span className="pr-row-title">{p.title}</span>
                              <span className="pr-number">#{p.number}</span>
                              <span
                                className={`row-status ink-${ci(p).tone}`}
                                title={explainStatus(ci(p).label)}
                              >
                                {ci(p).tone === "green" ? (
                                  <Check
                                    size={14}
                                    tooltip={explainStatus(ci(p).label)}
                                  />
                                ) : ci(p).tone === "red" ? (
                                  <XCircle
                                    size={14}
                                    tooltip={explainStatus(ci(p).label)}
                                  />
                                ) : ci(p).tone === "amber" ? (
                                  <Clock3
                                    size={14}
                                    tooltip={explainStatus(ci(p).label)}
                                  />
                                ) : (
                                  <Circle size={12} />
                                )}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="stack-footer">
                        <div className="card-indicators">
                          <span title="Open layers with passing checks">
                            <Activity
                              size={13}
                              tooltip="Open layers with passing CI checks, out of all open layers in this stack"
                            />
                            {open.filter((p) => ci(p).tone === "green").length}/
                            {open.length} checks passing
                          </span>
                          <span title="Open layers with approval">
                            <ShieldCheck
                              size={13}
                              tooltip="Number of open layers whose review decision is Approved"
                            />
                            {
                              open.filter(
                                (p) => p.reviewDecision === "APPROVED",
                              ).length
                            }{" "}
                            approved
                          </span>
                        </div>
                        {s.prs.length > (compact ? 0 : 3) ? (
                          <button
                            className="text-button"
                            onClick={() =>
                              setExpanded(
                                expanded.includes(s.id)
                                  ? expanded.filter((id) => id !== s.id)
                                  : [...expanded, s.id],
                              )
                            }
                          >
                            {expanded.includes(s.id)
                              ? "Show less"
                              : compact
                                ? "Show layers"
                                : `+${s.prs.length - 3} more layers`}
                            <ChevronDown
                              tooltip={
                                expanded.includes(s.id)
                                  ? "Collapse the extra layers"
                                  : "Show every layer in this stack"
                              }
                              size={13}
                              className={
                                expanded.includes(s.id) ? "rotate" : ""
                              }
                            />
                          </button>
                        ) : (
                          <button
                            className="text-button"
                            onClick={() => select(s)}
                          >
                            Inspect
                            <ArrowRight size={13} />
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
                {data && visible.length > 0 && (
                  <div className="list-end">
                    <span />
                    {visible.length}{" "}
                    {section === "standalone" ? "pull requests" : "stacks"} in
                    view
                    <span />
                  </div>
                )}
              </div>
              {selected && pr ? (
                <aside
                  className="inspector"
                  aria-label="Pull request inspector"
                >
                  <div className="inspector-heading">
                    <span>
                      <Layers3 size={16} />
                      {selected.native ? "STACK" : "PULL REQUEST"}{" "}
                      {selected.number}
                    </span>
                    <button
                      className="icon-button"
                      aria-label="Close inspector"
                      title="Close inspector"
                      onClick={() => setSelectedId("")}
                    >
                      <X size={18} tooltip="Close the pull request inspector" />
                    </button>
                  </div>
                  <div className="inspector-intro">
                    <Badge {...stackStatus(selected)} />
                    <h3>{selected.title}</h3>
                    <p>{selected.repository}</p>
                    <div className="base-info">
                      <GitBranch
                        size={13}
                        tooltip={`Stack base branch: ${selected.base}`}
                      />
                      <span title={selected.base}>Base: {selected.base}</span>
                    </div>
                  </div>
                  {selected.prs.length > 1 && (
                    <div className="layer-navigator">
                      <div className="small-label">
                        STACK ORDER<span>BASE → TIP</span>
                      </div>
                      <div className="layer-scroll">
                        {selected.prs.map((p, i) => (
                          <button
                            className={`layer-item ${p.number === pr.number ? "active" : ""}`}
                            key={p.number}
                            onClick={() => setSelectedPr(p.number)}
                          >
                            <span className="layer-rail">
                              <StateIcon pr={p} />
                            </span>
                            <span>
                              <small>
                                Layer {i + 1}
                                <b>#{p.number}</b>
                              </small>
                              <strong>{p.title}</strong>
                            </span>
                            <ChevronRight size={13} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="pr-detail">
                    <div className="detail-topline">
                      <span className="small-label">
                        PULL REQUEST #{pr.number}
                      </span>
                      <a
                        href={pr.url}
                        {...ext}
                        aria-label="Open pull request on GitHub"
                        title="Open pull request on GitHub"
                      >
                        <ExternalLink size={15} />
                      </a>
                    </div>
                    <h3>{pr.title}</h3>
                    <Badge {...status(pr)} />
                    <div className="diff-summary">
                      <span className="additions">
                        +{pr.additions.toLocaleString()}
                      </span>
                      <span className="deletions">
                        −{pr.deletions.toLocaleString()}
                      </span>
                      <span>{pr.changedFiles} files changed</span>
                    </div>
                    <div className="branch-box">
                      <GitBranch
                        size={15}
                        tooltip={`Pull request branch: ${pr.headRefName}`}
                      />
                      <code title={pr.headRefName}>{pr.headRefName}</code>
                      <button
                        className="icon-button"
                        aria-label="Copy branch name"
                        title="Copy branch name"
                        onClick={() => copy(pr.headRefName, "Branch name")}
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <div className="detail-facts">
                      <div>
                        <span>Author</span>
                        <strong>@{pr.author?.login ?? "ghost"}</strong>
                      </div>
                      <div>
                        <span>Review</span>
                        <strong>
                          {pr.reviewDecision === "APPROVED"
                            ? "Approved"
                            : pr.reviewDecision === "CHANGES_REQUESTED"
                              ? "Changes requested"
                              : pr.reviewDecision === "REVIEW_REQUIRED"
                                ? "Review required"
                                : "No review decision"}
                        </strong>
                      </div>
                      <div>
                        <span>Mergeability</span>
                        <strong>
                          {pr.mergeable === "CONFLICTING"
                            ? "Has conflicts"
                            : pr.mergeable === "MERGEABLE"
                              ? "No conflicts"
                              : "Calculating…"}
                        </strong>
                      </div>
                      <div>
                        <span>Discussions</span>
                        <strong>
                          {detailsLoaded
                            ? `${pr.reviewThreads.nodes.filter((t) => !t.isResolved).length}${pr.reviewThreads.pageInfo.hasNextPage ? "+" : ""} unresolved`
                            : `${pr.reviewThreads.totalCount} review threads`}{" "}
                          · {pr.comments.totalCount} comments
                        </strong>
                      </div>
                    </div>
                    {needsAttention(pr) && (
                      <div className="blocker-note">
                        <CircleAlert size={15} />
                        <div>
                          <strong>Before this layer can land</strong>
                          <p>
                            {[
                              pr.mergeable === "CONFLICTING" &&
                                "Resolve merge conflicts.",
                              ci(pr).tone === "red" &&
                                "Fix the failing checks.",
                              pr.reviewDecision === "CHANGES_REQUESTED" &&
                                "Address requested changes.",
                              pr.mergeStateStatus === "BEHIND" &&
                                "Update this branch from its base.",
                              pr.mergeStateStatus === "BLOCKED" &&
                                "Check branch rules on GitHub.",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="checks-heading">
                      <span className="small-label">CHECKS</span>
                      <Badge {...ci(pr)} />
                    </div>
                    <div className="check-list">
                      {!detailsLoaded && (
                        <p className="no-checks">
                          {detailError || "Loading check details…"}
                        </p>
                      )}
                      {checks(pr)
                        .slice(0, 8)
                        .map((c, i) => (
                          <a
                            className="check-item"
                            key={`${c.name}:${i}`}
                            href={c.url ?? `${pr.url}/checks`}
                            {...ext}
                          >
                            {["SUCCESS", "NEUTRAL", "SKIPPED"].includes(
                              c.conclusion ?? "",
                            ) ? (
                              <CircleCheck
                                size={14}
                                className="ink-green"
                                tooltip={`Check ${c.conclusion?.toLowerCase().replaceAll("_", " ")}: ${c.name}`}
                              />
                            ) : c.status !== "COMPLETED" ? (
                              <Clock3
                                size={14}
                                className="ink-amber"
                                tooltip={`Check ${c.status.toLowerCase().replaceAll("_", " ")}: ${c.name}`}
                              />
                            ) : (
                              <XCircle
                                size={14}
                                className="ink-red"
                                tooltip={`Check ${(c.conclusion ?? c.status).toLowerCase().replaceAll("_", " ")}: ${c.name}`}
                              />
                            )}
                            <span>
                              {c.name}
                              <small>
                                {(c.conclusion ?? c.status)
                                  .toLowerCase()
                                  .replaceAll("_", " ")}
                              </small>
                            </span>
                            <ArrowUpRight size={12} />
                          </a>
                        ))}
                      {detailsLoaded && !checks(pr).length && (
                        <p className="no-checks">
                          No checks reported for this commit.
                        </p>
                      )}
                      {(pr.statusCheckRollup?.contexts.totalCount ?? 0) > 8 && (
                        <a
                          className="text-button"
                          href={`${pr.url}/checks`}
                          {...ext}
                        >
                          See all {pr.statusCheckRollup?.contexts.totalCount}{" "}
                          checks
                          <ArrowUpRight size={13} />
                        </a>
                      )}
                    </div>
                    {pr.bodyText && (
                      <details className="description">
                        <summary>
                          Description
                          <ChevronDown size={14} />
                        </summary>
                        <p>{pr.bodyText}</p>
                      </details>
                    )}
                    <div className="detail-actions">
                      <a className="button primary" href={pr.url} {...ext}>
                        Open on GitHub
                        <ArrowUpRight size={15} />
                      </a>
                      <button
                        className="button"
                        onClick={() =>
                          copy(
                            `gh pr checkout ${pr.number} --repo ${selected.repository}`,
                            "Checkout command",
                          )
                        }
                      >
                        <Terminal size={15} />
                        Checkout
                      </button>
                    </div>
                    <p className="merge-note">
                      Layers land from the base up. GitHub verifies all merge
                      requirements.
                    </p>
                  </div>
                </aside>
              ) : (
                data &&
                visible.length > 0 && (
                  <aside className="overview-panel">
                    <div className="overview-mark">
                      <Layers3 size={29} />
                    </div>
                    <span className="eyebrow">THE BIG PICTURE</span>
                    <h3>
                      Every change
                      <br />
                      has a place.
                    </h3>
                    <p>
                      Select a stack to see its layers,
                      <br />
                      review status, and what’s next.
                    </p>
                    <div className="overview-diagram">
                      <div>
                        <span className="green">
                          <Check size={14} />
                        </span>
                        <p>Checks & reviews</p>
                        <ShieldCheck size={14} />
                      </div>
                      <div>
                        <span className="blue">
                          <GitPullRequest size={14} />
                        </span>
                        <p>One layer at a time</p>
                        <GitBranch size={14} />
                      </div>
                      <div>
                        <span className="gray">
                          <GitMerge size={14} />
                        </span>
                        <p>All the way to main</p>
                        <CheckCheck size={14} />
                      </div>
                    </div>
                    <div className="legend">
                      {[
                        ["green", "Ready"],
                        ["blue", "In progress"],
                        ["red", "Attention"],
                        ["purple", "Merged"],
                      ].map(([c, l]) => (
                        <span key={c} title={l}>
                          <i className={c} />
                          {l}
                        </span>
                      ))}
                    </div>
                    <div className="shortcut-hint">
                      <kbd>j</kbd>
                      <kbd>k</kbd>
                      <span>to move between stacks</span>
                    </div>
                  </aside>
                )
              )}
            </div>
          </section>
          <footer className="page-footer">
            <span>
              <Layers3 size={13} />A little order for your work in progress.
            </span>
            <span>
              Live GitHub data · {auto ? "Auto-sync on" : "Manual sync"}
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      <dialog
        ref={dialogRef}
        onCancel={() => setHelp(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setHelp(false);
        }}
        className="help-dialog"
      >
        <div>
          <h2>Find your flow</h2>
          <button
            className="icon-button"
            onClick={() => setHelp(false)}
            aria-label="Close keyboard shortcuts"
            title="Close keyboard shortcuts"
          >
            <X size={18} tooltip="Close the keyboard shortcut guide" />
          </button>
        </div>
        <p>A few shortcuts to keep you moving.</p>
        {[
          ["/", "Search stacks and pull requests"],
          ["j / k", "Select the next / previous stack"],
          ["Esc", "Close the inspector"],
          ["?", "Show keyboard shortcuts"],
        ].map(([key, text]) => (
          <div className="shortcut-row" key={key}>
            <span>{text}</span>
            <kbd>{key}</kbd>
          </div>
        ))}
        <p>Saved stacks and display preferences stay on this device.</p>
      </dialog>
    </div>
  );
}
