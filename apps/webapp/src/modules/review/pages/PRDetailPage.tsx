import { useIsMobile } from "#/ds-deps";
import { TooltipProvider } from "#/ds-deps/tooltip";
import { AvatarFallback, AvatarImage, AvatarRoot } from "#/ds/avatar";
import { Badge, BadgeVariant } from "#/ds/badge";
import { BreadcrumbExternalLink, BreadcrumbItem } from "#/ds/breadcrumb";
import { Button, IconButton } from "#/ds/button";
import { MiddleTruncate } from "#/ds/middle-truncate";
import { Skeleton } from "#/ds/skeleton";
import { Tab, TabsList, TabsPanel, TabsRoot } from "#/ds/tabs";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { IconArrowLeft } from "central-icons-stroke/IconArrowLeft";
import { IconArrowRotateClockwise } from "central-icons-stroke/IconArrowRotateClockwise";
import { IconCheckmark2Medium } from "central-icons-stroke/IconCheckmark2Medium";
import { IconDraft } from "central-icons-stroke/IconDraft";
import { IconExclamationCircle } from "central-icons-stroke/IconExclamationCircle";
import { IconLoadingCircle } from "central-icons-stroke/IconLoadingCircle";
import { IconMerged } from "central-icons-stroke/IconMerged";
import { IconPullRequest } from "central-icons-stroke/IconPullRequest";
import { IconRequestClosed } from "central-icons-stroke/IconRequestClosed";
import { IconSquareBehindSquare6 } from "central-icons-stroke/IconSquareBehindSquare6";
import { useSetAtom } from "jotai";
import { HTTPError } from "ky";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useSearchParam } from "react-use";
import { Shortcut } from "@/hooks/shortcuts";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useShortcut } from "@/hooks/useShortcut";
import { useTimeSpentTracker } from "@/hooks/useTimeSpentTracker";
import { analytics } from "@/lib/analytics";
import { useAuth } from "@/modules/auth";
import { useGithubUserIntegrationStatus } from "@/modules/integrations/github/hooks/useGithub";
import {
  type GhesUserOauthHost,
  getGhesUserOauthHosts,
} from "@/modules/integrations/github/lib/requests";
import { useGitIntegrations } from "@/modules/integrations/hooks/useGitIntegrations";
import { AnimatedEllipses } from "@/modules/search/components/omni/components/tools/AnimatedEllipses";
import { useSyncDerivedPRState } from "@/modules/session-store/hooks";
import {
  useAutoReviewQualification,
  usePRAutoReviewOverride,
} from "@/modules/settings/components/Review/hooks";
import { SidebarContentReviewPR } from "@/modules/sidebar-new/components/SidebarContentReview";
import {
  HeaderActions,
  HeaderBreadcrumb,
} from "@/modules/sidebar/components/Breadcrumbs";
import { CommitsList, CommitsListSkeleton } from "../components/CommitsList";
import { HideCommentBoxesContext } from "../components/DiffViewer/contexts/HideCommentBoxesContext";
import { HideWhitespaceContext } from "../components/DiffViewer/contexts/HideWhitespaceContext";
import { ViewModeContext } from "../components/DiffViewer/contexts/ViewModeContext";
import type { CommentLocation } from "../components/DiffViewer/types";
import { ExternalFileOverlay } from "../components/ExternalFileOverlay";
import { MergeStatusBar } from "../components/MergeStatusBar";
import { PRDescription } from "../components/PRDescription";
import { PRDiscussion } from "../components/PRDiscussion";
import { PRDiscussionSkeleton } from "../components/PRDiscussionSkeleton";
import { PRErrorState } from "../components/PRErrorState";
import { PRHeaderActions } from "../components/PRHeaderActions";
import { PRReviewHeaderBreadcrumb } from "../components/PRReviewHeaderBreadcrumb";
import { PRReviewTrialBanner } from "../components/PRReviewTrialBanner";
import { PRSections, PRSidebar } from "../components/PRSidebar";
import { PRSidebarSkeleton } from "../components/PRSidebar/PRSidebarSkeleton";
import {
  ciCheckGroupFlashAtom,
  sidebarFlashAtom,
} from "../components/PRSidebar/sidebarFlashAtom";
import { PRTitle } from "../components/PRTitle";
import { PrivateRepoAccessPrompt } from "../components/PrivateRepoAccessPrompt";
import { TabCountBadge } from "../components/TabCountBadge";
import {
  MobileSidebarPanel,
  MobileSidebarProvider,
} from "../components/agent/MobileChatPanel";
import { PRAgent, type PRAgentHandle } from "../components/agent/PRAgent";
import { isPublicExamplePR } from "../constants/examplePRs";
import { DiscussionScrollProvider } from "../contexts/DiscussionScrollProvider";
import { LazyFileContext } from "../contexts/LazyFileContext";
import { PRDigestScrollProvider } from "../contexts/PRDigestScrollProvider";
import { ScrollRegistryProvider } from "../contexts/ScrollRegistryProvider";
import { DiscussionScrollContext } from "../contexts/discussionScrollContext";
import {
  useOptionalPRReviewRoute,
  usePRReviewRoute,
} from "../contexts/prReviewRouteContext";
import {
  PRContext,
  type PRState,
  usePRContext,
} from "../contexts/prUrlContext";
import { useReviewPagePerformanceContext } from "../contexts/reviewPagePerformanceContext";
import { useAgentChat } from "../hooks/useAgentChat";
import { useAutoLaunchPRReview } from "../hooks/useAutoLaunchPRReview";
import { useAutoTriggerAnalysis } from "../hooks/useAutoTriggerAnalysis";
import {
  useLifeguardResultWithLivePreviews,
  usePrefetchComponentPreviewsManifest,
} from "../hooks/useComponentPreviews";
import { useDiffViewModePreference } from "../hooks/useDiffViewModePreference";
import { useHeadCommitJobState } from "../hooks/useHeadCommitJobState";
import { useLazyFileContents } from "../hooks/useLazyFileContents";
import { useLinePermalink } from "../hooks/useLinePermalink";
import { usePRBasicInfo } from "../hooks/usePRBasicInfo";
import { usePRDetail } from "../hooks/usePRDetail";
import { usePRDigestData } from "../hooks/usePRDigest";
import { usePRGitHub, usePRMergeStatus } from "../hooks/usePRGitHub";
import { usePRPrMeta } from "../hooks/usePRPrMeta";
import { usePRReviewEligibility } from "../hooks/usePRReviewEligibility";
import { usePRReviewPullRefresh } from "../hooks/usePRReviewPullRefresh";
import { useRefreshGitHubMetadata } from "../hooks/useRefreshGitHubMetadata";
import {
  useReviewPageMilestone,
  useReviewPagePaintMilestone,
} from "../hooks/useReviewPagePerformance";
import type { CICheckStatus } from "../queries/fetchPRGitHub";
import { getLazyFileContents } from "../queries/prReviewJobs";
import { useCommentActivationStore } from "../stores/commentActivationStore";
import { useFileOverlayStore } from "../stores/fileOverlayStore";
import { useGithubCommentActions } from "../stores/githubCommentStore";
import {
  getGutterSelectionMention,
  useGutterSelectionStore,
} from "../stores/gutterSelectionStore";
import { useLocalResolvedCommentsStore } from "../stores/localResolvedCommentsStore";
import { selectedDiffRef, useAskDevinPanelStore } from "../stores/mentionStore";
import { prSectionsRef } from "../stores/prSectionsRef";
import { useSetPRSidebarData } from "../stores/prSidebarSectionsStore";
import { useSidebarTab } from "../stores/sidebarTabStore";
import { parsePermalinkHash } from "../utils/permalink";
import { getActorProfileUrl } from "../utils/profileUrl";
import { PRDetailPageLayout } from "./PRDetailPageLayout";

function useLocalStorageState<T extends string>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    return (localStorage.getItem(key) as T) || defaultValue;
  });

  const setValueAndPersist = useCallback(
    (newValue: T) => {
      setValue(newValue);
      localStorage.setItem(key, newValue);
    },
    [key]
  );

  return [value, setValueAndPersist];
}

export function CopyableBranchName({
  branchName,
  href,
}: {
  branchName: string;
  href: string;
}) {
  const { t } = useTranslation("review");
  const routeCtx = useOptionalPRReviewRoute();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), 1500);
      return () => clearTimeout(timeout);
    }
  }, [copied]);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(branchName);
    setCopied(true);
    analytics.track("Review:Copy:Branch", {
      owner: routeCtx?.owner ?? "",
      repo: routeCtx?.repo ?? "",
      prNumber: Number(routeCtx?.prNumber ?? 0),
    });
  };

  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <MiddleTruncate
        as="a"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        text={branchName}
        showTooltip={false}
        className="min-w-0 rounded bg-tint-secondary px-1.5 py-0.5 font-mono text-12 hover:bg-tint-primary"
      />
      <IconButton
        variant="ghost"
        onClick={handleCopy}
        size="xs"
        title={copied ? t("detail.copied") : t("detail.copyBranchName")}
      >
        {copied ? <IconCheckmark2Medium /> : <IconSquareBehindSquare6 />}
      </IconButton>
    </span>
  );
}

function PRStats({
  t,
  owner,
  repo,
  headRepoOwner = owner,
  headRepoName = repo,
  headBranch,
  baseBranch,
  stats,
  host,
}: {
  t: (key: string, opts?: Record<string, unknown>) => string;
  owner: string;
  repo: string;
  headRepoOwner?: string;
  headRepoName?: string;
  headBranch: string | null | undefined;
  baseBranch: string | null | undefined;
  stats: { files_changed: number; additions: number; deletions: number };
  host?: string;
}) {
  const gitHost = host ?? "github.com";
  return (
    <>
      {headBranch && baseBranch && (
        <div className="flex min-w-0 items-center gap-1.5">
          <MiddleTruncate
            as="a"
            href={
              owner && repo
                ? `https://${gitHost}/${owner}/${repo}/tree/${baseBranch}`
                : "#"
            }
            target="_blank"
            rel="noopener noreferrer"
            text={baseBranch}
            showTooltip={false}
            className="min-w-0 rounded bg-tint-secondary px-1.5 py-0.5 font-mono text-12 hover:bg-tint-primary"
          />
          <span className="shrink-0">
            <IconArrowLeft size={14} />
          </span>
          <CopyableBranchName
            branchName={headBranch}
            href={
              headRepoOwner && headRepoName
                ? `https://${gitHost}/${headRepoOwner}/${headRepoName}/tree/${headBranch}`
                : "#"
            }
          />
        </div>
      )}

      <span className="text-[13px]">
        {t("detail.filesCount", { count: stats.files_changed })}
      </span>
      <div className="flex items-center gap-1 font-mono text-[13px]">
        <span className="text-text-green">+{stats.additions}</span>
        <span className="text-text-red">−{stats.deletions}</span>
      </div>
    </>
  );
}

function PRSectionsLoading() {
  const { t } = useTranslation("review");
  return (
    <div className="flex flex-col items-center justify-center gap-4 pb-64 pt-16">
      <IconLoadingCircle className="size-8 animate-spin" />
      <div className="flex flex-col gap-2 text-center">
        <p className="text-14 font-medium text-text-primary">
          {t("detail.loadingDiffs")}
        </p>
        <p className="text-12 text-text-secondary">
          {t("detail.loadingDiffsDesc")}
        </p>
      </div>
    </div>
  );
}

function PRHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex">
        <Skeleton className="h-[26px] w-20 rounded-full" />
      </div>
      <div className="flex flex-col gap-px">
        <Skeleton className="mb-1 h-4 w-40" />
        <Skeleton className="h-9 w-4/5" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="size-5 rounded-full" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-5 w-24 rounded" />
          <Skeleton className="h-3.5 w-3.5" />
          <Skeleton className="h-5 w-16 rounded" />
        </div>
        <Skeleton className="h-4 w-14" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-10" />
        </div>
      </div>
    </div>
  );
}

export function PRSectionsError({
  onRetry,
  errorMessage,
  isRetrying = false,
}: {
  onRetry?: () => void;
  errorMessage?: string | null;
  isRetrying?: boolean;
}) {
  const { t } = useTranslation("review");
  return (
    <div className="flex flex-col items-center justify-center gap-4 pb-64 pt-16">
      <IconExclamationCircle className="size-8 text-text-red" />
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-14 font-medium text-text-primary">
          {t("detail.failedToAnalyzePr")}
        </p>
        <p className="max-w-md text-12 text-text-secondary">
          {errorMessage || t("detail.somethingWentWrong")}
        </p>
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} disabled={isRetrying}>
          {isRetrying ? (
            <IconLoadingCircle className="animate-spin" />
          ) : (
            <IconArrowRotateClockwise />
          )}
          {isRetrying ? (
            <>
              {t("detail.retrying")}
              <AnimatedEllipses />
            </>
          ) : (
            t("detail.regenerate")
          )}
        </Button>
      )}
    </div>
  );
}

export function ViewModeContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { viewMode, setViewMode } = useDiffViewModePreference();
  const { isMobile } = useIsMobile();

  const [hideCommentBoxes, setHideCommentBoxes] = useLocalStorageState<
    "true" | "false"
  >("pr-digest-hide-comment-boxes", "false");

  const [hideWhitespace, setHideWhitespace] = useLocalStorageState<
    "true" | "false"
  >("pr-digest-hide-whitespace", "false");

  return (
    <ViewModeContext.Provider
      value={{ mode: viewMode, setViewMode, splitViewDisabled: isMobile }}
    >
      <HideCommentBoxesContext.Provider
        value={{
          hideCommentBoxes: hideCommentBoxes === "true",
          setHideCommentBoxes: (hide: boolean) =>
            setHideCommentBoxes(hide ? "true" : "false"),
        }}
      >
        <HideWhitespaceContext.Provider
          value={{
            hideWhitespace: hideWhitespace === "true",
            setHideWhitespace: (hide: boolean) =>
              setHideWhitespace(hide ? "true" : "false"),
          }}
        >
          {children}
        </HideWhitespaceContext.Provider>
      </HideCommentBoxesContext.Provider>
    </ViewModeContext.Provider>
  );
}

export function PRDetailPage() {
  const { t } = useTranslation("review");
  const { isAuthenticated, impersonating, enterpriseId } = useAuth();

  const refreshPRQueries = usePRReviewPullRefresh();
  const {
    owner,
    repo,
    prNumber,
    prPath,
    jobId: urlJobId,
    host,
    provider,
  } = usePRReviewRoute();

  const jobId =
    urlJobId &&
    (urlJobId.startsWith("pr-review-job-")
      ? urlJobId
      : `pr-review-job-${urlJobId}`);

  const { isMobile } = useIsMobile();
  const [_commentLocation, setCommentLocation] =
    useLocalStorageState<CommentLocation>(
      "pr-digest-comment-location",
      "floating"
    );
  const commentLocation: CommentLocation = isMobile
    ? "hybrid"
    : _commentLocation;

  const showLoader = useSearchParam("showLoader") == "true";

  // Fast basic info for initial header render (called before usePRDetail so
  // we can feed basicInfo.head into the jobs polling interval)
  const { data: basicInfo, error: basicInfoError } = usePRBasicInfo({
    owner,
    repo,
    prNumber,
    prPath,
    host,
  });

  const { data: prMeta } = usePRPrMeta({
    owner,
    repo,
    prNumber,
    prPath,
    host,
  });

  const {
    data: digestData,
    jobs,
    currentJobId,
    isLoading: isDigestLoading,
    isResultFetching,
    isErrored,
    errorMessage,
    isErrorRetryable,
    isJobsLoaded,
    isLaunchPending,
    launchJob,
    maybeLaunchJob,
    selectJob,
    resetStickyJob,
    // Version tracking
    displayedVersion,
    isJobRunning,
    isViewingLatestVersion,
    switchToLatestVersion,
    previousLifeguardResult,
    previousLifeguardJobId,
    // Commit-level freshness (shared with CommitStatusPopover)
    isOnLatestCommit,
    diffOnly,
    isDiffOnly,
  } = usePRDetail({
    owner,
    repo,
    prNumber,
    prPath,
    jobId,
    host,
    prHeadSha: basicInfo?.head,
  });

  const handlePullRefresh = useCallback(async () => {
    await refreshPRQueries();
    resetStickyJob();
  }, [refreshPRQueries, resetStickyJob]);

  const { shouldShowHeadAnalysisLoading } = useHeadCommitJobState({
    prPath,
    headSha: basicInfo?.head,
    jobs,
    isOnLatestCommit,
  });

  // Live eligibility for launching a full pr_review job. Drives ACU upsells
  // (diff-only sidebar/end upsells and the chat ACU upsell) independently of
  // the historical `diff_only_reason` on any past job, so purchases made
  // after the last job ran are reflected without re-launching.
  const { data: eligibility, isLoading: isEligibilityLoading } =
    usePRReviewEligibility(prPath, { jobId: currentJobId });

  // Full GitHub data (loads in background)
  const {
    data: githubData,
    error: githubError,
    isPending: isGitHubPending,
  } = usePRGitHub({
    owner,
    repo,
    prNumber,
    prPath,
    host,
  });

  // ── Performance milestones ──────────────────────────────────────────────
  const perfTracker = useReviewPagePerformanceContext();
  useReviewPageMilestone(perfTracker, "basic_info_loaded", !!basicInfo);
  useReviewPageMilestone(perfTracker, "diffs_loaded", !!digestData);
  useReviewPageMilestone(perfTracker, "github_data_loaded", !!githubData);

  const allThreadsLoaded = useMemo(() => {
    if (!githubData) return false;
    return githubData.reviewThreads.nodes.every(
      (t) => !t.commentCount || t.commentCount <= t.comments.nodes.length
    );
  }, [githubData]);
  useReviewPageMilestone(perfTracker, "all_lazy_loaded", allThreadsLoaded);

  const setPRSidebarData = useSetPRSidebarData();
  useEffect(() => {
    setPRSidebarData({
      sections: digestData?.sections,
      isJobRunning,
      isViewingLatestVersion,
      isErrored,
      erroredTasks: digestData?.errored_tasks,
      diffOnly,
      isDiffOnly,
    });
  }, [
    setPRSidebarData,
    digestData,
    isJobRunning,
    isViewingLatestVersion,
    isErrored,
    diffOnly,
    isDiffOnly,
  ]);
  useEffect(() => () => setPRSidebarData(null), [setPRSidebarData]);

  // Fast merge status for quick merge button rendering
  const { data: mergeStatusData } = usePRMergeStatus({
    owner,
    repo,
    prNumber,
    prPath,
    host,
  });

  // GitHub integration checks (moved up for use in error handling)
  const gitIntegrations = useGitIntegrations();

  // Query GHES OAuth hosts so we can check per-host connection status.
  const isGhesPR = !!host && host !== "github.com";
  const ghesHostsQueryEnabled = isAuthenticated && !!enterpriseId;
  const { data: ghesHosts, isLoading: isGhesHostsLoading } = useQuery({
    queryKey: ["ghes-user-oauth-hosts"],
    queryFn: getGhesUserOauthHosts,
    enabled: ghesHostsQueryEnabled,
  });
  // Only block on the GHES query when we actually need it (GHES PR + query enabled).
  const isGhesHostsPending =
    isGhesPR && ghesHostsQueryEnabled && isGhesHostsLoading;

  const canRenderPageContent =
    !showLoader && !gitIntegrations.isLoading && !isGhesHostsPending;
  const canDisplayDiff =
    canRenderPageContent && !!digestData && !shouldShowHeadAnalysisLoading;
  useReviewPagePaintMilestone(perfTracker, "diff_displayed", canDisplayDiff);
  useReviewPagePaintMilestone(
    perfTracker,
    "full_ui_saturated",
    canDisplayDiff && !!githubData && allThreadsLoaded
  );

  const matchingGhesHost: GhesUserOauthHost | undefined = isGhesPR
    ? ghesHosts?.find((h) => h.ghes_host === host)
    : undefined;

  // Determine the effective provider — prefer the backend's provider (which
  // handles self-hosted instances via DB lookup) over the URL-parsed fallback.
  const effectiveProvider = basicInfo?.provider ?? provider;

  // Determine error type from the error response
  // 404 = PR/repo not found, 403 = no access to repo, 429 = rate limited
  const errorStatusCode = useMemo(() => {
    const error = basicInfoError || githubError;
    if (error instanceof HTTPError) {
      return error.response.status;
    }
    return null;
  }, [basicInfoError, githubError]);

  // Network errors (TypeError from ky) indicate connectivity failure, not
  // an HTTP response. Distinguished so we show a retry prompt instead of
  // the private-repo access prompt.
  const isNetworkError =
    !!(basicInfoError || githubError) && errorStatusCode === null;

  // Check if user has connected the appropriate provider OAuth/account.
  // For GitHub PRs this is host-aware: github.com PRs check the github.com
  // OAuth token, GHES PRs check the per-instance GHES OAuth token.
  const hasUserConnectedProviderOAuth = useMemo(() => {
    if (!isAuthenticated || gitIntegrations.isLoading) return false;
    switch (effectiveProvider) {
      case "gitlab":
        return gitIntegrations.gitlab.isConnected;
      case "azure_devops":
        return gitIntegrations.azureDevops.isConnected;
      case "bitbucket":
        return gitIntegrations.bitbucket.isConnected;
      case "github":
      default:
        if (isGhesPR) {
          return matchingGhesHost?.is_connected ?? false;
        }
        return gitIntegrations.github.hasUserAccountConnected ?? false;
    }
  }, [
    isAuthenticated,
    gitIntegrations.isLoading,
    effectiveProvider,
    gitIntegrations.gitlab.isConnected,
    gitIntegrations.azureDevops.isConnected,
    gitIntegrations.bitbucket.isConnected,
    gitIntegrations.github.hasUserAccountConnected,
    isGhesPR,
    matchingGhesHost?.is_connected,
  ]);

  const prKey = `${owner}/${repo}/${prNumber}`;

  useDocumentTitle(githubData?.title ? `Review — ${githubData.title}` : null);

  // Track page view
  useEffect(
    function trackPageView() {
      analytics.track("Review:PRPage:View", {
        owner,
        repo,
        prNumber: parseInt(prNumber, 10),
        hasJobId: !!jobId,
      });
    },
    [owner, repo, prNumber, jobId]
  );

  // Track time spent (with activity detection)
  useTimeSpentTracker({
    onReport: (r) =>
      analytics.track("Review:PRPage:TimeSpent", {
        timespentInMilliseconds: r.durationMs,
        owner,
        repo,
        prNumber: parseInt(prNumber, 10),
      }),
  });

  const latestJobForHead = basicInfo?.head
    ? (jobs.find((j) => j.commit_sha === basicInfo.head) ?? null)
    : null;

  const { data: prOverride, isLoading: isOverrideLoading } =
    usePRAutoReviewOverride(prPath);
  const spendLimitReached =
    !!prOverride?.auto_review_spend_limit_reached &&
    prOverride.auto_review_enabled !== true;

  const { isAutoTrigger } = useAutoTriggerAnalysis({
    launchJob,
    eligibility,
    isReady:
      !!basicInfo &&
      !isEligibilityLoading &&
      isJobsLoaded &&
      !isOverrideLoading,
    latestJob: latestJobForHead,
    spendLimitReached,
  });

  useAutoLaunchPRReview({
    prKey,
    isLaunchPending: isLaunchPending || isAutoTrigger,
    impersonating,
    maybeLaunchInput: basicInfo
      ? {
          commitSha: basicInfo.head,
          baseSha: basicInfo.base,
          headRef: basicInfo.head_branch,
          baseRef: basicInfo.base_branch,
          prAuthor: basicInfo.user,
          requestedReviewers: basicInfo.requested_reviewers ?? [],
          assignees: basicInfo.assignees ?? [],
          additions: basicInfo.additions,
          deletions: basicInfo.deletions,
        }
      : undefined,
    maybeLaunchJob,
  });

  // Sync PR state with session store (must be called before early returns)
  // Use the backend's html_url (ground truth from git provider), falling back
  // to prPath-derived URL while basicInfo is still loading.
  const prUrl = basicInfo?.html_url ?? `https://${prPath}`;
  // Prefer live /info (git-provider ground truth) for merged/state so a stale
  // pr_meta cache entry (delayed/missed merge webhook) can't mislabel a
  // merged/closed PR as open; fall back to the fast pr_meta value only while
  // /info is still loading. updated_at still comes from /info (pr_meta doesn't
  // carry it).
  const syncedPRState = useSyncDerivedPRState(prUrl, mergeStatusData?.state, {
    merged: basicInfo?.merged ?? prMeta?.merged,
    merged_at: basicInfo?.merged_at,
    state: basicInfo?.state ?? prMeta?.state,
    updated_at: basicInfo?.updated_at,
  });

  // Handle errors when PR fetch failed
  // For GHES PRs, wait for the GHES hosts query so matchingGhesHost is resolved
  // before rendering the access prompt (avoids flashing a generic github.com prompt).
  if (!basicInfo && (basicInfoError || githubError) && !isGhesHostsPending) {
    // Check error status to determine appropriate error state:
    // - 404: PR or repo doesn't exist (works for both public repos and private repos with access)
    // - 403: Org doesn't have access to the repo (private repo without access)
    // - 429: GitHub API rate limit exceeded
    // - Other/null: Unknown error, show private repo prompt as fallback
    if (errorStatusCode === 404) {
      // 404 means PR/repo genuinely doesn't exist (public repo or private with access)
      return (
        <PRErrorState
          owner={owner}
          repo={repo}
          prNumber={prNumber}
          prPath={prPath}
          errorType="pr_not_found"
          isAuthenticated={isAuthenticated}
          host={host}
        />
      );
    }

    if (errorStatusCode === 429) {
      return (
        <PRErrorState
          owner={owner}
          repo={repo}
          prNumber={prNumber}
          prPath={prPath}
          errorType="generic_error"
          errorMessage="API rate limit exceeded. Please try again in a few minutes."
          isAuthenticated={isAuthenticated}
          host={host}
        />
      );
    }

    if (isNetworkError) {
      return (
        <PRErrorState
          owner={owner}
          repo={repo}
          prNumber={prNumber}
          prPath={prPath}
          errorType="generic_error"
          errorMessage="Unable to connect. Check your internet connection and try again."
          isAuthenticated={isAuthenticated}
          host={host}
        />
      );
    }

    // 403 or other errors: show private repo access prompt
    // (403 = org doesn't have access, other = unknown, both need repo access)

    // Default: show private repo access prompt (user not authenticated or org doesn't have access)
    return (
      <>
        {!isAuthenticated && (
          <HeaderActions>
            <div className="pr-4">
              <Button
                variant="secondary"
                size="sm"
                render={
                  <Link
                    to="/login"
                    search={{ next: window.location.pathname }}
                  />
                }
              >
                {t("detail.signIn")}
              </Button>
            </div>
          </HeaderActions>
        )}
        <PrivateRepoAccessPrompt
          owner={owner}
          repo={repo}
          prNumber={prNumber}
          prPath={prPath}
          isAuthenticated={isAuthenticated}
          hasUserConnectedGithubOAuth={hasUserConnectedProviderOAuth}
          host={host}
          ghesHost={matchingGhesHost}
        />
      </>
    );
  }

  // Previously, authenticated users with org access but without personal GitHub
  // OAuth were blocked here with PrivateRepoAccessPrompt (onlyPromptOauth=true).
  // Now they proceed to the PR detail view in read-only mode instead:
  // cannotInteractWithGitHub=true hides all write actions and a fixed bottom
  // bar CTA prompts them to connect GitHub.
  // Note: users without org access are still blocked by the 403 error handler
  // above, and unauthenticated users are handled by the sign-in flow.

  // Full-page skeleton only for the rare blockers that the content tree can't
  // render through. basicInfo is intentionally NOT required here: the diffs and
  // sidebar render off `digestData`, and the header self-skeletons until
  // basicInfo (or githubData) arrives.
  if (showLoader || gitIntegrations.isLoading || isGhesHostsPending) {
    return (
      <PRDigestScrollProvider>
        <HeaderBreadcrumb />
        <PRDetailPageLayout
          onPullRefresh={handlePullRefresh}
          mergeStatusBar={
            isAuthenticated ? (
              <MergeStatusBar
                data={undefined}
                owner={owner}
                repo={repo}
                prNumber={prNumber}
                prPath={prPath}
                host={host}
              />
            ) : undefined
          }
          documentContent={
            <>
              <PRHeaderSkeleton />

              {/* Render actual tabs components with loading state */}
              <TabsRoot defaultValue="description">
                <div className="border-b border-border-secondary pb-[8px]">
                  <TabsList>
                    <Tab value="description">{t("tabs.description")}</Tab>
                    <Tab value="discussion">{t("tabs.discussion")}</Tab>
                    <Tab value="commits">{t("tabs.commits")}</Tab>
                  </TabsList>
                </div>
                <TabsPanel value="description">
                  <PRDescription
                    isLoading={true}
                    body={undefined}
                    owner=""
                    repo=""
                    prNumber=""
                    prPath=""
                    canEdit={false}
                  />
                </TabsPanel>
                <TabsPanel value="discussion">
                  <PRDiscussionSkeleton />
                </TabsPanel>
                <TabsPanel value="commits">
                  <CommitsListSkeleton />
                </TabsPanel>
              </TabsRoot>
            </>
          }
          filesContent={<div></div>}
          sidepanelContent={<PRSidebarSkeleton />}
        />
      </PRDigestScrollProvider>
    );
  }

  const prState = syncedPRState as PRState;
  const isReviewActionLoading = isGitHubPending && !mergeStatusData;
  const headRepoOwnerForContext =
    githubData?.headRepoOwner ?? basicInfo?.head_repo_owner ?? owner;
  const headRepoNameForContext =
    githubData?.headRepoName ?? basicInfo?.head_repo_name ?? repo;
  const isForkPRForContext =
    headRepoOwnerForContext.toLowerCase() !== owner.toLowerCase() ||
    headRepoNameForContext.toLowerCase() !== repo.toLowerCase();
  const maintainerCanModifyForContext =
    githubData?.maintainerCanModify ?? basicInfo?.maintainer_can_modify ?? null;
  const forkCannotEdit =
    isForkPRForContext && maintainerCanModifyForContext === false;

  return (
    <PRDigestScrollProvider>
      <DiscussionScrollProvider>
        <PRContext.Provider
          value={{
            url: prUrl,
            state: prState,
            forkCannotEdit,
            diffOnly,
            isDiffOnly,
            eligibility,
            launchJob: async () => {
              const newJob = await launchJob();
              selectJob(newJob.job_id, { isLatest: true });
              return newJob;
            },
            isLaunchPending,
          }}
        >
          <ViewModeContextProvider>
            <ScrollRegistryProvider>
              {isNetworkError && (
                <div className="flex items-center gap-2 bg-tint-orange px-4 py-2 text-12 font-medium text-text-orange">
                  <IconExclamationCircle className="size-4 shrink-0" />
                  <span>Connection lost. Some data may be outdated.</span>
                </div>
              )}
              <PRDetailPageContent
                owner={owner}
                repo={repo}
                prNumber={prNumber}
                prState={prState}
                basicInfo={basicInfo}
                prMeta={prMeta}
                githubData={githubData}
                mergeStatusData={mergeStatusData}
                isGitHubLoading={isReviewActionLoading}
                digestData={digestData}
                jobs={jobs}
                currentJobId={currentJobId}
                isDigestLoading={isDigestLoading}
                isResultFetching={isResultFetching}
                isErrored={isErrored}
                errorMessage={errorMessage}
                isErrorRetryable={isErrorRetryable}
                isLaunchPending={isLaunchPending}
                launchJob={launchJob}
                selectJob={selectJob}
                resetStickyJob={resetStickyJob}
                commentLocation={commentLocation}
                setCommentLocation={setCommentLocation}
                displayedVersion={displayedVersion}
                isJobRunning={isJobRunning}
                isViewingLatestVersion={isViewingLatestVersion}
                switchToLatestVersion={switchToLatestVersion}
                previousLifeguardResult={previousLifeguardResult}
                previousLifeguardJobId={previousLifeguardJobId}
                isOnLatestCommit={isOnLatestCommit}
                isJobsLoaded={isJobsLoaded}
                isDiffOnly={isDiffOnly}
                shouldShowHeadAnalysisLoading={shouldShowHeadAnalysisLoading}
              />
            </ScrollRegistryProvider>
          </ViewModeContextProvider>
        </PRContext.Provider>
      </DiscussionScrollProvider>
    </PRDigestScrollProvider>
  );
}

interface PRDetailPageContentProps {
  owner: string;
  repo: string;
  prNumber: string;
  prState: PRState;
  basicInfo?: ReturnType<typeof usePRBasicInfo>["data"];
  prMeta?: ReturnType<typeof usePRPrMeta>["data"];
  githubData?: ReturnType<typeof usePRGitHub>["data"];
  mergeStatusData?: ReturnType<typeof usePRMergeStatus>["data"];
  isGitHubLoading?: boolean;
  digestData: ReturnType<typeof usePRDetail>["data"];
  jobs: ReturnType<typeof usePRDetail>["jobs"];
  currentJobId: ReturnType<typeof usePRDetail>["currentJobId"];
  isDigestLoading: boolean;
  isResultFetching: boolean;
  isErrored: boolean;
  errorMessage: string | null;
  isErrorRetryable: boolean;
  isLaunchPending: boolean;
  launchJob: ReturnType<typeof usePRDetail>["launchJob"];
  selectJob: ReturnType<typeof usePRDetail>["selectJob"];
  resetStickyJob: ReturnType<typeof usePRDetail>["resetStickyJob"];
  commentLocation: CommentLocation;
  setCommentLocation: (location: CommentLocation) => void;
  // Version tracking
  displayedVersion: ReturnType<typeof usePRDetail>["displayedVersion"];
  isJobRunning: ReturnType<typeof usePRDetail>["isJobRunning"];
  isViewingLatestVersion: ReturnType<
    typeof usePRDetail
  >["isViewingLatestVersion"];
  switchToLatestVersion: ReturnType<
    typeof usePRDetail
  >["switchToLatestVersion"];
  previousLifeguardResult: ReturnType<
    typeof usePRDetail
  >["previousLifeguardResult"];
  previousLifeguardJobId: string | null;
  // Commit-level freshness (shared with CommitStatusPopover)
  isOnLatestCommit: ReturnType<typeof usePRDetail>["isOnLatestCommit"];
  /** Whether the jobs query has resolved (to distinguish empty results from pending fetch) */
  isJobsLoaded?: ReturnType<typeof usePRDetail>["isJobsLoaded"];
  /** Whether the currently viewed job is a diff-only job (no AI analysis) */
  isDiffOnly?: ReturnType<typeof usePRDetail>["isDiffOnly"];
  /** Whether to show loading spinner instead of stale diff while latest HEAD analysis is pending. */
  shouldShowHeadAnalysisLoading: boolean;
}

const badgeVariantMap: Record<string, BadgeVariant> = {
  MERGED: "purple",
  CLOSED: "destructive",
  OPEN: "success",
  DRAFT: "default",
  LOADING: "default",
};

function PRDetailPageContent({
  owner,
  repo,
  prNumber,
  prState,
  basicInfo,
  prMeta,
  githubData,
  mergeStatusData,
  isGitHubLoading,
  digestData,
  jobs,
  currentJobId,
  isDigestLoading,
  isResultFetching,
  isErrored,
  errorMessage,
  isErrorRetryable,
  isLaunchPending,
  launchJob,
  selectJob,
  resetStickyJob,
  commentLocation,
  setCommentLocation,
  displayedVersion,
  isJobRunning,
  isViewingLatestVersion,
  switchToLatestVersion,
  previousLifeguardResult,
  previousLifeguardJobId,
  isOnLatestCommit,
  isJobsLoaded,
  isDiffOnly = false,
  shouldShowHeadAnalysisLoading,
}: PRDetailPageContentProps) {
  const { t } = useTranslation("review");
  const { isAuthenticated } = useAuth();
  const { prPath, host, provider } = usePRReviewRoute();
  const refreshPRQueries = usePRReviewPullRefresh();
  const refreshGitHubMetadata = useRefreshGitHubMetadata();
  const handlePullRefresh = useCallback(async () => {
    await refreshPRQueries();
    resetStickyJob();
  }, [refreshPRQueries, resetStickyJob]);
  const handleSwitchToLatestVersion = useCallback(() => {
    switchToLatestVersion();
    void refreshGitHubMetadata();
  }, [switchToLatestVersion, refreshGitHubMetadata]);
  const handleSelectJob = useCallback(
    (jobId: string, options?: { isLatest?: boolean }) => {
      selectJob(jobId, options);
      void refreshGitHubMetadata();
    },
    [selectJob, refreshGitHubMetadata]
  );
  const setSidebarFlash = useSetAtom(sidebarFlashAtom);
  const setCheckGroupFlash = useSetAtom(ciCheckGroupFlashAtom);
  const gitHost = host ?? "github.com";
  const effectiveProvider = basicInfo?.provider ?? provider;
  const { forkCannotEdit, eligibility } = usePRContext();
  const { data: githubUserStatus } = useGithubUserIntegrationStatus();
  const currentGithubUsername = githubUserStatus?.github_username ?? undefined;
  const addMention = useAskDevinPanelStore((state) => state.addMention);
  const clearMentions = useAskDevinPanelStore((state) => state.clearMentions);
  const triggerFocus = useAskDevinPanelStore((state) => state.triggerFocus);
  const [, setSidebarTab] = useSidebarTab();
  const flashSidebarSection = useCallback(
    (target: "checks" | "reviewers", checkStatus?: CICheckStatus) => {
      // The sidebar sections live under the Info tab; if the user has Chat or
      // Analysis open, the flash would be invisible without this switch.
      setSidebarTab("info");
      const nonce = Date.now();
      setSidebarFlash({
        target: target === "checks" ? "ci-checks" : "reviewers",
        nonce,
      });
      if (target === "checks" && checkStatus) {
        setCheckGroupFlash({ status: checkStatus, nonce, prPath });
      }
    },
    [setSidebarFlash, setSidebarTab, setCheckGroupFlash, prPath]
  );
  const initializeAIChatDraft = useAskDevinPanelStore(
    (state) => state.initializeDraft
  );
  const fileOverlay = useFileOverlayStore();
  const {
    setCannotInteractWithGitHub,
    setCanInstallGithubApp,
    setInteractionBlockReason,
    initializeNewCommentLines,
  } = useGithubCommentActions();
  const setCurrentPR = useLocalResolvedCommentsStore(
    (state) => state.setCurrentPR
  );
  const prAgentRef = useRef<PRAgentHandle>(null);
  const permalinkHandledRef = useRef(false);
  const [activeTab, setActiveTab] = useState("description");

  useEffect(() => {
    permalinkHandledRef.current = false;
  }, [owner, repo, prNumber]);

  // Set current PR context for scoping resolved comment IDs
  useEffect(() => {
    setCurrentPR(prPath);
  }, [prPath, setCurrentPR]);

  // Initialize newCommentLines from localStorage for this PR
  useEffect(() => {
    initializeNewCommentLines(prPath);
  }, [prPath, initializeNewCommentLines]);

  useEffect(() => {
    initializeAIChatDraft(prPath);
  }, [prPath, initializeAIChatDraft]);

  const cannotInteractWithGitHub =
    githubData?.cannotInteractWithGitHub ??
    mergeStatusData?.cannotInteractWithGitHub ??
    true;
  const canInstallGithubApp = githubData?.canInstallGithubApp ?? true;
  const interactionBlockReason =
    githubData?.interactionBlockReason ??
    mergeStatusData?.interactionBlockReason ??
    null;
  const viewerPendingReviewId = githubData
    ? (githubData.viewerPendingReviewId ?? null)
    : (mergeStatusData?.viewerPendingReviewId ?? null);

  // Sync interaction flags to store when githubData changes
  useEffect(() => {
    setCannotInteractWithGitHub(cannotInteractWithGitHub);
    setCanInstallGithubApp(canInstallGithubApp);
    setInteractionBlockReason(interactionBlockReason);
  }, [
    cannotInteractWithGitHub,
    canInstallGithubApp,
    interactionBlockReason,
    setCannotInteractWithGitHub,
    setCanInstallGithubApp,
    setInteractionBlockReason,
  ]);

  const discussionScrollContext = useContext(DiscussionScrollContext);
  const activateComment = useCommentActivationStore(
    (state) => state.activateComment
  );
  const deactivateAllComments = useCommentActivationStore(
    (state) => state.deactivateAll
  );

  // Cmd+I: Open Chat sidebar tab and add selected code as mention
  useShortcut(Shortcut.ReviewAddMention, (e) => {
    e.preventDefault();
    const selection = selectedDiffRef.current ?? getGutterSelectionMention();
    deactivateAllComments();
    if (selection) {
      addMention(selection);
      selectedDiffRef.current = null;
      useGutterSelectionStore.getState().clearSelection();
    }
    setSidebarTab("chat");
    triggerFocus();
  });

  // Cmd+Shift+I: Clear chat/mentions, add new mention, open Chat tab
  useShortcut(Shortcut.ReviewNewChatMention, (e) => {
    e.preventDefault();
    const selection = selectedDiffRef.current ?? getGutterSelectionMention();
    deactivateAllComments();
    prAgentRef.current?.startNewChat();
    clearMentions();
    if (selection) {
      addMention(selection);
      selectedDiffRef.current = null;
      useGutterSelectionStore.getState().clearSelection();
    }
    setSidebarTab("chat");
    triggerFocus();
  });

  const canEdit =
    isAuthenticated && !cannotInteractWithGitHub && !forkCannotEdit;
  const agentChat = useAgentChat({
    owner,
    repo,
    prNumber,
    prPath,
    prData: digestData ?? undefined,
    canEdit,
    jobId: currentJobId ?? undefined,
  });

  const isGitHubLoaded = !!githubData;
  // Header needs stable metadata (pr_meta/githubData) or basicInfo; until then
  // it self-skeletons so the diffs/sidebar can render off digestData without
  // waiting.
  const hasHeaderData = !!prMeta?.title || !!basicInfo || !!githubData;
  const title = githubData?.title ?? basicInfo?.title ?? prMeta?.title;
  const isDraft =
    githubData?.isDraft ?? basicInfo?.draft ?? prMeta?.draft ?? false;

  const authorLogin = githubData?.author?.login ?? basicInfo?.user ?? "unknown";
  const authorAvatarUrl = githubData?.author?.avatarUrl;
  const authorIsBot = githubData?.author?.isBot ?? false;
  const headBranch = githubData?.headRefName ?? basicInfo?.head_branch;
  const baseBranch = githubData?.baseRefName ?? basicInfo?.base_branch;
  const headRepoOwner =
    githubData?.headRepoOwner ?? basicInfo?.head_repo_owner ?? owner;
  const headRepoName =
    githubData?.headRepoName ?? basicInfo?.head_repo_name ?? repo;

  const stats = {
    files_changed: githubData?.changedFiles ?? basicInfo?.changed_files ?? 0,
    additions: githubData?.additions ?? basicInfo?.additions ?? 0,
    deletions: githubData?.deletions ?? basicInfo?.deletions ?? 0,
  };

  const githubUrl = basicInfo?.html_url ?? `https://${prPath}`;

  const isPublicExample = isPublicExamplePR(
    owner,
    repo,
    parseInt(prNumber, 10)
  );

  // Second call shares the same React Query cache entry as the one above (line ~490).
  // Needed here because tsgo cannot resolve the variable across early-return boundaries.
  const { data: autoReviewQualification } = useAutoReviewQualification(prPath);

  const hasVersions = !!displayedVersion;
  const retryHandler = async () => {
    await launchJob();
    resetStickyJob();
  };

  const lazyVersionId = displayedVersion?.id;
  const lazyFetchFn = useCallback(
    (paths: string[]) =>
      getLazyFileContents(prPath, currentJobId!, lazyVersionId!, paths),
    [prPath, currentJobId, lazyVersionId]
  );
  const { fileContentsAtBase, requestFiles } = useLazyFileContents({
    fileContentsAtBase: digestData?.file_contents_at_base,
    cacheKey:
      currentJobId && lazyVersionId ? `${currentJobId}:${lazyVersionId}` : null,
    fetchFn: currentJobId && lazyVersionId ? lazyFetchFn : undefined,
  });

  const baseLifeguardResult =
    digestData?.lifeguard_result ?? previousLifeguardResult ?? undefined;
  // The manifest merges into the displayed result, so its jobId must match that
  // result's job. Prefetch the current job's manifest off the jobs-list version
  // metadata (which lands before the heavy digest result) so it's cache-warm the
  // moment the digest arrives and componentPreviewsJobId flips to currentJobId.
  const componentPreviewsJobId =
    (digestData?.lifeguard_result ? currentJobId : previousLifeguardJobId) ??
    undefined;
  usePrefetchComponentPreviewsManifest({
    prPath,
    jobId: currentJobId,
    enabled:
      displayedVersion?.metadata?.completed?.includes("lifeguard") ?? false,
  });
  const lifeguardResult = useLifeguardResultWithLivePreviews({
    lifeguardResult: baseLifeguardResult,
    prPath,
    jobId: componentPreviewsJobId,
    isJobRunning,
  });
  const isLifeguardOutdated =
    isJobRunning ||
    (!digestData?.lifeguard_result && !!previousLifeguardResult);
  const {
    items,
    scrollToSection,
    scrollToFile,
    commentsByFile,
    allChangesInFileMap,
    commentRenderers,
    overview,
    fileContentsAtHead,
  } = usePRDigestData({
    owner,
    repo,
    prNumber,
    prPath,
    sections: digestData?.sections ?? [],
    fileContentsAtBase,
    lifeguardResult,
    mergeBaseSha: digestData?.pr_metadata.merge_base_sha,
    commentLocation,
    host,
  });

  const linePermalinkFilePaths = useMemo(
    () =>
      Array.from(
        new Set(
          items.flatMap((section) =>
            section.changes.map((change) => change.file_path)
          )
        )
      ),
    [items]
  );

  useLinePermalink({
    ready: items.length > 0,
    filePaths: linePermalinkFilePaths,
  });

  const showAnalysisProgress = isJobRunning || !isViewingLatestVersion;

  useEffect(
    function scrollToPermalink() {
      if (permalinkHandledRef.current) return;
      const parsed = parsePermalinkHash(window.location.hash);
      if (!parsed) return;
      const { type, id } = parsed;

      switch (type) {
        case "review":
        case "comment":
        case "thread":
          if (
            discussionScrollContext?.scrollToDiscussionElement(
              `discussion-${type}-${id}`
            )
          ) {
            permalinkHandledRef.current = true;
          }
          break;
        case "bug": {
          const bug = digestData?.lifeguard_result?.bugs.find(
            (b) => b.id === id
          );
          if (bug && prSectionsRef.current) {
            prSectionsRef.current.navigateToBug(bug);
            activateComment(`bug-${id}`);
            permalinkHandledRef.current = true;
          }
          break;
        }
        case "analysis": {
          const analysis = digestData?.lifeguard_result?.analyses?.find(
            (a) => a.id === id
          );
          if (analysis && prSectionsRef.current) {
            prSectionsRef.current.navigateToAnalysis(analysis);
            activateComment(`analysis-${id}`);
            permalinkHandledRef.current = true;
          }
          break;
        }
        case "security": {
          const finding = digestData?.lifeguard_result?.security_findings?.find(
            (s) => s.id === id
          );
          if (finding && prSectionsRef.current) {
            prSectionsRef.current.navigateToSecurity(finding);
            activateComment(`security-${id}`);
            permalinkHandledRef.current = true;
          }
          break;
        }
      }
    },
    [discussionScrollContext, digestData, activateComment, isGitHubLoaded]
  );

  const colorKey = !hasHeaderData
    ? "LOADING"
    : isDraft && prState === "OPEN"
      ? "DRAFT"
      : prState;
  const badgeLabel =
    prState === "MERGED"
      ? t("detail.merged")
      : prState === "CLOSED"
        ? t("detail.closed")
        : isDraft
          ? t("detail.draft")
          : t("detail.open");

  const sidepanelContent = (
    <PRSidebar
      owner={owner}
      repo={repo}
      prNumber={prNumber}
      prPath={prPath}
      isGitHubLoaded={isGitHubLoaded}
      githubData={githubData}
      items={items}
      overview={overview}
      scrollToSection={scrollToSection}
      scrollToFile={scrollToFile}
      lifeguardResult={lifeguardResult}
      commentsByFile={commentsByFile}
      allChangesInFileMap={allChangesInFileMap}
      isJobRunning={isJobRunning}
      isErrored={isErrored}
      errorMessage={errorMessage}
      showAnalysisProgress={showAnalysisProgress}
      isLifeguardOutdated={isLifeguardOutdated}
      onLaunchJob={isErrorRetryable ? retryHandler : undefined}
      _currentUsername={currentGithubUsername}
      jobId={currentJobId ?? undefined}
      cannotInteractWithGitHub={cannotInteractWithGitHub}
      onViewResults={handleSwitchToLatestVersion}
      erroredTasks={digestData?.errored_tasks}
      chat={agentChat}
      devinId={basicInfo?.devin_id ?? null}
    />
  );

  return (
    <>
      <PRReviewHeaderBreadcrumb>
        <BreadcrumbItem className="min-w-0 flex-1 justify-start truncate">
          <BreadcrumbExternalLink
            href={githubUrl}
            className="min-w-0 flex-1 justify-start"
          >
            <Badge
              className="w-fit bg-transparent p-0 text-13 font-normal"
              variant={badgeVariantMap[colorKey]}
            >
              {colorKey === "DRAFT" ? (
                <IconDraft className="h-4 min-h-4 w-4 min-w-4" />
              ) : colorKey === "CLOSED" ? (
                <IconRequestClosed className="h-4 min-h-4 w-4 min-w-4" />
              ) : colorKey === "MERGED" ? (
                <IconMerged className="h-4 min-h-4 w-4 min-w-4" />
              ) : (
                <IconPullRequest className="h-4 min-h-4 w-4 min-w-4" />
              )}
              <span className="text-13">
                {prNumber ? `#${prNumber}` : badgeLabel}
              </span>
            </Badge>
            <span className="truncate text-13">{title}</span>
            <span className="shrink-0 text-13 font-normal text-text-secondary">
              {repo}
            </span>
          </BreadcrumbExternalLink>
        </BreadcrumbItem>
      </PRReviewHeaderBreadcrumb>

      <HeaderActions>
        <PRHeaderActions
          prAuthorLogin={authorLogin}
          prState={prState}
          jobs={jobs}
          currentJobId={currentJobId}
          isJobsLoading={isDigestLoading && jobs.length === 0}
          isJobsLoaded={isJobsLoaded}
          isViewingLatestVersion={isViewingLatestVersion}
          onLaunchJob={launchJob}
          onSelectJob={handleSelectJob}
          onSwitchToLatestVersion={handleSwitchToLatestVersion}
          commits={githubData?.commits ?? []}
          prHeadSha={basicInfo?.head ?? null}
          prHeadCommit={basicInfo?.head_commit ?? null}
          prData={digestData ?? undefined}
          currentJob={jobs.find((j) => j.job_id === currentJobId) ?? null}
          viewerPendingReviewId={viewerPendingReviewId}
          cannotInteractWithGitHub={cannotInteractWithGitHub}
          isAuthenticated={isAuthenticated}
          isGitHubLoading={isGitHubLoading}
          prPath={prPath}
          currentGithubUsername={currentGithubUsername}
          isPublicExample={isPublicExample}
          isDiffOnly={isDiffOnly}
          autoReviewQualified={autoReviewQualification?.trigger_mode === "auto"}
          isPRReviewEligible={eligibility?.eligible}
          prUpdatedAt={basicInfo?.updated_at}
          isOnLatestCommit={isOnLatestCommit}
          devinId={basicInfo?.devin_id ?? null}
          headBranch={headBranch}
        />
      </HeaderActions>

      <MobileSidebarProvider>
        <TooltipProvider>
          <PRDetailPageLayout
            onPullRefresh={handlePullRefresh}
            stickyMergeBar={
              (basicInfo?.state ?? prMeta?.state ?? "open") === "open"
            }
            mergeStatusBar={
              isAuthenticated && (
                <>
                  <PRReviewTrialBanner />
                  <MergeStatusBar
                    data={mergeStatusData}
                    owner={owner}
                    repo={repo}
                    prNumber={prNumber}
                    prPath={prPath}
                    host={host}
                    cannotInteractWithGitHub={cannotInteractWithGitHub}
                    requestedReviewers={githubData?.requestedReviewers}
                    reviewAuthors={githubData?.reviewAuthors}
                    onPillClick={flashSidebarSection}
                  />
                </>
              )
            }
            documentContent={
              <>
                {hasHeaderData ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex">
                      <Badge
                        variant={badgeVariantMap[colorKey]}
                        size="lg"
                        rounded
                      >
                        {colorKey === "DRAFT" ? (
                          <IconDraft />
                        ) : colorKey === "CLOSED" ? (
                          <IconRequestClosed />
                        ) : colorKey === "MERGED" ? (
                          <IconMerged />
                        ) : (
                          <IconPullRequest />
                        )}
                        {badgeLabel}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-px">
                      <a
                        href={githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-14 text-text-secondary hover:text-text-primary hover:underline"
                      >
                        {owner}/{repo} #{prNumber}
                      </a>
                      <PRTitle
                        title={title ?? ""}
                        owner={owner}
                        repo={repo}
                        prNumber={prNumber}
                        prPath={prPath}
                        canEdit={isAuthenticated && !cannotInteractWithGitHub}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-14 text-text-secondary">
                      {authorLogin && (
                        <a
                          href={getActorProfileUrl({
                            host: gitHost,
                            login: authorLogin,
                            isBot: authorIsBot,
                            provider: effectiveProvider,
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 hover:underline"
                        >
                          <AvatarRoot className="size-5">
                            {authorAvatarUrl && (
                              <AvatarImage
                                src={authorAvatarUrl}
                                alt={authorLogin}
                              />
                            )}
                            <AvatarFallback className="text-12">
                              {authorLogin.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </AvatarRoot>
                          <span className="text-[13px] font-medium">
                            {authorLogin}
                          </span>
                        </a>
                      )}

                      <PRStats
                        t={t}
                        headRepoOwner={headRepoOwner}
                        headRepoName={headRepoName}
                        owner={owner}
                        repo={repo}
                        headBranch={headBranch}
                        baseBranch={baseBranch}
                        stats={stats}
                        host={host}
                      />
                    </div>
                  </div>
                ) : (
                  <PRHeaderSkeleton />
                )}

                <TabsRoot value={activeTab} onValueChange={setActiveTab}>
                  <div className="border-b border-border-secondary pb-[8px]">
                    <TabsList>
                      <Tab value="description">{t("tabs.description")}</Tab>
                      <Tab value="discussion">
                        {t("tabs.discussion")}
                        <TabCountBadge
                          isLoading={!isGitHubLoaded}
                          count={
                            (githubData?.comments?.nodes?.length ?? 0) +
                            (githubData?.reviews?.nodes?.length ?? 0) +
                            (githubData?.reviewThreads?.nodes?.length ?? 0)
                          }
                        />
                      </Tab>
                      <Tab value="commits">
                        {t("tabs.commits")}
                        <TabCountBadge
                          isLoading={!isGitHubLoaded}
                          count={githubData?.commits?.length ?? 0}
                        />
                      </Tab>
                    </TabsList>
                  </div>
                  <TabsPanel value="description">
                    <PRDescription
                      isLoading={!hasHeaderData}
                      body={githubData?.body ?? basicInfo?.body ?? prMeta?.body}
                      owner={owner}
                      repo={repo}
                      prNumber={prNumber}
                      prPath={prPath}
                      canEdit={isAuthenticated && !cannotInteractWithGitHub}
                      overview={overview?.text}
                      isOverviewErrored={
                        isErrored ||
                        digestData?.errored_tasks?.includes("groups")
                      }
                      hasNoJobs={
                        isJobsLoaded && jobs.length === 0 && !isLaunchPending
                      }
                    />
                  </TabsPanel>
                  <TabsPanel value="discussion" keepMounted>
                    {!isGitHubLoaded ? (
                      <PRDiscussionSkeleton />
                    ) : (
                      <PRDiscussion
                        comments={githubData?.comments?.nodes ?? []}
                        reviews={githubData?.reviews?.nodes ?? []}
                        cannotInteractWithGitHub={cannotInteractWithGitHub}
                        onSwitchToTab={() => setActiveTab("discussion")}
                      />
                    )}
                  </TabsPanel>
                  <TabsPanel value="commits">
                    {isDigestLoading && jobs.length === 0 ? (
                      <CommitsListSkeleton />
                    ) : githubData?.commits ? (
                      <CommitsList
                        commits={githubData.commits}
                        prPath={prPath}
                        jobs={jobs}
                        currentJobId={currentJobId}
                        launchJob={async (shouldSelectJob) => {
                          const newJob = await launchJob();
                          if (shouldSelectJob) {
                            handleSelectJob(newJob.job_id, {
                              isLatest: true,
                            });
                          }
                          return newJob;
                        }}
                        selectJob={handleSelectJob}
                        isPublicExample={isPublicExample}
                      />
                    ) : (
                      <CommitsListSkeleton />
                    )}
                  </TabsPanel>
                </TabsRoot>
              </>
            }
            filesContent={((): React.ReactNode => {
              if (shouldShowHeadAnalysisLoading) {
                return <PRSectionsLoading />;
              }

              // Case 1: Errored with no versions - show error
              if (isErrored && !digestData && !hasVersions) {
                return (
                  <PRSectionsError
                    onRetry={isErrorRetryable ? retryHandler : undefined}
                    isRetrying={isLaunchPending}
                    errorMessage={errorMessage}
                  />
                );
              }

              // Case 2: Initial load, no versions yet - show loading
              if (!hasVersions && isDigestLoading) {
                return <PRSectionsLoading />;
              }

              // Case 3: Has versions, job running or fetching - show loading
              if (!digestData && (isJobRunning || isResultFetching)) {
                return <PRSectionsLoading />;
              }

              // Case 4: Errored with versions but fetch failed - show error
              if (isErrored && !digestData) {
                return (
                  <PRSectionsError
                    onRetry={isErrorRetryable ? retryHandler : undefined}
                    isRetrying={isLaunchPending}
                    errorMessage={errorMessage}
                  />
                );
              }

              // Case 5: No data and not running - show nothing
              if (!digestData) {
                return null;
              }

              // Case 6: Has data - show content (progress card shows error if errored)
              return (
                <LazyFileContext.Provider value={requestFiles}>
                  <PRSections
                    sections={digestData.sections}
                    fileContentsAtBase={fileContentsAtBase}
                    fileContentsAtHead={fileContentsAtHead}
                    prPath={prPath}
                    jobId={currentJobId}
                    lifeguardResult={digestData.lifeguard_result ?? undefined}
                    items={items}
                    overview={overview}
                    commentsByFile={commentsByFile}
                    allChangesInFileMap={allChangesInFileMap}
                    commentLocation={commentLocation}
                    onCommentLocationChange={setCommentLocation}
                    commentRenderers={commentRenderers}
                    owner={owner}
                    repo={repo}
                    prNumber={prNumber}
                    pullRequestId={githubData?.id}
                    mergeBaseSha={digestData.pr_metadata.merge_base_sha}
                    headSha={digestData.pr_metadata.head_sha}
                    onChatWithSelection={() => {
                      setSidebarTab("chat");
                      triggerFocus();
                    }}
                    onLaunchJob={retryHandler}
                  />
                </LazyFileContext.Provider>
              );
            })()}
            externalFileDisplay={
              fileOverlay.file && (
                <ExternalFileOverlay
                  onClose={fileOverlay.closeFile}
                  file={fileOverlay.file}
                  isLoading={fileOverlay.isLoading}
                  error={fileOverlay.error}
                  comments={fileOverlay.comments}
                  commentRenderers={commentRenderers}
                />
              )
            }
            sidepanelContent={sidepanelContent}
            innerSidebarContent={<SidebarContentReviewPR />}
          />
          <PRAgent
            ref={prAgentRef}
            chat={agentChat}
            isJobRunning={isJobRunning}
            onRedirectToSidebar={() => {
              setSidebarTab("chat");
              triggerFocus();
            }}
            prAuthorLogin={authorLogin}
            prState={prState}
            viewerPendingReviewId={viewerPendingReviewId}
            cannotInteractWithGitHub={cannotInteractWithGitHub}
            isAuthenticated={isAuthenticated}
            isGitHubLoading={isGitHubLoading}
          />
          <MobileSidebarPanel sidepanelContent={sidepanelContent} />
        </TooltipProvider>
      </MobileSidebarProvider>
    </>
  );
}
