export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const MAX_BYTES     = 5 * 1024 * 1024;
export const MAX_EDGE_PX   = 1920;
export const OUT_QUALITY   = 0.85;

export function validateFile(file) {
  if (!file.type.startsWith('image/')) {
    return { ok: false, reason: 'Image files only (JPEG, PNG, WebP, GIF).' };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, reason: 'Image files only (JPEG, PNG, WebP, GIF).' };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, reason: 'File too large — max 5MB.' };
  }
  return { ok: true };
}

export async function compressImage(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode image.'));
      el.src = objectUrl;
    });

    let { naturalWidth: w, naturalHeight: h } = img;
    if (w > MAX_EDGE_PX || h > MAX_EDGE_PX) {
      if (w >= h) {
        h = Math.round((h / w) * MAX_EDGE_PX);
        w = MAX_EDGE_PX;
      } else {
        w = Math.round((w / h) * MAX_EDGE_PX);
        h = MAX_EDGE_PX;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width  = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);

    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) reject(new Error('Canvas toBlob returned null.'));
          else resolve(blob);
        },
        'image/jpeg',
        OUT_QUALITY,
      );
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function sanitizeFilename(name) {
  const ext   = name.includes('.') ? '.' + name.split('.').pop().toLowerCase() : '';
  const base  = name
    .replace(/[/\\]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .slice(0, 50);
  const suffix = Math.random().toString(36).slice(2, 7);
  return (base + '_' + suffix + ext).slice(0, 60);
}

/*
// Manual verification (run in browser console — not part of build):
//
// import { validateFile, compressImage, sanitizeFilename } from './src/lib/attachments.js';
//
// Test 1: validateFile with a 6MB "JPEG" file object
//   const f = new File([new ArrayBuffer(6*1024*1024)], 'test.jpg', { type: 'image/jpeg' });
//   console.log(validateFile(f)); // { ok: false, reason: 'File too large...' }
//
// Test 2: validateFile with a PDF
//   const f2 = new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' });
//   console.log(validateFile(f2)); // { ok: false, reason: 'Image files only...' }
//
// Test 3: compressImage on a real 4000x3000 6MB JPEG
//   // fetch a test image, create a File, then:
//   const blob = await compressImage(file);
//   console.log(blob.size); // should be well under 600_000
//   const bmp = await createImageBitmap(blob);
//   console.log(bmp.width, bmp.height); // longest edge <= 1920
//
// Test 4: sanitizeFilename
//   console.log(sanitizeFilename('My Screenshot 2024.PNG')); // 'my_screenshot_2024.png_xxxxx.png'
*/
