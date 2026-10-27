import type { ReactNode } from 'react';
import type { Attachment, ProjectInfo } from '@/lib/types';
import { DeviceFrame } from './DeviceFrame';
import { BrowserIcon } from './browsers';

export function artifactUrl(path: string): string {
  // The hosted dashboard stores attachments in Vercel Blob under full URLs.
  if (/^https?:\/\//.test(path)) return path;
  return `/api/artifacts?path=${encodeURIComponent(path)}`;
}

/** A desktop browser window around content: traffic lights, browser icon and a title bar. */
export function BrowserChrome({ browser, title, children }: { browser?: string; title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/70 px-3 py-1.5">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="size-2 rounded-full bg-[#ff5f57]" />
          <span className="size-2 rounded-full bg-[#febc2e]" />
          <span className="size-2 rounded-full bg-[#28c840]" />
        </span>
        {browser && <BrowserIcon browser={browser} width={13} height={13} className="ml-1 shrink-0" />}
        <span className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-0.5 font-mono text-[10px] text-ink-3">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

/**
 * A screenshot or video shown the way it was captured: inside the phone/tablet frame for emulated devices
 * (full-page screenshots scroll inside the screen), or inside a browser window for desktop browsers.
 */
export function MediaFrame({
  attachment,
  project,
  title,
  zoom = 0.75,
}: {
  attachment: Attachment;
  project: ProjectInfo | undefined;
  title: string;
  zoom?: number;
}) {
  const url = artifactUrl(attachment.path);
  // Videos open half a second in: their first frame is the blank page before the test navigates.
  const image = attachment.contentType.startsWith('image/');

  if (project?.kind === 'device') {
    return (
      <DeviceFrame project={project} zoom={zoom}>
        {image ? (
          <div className="absolute inset-0 overflow-y-auto overscroll-contain bg-white">
            {/* Served dynamically from the framework folder, so next/image optimization does not apply. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Screenshot: ${title}`} loading="lazy" className="block w-full" />
          </div>
        ) : (
          <video
            src={`${url}#t=0.5`}
            controls
            preload="metadata"
            playsInline
            className="absolute inset-0 size-full bg-black object-contain"
          />
        )}
      </DeviceFrame>
    );
  }

  return (
    <BrowserChrome browser={project?.name} title={title}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`Screenshot: ${title}`}
          loading="lazy"
          className="aspect-video w-full bg-white object-cover object-top"
        />
      ) : (
        <video src={`${url}#t=0.5`} controls preload="metadata" className="aspect-video w-full bg-black" />
      )}
    </BrowserChrome>
  );
}
