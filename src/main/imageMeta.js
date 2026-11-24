/** Removes metadata (camera, location, dates, comments) from JPG and PNG bytes without re-encoding the picture. */

// JPEG segments dropped: APP1 (Exif, XMP), APP12, APP13 (IPTC/Photoshop), COM. APP2 (colour profile) stays.
const JPEG_DROP = new Set([0xe1, 0xec, 0xed, 0xfe])
// PNG chunks dropped: text, Exif, modification time. iCCP (colour profile) stays so colours do not shift.
const PNG_DROP = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME'])

/** EXIF orientation (1-8) of a JPEG, read so a clean copy is not shown rotated. */
function jpegOrientation(app1) {
  if (app1.toString('latin1', 0, 6) !== 'Exif\0\0') return 1
  const tiff = app1.subarray(6)
  const le = tiff.toString('latin1', 0, 2) === 'II'
  const u16 = (o) => (le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o))
  const u32 = (o) => (le ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o))
  try {
    const ifd = u32(4)
    for (let i = 0, n = u16(ifd); i < n; i++) {
      const e = ifd + 2 + i * 12
      if (u16(e) === 0x0112) return u16(e + 8)
    }
  } catch {
    // Damaged Exif: treat as upright.
  }
  return 1
}

/** An APP1 segment holding only the orientation tag. */
function orientationSegment(o) {
  const body = Buffer.from([...Buffer.from('Exif\0\0MM\0*', 'latin1'), 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, o, 0, 0, 0, 0, 0, 0])
  const head = Buffer.from([0xff, 0xe1, 0, 0])
  head.writeUInt16BE(body.length + 2, 2)
  return Buffer.concat([head, body])
}

function stripJpeg(buf) {
  const out = [buf.subarray(0, 2)]
  let orientation = 1
  let i = 2
  while (i + 4 <= buf.length && buf[i] === 0xff) {
    const marker = buf[i + 1]
    if (marker === 0xda) break // start of scan: the rest is picture data
    const len = buf.readUInt16BE(i + 2)
    const seg = buf.subarray(i, i + 2 + len)
    if (marker === 0xe1 && orientation === 1) orientation = jpegOrientation(seg.subarray(4))
    if (!JPEG_DROP.has(marker)) out.push(seg)
    i += 2 + len
  }
  if (orientation > 1 && orientation <= 8) out.splice(1, 0, orientationSegment(orientation))
  out.push(buf.subarray(i))
  return Buffer.concat(out)
}

function stripPng(buf) {
  const out = [buf.subarray(0, 8)]
  let i = 8
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i)
    const type = buf.toString('latin1', i + 4, i + 8)
    if (!PNG_DROP.has(type)) out.push(buf.subarray(i, i + 12 + len))
    i += 12 + len
  }
  return Buffer.concat(out)
}

/** Clean bytes for a JPG or PNG, or null when the bytes are neither. */
export function stripMetadata(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return stripJpeg(buf)
  if (buf.length > 8 && buf.toString('latin1', 1, 4) === 'PNG') return stripPng(buf)
  return null
}

export const isCleanable = (path) => /\.(jpe?g|png)$/i.test(path)
