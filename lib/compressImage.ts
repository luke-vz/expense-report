// Shrinks a photo on the phone before uploading: longest side 1600px, JPEG.
// A ticket stays readable (also for the upcoming AI reading) at ~200-400 KB
// instead of the 3-6 MB a phone camera produces.
const MAX_SIDE = 1600;
const QUALITY = 0.75;

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    // Respects the EXIF orientation of phone photos
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Fallback for formats createImageBitmap rejects in some browsers
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export async function compressImage(file: File): Promise<Blob> {
  const image = await decode(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.drawImage(image, 0, 0, width, height);
  if ("close" in image) image.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Encoding failed"))), "image/jpeg", QUALITY)
  );
}
