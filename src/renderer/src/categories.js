/** History tabs and the rule that decides which tab(s) an item shows up in. */

export const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'files', label: 'Files' },
  { id: 'images', label: 'Images' },
  { id: 'videos', label: 'Videos' },
  { id: 'audio', label: 'Audio' },
  { id: 'documents', label: 'Documents' },
  { id: 'text', label: 'Text' },
  { id: 'code', label: 'Code' },
  { id: 'links', label: 'Links' },
  { id: 'emoji', label: 'Emoji' }
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

/**
 * Code detection is a guess: two or more typical signs of source code.
 * shortcut: heuristic only, misses one-line snippets without symbols; upgrade to a language detector if it misfires.
 */
export function isCode(text) {
  if (isLink(text)) return false
  const signs = [
    /[{};]\s*$/m, // line ends in a brace or semicolon
    /^\s*(import|export|const|let|var|function|def|class|return|if|for|while|public|private|#include|using|SELECT|INSERT|UPDATE)\b/m,
    /=>|===|!==|==|!=|&&|\|\||::/,
    /\w+\([^()]*\)/, // a call like foo(x)
    /^( {2,}|\t)\S/m, // indented line
    /<\/?[a-z][\w-]*[^>]*>/i // markup tag
  ]
  return signs.filter((re) => re.test(text)).length >= 2
}

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
      return item.kind === 'text' && !isCode(item.text) && !isLink(item.text)
    case 'code':
      return item.kind === 'text' && isCode(item.text)
    case 'links':
      return item.kind === 'text' && isLink(item.text)
    default:
      return false
  }
}
