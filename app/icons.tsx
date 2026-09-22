import * as Lucide from "lucide-react";
import type { LucideIcon, LucideProps } from "lucide-react";

type IconProps = LucideProps & { tooltip?: string };

// Keep the original SVG and its layout. SVG titles provide native hover tooltips;
// aria-label also makes the same explanation available to assistive technology.
function explained(Icon: LucideIcon, explanation: string) {
  return function ExplainedIcon({ tooltip, children, ...props }: IconProps) {
    const label = tooltip ?? props["aria-label"] ?? explanation;
    return (
      <Icon {...props} aria-label={label}>
        <title>{label}</title>
        {children}
      </Icon>
    );
  };
}

export const Activity = explained(
  Lucide.Activity,
  "CI checks: automated builds and tests for your pull requests.",
);
export const ArrowRight = explained(
  Lucide.ArrowRight,
  "Inspect this stack and its pull requests.",
);
export const ArrowUpRight = explained(
  Lucide.ArrowUpRight,
  "Open on GitHub in a new tab.",
);
export const Check = explained(Lucide.Check, "Passed or completed.");
export const CheckCheck = explained(
  Lucide.CheckCheck,
  "Ready to land: one or more consecutive layers are ready, starting at the base.",
);
export const ChevronDown = explained(
  Lucide.ChevronDown,
  "Expand or collapse details.",
);
export const ChevronRight = explained(
  Lucide.ChevronRight,
  "Inspect this layer.",
);
export const Circle = explained(
  Lucide.Circle,
  "No checks have been reported for this commit.",
);
export const CircleAlert = explained(
  Lucide.CircleAlert,
  "Needs attention: failing checks, conflicts, requested changes, or branch rules may block progress.",
);
export const CircleCheck = explained(Lucide.CircleCheck, "Check passed.");
export const Clock3 = explained(
  Lucide.Clock3,
  "Waiting for a check or branch update.",
);
export const Copy = explained(
  Lucide.Copy,
  "Copy the branch name to your clipboard.",
);
export const ExternalLink = explained(
  Lucide.ExternalLink,
  "Open on GitHub in a new tab.",
);
export const GitBranch = explained(
  Lucide.GitBranch,
  "Git branch: the line of development a pull request uses or builds on.",
);
export const GitMerge = explained(
  Lucide.GitMerge,
  "Merged: these changes have been incorporated into their target branch.",
);
export const GitPullRequest = explained(
  Lucide.GitPullRequest,
  "Pull request: a set of proposed changes for review.",
);
export const Inbox = explained(Lucide.Inbox, "No items match this view.");
export const Keyboard = explained(
  Lucide.Keyboard,
  "Show keyboard shortcuts. Press ? to open this guide.",
);
export const Layers3 = explained(
  Lucide.Layers3,
  "Stack: an ordered group of pull requests that build on one another.",
);
export const ListFilter = explained(
  Lucide.ListFilter,
  "Filter stacks and pull requests by repository.",
);
export const LoaderCircle = explained(
  Lucide.LoaderCircle,
  "Loading your stacks, reviews, and checks from GitHub.",
);
export const MessageSquare = explained(
  Lucide.MessageSquare,
  "Awaiting review: open, non-draft pull requests that still require approval.",
);
export const RefreshCw = explained(
  Lucide.RefreshCw,
  "Sync the latest stack, check, and review status from GitHub.",
);
export const Search = explained(
  Lucide.Search,
  "Search titles, branch names, stack IDs, or pull request numbers. Press / to focus.",
);
export const Settings2 = explained(
  Lucide.Settings2,
  "Display settings: compact cards and automatic refresh.",
);
export const ShieldCheck = explained(
  Lucide.ShieldCheck,
  "Review approved. Passing reviews alone do not guarantee a pull request can merge.",
);
export const Star = explained(
  Lucide.Star,
  "Save this stack or pull request to find it in Saved.",
);
export const Terminal = explained(
  Lucide.Terminal,
  "Copy a gh pr checkout command to your clipboard. Run it in your terminal to check out this pull request.",
);
export const X = explained(Lucide.X, "Close this panel.");
export const XCircle = explained(
  Lucide.XCircle,
  "A check failed or this pull request has a blocker.",
);

const statusHelp: Record<string, string> = {
  "Behind base": "This branch needs updates from the branch it builds on.",
  "Checks failed": "One or more automated checks failed for this commit.",
  "Checks passed": "GitHub reports passing checks for this commit.",
  "Checks running": "Automated checks are pending or still running.",
  "No checks": "GitHub has not reported any checks for this commit.",
  "Changes requested": "A reviewer has requested changes before approval.",
  "Needs review": "This pull request still needs the required review approval.",
  "Needs attention":
    "At least one layer has failing checks, conflicts, requested changes, or a branch update or rule to address.",
  "Ready to land":
    "A consecutive group of layers is ready, starting at the base. Higher layers cannot skip a blocked layer below them.",
  Ready:
    "GitHub reports a clean, mergeable pull request with no pending checks or required review.",
  Conflicts:
    "This branch conflicts with its base and needs conflict resolution.",
  Blocked:
    "GitHub reports unmet branch rules. Open the pull request to see the requirements.",
  Draft: "This pull request is still a draft and is not ready to merge.",
  Open: "This pull request is open; readiness has not been confirmed.",
  Merged: "These changes have been merged into their target branch.",
  Closed: "This pull request was closed without merging.",
  Complete: "This stack has no open pull requests.",
  "In progress":
    "The stack is open, but no consecutive group of layers is ready to land from the base yet.",
};

export function explainStatus(label: string) {
  return statusHelp[label] ? `${label} — ${statusHelp[label]}` : label;
}
