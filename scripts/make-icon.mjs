// Writes build/icon.png (256px) from the shared icon drawing; electron-builder turns it into the EXE's .ico.
// Run with: electron scripts/make-icon.mjs
import { app, nativeImage } from 'electron'
import { writeFileSync } from 'node:fs'
import { drawIcon } from '../src/main/iconArt.mjs'

app.whenReady().then(() => {
  const size = 256
  const png = nativeImage.createFromBitmap(drawIcon(size), { width: size, height: size }).toPNG()
  writeFileSync(new URL('../build/icon.png', import.meta.url), png)
  app.quit()
})
