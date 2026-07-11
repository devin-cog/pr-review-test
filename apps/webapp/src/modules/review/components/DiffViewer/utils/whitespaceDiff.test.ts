import type { DiffDisplayItem, DiffLine } from "../types";
import { hideWhitespaceInDisplayItems } from "./whitespaceDiff";

const removed = (num: number, content: string): DiffLine => ({
  beforeLineNum: num,
  afterLineNum: null,
  content,
  type: "removed",
  isMainDiff: true,
});

const added = (num: number, content: string): DiffLine => ({
  beforeLineNum: null,
  afterLineNum: num,
  content,
  type: "added",
  isMainDiff: true,
});

const context = (
  beforeNum: number,
  afterNum: number,
  content: string
): DiffLine => ({
  beforeLineNum: beforeNum,
  afterLineNum: afterNum,
  content,
  type: "context",
  isMainDiff: false,
});

const toItems = (lines: DiffLine[]): DiffDisplayItem[] =>
  lines.map((line) => ({ type: "line", line }));

const lineTypes = (items: DiffDisplayItem[]) =>
  items.map((item) => (item.type === "line" ? item.line.type : item.type));

describe("hideWhitespaceInDisplayItems", () => {
  it("renders whitespace-only pairs within a hunk as context", () => {
    const result = hideWhitespaceInDisplayItems(
      toItems([
        removed(1, "foo();"),
        removed(2, "bar();"),
        added(1, "  foo();"),
        added(2, "  changed();"),
      ]),
      false
    );

    expect(lineTypes(result)).toEqual(["context", "removed", "added"]);
    const first = result[0];
    expect(first).toEqual({
      type: "line",
      line: expect.objectContaining({
        beforeLineNum: 1,
        afterLineNum: 1,
        content: "foo();",
        afterContent: "  foo();",
      }),
    });
  });

  it("matches re-indented blocks across hunks separated by context lines", () => {
    const result = hideWhitespaceInDisplayItems(
      toItems([
        removed(10, "a();"),
        removed(11, "b();"),
        context(12, 10, "unchanged"),
        added(11, "{wrap && ("),
        added(12, "  a();"),
        added(13, "  b();"),
        added(14, ")}"),
      ]),
      false
    );

    expect(lineTypes(result)).toEqual([
      "added",
      "added",
      "context",
      "context",
      "removed",
      "added",
    ]);
    const contextLines = result.flatMap((item) =>
      item.type === "line" && item.line.type === "context" ? [item.line] : []
    );
    expect(contextLines).toEqual([
      expect.objectContaining({ content: "a();", afterContent: "  a();" }),
      expect.objectContaining({ content: "b();", afterContent: "  b();" }),
    ]);
  });

  it("leaves runs without whitespace-only pairs untouched", () => {
    const items = toItems([
      removed(1, "old();"),
      added(1, "new();"),
      context(2, 2, "same"),
    ]);
    expect(hideWhitespaceInDisplayItems(items, false)).toEqual(items);
  });

  it("does not match across non-line items", () => {
    const collapsed: DiffDisplayItem = {
      type: "collapsed",
      beforeStart: 3,
      afterStart: 3,
      beforeEnd: 10,
      afterEnd: 10,
      lineCount: 8,
      regionKeys: ["hidden-3-3"],
      canExpandFromTop: true,
      canExpandFromBottom: true,
    };
    const items: DiffDisplayItem[] = [
      { type: "line", line: removed(1, "foo();") },
      collapsed,
      { type: "line", line: added(11, "  foo();") },
    ];
    expect(hideWhitespaceInDisplayItems(items, false)).toEqual(items);
  });
});
