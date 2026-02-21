# Smart Partial Hashline Re-Read Implementation Plan

## Problem

When hash mismatch occurs in hashline editing, current implementation requires re-reading ENTIRE file. This wastes tokens on lines that were already cached and still have valid hashes.

**Example Waste:**
- File has 1000 lines
- User reads file once: ~12,000 tokens (hashline mode)
- User edits line 500: hash mismatch occurs
- User must re-read entire file: another ~12,000 tokens
- Total: ~24,000 tokens for one edit
- But only lines 501-1000 need fresh hashes (500 lines)
- Waste: ~11,000 tokens reading lines 1-499 and 501-1000 again

## Solution

Implement smart partial re-read that only re-reads affected lines (those with invalid hashes) instead of entire file.

## Affected Files

- `packages/coding-agent/src/core/tools/hashline.ts` - Core hashline logic
- `packages/coding-agent/src/core/tools/edit.ts` - Edit tool integration
- `packages/coding-agent/src/core/tools/read.ts` - May need partial read support
- `packages/coding-agent/test/tools.test.ts` - Tests for hashline

## Implementation Steps

### Step 1: Modify hashline.ts - Add affected range tracking

**File:** `packages/coding-agent/src/core/tools/hashline.ts`

**Changes:**

1. Add interface to track which line ranges are affected:
```typescript
export interface AffectedLineRange {
  startLine: number;
  endLine: number;
}
```

2. Modify `resolveLineRef` to return affected range:
```typescript
export function resolveLineRef(
  ref: HashlineRef,
  fileLines: string[]
): { ref: HashlineRef; affectedRange: AffectedLineRange | undefined } {
  // Existing validation logic...
  
  // NEW: Determine affected line range
  const affectedRange: AffectedLineRange = {
    startLine: Math.max(1, ref.line - RECOVERY_WINDOW),
    endLine: Math.min(fileLines.length, ref.line + RECOVERY_WINDOW),
  };
  
  return { ref, affectedRange };
}
```

3. Update error messages to mention partial re-read:
```typescript
// Update error messages
throw new Error(
  `Hash mismatch for line ${ref.line}. Expected ${ref.hash}, found ${actualHash}. Only lines ${affectedRange.startLine}-${affectedRange.endLine} need to be re-read.`
);
```

### Step 2: Modify edit.ts - Integrate affected range tracking

**File:** `packages/coding-agent/src/core/tools/edit.ts`

**Changes:**

1. Import AffectedLineRange type:
```typescript
import { type AffectedLineRange } from "./hashline.js";
```

2. Collect affected ranges from all edits:
```typescript
const allAffectedRanges: AffectedLineRange[] = [];
for (const edit of edits) {
  if ("set_line" in edit) {
    const { affectedRange } = resolveLineRef(parseLineRef(edit.set_line.anchor), originalLines);
    if (affectedRange) allAffectedRanges.push(affectedRange);
  }
  // Similar logic for replace_lines and insert_after
}
```

3. Determine union of all affected ranges:
```typescript
const unionOfRanges = mergeRanges(allAffectedRanges);
```

4. Return affected ranges in tool details:
```typescript
export interface EditToolDetails {
  diff: string;
  firstChangedLine?: number;
  affectedLineRanges?: AffectedLineRange[];  // NEW
}
```

### Step 3: Modify read.ts - Add partial re-read support

**File:** `packages/coding-agent/src/core/tools/read.ts`

**Changes:**

1. Add optional `ranges` parameter to support reading specific line ranges:
```typescript
const readSchema = Type.Object({
  path: Type.String({ description: "Path to the file to read (relative or absolute)" }),
  offset: Type.Optional(Type.Number({ description: "Line number to start reading from (1-indexed)" })),
  limit: Type.Optional(Type.Number({ description: "Maximum number of lines to read" })),
  // NEW: Support reading specific line ranges
  ranges: Type.Optional(Type.Array(Type.Object({
    start: Type.Number({ description: "Start line of range (1-indexed, inclusive)" }),
    end: Type.Number({ description: "End line of range (1-indexed, inclusive)" }),
  }))),
});
```

2. Add logic to read specific ranges:
```typescript
function readLineRange(content: string, start: number, end: number): string {
  const lines = content.split("\n");
  return lines.slice(start - 1, end).join("\n");
}
```

### Step 4: Update hashline.ts - Implement range merge utility

**File:** `packages/coding-agent/src/core/tools/hashline.ts`

**Changes:**

1. Add function to merge overlapping ranges:
```typescript
function mergeRanges(ranges: AffectedLineRange[]): AffectedLineRange[] {
  if (ranges.length === 0) return [];
  
  // Sort ranges by start line
  const sorted = [...ranges].sort((a, b) => a.startLine - b.startLine);
  
  const merged: AffectedLineRange[] = [];
  
  for (const range of sorted) {
    // Check overlap with last merged range
    if (merged.length > 0) {
      const last = merged[merged.length - 1];
      
      if (range.startLine <= last.endLine) {
        // Overlap: extend last range
        last.endLine = Math.max(last.endLine, range.endLine);
        continue;
      }
      
      // No overlap: add new range
      merged.push(range);
    } else {
      merged.push(range);
    }
  }
  
  return merged;
}
```

### Step 5: Update tools.test.ts - Add tests for partial re-read

**File:** `packages/coding-agent/test/tools.test.ts`

**New Tests to Add:**

1. Test that affected range is correctly identified:
```typescript
it("should identify affected line range on hash mismatch", () => {
  const { affectedRange } = resolveLineRef(
    { line: 10, hash: "abc123" },
    createTestFileContent(20)
  );
  
  expect(affectedRange).toEqual({ startLine: 2, endLine: 18 });
});
```

2. Test that overlapping ranges are merged correctly:
```typescript
it("should merge overlapping affected ranges", () => {
  const ranges: [
    { startLine: 5, endLine: 10 },
    { startLine: 8, endLine: 15 },
  ];
  
  const merged = mergeRanges(ranges);
  expect(merged).toEqual([{ startLine: 5, endLine: 15 }]);
});
```

3. Test that partial re-read only reads affected lines:
```typescript
it("should re-read only affected lines on hash mismatch", async () => {
  const testFile = createTestFileContent(100);
  
  // Mock partial read function
  const partialContent = readLineRange(testFile, 45, 55);
  
  expect(partialContent.split("\n").length).toBe(11); // Only 11 lines, not 100
});
```

### Step 6: Verify backward compatibility

**Testing:**

1. Ensure all existing hashline tests still pass
2. Ensure hashline edit operations work correctly
3. Ensure recovery window still works for hash mismatches
4. Test that affected range tracking doesn't break existing functionality

## Success Criteria

- [ ] Affected line ranges are correctly identified on hash mismatch
- [ ] Partial re-read reads only affected line ranges
- [ ] Token waste is reduced from ~11,000 to ~120 for single edit
- [ ] All existing hashline tests pass
- [ ] New tests for partial re-read pass
- [ ] Backward compatibility maintained

## Testing Strategy

1. Run existing hashline tests: `npm test -- test/hashline-concurrency-stress.test.ts --test/tools.test.ts`
2. Run new partial re-read tests
3. Manual testing with real code files to verify token savings
4. Test with various file sizes (small, medium, large) to ensure scalability
