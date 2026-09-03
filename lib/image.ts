/**
 * Client-side downscale for a photo before it's shipped to the AI vision
 * API or stored on the plant row. A phone camera photo can run 5-10 MB;
 * nothing downstream (the OpenAI request, the Postgres `text` column, the
 * plant grid) needs more than a modest preview-sized JPEG. Runs entirely in
 * the browser via canvas, so no server round trip is needed just to shrink
 * the file.
 */
export const MAX_IMAGE_EDGE_PX = 1024;
const JPEG_QUALITY = 0.82;

export function compressImageFile(file: File, maxEdge = MAX_IMAGE_EDGE_PX): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas is not supported in this browser'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read this image file'));
    };

    img.src = objectUrl;
  });
}
