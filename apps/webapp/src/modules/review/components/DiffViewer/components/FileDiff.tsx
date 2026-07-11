/**
 * FileDiff - Component for rendering a complete file diff
 *
 * Features:
 * - File header with metadata
 * - Collapsible diff content
 * - Side-by-side (split) view
 * - Word-level diff highlighting for similar lines
 * - Dark mode optimized
 */
import { Button } from "#/ds/button";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import useEventCallback from "@/hooks/useEventCallback";
import { useRequestLazyFiles } from "@/modules/review/contexts/LazyFileContext";
import { usePRDigestScroll } from "@/modules/review/hooks/usePRDigestScroll";
import { fetchFileContent } from "@/modules/review/queries/fileContent";
import {
  type FileContentAtBase,
  LifeguardBug,
  isGeneratedLazyStub,
  isLazyStub,
  resolveFileContent,
} from "@/modules/review/queries/prReviewJobs";
import {
  useFileDiffActions,
  useIsFileCollapsed,
  useIsFileViewed,
} from "@/modules/review/stores/fileDiffStateStore";
import { isFileChangeDefaultHidden } from "@/modules/review/utils/largeDiff";
import { cn } from "@/utils/cn";
import { useScrollRegistry } from "../../../hooks/useScrollRegistry";
import { useViewMode } from "../contexts/ViewModeContext";
import { useDiffLines, useFileHighlight } from "../hooks";
import { useLinesAndStats } from "../hooks/useDiffLines";
import { useRefetchDroppedLazyBase } from "../hooks/useRefetchDroppedLazyBase";
import type {
  Change,
  CommentLocation,
  CommentRendererMap,
  DiffDisplayItem,
  FileChange,
  LineComment,
} from "../types";
import { isImageFile, isMarkdownFile } from "../utils/languageUtils";
import { CollapsedRegion } from "./CollapsedRegion";
import { FileHeader } from "./FileHeader";
import { ImageDiff } from "./ImageDiff";
import InlineReferenceDiff from "./InlineReferenceDiff";
import { MarkdownDiffViewer } from "./MarkdownDiffViewer";
import { FloatingCommentsContainer } from "./renderLines/RenderComments";
import {
  type DiffViewMode,
  RenderedDisplayItems,
} from "./renderLines/RenderDisplayItems";

export type { DiffViewMode };

interface FileDiffProps {
  /** Section index for building the file key */
  sectionIndex: number;
  fileChange: FileChange;
  allChangesInFile: Change[];
  fileUrl: string;
  commentLocation: CommentLocation;
  /** Full content of the file before changes (needed for expand regions) */
  beforeContent?: FileContentAtBase | null;
  /** Full content of the file after changes (reconstructed, for syntax highlighting) */
  afterContent?: string | null;
  /** Comments to render on specific lines */
  comments?: LineComment[];
  commentRenderers?: CommentRendererMap;
  /** Lifeguard bugs to display in file header */
  lifeguardBugs?: LifeguardBug[];
  expandedRegions: Set<string>;
  onExpandRegion: (regionKeys: string[]) => void;
  onExpandUpperRegionDownward?: (
    beforeStart: number,
    afterStart: number,
    lines: number
  ) => void;
  onExpandLowerRegionUpward?: (
    beforeStart: number,
    afterStart: number,
    lines: number
  ) => void;
  /** PR owner (for fetching images) */
  owner?: string;
  /** PR repo (for fetching images) */
  repo?: string;
  /** Merge base SHA (for fetching "before" images) */
  mergeBaseSha?: string;
  /** Head SHA (for fetching "after" images) */
  headSha?: string;
  /** Current occurrence index (1-based) when file appears multiple times */
  fileOccurrenceIndex?: number;
  /** Total number of occurrences when file appears multiple times */
  fileOccurrenceTotal?: number;
  isHomeExample?: boolean;
  /** Callback when "Add file-level comment" is clicked */
  onAddFileComment?: () => void;
  prPath?: string;
  host?: string;
}

export const FileDiff = memo(function FileDiff({
  sectionIndex,
  fileChange,
  allChangesInFile,
  fileUrl,
  beforeContent,
  afterContent,
  comments = [],
  commentRenderers = {},
  commentLocation = "inline",
  lifeguardBugs = [],
  expandedRegions,
  onExpandRegion,
  onExpandUpperRegionDownward,
  onExpandLowerRegionUpward,
  owner,
  repo,
  mergeBaseSha,
  headSha,
  fileOccurrenceIndex,
  fileOccurrenceTotal,
  isHomeExample,
  onAddFileComment,
  prPath,
  host,
}: FileDiffProps) {
  const { t } = useTranslation("review");
  const gitHost = host ?? "github.com";
  // Build the file key for store lookups
  const fileKey = `${sectionIndex}:${fileChange.file_path}`;

  // Use store selectors - only re-renders when THIS file's state changes
  const isViewed = useIsFileViewed(fileKey);
  const isCollapsed = useIsFileCollapsed(fileKey);
  const { toggleViewed, toggleCollapsed, expandFile } = useFileDiffActions();

  const requestLazyFiles = useRequestLazyFiles();

  const isDefaultHidden = useMemo(
    () => isFileChangeDefaultHidden(fileChange),
    [fileChange]
  );

  // Use beforeContent prop, fallback to display_info.before_content
  const effectiveBeforeContent =
    beforeContent ?? fileChange.display_info?.before_content ?? null;

  const contentIsLazy = isLazyStub(effectiveBeforeContent);
  const contentIsGenerated = isGeneratedLazyStub(effectiveBeforeContent);
  // Only gate generated/-diff files behind a placeholder; size-only stubs
  // still have diff hunks in the payload and should render immediately.
  const showLazyPlaceholder = contentIsGenerated && !isDefaultHidden;
  const [isLoadingLazy, setIsLoadingLazy] = useState(false);
  const [lazyLoadError, setLazyLoadError] = useState(false);

  // Render the parsed diff immediately for size-only lazy stubs; the full base
  // file is fetched only when a user action (expanding hidden context) needs
  // it. Generated stubs are still loaded via the explicit "Load diff" buttons.
  const ensureBaseContentForExpand = useCallback(() => {
    if (contentIsLazy && requestLazyFiles) {
      void requestLazyFiles([fileChange.file_path])?.catch(() => {});
    }
  }, [contentIsLazy, requestLazyFiles, fileChange.file_path]);

  useRefetchDroppedLazyBase(
    contentIsLazy,
    expandedRegions.size > 0,
    ensureBaseContentForExpand
  );

  const handleExpandRegion = useCallback(
    (regionKeys: string[]) => {
      ensureBaseContentForExpand();
      onExpandRegion(regionKeys);
    },
    [ensureBaseContentForExpand, onExpandRegion]
  );

  const handleExpandUpperRegionDownward = useMemo(
    () =>
      onExpandUpperRegionDownward
        ? (beforeStart: number, afterStart: number, lines: number) => {
            ensureBaseContentForExpand();
            onExpandUpperRegionDownward(beforeStart, afterStart, lines);
          }
        : undefined,
    [ensureBaseContentForExpand, onExpandUpperRegionDownward]
  );

  const handleExpandLowerRegionUpward = useMemo(
    () =>
      onExpandLowerRegionUpward
        ? (beforeStart: number, afterStart: number, lines: number) => {
            ensureBaseContentForExpand();
            onExpandLowerRegionUpward(beforeStart, afterStart, lines);
          }
        : undefined,
    [ensureBaseContentForExpand, onExpandLowerRegionUpward]
  );

  const [showLargeDiffWarning, setShowLargeDiffWarning] =
    useState(isDefaultHidden);

  // Markdown rendered diff preview
  const isMarkdown = isMarkdownFile(fileChange.file_path);
  const [isMarkdownPreview, setIsMarkdownPreview] = useState(false);
  const [markdownBefore, setMarkdownBefore] = useState<string | null>(null);
  const [markdownAfter, setMarkdownAfter] = useState<string | null>(null);
  const [isLoadingMarkdown, setIsLoadingMarkdown] = useState(false);
  const [markdownError, setMarkdownError] = useState(false);
  const markdownCacheKeyRef = useRef("");

  // Clear cached markdown content when the underlying data changes
  const mdContentKey = `${prPath}:${mergeBaseSha}:${headSha}:${fileChange.file_path}:${fileChange.old_file_path}:${fileChange.change_type}`;
  const [prevMdContentKey, setPrevMdContentKey] = useState(mdContentKey);
  if (mdContentKey !== prevMdContentKey) {
    setPrevMdContentKey(mdContentKey);
    setMarkdownBefore(null);
    setMarkdownAfter(null);
    setMarkdownError(false);
    setIsMarkdownPreview(false);
    markdownCacheKeyRef.current = "";
  }

  const fetchMarkdownContent = useCallback(async () => {
    const cacheKey = `${prPath}:${mergeBaseSha}:${headSha}:${fileChange.file_path}:${fileChange.old_file_path}:${fileChange.change_type}`;
    if (markdownCacheKeyRef.current === cacheKey && markdownBefore !== null) {
      return;
    }

    if (!prPath) return;
    setIsLoadingMarkdown(true);
    setMarkdownError(false);
    markdownCacheKeyRef.current = cacheKey;
    try {
      const [beforeRes, afterRes] = await Promise.all([
        mergeBaseSha && fileChange.change_type !== "added"
          ? fetchFileContent(
              prPath,
              fileChange.old_file_path ?? fileChange.file_path,
              mergeBaseSha
            )
          : Promise.resolve(null),
        headSha && fileChange.change_type !== "deleted"
          ? fetchFileContent(prPath, fileChange.file_path, headSha)
          : Promise.resolve(null),
      ]);
      if (markdownCacheKeyRef.current !== cacheKey) return;
      setMarkdownBefore(beforeRes?.content ?? "");
      setMarkdownAfter(afterRes?.content ?? "");
    } catch {
      if (markdownCacheKeyRef.current === cacheKey) {
        setMarkdownError(true);
      }
    } finally {
      if (markdownCacheKeyRef.current === cacheKey) {
        setIsLoadingMarkdown(false);
      }
    }
  }, [
    markdownBefore,
    prPath,
    mergeBaseSha,
    headSha,
    fileChange.change_type,
    fileChange.file_path,
    fileChange.old_file_path,
  ]);

  const handleToggleMarkdownPreview = useCallback(async () => {
    if (isMarkdownPreview) {
      setIsMarkdownPreview(false);
      return;
    }
    setIsMarkdownPreview(true);
    fetchMarkdownContent();
  }, [isMarkdownPreview, fetchMarkdownContent]);

  const handleRetryMarkdownPreview = useCallback(() => {
    markdownCacheKeyRef.current = "";
    fetchMarkdownContent();
  }, [fetchMarkdownContent]);

  // State for loading file contents on pure renames (no display items)
  const [viewFileContent, setViewFileContent] = useState<
    DiffDisplayItem[] | null
  >(null);
  const [isLoadingFileContent, setIsLoadingFileContent] = useState(false);

  const handleViewFile = useCallback(async () => {
    if (!prPath || !headSha) return;
    setIsLoadingFileContent(true);
    try {
      const response = await fetchFileContent(
        prPath,
        fileChange.file_path,
        headSha
      );
      const lines = response.content.split("\n");
      if (lines.length > 0 && lines[lines.length - 1] === "") {
        lines.pop();
      }
      const items: DiffDisplayItem[] = lines.map((content, i) => ({
        type: "line" as const,
        line: {
          beforeLineNum: i + 1,
          afterLineNum: i + 1,
          content,
          type: "context" as const,
          isMainDiff: false,
        },
      }));
      setViewFileContent(items);
    } catch {
      // Silently fail — button remains available to retry
    } finally {
      setIsLoadingFileContent(false);
    }
  }, [prPath, headSha, fileChange.file_path]);

  // Clear loaded file content when the underlying data changes (new commit, different file)
  const viewFileContentKey = `${headSha}:${prPath}:${fileChange.file_path}`;
  const [prevViewFileContentKey, setPrevViewFileContentKey] =
    useState(viewFileContentKey);
  if (viewFileContentKey !== prevViewFileContentKey) {
    setPrevViewFileContentKey(viewFileContentKey);
    setViewFileContent(null);
  }

  const { containerRef: scrollContainerRef } = usePRDigestScroll();

  const containerRef = useRef<HTMLDivElement>(null);

  const maybeFixScrollOnCollapse = useEventCallback(() => {
    if (!isCollapsed && containerRef.current && scrollContainerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const scrollRect = scrollContainerRef.current.getBoundingClientRect();

      const relativeTop = containerRect.top - scrollRect.top;

      if (relativeTop < 0) {
        const targetScrollTop =
          scrollContainerRef.current.scrollTop + relativeTop - 40;
        scrollContainerRef.current.scrollTop = Math.max(0, targetScrollTop);
      }
    }
  });

  const handleToggleCollapse = useCallback(() => {
    maybeFixScrollOnCollapse();
    toggleCollapsed(fileKey);
  }, [toggleCollapsed, fileKey, maybeFixScrollOnCollapse]);

  const handleToggleViewed = useCallback(() => {
    maybeFixScrollOnCollapse();
    toggleViewed(fileKey);
  }, [toggleViewed, fileKey, maybeFixScrollOnCollapse]);

  const handleAddFileComment = useEventCallback(() => {
    if (isCollapsed) {
      expandFile(fileKey);
    }
    onAddFileComment?.();
    if (containerRef.current && scrollContainerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const scrollRect = scrollContainerRef.current.getBoundingClientRect();
      const relativeTop = containerRect.top - scrollRect.top;
      if (relativeTop < 0) {
        const targetScrollTop =
          scrollContainerRef.current.scrollTop + relativeTop;
        scrollContainerRef.current.scrollTop = Math.max(0, targetScrollTop);
      }
    }
  });

  const viewMode = useViewMode();

  const { displayItems, fileLineCounts } = useDiffLines({
    fileChange,
    expandedRegions,
    beforeContent: effectiveBeforeContent,
    allChangesInFile,
    viewMode,
  });

  // Depend on the primitive counts rather than the fileLineCounts object:
  // useDiffLines returns a fresh object on every recompute (e.g. expanding a
  // region) even when before/after are unchanged, which would otherwise cascade
  // into the renderers memo and re-render every memoized InlineReferenceDiff.
  const { before: beforeLineCount, after: afterLineCount } = fileLineCounts;
  const clampedComments = useMemo(() => {
    return comments.map((comment) => {
      if (comment.endLineNumber === undefined) return comment;
      const cap = comment.side === "after" ? afterLineCount : beforeLineCount;
      if (cap <= 0 || comment.endLineNumber <= cap) return comment;
      return { ...comment, endLineNumber: cap };
    });
  }, [comments, beforeLineCount, afterLineCount]);

  const { getHighlightedTokens } = useFileHighlight({
    filePath: fileChange.file_path,
    // Passes null while content is a lazy stub; once the fetch resolves and
    // effectiveBeforeContent becomes a string, this recomputes and the Shiki
    // worker highlights the full file.
    beforeContent: resolveFileContent(effectiveBeforeContent) ?? null,
    afterContent: afterContent ?? null,
  });

  // Compute hunk ranges for this section to filter bugs
  // Track both before (LEFT) and after (RIGHT) ranges since bugs can be on either side
  const sectionHunkRanges = useMemo(() => {
    const blocks = fileChange.display_info?.blocks_to_show ?? [];
    const beforeRanges: { start: number; end: number }[] = [];
    const afterRanges: { start: number; end: number }[] = [];

    for (const block of blocks) {
      if (block.type === "hunk") {
        if (block.hunk.before_lines) {
          const [start, end] = block.hunk.before_lines;
          beforeRanges.push({ start, end });
        }
        if (block.hunk.after_lines) {
          const [start, end] = block.hunk.after_lines;
          afterRanges.push({ start, end });
        }
      } else if (block.type === "line") {
        if (block.before_line !== null) {
          beforeRanges.push({
            start: block.before_line,
            end: block.before_line,
          });
        }
        if (block.after_line !== null) {
          afterRanges.push({ start: block.after_line, end: block.after_line });
        }
      }
    }

    return { beforeRanges, afterRanges };
  }, [fileChange.display_info?.blocks_to_show]);

  // Filter bugs to only show those within one of this section's hunk ranges
  // Use before_lines ranges for LEFT-side bugs, after_lines ranges for RIGHT-side bugs
  const bugsForSection = useMemo(() => {
    const filePath = fileChange.file_path;
    const allBugs = lifeguardBugs.filter((bug) => bug.file_path === filePath);
    const { beforeRanges, afterRanges } = sectionHunkRanges;
    if (beforeRanges.length === 0 && afterRanges.length === 0) return allBugs;

    return allBugs.filter((bug) => {
      const endLine = bug.end_line;
      if (endLine === null) return false;
      // Check against the appropriate ranges based on bug's side
      const ranges = bug.side === "LEFT" ? beforeRanges : afterRanges;
      return ranges.some(
        (range) => endLine >= range.start && endLine <= range.end
      );
    });
  }, [lifeguardBugs, fileChange.file_path, sectionHunkRanges]);

  // Memoize renderers to prevent re-renders of RenderedDisplayItems during resize
  const renderers = useMemo(() => {
    return {
      collapsed: (
        item: {
          type: "collapsed";
        } & DiffDisplayItem,
        viewMode: DiffViewMode
      ) => {
        // Extract original region boundaries from regionKeys
        // Format: "hidden-{beforeStart}-{afterStart}"
        const firstRegionKey = item.regionKeys[0] || "";
        const match = firstRegionKey.match(/^hidden-(\d+)-(\d+)$/);
        const originalBeforeStart = match
          ? parseInt(match[1], 10)
          : item.beforeStart;
        const originalAfterStart = match
          ? parseInt(match[2], 10)
          : item.afterStart;

        return (
          <CollapsedRegion
            key={`collapsed-${firstRegionKey}`}
            beforeStart={item.beforeStart}
            afterStart={item.afterStart}
            lineCount={item.lineCount}
            isLoading={item.isLoading}
            viewMode={viewMode}
            canExpandFromTop={item.canExpandFromTop}
            canExpandFromBottom={item.canExpandFromBottom}
            onExpand={() => handleExpandRegion(item.regionKeys)}
            onExpandUpperRegionDownward={
              handleExpandUpperRegionDownward
                ? (lines) =>
                    handleExpandUpperRegionDownward(
                      originalBeforeStart,
                      originalAfterStart,
                      lines
                    )
                : undefined
            }
            onExpandLowerRegionUpward={
              handleExpandLowerRegionUpward
                ? (lines) =>
                    handleExpandLowerRegionUpward(
                      originalBeforeStart,
                      originalAfterStart,
                      lines
                    )
                : undefined
            }
            scrollContainerRef={scrollContainerRef}
          />
        );
      },
      "expanded-copy-move-comparison": (
        item: { type: "expanded-copy-move-comparison" } & DiffDisplayItem
      ) => {
        return (
          <InlineReferenceDiff
            key={`expanded-ref-${item.reference.referenceId}`}
            referenceId={item.reference.referenceId}
            oldRange={item.reference.sourceRange}
            newRange={item.reference.destinationRange}
            oldContent={item.reference.oldContent}
            newContent={item.reference.newContent}
            comments={clampedComments}
            commentRenderers={commentRenderers}
            commentLocation={commentLocation}
          />
        );
      },
    };
  }, [
    handleExpandRegion,
    handleExpandUpperRegionDownward,
    handleExpandLowerRegionUpward,
    clampedComments,
    commentRenderers,
    commentLocation,
  ]);

  const { stats } = useLinesAndStats(displayItems);

  // Register snippets with scroll registry
  const { register } = useScrollRegistry();
  const registeredSnippetsRef = useRef(new Set<string>());

  const registerSnippet = useCallback(
    (snippetId: string, el: HTMLDivElement | null) => {
      if (el && !registeredSnippetsRef.current.has(snippetId)) {
        registeredSnippetsRef.current.add(snippetId);
        register({ type: "snippet", id: snippetId }, el);
      } else if (!el) {
        registeredSnippetsRef.current.delete(snippetId);
        register({ type: "snippet", id: snippetId }, null);
      }
    },
    [register]
  );

  // Helper: renders RenderedDisplayItems, optionally wrapped in FloatingCommentsContainer
  const renderDisplayItems = (items: DiffDisplayItem[]) => {
    const element = (
      <RenderedDisplayItems
        filePath={fileChange.file_path}
        displayItems={items}
        highlightTokens={getHighlightedTokens}
        comments={clampedComments}
        commentRenderers={commentRenderers}
        commentLocation={commentLocation}
        registerSnippet={registerSnippet}
        renderers={renderers}
        sectionIndex={sectionIndex}
      />
    );
    return commentLocation === "floating" || commentLocation === "hybrid" ? (
      <FloatingCommentsContainer>{element}</FloatingCommentsContainer>
    ) : (
      element
    );
  };

  const bg = "bg-bg-page";

  // Need overflow for comments
  return (
    <div
      ref={containerRef}
      className="pointer-events-none -mt-12 flex flex-col overflow-visible rounded-[10px] pt-12"
      data-file-path={fileChange.file_path}
    >
      <div
        className={cn(
          // --review-sticky-top is the height of UI pinned above the section
          // header (set by the embedded review's diff tab; 0 elsewhere).
          !isHomeExample &&
            "sticky top-[calc(var(--review-sticky-top,0px)+3rem)]",
          bg,
          "pointer-events-auto z-10 overflow-hidden"
        )}
      >
        <FileHeader
          filePath={fileChange.file_path}
          changeType={fileChange.change_type}
          additions={stats.additions}
          deletions={stats.deletions}
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
          fileUrl={fileUrl}
          lifeguardBugs={bugsForSection}
          isViewed={isViewed}
          onToggleViewed={handleToggleViewed}
          oldRawFileUrl={
            owner && repo && mergeBaseSha && fileChange.change_type !== "added"
              ? `https://${gitHost}/${owner}/${repo}/blob/${mergeBaseSha}/${fileChange.old_file_path ?? fileChange.file_path}`
              : undefined
          }
          newRawFileUrl={
            owner && repo && headSha && fileChange.change_type !== "deleted"
              ? `https://${gitHost}/${owner}/${repo}/blob/${headSha}/${fileChange.file_path}`
              : undefined
          }
          oldFilePath={fileChange.old_file_path}
          fileOccurrenceIndex={fileOccurrenceIndex}
          fileOccurrenceTotal={fileOccurrenceTotal}
          onAddFileComment={onAddFileComment ? handleAddFileComment : undefined}
          isPreviewMode={isMarkdownPreview}
          onTogglePreview={
            isMarkdown && prPath && (mergeBaseSha || headSha)
              ? handleToggleMarkdownPreview
              : undefined
          }
          previewLabel={t("diffViewer.viewRenderedMarkdownDiff")}
        />
      </div>

      {/* Large diff warning when collapsed */}
      {!isCollapsed && showLargeDiffWarning && !isMarkdownPreview && (
        <div className="pointer-events-auto flex flex-col items-center justify-center gap-3 rounded-b-[10px] border border-t-0 border-border-secondary bg-bg-elevated px-4 py-6">
          <span className="text-14 text-text-secondary">
            {t("diffViewer.largeDiffHidden")}
          </span>
          <Button
            variant="secondary"
            onClick={() => {
              setShowLargeDiffWarning(false);
              if (contentIsGenerated && requestLazyFiles) {
                setIsLoadingLazy(true);
                setLazyLoadError(false);
                void requestLazyFiles([fileChange.file_path])
                  ?.catch(() => setLazyLoadError(true))
                  .finally(() => setIsLoadingLazy(false));
              }
            }}
          >
            {t("diffViewer.loadDiff")}
          </Button>
        </div>
      )}

      {/* Lazy stub placeholder for files not hidden by default but content not yet loaded */}
      {!isCollapsed &&
        !showLargeDiffWarning &&
        showLazyPlaceholder &&
        !isMarkdownPreview && (
          <div className="pointer-events-auto flex flex-col items-center justify-center gap-3 rounded-b-[10px] border border-t-0 border-border-secondary bg-bg-elevated px-4 py-6">
            <span
              className={cn(
                "text-14",
                lazyLoadError ? "text-text-red" : "text-text-secondary"
              )}
            >
              {lazyLoadError
                ? t("diffViewer.failedToLoadDiff")
                : t("diffViewer.diffContentNotLoaded")}
            </span>
            <Button
              variant="secondary"
              disabled={isLoadingLazy}
              onClick={() => {
                if (requestLazyFiles) {
                  setIsLoadingLazy(true);
                  setLazyLoadError(false);
                  void requestLazyFiles([fileChange.file_path])
                    ?.catch(() => setLazyLoadError(true))
                    .finally(() => setIsLoadingLazy(false));
                }
              }}
            >
              {isLoadingLazy
                ? t("diffViewer.loading")
                : t("diffViewer.loadDiff")}
            </Button>
          </div>
        )}

      {/* Loading indicator for generated lazy files between warning dismiss and content arrival */}
      {!isCollapsed &&
        !showLargeDiffWarning &&
        !showLazyPlaceholder &&
        contentIsGenerated &&
        isLoadingLazy &&
        !isMarkdownPreview && (
          <div className="pointer-events-auto flex items-center justify-center rounded-b-[10px] border border-t-0 border-border-secondary bg-bg-elevated py-8">
            <span className="text-14 text-text-secondary">
              {t("diffViewer.loading")}
            </span>
          </div>
        )}

      {/* Error state for failed generated lazy file fetch */}
      {!isCollapsed &&
        !showLargeDiffWarning &&
        !showLazyPlaceholder &&
        contentIsGenerated &&
        !isLoadingLazy &&
        lazyLoadError &&
        !isMarkdownPreview && (
          <div className="pointer-events-auto flex flex-col items-center justify-center gap-3 rounded-b-[10px] border border-t-0 border-border-secondary bg-bg-elevated px-4 py-6">
            <span className="text-14 text-text-red">
              {t("diffViewer.failedToLoadDiff")}
            </span>
            <Button
              variant="secondary"
              onClick={() => {
                if (requestLazyFiles) {
                  setIsLoadingLazy(true);
                  setLazyLoadError(false);
                  void requestLazyFiles([fileChange.file_path])
                    ?.catch(() => setLazyLoadError(true))
                    .finally(() => setIsLoadingLazy(false));
                }
              }}
            >
              {t("common.retry")}
            </Button>
          </div>
        )}

      {/* Content area */}
      {!isCollapsed &&
        (!showLargeDiffWarning || isMarkdownPreview) &&
        (!showLazyPlaceholder || isMarkdownPreview) &&
        !(contentIsGenerated && isLoadingLazy) &&
        !(contentIsGenerated && lazyLoadError) && (
          <div
            className={`pointer-events-auto isolate overflow-visible rounded-b-[10px] border border-t-0 border-border-secondary bg-bg-elevated`}
          >
            {/* Markdown rendered diff preview */}
            {isMarkdownPreview ? (
              isLoadingMarkdown ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-14 text-text-secondary">
                    {t("diffViewer.loadingRenderedDiff")}
                  </span>
                </div>
              ) : markdownError ? (
                <div className="flex items-center justify-center gap-2 py-8">
                  <span className="text-14 text-text-red">
                    {t("diffViewer.failedToLoadRenderedDiff")}
                  </span>
                  <Button
                    variant="secondary"
                    onClick={handleRetryMarkdownPreview}
                  >
                    {t("common.retry")}
                  </Button>
                </div>
              ) : (
                <MarkdownDiffViewer
                  oldContent={markdownBefore ?? ""}
                  newContent={markdownAfter ?? ""}
                />
              )
            ) : /* Image diff - render ImageDiff for image files */
            isImageFile(fileChange.file_path) && prPath ? (
              <ImageDiff
                filePath={fileChange.file_path}
                changeType={fileChange.change_type}
                prPath={prPath}
                mergeBaseSha={mergeBaseSha}
                headSha={headSha}
              />
            ) : (
              <div className="overflow-visible">
                {displayItems.length === 0 ? (
                  <>
                    {/* For pure renames: show comments above, then a "View file" button */}
                    {comments.length > 0 &&
                      !viewFileContent &&
                      renderDisplayItems(displayItems)}
                    {viewFileContent ? (
                      renderDisplayItems(viewFileContent)
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-3 px-4 py-6">
                        <span className="text-14 text-text-secondary">
                          {t("diffViewer.noChangesToDisplay")}
                        </span>
                        {prPath && headSha && (
                          <Button
                            variant="secondary"
                            onClick={handleViewFile}
                            disabled={isLoadingFileContent}
                          >
                            {isLoadingFileContent
                              ? t("diffViewer.loading")
                              : t("diffViewer.viewFile")}
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  renderDisplayItems(displayItems)
                )}
              </div>
            )}
          </div>
        )}
    </div>
  );
});
