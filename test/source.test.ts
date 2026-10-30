import { describe, expect, it, vi } from "vitest";
import archive from "../src/data/archive.json";
import {
  OfficialSource,
  PIN,
  archivedRounds,
  roundsFromFeed,
} from "../src/source";
import { decodeSignal, encodeSignal } from "../src/peer";

const feed = () => ({
  schemaVersion: 3,
  status: "available",
  installationId: archive.installationId,
  generatedAt: archive.capturedAt,
  chain: archive.chain,
  identities: { core: archive.core },
  events: structuredClone(archive.events),
  nextCursor: null,
});
describe("official evidence adapter", () => {
  it("calls the browser fetch with its correct global receiver", async () => {
    vi.stubGlobal("fetch", function (this: unknown) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      return Promise.resolve(
        new Response(
          JSON.stringify({ status: "unavailable", reason: "receiver_test" }),
        ),
      );
    });
    try {
      const result = await new OfficialSource().poll();
      expect(result.reason).toContain("receiver_test");
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("uses 12 actual consecutive safe rounds and computes exact estimated distance", () => {
    expect(archivedRounds).toHaveLength(12);
    expect(archivedRounds.map((r) => r.roundId)).toEqual(
      Array.from({ length: 12 }, (_, i) => (486 + i).toString()),
    );
    for (const round of archivedRounds)
      expect(BigInt(round.distanceMm)).toBe(BigInt(round.work) * 878n);
    expect(BigInt(archive.calibration.observedDistanceMm)).toBe(
      BigInt(archive.calibration.acceptedWorkUnits) * 878n,
    );
  });
  it("rejects unavailable, changed schema, wrong identity, unsafe and unconfirmed responses", () => {
    expect(() =>
      roundsFromFeed({ ...feed(), status: "unavailable" }),
    ).toThrow();
    expect(() => roundsFromFeed({ ...feed(), schemaVersion: 4 })).toThrow();
    expect(() =>
      roundsFromFeed({ ...feed(), identities: { core: "different" } }),
    ).toThrow();
    const unsafe = feed();
    unsafe.events[0].source.confirmationStatus = "submitted";
    expect(() => roundsFromFeed(unsafe)).toThrow("identity");
    const ahead = feed();
    ahead.chain = { ...ahead.chain, safeThroughBlock: "1" };
    expect(() => roundsFromFeed(ahead)).toThrow("frontier");
    expect(() =>
      roundsFromFeed({
        ...feed(),
        chain: { ...archive.chain, confirmations: "1" },
      }),
    ).toThrow("12 confirmations");
  });
  it("never apportions a multi-round nonzero aggregate and supports exact zero batches", () => {
    const input = feed();
    input.events = [input.events[0]];
    input.events[0].payload.previousSettledThroughRound = "484";
    expect(roundsFromFeed(input)).toEqual([]);
    input.events[0].payload.workAdded = "0";
    input.events[0].payload.activeRoundCount = "0";
    expect(roundsFromFeed(input).map((r) => [r.roundId, r.work])).toEqual([
      ["485", "0"],
      ["486", "0"],
    ]);
  });
  it("rejects a claimed settlement that predates its measurement round closure", () => {
    const input = feed();
    input.events[0].occurredAt = new Date(
      Number(archive.genesisTimestamp) * 1000,
    ).toISOString();
    expect(() => roundsFromFeed(input)).toThrow("closed, safe");
  });
  it("treats HTTP 200 unavailable as an outage, preserving the last confirmed snapshot", async () => {
    const mock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            status: "unavailable",
            reason: "indexer_unavailable",
          }),
        ),
    );
    const source = new OfficialSource(mock);
    const result = await source.poll();
    expect(result.available).toBe(false);
    expect(result.reason).toContain("indexer_unavailable");
    expect(result.rounds).toEqual([]);
  });
  it("survives successful poll, network outage, and recovery without inventing rounds", async () => {
    const now = Date.parse(archive.capturedAt);
    let outage = false;
    const mock = vi.fn(async (input: RequestInfo | URL) => {
      if (outage) throw new TypeError("Network unavailable");
      const url = String(input);
      const body = url.includes("/v1/core")
        ? {
            schemaVersion: 1,
            status: "available",
            installationId: PIN.installationId,
            chain: archive.chain,
            identities: { core: PIN.core },
            implementation: {
              codeAddress: PIN.implementation,
              codeVersion: "3",
            },
            configuration: {
              streamId: PIN.streamId,
              genesisTimestamp: archive.genesisTimestamp,
              roundDuration: "600",
            },
            core: { settledThroughRound: "597", paused: false },
          }
        : url.includes("/v1/status")
          ? {
              schemaVersion: 1,
              installationId: PIN.installationId,
              generatedAt: archive.capturedAt,
              measurement: {
                freshness: "online",
                observedAt: archive.capturedAt,
                staleAfterSeconds: 120,
              },
              settlementQueue: { status: "available", incidentOpen: false },
            }
          : url.includes("/stats")
            ? {
                schemaVersion: 1,
                installationId: PIN.installationId,
                lifetime: archive.calibration,
              }
            : {
                ...feed(),
                chain: {
                  ...archive.chain,
                  safeBlockTimestamp: archive.capturedAt,
                },
              };
      return new Response(JSON.stringify(body));
    });
    const source = new OfficialSource(mock as typeof fetch);
    const first = await source.poll(now);
    expect(first.available).toBe(true);
    expect(first.rounds).toHaveLength(12);
    outage = true;
    const failed = await source.poll(now + 1000);
    expect(failed.available).toBe(false);
    expect(failed.rounds).toEqual(first.rounds);
    outage = false;
    expect((await source.poll(now + 2000)).available).toBe(true);
    const skewed = await source.poll(now + 60_000);
    expect(skewed.available).toBe(false);
    expect(skewed.reason).toContain("clock");
  });
  it("rejects malformed direct invite codes and preserves valid signals", () => {
    const signal = {
      version: 1 as const,
      room: "abc123",
      type: "offer" as const,
      sdp: "v=0\r\nThis is a test session description",
    };
    expect(decodeSignal(encodeSignal(signal))).toEqual(signal);
    expect(() => decodeSignal("abc123")).toThrow("full");
    expect(() => decodeSignal("wr1.incomplete")).toThrow("invalid");
  });
});
