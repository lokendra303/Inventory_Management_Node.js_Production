/**
 * Validate that a Blob from /pdf?download is a real PDF (not a JSON error body).
 */
export async function assertPdfBlob(blob) {
  if (!blob || blob.size < 32) {
    throw new Error('Empty or invalid PDF response');
  }
  const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46; // "%PDF"
  if (isPdf) return;

  let msg = 'Server did not return a valid PDF file';
  const text = await blob.text();
  const t = text.trimStart();
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      const j = JSON.parse(text);
      msg = j.error || j.message || msg;
    } catch {
      /* ignore */
    }
  }
  throw new Error(msg);
}

/**
 * Open a PDF blob in a new tab and print. Chrome often never fires `load` on blob: PDF URLs,
 * so we also call print() after a short delay as a fallback (same pattern as many ERP UIs).
 *
 * @param {Blob} blob
 * @returns {Promise<void>}
 */
export async function printPdfBlob(blob) {
  await assertPdfBlob(blob);
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) {
    URL.revokeObjectURL(url);
    throw new Error('POPUP_BLOCKED');
  }

  let printed = false;
  const runPrint = () => {
    if (printed) return;
    printed = true;
    try {
      w.focus();
      w.print();
    } catch {
      /* ignore */
    }
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  };

  w.addEventListener('load', () => setTimeout(runPrint, 400));
  setTimeout(runPrint, 1200);
}
