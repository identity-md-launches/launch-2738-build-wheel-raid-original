import { z } from "zod";

export const actionSchema = z.enum(["attack", "defend", "heal"]);
export type Action = z.infer<typeof actionSchema>;
const integer = z.number().int().nonnegative().safe();
const decimal = z.string().regex(/^(0|[1-9]\d*)$/);
const hash = z.string().regex(/^0x[\da-f]{64}$/);
export const roundSchema = z.object({
  key: z.string().max(240),
  roundId: decimal,
  work: decimal,
  distanceMm: decimal,
  transactionHash: hash,
  blockHash: hash,
  blockNumber: decimal,
  confirmedAt: z.string(),
  core: z.string().regex(/^0x[\da-f]{40}$/),
  installationId: z.string(),
});
export type Round = z.infer<typeof roundSchema>;
const playerSchema = z.object({
  id: z.string().max(80),
  name: z.string().min(1).max(20),
  score: integer,
});
const turnSchema = z.object({
  roundId: decimal,
  opensAt: integer,
  locksAt: integer,
  choices: z.record(
    z.string(),
    z.object({ action: actionSchema, lockedAt: integer }),
  ),
});
const logSchema = z.object({
  turn: integer,
  round: roundSchema,
  moves: z.array(
    z.object({ name: z.string(), action: actionSchema, points: integer }),
  ),
  damage: integer,
  healing: integer,
  shield: integer,
  retaliation: integer,
  bossHp: integer,
  teamHp: integer,
});
export const roomSchema = z
  .object({
    version: z.literal(1),
    id: z.string().regex(/^[a-z0-9]{6}$/),
    hostId: z.string().max(80),
    revision: integer,
    mode: z.enum(["replay", "live"]),
    phase: z.enum(["lobby", "battle", "victory", "defeat"]),
    players: z.array(playerSchema).min(1).max(4),
    teamHp: integer,
    teamMax: integer,
    bossHp: integer,
    bossMax: integer,
    turn: turnSchema.nullable(),
    logs: z.array(logSchema).max(12),
    processed: z.array(z.string()).max(12),
    raid: integer,
    history: z
      .array(
        z.object({
          raid: integer,
          mode: z.enum(["replay", "live"]),
          result: z.enum(["victory", "defeat"]),
          turns: integer,
          players: z.array(playerSchema),
        }),
      )
      .max(20),
  })
  .superRefine((room, context) => {
    const ids = room.players.map((player) => player.id);
    if (new Set(ids).size !== ids.length || !ids.includes(room.hostId)) {
      context.addIssue({
        code: "custom",
        message: "Saved room has an inconsistent player roster.",
      });
    }
    if (
      room.teamMax === 0 ||
      room.bossMax === 0 ||
      room.teamHp > room.teamMax ||
      room.bossHp > room.bossMax
    ) {
      context.addIssue({
        code: "custom",
        message: "Saved room health is outside its valid range.",
      });
    }
    if (
      room.processed.length !== room.logs.length ||
      new Set(room.processed).size !== room.processed.length ||
      room.logs.some((log) => !room.processed.includes(log.round.key))
    ) {
      context.addIssue({
        code: "custom",
        message: "Saved round receipts do not match the battle log.",
      });
    }
    if (
      room.turn &&
      Object.keys(room.turn.choices).some((id) => !ids.includes(id))
    ) {
      context.addIssue({
        code: "custom",
        message: "Saved choice belongs to an unknown player.",
      });
    }
  });
export type Room = z.infer<typeof roomSchema>;
export const MAX_TURNS = 12;
export const REPLAY_FIRST_ROUND = "486";
export const nameOf = (name: string) =>
  name
    .trim()
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .slice(0, 20);
const change = (room: Room): Room => ({
  ...structuredClone(room),
  revision: room.revision + 1,
});

export function createRoom(
  id: string,
  hostId: string,
  name: string,
  mode: Room["mode"],
): Room {
  return roomSchema.parse({
    version: 1,
    id,
    hostId,
    revision: 0,
    mode,
    phase: "lobby",
    players: [{ id: hostId, name: nameOf(name), score: 0 }],
    teamHp: 120,
    teamMax: 120,
    bossHp: 260,
    bossMax: 260,
    turn: null,
    logs: [],
    processed: [],
    raid: 1,
    history: [],
  });
}
export function joinRoom(room: Room, id: string, name: string): Room {
  if (room.players.some((p) => p.id === id)) return room;
  if (room.phase !== "lobby")
    throw new Error(
      "This raid has started. Join after the host opens a new raid.",
    );
  if (room.players.length >= 4)
    throw new Error("This room is full. Create another room.");
  if (!nameOf(name)) throw new Error("Enter a player name.");
  const next = change(room);
  next.players.push({ id, name: nameOf(name), score: 0 });
  return next;
}
export function scheduleTurn(
  room: Room,
  roundId: string,
  opensAt: number,
  locksAt: number,
): Room {
  const next = change(room);
  next.turn = { roundId, opensAt, locksAt, choices: {} };
  return next;
}
export function startRaid(
  room: Room,
  roundId: string,
  opensAt: number,
  locksAt: number,
): Room {
  if (room.phase !== "lobby") throw new Error("A raid is already in progress.");
  const next = change(room);
  next.phase = "battle";
  next.teamMax = 120 * next.players.length;
  next.teamHp = next.teamMax;
  next.bossMax = 260 * next.players.length;
  next.bossHp = next.bossMax;
  return scheduleTurn(next, roundId, opensAt, locksAt);
}
export function lockChoice(
  room: Room,
  playerId: string,
  action: Action,
  now: number,
  available: boolean,
): Room {
  if (!available)
    throw new Error("The source is paused. Wait for it to reconnect.");
  if (room.phase !== "battle" || !room.turn)
    throw new Error("Ask the host to start the raid.");
  if (!room.players.some((p) => p.id === playerId))
    throw new Error("Join the room first.");
  if (now >= room.turn.locksAt)
    throw new Error(
      "Choices are closed for this round. Defend is the default.",
    );
  if (room.turn.choices[playerId])
    throw new Error("Your move is locked for this round.");
  const next = change(room);
  next.turn!.choices[playerId] = { action, lockedAt: now };
  return next;
}

/** Pure, deterministic reducer. Both live and archived play use this exact combat function. */
export function resolveRound(
  room: Room,
  round: Round,
  now: number,
  available: boolean,
): Room {
  if (!available || room.phase !== "battle" || !room.turn) return room;
  if (room.processed.includes(round.key) || room.turn.roundId !== round.roundId)
    return room;
  if (room.mode === "live" && now < room.turn.opensAt + 600_000) return room;
  if (
    now < room.turn.locksAt &&
    room.players.some((p) => !room.turn!.choices[p.id])
  )
    return room;
  const next = change(room);
  const metres = Number(BigInt(round.distanceMm) / 1000n);
  const attack = 18 + Math.min(30, Math.floor(metres / 15));
  const heal = 14 + Math.min(20, Math.floor(metres / 30));
  const defend = 20 + Math.min(16, Math.floor(metres / 30));
  let damage = 0,
    healing = 0,
    shield = 0;
  const moves = next.players.map((p) => {
    const choice = next.turn!.choices[p.id];
    const action =
      choice && choice.lockedAt < next.turn!.locksAt ? choice.action : "defend";
    const points =
      action === "attack" ? attack : action === "heal" ? heal : defend;
    if (action === "attack") damage += points;
    else if (action === "heal") healing += points;
    else shield += points;
    p.score += points;
    return { name: p.name, action, points };
  });
  next.bossHp = Math.max(0, next.bossHp - damage);
  const actualHeal = Math.min(next.teamMax - next.teamHp, healing);
  const strike =
    (22 + Number(BigInt(round.roundId) % 3n) * 3 + (metres < 10 ? 6 : 0)) *
    next.players.length;
  const retaliation = next.bossHp === 0 ? 0 : Math.max(0, strike - shield);
  next.teamHp = Math.max(
    0,
    Math.min(next.teamMax, next.teamHp + healing) - retaliation,
  );
  next.processed.push(round.key);
  next.logs.push({
    turn: next.logs.length + 1,
    round,
    moves,
    damage,
    healing: actualHeal,
    shield,
    retaliation,
    teamHp: next.teamHp,
    bossHp: next.bossHp,
  });
  next.turn = null;
  if (next.bossHp === 0) next.phase = "victory";
  else if (next.teamHp === 0 || next.logs.length >= MAX_TURNS)
    next.phase = "defeat";
  if (next.phase === "victory" || next.phase === "defeat") {
    next.history.unshift({
      raid: next.raid,
      mode: next.mode,
      result: next.phase,
      turns: next.logs.length,
      players: structuredClone(next.players),
    });
    next.history = next.history.slice(0, 20);
  }
  return next;
}
export function newRaid(room: Room): Room {
  if (room.phase !== "victory" && room.phase !== "defeat")
    throw new Error("Finish the current raid first.");
  const next = change(room);
  next.phase = "lobby";
  next.raid++;
  next.turn = null;
  next.logs = [];
  next.processed = [];
  next.players.forEach((p) => {
    p.score = 0;
  });
  next.teamHp = next.teamMax;
  next.bossHp = next.bossMax;
  return next;
}
