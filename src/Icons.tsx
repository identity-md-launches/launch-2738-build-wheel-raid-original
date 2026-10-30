export type IconName =
  | "wheel"
  | "attack"
  | "defend"
  | "heal"
  | "people"
  | "arrow"
  | "link"
  | "clock"
  | "check"
  | "replay"
  | "close"
  | "help"
  | "trophy"
  | "copy"
  | "pause";
const paths: Record<IconName, React.ReactNode> = {
  wheel: (
    <>
      <circle cx="12" cy="11" r="8" />
      <circle cx="12" cy="11" r="2" />
      <path d="M12 3v6m0 4v6M4 11h6m4 0h6M6.5 5.5l4 4m3 3 4 4m-11 0 4-4m3-3 4-4M7 22h10" />
    </>
  ),
  attack: (
    <>
      <path d="m5 19 3-3m-4-3 7 7M8 16 19 5V2h-3L5 13M13 5l6 6M3 21l2-2" />
    </>
  ),
  defend: (
    <>
      <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" />
      <path d="M12 7v10m-4-5h8" />
    </>
  ),
  heal: (
    <>
      <path d="M20.5 5.5a5 5 0 0 0-7-1L12 6l-1.5-1.5a5 5 0 0 0-7 7L12 21l8.5-9.5a5 5 0 0 0 0-6Z" />
      <path d="M12 9v7m-3.5-3.5h7" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5v2" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  link: (
    <>
      <path d="m9 15 6-6m-8 4-2 2a4 4 0 0 0 6 6l3-3m-1-11 2-2a4 4 0 0 1 6 6l-3 3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  replay: (
    <>
      <path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 8a2.5 2.5 0 1 1 4 2c-1.5 1-1.5 1-1.5 3m0 3v1" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 3h8v7a4 4 0 0 1-8 0zM8 5H3v3a5 5 0 0 0 5 5m8-8h5v3a5 5 0 0 1-5 5M12 14v6m-5 1h10" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="13" rx="2" />
      <path d="M16 8V3H3v13h5" />
    </>
  ),
  pause: (
    <>
      <path d="M8 5v14M16 5v14" />
    </>
  ),
};
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
