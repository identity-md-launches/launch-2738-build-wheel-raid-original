import { describe, expect, it } from "vitest";
import { currentRound, futureTurn, roundEndsAt } from "../src/schedule";
import archive from "../src/data/archive.json";

describe("official one-based SqueekCore round lifecycle", () => {
  const genesis = Number(archive.genesisTimestamp) * 1000;
  it("starts round 1 at genesis and assigns a boundary to the next round", () => {
    expect(currentRound(genesis, genesis)).toBe(1);
    expect(currentRound(genesis, genesis + 599_999)).toBe(1);
    expect(currentRound(genesis, genesis + 600_000)).toBe(2);
    expect(() => currentRound(genesis, genesis - 1)).toThrow();
  });
  it("locks choices before an actually future round starts, including near a boundary", () => {
    for (const offset of [0, 300_000, 580_001, 599_999, 600_000]) {
      const now = genesis + offset;
      const turn = futureTurn(genesis, now);
      expect(BigInt(turn.id)).toBeGreaterThan(
        BigInt(currentRound(genesis, now)),
      );
      expect(turn.opens).toBeGreaterThanOrEqual(now + 20_000);
      expect(turn.locks).toBe(turn.opens - 5000);
      expect(currentRound(genesis, turn.opens)).toBe(Number(turn.id));
    }
  });
  it("matches each real archive settlement to the end of its one-based measurement round", () => {
    for (const event of archive.events) {
      const end = roundEndsAt(genesis, event.payload.settledThroughRound);
      expect(Date.parse(event.occurredAt)).toBeGreaterThanOrEqual(end);
      expect(Date.parse(event.occurredAt) - end).toBeLessThan(120_000);
    }
  });
});
