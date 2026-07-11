import { TooltipProvider } from "#/ds-deps/tooltip";
import { PullRequestData } from "@cognitionai/js-common/events";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { IconLoadingCircle } from "central-icons-stroke/IconLoadingCircle";
import { useAtomValue } from "jotai";
import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useAuth } from "@/modules/auth";
import { useSyncDerivedPRState } from "@/modules/session-store/hooks";
import { cn } from "@/utils/cn";
import { useSecurityReviewEnabled } from "@/utils/flags";
import { CanShowAskDevinContext } from "../contexts/CanShowAskDevinContext";
import { DiscussionScrollProvider } from "../contexts/DiscussionScrollProvider";
import { LazyFileContext } from "../contexts/LazyFileContext";
import { PRDigestScrollProvider } from "../contexts/PRDigestScrollProvider";
import { ScrollRegistryProvider } from "../contexts/ScrollRegistryProvider";
import {
  PRReviewRouteContext,
  usePRReviewRoute,
} from "../contexts/prReviewRouteContext";
import { prReviewScrollToTopAtom } from "../contexts/prReviewScrollAtom";
import { PRContext, type PRState } from "../contexts/prUrlContext";
import { useAutoLaunchPRReview } from "../hooks/useAutoLaunchPRReview";
import {
  useLifeguardResultWithLivePreviews,
  usePrefetchComponentPreviewsManifest,
} from "../hooks/useComponentPreviews";
import { useGutterSelection } from "../hooks/useGutterSelection";
import { useHeadCommitJobState } from "../hooks/useHeadCommitJobState";
import { useLazyFileContents } from "../hooks/useLazyFileContents";
import { usePRBasicInfo } from "../hooks/usePRBasicInfo";
import { usePRDetail } from "../hooks/usePRDetail";
import { usePRDigestData } from "../hooks/usePRDigest";
import { usePRDigestScroll } from "../hooks/usePRDigestScroll";
import { usePRGitHub, usePRMergeStatus } from "../hooks/usePRGitHub";
import { usePRGithubInteractivity } from "../hooks/usePRGithubInteractivity";
import { usePRPrMeta } from "../hooks/usePRPrMeta";
import { usePRReviewEligibility } from "../hooks/usePRReviewEligibility";
import { useRefreshGitHubMetadata } from "../hooks/useRefreshGitHubMetadata";
import { useTabScrollPreservation } from "../hooks/useTabScrollPreservation";
import { useViewedFilesSync } from "../hooks/useViewedFilesSync";
import {
  type LifeguardProgress,
  getLazyFileContents,
  getLifeguardProgress,
} from "../queries/prReviewJobs";
import { useFileOverlayStore } from "../stores/fileOverlayStore";
import { useGithubCommentActions } from "../stores/githubCommentStore";
import { useLocalResolvedCommentsStore } from "../stores/localResolvedCommentsStore";
import { prReviewLaunchSignalAtomFamily } from "../stores/prReviewLaunchSignal";
import { useUnresolvedFindingsCounts } from "../stores/resolvedCommentsStore";
import { htmlUrlToPrPath, parsePrPath } from "../utils/prPath";
import { DiffTabContent } from "./DiffTabContent";
import type { DiffViewMode } from "./DiffViewer/components/FileDiff";
import { HideCommentBoxesContext } from "./DiffViewer/contexts/HideCommentBoxesContext";
import { ViewModeContext } from "./DiffViewer/contexts/ViewModeContext";
import type { CommentLocation } from "./DiffViewer/types";
import { EmbeddedBugsPanel } from "./EmbeddedBugsPanel";
import { EmbeddedPRHeader } from "./EmbeddedPRHeader";
import { EmbeddedPRReviewSkeleton } from "./EmbeddedPRReviewSkeleton";
import { EmbeddedReviewTabs } from "./EmbeddedReviewTabs";
import { ExternalFileOverlay } from "./ExternalFileOverlay";
import { MergeStatusBar } from "./MergeStatusBar";
import { PRReviewTrialBanner } from "./PRReviewTrialBanner";

const MIN_SPLIT_VIEW_WIDTH = 600;
const MAX_ACTIVE_TAB_CACHE_ENTRIES = 100;
const ActiveTabCacheSchema = z.array(z.tuple([z.string(), z.string()]));
type ActiveTabCache = z.infer<typeof ActiveTabCacheSchema>;

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

interface EmbeddedPRReviewProps {
  prData: PullRequestData;
  inDevinSession?: boolean;
  isWindsurfEmbedded?: boolean;
  className?: string;
}

export function EmbeddedPRReview({
  prData,
  isWindsurfEmbedded,
  className,
}: EmbeddedPRReviewProps) {
  const { t } = useTranslation("review");
  const {
    impersonating,
    orgId,
    isAuthenticated: rawIsAuthenticated,
  } = useAuth();
  const isAuthenticated = rawIsAuthenticated || !!isWindsurfEmbedded;
  const queryClient = useQueryClient();
  const owner = prData.owner;
  const repo = prData.repo;
  const prNumber = String(prData.pull_number);
  const host = new URL(prData.html_url).hostname;
  const prPath = htmlUrlToPrPath(prData.html_url);
  const { provider } = parsePrPath(prPath);

  // View mode state — separate key from the full PRDetailPage because the
  // embedded panel is much narrower and users typically want different defaults.
  const [_viewMode, _setViewMode] = useLocalStorageState<DiffViewMode>(
    "pr-review-embedded-diff-view-mode",
    "unified"
  );
  const deferredViewMode = useDeferredValue(_viewMode);
  const setViewMode = useCallback(
    (mode: DiffViewMode) => {
      startTransition(() => _setViewMode(mode));
    },
    [_setViewMode]
  );

  // Force unified mode when the container is too narrow for split view
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const [isTooNarrow, setIsTooNarrow] = useState(false);
  // Seed synchronously before paint so the first frame uses the right view
  // mode; a post-paint ResizeObserver alone flashes split, then unified.
  useLayoutEffect(() => {
    if (!containerEl) return;
    setIsTooNarrow(
      containerEl.getBoundingClientRect().width < MIN_SPLIT_VIEW_WIDTH
    );
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsTooNarrow(entry.contentRect.width < MIN_SPLIT_VIEW_WIDTH);
      }
    });
    observer.observe(containerEl);
    return () => observer.disconnect();
  }, [containerEl]);

  const viewMode = isTooNarrow ? "unified" : deferredViewMode;
  const viewModeCtx = useMemo(
    () => ({ mode: viewMode, setViewMode, splitViewDisabled: isTooNarrow }),
    [viewMode, setViewMode, isTooNarrow]
  );

  // Clear the review-jobs cache when this component unmounts (e.g. user
  // switches sessions). Without this, remounting serves stale cached jobs
  // data which locks the sticky job selection to an outdated job before the
  // background refetch can return fresh data — causing stale diffs.
  useEffect(() => {
    return () => {
      queryClient.removeQueries({
        queryKey: ["pr-review-jobs", orgId, prPath],
      });
    };
  }, [queryClient, orgId, prPath]);

  const {
    data: basicInfo,
    isLoading: isBasicInfoLoading,
    error: basicInfoError,
  } = usePRBasicInfo(
    { owner, repo, prNumber, prPath, host },
    // The session events stream (which invalidates on git_push) is only
    // mounted in the webapp session view, not in the Windsurf webview.
    { hasLiveEventUpdates: !isWindsurfEmbedded }
  );

  const { data: prMeta } = usePRPrMeta(
    { owner, repo, prNumber, prPath, host },
    { hasLiveEventUpdates: !isWindsurfEmbedded }
  );

  const {
    data: digestData,
    jobs,
    currentJobId,
    isLoading: isDigestLoading,
    isErrored,
    errorMessage,
    isErrorRetryable,
    isJobsLoaded,
    isLaunchPending,
    launchJob,
    maybeLaunchJob,
    isJobRunning,
    displayedVersion,
    completedSubtasks,
    previousLifeguardResult,
    previousLifeguardJobId,
    newerJobAvailable,
    switchToNewerJob,
    hasNewerVersion,
    switchToLatestVersion,
    isOnLatestCommit,
    diffOnly,
    isDiffOnly,
    resetStickyJob,
  } = usePRDetail({
    owner,
    repo,
    prNumber,
    prPath,
    host,
    prHeadSha: basicInfo?.head,
  });

  // Live eligibility for launching a full pr_review job; only fetched when the
  // current job is diff-only so the upsell can reflect the user's current
  // billing state (mirrors PRDetailPage).
  const { data: eligibility } = usePRReviewEligibility(prPath, {
    enabled: isDiffOnly === true,
    jobId: currentJobId,
  });

  const launchSignal = useAtomValue(prReviewLaunchSignalAtomFamily(prPath));
  const prevLaunchSignalRef = useRef(launchSignal);
  useEffect(() => {
    if (launchSignal !== prevLaunchSignalRef.current) {
      prevLaunchSignalRef.current = launchSignal;
      resetStickyJob();
    }
  }, [launchSignal, resetStickyJob]);

  const { data: githubData, error: githubError } = usePRGitHub({
    owner,
    repo,
    prNumber,
    prPath,
    host,
  });

  // Fast merge status polling (10s when unsettled) so the merge bar
  // doesn't stay stuck on "Checking merge status..." for 5 minutes.
  const { data: mergeStatusData } = usePRMergeStatus({
    owner,
    repo,
    prNumber,
    prPath,
    host,
  });

  const prKey = `${owner}/${repo}/${prNumber}`;

  useAutoLaunchPRReview({
    prKey,
    isLaunchPending,
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

  const { shouldShowHeadAnalysisLoading } = useHeadCommitJobState({
    prPath,
    headSha: basicInfo?.head,
    jobs,
    isOnLatestCommit,
  });

  // Sync PR state with session store (must be called before early returns)
  const prUrl = `https://${prPath}`;
  // Prefer live /info (git-provider ground truth) for merged/state so a stale
  // pr_meta cache entry can't mislabel a merged/closed PR as open; fall back to
  // the fast pr_meta value only while /info is still loading.
  const syncedPRState = useSyncDerivedPRState(prUrl, mergeStatusData?.state, {
    merged: basicInfo?.merged ?? prMeta?.merged,
    merged_at: basicInfo?.merged_at,
    state: basicInfo?.state ?? prMeta?.state,
    updated_at: basicInfo?.updated_at,
  });

  const routeCtx = useMemo(
    () => ({ owner, repo, prNumber, prPath, host, provider }),
    [owner, repo, prNumber, prPath, host, provider]
  );
  const prCtx = useMemo(
    () => ({
      url: prUrl,
      state: syncedPRState as PRState,
      diffOnly,
      isDiffOnly,
      eligibility,
      // Wrap launchJob so that after a new job is launched from the Bugs-tab
      // DiffOnlyUpsell, we drop the sticky selection. Otherwise `selectBestJob`
      // would keep the (diff-only) current job pinned and the UI would never
      // switch to the newly running pr_review job. This mirrors how
      // PRDetailPage wraps launchJob with selectJob — but here we can't call
      // selectJob directly because it triggers a router navigation that's
      // inappropriate inside the embedded view.
      launchJob: async () => {
        const newJob = await launchJob();
        resetStickyJob();
        return newJob;
      },
      isLaunchPending,
    }),
    [
      prUrl,
      syncedPRState,
      diffOnly,
      isDiffOnly,
      eligibility,
      launchJob,
      resetStickyJob,
      isLaunchPending,
    ]
  );

  // Error state — must be checked before the loading skeleton, otherwise
  // an errored query (basicInfo === undefined, isBasicInfoLoading === false)
  // would fall into the loading branch below and render a skeleton forever.
  if (!basicInfo && (basicInfoError || githubError)) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-4 p-8",
          className
        )}
      >
        <p className="text-14 text-text-secondary">
          {t("errors.unableToLoadPRShort")}
        </p>
        <a
          href={`https://${prPath}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-14 text-text-link hover:text-text-link-strong"
        >
          {t("errors.openOnHost", { host })}
        </a>
      </div>
    );
  }

  // Loading state
  if (isBasicInfoLoading || !basicInfo) {
    return (
      <EmbeddedPRReviewSkeleton
        owner={owner}
        repo={repo}
        prNumber={prNumber}
        prPath={prPath}
        host={host}
        provider={provider}
        isAuthenticated={isAuthenticated}
        className={className}
      />
    );
  }

  const prState = syncedPRState as PRState;

  return (
    <CanShowAskDevinContext.Provider value={false}>
      <PRReviewRouteContext.Provider value={routeCtx}>
        <PRDigestScrollProvider>
          <DiscussionScrollProvider>
            <PRContext.Provider value={prCtx}>
              <ViewModeContext.Provider value={viewModeCtx}>
                <ScrollRegistryProvider>
                  <TooltipProvider>
                    <div
                      ref={setContainerEl}
                      className="flex min-h-0 flex-1 flex-col"
                    >
                      <EmbeddedPRContent
                        key={prPath}
                        prState={prState}
                        githubData={githubData}
                        digestData={digestData}
                        jobs={jobs}
                        isDigestLoading={isDigestLoading}
                        isErrored={isErrored}
                        errorMessage={errorMessage}
                        isErrorRetryable={isErrorRetryable}
                        isJobRunning={isJobRunning}
                        launchJob={launchJob}
                        isLaunchPending={isLaunchPending}
                        currentJobId={currentJobId}
                        displayedVersionId={displayedVersion?.id ?? null}
                        displayedVersionHasLifeguard={completedSubtasks.includes(
                          "lifeguard"
                        )}
                        previousLifeguardResult={previousLifeguardResult}
                        previousLifeguardJobId={previousLifeguardJobId}
                        newerJobAvailable={newerJobAvailable}
                        switchToNewerJob={switchToNewerJob}
                        hasNewerVersion={hasNewerVersion}
                        switchToLatestVersion={switchToLatestVersion}
                        resetStickyJob={resetStickyJob}
                        hasNoJobs={
                          isJobsLoaded && jobs.length === 0 && !isLaunchPending
                        }
                        isDiffOnly={isDiffOnly}
                        shouldShowHeadAnalysisLoading={
                          shouldShowHeadAnalysisLoading
                        }
                        isWindsurfEmbedded={isWindsurfEmbedded}
                        mergeStatusData={mergeStatusData}
                        className={className}
                      />
                    </div>
                  </TooltipProvider>
                </ScrollRegistryProvider>
              </ViewModeContext.Provider>
            </PRContext.Provider>
          </DiscussionScrollProvider>
        </PRDigestScrollProvider>
      </PRReviewRouteContext.Provider>
    </CanShowAskDevinContext.Provider>
  );
}

interface EmbeddedPRContentProps {
  prState: PRState;
  githubData?: ReturnType<typeof usePRGitHub>["data"];
  mergeStatusData?: ReturnType<typeof usePRMergeStatus>["data"];
  digestData: ReturnType<typeof usePRDetail>["data"];
  jobs: ReturnType<typeof usePRDetail>["jobs"];
  isDigestLoading: boolean;
  isErrored: boolean;
  errorMessage?: string | null;
  isErrorRetryable: boolean;
  isJobRunning: boolean;
  launchJob: ReturnType<typeof usePRDetail>["launchJob"];
  isLaunchPending: boolean;
  currentJobId: string | null;
  displayedVersionId: string | null;
  displayedVersionHasLifeguard: boolean;
  previousLifeguardResult: ReturnType<
    typeof usePRDetail
  >["previousLifeguardResult"];
  previousLifeguardJobId: string | null;
  newerJobAvailable: boolean;
  switchToNewerJob: () => void;
  hasNewerVersion: boolean;
  switchToLatestVersion: () => void;
  resetStickyJob: () => void;
  /** When true, no review job exists and none is being launched */
  hasNoJobs: boolean;
  /** When true, the current job is diff-only (no lifeguard bugs were produced). */
  isDiffOnly: boolean;
  /** Whether to show loading spinner instead of stale diff while latest HEAD analysis is pending. */
  shouldShowHeadAnalysisLoading: boolean;
  isWindsurfEmbedded?: boolean;
  className?: string;
}

function EmbeddedPRContent({
  prState,
  githubData,
  digestData,
  jobs,
  isDigestLoading: _isDigestLoading,
  isErrored,
  errorMessage,
  isErrorRetryable,
  isJobRunning,
  launchJob: _launchJob,
  isLaunchPending: _isLaunchPending,
  currentJobId,
  displayedVersionId,
  displayedVersionHasLifeguard,
  previousLifeguardResult,
  previousLifeguardJobId,
  newerJobAvailable,
  switchToNewerJob,
  hasNewerVersion,
  switchToLatestVersion,
  resetStickyJob,
  hasNoJobs,
  isDiffOnly,
  shouldShowHeadAnalysisLoading,
  isWindsurfEmbedded,
  mergeStatusData,
  className,
}: EmbeddedPRContentProps) {
  const { owner, repo, prNumber, prPath, host } = usePRReviewRoute();
  const { isAuthenticated: rawIsAuthenticated } = useAuth();
  const isAuthenticated = rawIsAuthenticated || !!isWindsurfEmbedded;
  const [storedActiveTabCache, setActiveTabCache] = useLocalStorage<unknown>(
    "pr-review-in-session-active-tabs",
    []
  );
  const activeTabCache = useMemo(() => {
    const parsed = ActiveTabCacheSchema.safeParse(storedActiveTabCache);
    return parsed.success ? parsed.data : [];
  }, [storedActiveTabCache]);
  const activeTab =
    activeTabCache.findLast(([cachedPrPath]) => cachedPrPath === prPath)?.[1] ??
    "diff";
  const setActiveTab = useCallback(
    (tab: string) => {
      const entry: ActiveTabCache[number] = [prPath, tab];
      setActiveTabCache(
        [
          ...activeTabCache.filter(([cachedPrPath]) => cachedPrPath !== prPath),
          entry,
        ].slice(-MAX_ACTIVE_TAB_CACHE_ENTRIES)
      );
    },
    [activeTabCache, prPath, setActiveTabCache]
  );
  const { sectionTopRef, changeTab, scrollTabRowToTop } =
    useTabScrollPreservation(activeTab, setActiveTab);
  const commentLocation: CommentLocation = "hybrid";
  const [hideCommentBoxes, setHideCommentBoxes] = useLocalStorageState<
    "true" | "false"
  >("pr-digest-hide-comment-boxes", "false");
  const hideCommentBoxesCtx = useMemo(
    () => ({
      hideCommentBoxes: hideCommentBoxes === "true",
      setHideCommentBoxes: (hide: boolean) =>
        setHideCommentBoxes(hide ? "true" : "false"),
    }),
    [hideCommentBoxes, setHideCommentBoxes]
  );

  const switchToDiffTab = useCallback(() => {
    changeTab("diff");
  }, [changeTab]);

  // Switching jobs/versions only swaps the displayed analysis result;
  // refetch the GitHub-data queries too so header stats, discussion, and
  // merge status reflect the new head commit.
  const refreshGitHubMetadata = useRefreshGitHubMetadata();
  const handleSwitchToNewerJob = useCallback(() => {
    switchToNewerJob();
    void refreshGitHubMetadata();
  }, [switchToNewerJob, refreshGitHubMetadata]);
  const handleSwitchToLatestVersion = useCallback(() => {
    switchToLatestVersion();
    void refreshGitHubMetadata();
  }, [switchToLatestVersion, refreshGitHubMetadata]);

  const handleCommitsLaunchJob = useCallback(
    async (shouldSelectJob: boolean) => {
      const newJob = await _launchJob();
      if (shouldSelectJob) resetStickyJob();
      return newJob;
    },
    [_launchJob, resetStickyJob]
  );

  const handleCommitsSelectJob = useCallback(() => {
    handleSwitchToNewerJob();
  }, [handleSwitchToNewerJob]);

  // resetStickyJob lets the UI switch to the newly launched job instead of staying pinned to the errored one.
  const retryHandler = useCallback(async () => {
    await _launchJob();
    resetStickyJob();
  }, [_launchJob, resetStickyJob]);

  const onRetry = isErrorRetryable ? retryHandler : undefined;

  // Wire up the scroll container ref so bug/analysis click navigation works
  const { containerRef, setContainer } = usePRDigestScroll();
  const scrollRef = useCallback(
    (node: HTMLDivElement | null) => {
      setContainer(node);
    },
    [setContainer]
  );

  // Scroll back to top when the session's PR tab is re-clicked while active.
  const scrollToTopSignal = useAtomValue(prReviewScrollToTopAtom);
  useEffect(() => {
    if (scrollToTopSignal?.prPath === prPath) {
      containerRef.current?.scrollTo({ top: 0 });
    }
  }, [scrollToTopSignal, prPath, containerRef]);

  // Set up gutter selection for multi-line comment selection
  useGutterSelection();

  // Set current PR context for scoping resolved comment IDs (mark read/unread)
  const setCurrentPR = useLocalResolvedCommentsStore(
    (state) => state.setCurrentPR
  );
  useEffect(() => {
    setCurrentPR(prPath);
  }, [prPath, setCurrentPR]);

  const {
    setCannotInteractWithGitHub,
    setCanInstallGithubApp,
    setInteractionBlockReason,
  } = useGithubCommentActions();
  const {
    cannotInteractWithGitHub,
    canInstallGithubApp,
    interactionBlockReason,
  } = usePRGithubInteractivity();
  const canEdit = isAuthenticated && !cannotInteractWithGitHub;

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

  // Poll for lifeguard progress when job is running
  const lifeguardProgressQuery = useQuery({
    queryKey: ["lifeguard-progress", prPath, currentJobId],
    queryFn: () => getLifeguardProgress(prPath, currentJobId!),
    enabled: isJobRunning && !!currentJobId,
    refetchInterval: 1000,
    staleTime: 500,
  });

  const lifeguardProgress: LifeguardProgress | null =
    lifeguardProgressQuery.data?.status !== "not_started"
      ? (lifeguardProgressQuery.data ?? null)
      : null;

  const lazyFetchFn = useCallback(
    (paths: string[]) =>
      getLazyFileContents(prPath, currentJobId!, displayedVersionId!, paths),
    [prPath, currentJobId, displayedVersionId]
  );
  const { fileContentsAtBase, requestFiles } = useLazyFileContents({
    fileContentsAtBase: digestData?.file_contents_at_base,
    cacheKey:
      currentJobId && displayedVersionId
        ? `${currentJobId}:${displayedVersionId}`
        : null,
    fetchFn: currentJobId && displayedVersionId ? lazyFetchFn : undefined,
  });

  const baseLifeguardResult =
    digestData?.lifeguard_result ?? previousLifeguardResult ?? undefined;
  // The manifest merges into the displayed result, so its jobId must match that
  // result's job. Prefetch the current job's manifest off the jobs-list version
  // metadata so it's cache-warm when the digest lands. Mirrors PRDetailPage.
  const componentPreviewsJobId =
    (digestData?.lifeguard_result ? currentJobId : previousLifeguardJobId) ??
    undefined;
  usePrefetchComponentPreviewsManifest({
    prPath,
    jobId: currentJobId,
    enabled: displayedVersionHasLifeguard,
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
    host,
    sections: digestData?.sections ?? [],
    fileContentsAtBase,
    lifeguardResult,
    mergeBaseSha: digestData?.pr_metadata?.merge_base_sha,
    commentLocation,
    defaultInlineCommentExpanded: false,
  });

  useViewedFilesSync(
    prPath,
    currentJobId,
    digestData?.sections ?? [],
    digestData?.pr_metadata?.head_sha
  );

  const securityReviewEnabled = useSecurityReviewEnabled();
  const { total: unresolvedFindingsCount } = useUnresolvedFindingsCounts(
    lifeguardResult,
    securityReviewEnabled
  );
  const fileOverlay = useFileOverlayStore();
  const closeFileOverlay = fileOverlay.closeFile;
  useEffect(() => {
    closeFileOverlay();
    return closeFileOverlay;
  }, [prPath, closeFileOverlay]);

  const bugsContent = (
    <EmbeddedBugsPanel
      isErrored={isErrored}
      errorMessage={errorMessage}
      onRetry={onRetry}
      isDiffOnly={isDiffOnly}
      lifeguardResult={lifeguardResult ?? null}
      isLifeguardOutdated={isLifeguardOutdated}
      onNavigateToFinding={switchToDiffTab}
      isJobRunning={isJobRunning}
      lifeguardProgress={lifeguardProgress}
      hasNewerVersion={hasNewerVersion}
      switchToLatestVersion={handleSwitchToLatestVersion}
      allChangesInFileMap={allChangesInFileMap}
    />
  );
  const bugsCount = isDiffOnly ? undefined : unresolvedFindingsCount;

  const diffTabContent = shouldShowHeadAnalysisLoading ? (
    <div className="flex items-center justify-center py-16">
      <IconLoadingCircle className="size-8 animate-spin" />
    </div>
  ) : (
    <DiffTabContent
      isErrored={isErrored}
      errorMessage={errorMessage}
      digestData={digestData}
      items={items}
      overview={overview}
      fileContentsAtBase={fileContentsAtBase}
      fileContentsAtHead={fileContentsAtHead}
      allChangesInFileMap={allChangesInFileMap}
      commentsByFile={commentsByFile}
      commentRenderers={commentRenderers}
      lifeguardBugs={lifeguardResult?.bugs ?? []}
      mergeBaseSha={digestData?.pr_metadata?.merge_base_sha}
      headSha={digestData?.pr_metadata?.head_sha}
      onRetry={onRetry}
      isRetrying={_isLaunchPending}
      commentLocation={commentLocation}
    />
  );

  return (
    <LazyFileContext.Provider value={requestFiles}>
      <HideCommentBoxesContext.Provider value={hideCommentBoxesCtx}>
        <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
          <div
            ref={scrollRef}
            className={cn(
              "flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-bg-page",
              // Scroll padding matches the pinned stack of the visible tab: the
              // diff tab pins the tab bar + section header, other tabs only the tab bar.
              activeTab === "diff" ? "scroll-pt-24" : "scroll-pt-12"
            )}
          >
            <EmbeddedPRHeader
              prState={prState}
              isWindsurfEmbedded={isWindsurfEmbedded}
              isAuthenticated={isAuthenticated}
              canEdit={canEdit}
            />

            {isAuthenticated && (
              <>
                {prState === "OPEN" && <PRReviewTrialBanner />}
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
                  assignees={githubData?.assignees}
                  labels={githubData?.labels}
                  authorLogin={githubData?.author?.login}
                  reviewMetadataReadOnly={
                    cannotInteractWithGitHub || !!isWindsurfEmbedded
                  }
                  metadataInHovercard
                  metadataLoading={!githubData}
                  keepVisibleWhenClosed
                />
              </>
            )}

            <EmbeddedReviewTabs
              activeTab={activeTab}
              changeTab={changeTab}
              sectionTopRef={sectionTopRef}
              scrollTabRowToTop={scrollTabRowToTop}
              jobs={jobs}
              currentJobId={currentJobId}
              newerJobAvailable={newerJobAvailable}
              switchToNewerJob={handleSwitchToNewerJob}
              hasNewerVersion={hasNewerVersion}
              switchToLatestVersion={handleSwitchToLatestVersion}
              canEdit={canEdit}
              overviewText={overview?.text}
              isOverviewErrored={
                isErrored || digestData?.errored_tasks?.includes("groups")
              }
              hasNoJobs={hasNoJobs}
              diffTabContent={diffTabContent}
              bugsContent={bugsContent}
              bugsCount={bugsCount}
              commitsLaunchJob={handleCommitsLaunchJob}
              commitsSelectJob={handleCommitsSelectJob}
              isCommitsLoading={_isDigestLoading}
              isWindsurfEmbedded={isWindsurfEmbedded}
            />
          </div>
          {fileOverlay.isOpen && fileOverlay.file && (
            <div className="absolute inset-0 z-40 bg-bg-page">
              <ExternalFileOverlay
                onClose={closeFileOverlay}
                file={fileOverlay.file}
                isLoading={fileOverlay.isLoading}
                error={fileOverlay.error}
                comments={fileOverlay.comments}
                commentRenderers={commentRenderers}
              />
            </div>
          )}
        </div>
      </HideCommentBoxesContext.Provider>
    </LazyFileContext.Provider>
  );
}
