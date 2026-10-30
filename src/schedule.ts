const ROUND_MS = 600_000;

/** SqueekCore V3: round 1 starts at genesis, not round 0. */
export function currentRound(genesis: number, now: number): number {
  if (now < genesis) throw new Error("Squeekchain has not started yet.");
  return Math.floor((now - genesis) / ROUND_MS) + 1;
}

export function futureTurn(genesis: number, now: number) {
  let id = currentRound(genesis, now) + 1;
  let opens = genesis + (id - 1) * ROUND_MS;
  if (opens - now < 20_000) {
    id++;
    opens += ROUND_MS;
  }
  return { id: id.toString(), opens, locks: opens - 5000 };
}

export function roundEndsAt(genesis: number, roundId: string): number {
  return genesis + Number(BigInt(roundId)) * ROUND_MS;
}
