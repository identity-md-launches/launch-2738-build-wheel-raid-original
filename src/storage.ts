import { roomSchema, type Room } from "./game";

export const storageKey = (id: string) => `wheel-raid:room:${id}`;
export function saveRoom(storage: Pick<Storage, "setItem">, room: Room) {
  // Atomic setItem: write the processed round and its HP changes in the same record, before publishing.
  storage.setItem(storageKey(room.id), JSON.stringify(roomSchema.parse(room)));
}
export function restoreRoom(
  storage: Pick<Storage, "getItem">,
  id: string,
): Room | null {
  const raw = storage.getItem(storageKey(id));
  if (!raw) return null;
  if (raw.length > 250_000)
    throw new Error("Saved room is too large. Start a new room.");
  const room = roomSchema.parse(JSON.parse(raw));
  if (room.id !== id) throw new Error("Saved room identity does not match.");
  return room;
}
