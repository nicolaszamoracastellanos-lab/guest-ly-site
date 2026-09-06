// The Guest-ly icon set: 24px grid, 1.6 stroke, round caps and joins.
// Drawn for this app (the same paths as the design canvas). Never emoji.

import React from "react";
import Svg, { Path, Circle, Rect, Ellipse } from "react-native-svg";
import { colors } from "./tokens";

export type IconName =
  | "home" | "guests" | "mail" | "chat" | "more" | "calendar" | "calendar-plus" | "pin" | "bell" | "chev"
  | "back" | "down" | "search" | "sparkle" | "hanger" | "bus" | "qr" | "check" | "clock" | "wallet" | "tasks"
  | "plus" | "x" | "filter" | "map" | "camera" | "share" | "phone" | "contacts" | "lock" | "warning" | "info"
  | "edit" | "coins" | "grid" | "store" | "list" | "megaphone" | "globe" | "book" | "gear" | "signout"
  | "apple" | "google" | "undo" | "wifi-off" | "star" | "photo";

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };

export function Icon({ name, size = 24, color = colors.ivory, strokeWidth = 1.6 }: Props) {
  const p = { stroke: color, strokeWidth, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  const dot = (cx: number, cy: number, r = 1.2) => <Circle key={`${cx}${cy}`} cx={cx} cy={cy} r={r} fill={color} />;
  const body = (() => {
    switch (name) {
      case "home": return <Path {...p} d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />;
      case "guests": return <><Circle {...p} cx="9" cy="8" r="3.2" /><Path {...p} d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5M15.5 5.5a3 3 0 0 1 0 5.6M17 14c2.3.4 3.7 2.3 3.7 5" /></>;
      case "mail": return <><Rect {...p} x="3.5" y="6" width="17" height="12" rx="2" /><Path {...p} d="m4 7.5 8 5.5 8-5.5" /></>;
      case "chat": return <Path {...p} d="M5 18.5V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H8.5z" />;
      case "more": return <>{dot(6, 12)}{dot(12, 12)}{dot(18, 12)}</>;
      case "calendar": return <><Rect {...p} x="3.5" y="5" width="17" height="15" rx="2" /><Path {...p} d="M3.5 9.5h17M8 3v4M16 3v4" /></>;
      case "calendar-plus": return <><Rect {...p} x="3.5" y="5" width="17" height="15" rx="2" /><Path {...p} d="M3.5 9.5h17M8 3v4M16 3v4M12 12v5M9.5 14.5h5" /></>;
      case "pin": return <><Path {...p} d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" /><Circle {...p} cx="12" cy="10" r="2.3" /></>;
      case "bell": return <><Path {...p} d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5H4.5z" /><Path {...p} d="M10 20.5a2 2 0 0 0 4 0" /></>;
      case "chev": return <Path {...p} d="m9 6 6 6-6 6" />;
      case "back": return <Path {...p} d="m15 6-6 6 6 6" />;
      case "down": return <Path {...p} d="m6 9 6 6 6-6" />;
      case "search": return <><Circle {...p} cx="11" cy="11" r="6" /><Path {...p} d="m20 20-4.5-4.5" /></>;
      case "sparkle": return <><Path {...p} d="M12 4v4M12 16v4M4 12h4M16 12h4M7 7l1.5 1.5M15.5 15.5 17 17M17 7l-1.5 1.5M8.5 15.5 7 17" /><Circle {...p} cx="12" cy="12" r="2.5" /></>;
      case "hanger": return <><Path {...p} d="M12 8.5a2 2 0 1 0-2-2" /><Path {...p} d="M12 8.5v2L4.5 16a1 1 0 0 0 .6 1.8h13.8a1 1 0 0 0 .6-1.8L12 10.5" /></>;
      case "bus": return <><Rect {...p} x="4.5" y="4.5" width="15" height="13" rx="2.5" /><Path {...p} d="M4.5 10.5h15M8 18v2M16 18v2" />{dot(8.5, 14.5, 1)}{dot(15.5, 14.5, 1)}</>;
      case "qr": return <><Rect {...p} x="4" y="4" width="6" height="6" rx="1" /><Rect {...p} x="14" y="4" width="6" height="6" rx="1" /><Rect {...p} x="4" y="14" width="6" height="6" rx="1" /><Path {...p} d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" /></>;
      case "check": return <Path {...p} d="m5 12.5 4.5 4.5L19 7.5" />;
      case "clock": return <><Circle {...p} cx="12" cy="12" r="8" /><Path {...p} d="M12 8v4.5l3 2" /></>;
      case "wallet": return <><Rect {...p} x="3.5" y="6.5" width="17" height="12" rx="2" /><Path {...p} d="M3.5 10h17" />{dot(16.5, 14.5)}</>;
      case "tasks": return <><Path {...p} d="M4.5 7.5 6 9l3-3M4.5 13.5 6 15l3-3M4.5 19.5 6 21l3-3" /><Path {...p} d="M12 7h8M12 13h8M12 19h8" /></>;
      case "plus": return <Path {...p} d="M12 5v14M5 12h14" />;
      case "x": return <Path {...p} d="M6 6l12 12M18 6 6 18" />;
      case "filter": return <Path {...p} d="M4 7h16M7 12h10M10 17h4" />;
      case "map": return <><Path {...p} d="m3.5 6 5.5-2 6 2 5.5-2v14l-5.5 2-6-2-5.5 2z" /><Path {...p} d="M9 4v14M15 6v14" /></>;
      case "camera": return <><Path {...p} d="M4 8.5h3l1.5-2.5h7L17 8.5h3v10H4z" /><Circle {...p} cx="12" cy="13" r="3" /></>;
      case "share": return <><Path {...p} d="M12 4v11M8 8l4-4 4 4" /><Path {...p} d="M5 13v6h14v-6" /></>;
      case "phone": return <Path {...p} d="M6 4h3l1.5 4-2 1.5a10 10 0 0 0 6 6L16 13.5l4 1.5v3a2 2 0 0 1-2 2A14 14 0 0 1 4 6a2 2 0 0 1 2-2z" />;
      case "contacts": return <><Rect {...p} x="5" y="3.5" width="14" height="17" rx="2" /><Circle {...p} cx="12" cy="10" r="2.5" /><Path {...p} d="M8 17c.6-2 2.2-3 4-3s3.4 1 4 3M3.5 8h1.5M3.5 12h1.5M3.5 16h1.5" /></>;
      case "lock": return <><Rect {...p} x="5" y="10.5" width="14" height="10" rx="2" /><Path {...p} d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>;
      case "warning": return <><Path {...p} d="M12 4 21 19H3z" /><Path {...p} d="M12 10v4M12 16.5v.5" /></>;
      case "info": return <><Circle {...p} cx="12" cy="12" r="8" /><Path {...p} d="M12 11v5M12 8v.5" /></>;
      case "edit": return <><Path {...p} d="M4 20h4l10-10-4-4L4 16z" /><Path {...p} d="m12.5 7.5 4 4" /></>;
      case "coins": return <><Ellipse {...p} cx="12" cy="7" rx="7" ry="3" /><Path {...p} d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7" /><Path {...p} d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" /></>;
      case "grid": return <><Rect {...p} x="4" y="4" width="7" height="7" rx="1.5" /><Rect {...p} x="13" y="4" width="7" height="7" rx="1.5" /><Rect {...p} x="4" y="13" width="7" height="7" rx="1.5" /><Rect {...p} x="13" y="13" width="7" height="7" rx="1.5" /></>;
      case "store": return <><Path {...p} d="M4 9.5 5.5 4h13L20 9.5" /><Path {...p} d="M4 9.5c0 1.5 1.2 2.5 2.7 2.5S9.3 11 9.3 9.5c0 1.5 1.2 2.5 2.7 2.5s2.7-1 2.7-2.5c0 1.5 1.2 2.5 2.7 2.5S20 11 20 9.5" /><Path {...p} d="M5.5 12v8h13v-8M10 20v-5h4v5" /></>;
      case "list": return <><Path {...p} d="M8 6h12M8 12h12M8 18h12" />{dot(4.5, 6, 1)}{dot(4.5, 12, 1)}{dot(4.5, 18, 1)}</>;
      case "megaphone": return <><Path {...p} d="M4 10v4h3l7 4V6l-7 4z" /><Path {...p} d="M17 9.5a3.5 3.5 0 0 1 0 5" /></>;
      case "globe": return <><Circle {...p} cx="12" cy="12" r="8" /><Path {...p} d="M4 12h16M12 4c2.5 2.5 2.5 13.5 0 16M12 4c-2.5 2.5-2.5 13.5 0 16" /></>;
      case "book": return <><Path {...p} d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5z" /><Path {...p} d="M5 18a2.5 2.5 0 0 1 2.5-2.5H19" /></>;
      case "gear": return <><Circle {...p} cx="12" cy="12" r="3" /><Path {...p} d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /></>;
      case "signout": return <><Path {...p} d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" /><Path {...p} d="M14 8l4 4-4 4M18 12H9" /></>;
      case "apple": return <><Path d="M15.5 3c-.2 1.5-1.5 3-3 3 .1-1.6 1.4-3 3-3z" fill={color} /><Path d="M12.6 7c1 0 1.9-.7 3.2-.7 1.2 0 2.4.6 3.1 1.6-2.7 1.6-2.3 5.6.5 6.7-.6 1.7-2.3 5.4-4.2 5.4-1.2 0-1.5-.7-3-.7s-1.9.7-3 .7c-2.1 0-4.9-5-4.9-9 0-3 2-4.6 3.8-4.6 1.3 0 2.5.7 3.5.7z" fill={color} /></>;
      case "google": return <><Circle {...p} cx="12" cy="12" r="8" /><Path {...p} d="M12 12h7" /><Path {...p} d="M17.5 7.5A8 8 0 1 0 19.7 14" /></>;
      case "undo": return <><Path {...p} d="M8 8H4V4" /><Path {...p} d="M4.5 8A8 8 0 1 1 6 16.5" /></>;
      case "wifi-off": return <><Path {...p} d="M5 9.5a11 11 0 0 1 4-2.4M12 5c3.2 0 6 1.2 8 3.5M8 13a6 6 0 0 1 2.5-1.6M16 13a6 6 0 0 0-1-.8" />{dot(12, 17.5, 1)}<Path {...p} d="M4 4l16 16" /></>;
      case "star": return <Path {...p} d="m12 4 2.4 5 5.6.7-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9L9.6 9z" />;
      case "photo": return <><Rect {...p} x="3.5" y="5" width="17" height="14" rx="2" /><Circle {...p} cx="9" cy="10" r="1.6" /><Path {...p} d="m4 17 5-4.5 3.5 3 3-2.5 4.5 4" /></>;
    }
  })();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {body}
    </Svg>
  );
}
