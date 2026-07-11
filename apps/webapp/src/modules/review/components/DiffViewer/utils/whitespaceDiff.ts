import * as Diff from "diff";
import type { DiffDisplayItem, DiffLine } from "../types";

/**
 * Cap on total lines eligible for whitespace-insensitive matching within one
 * contiguous visible region. Larger regions skip matching to keep the Myers
 * diff cheap on the render path.
 */
const MAX_WHITESPACE_DIFF_LINES = 5000;

function stripWhitespace(line: string): string {
  return line.replace(/\s+/g, "");
}

/**
 * Re-match one contiguous run of rendered diff lines ignoring whitespace
 * (git diff -w semantics): removed/added lines whose content differs only in
 * whitespace become context lines. Matching runs over the whole run, so pairs
 * split across hunks (e.g. a re-indented block git emitted as a removal run
 * and a separate addition run) are still hidden. Returns the original array
 * when nothing new matches or the run is too large.
 */
function hideWhitespaceInRun(run: DiffLine[], addedFirst: boolean): DiffLine[] {
  const beforeSide = run.filter((line) => line.beforeLineNum !== null);
  const afterSide = run.filter((line) => line.afterLineNum !== null);
  if (
    beforeSide.length === 0 ||
    afterSide.length === 0 ||
    beforeSide.length + afterSide.length > MAX_WHITESPACE_DIFF_LINES
  ) {
    return run;
  }

  const groups = Diff.diffArrays(
    beforeSide.map((line) => stripWhitespace(line.content)),
    afterSide.map((line) => stripWhitespace(line.afterContent ?? line.content))
  );

  // A context line is the same object in both beforeSide and afterSide, so
  // identity comparison distinguishes already-unchanged lines from
  // removed/added pairs that match only after whitespace stripping. Don't
  // clone lines when building the side arrays.
  const hidesAnything = (() => {
    let i = 0;
    let j = 0;
    for (const group of groups) {
      if (group.removed) {
        i += group.value.length;
      } else if (group.added) {
        j += group.value.length;
      } else {
        for (let k = 0; k < group.value.length; k++) {
          if (beforeSide[i] !== afterSide[j]) return true;
          i++;
          j++;
        }
      }
    }
    return false;
  })();
  if (!hidesAnything) {
    return run;
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let removed: DiffLine[] = [];
  let added: DiffLine[] = [];
  const flushChangedRun = () => {
    lines.push(...(addedFirst ? added : removed));
    lines.push(...(addedFirst ? removed : added));
    removed = [];
    added = [];
  };

  for (const group of groups) {
    if (group.removed) {
      for (let k = 0; k < group.value.length; k++) {
        const line = beforeSide[i];
        removed.push(
          line.type === "removed"
            ? line
            : { ...line, type: "removed", afterLineNum: null }
        );
        i++;
      }
    } else if (group.added) {
      for (let k = 0; k < group.value.length; k++) {
        const line = afterSide[j];
        added.push(
          line.type === "added"
            ? line
            : { ...line, type: "added", beforeLineNum: null }
        );
        j++;
      }
    } else {
      flushChangedRun();
      for (let k = 0; k < group.value.length; k++) {
        const before = beforeSide[i];
        const after = afterSide[j];
        if (before === after) {
          lines.push(before);
        } else {
          const afterContent = after.afterContent ?? after.content;
          lines.push({
            beforeLineNum: before.beforeLineNum,
            afterLineNum: after.afterLineNum,
            content: before.content,
            afterContent:
              afterContent === before.content ? undefined : afterContent,
            type: "context",
            isMainDiff: before.isMainDiff || after.isMainDiff,
            isExpandedContext:
              before.isExpandedContext && after.isExpandedContext,
            snippetId: before.snippetId ?? after.snippetId,
            hunkHeader: before.hunkHeader ?? after.hunkHeader,
          });
        }
        i++;
        j++;
      }
    }
  }
  flushChangedRun();
  return lines;
}

/**
 * Apply hide-whitespace to final display items. Contiguous runs of line items
 * (hunks plus surrounding context) are re-matched together; collapsed regions
 * and other non-line items delimit the runs.
 */
export function hideWhitespaceInDisplayItems(
  displayItems: DiffDisplayItem[],
  addedFirst: boolean
): DiffDisplayItem[] {
  const result: DiffDisplayItem[] = [];
  let run: DiffLine[] = [];

  const flushRun = () => {
    if (run.length === 0) return;
    for (const line of hideWhitespaceInRun(run, addedFirst)) {
      result.push({ type: "line", line });
    }
    run = [];
  };

  for (const item of displayItems) {
    if (item.type === "line") {
      run.push(item.line);
    } else {
      flushRun();
      result.push(item);
    }
  }
  flushRun();
  return result;
}
