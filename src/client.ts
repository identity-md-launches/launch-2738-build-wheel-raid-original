import { z } from "zod";
import {
  createRoom,
  joinRoom,
  lockChoice,
  newRaid,
  resolveRound,
  roomSchema,
  scheduleTurn,
  startRaid,
  type Action,
  type Room,
} from "./game";
import {
  archivedRounds,
  emptySnapshot,
  OfficialSource,
  type LiveSnapshot,
} from "./source";
import { restoreRoom, saveRoom } from "./storage";
import { DirectPeer, decodeSignal } from "./peer";
import { futureTurn } from "./schedule";

export type View = {
  room: Room | null;
  error: string;
  live: LiveSnapshot;
  connected: boolean;
  hosting: boolean;
  peerStatus: string;
  lastSeen: number;
  notice: string;
};
const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hello"),
    room: z.string(),
    playerId: z.string().max(80),
    name: z.string().min(1).max(20),
  }),
  z.object({
    type: z.literal("move"),
    room: z.string(),
    playerId: z.string().max(80),
    roundId: z.string(),
    raid: z.number(),
    action: z.enum(["attack", "defend", "heal"]),
  }),
]);
const envelope = z.object({
  room: z.string(),
  from: z.string(),
  kind: z.enum(["snapshot", "command", "error"]),
  data: z.unknown(),
});

export class GameClient {
  playerId: string;
  private channel: BroadcastChannel;
  private room: Room | null = null;
  private source = new OfficialSource();
  private view: View = {
    room: null,
    error: "",
    live: emptySnapshot,
    connected: false,
    hosting: false,
    peerStatus: "",
    lastSeen: 0,
    notice: "",
  };
  private listeners = new Set<() => void>();
  private name = "";
  private joinedId = "";
  private timer: ReturnType<typeof setInterval>;
  private peers = new Set<DirectPeer>();
  private pending?: DirectPeer;
  private releaseLock?: () => void;
  private busyPoll = false;
  private revealAt = 0;
  private lastHello = 0;
  private pollAt = 0;
  private initialWallTime = Date.now();
  private initialMonotonicTime = performance.now();
  constructor() {
    this.playerId =
      sessionStorage.getItem("wheel-raid:player") || crypto.randomUUID();
    sessionStorage.setItem("wheel-raid:player", this.playerId);
    this.channel = new BroadcastChannel("wheel-raid:v1");
    this.channel.onmessage = (e) => this.receive(e.data);
    this.timer = setInterval(() => this.tick(), 500);
    this.recover();
    void this.poll();
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.view;
  private update(patch: Partial<View>) {
    this.view = { ...this.view, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  clearError() {
    this.update({ error: "" });
  }
  report(error: unknown) {
    this.update({
      error:
        error instanceof Error
          ? error.message
          : "Unable to complete this action. Try again.",
    });
  }
  private session() {
    sessionStorage.setItem(
      "wheel-raid:session",
      JSON.stringify({
        room: this.joinedId,
        name: this.name,
        host: this.view.hosting,
      }),
    );
  }
  private recover() {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("wheel-raid:session") || "null",
      );
      if (!saved || !/^[a-z0-9]{6}$/.test(saved.room)) return;
      this.joinedId = saved.room;
      this.name = String(saved.name).slice(0, 20);
      const room = restoreRoom(localStorage, saved.room);
      if (room) {
        this.room = room;
        this.update({
          room,
          notice:
            "Saved raid restored. Locked moves and processed rounds were kept.",
        });
      }
      if (saved.host && room?.hostId === this.playerId)
        void this.becomeHost(room);
      else this.sendHello();
    } catch {
      this.report(
        new Error(
          "Saved raid could not be read. Create a new room to continue.",
        ),
      );
    }
  }
  private async becomeHost(room: Room) {
    if (!navigator.locks) {
      this.report(
        new Error(
          "Hosting needs a browser with Web Locks. Update Safari or Chrome.",
        ),
      );
      return;
    }
    await navigator.locks
      .request(
        `wheel-raid:host:${room.id}`,
        { ifAvailable: true },
        async (lock) => {
          if (!lock) {
            this.report(
              new Error(
                "This room is hosted in another tab. Return to that tab.",
              ),
            );
            return;
          }
          this.playerId = room.hostId;
          sessionStorage.setItem("wheel-raid:player", this.playerId);
          this.room = room;
          this.joinedId = room.id;
          this.update({ hosting: true, connected: true, lastSeen: Date.now() });
          this.session();
          this.commit(room);
          localStorage.setItem("wheel-raid:lastHosted", room.id);
          await new Promise<void>((resolve) => {
            this.releaseLock = resolve;
          });
        },
      )
      .catch((error) => this.report(error));
  }
  savedHost() {
    try {
      const id = localStorage.getItem("wheel-raid:lastHosted");
      const saved = id ? restoreRoom(localStorage, id) : null;
      return saved;
    } catch {
      return null;
    }
  }
  resume() {
    const saved = this.savedHost();
    if (!saved) return;
    this.name = saved.players.find((p) => p.id === saved.hostId)!.name;
    void this.becomeHost(saved);
  }
  async create(name: string, mode: Room["mode"]) {
    try {
      if (!name.trim()) throw new Error("Enter a player name.");
      this.leave();
      this.name = name.trim().slice(0, 20);
      const bytes = crypto.getRandomValues(new Uint8Array(6));
      const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
      const id = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join(
        "",
      );
      const room = createRoom(id, this.playerId, this.name, mode);
      void this.becomeHost(room);
    } catch (e) {
      this.report(e);
    }
  }
  join(id: string, name: string) {
    try {
      if (!/^[a-z0-9]{6}$/.test(id.trim().toLowerCase()))
        throw new Error("Enter the six-character room code.");
      if (!name.trim()) throw new Error("Enter a player name.");
      this.leave();
      this.joinedId = id.trim().toLowerCase();
      this.name = name.trim().slice(0, 20);
      this.session();
      this.sendHello();
      this.update({
        notice:
          "Looking for the host in this browser. On another device, exchange direct invite codes below.",
      });
    } catch (e) {
      this.report(e);
    }
  }
  private sendHello() {
    if (!this.joinedId) return;
    this.send({
      type: "hello",
      room: this.joinedId,
      playerId: this.playerId,
      name: this.name,
    });
  }
  private send(command: z.infer<typeof commandSchema>) {
    const message = {
      kind: "command",
      room: command.room,
      from: this.playerId,
      data: command,
    };
    if (this.view.hosting) this.handleCommand(command);
    else {
      this.channel.postMessage(message);
      this.peers.forEach((p) => p.send(message));
    }
  }
  private receive(raw: unknown, peer?: DirectPeer) {
    const parsed = envelope.safeParse(raw);
    if (!parsed.success) return;
    const message = parsed.data;
    if (message.room !== this.joinedId || message.from === this.playerId)
      return;
    if (message.kind === "command" && this.view.hosting) {
      const cmd = commandSchema.safeParse(message.data);
      if (!cmd.success || cmd.data.playerId !== message.from) return;
      try {
        this.handleCommand(cmd.data);
      } catch (e) {
        const response = {
          kind: "error",
          room: this.joinedId,
          from: this.playerId,
          data: {
            to: message.from,
            text:
              e instanceof Error ? e.message : "The host rejected this action.",
          },
        };
        if (peer) peer.send(response);
        else this.channel.postMessage(response);
      }
    } else if (message.kind === "snapshot" && !this.view.hosting) {
      const data = z
        .object({
          room: roomSchema,
          available: z.boolean(),
          reason: z.string(),
        })
        .safeParse(message.data);
      if (
        !data.success ||
        data.data.room.hostId !== message.from ||
        data.data.room.id !== this.joinedId
      )
        return;
      if (this.room && this.room.hostId !== message.from) return;
      if (this.room && data.data.room.revision < this.room.revision) return;
      if (!data.data.room.players.some((p) => p.id === this.playerId)) return;
      try {
        saveRoom(localStorage, data.data.room);
      } catch {
        this.report(
          new Error(
            "Browser storage is full or disabled. Enable it before playing.",
          ),
        );
        return;
      }
      this.room = data.data.room;
      this.update({
        room: this.room,
        connected: true,
        lastSeen: Date.now(),
        notice: "",
        live: {
          ...this.view.live,
          available: data.data.available,
          reason: data.data.reason,
        },
      });
    } else if (message.kind === "error" && !this.view.hosting) {
      const data = z
        .object({ to: z.string(), text: z.string().max(200) })
        .safeParse(message.data);
      if (data.success && data.data.to === this.playerId)
        this.report(new Error(data.data.text));
    }
  }
  private handleCommand(command: z.infer<typeof commandSchema>) {
    if (!this.room || command.room !== this.room.id) return;
    if (command.type === "hello") {
      const next = joinRoom(this.room, command.playerId, command.name);
      this.commit(next);
    } else {
      if (
        command.roundId !== this.room.turn?.roundId ||
        command.raid !== this.room.raid
      )
        throw new Error(
          "That move belongs to an earlier turn. Select a move for this turn.",
        );
      this.commit(
        lockChoice(
          this.room,
          command.playerId,
          command.action,
          Date.now(),
          this.available(),
        ),
      );
    }
  }
  private available() {
    if (this.room?.mode === "replay") return true;
    const clockDrift =
      Date.now() -
      this.initialWallTime -
      (performance.now() - this.initialMonotonicTime);
    if (Math.abs(clockDrift) > 1000) {
      if (this.view.live.available)
        this.update({
          live: {
            ...this.view.live,
            available: false,
            reason:
              "Device time changed. Reload to resync before locking a live move.",
          },
        });
      return false;
    }
    return (
      this.view.live.available && Date.now() - this.view.live.checkedAt < 45_000
    );
  }
  private commit(room: Room) {
    try {
      saveRoom(localStorage, room);
    } catch {
      this.update({ connected: false });
      throw new Error(
        "Unable to save the raid. Free browser storage, then reload. Combat is paused.",
      );
    }
    this.room = room;
    this.update({ room });
    this.broadcast();
  }
  private broadcast() {
    if (!this.room || !this.view.hosting) return;
    const message = {
      kind: "snapshot",
      room: this.room.id,
      from: this.playerId,
      data: {
        room: this.room,
        available: this.available(),
        reason: this.view.live.reason,
      },
    };
    this.channel.postMessage(message);
    this.peers.forEach((p) => p.send(message));
  }
  private nextTiming() {
    if (this.room?.mode === "replay")
      return {
        id: (486 + this.room.logs.length).toString(),
        opens: Date.now(),
        locks: Date.now() + 60_000,
      };
    return futureTurn(this.view.live.genesis, Date.now());
  }
  start() {
    try {
      if (!this.view.hosting || !this.room) return;
      if (!this.available())
        throw new Error(
          "The official source is paused. Retry it before starting a live raid.",
        );
      const t = this.nextTiming();
      this.commit(startRaid(this.room, t.id, t.opens, t.locks));
    } catch (e) {
      this.report(e);
    }
  }
  move(action: Action) {
    try {
      if (!this.room?.turn || !this.view.connected)
        throw new Error("Reconnect with the host before locking a move.");
      this.send({
        type: "move",
        room: this.room.id,
        playerId: this.playerId,
        roundId: this.room.turn.roundId,
        raid: this.room.raid,
        action,
      });
    } catch (e) {
      this.report(e);
    }
  }
  replay() {
    try {
      if (this.view.hosting && this.room) this.commit(newRaid(this.room));
    } catch (e) {
      this.report(e);
    }
  }
  async poll() {
    if (this.busyPoll) return;
    this.busyPoll = true;
    const live = await this.source.poll();
    this.busyPoll = false;
    if (this.view.hosting || !this.room) this.update({ live });
    this.broadcast();
  }
  private tick() {
    const now = Date.now();
    if (now - this.pollAt > 20_000) {
      this.pollAt = now;
      void this.poll();
    }
    if (this.joinedId && now - this.lastHello > 2000) {
      this.lastHello = now;
      if (this.view.hosting) this.broadcast();
      else this.sendHello();
    }
    if (
      !this.view.hosting &&
      this.view.connected &&
      now - this.view.lastSeen > 7000
    )
      this.update({ connected: false });
    if (
      !this.view.hosting ||
      !this.view.connected ||
      !this.room ||
      this.room.phase !== "battle" ||
      !this.available()
    )
      return;
    try {
      if (!this.room.turn) {
        const t = this.nextTiming();
        this.revealAt = 0;
        this.commit(scheduleTurn(this.room, t.id, t.opens, t.locks));
        return;
      }
      if (this.room.mode === "replay") {
        const allLocked = this.room.players.every(
          (p) => this.room!.turn!.choices[p.id],
        );
        if (!allLocked && now < this.room.turn.locksAt) return;
        if (!this.revealAt) {
          this.revealAt = now + 1200;
          return;
        }
        if (now < this.revealAt) return;
        const round = archivedRounds.find(
          (r) => r.roundId === this.room!.turn!.roundId,
        );
        if (round) this.commit(resolveRound(this.room, round, now, true));
      } else {
        const round = this.view.live.rounds.find(
          (r) => r.roundId === this.room!.turn!.roundId,
        );
        if (round) {
          const next = resolveRound(this.room, round, now, true);
          if (next !== this.room) this.commit(next);
        } else if (
          BigInt(this.view.live.settledThrough || "0") >=
          BigInt(this.room.turn.roundId)
        ) {
          this.update({
            notice:
              "This round is missing from the exact public history. Combat is paused; retry the source. No aggregate was guessed.",
          });
        }
      }
    } catch (e) {
      this.report(e);
    }
  }
  private attach(peer: DirectPeer) {
    this.peers.add(peer);
    peer.onMessage = (data) => this.receive(data, peer);
    peer.onStatus = (status) => {
      this.update({ peerStatus: status });
      if (status === "connected") {
        this.sendHello();
        this.broadcast();
      }
    };
  }
  async makeInvite() {
    if (!this.view.hosting || !this.room)
      throw new Error("Create a room first.");
    const peer = new DirectPeer();
    this.attach(peer);
    this.pending = peer;
    return peer.offer(this.room.id);
  }
  async joinInvite(code: string, name: string) {
    const signal = decodeSignal(code);
    if (signal.type !== "offer")
      throw new Error("Paste the host’s invite code.");
    if (!name.trim()) throw new Error("Enter a player name first.");
    this.join(signal.room, name);
    if (!this.joinedId) throw new Error("Enter a player name first.");
    const peer = new DirectPeer();
    this.attach(peer);
    return peer.answer(signal);
  }
  async acceptReply(code: string) {
    const signal = decodeSignal(code);
    if (!this.pending || signal.room !== this.room?.id)
      throw new Error("Generate an invite for this room first.");
    await this.pending.accept(signal);
  }
  leave() {
    this.releaseLock?.();
    this.releaseLock = undefined;
    this.peers.forEach((p) => p.close());
    this.peers.clear();
    this.pending = undefined;
    this.room = null;
    this.joinedId = "";
    this.revealAt = 0;
    sessionStorage.removeItem("wheel-raid:session");
    this.update({
      room: null,
      hosting: false,
      connected: false,
      notice: "",
      error: "",
      peerStatus: "",
    });
  }
  destroy() {
    this.leave();
    clearInterval(this.timer);
    this.channel.close();
  }
}
