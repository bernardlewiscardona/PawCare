import type { Attachment } from './types';

/** Caption for an attachment row by scan/upload state (MR-02). */
export function attachmentDetail(a: Attachment): string {
  if (a.state === 'scanning') return 'Checking the file before it can be opened';
  if (a.state === 'uploading') return `Uploading · ${Math.round((a.progress ?? 0) * 100)}%`;
  if (a.state === 'rejected') return 'Only PDF, JPG, PNG or HEIC up to 10 MB';
  if (a.state === 'failed') return 'Upload failed. Tap to retry.';
  return `${a.format} · ${a.size}`;
}

/** At most five files per record (MR-02). */
export const FILE_LIMIT = 5;
