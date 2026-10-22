/** Tray icon: the shared app icon at 32px, plus a 64px representation for high-DPI screens. */
import { nativeImage } from 'electron'
import { drawIcon } from './iconArt.mjs'

export function makeTrayIcon(paused = false) {
  const image = nativeImage.createEmpty()
  for (const size of [32, 64]) {
    // addRepresentation only takes encoded images, so go through PNG.
    const png = nativeImage.createFromBitmap(drawIcon(size, paused), { width: size, height: size }).toPNG()
    image.addRepresentation({ scaleFactor: size / 32, width: size, height: size, buffer: png })
  }
  return image
}
