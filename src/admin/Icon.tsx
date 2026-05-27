// Inline SVG icon set ported from treasure-hunt-ui-source/components/icons.jsx.
// Tree-shaken automatically — only used icons land in the bundle.

import type { CSSProperties } from 'react';

type IconName =
  | 'map' | 'pin' | 'compass' | 'star' | 'sparkle' | 'lock' | 'gift'
  | 'users' | 'calendar' | 'check' | 'plus' | 'minus' | 'x'
  | 'arrow-r' | 'arrow-l' | 'arrow-down' | 'search' | 'grip' | 'spark'
  | 'edit' | 'qr' | 'link' | 'eye' | 'clock' | 'route' | 'walking'
  | 'puzzle' | 'flag' | 'sun' | 'moon' | 'help' | 'settings' | 'cake'
  | 'heart' | 'crown' | 'briefcase' | 'camera' | 'balloon' | 'send'
  | 'copy' | 'undo' | 'fox';

interface Props {
  name: IconName;
  size?: number;
  stroke?: number;
  color?: string;
  style?: CSSProperties;
}

export default function Icon({
  name,
  size = 16,
  stroke = 1.5,
  color = 'currentColor',
  style,
}: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style: { display: 'block' as const, flexShrink: 0, ...style },
  };

  switch (name) {
    case 'map':       return <svg {...common}><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v16M15 6v16"/></svg>;
    case 'pin':       return <svg {...common}><path d="M12 21s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>;
    case 'compass':   return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M15 9l-2 5-5 2 2-5z"/></svg>;
    case 'star':      return <svg {...common}><path d="M12 3l2.6 5.4 5.9.8-4.3 4.2 1 5.9L12 16.5 6.8 19.3l1-5.9L3.5 9.2l5.9-.8z"/></svg>;
    case 'sparkle':   return <svg {...common}><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/><path d="M5.6 5.6l4.2 4.2M14.2 14.2l4.2 4.2M5.6 18.4l4.2-4.2M14.2 9.8l4.2-4.2" strokeOpacity="0.5"/></svg>;
    case 'lock':      return <svg {...common}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>;
    case 'gift':      return <svg {...common}><rect x="3" y="8" width="18" height="13" rx="1"/><path d="M3 12h18M12 8v13M8 8a2.5 2.5 0 1 1 4-2.5A2.5 2.5 0 1 1 16 8"/></svg>;
    case 'users':     return <svg {...common}><circle cx="9" cy="8" r="3.5"/><path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/><circle cx="17" cy="6" r="2.5"/><path d="M22 17c0-2.8-2.2-5-5-5"/></svg>;
    case 'calendar':  return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>;
    case 'check':     return <svg {...common}><path d="M4 12l5 5L20 6"/></svg>;
    case 'plus':      return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case 'minus':     return <svg {...common}><path d="M5 12h14"/></svg>;
    case 'x':         return <svg {...common}><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case 'arrow-r':   return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'arrow-l':   return <svg {...common}><path d="M19 12H5M11 18l-6-6 6-6"/></svg>;
    case 'arrow-down':return <svg {...common}><path d="M12 5v14M6 13l6 6 6-6"/></svg>;
    case 'search':    return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>;
    case 'grip':      return <svg {...common}><circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/></svg>;
    case 'spark':     return <svg {...common}><path d="M12 3l1.8 5.5 5.5 1.8-5.5 1.8L12 17.6l-1.8-5.5L4.7 10.3l5.5-1.8z"/></svg>;
    case 'edit':      return <svg {...common}><path d="M4 20h4l11-11-4-4L4 16z"/><path d="M14 6l4 4"/></svg>;
    case 'qr':        return <svg {...common}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3M21 14v3M17 21h4M14 18h3v3"/></svg>;
    case 'link':      return <svg {...common}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5"/></svg>;
    case 'eye':       return <svg {...common}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'clock':     return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'route':     return <svg {...common}><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8 7c4 0 8 1 8 5s-4 5-8 5"/></svg>;
    case 'walking':   return <svg {...common}><circle cx="13" cy="4" r="1.5"/><path d="M9 12l2-4 3 2 3 4M7 21l3-7M14 21l-2-7-2 2"/></svg>;
    case 'puzzle':    return <svg {...common}><path d="M9 4h6v3a2 2 0 1 0 0 4v3H4v-4a2 2 0 1 1 0-4V7a3 3 0 0 1 3-3z"/></svg>;
    case 'flag':      return <svg {...common}><path d="M5 22V4"/><path d="M5 4l10-1 5 3-5 3-10 1"/></svg>;
    case 'sun':       return <svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></svg>;
    case 'moon':      return <svg {...common}><path d="M20 14a8 8 0 1 1-10-10 7 7 0 0 0 10 10z"/></svg>;
    case 'help':      return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .8-1.5 1.4-1.5 3"/><circle cx="12" cy="17" r="0.6" fill="currentColor"/></svg>;
    case 'settings':  return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
    case 'cake':      return <svg {...common}><path d="M5 21V12h14v9z"/><path d="M5 17c2 2 4 0 7 0s5 2 7 0"/><path d="M9 8V5M12 8V4M15 8V5"/></svg>;
    case 'heart':     return <svg {...common}><path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/></svg>;
    case 'crown':     return <svg {...common}><path d="M3 18h18l-2-10-4 4-3-6-3 6-4-4z"/><path d="M3 18v2h18v-2"/></svg>;
    case 'briefcase': return <svg {...common}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>;
    case 'camera':    return <svg {...common}><rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l2-2h4l2 2"/></svg>;
    case 'balloon':   return <svg {...common}><path d="M12 14a5 5 0 1 0-5-5 5 5 0 0 0 5 5z"/><path d="M12 14v3M10 21l2-4 2 4"/></svg>;
    case 'send':      return <svg {...common}><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>;
    case 'copy':      return <svg {...common}><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
    case 'undo':      return <svg {...common}><path d="M3 7v6h6"/><path d="M21 17a8 8 0 0 0-8-8H3"/></svg>;
    case 'fox':       return <svg {...common}><path d="M4 4l4 6 4-2 4 2 4-6-2 8a6 6 0 1 1-12 0z"/><circle cx="9" cy="13" r=".8" fill="currentColor"/><circle cx="15" cy="13" r=".8" fill="currentColor"/></svg>;
  }
}
