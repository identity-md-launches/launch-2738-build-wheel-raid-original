import { z } from "zod";
import archive from "./data/archive.json";
import { roundSchema, type Round } from "./game";
import { currentRound, roundEndsAt } from "./schedule";

export const API = "https://api.squeekchain.com";
export const PIN = {
  core: archive.core,
  implementation: archive.implementation,
  streamId: archive.streamId,
  installationId: archive.installationId,
};
const uint = z.string().regex(/^(0|[1-9]\d*)$/);
const hex32 = z.string().regex(/^0x[0-9a-f]{64}$/);
const chainSchema = z.object({
  chainId: z.literal("11155111"),
  confirmations: uint,
  safeThroughBlock: uint,
});
export const coreSchema = z.object({
  schemaVersion: z.literal(1),
  status: z.literal("available"),
  installationId: z.literal(PIN.installationId),
  chain: chainSchema,
  identities: z.object({ core: z.literal(PIN.core) }),
  implementation: z.object({
    codeAddress: z.literal(PIN.implementation),
    codeVersion: z.literal("3"),
  }),
  configuration: z.object({
    streamId: z.literal(PIN.streamId),
    genesisTimestamp: z.literal(archive.genesisTimestamp),
    roundDuration: z.literal("600"),
  }),
  core: z.object({ settledThroughRound: uint, paused: z.boolean() }),
});
const eventSchema = z.object({
  type: z.string(),
  eventVersion: z.number(),
  source: z
    .object({
      kind: z.string(),
      chainId: uint.optional(),
      contractAddress: z.string().optional(),
      blockNumber: uint.optional(),
      blockHash: hex32.optional(),
      transactionHash: hex32.optional(),
      confirmationStatus: z.string().optional(),
    })
    .passthrough(),
  occurredAt: z.iso.datetime(),
  payload: z.record(z.string(), z.unknown()),
});
export const feedSchema = z.object({
  schemaVersion: z.literal(3),
  status: z.literal("available"),
  installationId: z.literal(PIN.installationId),
  generatedAt: z.iso.datetime(),
  chain: chainSchema.extend({ safeBlockTimestamp: z.iso.datetime() }),
  identities: z.object({ core: z.literal(PIN.core) }),
  events: z.array(eventSchema),
  nextCursor: z.string().nullable(),
});
const payloadSchema = z.object({
  previousSettledThroughRound: uint,
  settledThroughRound: uint,
  activeRoundCount: uint,
  workAdded: uint,
});
export function roundsFromFeed(input: unknown): Round[] {
  const feed = feedSchema.parse(input);
  if (BigInt(feed.chain.confirmations) < 12n)
    throw new Error("The source requires at least 12 confirmations.");
  const out: Round[] = [];
  for (const event of feed.events) {
    if (event.type !== "system.settlement_completed") continue;
    const s = event.source;
    if (
      event.eventVersion !== 2 ||
      s.kind !== "chain" ||
      s.confirmationStatus !== "safe" ||
      s.chainId !== "11155111" ||
      s.contractAddress !== PIN.core
    ) {
      throw new Error(
        "The settlement identity or confirmation policy changed. Combat is paused.",
      );
    }
    const p = payloadSchema.parse(event.payload);
    if (
      !s.blockNumber ||
      BigInt(s.blockNumber) > BigInt(feed.chain.safeThroughBlock)
    )
      throw new Error("A settlement is ahead of the confirmed frontier.");
    const first = BigInt(p.previousSettledThroughRound) + 1n,
      last = BigInt(p.settledThroughRound);
    if (last < first || last - first > 15n)
      throw new Error("Unsupported settlement span.");
    if (BigInt(p.activeRoundCount) > last - first + 1n)
      throw new Error("Inconsistent active round count.");
    if (
      Date.parse(event.occurredAt) <
        roundEndsAt(
          Number(archive.genesisTimestamp) * 1000,
          p.settledThroughRound,
        ) ||
      Date.parse(event.occurredAt) > Date.parse(feed.chain.safeBlockTimestamp)
    )
      throw new Error(
        "The settlement timestamp is outside the closed, safe round window.",
      );
    // Never divide an aggregate over active rounds. Ambiguous spans remain missing and pause that turn.
    if (first !== last && BigInt(p.workAdded) !== 0n) continue;
    if ((BigInt(p.workAdded) === 0n) !== (BigInt(p.activeRoundCount) === 0n))
      throw new Error("Inconsistent settlement work.");
    if (BigInt(p.workAdded) > 10000n)
      throw new Error("Round work exceeds the published cap.");
    for (let id = first; id <= last; id++) {
      out.push(
        roundSchema.parse({
          key: `${PIN.installationId}:${PIN.core}:${id}`,
          roundId: id.toString(),
          work: p.workAdded,
          distanceMm: (BigInt(p.workAdded) * 878n).toString(),
          transactionHash: s.transactionHash,
          blockHash: s.blockHash,
          blockNumber: s.blockNumber,
          confirmedAt: event.occurredAt,
          core: PIN.core,
          installationId: PIN.installationId,
        }),
      );
    }
  }
  return out.sort((a, b) => (BigInt(a.roundId) < BigInt(b.roundId) ? -1 : 1));
}
export const archivedRounds = roundsFromFeed({
  schemaVersion: 3,
  status: "available",
  installationId: archive.installationId,
  generatedAt: archive.capturedAt,
  chain: archive.chain,
  identities: { core: archive.core },
  events: archive.events,
  nextCursor: null,
});
export const archiveInfo = archive;
export type LiveSnapshot = {
  available: boolean;
  reason: string;
  checkedAt: number;
  currentRound: string;
  genesis: number;
  rounds: Round[];
  safeBlock: string;
  settledThrough: string;
};
export const emptySnapshot: LiveSnapshot = {
  available: false,
  reason: "Checking the official source…",
  checkedAt: 0,
  currentRound: "",
  genesis: Number(archive.genesisTimestamp) * 1000,
  rounds: [],
  safeBlock: "",
  settledThrough: "",
};

export class OfficialSource {
  private retryAt = 0;
  private calibrationAt = 0;
  private previous: LiveSnapshot = emptySnapshot;
  constructor(
    private get: typeof fetch = (...args) => globalThis.fetch(...args),
  ) {}
  private async read(path: string): Promise<unknown> {
    const response = await this.get(`${API}${path}`, {
      signal: AbortSignal.timeout(12_000),
      cache: "no-cache",
      credentials: "omit",
    });
    if (!response.ok) {
      const retry = Number(response.headers.get("Retry-After"));
      this.retryAt =
        Date.now() +
        (Number.isFinite(retry) && retry > 0 ? Math.min(retry, 3600) : 20) *
          1000;
      throw new Error(
        `Official source returned ${response.status}. Retrying automatically.`,
      );
    }
    const value = await response.json();
    if (value.status === "unavailable")
      throw new Error(
        `Official source unavailable: ${String(value.reason || "unknown reason")}.`,
      );
    return value;
  }
  async poll(now = Date.now()): Promise<LiveSnapshot> {
    if (now < this.retryAt)
      return {
        ...this.previous,
        available: false,
        reason: "The source requested a retry delay. Combat stays paused.",
      };
    try {
      const [rawCore, rawFeed, rawStatus] = await Promise.all([
        this.read("/v1/core"),
        this.read("/v1/events?category=protocol&limit=100"),
        this.read("/v1/status"),
      ]);
      const core = coreSchema.parse(rawCore),
        feed = feedSchema.parse(rawFeed);
      const status = z
        .object({
          schemaVersion: z.literal(1),
          installationId: z.literal(PIN.installationId),
          generatedAt: z.iso.datetime(),
          measurement: z.object({
            freshness: z.literal("online"),
            observedAt: z.iso.datetime(),
            staleAfterSeconds: z.number(),
          }),
          settlementQueue: z.object({
            status: z.literal("available"),
            incidentOpen: z.literal(false),
          }),
        })
        .parse(rawStatus);
      if (core.core.paused) throw new Error("SqueekCore settlement is paused.");
      // Keep the accepted clock error smaller than the five-second pre-start lock margin.
      if (Math.abs(now - Date.parse(status.generatedAt)) > 2000) {
        throw new Error(
          "The live clock differs from the official source by over two seconds. Check device time and retry.",
        );
      }
      if (
        now - Date.parse(status.measurement.observedAt) >
        Math.min(status.measurement.staleAfterSeconds, 120) * 1000
      )
        throw new Error(
          "Wheel readings are stale. Combat is paused until fresh data returns.",
        );
      if (
        now - Date.parse(feed.chain.safeBlockTimestamp) > 600_000 ||
        Date.parse(feed.chain.safeBlockTimestamp) > now + 30_000
      )
        throw new Error("The confirmed chain view is stale.");
      if (now - this.calibrationAt > 3_600_000) {
        const stats = z
          .object({
            schemaVersion: z.literal(1),
            installationId: z.literal(PIN.installationId),
            lifetime: z.object({
              acceptedWorkUnits: uint,
              observedDistanceMm: uint,
            }),
          })
          .parse(await this.read("/v1/measurement/stats?range=7d"));
        if (
          BigInt(stats.lifetime.acceptedWorkUnits) === 0n ||
          BigInt(stats.lifetime.acceptedWorkUnits) * 878n !==
            BigInt(stats.lifetime.observedDistanceMm)
        )
          throw new Error(
            "The official distance calibration changed. Combat is paused.",
          );
        this.calibrationAt = now;
      }
      const genesis = Number(core.configuration.genesisTimestamp) * 1000;
      this.previous = {
        available: true,
        reason: "Official source connected",
        checkedAt: now,
        genesis,
        currentRound: currentRound(genesis, now).toString(),
        rounds: roundsFromFeed(feed),
        safeBlock: feed.chain.safeThroughBlock,
        settledThrough: core.core.settledThroughRound,
      };
    } catch (e) {
      const reason =
        e instanceof z.ZodError
          ? "The official response changed or is unavailable. Combat is paused."
          : e instanceof Error
            ? e.message
            : "Unable to reach the official source.";
      this.previous = { ...this.previous, available: false, reason };
    }
    return this.previous;
  }
}
