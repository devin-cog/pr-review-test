import { useIsMobile } from "#/ds-deps";
import { TooltipProvider } from "#/ds-deps/tooltip";
import { AccordionRoot } from "#/ds/accordion";
import { BreadcrumbExternalLink, BreadcrumbItem } from "#/ds/breadcrumb";
import { Button } from "#/ds/button";
import { DevinIcon } from "#/ds/icons/DevinIcon";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { IconBlock } from "central-icons-stroke/IconBlock";
import { IconExclamationCircle } from "central-icons-stroke/IconExclamationCircle";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { LoadingSpinner } from "@/modules/layout/component/PageLoader";
import { SidebarContentReviewPR } from "@/modules/sidebar-new/components/SidebarContentReview";
import { HeaderActions } from "@/modules/sidebar/components/Breadcrumbs";
import { HideCommentBoxesContext } from "../components/DiffViewer/contexts/HideCommentBoxesContext";
import { ViewModeContext } from "../components/DiffViewer/contexts/ViewModeContext";
import type { CommentLocation } from "../components/DiffViewer/types";
import { ExternalFileOverlay } from "../components/ExternalFileOverlay";
import { PRDescription } from "../components/PRDescription";
import { CommitStatusPopover } from "../components/PRHeaderActions/CommitStatusPopover";
import { PRActionsMenu } from "../components/PRHeaderActions/PRActionsMenu";
import { SubmitReviewAction } from "../components/PRHeaderActions/SubmitReviewAction";
import { PRReviewHeaderBreadcrumb } from "../components/PRReviewHeaderBreadcrumb";
import { PRSections, PRSidebar } from "../components/PRSidebar";
import { PRTitle } from "../components/PRTitle";
import {
  MobileSidebarPanel,
  MobileSidebarProvider,
} from "../components/agent/MobileChatPanel";
import { PRAgent, type PRAgentHandle } from "../components/agent/PRAgent";
import { DiscussionScrollProvider } from "../contexts/DiscussionScrollProvider";
import { LazyFileContext } from "../contexts/LazyFileContext";
import { PRDigestScrollProvider } from "../contexts/PRDigestScrollProvider";
import { ScrollRegistryProvider } from "../contexts/ScrollRegistryProvider";
import { usePRReviewRoute } from "../contexts/prReviewRouteContext";
import { useAgentChat } from "../hooks/useAgentChat";
import {
  UnauthedComponentPreviewFetchContext,
  useLifeguardResultWithLivePreviews,
} from "../hooks/useComponentPreviews";
import { useDiffViewModePreference } from "../hooks/useDiffViewModePreference";
import { useLazyFileContents } from "../hooks/useLazyFileContents";
import { usePRDigestData } from "../hooks/usePRDigest";
import {
  type LifeguardComponentPreview,
  type LifeguardProgress,
  type PRDetailData,
  getUnauthedComponentPreviewContent,
  getUnauthedJobResult,
  getUnauthedJobStatus,
  getUnauthedLazyFileContents,
  getUnauthedLifeguardProgress,
  isRedirectResponse,
} from "../queries/prReviewJobs";
import { useFileOverlayStore } from "../stores/fileOverlayStore";
import { useGithubCommentStore } from "../stores/githubCommentStore";
import { useAskDevinPanelStore } from "../stores/mentionStore";
import { useSidebarTab } from "../stores/sidebarTabStore";
import { getEffectiveJobStatus } from "../utils/jobProcessing";
import { PRDetailPageLayout } from "./PRDetailPageLayout";

const PR_REVIEW_TOKENS_KEY = "pr-review-tokens";

interface StoredToken {
  token: string;
  jobId: string;
  repoPath?: string;
  prNumber?: number;
  storedAt: number;
}

type StoredTokensMap = Record<string, StoredToken>;

function useSubmissionToken(
  jobId: string,
  port: number | null | undefined
): {
  token: string | undefined;
  isLoading: boolean;
  needsManualConnect: boolean;
  triggerConnect: () => void;
} {
  // 1. Check localStorage first
  const [storedTokens, setStoredTokens] = useLocalStorage<StoredTokensMap>(
    PR_REVIEW_TOKENS_KEY,
    {}
  );
  const localToken = storedTokens?.[jobId]?.token;

  // 2. Track whether user has clicked "Connect" button
  const [userTriggeredConnect, setUserTriggeredConnect] = useState(false);

  // 3. Fetch from localhost only after user clicks connect (and no token in localStorage)
  const DEFAULT_TOKEN_PORT = 4351;
  const effectivePort = port ?? DEFAULT_TOKEN_PORT;
  const shouldFetchFromCli = !localToken && userTriggeredConnect;
  const { data: cliTokenData, isLoading: cliLoading } = useQuery({
    queryKey: ["local-token", jobId, effectivePort],
    queryFn: async () => {
      const res = await fetch(`http://localhost:${effectivePort}/token`);
      if (!res.ok) throw new Error("Failed to fetch token");
      return res.json() as Promise<{ token: string; job_id: string }>;
    },
    enabled: shouldFetchFromCli,
    retry: false,
    staleTime: Infinity,
  });

  // Determine the token to use (priority: localStorage > CLI)
  const cliToken =
    cliTokenData?.job_id === jobId ? cliTokenData.token : undefined;
  const token = localToken || cliToken;

  // Store token in localStorage if we got one from CLI
  useEffect(() => {
    if (cliToken && !localToken) {
      setStoredTokens((prev) => ({
        ...prev,
        [jobId]: { token: cliToken, jobId, storedAt: Date.now() },
      }));
    }
  }, [jobId, cliToken, localToken, setStoredTokens]);

  return {
    token,
    isLoading: shouldFetchFromCli && cliLoading,
    needsManualConnect: !localToken && !userTriggeredConnect,
    triggerConnect: () => setUserTriggeredConnect(true),
  };
}

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

interface PRJobPageProps {
  jobId: string;
}

export function PRJobPage({ jobId }: PRJobPageProps) {
  const { t } = useTranslation("review");
  const navigate = useNavigate();
  const { isMobile } = useIsMobile();
  const {
    owner: routeOwner,
    repo: routeRepo,
    prNumber: routePrNumber,
  } = usePRReviewRoute();
  const { viewMode, setViewMode } = useDiffViewModePreference();
  const [hideCommentBoxes, setHideCommentBoxes] = useLocalStorageState<
    "true" | "false"
  >("pr-digest-hide-comment-boxes", "false");
  const [_commentLocation, setCommentLocation] =
    useLocalStorageState<CommentLocation>(
      "pr-digest-comment-location",
      "floating"
    );
  const commentLocation: CommentLocation = isMobile
    ? "inline"
    : _commentLocation;

  // const timesResetRef = useRef(0);

  // const mockJobStatus = async () => {
  //   const data = await getUnauthedJobStatus(jobId, token);
  //   if (timesResetRef.current < 5) {
  //     timesResetRef.current += 1;
  //     data.status = "running";
  //     data.completed_subtasks = [];
  //   }
  //   return data;
  // };

  // First, poll job status to get the port (needed for token fetch)
  const { data: initialJobStatus } = useQuery({
    queryKey: ["pr-job-status-initial", jobId],
    queryFn: () => getUnauthedJobStatus(jobId),
    // queryFn: () => mockJobStatus(),
    retry: 3,
    retryDelay: 1000,
  });

  // Get submission token (checks localStorage, then CLI server using port from job status)
  const {
    token,
    isLoading: tokenLoading,
    needsManualConnect,
    triggerConnect,
  } = useSubmissionToken(jobId, initialJobStatus?.port);

  const {
    data: rawJobData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["pr-job-result", jobId, token],
    queryFn: () => getUnauthedJobResult(jobId, undefined, token),
    enabled: !tokenLoading,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes("404")) {
        return false;
      }
      return failureCount < 10;
    },
    retryDelay: 3000,
    refetchInterval: (query) => {
      // Stop polling if there's an error (e.g., 404 not found)
      if (query.state.error) {
        return false;
      }
      // Stop polling if we got a redirect response
      const data = query.state.data;
      if (data && isRedirectResponse(data)) {
        return false;
      }
      // Poll every 3 seconds while job is still pending (no pr_metadata yet)
      if (!data || !("pr_metadata" in data)) {
        return 3000;
      }
      // Stop polling once we have the result
      return false;
    },
  });

  // Handle redirect response - navigate to the authed page
  useEffect(() => {
    if (rawJobData && isRedirectResponse(rawJobData)) {
      navigate({ to: rawJobData.redirect_to });
    }
  }, [rawJobData, navigate]);

  // Type-narrow: only use as PRDetailData if not a redirect
  const jobData: PRDetailData | undefined =
    rawJobData && !isRedirectResponse(rawJobData) ? rawJobData : undefined;

  // Poll job status for progress tracking
  const { data: jobStatus } = useQuery({
    queryKey: ["pr-job-status", jobId, token],
    queryFn: () => getUnauthedJobStatus(jobId, token),
    // queryFn: () => mockJobStatus(),
    enabled: !tokenLoading,
    refetchInterval: (query) => {
      // Stop polling if there's an error
      if (query.state.error) {
        return false;
      }
      const status = query.state.data?.status;
      // Keep polling while job is pending or running
      if (!status || status === "pending" || status === "running") {
        return 2000;
      }
      return false;
    },
  });

  const effectiveStatus = jobStatus
    ? getEffectiveJobStatus(jobStatus.status, jobStatus.completed_subtasks)
    : null;
  const isJobRunning =
    effectiveStatus === "running" || effectiveStatus === "pending";
  const isJobErrored = effectiveStatus === "errored";

  // Poll for lifeguard progress when job is running
  const lifeguardProgressQuery = useQuery({
    queryKey: ["lifeguard-progress-unauthed", jobId, token],
    queryFn: () => getUnauthedLifeguardProgress(jobId, token),
    enabled: isJobRunning && !tokenLoading && !!token,
    refetchInterval: 1000,
    staleTime: 500,
    retry: false,
  });

  // Only use progress data if lifeguard has actually started
  const lifeguardProgress: LifeguardProgress | null =
    lifeguardProgressQuery.data?.status !== "not_started"
      ? (lifeguardProgressQuery.data ?? null)
      : null;

  // Track whether we ever saw the job running (to hide progress UI if job was already done on load)
  const [everSawJobRunning, setEverSawJobRunning] = useState(false);
  useEffect(() => {
    if (isJobRunning && !everSawJobRunning) {
      setEverSawJobRunning(true);
    }
  }, [isJobRunning, everSawJobRunning]);

  if (needsManualConnect) {
    return (
      <div className="flex h-dvh w-screen flex-col items-center justify-center gap-6 bg-bg-page p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-balance text-22 font-semibold text-text-primary">
            {t("jobPage.viewPr", {
              owner: routeOwner,
              repo: routeRepo,
              prNumber: routePrNumber,
            })}
          </h1>
          <p className="max-w-sm text-pretty text-13 text-text-secondary">
            {t("jobPage.cliAuthRequired")}
          </p>
          <Button size="md" onClick={triggerConnect}>
            {t("jobPage.connectToCli")}
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || tokenLoading) {
    return <LoadingSpinner />;
  }

  if (error || !jobData || !jobData.pr_metadata) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const isPending =
      errorMessage.includes("202") ||
      (!error && jobData && !jobData.pr_metadata);
    const isNotFound =
      errorMessage.includes("404") || errorMessage.includes("not found");

    return (
      <div className="flex h-dvh w-screen flex-col items-center justify-center gap-6 bg-bg-page p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          {isPending ? (
            <DevinIcon color="tint" className="size-14" />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full bg-bg-elevated">
              {isNotFound ? (
                <IconBlock className="size-8 text-text-secondary" />
              ) : (
                <IconExclamationCircle className="size-8 text-text-secondary" />
              )}
            </div>
          )}
          <h1 className="text-22 font-semibold text-text-primary">
            {isPending
              ? t("jobPage.reviewStillProcessing")
              : isNotFound
                ? t("jobPage.reviewNotFound")
                : t("jobPage.failedToLoadReview")}
          </h1>
          <p className="max-w-sm text-13 text-text-secondary">
            {isPending
              ? t("jobPage.reviewProcessingDesc")
              : isNotFound
                ? t("jobPage.cliRunningRequired")
                : t("jobPage.couldNotFetchResult", {
                    error: errorMessage,
                  })}
          </p>
          <p className="font-mono text-12 text-text-secondary">
            Job ID: {jobId}
          </p>
        </div>
      </div>
    );
  }

  const { owner, repo, pr_number: prNumber } = jobData.pr_metadata;

  return (
    <PRDigestScrollProvider>
      <DiscussionScrollProvider>
        <ScrollRegistryProvider>
          <ViewModeContext.Provider
            value={{
              mode: isMobile ? "unified" : viewMode,
              setViewMode,
              splitViewDisabled: isMobile,
            }}
          >
            <HideCommentBoxesContext.Provider
              value={{
                hideCommentBoxes: hideCommentBoxes === "true",
                setHideCommentBoxes: (hide: boolean) =>
                  setHideCommentBoxes(hide ? "true" : "false"),
              }}
            >
              <PRJobPageContent
                owner={owner}
                repo={repo}
                prNumber={String(prNumber)}
                jobId={jobId}
                token={token}
                digestData={{
                  ...jobData,
                  cliJobId: jobId,
                }}
                commentLocation={commentLocation}
                setCommentLocation={setCommentLocation}
                isJobRunning={everSawJobRunning && isJobRunning}
                isJobErrored={everSawJobRunning && isJobErrored}
                refetchJob={refetch}
                lifeguardProgress={lifeguardProgress}
              />
            </HideCommentBoxesContext.Provider>
          </ViewModeContext.Provider>
        </ScrollRegistryProvider>
      </DiscussionScrollProvider>
    </PRDigestScrollProvider>
  );
}

interface PRJobPageContentProps {
  owner: string;
  repo: string;
  prNumber: string;
  jobId: string;
  token: string | undefined;
  digestData: PRDetailData;
  commentLocation: CommentLocation;
  setCommentLocation: (location: CommentLocation) => void;
  isJobRunning: boolean;
  isJobErrored: boolean;
  refetchJob: () => void;
  lifeguardProgress: LifeguardProgress | null;
}

function PRJobPageContent({
  owner,
  repo,
  prNumber,
  jobId,
  token,
  digestData,
  commentLocation,
  setCommentLocation,
  isJobRunning,
  isJobErrored,
  refetchJob,
  lifeguardProgress,
}: PRJobPageContentProps) {
  const { t } = useTranslation("review");
  const { prPath, host } = usePRReviewRoute();
  const queryClient = useQueryClient();
  // Pull-to-refresh bumps this so useLazyFileContents drops its resolved
  // overlay; otherwise previously fetched large-file strings would mask any
  // updated payload coming back from the server.
  const [refreshNonce, setRefreshNonce] = useState(0);
  const handlePullRefresh = useCallback(() => {
    setRefreshNonce((n) => n + 1);
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ["pr-job-result"] }),
      queryClient.invalidateQueries({ queryKey: ["pr-job-status"] }),
      queryClient.invalidateQueries({
        queryKey: ["pr-job-status-initial"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["lifeguard-progress-unauthed"],
      }),
    ]).then(() => undefined);
  }, [queryClient]);
  const externalPrUrl = `https://${prPath}`;
  const fileOverlay = useFileOverlayStore();
  const prAgentRef = useRef<PRAgentHandle>(null);
  const triggerFocus = useAskDevinPanelStore((state) => state.triggerFocus);
  const [, setSidebarTab] = useSidebarTab();

  const agentChat = useAgentChat({
    owner,
    repo,
    prNumber,
    prPath,
    prData: digestData,
    jobId,
  });

  const title = digestData.pr_metadata.title || `PR #${prNumber}`;

  // versionId=undefined -> server picks latest (mirrors the main result fetch).
  const lazyFetchFn = useCallback(
    (paths: string[]) =>
      getUnauthedLazyFileContents(jobId, undefined, paths, token),
    [jobId, token]
  );
  const { fileContentsAtBase, requestFiles } = useLazyFileContents({
    fileContentsAtBase: digestData.file_contents_at_base,
    cacheKey: `${jobId}:${refreshNonce}`,
    fetchFn: lazyFetchFn,
  });

  const lifeguardResult = useLifeguardResultWithLivePreviews({
    lifeguardResult: digestData?.lifeguard_result ?? undefined,
    prPath,
    jobId,
    isJobRunning,
    unauthedToken: token,
  });
  const fetchUnauthedPreviewContent = useCallback(
    (preview: LifeguardComponentPreview) =>
      getUnauthedComponentPreviewContent(preview, token),
    [token]
  );
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

  // Set auth store to unauthenticated for this page
  const setIsAuthenticated = useGithubCommentStore(
    (state) => state.setIsAuthenticated
  );
  const setCannotInteractWithGitHub = useGithubCommentStore(
    (state) => state.setCannotInteractWithGitHub
  );
  useEffect(() => {
    setIsAuthenticated(false);
    setCannotInteractWithGitHub(true);
  }, [setIsAuthenticated, setCannotInteractWithGitHub]);

  const [isViewingLatestVersion, setIsViewingLatestVersion] = useState(true);

  const showAnalysisProgress = isJobRunning || !isViewingLatestVersion;

  const prevJobRunning = useRef(isJobRunning);

  useEffect(() => {
    if (!isJobRunning && prevJobRunning.current) {
      setIsViewingLatestVersion(false);
    }
    prevJobRunning.current = isJobRunning;
  }, [isJobRunning]);

  const sidepanelContent = (
    <PRSidebar
      owner={owner}
      repo={repo}
      prNumber={prNumber}
      prPath={prPath}
      isGitHubLoaded={false}
      githubData={undefined}
      items={items}
      overview={overview}
      lifeguardResult={lifeguardResult}
      scrollToSection={scrollToSection}
      scrollToFile={scrollToFile}
      isJobRunning={isJobRunning}
      isErrored={isJobErrored}
      showAnalysisProgress={showAnalysisProgress}
      hideCIInfo
      lifeguardProgressOverride={lifeguardProgress}
      cannotInteractWithGitHub={true}
      onViewResults={() => {
        refetchJob();
        setIsViewingLatestVersion(true);
      }}
      erroredTasks={digestData?.errored_tasks}
      chat={agentChat}
    />
  );

  return (
    <UnauthedComponentPreviewFetchContext.Provider
      value={fetchUnauthedPreviewContent}
    >
      {/* Portal breadcrumbs into the InnerBreadcrumbs header */}
      <PRReviewHeaderBreadcrumb>
        <BreadcrumbItem className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded bg-tint-orange px-1.5 py-0.5 text-12 font-medium text-text-orange">
            {t("jobPage.preview")}
          </span>
          <BreadcrumbExternalLink
            href={externalPrUrl}
            className="min-w-0 flex-1 justify-start"
          >
            <span className="block min-w-0 truncate">
              #{prNumber} {title}
            </span>
          </BreadcrumbExternalLink>
        </BreadcrumbItem>
      </PRReviewHeaderBreadcrumb>

      {/* Portal actions into the InnerBreadcrumbs header */}
      <HeaderActions>
        <CommitStatusPopover
          commits={[
            {
              sha: digestData.pr_metadata.head_sha,
              message: "latest",
              headline: "latest",
              body: "latest",
              author: "latest",
              committed_at: null,
            },
          ]}
          jobs={[
            {
              job_id: digestData.cliJobId ?? "job-default",
              status: isJobRunning
                ? "running"
                : isJobErrored
                  ? "errored"
                  : "completed",
              pr_number: parseInt(prNumber),
              commit_sha: digestData.pr_metadata.head_sha,
              job_type: "pr_review",
              created_at: "latest",
              updated_at: "latest",
              versions: [],
            },
          ]}
          currentJobId={digestData.cliJobId ?? "job-default"}
          isViewingLatestVersion={isViewingLatestVersion}
          onLaunchJob={undefined}
          onSelectJob={() => {
            refetchJob();
            setIsViewingLatestVersion(true);
          }}
          onSwitchToLatestVersion={() => {
            refetchJob();
            setIsViewingLatestVersion(true);
          }}
          isOnLatestCommit={true}
        />
        <PRActionsMenu prPath={prPath} />
        <div className="ml-2 mr-4">
          <SubmitReviewAction
            prAuthorLogin=""
            prState="OPEN"
            cannotInteractWithGitHub={true}
            isAuthenticated={false}
          />
        </div>
      </HeaderActions>

      <MobileSidebarProvider>
        <TooltipProvider>
          <PRDetailPageLayout
            onPullRefresh={handlePullRefresh}
            documentContent={
              <>
                <div className="flex flex-col gap-2">
                  <span className="flex items-center gap-1 text-14 text-text-secondary">
                    <a
                      href={externalPrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {owner}/{repo} #{prNumber}
                    </a>
                  </span>

                  <PRTitle
                    title={title}
                    owner={owner}
                    repo={repo}
                    prNumber={prNumber}
                    prPath={prPath}
                    canEdit={false}
                  />
                </div>

                <AccordionRoot
                  multiple
                  defaultValue={[]}
                  className="flex flex-col gap-5"
                >
                  <PRDescription
                    isLoading={false}
                    body={digestData.pr_metadata.description ?? null}
                    owner={owner}
                    repo={repo}
                    prNumber={prNumber}
                    prPath={prPath}
                    canEdit={false}
                    overview={overview?.text}
                    isOverviewErrored={digestData?.errored_tasks?.includes(
                      "groups"
                    )}
                  />
                </AccordionRoot>
              </>
            }
            filesContent={
              <LazyFileContext.Provider value={requestFiles}>
                <PRSections
                  sections={digestData.sections}
                  fileContentsAtBase={fileContentsAtBase}
                  fileContentsAtHead={fileContentsAtHead}
                  prPath={prPath}
                  jobId={digestData.cliJobId ?? null}
                  lifeguardResult={lifeguardResult}
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
                  pullRequestId={undefined}
                  mergeBaseSha={digestData.pr_metadata.merge_base_sha}
                  headSha={digestData.pr_metadata.head_sha}
                  onChatWithSelection={() => {
                    setSidebarTab("chat");
                    triggerFocus();
                  }}
                />
              </LazyFileContext.Provider>
            }
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
            innerSidebarContent={
              <SidebarContentReviewPR
                sections={digestData.sections}
                isJobRunning={isJobRunning}
                isViewingLatestVersion={isViewingLatestVersion}
                erroredTasks={digestData.errored_tasks}
                isErrored={isJobErrored}
              />
            }
          />

          <PRAgent
            ref={prAgentRef}
            chat={agentChat}
            onRedirectToSidebar={() => {
              setSidebarTab("chat");
              triggerFocus();
            }}
            prAuthorLogin=""
            prState="OPEN"
            cannotInteractWithGitHub={true}
            isAuthenticated={false}
          />
          <MobileSidebarPanel sidepanelContent={sidepanelContent} />
        </TooltipProvider>
      </MobileSidebarProvider>
    </UnauthedComponentPreviewFetchContext.Provider>
  );
}
