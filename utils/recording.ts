/**
 * Browser window sizes the framework can run at. The viewport, the video of every test and its screenshots all
 * use the chosen size. Pick one with RECORDING_RESOLUTION (default 1080p).
 */
export const RECORDING_SIZES = {
  '720p': { width: 1280, height: 720, label: 'HD' },
  '1080p': { width: 1920, height: 1080, label: 'Full HD' },
  '1440p': { width: 2560, height: 1440, label: '2K' },
} as const;

export type RecordingResolution = keyof typeof RECORDING_SIZES;

export const DEFAULT_RECORDING_RESOLUTION: RecordingResolution = '1080p';

export function isRecordingResolution(value: string | undefined): value is RecordingResolution {
  return value !== undefined && Object.hasOwn(RECORDING_SIZES, value);
}
