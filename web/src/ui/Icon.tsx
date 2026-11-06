/** Conjunto propio de iconos: trazo 1,75, 20 px, un color. Siempre con texto o aria-label. */
import type { SVGProps } from 'react';

const paths: Record<string, string> = {
  today: 'M4 6.5h16M7 3v3M17 3v3M5 6.5h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1ZM8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01',
  diary: 'M6 3h10a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm0 0v18M9 8h6M9 12h6',
  notebooks: 'M4 5a2 2 0 0 1 2-2h6v18H6a2 2 0 0 1-2-2V5Zm8-2h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6M7 8h2M7 12h2',
  goals: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-3v-1',
  tasks: 'M9 11l2 2 4-4M5 5h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  reminders: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16ZM10 20a2 2 0 0 0 4 0',
  review: 'M4 20h16M6 16l4-4 3 3 5-6M14 9h4v4',
  impulse: 'M12 3v4M12 17v4M3 12h4M17 12h4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-4-4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.1l2.1-1.6-2-3.4-2.5 1a7.5 7.5 0 0 0-1.9-1.1L14.6 3H9.4L9 5.8a7.5 7.5 0 0 0-1.9 1.1l-2.5-1-2 3.4 2.1 1.6a7.4 7.4 0 0 0 0 2.2L2.6 14.7l2 3.4 2.5-1a7.5 7.5 0 0 0 1.9 1.1l.4 2.8h5.2l.4-2.8a7.5 7.5 0 0 0 1.9-1.1l2.5 1 2-3.4-2.1-1.6c.1-.4.1-.7.1-1.1Z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  back: 'M15 5l-7 7 7 7',
  forward: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12l5 5L20 7',
  close: 'M6 6l12 12M18 6 6 18',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z',
  eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  eyeOff: 'M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A16 16 0 0 0 2 12s3.5 7 10 7c1.2 0 2.3-.2 3.3-.6',
  pin: 'M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.6l-4.9 2.6.9-5.5-4-3.9L9.5 8 12 3Z',
  archive: 'M4 7h16v13H4V7Zm0-3h16v3H4V4Zm6 7h4',
  trash: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13',
  edit: 'M4 20h4l10-10-4-4L4 16v4Zm10-14 4 4',
  calendar: 'M4 8h16M8 3v3M16 3v3M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  tag: 'M3 11V4h7l10 10-7 7L3 11Zm4-4h.01',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4h.01M9.5 9.5a2.5 2.5 0 1 1 3.8 2.1c-.8.5-1.3 1-1.3 1.9',
  download: 'M12 4v11M7 10l5 5 5-5M4 20h16',
  upload: 'M12 15V4M7 9l5-5 5 5M4 20h16',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-9v5M12 8h.01',
  dot: 'M12 12h.01',
  wave: 'M3 12c2-2.5 4-2.5 6 0s4 2.5 6 0 4-2.5 6 0',
  repeat: 'M17 2l4 4-4 4M3 11V9a4 4 0 014-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 01-4 4H3',
  sound: 'M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 010 7M19 5a9 9 0 010 14',
  stop: 'M6 6h12v12H6z',
  next: 'M5 4l10 8-10 8V4zM19 5v14',
  pause: 'M8 5v14M16 5v14',
  play: 'M8 5v14l11-7L8 5Z',
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={rest['aria-label'] ? undefined : true}
      focusable="false"
      {...rest}
    >
      <path d={paths[name]} />
    </svg>
  );
}
