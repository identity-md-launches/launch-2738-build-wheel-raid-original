import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Arena } from "./Arena";
import { GameClient } from "./client";
import { Icon } from "./Icons";
import { MAX_TURNS, type Action, type Room } from "./game";
import { archiveInfo, PIN } from "./source";

const client = new GameClient();
const names = { attack: "Attack", defend: "Defend", heal: "Heal" };
const descriptions = {
  attack: "Hit harder with distance",
  defend: "Block the boss’s strike",
  heal: "Restore shared team HP",
};
const distance = (mm: string) =>
  `${(Number(BigInt(mm)) / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} m`;
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!,
      trigger = document.activeElement as HTMLElement;
    dialog.showModal();
    return () => {
      dialog.close();
      trigger?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-heading">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={close}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Health({
  label,
  value,
  max,
  boss = false,
}: {
  label: string;
  value: number;
  max: number;
  boss?: boolean;
}) {
  return (
    <div className={`health ${boss ? "boss-health" : ""}`}>
      <div className="health-label">
        <span>{label}</span>
        <span className="numbers">
          {value}
          <span className="muted"> / {max} HP</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className="health-track"
      >
        <span style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );
}
export default function App() {
  const view = useSyncExternalStore(client.subscribe, client.getSnapshot);
  const { room, hosting, connected, live, error, notice } = view;
  const [name, setName] = useState("");
  const [mode, setMode] = useState<Room["mode"]>("replay");
  const [join, setJoin] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [modal, setModal] = useState<"help" | "invite" | "leave" | null>(null);
  const [invite, setInvite] = useState("");
  const [incoming, setIncoming] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [tab, setTab] = useState<"log" | "leaderboard">("log");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const me = room?.players.find((p) => p.id === client.playerId);
  const choice = room?.turn?.choices[client.playerId];
  const finished = room?.phase === "victory" || room?.phase === "defeat";
  const paused = room?.mode === "live" && !live.available;
  const locked = !!choice || (!!room?.turn && now >= room.turn.locksAt);
  const remaining = room?.turn
    ? Math.max(0, Math.ceil((room.turn.locksAt - now) / 1000))
    : 0;
  const countdown = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  const roundText = room?.turn?.roundId || room?.logs.at(-1)?.round.roundId;
  const allLocked =
    room?.turn && room.players.every((p) => room.turn!.choices[p.id]);
  const status = finished
    ? room.phase === "victory"
      ? "Victory! The wheel wins."
      : "Defeat. Regroup and roll again."
    : !room
      ? "The Chrome Gnawer is waiting."
      : room.phase === "lobby"
        ? "Party up. The wheel awaits."
        : paused
          ? "Raid paused. Progress is safe."
          : locked
            ? room.mode === "live"
              ? "Waiting for the confirmed round."
              : allLocked
                ? "Moves locked. Here comes the wheel."
                : "Move locked. Waiting for your party."
            : "Choose your move. Make it count.";
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setFeedback("");
    try {
      await fn();
    } catch (e) {
      client.report(e);
    } finally {
      setBusy(false);
    }
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback("Copied. Send it to your teammate.");
    } catch {
      setFeedback("Select the code and copy it manually.");
    }
  }
  function openInvite() {
    setInvite("");
    setIncoming("");
    setFeedback("");
    setModal("invite");
  }
  const actionDisabled =
    !room ||
    room.phase !== "battle" ||
    !room.turn ||
    locked ||
    paused ||
    !connected;
  return (
    <>
      <a className="skip-link" href="#game">
        Skip to game
      </a>
      <header className="site-header">
        <a className="brand" href="./" aria-label="Wheel Raid home">
          <span className="brand-mark">
            <Icon name="wheel" size={30} />
          </span>
          <h1>
            Wheel Raid<span className="brand-dot">.</span>
          </h1>
        </a>
        <div className="header-tools">
          <span className="chain-name">A Squeekchain game</span>
          <button
            className="help-button"
            aria-label="How to play"
            onClick={() => setModal("help")}
          >
            <Icon name="help" />
            <span>How to play</span>
          </button>
        </div>
      </header>
      <main id="game">
        <p className="sr-only" role="status">
          {room
            ? `${status}${room.logs.length ? ` Round ${room.logs.at(-1)!.round.roundId} confirmed. Team health ${room.teamHp}. Boss health ${room.bossHp}.` : ""}`
            : ""}
        </p>
        <div className="page-heading">
          <p>Tiny paws. Shared boss.</p>
          <div className="source-status">
            <span className={`status-dot ${live.available ? "online" : ""}`} />
            {room?.mode === "live"
              ? live.available
                ? "Live source connected"
                : "Live source paused"
              : "Archived rounds · Play now"}
          </div>
        </div>
        <div
          className={`game-layout ${room ? "in-room" : "entry"} phase-${room?.phase || "entry"}`}
        >
          <section className="battle" aria-labelledby="boss-name">
            <div className="battle-top">
              <div>
                <h2 id="boss-name">The Chrome Gnawer</h2>
                <p>A very big problem for very small paws.</p>
              </div>
              <span className="boss-mark">
                <Icon name="wheel" size={24} />
              </span>
            </div>
            <div className="boss-meter">
              <Health
                label="Boss health"
                value={room?.bossHp ?? 260}
                max={room?.bossMax ?? 260}
                boss
              />
            </div>
            <Arena
              defeated={room?.phase === "defeat"}
              victory={room?.phase === "victory"}
              turn={room?.logs.length ?? 0}
              players={room?.players.length ?? 2}
            />
            <div className="arena-caption">
              <span>
                <Icon name="people" size={16} />
                {room
                  ? `${room.players.length} ${room.players.length === 1 ? "raider" : "raiders"}`
                  : "Your party goes here"}
              </span>
              <span>
                {room
                  ? `Turn ${Math.min(MAX_TURNS, room.logs.length + (finished ? 0 : 1))} / ${MAX_TURNS}`
                  : "Co-op · 1–4 players"}
              </span>
            </div>
            <div className="battle-controls">
              <Health
                label="Team health"
                value={room?.teamHp ?? 120}
                max={room?.teamMax ?? 120}
              />
              <div className="turn-heading">
                <h3>
                  {finished
                    ? room.phase === "victory"
                      ? "Boss down. Paws up."
                      : "Small paws. Another chance."
                    : room?.phase === "lobby"
                      ? "Your party is assembling"
                      : !room
                        ? "Three moves. One team."
                        : locked
                          ? "Your move is locked"
                          : "What’s your move?"}
                </h3>
                {room?.turn && (
                  <span className="turn-time">
                    <Icon name={locked ? "check" : "clock"} size={16} />
                    {locked ? "Locked" : countdown}
                  </span>
                )}
              </div>
              <div className="actions" hidden={!!finished}>
                {(["attack", "defend", "heal"] as Action[]).map((action) => (
                  <button
                    key={action}
                    className={`move ${choice?.action === action ? "selected" : ""}`}
                    disabled={actionDisabled}
                    onClick={() => client.move(action)}
                    aria-label={`Lock ${names[action]}`}
                    aria-pressed={choice?.action === action}
                  >
                    <Icon name={action} size={26} />
                    <strong>{names[action]}</strong>
                    <span>{descriptions[action]}</span>
                    {choice?.action === action && (
                      <span className="move-check">
                        <Icon name="check" size={16} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {finished &&
                (hosting ? (
                  <button
                    className="primary result-replay"
                    onClick={() => client.replay()}
                  >
                    <Icon name="replay" />
                    Play another raid
                  </button>
                ) : (
                  <p className="waiting-host">
                    Waiting for the host to open a new raid
                  </p>
                ))}
              <p className="move-hint">
                {!room
                  ? "Create a room to lock your first move."
                  : room.phase === "lobby"
                    ? "Invite a friend, then start the raid. Solo play works too."
                    : finished
                      ? "Each round is recorded in the battle log below."
                      : paused
                        ? "Moves and combat are paused until the source returns."
                        : locked
                          ? "Locked choices cannot change. Missing moves default to Defend."
                          : room.mode === "live"
                            ? "Lock before the round begins. No move? You’ll Defend."
                            : "Select once to lock. The archive reveals when everyone is ready."}
              </p>
            </div>
          </section>
          <aside className="room-panel" aria-label="Room controls">
            {!room ? (
              <>
                <div className="room-intro">
                  <span className="party-drawing">
                    <Icon name="people" size={28} />
                    <span className="small-star" aria-hidden="true">
                      ✧
                    </span>
                  </span>
                  <h2>{join ? "Find your party." : "Make room for mayhem."}</h2>
                  <p>
                    Team up against a boss powered by real hamster wheel work.
                  </p>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    client.clearError();
                    if (join) client.join(roomCode, name);
                    else void client.create(name, mode);
                  }}
                >
                  <label htmlFor="player-name">Your raider name</label>
                  <input
                    id="player-name"
                    name="nickname"
                    autoComplete="nickname"
                    maxLength={20}
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Nibbles"
                  />
                  {join ? (
                    <>
                      <label htmlFor="room-code">
                        Room code <span className="muted">(same browser)</span>
                      </label>
                      <input
                        id="room-code"
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value)}
                        minLength={6}
                        maxLength={6}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        required
                        placeholder="e.g. a7m2kx"
                      />
                    </>
                  ) : (
                    <>
                      <fieldset className="mode-picker">
                        <legend>Choose your pace</legend>
                        <div>
                          {(["replay", "live"] as const).map((m) => (
                            <label
                              key={m}
                              className={mode === m ? "active" : ""}
                            >
                              <input
                                type="radio"
                                name="mode"
                                value={m}
                                checked={mode === m}
                                onChange={() => setMode(m)}
                              />
                              <Icon
                                name={m === "replay" ? "replay" : "wheel"}
                                size={17}
                              />
                              {m === "replay" ? "Replay raid" : "Live raid"}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <p className="mode-note">
                        {mode === "replay"
                          ? "Play instantly with archived confirmed rounds."
                          : "Real ten-minute rounds, plus confirmation time."}
                      </p>
                    </>
                  )}
                  <button type="submit" className="primary">
                    {join ? "Join room" : "Create room"}
                    <Icon name="arrow" />
                  </button>
                  <div className="form-feedback">
                    {notice && <p role="status">{notice}</p>}
                    {error && (
                      <p role="alert" className="inline-error">
                        {error}
                      </p>
                    )}
                  </div>
                </form>
                <button
                  className="text-button join-toggle"
                  onClick={() => {
                    setJoin(!join);
                    client.clearError();
                  }}
                >
                  {join
                    ? "Create a new room instead"
                    : "Have a room code? Join a room"}
                  <Icon name="arrow" size={16} />
                </button>
                {join && (
                  <button className="secondary full" onClick={openInvite}>
                    <Icon name="link" />
                    Join from another device
                  </button>
                )}
                {client.savedHost() && (
                  <button
                    className="secondary full resume-button"
                    onClick={() => client.resume()}
                  >
                    <Icon name="replay" />
                    Resume saved room
                  </button>
                )}
                <p className="privacy-note">
                  Just play. No wallet, tokens, or entry fee.
                </p>
              </>
            ) : (
              <>
                <div className="room-title">
                  <h2>The raid party</h2>
                  <button
                    className="icon-button"
                    onClick={openInvite}
                    aria-label="Invite a player"
                  >
                    <Icon name="link" />
                  </button>
                </div>
                <div className="room-code-line">
                  <span>
                    Room <code>{room.id}</code>
                  </span>
                  <button
                    className="text-button"
                    onClick={() => void copy(room.id)}
                  >
                    <Icon name="copy" size={16} />
                    Copy code
                  </button>
                </div>
                <ul className="players">
                  {room.players.map((player, i) => (
                    <li key={player.id}>
                      <span className={`avatar avatar-${i}`}>
                        <Icon
                          name={
                            (["attack", "defend", "heal", "wheel"] as const)[i]
                          }
                          size={22}
                        />
                      </span>
                      <div>
                        <strong>{player.name}</strong>
                        <span>
                          {player.id === client.playerId
                            ? "You"
                            : player.id === room.hostId
                              ? "Host"
                              : "Teammate"}
                          {player.id === room.hostId &&
                          player.id === client.playerId
                            ? " · Host"
                            : ""}
                        </span>
                      </div>
                      <span className="player-state">
                        {room.turn?.choices[player.id] ? (
                          <>
                            <Icon name="check" size={16} />
                            Locked
                          </>
                        ) : room.phase === "lobby" ? (
                          "Ready"
                        ) : finished ? (
                          `${player.score} pts`
                        ) : (
                          "Choosing"
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {room.phase === "lobby" && room.players.length < 4 && (
                  <button className="invite-row" onClick={openInvite}>
                    <span className="avatar vacant">
                      <Icon name="people" />
                    </span>
                    <span>
                      Invite a teammate<small>Better with a friend</small>
                    </span>
                    <Icon name="arrow" size={18} />
                  </button>
                )}
                <div className="room-summary">
                  <span>
                    {room.mode === "replay" ? "Archived raid" : "Live raid"}
                  </span>
                  <span>Raid {room.raid}</span>
                </div>
                <div className={`raid-state ${finished ? "result" : ""}`}>
                  <h3>{status}</h3>
                  {room.phase === "lobby" ? (
                    <p>
                      {room.mode === "replay"
                        ? "Moves use 12 real rounds from Oct 29–30. Historical outcomes are already public."
                        : "Choices lock before a future round starts. Combat waits for 12 confirmations."}
                    </p>
                  ) : finished ? (
                    <p>
                      {room.phase === "victory"
                        ? `Your party brought the boss down in ${room.logs.length} turns.`
                        : room.teamHp === 0
                          ? "Your team ran out of HP. Try combining Attack, Defend and Heal."
                          : "The boss escaped after 12 turns. Bring more attacks next time."}
                    </p>
                  ) : (
                    <p>
                      {room.mode === "replay"
                        ? "Historical practice · reveal after all moves lock."
                        : `Target round ${roundText}. The hamster sets the pace.`}
                    </p>
                  )}
                </div>
                {room.phase === "lobby" ? (
                  hosting ? (
                    <button
                      className="primary"
                      onClick={() => client.start()}
                      disabled={paused}
                    >
                      <Icon name="attack" />
                      Start raid
                      <Icon name="arrow" />
                    </button>
                  ) : (
                    <p className="waiting-host">
                      <Icon name="clock" />
                      Waiting for the host to start
                    </p>
                  )
                ) : finished ? null : (
                  <div className="round-note">
                    <Icon name={paused ? "pause" : "clock"} />
                    <span>
                      {paused
                        ? "Waiting for live data"
                        : room.mode === "live"
                          ? remaining > 0
                            ? `Round ${roundText} starts after choices close`
                            : "Waiting for settlement and confirmations"
                          : `Archived round ${roundText}`}
                      <small>
                        {paused
                          ? "HP and locked moves stay saved."
                          : room.mode === "live"
                            ? "No provisional results enter combat."
                            : "Real records, faster pace."}
                      </small>
                    </span>
                  </div>
                )}
                <div className="connection-note">
                  <span className={`status-dot ${connected ? "online" : ""}`} />
                  {hosting
                    ? "You are hosting"
                    : connected
                      ? "Connected to host"
                      : "Host disconnected · reconnect to continue"}
                </div>
                {!connected && !hosting && (
                  <button className="secondary full" onClick={openInvite}>
                    Reconnect to host
                  </button>
                )}
                <button
                  className="text-button leave-button"
                  onClick={() => setModal("leave")}
                >
                  Leave room
                </button>
              </>
            )}
          </aside>
        </div>
        <div className="messages">
          <p role="status">{feedback}</p>
          {room && notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          {room && error && (
            <div className="error" role="alert">
              <p>{error}</p>
              <button
                className="text-button"
                onClick={() => client.clearError()}
              >
                Dismiss
              </button>
            </div>
          )}
          {paused && (
            <div className="error">
              <p>{live.reason}</p>
              <button
                className="text-button"
                onClick={() => void client.poll()}
              >
                Retry source
              </button>
            </div>
          )}
        </div>
        <section className="history-section" aria-label="Raid history">
          <div className="history-nav">
            <div className="history-tabs">
              <button
                className={tab === "log" ? "current" : ""}
                aria-pressed={tab === "log"}
                onClick={() => setTab("log")}
              >
                Battle log{room?.logs.length ? ` (${room.logs.length})` : ""}
              </button>
              <button
                className={tab === "leaderboard" ? "current" : ""}
                aria-pressed={tab === "leaderboard"}
                onClick={() => setTab("leaderboard")}
              >
                <Icon name="trophy" size={17} />
                Leaderboard
              </button>
            </div>
            <span className="history-context">
              {room ? `Room ${room.id}` : "Your story starts here"}
            </span>
          </div>
          {tab === "log" ? (
            room?.logs.length ? (
              <ol className="battle-log">
                {[...room.logs].reverse().map((log) => (
                  <li key={log.round.key}>
                    <div className="log-symbol">
                      <Icon name="wheel" />
                    </div>
                    <div className="log-detail">
                      <div className="log-heading">
                        <strong>Round {log.round.roundId} confirmed</strong>
                        <span>
                          {distance(log.round.distanceMm)} estimated wheel
                          distance
                        </span>
                      </div>
                      <p>
                        {log.damage} damage · {log.healing} healed ·{" "}
                        {log.shield} shield · {log.retaliation} team damage
                      </p>
                      <div className="log-moves">
                        {log.moves.map((m, i) => (
                          <span key={i}>
                            {m.name}: {names[m.action]} +{m.points}
                          </span>
                        ))}
                      </div>
                    </div>
                    <a
                      className="proof-link"
                      href={`https://eth-sepolia.blockscout.com/tx/${log.round.transactionHash}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`View round ${log.round.roundId} transaction`}
                    >
                      View proof
                      <Icon name="arrow" size={15} />
                    </a>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="empty-history">
                <span>
                  <Icon name="wheel" size={32} />
                </span>
                <div>
                  <h3>No dents in the armor. Yet.</h3>
                  <p>
                    {room?.phase === "battle"
                      ? "Lock a move above. Confirmed results will land here."
                      : "Start a raid and your confirmed rounds will appear here."}
                  </p>
                </div>
              </div>
            )
          ) : (
            <>
              <p className="leaderboard-note">
                Room leaderboard ·{" "}
                {room?.history.length
                  ? "Completed raids saved in this browser and shared with connected teammates."
                  : "Finish a raid to record scores. This is a room leaderboard, not a global ranking."}
              </p>
              {room?.history.length ? (
                <div className="leaderboard">
                  <div className="leaderboard-row table-head">
                    <span>Raider</span>
                    <span>Points</span>
                    <span>Raid</span>
                    <span>Result</span>
                  </div>
                  {room.history
                    .flatMap((h) =>
                      h.players.map((p) => ({
                        ...p,
                        raid: h.raid,
                        result: h.result,
                        mode: h.mode,
                      })),
                    )
                    .sort(
                      (a, b) =>
                        b.score - a.score || a.name.localeCompare(b.name),
                    )
                    .slice(0, 20)
                    .map((p, i) => (
                      <div
                        key={`${p.raid}-${p.id}`}
                        className="leaderboard-row"
                      >
                        <strong>
                          <span className="rank">{i + 1}</span>
                          {p.name}
                        </strong>
                        <span>{p.score}</span>
                        <span>
                          #{p.raid} · {p.mode}
                        </span>
                        <span>
                          {p.result === "victory" ? "Victory" : "Defeat"}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="empty-history">
                  <Icon name="trophy" size={32} />
                  <p>No scores yet. Every little paw has a shot.</p>
                </div>
              )}
            </>
          )}
        </section>
        <footer>
          <span>
            <Icon name="wheel" size={16} />
            Powered by actual wheel work. Fueled by teamwork.
          </span>
          <button className="text-button" onClick={() => setModal("help")}>
            Rules & data sources
            <Icon name="arrow" size={15} />
          </button>
        </footer>
      </main>
      {modal === "leave" && (
        <Modal title="Leave this room?" close={() => setModal(null)}>
          <p>
            {hosting
              ? "Your party will pause until you return. This browser keeps the saved raid."
              : "You can rejoin with the room code or a fresh direct invite."}
          </p>
          <div className="dialog-actions">
            <button className="secondary" onClick={() => setModal(null)}>
              Stay in room
            </button>
            <button
              className="primary"
              onClick={() => {
                client.leave();
                setModal(null);
              }}
            >
              Leave room
            </button>
          </div>
        </Modal>
      )}
      {modal === "invite" && (
        <Modal
          title={hosting ? "Invite your teammate" : "Join a direct room"}
          close={() => setModal(null)}
        >
          {hosting ? (
            <>
              <p>
                In this browser, open a second tab and join room{" "}
                <code>{room?.id}</code>.
              </p>
              <a
                className="secondary full link-button"
                href="./"
                target="_blank"
                rel="noreferrer"
              >
                Open another player tab
                <Icon name="arrow" />
              </a>
              <hr />
              <h3>On another device</h3>
              <p>
                Send an invite code to your friend. They send a reply code back.
                Keep both pages open.
              </p>
              <button
                className="secondary full"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    setInvite(await client.makeInvite());
                  })
                }
              >
                {busy ? "Preparing connection…" : "Generate direct invite"}
              </button>
              {invite && (
                <>
                  <label htmlFor="outgoing">1. Send this invite code</label>
                  <textarea
                    id="outgoing"
                    readOnly
                    value={invite}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    className="text-button"
                    onClick={() => void copy(invite)}
                  >
                    <Icon name="copy" size={16} />
                    Copy invite
                  </button>
                  <label htmlFor="incoming">2. Paste your friend’s reply</label>
                  <textarea
                    id="incoming"
                    value={incoming}
                    onChange={(e) => setIncoming(e.target.value)}
                    placeholder="wr1.…"
                  />
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await client.acceptReply(incoming);
                        setFeedback(
                          "Reply accepted. Connecting to your teammate…",
                        );
                      })
                    }
                  >
                    Connect teammate
                    <Icon name="link" />
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <p>
                Ask your host for a direct invite. A six-character room code
                works only between tabs in the same browser.
              </p>
              <label htmlFor="direct-name">Your raider name</label>
              <input
                id="direct-name"
                autoComplete="nickname"
                maxLength={20}
                required
                value={name || me?.name || ""}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Nibbles"
              />
              <label htmlFor="direct-offer">Host’s invite code</label>
              <textarea
                id="direct-offer"
                value={incoming}
                onChange={(e) => setIncoming(e.target.value)}
                placeholder="wr1.…"
              />
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    setInvite(
                      await client.joinInvite(incoming, name || me?.name || ""),
                    );
                  })
                }
              >
                {busy ? "Preparing connection…" : "Create reply"}
                <Icon name="arrow" />
              </button>
              {invite && (
                <>
                  <label htmlFor="reply-code">
                    Send this reply to the host
                  </label>
                  <textarea
                    id="reply-code"
                    readOnly
                    value={invite}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    className="secondary full"
                    onClick={() => void copy(invite)}
                  >
                    <Icon name="copy" />
                    Copy reply
                  </button>
                </>
              )}
            </>
          )}
          <p className="dialog-footnote">
            Direct connections may fail on restricted networks. Try the same
            Wi-Fi. Keep the host open; reconnect with fresh codes after a
            reload.
          </p>
          <p role="status">{view.peerStatus || feedback}</p>
          {error && (
            <p role="alert" className="inline-error">
              {error}
            </p>
          )}
        </Modal>
      )}
      {modal === "help" && (
        <Modal
          title="A little wheel goes a long way."
          close={() => setModal(null)}
        >
          <div className="rules">
            <p>
              Bring the Chrome Gnawer to zero HP before your shared team falls,
              or before 12 turns pass. Play solo or with up to three friends.
            </p>
            <h3>Three ways to help</h3>
            <ul>
              <li>
                <strong>Attack:</strong> 18 + 1 per 15 m, up to 48 damage.
              </li>
              <li>
                <strong>Defend:</strong> 20 + 1 per 30 m, up to 36 shield.
              </li>
              <li>
                <strong>Heal:</strong> 14 + 1 per 30 m, up to 34 HP.
              </li>
            </ul>
            <p>
              Whole metres and bonuses round down. Everyone acts, healing
              applies, then the boss strikes unless defeated. A strike is (22 +
              3 × round ID mod 3 + 6 if distance is under 10 m) per player,
              minus shared shields. Shield lasts one turn.
            </p>
            <h3>Choose before you know</h3>
            <p>
              Live moves lock five seconds before a future round begins. Each
              round lasts ten minutes. Missing choices default to Defend. The
              game only uses safe settlements after at least 12 Ethereum
              confirmations. Distance is an estimate: accepted work × 878 mm,
              checked against official distance totals.
            </p>
            <p>
              Replay uses archived confirmed rounds 486–497 from October 29–30,
              2026. Outcomes are already public: this is historical practice.
              Choices lock before the app reveals a result; replay scores are
              labeled separately.
            </p>
            <h3>Rooms, saves & scores</h3>
            <p>
              The host runs combat and saves it in browser storage before
              sharing updates. Keep the host tab open. Same-browser rooms use
              local tab messaging. Other devices exchange invite and reply codes
              for a direct WebRTC connection. After a reload, the host resumes
              its saved raid; remote guests exchange fresh codes. Clearing site
              storage erases saves.
            </p>
            <p>
              Scores add the listed attack, shield, or heal power, including
              unused power. The room leaderboard retains the last 20 completed
              raids. Friendly co-op, with a trusted host; no global ranking or
              competitive anti-cheat.
            </p>
            <h3>Official data, openly</h3>
            <p>
              The public API supplies confirmed settlements, round timing, and
              distance totals. Missing, changed, or stale data pauses live
              combat. Zero work means no accepted passages; it does not prove
              the hamster was resting.
            </p>
            <ul className="source-links">
              <li>
                <a
                  href="https://docs.squeekchain.com/developers/api/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Official API reference ↗
                </a>
              </li>
              <li>
                <a
                  href="https://docs.squeekchain.com/system/rounds-and-blocks/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Official round lifecycle ↗
                </a>
              </li>
              <li>
                <a
                  href="https://api.squeekchain.com/v1/events?category=protocol&limit=100"
                  target="_blank"
                  rel="noreferrer"
                >
                  Official confirmed event feed ↗
                </a>
              </li>
            </ul>
            <p className="source-detail">
              Archive captured{" "}
              {new Date(archiveInfo.capturedAt).toLocaleDateString()}. Current
              API core: <code>{PIN.core}</code>. The docs list an older
              deployment. This game pins the current API identity; changes pause
              live play. API records are trusted, not independently verified
              chain proofs.
            </p>
            <p>
              No wagering, custody, transfers, wallet connection, or private
              keys.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
