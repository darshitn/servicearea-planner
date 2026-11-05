import React from 'react'

const paths = {
  route: (
    <>
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="18" cy="18" r="2.4" />
      <path d="M8.5 6h6.3a3 3 0 0 1 0 6H9.2a3 3 0 0 0 0 6h6.3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M7 3v4m10-4v4M3 10h18M7 14h3m4 0h3" />
    </>
  ),
  pin: (
    <>
      <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="5" width="14" height="16" rx="2" />
      <rect x="9" y="3" width="6" height="4" rx="1.2" />
      <path d="M9 12h6m-6 4h4" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19v-1a6 6 0 0 1 12 0v1m1-14a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v1" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8 12 2.7 2.7L16 9" />
    </>
  ),
  right: <path d="m9 5 7 7-7 7" />,
  left: <path d="m15 5-7 7 7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  person: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 21v-2a6.5 6.5 0 0 1 13 0v2" />
    </>
  ),
  edit: (
    <>
      <path d="m14.5 5.5 4 4M4 20l4.4-1L20 7.4a2.9 2.9 0 0 0-4.1-4.1L4.9 15.6 4 20Z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  layers: (
    <>
      <path d="m3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5m-18 5 9 5 9-5" />
    </>
  ),
  note: (
    <>
      <path d="M4 4h16v12l-4 4H4V4Zm11 16v-5h5M8 9h8m-8 4h5" />
    </>
  ),
}

export function Icon({ name, size = 18, ...props }) {
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
      {...props}
    >
      {paths[name]}
    </svg>
  )
}

export function RouteMap() {
  return (
    <svg
      className="route-map"
      viewBox="0 0 475 215"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <pattern id="grid" width="21" height="21" patternUnits="userSpaceOnUse">
          <path d="M21 0H0v21" fill="none" stroke="#cad5ad" opacity=".12" strokeWidth="1" />
        </pattern>
        <pattern
          id="hatch"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(35)"
        >
          <path d="M0 0v6" stroke="#a7be8b" strokeWidth="2" opacity=".24" />
        </pattern>
      </defs>
      <rect width="475" height="215" fill="url(#grid)" />
      <g fill="none" stroke="#abc5a4" strokeWidth="1.2" opacity=".26">
        <path d="m-20 130 73-38 56 6 36-38 90-7 76-50 76 3 91-42m-481 183 53-24 59 8 44-43 87-7 79-51 74 3 86-40m-458 171 39-16 56 7 47-45 89-9 84-52 75 3 69-34M-5 188l55-16 67 8 49-50 89-12 84-50 74 3 68-26M3 209l56-15 63 7 53-52 90-14 84-49 68 2 73-25" />
        <path d="m16-10 75 47 66-13 55-45m-208 22 84 54 75-15 64-51m-239 26 95 61 88-18 77-65m-123 227 65-63 93-13 92-55 52 8 48-17m-303 142 34-35 94-13 92-56 49 9 45-17m-277 129 21-21 98-14 93-58 51 13 37-16" />
        <path d="m354 221 32-25 45-13 54 4m-110 35 33-19 26-5 46 6" />
      </g>
      <path d="m54 11 39 26 61-12 25-25H42Z" fill="url(#hatch)" />
      <path d="m272 176 55-12 64-35 37 11 47-12v22l-46 14-39-12-60 36-56 11Z" fill="url(#hatch)" />
      <path
        d="M62 156h72l40-54h68l42-38h74"
        fill="none"
        stroke="#d9eaaa"
        strokeWidth="3"
        strokeDasharray="5 6"
        strokeLinecap="round"
      />
      {[
        [62, 156],
        [174, 102],
        [284, 64],
      ].map(([x, y]) => (
        <g key={x}>
          <circle cx={x} cy={y} r="8" fill="#294e40" stroke="#cee49d" strokeWidth="2" />
          <circle cx={x} cy={y} r="2.8" fill="#cee49d" />
        </g>
      ))}
      <g transform="translate(358 53)">
        <path d="M0 12S-11 2-11-5a11 11 0 1 1 22 0c0 7-11 17-11 17Z" fill="#d9ecaa" />
        <circle cy="-5" r="3.8" fill="#244636" />
      </g>
      <g stroke="#d9eaaa" strokeWidth="1" opacity=".55">
        <path d="M408 27h12m-6-6v12M95 67h8m-4-4v8M344 179h8m-4-4v8" />
      </g>
    </svg>
  )
}
