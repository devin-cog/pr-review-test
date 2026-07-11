import { useIsMobile } from "#/ds-deps";
import { Tooltip } from "#/ds-deps/tooltip";
import { IconButton } from "#/ds/button";
import { DevinIcon } from "#/ds/icons/DevinIcon";
import { KBSKey, KBSRoot } from "#/ds/kbs";
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "#/ds/menu";
import { Tab, TabsList, TabsPanel, TabsRoot } from "#/ds/tabs";
import { useQuery } from "@tanstack/react-query";
import { IconCircleInfo } from "central-icons-stroke/IconCircleInfo";
import { IconExclamationTriangle } from "central-icons-stroke/IconExclamationTriangle";
import { IconSettingsSliderVer } from "central-icons-stroke/IconSettingsSliderVer";
import { AnimatePresence, motion } from "motion/react";
import React, {
  ReactNode,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { analytics } from "@/lib/analytics";
import { useAuth } from "@/modules/auth";
import { cn } from "@/utils/cn";
import {
  SHOW_ANALYSIS_IN_SIDEBAR,
  useUserOrgEnterpriseBillingEnabled,
} from "@/utils/flags";
import { isMac } from "@/utils/platform";
import { usePRContext } from "../contexts/prUrlContext";
import type { useAgentChat } from "../hooks/useAgentChat";
import { useAssignableUsers } from "../hooks/useAssignableUsers";
import { useGutterSelection } from "../hooks/useGutterSelection";
import { usePRGitHub } from "../hooks/usePRGitHub";
import { useRepoLabels } from "../hooks/useRepoLabels";
import { useViewedFilesSync } from "../hooks/useViewedFilesSync";
import { PRSectionsError } from "../pages/PRDetailPage";
import {
  type FileContentAtBase,
  type LifeguardBug,
  type LifeguardProgress,
  type LifeguardResult,
  getLifeguardProgress,
} from "../queries/prReviewJobs";
import { useCommentActivationStore } from "../stores/commentActivationStore";
import { useFileDiffStateStore } from "../stores/fileDiffStateStore";
import {
  useFloatingCardOverlayStore,
  useShouldShowOverlay,
} from "../stores/floatingCardOverlayStore";
import {
  useGithubCommentActions,
  useGithubCommentStore,
} from "../stores/githubCommentStore";
import {
  getGutterSelectionMention,
  useGutterSelectionStore,
} from "../stores/gutterSelectionStore";
import { selectedDiffRef, useAskDevinPanelStore } from "../stores/mentionStore";
import {
  type SidebarTab,
  useHighlightedTabValue,
  useSidebarTab,
} from "../stores/sidebarTabStore";
import { useEffectiveLifeguardResult } from "../utils/comparisonModelUtils";
import { getFileChangeTotalLines } from "../utils/largeDiff";
import { CircleProgress } from "./CircleProgress";
import { DiffOnlyEndUpsell } from "./DiffOnlyEndUpsell";
import { DiffViewer } from "./DiffViewer";
import { FileVisibilityContext } from "./DiffViewer/contexts/FileVisibilityContext";
import {
  useHideCommentBoxes,
  useSetHideCommentBoxes,
} from "./DiffViewer/contexts/HideCommentBoxesContext";
import {
  useHideWhitespace,
  useSetHideWhitespace,
} from "./DiffViewer/contexts/HideWhitespaceContext";
import {
  useSetViewMode,
  useViewMode,
} from "./DiffViewer/contexts/ViewModeContext";
import { useGlobalFileVisibility } from "./DiffViewer/hooks/useGlobalFileVisibility";
import type {
  Change,
  CommentLocation,
  CommentRendererMap,
  LineComment,
  NormalizedSection,
} from "./DiffViewer/types";
import { EndPRFooter } from "./EndPRFooter";
import { JobErrorCard } from "./JobErrorCard";
import { JobProgressCard } from "./JobProgressCard";
import { LifeguardFindingsSection } from "./LifeguardAnalysisSection";
import { CIInfoSidebar } from "./PRSidebar/CIInfoSidebar";
import { DiffOnlyUpsell } from "./PRSidebar/DiffOnlyUpsell";
import { SectionCard } from "./PRSidebar/SectionCard";
import { renderTitleWithMarkdown } from "./PRSidebar/renderTitleWithMarkdown";
import { getFileStats } from "./PRSidebar/sectionCardUtils";
import { ChatAcuUpsell } from "./agent/ChatAcuUpsell";
import { SidebarChat } from "./agent/SidebarChat";
import { useMobileSidebar } from "./agent/mobileSidebarContext";

// Walks up from `node` to find the nearest vertically scrollable ancestor,
// used as the IntersectionObserver root so sticky-pin detection lines up with
// the element the headers actually pin against.
function getScrollParent(node: HTMLElement | null): HTMLElement | null {
  let el = node?.parentElement ?? null;
  while (el) {
    const { overflowY } = getComputedStyle(el);
    if (overflowY === "auto" || overflowY === "scroll") {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

// Selection tooltip component - isolated to prevent re-renders of parent
interface SelectionTooltipHandle {
  show: (pos: { x: number; y: number }) => void;
  hide: () => void;
}

interface SelectionTooltipProps {
  onAddToChat: () => void;
}

const SelectionTooltip = forwardRef<
  SelectionTooltipHandle,
  SelectionTooltipProps
>(({ onAddToChat }, ref) => {
  const { t } = useTranslation("review");
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useImperativeHandle(ref, () => ({
    show: (newPos) => setPos(newPos),
    hide: () => setPos(null),
  }));

  if (!pos) return null;

  return (
    <div
      id="selection-tooltip"
      className="fixed z-50 flex items-center gap-1.5 rounded-md border border-border-primary bg-bg-elevated px-2 py-1 shadow-lg"
      style={{
        left: pos.x,
        top: pos.y,
      }}
    >
      <button
        className="flex items-center gap-1.5 text-14 text-text-primary hover:text-text-primary-strong"
        onClick={onAddToChat}
      >
        <DevinIcon size="small" className="size-4" animate={false} />
        <span>{t("agent.addToChat")}</span>
        <KBSRoot>
          <KBSKey icon={isMac ? "cmd" : "ctrl"} />
          <KBSKey>I</KBSKey>
        </KBSRoot>
      </button>
    </div>
  );
});
SelectionTooltip.displayName = "SelectionTooltip";

const VIEW_MODE_OPTIONS_KEYS = [
  { value: "split", labelKey: "common.splitView" },
  { value: "unified", labelKey: "common.unifiedView" },
] as const;

interface DiffSettingsMenuProps {
  commentLocation: CommentLocation;
  onCommentLocationChange?: (location: CommentLocation) => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
}

export function DiffSettingsMenu({
  commentLocation,
  onCommentLocationChange,
  onCollapseAll,
  onExpandAll,
}: DiffSettingsMenuProps) {
  const { t } = useTranslation("review");
  const { isMobile } = useIsMobile();
  const viewMode = useViewMode();
  const setViewMode = useSetViewMode();
  const hideCommentBoxes = useHideCommentBoxes();
  const setHideCommentBoxes = useSetHideCommentBoxes();
  const hideWhitespace = useHideWhitespace();
  const setHideWhitespace = useSetHideWhitespace();

  return (
    <Menu>
      <Tooltip content={t("common.codeDiffSettings")}>
        <MenuTrigger>
          <IconButton variant="ghost" aria-label={t("common.diffSettings")}>
            <IconSettingsSliderVer className="size-4" />
          </IconButton>
        </MenuTrigger>
      </Tooltip>
      <MenuContent align="end">
        <MenuGroup>
          <MenuGroupLabel>{t("common.diffView")}</MenuGroupLabel>
          {!isMobile && (
            <MenuRadioGroup
              value={viewMode}
              onValueChange={(value) => {
                analytics.track("Review:Settings:DiffMode", {
                  mode: value as "split" | "unified",
                });
                setViewMode(value as "split" | "unified");
              }}
            >
              {VIEW_MODE_OPTIONS_KEYS.map((option) => (
                <MenuRadioItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          )}
          {!isMobile && <MenuSeparator />}
          <MenuCheckboxItem
            checked={hideWhitespace}
            onCheckedChange={(checked) => {
              analytics.track("Review:Settings:HideWhitespace", {
                hide: checked,
              });
              setHideWhitespace(checked);
            }}
          >
            {t("common.hideWhitespace")}
          </MenuCheckboxItem>
        </MenuGroup>
        <MenuSeparator />
        {!isMobile && (
          <>
            <MenuGroup>
              <MenuGroupLabel>{t("common.commentLocation")}</MenuGroupLabel>
              <MenuRadioGroup
                value={commentLocation}
                onValueChange={(value) => {
                  analytics.track("Review:Settings:CommentLocation", {
                    location: value as CommentLocation,
                  });
                  onCommentLocationChange?.(value as CommentLocation);
                }}
              >
                <MenuRadioItem value="hybrid">
                  {t("common.hybrid")}
                </MenuRadioItem>
                <MenuRadioItem value="inline">
                  {t("common.inline")}
                </MenuRadioItem>
                <MenuRadioItem value="floating">
                  {t("common.floating")}
                </MenuRadioItem>
              </MenuRadioGroup>
            </MenuGroup>
            <MenuSeparator />
          </>
        )}
        <MenuGroup>
          <MenuGroupLabel>{t("common.comments")}</MenuGroupLabel>
          <MenuCheckboxItem
            checked={hideCommentBoxes}
            onCheckedChange={(checked) => {
              analytics.track("Review:Settings:HideCommentBoxes", {
                hide: checked,
              });
              setHideCommentBoxes(checked);
            }}
          >
            {t("common.hideHighlights")}
          </MenuCheckboxItem>
        </MenuGroup>
        <MenuSeparator />
        <MenuGroup>
          <MenuGroupLabel>{t("sidebar.files")}</MenuGroupLabel>
          <MenuItem onClick={onExpandAll}>{t("common.expand")}</MenuItem>
          <MenuItem onClick={onCollapseAll}>{t("common.collapse")}</MenuItem>
        </MenuGroup>
      </MenuContent>
    </Menu>
  );
}

interface PRSectionsProps {
  owner: string;
  repo: string;
  prNumber: string;
  prPath: string;
  jobId: string | null;
  sections: NormalizedSection[];
  fileContentsAtBase?: Record<string, FileContentAtBase>;
  fileContentsAtHead: Record<string, string>;
  lifeguardResult?: LifeguardResult;
  items: NormalizedSection[];
  overview?: NormalizedSection;
  commentsByFile: Map<string, LineComment[]>;
  allChangesInFileMap: Map<string, Change[]>;
  commentRenderers: CommentRendererMap;
  commentLocation: CommentLocation;
  onCommentLocationChange?: (location: CommentLocation) => void;
  pullRequestId?: string;
  mergeBaseSha?: string;
  headSha?: string;
  onChatWithSelection?: () => void;
  onLaunchJob?: () => Promise<void>;
}

interface SectionListProps {
  owner: string;
  repo: string;
  prNumber: string;
  prPath: string;
  isGitHubLoaded: boolean;
  githubData: ReturnType<typeof usePRGitHub>["data"];
  items: NormalizedSection[];
  overview?: NormalizedSection;
  scrollToSection: (index: number) => void;
  scrollToFile: (sectionIndex: number, filePath: string) => void;
  lifeguardResult?: LifeguardResult;
  commentsByFile?: Map<string, LineComment[]>;
  allChangesInFileMap?: Map<string, Change[]>;
  // Job progress tracking
  isJobRunning?: boolean;
  isErrored?: boolean;
  errorMessage?: string | null;
  showAnalysisProgress?: boolean;
  isLifeguardOutdated?: boolean;
  onLaunchJob?: () => Promise<void>;
  hideCIInfo?: boolean;
  _currentUsername?: string;
  jobId?: string;
  cannotInteractWithGitHub?: boolean;
  lifeguardProgressOverride?: LifeguardProgress | null;
  onViewResults?: () => void;
  erroredTasks?: string[] | null;

  // Chat tab
  chat?: ReturnType<typeof useAgentChat>;

  /** Devin session ID associated with this PR (passed to autofix button) */
  devinId?: string | null;
}

export const PRSidebar: React.FC<SectionListProps> = ({
  owner,
  repo,
  prNumber,
  prPath,
  jobId,
  isGitHubLoaded,
  githubData,
  items,
  overview,
  scrollToSection,
  scrollToFile,
  lifeguardResult,
  commentsByFile,
  allChangesInFileMap,
  isJobRunning = false,
  isErrored = false,
  errorMessage,
  showAnalysisProgress = false,
  isLifeguardOutdated = false,
  onLaunchJob,
  hideCIInfo = false,
  _currentUsername,
  cannotInteractWithGitHub,
  lifeguardProgressOverride,
  onViewResults,
  erroredTasks,
  chat,
  devinId,
}) => {
  const { t } = useTranslation("review");
  // Prefetch assignable users and labels on page load (not just when Info tab is opened)
  // This ensures instant response when user opens the Add Reviewer/Assignee/Label popovers

  useAssignableUsers({ owner, repo, prPath, query: "" });
  useRepoLabels({ owner, repo, prPath, query: "" });

  const effectiveLifeguardResult = useEffectiveLifeguardResult(lifeguardResult);
  const { isDiffOnly, eligibility } = usePRContext();
  const { isMobile } = useIsMobile();
  const mobileSidebar = useMobileSidebar();

  const handleNavigateToFinding = useCallback(() => {
    if (isMobile) {
      mobileSidebar.close();
    }
  }, [isMobile, mobileSidebar]);

  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    () => new Set()
  );

  // Compute if overlay should be shown (when any floating card is active and in view)
  // This hook is optimized to only re-render when the boolean result changes
  const shouldShowOverlay = useShouldShowOverlay();
  const deactivateAll = useCommentActivationStore(
    (state) => state.deactivateAll
  );

  // Track sidebar left edge position for horizontal overlap detection
  const sidebarRef = useRef<HTMLDivElement>(null);
  const setSidebarLeft = useFloatingCardOverlayStore((s) => s.setSidebarLeft);
  const sidebarCallbackRef = useCallback(
    (node: HTMLDivElement | null) => {
      sidebarRef.current = node;
      if (node) {
        setSidebarLeft(node.getBoundingClientRect().left);
      }
    },
    [setSidebarLeft]
  );
  useEffect(() => {
    const el = sidebarRef.current;
    if (!el) return;

    const updateLeft = () => {
      setSidebarLeft(el.getBoundingClientRect().left);
    };

    const observer = new ResizeObserver(updateLeft);
    observer.observe(el);
    window.addEventListener("resize", updateLeft);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateLeft);
    };
  }, [setSidebarLeft]);

  // Poll for lifeguard progress when job is running
  const shouldPollLifeguard =
    isJobRunning && jobId !== undefined && !lifeguardProgressOverride;

  const lifeguardProgressQuery = useQuery({
    queryKey: ["lifeguard-progress", prPath, jobId],
    queryFn: () => getLifeguardProgress(prPath, jobId!),
    enabled: shouldPollLifeguard && !!jobId && !!prPath,
    refetchInterval: 1000,
    staleTime: 500,
    retry: false,
  });

  // Only use progress data if lifeguard has actually started
  // Use override if provided (for unauthed jobs), otherwise use query result
  const lifeguardProgress =
    lifeguardProgressOverride !== undefined
      ? lifeguardProgressOverride
      : lifeguardProgressQuery.data?.status !== "not_started"
        ? (lifeguardProgressQuery.data ?? null)
        : null;
  // Compute file occurrence counts and indices across all sections for sidebar display
  const { fileOccurrenceCounts, sidebarFileOccurrenceIndices } = useMemo(() => {
    const counts = new Map<string, number>();
    const indices = new Map<string, number>(); // key: "sectionIndex:filePath" -> occurrence index
    const counters = new Map<string, number>();

    for (let sectionIdx = 0; sectionIdx < items.length; sectionIdx++) {
      const section = items[sectionIdx];
      const actualSectionIndex = overview ? sectionIdx + 1 : sectionIdx;
      const stats = getFileStats(section.changes);
      const files = Object.keys(stats);

      for (const filePath of files) {
        counts.set(filePath, (counts.get(filePath) || 0) + 1);
        const currentCount = counters.get(filePath) || 0;
        indices.set(`${actualSectionIndex}:${filePath}`, currentCount + 1);
        counters.set(filePath, currentCount + 1);
      }
    }
    return {
      fileOccurrenceCounts: counts,
      sidebarFileOccurrenceIndices: indices,
    };
  }, [items, overview]);
  const [showHighlight, setShowHighlight] = useState(false);
  // Sidebar tab state via atoms (avoids prop drilling)
  const [sidebarTab, setSidebarTab] = useSidebarTab();
  const highlightedTab = useHighlightedTabValue();
  const { enterpriseId } = useAuth();
  const userOrgEnterpriseBillingEnabled = useUserOrgEnterpriseBillingEnabled();

  // Trigger highlight animation when highlightedTab changes
  useEffect(() => {
    if (highlightedTab === "analysis") {
      setShowHighlight(true);
      const timer = setTimeout(() => setShowHighlight(false), 2000);
      return () => clearTimeout(timer);
    } else {
      setShowHighlight(false);
    }
  }, [highlightedTab]);

  const toggleExpanded = useCallback(
    (sectionIndex: number, e: React.MouseEvent) => {
      e.stopPropagation();
      setExpandedSections((prev) => {
        const next = new Set(prev);
        if (next.has(sectionIndex)) {
          next.delete(sectionIndex);
        } else {
          next.add(sectionIndex);
        }
        return next;
      });
    },
    []
  );

  const jobStatusCard = isErrored ? (
    <JobErrorCard onRetry={onLaunchJob} errorMessage={errorMessage} />
  ) : (
    <JobProgressCard
      isJobRunning={isJobRunning}
      lifeguardProgress={lifeguardProgress}
      onViewResults={onViewResults}
    />
  );

  const maybeJobStatus = (isErrored ||
    (!isDiffOnly && showAnalysisProgress)) && (
    <div className="flex flex-col bg-bg-page p-2">{jobStatusCard}</div>
  );

  return (
    <div ref={sidebarCallbackRef} className="h-full">
      <TabsRoot
        defaultValue={SHOW_ANALYSIS_IN_SIDEBAR ? "info" : "analysis"}
        value={sidebarTab}
        onValueChange={(value: string) => setSidebarTab?.(value as SidebarTab)}
        className="h-full"
      >
        <div className="flex min-h-11 items-center justify-between border-b border-border-secondary p-2">
          <TabsList>
            {!SHOW_ANALYSIS_IN_SIDEBAR && !isDiffOnly && (
              <Tab
                value="analysis"
                className={showHighlight ? "animate-pulse" : ""}
              >
                {t("tabs.analysis")}
              </Tab>
            )}
            <Tab value="info" className="flex items-center gap-1">
              {t("tabs.info")}
            </Tab>
            <Tab value="chat">{t("tabs.chat")}</Tab>
          </TabsList>
          {sidebarTab === "chat" &&
            enterpriseId &&
            userOrgEnterpriseBillingEnabled && (
              <Tooltip content={t("agent.chatBillingTooltip")}>
                <IconCircleInfo
                  size={14}
                  className="mr-1 text-text-secondary"
                />
              </Tooltip>
            )}
        </div>

        {/* Overlay for active floating cards - click to dismiss */}
        <AnimatePresence>
          {shouldShowOverlay && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.8 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1, ease: "easeInOut" }}
              className="absolute inset-0 z-[52] bg-bg-page"
              onClick={deactivateAll}
              aria-label="Close comment"
            />
          )}
        </AnimatePresence>

        <TabsPanel value="info" className="relative h-full min-h-0 flex-1">
          <div
            data-sidebar-scroll-container
            className="relative h-full overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:none]"
          >
            {!isErrored && <DiffOnlyUpsell />}
            {SHOW_ANALYSIS_IN_SIDEBAR &&
              (!isDiffOnly || isErrored || lifeguardResult) && (
                <div className="flex flex-col gap-[6px] p-[6px]">
                  {isErrored ? (
                    jobStatusCard
                  ) : (
                    <>
                      {showAnalysisProgress && !isDiffOnly && (
                        <div className="flex max-h-80 flex-col">
                          {jobStatusCard}
                        </div>
                      )}
                      <LifeguardFindingsSection
                        bugs={lifeguardResult?.bugs}
                        analyses={lifeguardResult?.analyses}
                        securityFindings={lifeguardResult?.security_findings}
                        highlightBugsCard={showHighlight}
                        comparisonResults={lifeguardResult?.comparison_results}
                        isErrored={erroredTasks?.includes("lifeguard")}
                        isOutdated={isLifeguardOutdated}
                        onNavigateToFinding={handleNavigateToFinding}
                        isLoading={isJobRunning}
                        allChangesInFileMap={allChangesInFileMap}
                      />
                    </>
                  )}
                </div>
              )}
            {!hideCIInfo && (
              <CIInfoSidebar
                data={githubData}
                isLoading={!isGitHubLoaded}
                owner={owner}
                repo={repo}
                prNumber={prNumber}
                prPath={prPath}
                cannotInteractWithGitHub={cannotInteractWithGitHub}
                devinId={devinId}
                bugs={lifeguardResult?.bugs}
              />
            )}
            {/* This is here so users can scroll text up from behind AI chat */}
            <div className="h-64"></div>
          </div>
        </TabsPanel>
        {!SHOW_ANALYSIS_IN_SIDEBAR && (
          <TabsPanel
            value="analysis"
            className="relative h-full min-h-0 flex-1"
          >
            {showAnalysisProgress && maybeJobStatus ? (
              <div className="relative flex h-full min-h-0 flex-col">
                {maybeJobStatus}
              </div>
            ) : (
              <div className="relative h-full overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:none]">
                <div className="flex flex-col pb-32">
                  {/* Lifeguard findings (bugs + suggestions) */}
                  {isErrored ? (
                    maybeJobStatus
                  ) : (
                    <div className="p-2">
                      <LifeguardFindingsSection
                        bugs={lifeguardResult?.bugs}
                        analyses={lifeguardResult?.analyses}
                        securityFindings={lifeguardResult?.security_findings}
                        highlightBugsCard={showHighlight}
                        comparisonResults={lifeguardResult?.comparison_results}
                        isErrored={erroredTasks?.includes("lifeguard")}
                        isOutdated={isLifeguardOutdated}
                        onNavigateToFinding={handleNavigateToFinding}
                        isLoading={isJobRunning}
                        allChangesInFileMap={allChangesInFileMap}
                      />
                    </div>
                  )}
                  {/* Only show Changes in PR section when not showing analysis progress */}
                  {!showAnalysisProgress && !isErrored && (
                    <>
                      <h2 className="flex items-center gap-2 px-5 pb-3 pt-5 text-15 font-medium text-text-primary">
                        {t("sidebar.changesInPR")}
                        {erroredTasks?.includes("groups") && (
                          <Tooltip content={t("errors.failedToGroupFiles")}>
                            <IconExclamationTriangle className="size-4 text-text-orange" />
                          </Tooltip>
                        )}
                      </h2>
                      {/* Outline sections */}
                      {items.map((section, idx) => {
                        const i = overview ? idx + 1 : idx;
                        return (
                          <SectionCard
                            key={i}
                            section={section}
                            sectionIndex={i}
                            isExpanded={expandedSections.has(i)}
                            onToggleExpanded={(e) => toggleExpanded(i, e)}
                            scrollToSection={scrollToSection}
                            scrollToFile={scrollToFile}
                            lifeguardResult={effectiveLifeguardResult}
                            commentsByFile={commentsByFile}
                            fileOccurrenceCounts={fileOccurrenceCounts}
                            sidebarFileOccurrenceIndices={
                              sidebarFileOccurrenceIndices
                            }
                            isLast={idx === items.length - 1}
                          />
                        );
                      })}
                    </>
                  )}
                </div>
                {/* This is here so users can scroll text up from behind AI chat */}
                <div className="h-64"></div>
              </div>
            )}
          </TabsPanel>
        )}
        <TabsPanel value="chat" className="relative h-full min-h-0 flex-1">
          {chat && <SidebarChat chat={chat} />}
          {/* Chat bills to the job's billing org, so gate on the job-aware
              chat eligibility when present. */}
          {eligibility && !(eligibility.chat ?? eligibility).eligible && (
            <ChatAcuUpsell />
          )}
        </TabsPanel>
      </TabsRoot>
    </div>
  );
};

const PRSectionsInner = ({
  sections,
  fileContentsAtBase,
  fileContentsAtHead,
  prPath,
  jobId,
  lifeguardResult,
  items,
  overview,
  commentRenderers,
  commentsByFile,
  allChangesInFileMap,
  commentLocation = "inline",
  onCommentLocationChange,
  owner,
  repo,
  pullRequestId: _pullRequestId,
  mergeBaseSha,
  headSha,
  onChatWithSelection,
}: PRSectionsProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // The pinned top-right controls (lines-left + diff settings) overlay the
  // sticky section headers. When a header pins, its progress button slides left
  // to clear them. The controls sit flush against the container's right edge,
  // but the header (and its button) are inset from that edge by the section
  // column's right padding plus the header's own 8px padding, so the button
  // only overlaps the controls by `controlsWidth - buttonInset`. Track that
  // overlap plus a small gap, floored at 0, and pass it to each header. It
  // stays 0 in contexts that never render the controls (e.g. the embedded
  // review, which has no pinned controls to dodge).
  const pinnedControlsRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<HTMLDivElement>(null);
  const [pinnedShift, setPinnedShift] = useState(0);

  useEffect(() => {
    const controls = pinnedControlsRef.current;
    const sections = sectionsRef.current;
    if (!controls || !sections) return;
    const update = () => {
      const sectionsPaddingRight =
        parseFloat(getComputedStyle(sections).paddingRight) || 0;
      const buttonInset = sectionsPaddingRight + 8;
      const gap = 8;
      setPinnedShift(Math.max(0, controls.offsetWidth + gap - buttonInset));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(controls);
    observer.observe(sections);
    return () => observer.disconnect();
  }, []);

  const effectiveResult = useEffectiveLifeguardResult(lifeguardResult);
  const effectiveLifeguardBugs = effectiveResult?.bugs ?? [];
  const { isDiffOnly: isDiffOnlySections } = usePRContext();

  // Compute file occurrence counts and indices across all sections
  const { fileOccurrenceCounts, fileOccurrenceIndices } = useMemo(() => {
    const counts = new Map<string, number>();
    const indices = new Map<string, number>();
    const counters = new Map<string, number>();
    const hasOverview = items.length > 0 && sections[0]?.changes.length === 0;

    for (let sectionIdx = 0; sectionIdx < items.length; sectionIdx++) {
      const section = items[sectionIdx];
      const actualSectionIndex = hasOverview ? sectionIdx + 1 : sectionIdx;
      for (let fileIdx = 0; fileIdx < section.changes.length; fileIdx++) {
        const filePath = section.changes[fileIdx].file_path;
        counts.set(filePath, (counts.get(filePath) || 0) + 1);
        const currentCount = counters.get(filePath) || 0;
        indices.set(`${actualSectionIndex}:${fileIdx}`, currentCount + 1);
        counters.set(filePath, currentCount + 1);
      }
    }
    return { fileOccurrenceCounts: counts, fileOccurrenceIndices: indices };
  }, [items, sections]);

  useViewedFilesSync(prPath, jobId, sections, headSha);

  // Get collapseAll and expandAll actions from store
  const collapseAll = useFileDiffStateStore((state) => state.collapseAll);
  const expandAll = useFileDiffStateStore((state) => state.expandAll);

  // Compute all file keys (for collapse/expand all) and per-file line counts (for review progress)
  const { allFileKeys, fileLineCounts } = useMemo(() => {
    const keys: string[] = [];
    const counts = new Map<string, number>();
    const hasOverview = items.length > 0 && sections[0]?.changes.length === 0;
    for (let sectionIdx = 0; sectionIdx < items.length; sectionIdx++) {
      const section = items[sectionIdx];
      const actualSectionIndex = hasOverview ? sectionIdx + 1 : sectionIdx;
      for (const fc of section.changes) {
        const key = `${actualSectionIndex}:${fc.file_path}`;
        keys.push(key);
        counts.set(key, getFileChangeTotalLines(fc));
      }
    }
    return { allFileKeys: keys, fileLineCounts: counts };
  }, [items, sections]);

  const handleCollapseAll = useCallback(() => {
    collapseAll(allFileKeys);
  }, [collapseAll, allFileKeys]);

  const handleExpandAll = useCallback(() => {
    expandAll(allFileKeys);
  }, [expandAll, allFileKeys]);

  const { openNewComment } = useGithubCommentActions();
  const cannotInteractWithGitHub = useGithubCommentStore(
    (state) => state.cannotInteractWithGitHub
  );

  // Ref for selection tooltip- using ref + imperative handle to avoid re-renders
  const selectionTooltipRef = useRef<SelectionTooltipHandle>(null);

  const addMention = useAskDevinPanelStore((state) => state.addMention);

  // Set up gutter selection for multi-line comment selection
  useGutterSelection();

  // Track text selection in diff for Cmd+I mentions
  useEffect(() => {
    // Helper to get start/end elements from the current selection
    const getSelectionElements = (): {
      startElement: Element;
      endElement: Element;
      fileContainer: Element;
      startLine: Element | null;
      endLine: Element | null;
      filePath: string;
    } | null => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) {
        return null;
      }

      const range = selection.getRangeAt(0);
      const endRange = selection.getRangeAt(selection.rangeCount - 1);
      const startNode = range.startContainer;
      const endNode = endRange.endContainer;

      // Get the element (handle text nodes)
      const startElement =
        startNode.nodeType === Node.TEXT_NODE
          ? startNode.parentElement
          : (startNode as Element);
      const endElement =
        endNode.nodeType === Node.TEXT_NODE
          ? endNode.parentElement
          : (endNode as Element);

      if (!startElement || !endElement) {
        return null;
      }

      // Get file path from parent - this also validates we're in a diff
      const fileContainer = startElement.closest("[data-file-path]");
      if (!fileContainer) {
        return null;
      }

      // Verify endElement is in the same file container (cross-file selection is invalid)
      const endFileContainer = endElement.closest("[data-file-path]");
      if (endFileContainer !== fileContainer) {
        return null;
      }

      const filePath = fileContainer.getAttribute("data-file-path");
      if (!filePath) {
        return null;
      }

      // Get line info from the line elements
      const startLine = startElement.closest(
        "[data-before-line], [data-after-line], [data-next-before-line], [data-next-after-line]"
      );
      let endLine = endElement.closest(
        "[data-before-line], [data-after-line], [data-prev-before-line], [data-prev-after-line]"
      );
      // Firefox: if selection ends on <tr>, search within it for the line element
      // Use the same data attribute type as startLine to stay on the same side
      if (!endLine && startLine) {
        const dataAttr =
          startLine.hasAttribute("data-after-line") ||
          startLine.hasAttribute("data-next-after-line") ||
          startLine.hasAttribute("data-prev-after-line")
            ? "[data-after-line], [data-prev-after-line]"
            : "[data-before-line], [data-prev-before-line]";
        endLine = endElement.querySelector(dataAttr);
      }

      return {
        startElement,
        endElement,
        startLine,
        endLine,
        fileContainer,
        filePath,
      };
    };

    const handleSelectionChange = () => {
      const elements = getSelectionElements();
      if (!elements) {
        selectedDiffRef.current = null;
        // Keep tooltip visible if it's showing for a gutter selection
        if (!useGutterSelectionStore.getState().selection) {
          selectionTooltipRef.current?.hide();
        }
        return;
      }

      const { startLine, endLine, fileContainer, filePath } = elements;

      if (!startLine || !endLine) {
        selectedDiffRef.current = null;
        if (!useGutterSelectionStore.getState().selection) {
          selectionTooltipRef.current?.hide();
        }
        return;
      }

      // Determine side and line numbers
      // For empty rows, fall back to prev/next line attributes
      const startBeforeLine =
        startLine.getAttribute("data-before-line") ||
        startLine.getAttribute("data-next-before-line");
      const startAfterLine =
        startLine.getAttribute("data-after-line") ||
        startLine.getAttribute("data-next-after-line");
      const endBeforeLine =
        endLine.getAttribute("data-before-line") ||
        endLine.getAttribute("data-prev-before-line");
      const endAfterLine =
        endLine.getAttribute("data-after-line") ||
        endLine.getAttribute("data-prev-after-line");

      // Prefer after (RIGHT) side, fall back to before (LEFT)
      let side: "LEFT" | "RIGHT";
      let startLineNum: number;
      let endLineNum: number;

      if (startAfterLine && endAfterLine) {
        side = "RIGHT";
        startLineNum = parseInt(startAfterLine, 10);
        endLineNum = parseInt(endAfterLine, 10);
      } else if (startBeforeLine && endBeforeLine) {
        side = "LEFT";
        startLineNum = parseInt(startBeforeLine, 10);
        endLineNum = parseInt(endBeforeLine, 10);
      } else {
        selectedDiffRef.current = null;
        selectionTooltipRef.current?.hide();
        return;
      }

      // Ensure start <= end
      if (startLineNum > endLineNum) {
        [startLineNum, endLineNum] = [endLineNum, startLineNum];
      }

      // Extract content from DOM by finding all selected line elements and getting their <code> content
      // Use a Map to deduplicate by line number (split view has nested elements with same data attr)
      const dataAttr = side === "LEFT" ? "data-before-line" : "data-after-line";
      const allLineElements = fileContainer.querySelectorAll(`[${dataAttr}]`);
      const lineContentMap = new Map<number, string>();

      for (const lineEl of allLineElements) {
        const lineNum = parseInt(lineEl.getAttribute(dataAttr) || "0", 10);
        if (
          lineNum >= startLineNum &&
          lineNum <= endLineNum &&
          !lineContentMap.has(lineNum)
        ) {
          // Find the <code> element within this line to get the actual code content
          const codeEl = lineEl.querySelector("code");
          if (codeEl) {
            lineContentMap.set(lineNum, codeEl.textContent || "");
          }
        }
      }

      // Convert map to array, sorted by line number
      const selectedLines = Array.from(lineContentMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, content]) => content);

      const content = selectedLines.join("\n").trim();

      if (!content) {
        selectedDiffRef.current = null;
        selectionTooltipRef.current?.hide();
        return;
      }

      selectedDiffRef.current = {
        type: "diff",
        id: `diff-${filePath}-${side}-${startLineNum}-${endLineNum}`,
        filePath,
        startLine: startLineNum,
        endLine: endLineNum,
        side,
        content,
      };
    };

    const handleScroll = () => {
      // Hide tooltip on scroll - selection position becomes stale
      selectionTooltipRef.current?.hide();
    };

    const getTooltipPosition = (): { x: number; y: number } | null => {
      const elements = getSelectionElements();
      if (!elements) return null;

      const { endLine } = elements;
      if (!endLine) return null;

      const lineRect = endLine.getBoundingClientRect();
      // const tooltipWidth = 120; // Approximate tooltip width
      const gap = 8;

      // // Try positioning to the right of the line element
      // const rightX = lineRect.right + gap;
      // const topY = lineRect.top;

      // // Check if tooltip would go outside viewport on the right
      // if (rightX + tooltipWidth <= window.innerWidth) {
      //   return { x: rightX, y: topY };
      // }

      // Fall back to positioning below the line element
      return { x: lineRect.left, y: lineRect.bottom + gap };
    };

    /**
     * Position the tooltip next to the "+" add-comment button for the last line
     * of the current gutter selection. The + button sits at the right edge of
     * the gutter (translate-x-1/2 on a w-5 button → right edge at gutter.right + 10px),
     * so we place the pill just past that.
     */
    const getGutterTooltipPosition = (): { x: number; y: number } | null => {
      const gutterSel = useGutterSelectionStore.getState().selection;
      if (!gutterSel) return null;

      const { filePath, side, sectionIndex } = gutterSel;
      const lastLine = Math.max(gutterSel.startLine, gutterSel.endLine);

      const sectionPrefix =
        sectionIndex != null ? `[data-section-index="${sectionIndex}"] ` : "";
      const fileContainer = document.querySelector(
        `${sectionPrefix}[data-file-path="${CSS.escape(filePath)}"]`
      );
      if (!fileContainer) return null;

      const gutterEl = fileContainer.querySelector(
        `[data-gutter-line="${lastLine}"][data-gutter-side="${side}"]`
      );
      if (!gutterEl) return null;

      const rect = gutterEl.getBoundingClientRect();
      // + button is w-5 (20px) with translate-x-1/2 at right:0 → extends ~10px past
      // gutter right edge. Add a small gap so the pill sits next to it.
      const plusButtonOffset = 18;
      return {
        x: rect.right + plusButtonOffset,
        y: rect.top + rect.height / 2 - 14, // roughly vertically center the ~28px pill
      };
    };

    const handleMouseUp = () => {
      // Small delay to let selectionchange fire first, and to let button-drag
      // handlers (gutter-button-drag-end / + button onClick) clear the gutter
      // selection before we check it. Those paths open a comment dialog and
      // should NOT show the pill.
      setTimeout(() => {
        if (selectedDiffRef.current) {
          const pos = getTooltipPosition();
          if (pos) {
            selectionTooltipRef.current?.show(pos);
          }
          return;
        }
        // Fall back to gutter selection (click/drag on line numbers)
        if (useGutterSelectionStore.getState().selection) {
          const pos = getGutterTooltipPosition();
          if (pos) {
            selectionTooltipRef.current?.show(pos);
          }
          return;
        }
        selectionTooltipRef.current?.hide();
      }, 10);
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("scroll", handleScroll, {
      capture: true,
      passive: true,
    });
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <FileVisibilityProvider items={items} hasOverview={!!overview}>
        <div className="pointer-events-none sticky top-0 z-30 flex h-0 justify-end bg-bg-page">
          <div
            ref={pinnedControlsRef}
            className="pointer-events-auto flex h-12 items-center gap-1.5 rounded-[6px] bg-bg-page px-2"
          >
            <ReviewLinesProgress fileLineCounts={fileLineCounts} />
            <DiffSettingsMenu
              commentLocation={commentLocation}
              onCommentLocationChange={onCommentLocationChange}
              onCollapseAll={handleCollapseAll}
              onExpandAll={handleExpandAll}
            />
          </div>
        </div>

        <div
          ref={sectionsRef}
          className={cn(
            "flex min-w-0 flex-col gap-16 space-y-8 overflow-visible px-1 sm:px-4",
            (commentLocation === "floating" || commentLocation === "hybrid") &&
              "pr-10 sm:pr-10"
          )}
        >
          {items.map((item, idx) => (
            <PRSectionDisplay
              hasOverview={!!overview}
              idx={idx}
              section={item}
              key={idx}
              pinnedShift={pinnedShift}
              fileContentsAtBase={fileContentsAtBase}
              fileContentsAtHead={fileContentsAtHead}
              allChangesInFileMap={allChangesInFileMap}
              commentsByFile={commentsByFile}
              commentRenderers={commentRenderers}
              lifeguardBugs={effectiveLifeguardBugs}
              commentLocation={commentLocation}
              owner={owner}
              repo={repo}
              prPath={prPath}
              mergeBaseSha={mergeBaseSha}
              headSha={headSha}
              fileOccurrenceCounts={fileOccurrenceCounts}
              fileOccurrenceIndices={fileOccurrenceIndices}
              onAddFileComment={
                cannotInteractWithGitHub
                  ? undefined
                  : (fileKey) => openNewComment(fileKey, "FILE")
              }
            />
          ))}
          {isDiffOnlySections && <DiffOnlyEndUpsell />}
          <EndPRFooter showChatCTA={!isDiffOnlySections} />
        </div>
      </FileVisibilityProvider>

      <SelectionTooltip
        ref={selectionTooltipRef}
        onAddToChat={() => {
          // Check text selection first, then fall back to gutter selection
          // (same priority as the Cmd+I handler in PRDetailPage)
          const selection =
            selectedDiffRef.current ?? getGutterSelectionMention();
          if (selection) {
            addMention(selection);
            selectedDiffRef.current = null;
            useGutterSelectionStore.getState().clearSelection();
          }
          selectionTooltipRef.current?.hide();
          window.getSelection()?.removeAllRanges();
          onChatWithSelection?.();
        }}
      />
    </div>
  );
};

PRSectionsInner.displayName = "PRSections";

interface PRSectionDisplayProps {
  section: NormalizedSection;
  hasOverview: boolean;
  idx: number;
  fileContentsAtBase: Record<string, FileContentAtBase> | undefined;
  fileContentsAtHead: Record<string, string>;
  allChangesInFileMap: Map<string, Change[]>;
  commentsByFile: Map<string, LineComment<unknown>[]>;
  commentRenderers: CommentRendererMap;
  lifeguardBugs: LifeguardBug[];
  commentLocation: CommentLocation;
  pinnedShift?: number;
  owner: string;
  repo: string;
  mergeBaseSha: string | undefined;
  headSha: string | undefined;
  fileOccurrenceCounts: Map<string, number>;
  fileOccurrenceIndices: Map<string, number>;
  isHomeExample?: boolean;
  onAddFileComment?: (filePath: string) => void;
  prPath?: string;
}

export const PRSectionDisplay = ({
  section,
  idx,
  hasOverview,
  fileContentsAtBase,
  fileContentsAtHead,
  allChangesInFileMap,
  commentsByFile,
  commentRenderers,
  lifeguardBugs,
  commentLocation,
  pinnedShift = 0,
  owner,
  repo,
  mergeBaseSha,
  headSha,
  fileOccurrenceCounts,
  fileOccurrenceIndices,
  isHomeExample,
  onAddFileComment,
  prPath,
}: PRSectionDisplayProps) => {
  const { t } = useTranslation("review");
  const i = hasOverview ? idx + 1 : idx;
  const sectionFiles = section.changes.map((c) => c.file_path);
  const { isDiffOnly } = usePRContext();

  const bg = "bg-bg-page";

  const titleWithoutSectionIndex = section.title.replace(/^\d+\.\s*/, "");
  const sectionNumber = section.title.match(/^(\d+)\./)?.[1];

  // Detect when this header is sticky-pinned so its progress button can shift
  // left to clear the pinned top-right controls (lines-left + diff settings)
  // that would otherwise overlap it. A zero-height sentinel sits just above the
  // header; shrinking the observer root's top by the sticky offset (+1px) puts
  // the intersection boundary right at the sticky line, so the sentinel leaves
  // the root exactly when the header pins. The extra 1px also covers navigating
  // a section to the scroll-root edge, where the sentinel lands on the line. A
  // non-intersecting sentinel only counts as pinned when it sits above the root
  // boundary, so below-the-fold sections aren't mistaken for pinned.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [isPinned, setIsPinned] = useState(false);
  // The first header sits under the controls even before anything pins (it's at
  // the very top of the scroll content), so it must always clear them.
  const shouldShift = isPinned || idx === 0;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const header = headerRef.current;
    if (isHomeExample || !sentinel || !header) return;
    const stickyTop = parseFloat(getComputedStyle(header).top) || 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // rootBounds is null when the observer root is the viewport; fall back
        // to the rootMargin inset, which is the effective top boundary there.
        const boundary = entry.rootBounds?.top ?? stickyTop + 1;
        setIsPinned(
          !entry.isIntersecting && entry.boundingClientRect.top <= boundary
        );
      },
      {
        root: getScrollParent(sentinel),
        rootMargin: `-${stickyTop + 1}px 0px 0px 0px`,
      }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isHomeExample]);

  return (
    <div data-section-index={i}>
      {!isHomeExample && <div ref={sentinelRef} aria-hidden className="h-0" />}
      <div
        ref={headerRef}
        className={cn(
          bg,
          !isHomeExample && "sticky top-[var(--review-sticky-top,0px)]",
          // Fixed height so the sticky file header offset (--review-sticky-top + 3rem) always lines up.
          // Title truncates instead of wrapping; full text available via native title tooltip.
          "z-20 flex h-12 items-center justify-between gap-2 p-2"
        )}
      >
        {isDiffOnly ? (
          <h1 className="truncate text-17 font-medium text-text-primary">
            {t("sidebar.changes")}
          </h1>
        ) : (
          <>
            <h1
              className="min-w-0 flex-1 truncate text-17 font-medium text-text-primary"
              title={titleWithoutSectionIndex.replace(/`/g, "")}
              style={
                shouldShift ? { marginRight: `${pinnedShift}px` } : undefined
              }
            >
              {sectionNumber !== undefined && (
                <span className="ml-px mr-1.5 inline-block h-6 w-6 rounded-md bg-tint-secondary text-center text-15">
                  {sectionNumber}
                </span>
              )}
              {renderTitleWithMarkdown(titleWithoutSectionIndex)}
            </h1>
            {/* Intentional deviation from this module's no-animation rule: the
                button springs left (compositor transform only) to clear the
                pinned controls. */}
            <motion.div
              className="shrink-0"
              initial={false}
              animate={{ x: shouldShift ? -pinnedShift : 0 }}
              transition={{ type: "spring", duration: 0.1, bounce: 0 }}
            >
              <ProgressCircle sectionFiles={sectionFiles} sectionIndex={i} />
            </motion.div>
          </>
        )}
      </div>
      <DiffViewer
        sectionIndex={i}
        section={section}
        fileContentsAtBase={fileContentsAtBase}
        fileContentsAtHead={fileContentsAtHead}
        allChangesInFileMap={allChangesInFileMap}
        commentsByFile={commentsByFile}
        commentRenderers={commentRenderers}
        lifeguardBugs={lifeguardBugs}
        commentLocation={commentLocation}
        prPath={prPath}
        owner={owner}
        repo={repo}
        mergeBaseSha={mergeBaseSha}
        headSha={headSha}
        fileOccurrenceCounts={fileOccurrenceCounts}
        fileOccurrenceIndices={fileOccurrenceIndices}
        isHomeExample={isHomeExample}
        onAddFileComment={onAddFileComment}
      />
    </div>
  );
};

function ReviewLinesProgress({
  fileLineCounts,
}: {
  fileLineCounts: Map<string, number>;
}) {
  const { t } = useTranslation("review");
  const viewedFiles = useFileDiffStateStore((store) => store.viewedFiles);

  let totalLines = 0;
  let viewedLines = 0;
  for (const [key, lines] of fileLineCounts) {
    totalLines += lines;
    if (viewedFiles.has(key)) {
      viewedLines += lines;
    }
  }

  const remainingLines = totalLines - viewedLines;

  if (totalLines === 0) return null;

  return (
    <Tooltip
      content={t("sidebar.linesReviewed", {
        viewed: viewedLines.toLocaleString(),
        total: totalLines.toLocaleString(),
      })}
    >
      <span
        className={cn(
          "whitespace-nowrap text-12 tabular-nums",
          remainingLines === 0 ? "text-text-green" : "text-text-secondary"
        )}
      >
        {remainingLines === 0
          ? t("sidebar.allLinesReviewed")
          : t("sidebar.linesLeft", {
              count: remainingLines,
              formatted: remainingLines.toLocaleString(),
            })}
      </span>
    </Tooltip>
  );
}

function ProgressCircle({
  sectionFiles,
  sectionIndex,
}: {
  sectionFiles: string[];
  sectionIndex: number;
}) {
  const { t } = useTranslation("review");
  const viewedFiles = useFileDiffStateStore((store) => store.viewedFiles);
  const setFilesViewed = useFileDiffStateStore((store) => store.setFilesViewed);

  const fileKeys = useMemo(
    () => sectionFiles.map((f) => `${sectionIndex}:${f}`),
    [sectionFiles, sectionIndex]
  );

  const viewedCount = fileKeys.filter((k) => viewedFiles.has(k)).length;
  const totalFiles = fileKeys.length;
  const progress = totalFiles > 0 ? viewedCount / totalFiles : 0;
  const allViewed = totalFiles > 0 && viewedCount === totalFiles;

  const handleClick = useCallback(() => {
    setFilesViewed(fileKeys, !allViewed);
  }, [setFilesViewed, fileKeys, allViewed]);

  if (totalFiles === 0) return;

  return (
    <Tooltip
      content={
        allViewed ? t("sidebar.markAllUnviewed") : t("sidebar.markAllViewed")
      }
    >
      <button
        type="button"
        onClick={handleClick}
        aria-label={
          allViewed ? t("sidebar.markAllUnviewed") : t("sidebar.markAllViewed")
        }
        className="-m-1 flex shrink-0 items-center gap-2 rounded-md p-1 hover:bg-tint-secondary"
      >
        <CircleProgress progress={progress} />
        <span
          className={`text-13 tabular-nums ${progress === 1 ? "text-text-green" : "text-text-secondary"}`}
        >
          {viewedCount} / {totalFiles}
        </span>
      </button>
    </Tooltip>
  );
}

export const PRSections = (props: PRSectionsProps) => {
  const { t } = useTranslation("review");
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    if (props.onLaunchJob) {
      setIsRetrying(true);
      await props.onLaunchJob();
      setIsRetrying(false);
    }
  };

  return (
    <ErrorBoundary
      fallback={
        <PRSectionsError
          onRetry={handleRetry}
          errorMessage={t("errors.prMalformed")}
          isRetrying={isRetrying}
        />
      }
    >
      <PRSectionsInner {...props} />
    </ErrorBoundary>
  );
};

export function FileVisibilityProvider({
  items,
  hasOverview,
  children,
}: {
  items: NormalizedSection[];
  hasOverview: boolean;
  children: ReactNode;
}) {
  const fileVisibility = useGlobalFileVisibility(items, hasOverview);

  return (
    <FileVisibilityContext.Provider value={fileVisibility}>
      {children}
    </FileVisibilityContext.Provider>
  );
}
