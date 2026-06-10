// icons.jsx — minimal line-icon set for Salon. Stroke-based, inherit color.
const Svg = ({ size = 24, children, fill = 'none', stroke = 'currentColor', sw = 1.7, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {children}
  </svg>
);

const IconCompass = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></Svg>
);
const IconSearch = (p) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Svg>
);
const IconHeart = ({ filled, ...p }) => (
  <Svg {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20.5l-1.4-1.3C5.4 14.6 2.5 11.9 2.5 8.6 2.5 6 4.5 4 7.1 4c1.5 0 2.9.7 3.8 1.8L12 7l1.1-1.2C14 4.7 15.4 4 16.9 4 19.5 4 21.5 6 21.5 8.6c0 3.3-2.9 6-8.1 10.6z" />
  </Svg>
);
const IconCalendar = (p) => (
  <Svg {...p}><rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></Svg>
);
const IconClose = (p) => (<Svg {...p} sw={2}><path d="M6 6l12 12M18 6L6 18" /></Svg>);
const IconChevronDown = (p) => (<Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>);
const IconChevronRight = (p) => (<Svg {...p}><path d="M9 6l6 6-6 6" /></Svg>);
const IconChevronLeft = (p) => (<Svg {...p}><path d="M15 6l-6 6 6 6" /></Svg>);
const IconShare = (p) => (
  <Svg {...p}><path d="M12 15V3.5M12 3.5L8 7.5M12 3.5l4 4" /><path d="M5 12v6.5a1.5 1.5 0 001.5 1.5h11a1.5 1.5 0 001.5-1.5V12" /></Svg>
);
const IconDownload = (p) => (
  <Svg {...p}><path d="M12 3.5v11M12 14.5L8 10.5M12 14.5l4-4" /><path d="M5 19.5h14" /></Svg>
);
const IconExpand = (p) => (
  <Svg {...p}><path d="M9 4H5a1 1 0 00-1 1v4M15 4h4a1 1 0 011 1v4M9 20H5a1 1 0 01-1-1v-4M15 20h4a1 1 0 001-1v-4" /></Svg>
);
const IconSparkle = (p) => (
  <Svg {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></Svg>
);
const IconCheck = (p) => (<Svg {...p} sw={2}><path d="M4 12.5l5 5L20 6" /></Svg>);
const IconExternal = (p) => (
  <Svg {...p}><path d="M14 5h5v5M19 5l-8 8" /><path d="M18 14v4.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 014 18.5v-11A1.5 1.5 0 015.5 6H10" /></Svg>
);
const IconInfo = (p) => (<Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.5" /></Svg>);
const IconFlame = (p) => (
  <Svg {...p}><path d="M12 3c.5 3-2 4-2 7a2 2 0 104 0c0-1 .5-1.5.5-1.5C16 11 17 13 17 15a5 5 0 11-10 0c0-4 5-5 5-12z" /></Svg>
);
const IconShuffle = (p) => (
  <Svg {...p}><path d="M16 4h4v4M20 4l-6 6M16 20h4v-4M20 20l-5.5-5.5M4 5l4.5 4.5M4 19l5-5" /></Svg>
);
const IconLayers = (p) => (
  <Svg {...p}><path d="M12 3l9 5-9 5-9-5z" /><path d="M3.5 12.5L12 17l8.5-4.5" /></Svg>
);
const IconArrowLeft = (p) => (<Svg {...p}><path d="M19 12H5M5 12l6-6M5 12l6 6" /></Svg>);

Object.assign(window, {
  Icon: {
    Compass: IconCompass, Search: IconSearch, Heart: IconHeart, Calendar: IconCalendar,
    Close: IconClose, ChevronDown: IconChevronDown, ChevronRight: IconChevronRight,
    ChevronLeft: IconChevronLeft, Share: IconShare, Download: IconDownload,
    Expand: IconExpand, Sparkle: IconSparkle, Check: IconCheck, External: IconExternal,
    Info: IconInfo, Flame: IconFlame, Shuffle: IconShuffle, Layers: IconLayers,
    ArrowLeft: IconArrowLeft,
  },
});
