import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { computeCardDimensions } from "../utils/cardUtils";

// ========== Generators ==========

/** Positive integer excluding 2738 (the 8-color split case). */
const positiveNon2738 = fc
  .integer({ min: 1, max: 100_000 })
  .filter((n) => n !== 2738);

// ========== Tests ==========

describe("Feature: swatch-style-toggle, Property 2: card grid dimension correctness", () => {
  /**
   * **Validates: Requirements 4.1**
   *
   * For any positive integer total (total ≠ 2738), computeCardDimensions(total)
   * returns { cols } where:
   *   1. cols === Math.ceil(Math.sqrt(total))
   *   2. cols * cols >= total  (grid can hold all colors)
   *   3. (cols - 1) * (cols - 1) < total  (cols is the minimal value)
   */
  it("cols === Math.ceil(Math.sqrt(total))，方阵能容纳所有颜色且列数最小", () => {
    fc.assert(
      fc.property(positiveNon2738, (total) => {
        const result = computeCardDimensions(total);

        // Non-2738 path always returns single cols
        expect("cols" in result).toBe(true);

        const { cols } = result as { cols: number };
        const expected = Math.ceil(Math.sqrt(total));

        // Property 1: cols matches ceil(sqrt(total))
        expect(cols).toBe(expected);

        // Property 2: grid can hold all colors
        expect(cols * cols).toBeGreaterThanOrEqual(total);

        // Property 3: cols is the minimal sufficient value
        expect((cols - 1) * (cols - 1)).toBeLessThan(total);
      }),
      { numRuns: 100 },
    );
  });
});
