import type { Attachment, ProjectInfo } from '@/lib/types';
import { artifactUrl, MediaFrame } from './MediaFrame';
import { CameraIcon, DownloadIcon, ExternalIcon, VideoIcon } from './icons';

export { artifactUrl };

/** Human label for an attachment, from Playwright's file names (test-finished-N.png, test-failed-N.png, trace.zip). */
export function mediaLabel(attachment: Attachment): string {
  const file = attachment.path.split('/').pop() ?? '';
  if (attachment.contentType.startsWith('image/'))
    return file.includes('failed') ? 'Failure screenshot' : 'Final screenshot';
  if (attachment.contentType.startsWith('video/')) return 'Video';
  if (attachment.name.startsWith('trace') || file.endsWith('.zip')) return 'Trace: step-by-step screenshots';
  return attachment.name;
}

/** Media counts for a test, shown as small icons. */
export function MediaBadges({ attachments = [] }: { attachments?: Attachment[] }) {
  const screenshots = attachments.filter((item) => item.contentType.startsWith('image/')).length;
  const videos = attachments.filter((item) => item.contentType.startsWith('video/')).length;
  if (!screenshots && !videos) return <span className="text-xs text-ink-3">-</span>;
  return (
    <span className="inline-flex items-center gap-2 text-xs text-ink-3">
      {screenshots > 0 && (
        <span
          className="inline-flex items-center gap-1"
          title={`${screenshots} screenshot${screenshots === 1 ? '' : 's'}`}
        >
          <CameraIcon width={13} height={13} /> {screenshots}
        </span>
      )}
      {videos > 0 && (
        <span className="inline-flex items-center gap-1" title={`${videos} video${videos === 1 ? '' : 's'}`}>
          <VideoIcon width={13} height={13} /> {videos}
        </span>
      )}
    </span>
  );
}

/** Screenshots and videos side by side, each in its device or browser frame, with open and download links. */
export function MediaGallery({
  attachments,
  title,
  project,
}: {
  attachments: Attachment[];
  title: string;
  /** Browser or device the test ran on; device media is shown inside the phone/tablet frame. */
  project?: ProjectInfo | undefined;
}) {
  const media = attachments.filter((item) => /^(image|video)\//.test(item.contentType));
  const files = attachments.filter((item) => !media.includes(item));
  const device = project?.kind === 'device';

  return (
    <div className="space-y-3">
      <div className={device ? 'flex flex-wrap items-start justify-center gap-8 py-2' : 'grid gap-3 sm:grid-cols-2'}>
        {media.map((item) => (
          <figure key={item.path} className="flex min-w-0 flex-col items-center gap-2">
            <div className="w-full">
              <MediaFrame attachment={item} project={project} title={title} zoom={0.7} />
            </div>
            <figcaption className="flex w-full items-center justify-between gap-2 text-xs text-ink-2">
              <span className="inline-flex items-center gap-1.5">
                {item.contentType.startsWith('image/') ? (
                  <CameraIcon width={13} height={13} />
                ) : (
                  <VideoIcon width={13} height={13} />
                )}
                {mediaLabel(item)}
              </span>
              <span className="flex gap-1">
                <a
                  href={artifactUrl(item.path)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded p-1 hover:bg-surface-2 hover:text-ink"
                  aria-label="Open"
                >
                  <ExternalIcon width={13} height={13} />
                </a>
                <a
                  href={artifactUrl(item.path)}
                  download
                  className="rounded p-1 hover:bg-surface-2 hover:text-ink"
                  aria-label="Download"
                >
                  <DownloadIcon width={13} height={13} />
                </a>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {files.map((item) => (
            <a
              key={item.path}
              href={artifactUrl(item.path)}
              download
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-2 hover:bg-surface-2 hover:text-ink"
            >
              <DownloadIcon width={13} height={13} /> {mediaLabel(item)}
            </a>
          ))}
          {files.some((item) => mediaLabel(item).startsWith('Trace')) && (
            <span className="text-xs text-ink-3">
              Open a trace with <code className="font-mono">npx playwright show-trace &lt;file&gt;</code> to step
              through every action.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
