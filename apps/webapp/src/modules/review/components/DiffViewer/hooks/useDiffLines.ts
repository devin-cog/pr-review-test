/**
 * Hook to convert file change data into renderable diff lines
 */
import { useMemo } from "react";
import {
  type FileContentAtBase,
  isLazyStub,
} from "../../../queries/prReviewJobs";
import { useExpandedReferencesForFile } from "../../../stores/referenceStore";
import type {
  Change,
  DiffDisplayItem,
  DiffHunk,
  DiffLine,
  DiffLineType,
  DisplayBlock,
  ExpandedReferenceData,
  FileChange,
} from "../types";
import { hideWhitespaceInDisplayItems } from "../utils/whitespaceDiff";

interface UseDiffLinesOptions {
  fileChange: FileChange;
  allChangesInFile: Change[];
  expandedRegions?: Set<string>;
  viewMode: "split" | "unified";
  beforeContent?: FileContentAtBase | null;
  hideWhitespace?: boolean;
}

interface UseDiffLinesResult {
  displayItems: DiffDisplayItem[];
  /**
   * Total number of lines in the underlying before/after file. Used by
   * consumers to clamp comment anchors to within the actual file range
   * (the displayed diff may end at a sentinel that is one past the file's
   * last line; trailing collapsed regions auto-expand on navigation).
   */
  fileLineCounts: { before: number; after: number };
}

/**
 * Convert a hunk's before/after content into DiffLine array
 * Renders all removed lines first, then all added lines
 */
export function hunkToLines(
  hunk: DiffHunk,
  {
    isMainDiff = true,
    addedFirst = false,
  }: {
    isMainDiff?: boolean;
    addedFirst?: boolean;
  } = {}
): DiffLine[] {
  const lines: DiffLine[] = [];
  const beforeEmpty =
    (!hunk.before_lines || hunk.before_lines[1] < hunk.before_lines[0]) &&
    !hunk.before_content;
  const afterEmpty =
    (!hunk.after_lines || hunk.after_lines[1] < hunk.after_lines[0]) &&
    !hunk.after_content;
  const beforeLines = beforeEmpty
    ? []
    : (hunk.before_content?.split("\n") ?? []);
  const afterLines = afterEmpty ? [] : (hunk.after_content?.split("\n") ?? []);

  const beforeStart = hunk.before_lines?.[0] ?? 1;
  const afterStart = hunk.after_lines?.[0] ?? 1;

  const addBefore = () => {
    beforeLines.forEach((content, idx) => {
      lines.push({
        beforeLineNum: beforeStart + idx,
        afterLineNum: null,
        content,
        type: "removed",
        isMainDiff,
        snippetId: hunk.snippet_id,
      });
    });
  };

  const addAfter = () => {
    afterLines.forEach((content, idx) => {
      lines.push({
        beforeLineNum: null,
        afterLineNum: afterStart + idx,
        content,
        type: "added",
        isMainDiff,
        snippetId: hunk.snippet_id,
      });
    });
  };

  if (addedFirst) {
    addAfter();
    addBefore();
  } else {
    addBefore();
    addAfter();
  }

  return lines;
}

/**
 * Convert edits to diff lines (fallback when display_info is not available)
 */
export function editsToLines(edits: Change[]): DiffLine[] {
  const lines: DiffLine[] = [];
  let previousBeforeEnd: number | null = null;
  let previousAfterEnd: number | null = null;

  for (const edit of edits) {
    const beforeLines = edit.before_content?.split("\n") ?? [];
    const afterLines = edit.after_content?.split("\n") ?? [];
    const beforeStart = edit.before_lines?.[0] ?? 1;
    const afterStart = edit.after_lines?.[0] ?? 1;
    const hasGap =
      (edit.before_lines !== null &&
        previousBeforeEnd !== null &&
        beforeStart > previousBeforeEnd + 1) ||
      (edit.after_lines !== null &&
        previousAfterEnd !== null &&
        afterStart > previousAfterEnd + 1);
    let hunkHeader = hasGap
      ? `@@ -${edit.before_lines?.[0] ?? 0} +${edit.after_lines?.[0] ?? 0} @@`
      : undefined;

    // Add removed lines
    beforeLines.forEach((content, idx) => {
      if (content !== "" || idx < beforeLines.length - 1) {
        lines.push({
          beforeLineNum: beforeStart + idx,
          afterLineNum: null,
          content,
          type: "removed",
          isMainDiff: true,
          snippetId: edit.snippet_id,
          hunkHeader,
        });
        hunkHeader = undefined;
      }
    });

    // Add added lines
    afterLines.forEach((content, idx) => {
      if (content !== "" || idx < afterLines.length - 1) {
        lines.push({
          beforeLineNum: null,
          afterLineNum: afterStart + idx,
          content,
          type: "added",
          isMainDiff: true,
          snippetId: edit.snippet_id,
          hunkHeader,
        });
        hunkHeader = undefined;
      }
    });

    if (edit.before_lines !== null) {
      previousBeforeEnd = edit.before_lines[1];
    }
    if (edit.after_lines !== null) {
      previousAfterEnd = edit.after_lines[1];
    }
  }

  return lines;
}

/** Hidden region info for collapsed sections between visible blocks */
interface HiddenRegion {
  beforeStart: number;
  beforeEnd: number;
  afterStart: number;
  afterEnd: number;
}

/**
 * Calculate hidden region between consecutive blocks
 */
function calculateHiddenRegion(
  prevBlock: DisplayBlock | null,
  currBlock: DisplayBlock
): HiddenRegion | null {
  let prevBeforeEnd = 0;
  let prevAfterEnd = 0;

  if (prevBlock) {
    if (prevBlock.type === "line") {
      prevBeforeEnd = prevBlock.before_line;
      prevAfterEnd = prevBlock.after_line;
    } else {
      const hunk = prevBlock.hunk;
      if (hunk.before_lines) {
        prevBeforeEnd = hunk.before_lines[1];
      }
      if (hunk.after_lines) {
        prevAfterEnd = hunk.after_lines[1];
      }
    }
  }

  let currBeforeStart = 0;
  let currAfterStart = 0;

  if (currBlock.type === "line") {
    currBeforeStart = currBlock.before_line;
    currAfterStart = currBlock.after_line;
  } else {
    const hunk = currBlock.hunk;
    if (hunk.before_lines) {
      currBeforeStart = hunk.before_lines[0];
    }
    if (hunk.after_lines) {
      currAfterStart = hunk.after_lines[0];
    }
  }

  const beforeGap = currBeforeStart - prevBeforeEnd - 1;
  const afterGap = currAfterStart - prevAfterEnd - 1;
  const lineCount = Math.max(beforeGap, afterGap, 0);

  if (lineCount > 0) {
    const beforeStart = prevBeforeEnd + 1;
    const beforeEnd = currBeforeStart - 1;
    return {
      beforeStart,
      beforeEnd,
      afterStart: prevAfterEnd + 1,
      afterEnd: currAfterStart - 1,
    };
  }

  return null;
}

type Subregion =
  | {
      type: "change";
      change: Change;
    }
  | {
      type: "context";
      beforeLines: [number, number];
      afterLines: [number, number];
    };

/**
 * Process blocks into display items with collapsed region detection
 */
export function blocksToDisplayItems(
  blocks: DisplayBlock[],
  expandedRegions: Set<string>,
  beforeContent: FileContentAtBase | null | undefined,
  allChangesInFile: Change[], // Assume these are sorted
  expandedReferences: ExpandedReferenceData[],
  viewMode: "split" | "unified"
): {
  displayItems: DiffDisplayItem[];
  fileLineCounts: { before: number; after: number };
} {
  const displayItems: DiffDisplayItem[] = [];

  const isCreateFile =
    blocks.length === 1 &&
    blocks[0].type === "hunk" &&
    blocks[0].hunk.before_lines === null;

  let contentIsStub = false;
  let beforeLines: string[];
  let beforeLineCount: number;
  if (isCreateFile || beforeContent == null) {
    beforeLines = [];
    beforeLineCount = 0;
  } else if (isLazyStub(beforeContent)) {
    contentIsStub = true;
    beforeLines = [];
    beforeLineCount = beforeContent.line_count;
  } else {
    beforeLines = beforeContent.split("\n");
    beforeLineCount = beforeLines.length;
  }

  const isDeletion = allChangesInFile.every(
    (change) => change.change_type === "deleted"
  );

  let prevBlock: DisplayBlock | null = null;

  let seekIdx = 0;

  const getChangesInHiddenRegion = (hiddenRegion: HiddenRegion): Change[] => {
    const res: Change[] = [];
    while (seekIdx < allChangesInFile.length) {
      const change = allChangesInFile[seekIdx];
      if (
        change.before_lines &&
        change.before_lines[0] <= hiddenRegion.beforeEnd &&
        change.before_lines[1] >= hiddenRegion.beforeStart
      ) {
        res.push(change);
      } else if (
        change.after_lines &&
        change.after_lines[0] <= hiddenRegion.afterEnd &&
        change.after_lines[1] >= hiddenRegion.afterStart
      ) {
        res.push(change);
      }

      const finishedBefore =
        !change.before_lines ||
        change.before_lines[1] <= hiddenRegion.beforeEnd;
      const finishedAfter =
        !change.after_lines || change.after_lines[1] <= hiddenRegion.afterEnd;

      if (finishedBefore && finishedAfter) {
        seekIdx++;
      } else {
        break;
      }
    }
    return res;
  };

  let finalBeforeVsAfterOffset = 0;
  if (allChangesInFile.length > 0) {
    const lastChange = allChangesInFile[allChangesInFile.length - 1];
    if (lastChange.after_lines) {
      finalBeforeVsAfterOffset =
        lastChange.after_lines[1] - (lastChange.before_lines?.[1] ?? 0);
    }
  }

  // Sentinel block standing in for the end of the file, so a trailing gap is
  // detected. It has no code below it, so it must never offer a bottom expand.
  let eofSentinel: DisplayBlock | null = null;
  if (!isDeletion) {
    const lastAfterLine = beforeLineCount + finalBeforeVsAfterOffset;
    eofSentinel = {
      type: "line",
      before_line: beforeLineCount + 1,
      after_line: lastAfterLine + 1,
      content: "",
    };
    blocks = [...blocks, eofSentinel];
  }

  const expandedRefsByStart = new Map<number, ExpandedReferenceData>();
  for (const ref of expandedReferences) {
    expandedRefsByStart.set(ref.destinationRange.start_line, ref);
  }

  let ignoreAfterLinesUpTo = 0;

  const tryPushLine = (line: DiffLine) => {
    const afterLine = line.afterLineNum;

    if (afterLine !== null && expandedRefsByStart.has(afterLine)) {
      const expandedRef = expandedRefsByStart.get(afterLine)!;
      displayItems.push({
        type: "expanded-copy-move-comparison",
        reference: expandedRef,
      });
      ignoreAfterLinesUpTo = expandedRef.destinationRange.end_line;
    }

    if (line.afterLineNum && line.afterLineNum <= ignoreAfterLinesUpTo) {
      if (line.type === "added") {
        return;
      } else if (line.type === "context") {
        line.type = "removed";
        line.afterLineNum = null;
      }
    }

    displayItems.push({ type: "line", line });
  };

  for (const block of blocks) {
    // Check for hidden region before this block
    const hiddenRegion = calculateHiddenRegion(prevBlock, block);

    const intersectingChanges = hiddenRegion
      ? getChangesInHiddenRegion(hiddenRegion)
      : [];

    if (hiddenRegion) {
      const regionKey = `hidden-${hiddenRegion.beforeStart}-${hiddenRegion.afterStart}`;

      // A partial expand grows away from adjacent code into the gap, so it is
      // offered on a side only when there is visible code bordering the region
      // there — not at the file's start (no code above) or end (no code below).
      const hasCodeAbove = prevBlock !== null;
      const hasCodeBelow = block !== eofSentinel;

      // Check for partial expansion keys
      // Format: "hidden-{beforeStart}-{afterStart}:top:{lines}" or ":bottom:{lines}"
      let expandedFromTop = 0;
      let expandedFromBottom = 0;
      for (const key of expandedRegions) {
        if (key.startsWith(regionKey + ":top:")) {
          expandedFromTop = Math.max(
            expandedFromTop,
            parseInt(key.slice(regionKey.length + 5), 10) || 0
          );
        } else if (key.startsWith(regionKey + ":bottom:")) {
          expandedFromBottom = Math.max(
            expandedFromBottom,
            parseInt(key.slice(regionKey.length + 8), 10) || 0
          );
        }
      }

      let linesInRegion = hiddenRegion.beforeEnd - hiddenRegion.beforeStart + 1;
      for (const change of intersectingChanges) {
        const numAfter = change.after_lines
          ? change.after_lines[1] - change.after_lines[0] + 1
          : 0;
        const numBefore = change.before_lines
          ? change.before_lines[1] - change.before_lines[0] + 1
          : 0;
        if (numAfter > numBefore) linesInRegion += numAfter - numBefore;
      }

      const subregions: Subregion[] = [];

      let beforeLine = hiddenRegion.beforeStart;
      let afterLine = hiddenRegion.afterStart;

      const flushSubregion = (nextBeforeLine: number) => {
        const numContextLines = nextBeforeLine - beforeLine;
        if (numContextLines > 0) {
          subregions.push({
            type: "context",
            beforeLines: [beforeLine, beforeLine + numContextLines - 1],
            afterLines: [afterLine, afterLine + numContextLines - 1],
          });
          beforeLine += numContextLines;
          afterLine += numContextLines;
        }
      };

      for (const change of intersectingChanges) {
        if (!change.before_lines) {
          continue;
        }
        flushSubregion(change.before_lines![0]);
        subregions.push({
          type: "change",
          change,
        });
        beforeLine = change.before_lines![1] + 1;
        afterLine = change.after_lines![1] + 1;
      }
      flushSubregion(hiddenRegion.beforeEnd + 1);

      const linesInSubregion = (subregion: Subregion) => {
        if (subregion.type === "context") {
          return subregion.beforeLines[1] - subregion.beforeLines[0] + 1;
        } else {
          return Math.max(
            subregion.change.after_lines![1] -
              subregion.change.after_lines![0] +
              1,
            subregion.change.before_lines![1] -
              subregion.change.before_lines![0] +
              1
          );
        }
      };

      let subregionPtr = 0;
      let linePtr = 0;

      let nextBeforeLine = hiddenRegion.beforeStart;
      let nextAfterLine = hiddenRegion.afterStart;

      const progressLines = (
        cnt: number,
        skip: boolean,
        markAsExpanded = true
      ) => {
        if (cnt == 0) return;
        for (; subregionPtr < subregions.length; ) {
          const subregion = subregions[subregionPtr];

          const numLines = linesInSubregion(subregion);
          const endPtr = Math.min(linePtr + cnt, numLines);
          if (!skip) {
            if (subregion.type === "context") {
              for (let i = linePtr; i < endPtr; i++) {
                const beforeLine = subregion.beforeLines[0] + i;
                const afterLine = subregion.afterLines[0] + i;
                const line: DiffLine = {
                  beforeLineNum: beforeLine,
                  afterLineNum: afterLine,
                  content: beforeLines[beforeLine - 1] ?? "",
                  type: "context",
                  isMainDiff: false,
                  isExpandedContext: markAsExpanded,
                };
                tryPushLine(line);
              }
            } else {
              const hunkLines = hunkToLines(subregion.change, {
                isMainDiff: false,
                // (walden): this is a HACK so that the comparison comments don't move around in split view when opening the comparison
                // we also accordingly adjust the grouping in `splitRow.ts:linesToSplitRows`
                addedFirst: viewMode === "split",
              });
              const typeList: { type: DiffLineType; lines: DiffLine[] }[] = [];
              for (const line of hunkLines) {
                if (
                  typeList.length === 0 ||
                  typeList[typeList.length - 1].type !== line.type
                ) {
                  typeList.push({ type: line.type, lines: [] });
                }
                typeList[typeList.length - 1].lines.push(line);
              }

              for (const { lines } of typeList) {
                for (const line of lines.slice(linePtr, endPtr)) {
                  tryPushLine(line);
                }
              }
            }
          }
          cnt -= endPtr - linePtr;
          linePtr = endPtr;

          if (subregion.type === "context") {
            nextBeforeLine = subregion.beforeLines[0] + linePtr;
            nextAfterLine = subregion.afterLines[0] + linePtr;
          } else {
            nextBeforeLine = Math.min(
              subregion.change.before_lines![0] + linePtr,
              subregion.change.before_lines![1] + 1
            );
            nextAfterLine = Math.min(
              subregion.change.after_lines![0] + linePtr,
              subregion.change.after_lines![1] + 1
            );
          }

          if (linePtr >= numLines) {
            subregionPtr++;
            linePtr = 0;
          }
          if (cnt === 0) break;
        }
      };

      const isFullyExpanded =
        expandedRegions.has(regionKey) ||
        expandedFromTop + expandedFromBottom >= linesInRegion;

      // Only show collapsible regions if we have beforeContent to expand
      // Otherwise, just skip the hidden region (no collapse UI)
      if (beforeLineCount === 0) {
        // No content available - skip this hidden region entirely
        // (don't show collapse UI since we can't expand it)
      } else if (contentIsStub) {
        // Stub: line count known but beforeLines[] is empty. Keep the bar
        // collapsed (expandable) so the parsed diff renders immediately; only
        // show the loading spinner once the user expands this region, which
        // triggers the on-demand base-file fetch.
        const isExpanding =
          expandedRegions.has(regionKey) ||
          expandedFromTop > 0 ||
          expandedFromBottom > 0;
        const data: DiffDisplayItem = {
          type: "collapsed",
          beforeStart: nextBeforeLine,
          afterStart: nextAfterLine,
          beforeEnd: 0,
          afterEnd: 0,
          lineCount: linesInRegion,
          regionKeys: [regionKey],
          isLoading: isExpanding,
          canExpandFromTop: hasCodeAbove,
          canExpandFromBottom: hasCodeBelow,
        };
        progressLines(linesInRegion, true);
        data.beforeEnd = nextBeforeLine - 1;
        data.afterEnd = nextAfterLine - 1;
        displayItems.push(data);
      } else if (linesInRegion <= 3 || isFullyExpanded) {
        // For small regions (≤3 lines), auto-expand but don't mark as expanded context
        // since the user never had to manually expand them
        const wasManuallyExpanded = isFullyExpanded && linesInRegion > 3;
        progressLines(linesInRegion, false, wasManuallyExpanded);
      } else {
        // Lines expanded from top/bottom should be marked as expanded context
        progressLines(expandedFromTop, false, true);
        const remainingCnt =
          linesInRegion - expandedFromTop - expandedFromBottom;

        const data: DiffDisplayItem = {
          type: "collapsed",
          beforeStart: nextBeforeLine,
          afterStart: nextAfterLine,
          beforeEnd: 0,
          afterEnd: 0,
          lineCount: remainingCnt,
          regionKeys: [regionKey],
          canExpandFromTop: hasCodeAbove,
          canExpandFromBottom: hasCodeBelow,
        };
        progressLines(remainingCnt, true);
        data.beforeEnd = nextBeforeLine - 1;
        data.afterEnd = nextAfterLine - 1;
        displayItems.push(data);
        progressLines(expandedFromBottom, false, true);
      }
    }

    // Process the current block
    if (block.type === "line") {
      if (block.before_line === beforeLineCount + 1) {
        // This is the final line, skip it
        continue;
      }
      const line: DiffLine = {
        beforeLineNum: block.before_line,
        afterLineNum: block.after_line,
        content: block.content,
        type: "context",
        isMainDiff: false,
      };
      tryPushLine(line);
    } else if (block.type === "hunk") {
      const hunkLines = hunkToLines(block.hunk, {
        isMainDiff: true,
        // (walden): see comment about HACK above
        addedFirst: viewMode === "split",
      });
      for (const line of hunkLines) {
        tryPushLine(line);
      }
    }

    prevBlock = block;
  }

  // Merge only consecutive collapsed regions (not context lines between them)
  const mergedDisplayItems: DiffDisplayItem[] = [];

  for (const item of displayItems) {
    const lastItem = mergedDisplayItems[mergedDisplayItems.length - 1];
    if (item.type === "collapsed" && lastItem?.type === "collapsed") {
      // Merge consecutive collapsed regions
      mergedDisplayItems[mergedDisplayItems.length - 1] = {
        type: "collapsed",
        beforeStart: lastItem.beforeStart,
        afterStart: lastItem.afterStart,
        beforeEnd: item.beforeEnd,
        afterEnd: item.afterEnd,
        lineCount: lastItem.lineCount + item.lineCount,
        regionKeys: [...lastItem.regionKeys, ...item.regionKeys],
        isLoading: lastItem.isLoading || item.isLoading,
        canExpandFromTop: lastItem.canExpandFromTop,
        canExpandFromBottom: item.canExpandFromBottom,
      };
    } else {
      mergedDisplayItems.push(item);
    }
  }

  return {
    displayItems: mergedDisplayItems,
    fileLineCounts: {
      before: beforeLineCount,
      after: isDeletion ? 0 : beforeLineCount + finalBeforeVsAfterOffset,
    },
  };
}

export function useLinesAndStats(displayItems: DiffDisplayItem[]) {
  const lines = displayItems
    .filter((item) => item.type === "line")
    .map((item) => item.line);

  const expandedReferences = displayItems
    .filter((item) => item.type === "expanded-copy-move-comparison")
    .map((item) => item.reference.destinationRange);

  const stats = {
    additions:
      lines.filter((l) => l.type === "added").length +
      expandedReferences.reduce(
        (total, lineRange) =>
          total + (lineRange.end_line - lineRange.start_line + 1),
        0
      ),
    deletions: lines.filter((l) => l.type === "removed").length,
  };

  return { lines, stats };
}

/**
 * Hook to convert file change data into renderable diff lines
 */
export function useDiffLines({
  fileChange,
  expandedRegions,
  allChangesInFile,
  viewMode,
  beforeContent = null,
  hideWhitespace = false,
}: UseDiffLinesOptions): UseDiffLinesResult {
  expandedRegions = expandedRegions ?? new Set();
  const expandedReferences = useExpandedReferencesForFile(fileChange.file_path);

  return useMemo(() => {
    let lines: DiffLine[];
    let displayItems: DiffDisplayItem[];
    let fileLineCounts: { before: number; after: number };

    if (fileChange.display_info?.blocks_to_show) {
      // Use provided beforeContent, fallback to display_info.before_content
      const effectiveBeforeContent =
        beforeContent ?? fileChange.display_info.before_content;
      const result = blocksToDisplayItems(
        fileChange.display_info.blocks_to_show,
        expandedRegions,
        effectiveBeforeContent,
        allChangesInFile,
        expandedReferences,
        viewMode
      );
      displayItems = result.displayItems;
      fileLineCounts = result.fileLineCounts;
    } else {
      // Rare fallback when display_info is missing. NOTE: fileLineCounts here is
      // approximate (max edited line, not true file length), so downstream
      // clamping can shorten valid multi-line comments.
      lines = editsToLines(fileChange.edits);
      // For edits without display_info, just wrap lines as display items
      displayItems = lines.map((line) => ({ type: "line" as const, line }));
      let before = 0;
      let after = 0;
      for (const line of lines) {
        if (line.beforeLineNum !== null && line.beforeLineNum > before) {
          before = line.beforeLineNum;
        }
        if (line.afterLineNum !== null && line.afterLineNum > after) {
          after = line.afterLineNum;
        }
      }
      fileLineCounts = { before, after };
    }

    if (hideWhitespace) {
      displayItems = hideWhitespaceInDisplayItems(
        displayItems,
        viewMode === "split"
      );
    }

    return { displayItems, fileLineCounts };
  }, [
    fileChange,
    expandedRegions,
    beforeContent,
    allChangesInFile,
    expandedReferences,
    viewMode,
    hideWhitespace,
  ]);
}
