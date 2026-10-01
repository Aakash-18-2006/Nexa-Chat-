import { Browser } from '@capacitor/browser';
import { isCapacitorNative, resolveMediaUrl } from './urlConfig';

/**
 * Handles opening or downloading attachments across Web and Android (Capacitor).
 * Ensures that the NEXA SPA never reloads, never navigates away, and handles all file types appropriately.
 *
 * @param {Object} params
 * @param {string} params.url - The attachment URL (e.g. /uploads/file-123.docx)
 * @param {string} [params.name] - Original filename (e.g. Report.docx)
 * @param {string} [params.mimeType] - MIME type of the file
 */
export const openOrDownloadFile = async ({ url, name, mimeType }) => {
  const resolvedUrl = resolveMediaUrl(url);
  const fileName = name || (url ? url.split('/').pop() : 'downloaded_file');
  const fileMime = mimeType || '';
  const isNative = isCapacitorNative();
  const platform = isNative ? 'android-capacitor' : 'web-browser';

  console.log('[FileOpen] clicked');
  console.log('[FileOpen] filename:', fileName);
  console.log('[FileOpen] mimeType:', fileMime || 'application/octet-stream');
  console.log('[FileOpen] resolved URL:', resolvedUrl);
  console.log('[FileOpen] platform:', platform);

  if (!resolvedUrl) {
    console.error('[FileOpen] failed: missing or invalid URL');
    alert('Unable to open this file. URL is invalid.');
    return;
  }

  // 1. Android Capacitor Native Platform Handler
  if (isNative) {
    try {
      console.log('[FileOpen] opening externally');
      await Browser.open({
        url: resolvedUrl,
        windowName: '_system',
        presentationStyle: 'popover'
      });
      return;
    } catch (err) {
      console.warn('[FileOpen] Browser.open error, falling back to window.open:', err?.message || err);
      try {
        window.open(resolvedUrl, '_system');
        return;
      } catch (fallbackErr) {
        console.error('[FileOpen] failed:', fallbackErr?.message || fallbackErr);
        alert('Unable to open this file. Try downloading it.');
        return;
      }
    }
  }

  // 2. Web / Desktop Platform Handler
  try {
    const isDirectViewable =
      fileMime.startsWith('image/') ||
      fileMime === 'application/pdf' ||
      fileMime.startsWith('text/') ||
      /\.(pdf|txt|png|jpe?g|gif|webp|svg)$/i.test(fileName);

    if (isDirectViewable) {
      // Open in a new tab without navigating current window
      const win = window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
      if (!win) {
        // In case pop-up blocker intervened, use anchor
        const a = document.createElement('a');
        a.href = resolvedUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      return;
    }

    // For downloadable files (DOCX, DOC, XLSX, PPTX, ZIP, etc.)
    // Download with clean original filename via Blob
    try {
      const response = await fetch(resolvedUrl);
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
        return;
      }
    } catch (fetchErr) {
      console.warn('[FileOpen] Blob fetch failed, falling back to anchor download:', fetchErr?.message || fetchErr);
    }

    // Fallback: direct anchor with target="_blank"
    const a = document.createElement('a');
    a.href = resolvedUrl;
    a.download = fileName;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.error('[FileOpen] failed:', err?.message || err);
    alert('Unable to open this file. Try downloading it.');
  }
};
