import sharp from 'sharp';

export async function normalizeReviewPhoto(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 7_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    const error = new Error('Foto inválida. Envie JPG, PNG ou WebP de até 5 MB.'); error.status=422; throw error;
  }
  const bytes = Buffer.from(value,'base64');
  try {
    if (bytes.length > 5 * 1024 * 1024) throw new Error('size');
    const options = {limitInputPixels:16_000_000,animated:false,failOn:'warning'};
    const metadata = await sharp(bytes,options).metadata();
    if (!['jpeg','png','webp'].includes(metadata.format) || (metadata.pages || 1) > 1) throw new Error('format');
    // Re-encode pixels, orient the photo and discard metadata and original file names.
    return await sharp(bytes,options).rotate().resize(800,800,{fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer();
  } catch {
    const error = new Error('Foto inválida. Use JPG, PNG ou WebP, até 5 MB e 16 megapixels.'); error.status=422; throw error;
  }
}
