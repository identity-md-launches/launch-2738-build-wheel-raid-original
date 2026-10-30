import { z } from "zod";

const signalSchema = z.object({
  version: z.literal(1),
  room: z.string().regex(/^[a-z0-9]{6}$/),
  type: z.enum(["offer", "answer"]),
  sdp: z.string().min(20).max(80_000),
});
export type Signal = z.infer<typeof signalSchema>;
export function encodeSignal(signal: Signal): string {
  return `wr1.${btoa(JSON.stringify(signal))}`;
}
export function decodeSignal(input: string): Signal {
  if (input.length > 120_000 || !input.trim().startsWith("wr1."))
    throw new Error("Paste the full Wheel Raid invite or reply code.");
  try {
    return signalSchema.parse(JSON.parse(atob(input.trim().slice(4))));
  } catch {
    throw new Error(
      "This code is incomplete or invalid. Copy the full code again.",
    );
  }
}

/** No signaling service, accounts, media permissions, or credentials. Share SDP in your own messenger. */
export class DirectPeer {
  private pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
  });
  private channel?: RTCDataChannel;
  private timeout?: ReturnType<typeof setTimeout>;
  public onMessage: (value: unknown) => void = () => {};
  public onStatus: (status: string) => void = () => {};
  constructor() {
    this.pc.ondatachannel = (e) => this.bind(e.channel);
    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      if (state === "connected" && this.timeout) clearTimeout(this.timeout);
      this.onStatus(
        state === "failed"
          ? "Connection failed. Try again on the same Wi-Fi; some networks need a relay."
          : state,
      );
    };
  }
  private bind(channel: RTCDataChannel) {
    this.channel = channel;
    channel.onopen = () => this.onStatus("connected");
    channel.onclose = () => this.onStatus("disconnected");
    channel.onmessage = (e) => {
      if (typeof e.data !== "string" || e.data.length > 250_000) return;
      try {
        this.onMessage(JSON.parse(e.data));
      } catch {
        /* reject malformed peer messages */
      }
    };
  }
  private async gather() {
    if (this.pc.iceGatheringState === "complete") return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(done, 6000);
      const pc = this.pc;
      function done() {
        clearTimeout(timer);
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      }
      function check() {
        if (pc.iceGatheringState === "complete") done();
      }
      pc.addEventListener("icegatheringstatechange", check);
    });
  }
  private waitForConnection() {
    this.timeout = setTimeout(() => {
      if (this.pc.connectionState !== "connected")
        this.onStatus(
          "Connection timed out. Exchange fresh codes or try the same Wi-Fi.",
        );
    }, 30_000);
  }
  async offer(room: string) {
    this.bind(this.pc.createDataChannel("wheel-raid", { ordered: true }));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await this.gather();
    return encodeSignal({
      version: 1,
      room,
      type: "offer",
      sdp: this.pc.localDescription!.sdp,
    });
  }
  async answer(signal: Signal) {
    if (signal.type !== "offer")
      throw new Error("The joining player needs the host’s invite code.");
    await this.pc.setRemoteDescription({ type: "offer", sdp: signal.sdp });
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await this.gather();
    this.waitForConnection();
    return encodeSignal({
      version: 1,
      room: signal.room,
      type: "answer",
      sdp: this.pc.localDescription!.sdp,
    });
  }
  async accept(signal: Signal) {
    if (signal.type !== "answer")
      throw new Error("Paste the joining player’s reply code.");
    await this.pc.setRemoteDescription({ type: "answer", sdp: signal.sdp });
    this.waitForConnection();
  }
  send(value: unknown) {
    if (this.channel?.readyState === "open")
      this.channel.send(JSON.stringify(value));
  }
  close() {
    if (this.timeout) clearTimeout(this.timeout);
    this.channel?.close();
    this.pc.close();
  }
}
