import { Tooltip } from "#/ds-deps/tooltip";
import { IconButton, TextButton } from "#/ds/button";
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
  menuItemBaseClasses,
} from "#/ds/menu";
import { Tab, TabBadge, TabsList, TabsPanel, TabsRoot } from "#/ds/tabs";
import { IconArrowRotateRightLeft } from "central-icons-stroke/IconArrowRotateRightLeft";
import { IconCircleInfo } from "central-icons-stroke/IconCircleInfo";
import { IconSettingsSliderVer } from "central-icons-stroke/IconSettingsSliderVer";
import { type ReactNode, type RefObject, useState } from "react";
import { useTranslation } from "react-i18next";
import { analytics } from "@/lib/analytics";
import { cn } from "@/utils/cn";
import { usePRReviewRoute } from "../contexts/prReviewRouteContext";
import { usePRBasicInfo } from "../hooks/usePRBasicInfo";
import { usePRGitHub } from "../hooks/usePRGitHub";
import { usePRGithubInteractivity } from "../hooks/usePRGithubInteractivity";
import { usePRPrMeta } from "../hooks/usePRPrMeta";
import type { JobSummary } from "../queries/prReviewJobs";
import { CommitsList, CommitsListSkeleton } from "./CommitsList";
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
  useSplitViewDisabled,
  useViewMode,
} from "./DiffViewer/contexts/ViewModeContext";
import { PRDescription } from "./PRDescription";
import { PRDiscussion } from "./PRDiscussion";
import { PRDiscussionSkeleton } from "./PRDiscussionSkeleton";
import { TabCountBadge } from "./TabCountBadge";
import {
  ToolbarActionPortal,
  ToolbarActionProvider,
  ToolbarActionSlot,
} from "./ToolbarActionPortal";

const VIEW_MODE_OPTIONS_KEYS = [
  { value: "split", labelKey: "common.splitView" },
  { value: "unified", labelKey: "common.unifiedView" },
] as const;

/**
 * Split view can't render on a narrow panel, so the option is shown as a
 * disabled row with a trailing info icon. The tooltip is anchored to the icon
 * (centered above it) but opens on hover of the whole row.
 */
function DisabledSplitViewItem({
  label,
  hint,
}: {
  label: string;
  hint: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={cn(menuItemBaseClasses, "cursor-default text-text-secondary")}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
    >
      <span className="mr-auto">{label}</span>
      <Tooltip content={hint} side="top" open={open} onOpenChange={setOpen}>
        <span className="flex items-center">
          <IconCircleInfo className="size-3.5 shrink-0" />
        </span>
      </Tooltip>
    </div>
  );
}

function DiffSettingsMenu() {
  const { t } = useTranslation("review");
  const viewMode = useViewMode();
  const setViewMode = useSetViewMode();
  const splitViewDisabled = useSplitViewDisabled();
  const hideCommentBoxes = useHideCommentBoxes();
  const setHideCommentBoxes = useSetHideCommentBoxes();
  const hideWhitespace = useHideWhitespace();
  const setHideWhitespace = useSetHideWhitespace();

  return (
    <Menu>
      <Tooltip content={t("common.codeDiffSettings")}>
        <MenuTrigger>
          <IconButton
            variant="ghost"
            size="sm"
            aria-label={t("common.diffSettings")}
          >
            <IconSettingsSliderVer className="size-4" />
          </IconButton>
        </MenuTrigger>
      </Tooltip>
      <MenuContent align="end">
        <MenuGroup>
          <MenuGroupLabel>{t("common.diffView")}</MenuGroupLabel>
          <MenuRadioGroup
            value={viewMode}
            onValueChange={(value) => {
              analytics.track("Review:Settings:DiffMode", {
                mode: value as "split" | "unified",
              });
              setViewMode(value as "split" | "unified");
            }}
          >
            {VIEW_MODE_OPTIONS_KEYS.map((option) => {
              if (option.value === "split" && splitViewDisabled) {
                return (
                  <DisabledSplitViewItem
                    key={option.value}
                    label={t(option.labelKey)}
                    hint={t("common.splitViewTooNarrow")}
                  />
                );
              }
              return (
                <MenuRadioItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </MenuRadioItem>
              );
            })}
          </MenuRadioGroup>
          <MenuSeparator />
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
      </MenuContent>
    </Menu>
  );
}

interface EmbeddedReviewTabsProps {
  activeTab: string;
  changeTab: (tab: string) => void;
  sectionTopRef: RefObject<HTMLDivElement | null>;
  scrollTabRowToTop: () => void;
  jobs: JobSummary[];
  currentJobId: string | null;
  newerJobAvailable: boolean;
  switchToNewerJob: () => void;
  hasNewerVersion: boolean;
  switchToLatestVersion: () => void;
  canEdit: boolean;
  overviewText?: string;
  isOverviewErrored?: boolean;
  hasNoJobs: boolean;
  diffTabContent: ReactNode;
  bugsContent: ReactNode;
  bugsCount?: number;
  commitsLaunchJob: (shouldSelectJob: boolean) => Promise<JobSummary>;
  commitsSelectJob: (jobId: string, options?: { isLatest?: boolean }) => void;
  isCommitsLoading: boolean;
  isWindsurfEmbedded?: boolean;
}

export function EmbeddedReviewTabs({
  activeTab,
  changeTab,
  sectionTopRef,
  scrollTabRowToTop,
  jobs,
  currentJobId,
  newerJobAvailable,
  switchToNewerJob,
  hasNewerVersion,
  switchToLatestVersion,
  canEdit,
  overviewText,
  isOverviewErrored,
  hasNoJobs,
  diffTabContent,
  bugsContent,
  bugsCount,
  commitsLaunchJob,
  commitsSelectJob,
  isCommitsLoading,
  isWindsurfEmbedded,
}: EmbeddedReviewTabsProps) {
  const { owner, repo, prNumber, prPath, host } = usePRReviewRoute();
  const { t } = useTranslation("review");
  const { data: githubData } = usePRGitHub({
    owner,
    repo,
    prNumber,
    prPath,
    host,
  });
  const { data: basicInfo } = usePRBasicInfo(
    {
      owner,
      repo,
      prNumber,
      prPath,
      host,
    },
    { hasLiveEventUpdates: !isWindsurfEmbedded }
  );
  const { data: prMeta } = usePRPrMeta(
    {
      owner,
      repo,
      prNumber,
      prPath,
      host,
    },
    { hasLiveEventUpdates: !isWindsurfEmbedded }
  );
  const { cannotInteractWithGitHub } = usePRGithubInteractivity();
  const isGitHubLoaded = !!githubData;
  const hasHeaderData = !!prMeta?.title || !!basicInfo || !!githubData;
  const descriptionBody = githubData?.body ?? basicInfo?.body ?? prMeta?.body;

  const handleTabClick = (value: string) => {
    if (activeTab === value) scrollTabRowToTop();
  };

  return (
    <ToolbarActionProvider>
      {/* shrink-0 grow basis-auto holds TabsRoot at content height so the sticky tab
          bar stays pinned through the whole diff; [overflow-anchor:none] stops the
          restored offset from drifting as the outgoing panel unmounts on switch. */}
      <TabsRoot
        value={activeTab}
        onValueChange={changeTab}
        className="min-h-full shrink-0 grow basis-auto [overflow-anchor:none]"
      >
        <div ref={sectionTopRef} className="h-0" />
        <div className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border-secondary bg-bg-page p-2">
          <TabsList>
            <Tab value="diff" onClick={() => handleTabClick("diff")}>
              {t("tabs.changes")}
            </Tab>
            <Tab value="bugs" onClick={() => handleTabClick("bugs")}>
              {t("tabs.bugs")}
              {bugsCount !== undefined && bugsCount !== 0 && (
                <TabBadge className="tabular-nums">{bugsCount}</TabBadge>
              )}
            </Tab>
            <Tab
              value="description"
              onClick={() => handleTabClick("description")}
            >
              {t("tabs.description")}
            </Tab>
            <Tab
              value="discussion"
              onClick={() => handleTabClick("discussion")}
            >
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
            <Tab value="commits" onClick={() => handleTabClick("commits")}>
              {t("tabs.commits")}
              <TabCountBadge
                isLoading={!isGitHubLoaded}
                count={githubData?.commits?.length ?? 0}
              />
            </Tab>
          </TabsList>
          {(newerJobAvailable || hasNewerVersion) &&
            (newerJobAvailable ? (
              <Tooltip content={t("headerActions.newChangesAvailable")}>
                <TextButton
                  variant="warning"
                  size="sm"
                  className="can-hover:brightness-[.88]"
                  onClick={switchToNewerJob}
                >
                  <IconArrowRotateRightLeft className="size-4" />
                  {t("headerActions.refresh")}
                </TextButton>
              </Tooltip>
            ) : (
              <Tooltip content={t("headerActions.newerVersionAvailable")}>
                <TextButton
                  variant="warning"
                  size="sm"
                  className="can-hover:brightness-[.88]"
                  onClick={switchToLatestVersion}
                >
                  <IconArrowRotateRightLeft className="size-4" />
                  {t("headerActions.newVersion")}
                </TextButton>
              </Tooltip>
            ))}
          <ToolbarActionSlot className="ml-auto mr-1.5 flex items-center gap-1.5" />
        </div>

        {activeTab === "diff" && (
          <ToolbarActionPortal>
            <DiffSettingsMenu />
          </ToolbarActionPortal>
        )}

        <TabsPanel value="description" className="px-2 pb-2">
          <PRDescription
            isLoading={!hasHeaderData}
            body={descriptionBody}
            owner={owner}
            repo={repo}
            prNumber={prNumber}
            prPath={prPath}
            canEdit={canEdit}
            overview={overviewText}
            isOverviewErrored={isOverviewErrored}
            hasNoJobs={hasNoJobs}
          />
        </TabsPanel>

        <TabsPanel value="discussion" keepMounted className="px-2 pb-2">
          {!isGitHubLoaded ? (
            <PRDiscussionSkeleton />
          ) : (
            <PRDiscussion
              comments={githubData?.comments?.nodes ?? []}
              reviews={githubData?.reviews?.nodes ?? []}
              cannotInteractWithGitHub={cannotInteractWithGitHub}
              onSwitchToTab={() => changeTab("discussion")}
              filterInToolbar
              isActive={activeTab === "discussion"}
            />
          )}
        </TabsPanel>

        <TabsPanel value="commits" className="p-2">
          {isCommitsLoading && jobs.length === 0 ? (
            <CommitsListSkeleton />
          ) : githubData?.commits ? (
            <CommitsList
              commits={githubData.commits}
              prPath={prPath}
              jobs={jobs}
              currentJobId={currentJobId}
              launchJob={commitsLaunchJob}
              selectJob={commitsSelectJob}
            />
          ) : (
            <CommitsListSkeleton />
          )}
        </TabsPanel>

        <TabsPanel value="bugs" className="p-2">
          {bugsContent}
        </TabsPanel>

        {/* --review-sticky-top offsets the sticky section/file headers below the pinned tab bar (h-12) */}
        <TabsPanel
          value="diff"
          keepMounted
          className="px-2 pb-2 [--review-sticky-top:3rem]"
        >
          {diffTabContent}
        </TabsPanel>
      </TabsRoot>
    </ToolbarActionProvider>
  );
}
