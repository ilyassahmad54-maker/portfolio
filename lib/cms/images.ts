import 'server-only';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { CmsHttpError } from './errors';
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
let decoding = false;
export async function validateImage(bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new CmsHttpError(413, 'Image exceeds the 4 MiB limit.');
  const format = bytes.subarray(0,3).equals(Buffer.from([255,216,255])) ? 'jpeg' :
    bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png' :
    bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP' ? 'webp' : null;
  if (!format) throw new CmsHttpError(422, 'Unsupported image.');
  if(format==='png') {
    // libvips can treat APNG as a static PNG; explicitly reject its animation chunk.
    let offset=8;
    while(offset+12<=bytes.length) {
      const length=bytes.readUInt32BE(offset);
      if(length>bytes.length-offset-12)throw new CmsHttpError(422,'Malformed image.');
      if(bytes.toString('ascii',offset+4,offset+8)==='acTL')throw new CmsHttpError(422,'Animated images are unsupported.');
      offset+=length+12;
    }
  }
  if(decoding)throw new CmsHttpError(429,'Image decoder is busy. Try again shortly.');
  decoding=true;
  try {
    const image = sharp(bytes, { failOn: 'warning', limitInputPixels: 40000000, limitInputChannels: 4, animated: true });
    const meta = await image.metadata();
    if (meta.format !== format || !meta.width || !meta.height || meta.width > 8192 || meta.height > 8192 || meta.width*meta.height > 40000000 || (meta.pages || 1) !== 1) throw new Error();
    // Force a complete bounded pixel decode; metadata alone does not validate image data.
    await image.timeout({ seconds: 5 }).raw().toBuffer();
    return { sha256: createHash('sha256').update(bytes).digest('hex'), mime: `image/${format}`, size: bytes.length, width: meta.width, height: meta.height };
  } catch { throw new CmsHttpError(422, 'Malformed image or image limits exceeded.'); }
  finally { decoding=false; }
}
