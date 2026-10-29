/** History tabs and the rule that decides which tab(s) an item shows up in. */

/** `icon` is an SVG path on a 24px grid, drawn as a 2px stroke like the card buttons. */
export const CATEGORIES = [
  { id: 'all', icon: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
  { id: 'files', icon: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5' },
  { id: 'images', icon: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM4 16l5-5 4 4 2-2 5 5M15 8.5h.01' },
  { id: 'videos', icon: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM10 9l5 3-5 3z' },
  { id: 'audio', icon: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z' },
  // `title`: the tab has a short label and a longer tooltip name (see i18n.js), so the open tab still fits.
  { id: 'documents', title: true, icon: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6' },
  { id: 'text', icon: 'M5 7V4h14v3M12 4v16M9 20h6' },
  { id: 'links', icon: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1' },
  { id: 'emoji', icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01' }
]

const EXTENSIONS = {
  images: 'png jpg jpeg jfif gif webp bmp svg ico tif tiff heic avif',
  videos: 'mp4 mkv avi mov wmv webm flv m4v mpg mpeg 3gp',
  audio: 'mp3 wav flac aac ogg oga m4a wma opus aiff',
  documents: 'pdf doc docx xls xlsx ppt pptx odt ods odp rtf txt md csv epub'
}
const extOf = (path) => path.split(/[\\/]/).pop().split('.').slice(1).pop()?.toLowerCase()
const hasExt = (item, cat) => item.files.some((f) => EXTENSIONS[cat].split(' ').includes(extOf(f)))

export const isLink = (text) => /^(https?:\/\/|www\.)\S+$/i.test(text.trim())

/** Whether an item belongs to a tab. Groups belong wherever any part belongs. */
export function inCategory(item, cat) {
  if (cat === 'all') return true
  if (item.kind === 'group') return item.parts.some((p) => inCategory(p, cat))
  switch (cat) {
    case 'files':
      return item.kind === 'files'
    case 'images':
      return item.kind === 'image' || (item.kind === 'files' && hasExt(item, 'images'))
    case 'videos':
    case 'audio':
    case 'documents':
      return item.kind === 'files' && hasExt(item, cat)
    case 'text':
      return item.kind === 'text' && !isLink(item.text)
    case 'links':
      return item.kind === 'text' && isLink(item.text)
    default:
      return false
  }
}
