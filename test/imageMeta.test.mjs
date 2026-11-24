import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deflateSync } from 'node:zlib'
import { stripMetadata } from '../src/main/imageMeta.js'

const seg = (marker, body) => {
  const b = Buffer.from(body, 'latin1')
  const h = Buffer.from([0xff, marker, 0, 0])
  h.writeUInt16BE(b.length + 2, 2)
  return Buffer.concat([h, b])
}
// Big-endian Exif with orientation 6 and a fake GPS-looking string after it.
const exif = 'Exif\0\0MM\0*\0\0\0\x08\0\x01\x01\x12\0\x03\0\0\0\x01\0\x06\0\0\0\0\0\0GPS-SECRET'

test('JPEG: drops Exif, XMP, IPTC and comments, keeps ICC, picture data and orientation', () => {
  const jpg = Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(0xe0, 'JFIF\0'),
    seg(0xe1, exif),
    seg(0xe2, 'ICC_PROFILE\0'),
    seg(0xed, 'Photoshop IPTC'),
    seg(0xfe, 'a comment'),
    Buffer.from([0xff, 0xda, 0, 2, 1, 2, 3, 0xff, 0xd9]),
  ])
  const out = stripMetadata(jpg).toString('latin1')
  for (const gone of ['GPS-SECRET', 'Photoshop', 'a comment']) assert.ok(!out.includes(gone), gone)
  assert.ok(out.includes('ICC_PROFILE') && out.includes('JFIF'))
  assert.ok(out.endsWith('\xff\xda\0\x02\x01\x02\x03\xff\xd9'))
  assert.ok(out.includes('\x01\x12\0\x03\0\0\0\x01\0\x06'), 'orientation 6 kept')
})

test('PNG: drops text, Exif and time chunks, keeps the rest', () => {
  const chunk = (type, data) => {
    const d = Buffer.from(data, 'latin1')
    const len = Buffer.alloc(4)
    len.writeUInt32BE(d.length)
    return Buffer.concat([len, Buffer.from(type), d, Buffer.alloc(4)])
  }
  const png = Buffer.concat([
    Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'),
    chunk('IHDR', '\0'.repeat(13)),
    chunk('iCCP', 'sRGB\0\0'),
    chunk('tEXt', 'Author\0me'),
    chunk('eXIf', 'GPS-SECRET'),
    chunk('IDAT', deflateSync(Buffer.alloc(4)).toString('latin1')),
    chunk('IEND', ''),
  ])
  const out = stripMetadata(png).toString('latin1')
  assert.ok(!out.includes('GPS-SECRET') && !out.includes('Author'))
  for (const kept of ['IHDR', 'iCCP', 'IDAT', 'IEND']) assert.ok(out.includes(kept), kept)
})

test('other bytes are not touched', () => {
  assert.equal(stripMetadata(Buffer.from('GIF89a')), null)
})
