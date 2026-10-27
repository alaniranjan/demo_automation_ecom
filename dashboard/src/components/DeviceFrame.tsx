'use client';

import type { ReactNode } from 'react';
import type { ProjectInfo } from '@/lib/types';
import { useNow } from '@/lib/useNow';

/** Screen widths (px at 100% zoom) the frame is drawn at; the height follows the device's real aspect ratio. */
const SCREEN_WIDTH = { phone: 310, tablet: 470 };
/** iOS and Android status bars are about 44 CSS px tall. */
const STATUS_BAR_CSS_PX = 44;

function StatusBar({ height, android, time }: { height: number; android: boolean; time: string }) {
  return (
    <div
      className="relative z-10 flex shrink-0 items-center justify-between bg-white font-semibold text-black"
      style={{
        height,
        paddingInline: height * 0.55,
        fontSize: Math.max(9, height * 0.32),
      }}
    >
      <span>{time}</span>
      <span className="flex items-center" style={{ gap: height * 0.12 }} aria-hidden="true">
        {/* signal */}
        <svg viewBox="0 0 18 12" style={{ height: height * 0.28 }}>
          {[0, 1, 2, 3].map((bar) => (
            <rect
              key={bar}
              x={bar * 4.6}
              y={9 - bar * 3}
              width="3.2"
              height={3 + bar * 3}
              rx="0.8"
              fill="currentColor"
            />
          ))}
        </svg>
        {/* wifi */}
        <svg viewBox="0 0 16 12" style={{ height: height * 0.28 }}>
          <path
            d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0Z M3.2 6.6a6.8 6.8 0 0 1 9.6 0l-1.4 1.4a4.8 4.8 0 0 0-6.8 0Z M.8 4.2a10.2 10.2 0 0 1 14.4 0L13.8 5.6a8.2 8.2 0 0 0-11.6 0Z"
            fill="currentColor"
          />
        </svg>
        {/* battery */}
        <svg viewBox="0 0 26 12" style={{ height: height * 0.28 }}>
          <rect
            x="0.5"
            y="0.5"
            width="22"
            height="11"
            rx={android ? 2 : 3}
            fill="none"
            stroke="currentColor"
            opacity="0.45"
          />
          <rect x="2" y="2" width="16" height="8" rx={android ? 1 : 1.8} fill="currentColor" />
          <rect x="23.5" y="4" width="1.8" height="4" rx="0.9" fill="currentColor" opacity="0.45" />
        </svg>
      </span>
    </div>
  );
}

/**
 * A realistic phone or tablet around the live screen: bezel, metal edge, side buttons, status bar with the
 * current time, Dynamic Island (iPhone) or punch-hole camera (Android), and the iOS home indicator.
 */
export function DeviceFrame({
  project,
  zoom = 1,
  children,
}: {
  project: ProjectInfo;
  zoom?: number;
  children: ReactNode;
}) {
  const now = useNow(30_000);
  const viewport = project.viewport ?? { width: 390, height: 844 };
  const tablet = /tablet|ipad/i.test(project.category ?? '');
  const android = project.os === 'Android';
  const screenWidth = (tablet ? SCREEN_WIDTH.tablet : SCREEN_WIDTH.phone) * zoom;
  const scale = screenWidth / viewport.width;
  const bezel = (tablet ? 16 : 11) * zoom;
  const outerRadius = (tablet ? 34 : 50) * zoom;
  const statusHeight = STATUS_BAR_CSS_PX * scale;
  const time =
    now === null
      ? '9:41'
      : new Date(now)
          .toLocaleTimeString('en', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: !android,
          })
          .replace(/\s?[AP]M$/i, '');

  return (
    <div
      className="relative mx-auto transition-[width] duration-300 ease-smooth"
      style={{ width: screenWidth + bezel * 2 }}
    >
      {/* Side buttons: power on the right; volume (and the iPhone action button) on the left. */}
      <span
        className="absolute rounded-r-sm bg-[#2c2c30]"
        style={{
          right: -3 * zoom,
          top: '22%',
          width: 3 * zoom,
          height: tablet ? '6%' : '11%',
        }}
      />
      {!tablet && (
        <>
          {!android && (
            <span
              className="absolute rounded-l-sm bg-[#2c2c30]"
              style={{
                left: -3 * zoom,
                top: '15%',
                width: 3 * zoom,
                height: '4%',
              }}
            />
          )}
          <span
            className="absolute rounded-l-sm bg-[#2c2c30]"
            style={{
              left: -3 * zoom,
              top: '23%',
              width: 3 * zoom,
              height: '8%',
            }}
          />
          <span
            className="absolute rounded-l-sm bg-[#2c2c30]"
            style={{
              left: -3 * zoom,
              top: '33%',
              width: 3 * zoom,
              height: '8%',
            }}
          />
        </>
      )}
      <div
        className="relative bg-[#0a0a0c]"
        style={{
          borderRadius: outerRadius,
          padding: bezel,
          boxShadow:
            'inset 0 0 0 2px #3b3b40, inset 0 0 0 4px #121214, 0 30px 60px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        {tablet && (
          <span
            className="absolute left-1/2 -translate-x-1/2 rounded-full bg-[#1d1d22]"
            style={{ top: bezel * 0.35, width: 6 * zoom, height: 6 * zoom }}
          />
        )}
        <div className="relative flex flex-col overflow-hidden bg-white" style={{ borderRadius: outerRadius - bezel }}>
          <StatusBar height={statusHeight} android={android} time={time} />
          {!tablet &&
            (android ? (
              <span
                className="absolute left-1/2 z-20 -translate-x-1/2 rounded-full bg-black"
                style={{
                  top: statusHeight * 0.22,
                  width: statusHeight * 0.48,
                  height: statusHeight * 0.48,
                }}
              />
            ) : (
              <span
                className="absolute left-1/2 z-20 -translate-x-1/2 rounded-full bg-black"
                style={{
                  top: statusHeight * 0.16,
                  width: screenWidth * 0.31,
                  height: statusHeight * 0.7,
                }}
              />
            ))}
          <div
            className="relative w-full overflow-hidden bg-black"
            style={{ aspectRatio: `${viewport.width} / ${viewport.height}` }}
          >
            {children}
          </div>
          {!android && (
            <span
              className="absolute bottom-1.5 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/70"
              style={{
                width: screenWidth * (tablet ? 0.22 : 0.36),
                height: Math.max(3, 4 * zoom),
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
