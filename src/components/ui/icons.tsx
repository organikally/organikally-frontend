// Lean inline SVG icon set (Lucide-style geometry, 1.5px stroke — DESIGN_SYSTEM §4,
// kept in-repo to avoid a runtime icon dependency and stay offline-safe).
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (props: P) => ({
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
});

export const HomeIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </svg>
);
export const RouteIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="18" cy="18" r="2.5" />
    <path d="M6 8.5V13a4 4 0 0 0 4 4h5" />
  </svg>
);
export const MapPinIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);
export const CameraIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 8h3l2-2.5h8L18 8h3v12H3z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </svg>
);
export const CartIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="9" cy="20" r="1.6" />
    <circle cx="18" cy="20" r="1.6" />
    <path d="M2 3h2.2l2.3 12.2A2 2 0 0 0 8.7 17H18l2-9H5" />
  </svg>
);
export const SyncIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M21 12a9 9 0 0 1-15.5 6.3M3 12A9 9 0 0 1 18.5 5.7" />
    <path d="M18.5 2.5v3.2h-3.2M5.5 21.5v-3.2h3.2" />
  </svg>
);
export const CheckIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12.5 10 17.5 19.5 7" />
  </svg>
);
export const ChevronRightIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
export const ChevronLeftIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m15 6-6 6 6 6" />
  </svg>
);
export const PlusIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const MinusIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12h14" />
  </svg>
);
export const PhoneIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 4h4l2 5-2.5 1.5a12 12 0 0 0 6 6L15 14l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 2 6a2 2 0 0 1 2-2Z" />
  </svg>
);
export const ClockIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const AlertIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3 2 20h20L12 3Z" />
    <path d="M12 9v5M12 17h.01" />
  </svg>
);
export const WifiOffIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M2 2 22 22" />
    <path d="M5 12.5a11 11 0 0 1 4-2.4M2 8.8A16 16 0 0 1 7 6M16 10.2a11 11 0 0 1 3 2.3M12 19h.01" />
  </svg>
);
export const LogoutIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 12H3m0 0 3.5-3.5M3 12l3.5 3.5" />
  </svg>
);
export const SearchIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);
export const PackageIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" />
    <path d="M3 7.5 12 12l9-4.5M12 12v9" />
  </svg>
);
export const RupeeIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 5h10M7 9h10M16 5c0 4-3 5-6 5l6 9" />
  </svg>
);
export const ListIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </svg>
);
export const XCircleIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15 9-6 6M9 9l6 6" />
  </svg>
);
