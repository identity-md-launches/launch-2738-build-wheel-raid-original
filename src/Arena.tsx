function Hamster({
  x,
  y,
  variant = 0,
}: {
  x: number;
  y: number;
  variant?: number;
}) {
  const fur = variant ? "#c7b7a5" : "#d9a77a";
  return (
    <g
      transform={`translate(${x} ${y})`}
      stroke="#344039"
      strokeWidth="3.5"
      strokeLinejoin="round"
    >
      <ellipse cx="0" cy="61" rx="48" ry="9" fill="#c4ccb0" stroke="none" />
      <path d="M-24 48-31 60h20l8-12m21 0 7 12h19l-9-18" fill={fur} />
      <ellipse cy="21" rx="32" ry="35" fill={fur} />
      <circle cx="-27" cy="-9" r="14" fill={fur} />
      <circle cx="25" cy="-10" r="14" fill={fur} />
      <circle cx="-27" cy="-9" r="7" fill="#e6b6a7" stroke="none" />
      <circle cx="25" cy="-10" r="7" fill="#e6b6a7" stroke="none" />
      <path
        d="M-27 12q27-17 54 0v19Q0 68-27 31Z"
        fill="#f9e5c9"
        stroke="none"
      />
      <circle cx="-11" cy="15" r="3" fill="#344039" stroke="none" />
      <circle cx="12" cy="15" r="3" fill="#344039" stroke="none" />
      <path d="m-3 24 4 4 4-4M1 28v5m-6 0q6 5 12-1" fill="none" />
      <path d="M-31 29-44 37m74-9 11 8" strokeLinecap="round" />
      {variant ? (
        <>
          <path d="m-44 25 19 5v17l-17 13-17-13V30z" fill="#d5ef7f" />
          <path d="M-42 34v15m-6-8h12" fill="none" />
        </>
      ) : (
        <>
          <path d="m32 37 9 9 31-37-4-9-10 4z" fill="#eaf0de" />
          <path d="m27 37 17 15m-8-10-9 10" fill="none" />
          <path d="M-20-1q20-18 39 0l-6 8H-13Z" fill="#d5ef7f" />
        </>
      )}
    </g>
  );
}

export function Arena({
  defeated,
  victory,
  turn,
  players,
}: {
  defeated: boolean;
  victory: boolean;
  turn: number;
  players: number;
}) {
  return (
    <svg
      className={`arena-art ${victory ? "won" : ""}`}
      viewBox="0 0 840 320"
      role="img"
      aria-label="Tiny hamster adventurers face a giant mechanical wheel boss in a garden arena."
    >
      <defs>
        <pattern
          id="arena-grid"
          width="36"
          height="36"
          patternUnits="userSpaceOnUse"
        >
          <path d="M36 0H0v36" fill="none" stroke="#d5dbc6" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="840" height="320" fill="#e9eddd" />
      <rect width="840" height="320" fill="url(#arena-grid)" />
      <circle cx="650" cy="145" r="136" fill="#dce5c9" />
      <path d="M0 276q120-28 226 2t217-2 229 4 168-6v46H0Z" fill="#d9e2c7" />
      <g fill="#758a62" opacity=".55">
        <path d="m54 272-9-21 16 8 6-19 4 32m357 19-10-27 18 13 9-22 4 36m329-13 7-22 4 12 12-6-8 16" />
      </g>
      <g fill="none" stroke="#a8b596" strokeWidth="2">
        <path d="m354 83 8-13m-24 8 4-8m46 51 11-5m-48 98 9 9" />
        <circle cx="96" cy="87" r="5" />
        <path d="M88 87h16M96 79v16M771 56v14m-7-7h14" />
      </g>
      <g
        transform={`translate(603 154) rotate(${defeated ? -4 : victory ? 12 : 0})`}
        stroke="#344039"
        strokeWidth="4"
        strokeLinejoin="round"
      >
        <ellipse
          cx="0"
          cy="124"
          rx="105"
          ry="13"
          fill="#b9c6a3"
          stroke="none"
        />
        <path d="m-54 71-17 43h31l16-29m62-10 16 39h31L71 66" fill="#7b8c79" />
        <path d="M-71 114h38m17 0h101" fill="none" />
        <path
          d="m-87-16-40 23 8 43 24 1-3-32 27-5m153-31 33 25-3 36-24 7 3-32-25-13"
          fill="#a9b69d"
        />
        <path
          d="m-128 47-6 16 12 12 16-6-1-20m218-1 8 17-10 11-17-8 1-20"
          fill="#7b8c79"
        />
        <circle cx="-63" cy="-78" r="29" fill="#a9b69d" />
        <circle cx="-63" cy="-78" r="16" fill="#7b8c79" />
        <circle cx="62" cy="-78" r="29" fill="#a9b69d" />
        <circle cx="62" cy="-78" r="16" fill="#7b8c79" />
        <circle r="97" fill="#879b7c" />
        <circle r="80" fill="#c4d2b5" />
        <circle r="67" fill="#a9bb99" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <path
            key={a}
            transform={`rotate(${a})`}
            d="M0-81v15"
            stroke="#344039"
          />
        ))}
        <path d="M-66-26q66-52 132 0l-7 57q-59 41-118 0Z" fill="#e5ecd7" />
        <path d="m-48-9 29 11m39 0 29-11" fill="none" strokeWidth="7" />
        {!victory ? (
          <>
            <path d="M-41 5h20v12h-20zm62 0h20v12H21z" fill="#e0a46d" />
            <path d="M-7 27h14l-7 6Z" fill="#344039" />
          </>
        ) : (
          <path
            d="m-40 4 16 15m-16 0L-24 4M25 4l16 15m-16 0L41 4"
            fill="none"
          />
        )}
        <path d="M-29 43h58v20h-58z" fill="#344039" />
        <path
          d="M-22 44h16v15h-16zm28 0h16v15H6z"
          fill="#f8f6ec"
          stroke="none"
        />
        <path d="M-60-55q60-42 120 0" fill="none" />
        <path d="M0-72v-15" />
        <circle cy="-91" r="7" fill="#d5ef7f" />
      </g>
      <Hamster x={158} y={206} />
      <Hamster x={267} y={216} variant={1} />
      {players > 2 && <Hamster x={62} y={210} variant={1} />}
      {victory && (
        <g fill="#d5ef7f" stroke="#344039" strokeWidth="2">
          <path d="m381 130 9 18 20 3-15 15 4 20-19-9-17 9 3-20-15-15 21-3Z" />
          <path d="m108 120 5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2Z" />
        </g>
      )}
      {turn > 0 && !victory && (
        <path
          d="m425 153 14-22-1 19 17-4-16 26 1-21Z"
          fill="#d5ef7f"
          stroke="#344039"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}
