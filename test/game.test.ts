import { describe, expect, it } from "vitest";
import {
  createRoom,
  joinRoom,
  lockChoice,
  newRaid,
  resolveRound,
  scheduleTurn,
  startRaid,
  type Action,
} from "../src/game";
import { archivedRounds } from "../src/source";
import { restoreRoom, saveRoom, storageKey } from "../src/storage";

const now = 1_000_000;
function party() {
  return joinRoom(
    createRoom("abc123", "one", "Nibbles", "replay"),
    "two",
    "Crumb",
  );
}
function battle() {
  return startRaid(party(), archivedRounds[0].roundId, now, now + 60_000);
}
function lockBoth(action: Action = "attack") {
  let room = battle();
  room = lockChoice(room, "one", action, now + 1, true);
  return lockChoice(room, "two", action, now + 2, true);
}
describe("shared combat and choice locking", () => {
  it("two players contribute to the same boss and shared team", () => {
    const room = resolveRound(lockBoth(), archivedRounds[0], now + 3, true);
    expect(room.logs).toHaveLength(1);
    expect(room.logs[0].moves.map((m) => m.name)).toEqual(["Nibbles", "Crumb"]);
    expect(room.logs[0].damage).toBe(86);
    expect(room.bossHp).toBe(434);
    expect(room.teamHp).toBe(196);
  });
  it("a committed move cannot be changed or resent", () => {
    const room = lockChoice(battle(), "one", "attack", now + 1, true);
    expect(() => lockChoice(room, "one", "heal", now + 2, true)).toThrow(
      "locked",
    );
    expect(() => lockChoice(room, "outsider", "attack", now + 1, true)).toThrow(
      "Join",
    );
  });
  it("refuses late moves, using the predeclared Defend default", () => {
    const room = battle();
    expect(() => lockChoice(room, "one", "attack", now + 60_000, true)).toThrow(
      "closed",
    );
    const result = resolveRound(room, archivedRounds[0], now + 60_000, true);
    expect(result.logs[0].moves.every((m) => m.action === "defend")).toBe(true);
    expect(result.bossHp).toBe(result.bossMax);
    expect(result.teamHp).toBe(result.teamMax);
  });
  it("does not reveal while a teammate is choosing", () => {
    const room = lockChoice(battle(), "one", "attack", now + 1, true);
    expect(resolveRound(room, archivedRounds[0], now + 2, true)).toBe(room);
  });
  it("processes each confirmed round exactly once, including a repeated poll after scheduling", () => {
    const result = resolveRound(lockBoth(), archivedRounds[0], now + 3, true);
    expect(resolveRound(result, archivedRounds[0], now + 4, true)).toBe(result);
    const next = scheduleTurn(
      result,
      archivedRounds[1].roundId,
      now,
      now + 60_000,
    );
    expect(resolveRound(next, archivedRounds[0], now + 70_000, true)).toBe(
      next,
    );
    expect(result.processed).toHaveLength(1);
  });
  it("pauses HP changes and choices during a source outage", () => {
    const room = lockBoth();
    expect(resolveRound(room, archivedRounds[0], now + 60_000, false)).toBe(
      room,
    );
    expect(() => lockChoice(battle(), "one", "attack", now + 1, false)).toThrow(
      "paused",
    );
    expect(
      resolveRound(room, archivedRounds[0], now + 60_000, true).logs,
    ).toHaveLength(1);
  });
  it("does not apply an early live result, even after everyone locks", () => {
    const room = { ...lockBoth(), mode: "live" as const };
    expect(resolveRound(room, archivedRounds[0], now + 59_999, true)).toBe(
      room,
    );
    expect(
      resolveRound(room, archivedRounds[0], now + 600_000, true).logs,
    ).toHaveLength(1);
  });
  it("a player cannot join after roster lock", () => {
    expect(() => joinRoom(battle(), "late", "Late")).toThrow("started");
  });
  it("rounds are chronological and never applied to the wrong target", () => {
    const room = lockBoth();
    expect(resolveRound(room, archivedRounds[1], now + 3, true)).toBe(room);
  });
  it("all attacks reach defeat, and a coordinated attack/defend/heal strategy can reach victory", () => {
    let room = startRaid(
      createRoom("abc123", "one", "Nibbles", "replay"),
      "486",
      now,
      now + 1000,
    );
    for (let i = 0; i < 12 && room.phase === "battle"; i++) {
      if (!room.turn)
        room = scheduleTurn(room, archivedRounds[i].roundId, now, now + 1000);
      room = lockChoice(room, "one", "attack", now + 1, true);
      room = resolveRound(room, archivedRounds[i], now + 2, true);
    }
    expect(room.phase).toBe("defeat");
    room = startRaid(
      createRoom("abc123", "one", "Nibbles", "replay"),
      "486",
      now,
      now + 1000,
    );
    const strategy: Action[] = [
      "attack",
      "attack",
      "heal",
      "attack",
      "attack",
      "heal",
      "attack",
      "attack",
    ];
    for (let i = 0; i < strategy.length && room.phase === "battle"; i++) {
      if (!room.turn)
        room = scheduleTurn(room, archivedRounds[i].roundId, now, now + 1000);
      room = lockChoice(room, "one", strategy[i], now + 1, true);
      room = resolveRound(room, archivedRounds[i], now + 2, true);
    }
    expect(room.phase).toBe("victory");
    expect(room.history[0].result).toBe("victory");
    const replay = newRaid(room);
    expect(replay.phase).toBe("lobby");
    expect(replay.logs).toHaveLength(0);
    expect(replay.history).toHaveLength(1);
  });
  it("bounds every HP value across every three-move combination for two players", () => {
    for (const a of ["attack", "defend", "heal"] as Action[])
      for (const b of ["attack", "defend", "heal"] as Action[]) {
        let room = battle();
        room.teamHp = 100;
        room = lockChoice(room, "one", a, now + 1, true);
        room = lockChoice(room, "two", b, now + 1, true);
        room = resolveRound(room, archivedRounds[0], now + 2, true);
        expect(room.teamHp).toBeGreaterThanOrEqual(0);
        expect(room.teamHp).toBeLessThanOrEqual(room.teamMax);
        expect(room.bossHp).toBeGreaterThanOrEqual(0);
        expect(room.bossHp).toBeLessThanOrEqual(room.bossMax);
      }
  });
});
describe("restart recovery and atomic persistence", () => {
  it("restores locked moves, then restores a processed round without dealing damage twice", () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
    };
    saveRoom(storage, lockBoth());
    const restored = restoreRoom(storage, "abc123")!;
    expect(restored.turn?.choices.one.action).toBe("attack");
    const resolved = resolveRound(restored, archivedRounds[0], now + 3, true);
    saveRoom(storage, resolved);
    const restarted = restoreRoom(storage, "abc123")!;
    expect(restarted.bossHp).toBe(resolved.bossHp);
    expect(resolveRound(restarted, archivedRounds[0], now + 4, true)).toBe(
      restarted,
    );
  });
  it("fails loudly on corrupt or mismatched saves", () => {
    expect(() => restoreRoom({ getItem: () => "{broken" }, "abc123")).toThrow();
    const wrong = JSON.stringify(
      createRoom("xyz789", "one", "Nibbles", "replay"),
    );
    expect(() => restoreRoom({ getItem: () => wrong }, "abc123")).toThrow(
      "identity",
    );
    expect(storageKey("abc123")).toBe("wheel-raid:room:abc123");
  });
  it("rejects an inconsistent processed receipt rather than replaying it after restart", () => {
    const room = resolveRound(lockBoth(), archivedRounds[0], now + 3, true);
    room.processed = [];
    expect(() =>
      restoreRoom({ getItem: () => JSON.stringify(room) }, "abc123"),
    ).toThrow("receipts");
  });
});
