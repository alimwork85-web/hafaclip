// Draws one heading image (coloured icon + larger coloured title) per README feature, in English and Arabic,
// into assets/features/, and rewrites the two feature lists in README.md to use them.
// GitHub Markdown cannot colour text, so the headings are SVG images with the title as alt text.
// Run: node scripts/make-readme-features.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const dir = new URL('assets/features/', root)
mkdirSync(dir, { recursive: true })

// Colour pairs (gradient start, end); each is readable on GitHub's light and dark backgrounds.
const C = {
  violet: ['#6d7cff', '#a66bff'],
  teal: ['#0ea5a4', '#22c55e'],
  amber: ['#f59e0b', '#ef4444'],
  sky: ['#0284c7', '#6366f1'],
  pink: ['#db2777', '#9333ea'],
  green: ['#16a34a', '#0d9488']
}

// Icons are 24×24 stroke drawings, drawn in white on the coloured tile.
const F = [
  { key: 'edge', c: C.violet, icon: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 4v16"/>',
    en: ['Lives on the screen edge', 'Hover the handle to open, move away to close. Left or right edge, your choice.'],
    ar: ['يعيش على حافة الشاشة', 'مرّر الفأرة على المقبض ليفتح، وابتعد ليُغلق. الحافة اليسرى أو اليمنى، حسب اختيارك.'] },
  { key: 'keyboard', c: C.sky, icon: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    en: ['Keyboard first', '<kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>E</kbd> (or your own shortcut) opens the panel with the cursor in search; type to filter, <kbd>↑</kbd> <kbd>↓</kbd> to move between cards, <kbd>Enter</kbd> to paste, <kbd>Alt</kbd>+<kbd>1</kbd>…<kbd>9</kbd> to paste a numbered card, <kbd>Esc</kbd> to close.'],
    ar: ['لوحة المفاتيح أولًا', '<kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>E</kbd> (أو اختصارك الخاص) يفتح اللوحة والمؤشر في البحث؛ اكتب للتصفية، و<kbd>↑</kbd> <kbd>↓</kbd> للتنقّل بين البطاقات، و<kbd>Enter</kbd> للصق، و<kbd>Alt</kbd>+<kbd>1</kbd>…<kbd>9</kbd> للصق البطاقة المرقّمة، و<kbd>Esc</kbd> للإغلاق.'] },
  { key: 'capture', c: C.teal, icon: '<path d="M9 3h6v3H9z"/><path d="M8 4.5H6a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6.5a2 2 0 0 0-2-2h-2"/><path d="M8 12h8M8 16h5"/>',
    en: ['Captures everything', 'Text, images and files (every file of a multi-file copy). Each kind can be turned off.'],
    ar: ['يلتقط كل شيء', 'النصوص والصور والملفات (كل ملف عند نسخ عدة ملفات). ويمكن إيقاف أي نوع منها.'] },
  { key: 'passwords', c: C.amber, icon: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4M12 15v2"/>',
    en: ['Respects password managers', 'Copies that KeePass, Bitwarden, 1Password and others mark as sensitive are never saved.'],
    ar: ['يحترم مديري كلمات المرور', 'ما ينسخه KeePass وBitwarden و1Password وغيرها ويُعلَّم كسرّي لا يُحفظ أبدًا.'] },
  { key: 'ignore', c: C.pink, isNew: '3.1', icon: '<path d="M3 3l18 18"/><path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c5 0 9 6 9 6a16 16 0 0 1-3.2 3.8M6.6 6.6A16 16 0 0 0 3 12s4 6 9 6a9.7 9.7 0 0 0 5.4-1.6"/>',
    en: ['Ignore any program', 'Pick programs (your bank, a work app…) whose copies are never captured.'],
    ar: ['تجاهل أي برنامج', 'اختر برامج (تطبيق البنك، برنامج عمل…) لا يُلتقط شيء مما تنسخه منها.'] },
  { key: 'ocr', c: C.violet, isNew: '3.1', icon: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 10h8M8 14h5"/>',
    en: ['Find images by the text in them', 'New images are read on your PC by the OCR built into Windows (Arabic and English), so searching "invoice" finds a screenshot of one. The text is used only for search.'],
    ar: ['ابحث عن الصور بالنص الذي فيها', 'تُقرأ الصور الجديدة على جهازك بمحرك OCR المدمج في Windows (العربية والإنجليزية)، فتجد لقطة الشاشة بالبحث عن كلمة فيها. النص يُستعمل للبحث فقط.'] },
  { key: 'tabs', c: C.sky, icon: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    en: ['Tabs by type', 'All, Files, Images, Videos, Audio, Docs, Text, Links and Emoji, each with its count.'],
    ar: ['تبويبات حسب النوع', 'الكل، الملفات، الصور، الفيديو، الصوت، المستندات، النصوص، الروابط، الإيموجي، ولكل منها عدده.'] },
  { key: 'history', c: C.green, icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    en: ['History you control', 'Keep 250, 500, 750 or 1000 items, optionally auto-delete after 30 or 40 days. **Pinned items are kept forever.**'],
    ar: ['سجل تتحكّم فيه', 'احتفظ بـ 250 أو 500 أو 750 أو 1000 عنصر، مع حذف تلقائي اختياري بعد 30 أو 40 يومًا. **العناصر المثبّتة تبقى دائمًا.**'] },
  { key: 'paste', c: C.teal, icon: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 5 5v6"/>',
    en: ['Paste where you were', 'Paste straight into the app you were using, or just copy with a click.'],
    ar: ['الصق حيث كنت', 'الصق مباشرة في البرنامج الذي كنت تعمل فيه، أو انسخ بنقرة.'] },
  { key: 'paste-as', c: C.amber, icon: '<path d="M4 7h11M12 4l3 3-3 3M20 17H9M12 14l-3 3 3 3"/>',
    en: ['Paste as…', 'Western digits (٠١٢ → 012) or without Arabic diacritics, without changing the saved item.'],
    ar: ['لصق بعد تحويل', 'بأرقام غربية (٠١٢ ← 012) أو بدون تشكيل، دون تغيير العنصر المحفوظ.'] },
  { key: 'layout', c: C.pink, icon: '<path d="M4 5h8M8 3v2M5 11c2.5 0 5-2.5 6-6M7 8c1 2 3 3 5 3M13 20l4-9 4 9M14.5 17h5"/>',
    en: ['Fix keyboard layout', 'Turn `hgsghl ugd;l` into «السلام عليكم» (and back) with one click.'],
    ar: ['تصحيح لغة لوحة المفاتيح', 'حوّل `hgsghl ugd;l` إلى «السلام عليكم» (والعكس) بنقرة.'] },
  { key: 'merge', c: C.violet, icon: '<path d="M6 3v6a6 6 0 0 0 6 6h7M16 12l3 3-3 3M6 21v-5"/>',
    en: ['Copy, drag, merge', 'Copy part of a text, drag and drop in and out, merge several items into one (drag a card onto another, or <kbd>Ctrl</kbd>+click) and split them back.'],
    ar: ['انسخ واسحب وادمج', 'انسخ جزءًا من النص، واسحب وأفلت من اللوحة وإليها، وادمج عدة عناصر في عنصر واحد (اسحب بطاقة إلى بطاقة أخرى، أو Ctrl+نقرة) ثم افصلها.'] },
  { key: 'groups', c: C.teal, isNew: '3.2', icon: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M8 13h8M8 16h5"/>',
    en: ['Named groups', 'Give a group a name (it is found by search), paste the whole group or just one part of it, and take a part back out. A group left with one part becomes a single item again.'],
    ar: ['مجموعات بأسماء', 'سمِّ المجموعة باسم تجده بالبحث، والصق المجموعة كاملة أو جزءًا واحدًا منها، وأخرج أي جزء منها. والمجموعة التي يبقى فيها جزء واحد تعود عنصرًا عاديًا.'] },
  { key: 'emoji', c: C.amber, icon: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
    en: ['Emoji picker', 'Categories, recent emoji and search in English or Arabic.'],
    ar: ['منتقي إيموجي', 'فئات وأحدث المستخدم، وبحث بالعربية أو الإنجليزية.'] },
  { key: 'languages', c: C.sky, icon: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    en: ['English and Arabic interface', 'Follows Windows, or pick one, with right-to-left layout and Arabic-aware search that ignores diacritics, hamza forms and ة/ه.'],
    ar: ['واجهة عربية وإنجليزية', 'تتبع لغة Windows أو تختار بنفسك، باتجاه من اليمين لليسار، وبحث يفهم العربية فيتجاهل التشكيل وأشكال الهمزة والفرق بين ة وه.'] },
  { key: 'customize', c: C.pink, icon: '<path d="M4 6h9M17 6h3M15 4v4M4 12h3M11 12h9M9 10v4M4 18h11M19 18h1M17 16v4"/>',
    en: ['Make it yours', '5 themes (Light, Dark, Ocean, Forest and Sand), 4 fonts (including Cairo, Tajawal and IBM Plex Sans Arabic), text size, density, panel width, open delay, and the handle\'s length, thickness and colour, with an optional second colour at its top and bottom.'],
    ar: ['اجعله على ذوقك', '5 سمات (فاتح، داكن، محيط، غابة، رملي)، و4 خطوط (منها القاهرة وتجوال وIBM Plex Sans Arabic)، وحجم النص، والكثافة، وعرض اللوحة، ومهلة الفتح، وطول المقبض وسماكته ولونه، مع لون ثانٍ اختياري لأعلاه وأسفله.'] },
  { key: 'startup', c: C.green, icon: '<path d="M12 3v8"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/>',
    en: ['Starts with Windows', 'Can be turned off from the tray icon, and capturing can be paused on demand.'],
    ar: ['يعمل مع بدء Windows', 'يمكن إيقاف ذلك من أيقونة شريط المهام، ويمكن إيقاف الالتقاط مؤقتًا.'] },
  { key: 'updates', c: C.teal, isNew: '3.1', icon: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
    en: ['Tells you about new versions', 'A small notice with a download link; nothing is downloaded or installed by itself.'],
    ar: ['ينبّهك بالإصدارات الجديدة', 'سطر صغير فيه رابط التنزيل، ولا يُنزَّل أو يُثبَّت شيء من تلقاء نفسه.'] },
  { key: 'backup', c: C.sky, isNew: '3.1', icon: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10v6M9 13l3 3 3-3"/>',
    en: ['Easy backup', 'Settings → Data folder → Open, then copy that folder.'],
    ar: ['نسخ احتياطي سهل', 'الإعدادات ← مجلد البيانات ← فتح، ثم انسخ المجلد. وللاستعادة: أغلق حافة وأعد المجلد مكانه.'] }
]

const H = 52
const SIZE = 28
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function svg(f, lang) {
  const [title] = f[lang]
  const rtl = lang === 'ar'
  // shortcut: width is estimated from the character count (fonts differ per viewer), so it errs on the wide side.
  const W = Math.ceil(64 + title.length * SIZE * (rtl ? 0.55 : 0.6))
  const tileX = rtl ? W - 48 : 0
  const textX = rtl ? W - 62 : 62
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${f.c[0]}"/><stop offset="1" stop-color="${f.c[1]}"/></linearGradient></defs>
  <rect x="${tileX}" y="2" width="48" height="48" rx="13" fill="url(#g)"/>
  <g transform="translate(${tileX + 12} 14)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${f.icon}</g>
  <text x="${textX}" y="36" ${rtl ? 'direction="rtl" text-anchor="start" ' : ''}fill="url(#g)" font-family="'Segoe UI', system-ui, -apple-system, 'Noto Sans Arabic', 'Helvetica Neue', Arial, sans-serif" font-size="${SIZE}" font-weight="700">${esc(title)}</text>
</svg>
`
}

const block = (lang) =>
  F.map((f) => {
    writeFileSync(new URL(`${f.key}-${lang}.svg`, dir), svg(f, lang))
    const [title, desc] = f[lang]
    const tag = f.isNew ? (lang === 'ar' ? `**جديد في ${f.isNew}.** ` : `**New in ${f.isNew}.** `) : ''
    return `<img src="assets/features/${f.key}-${lang}.svg" alt="${title.replace(/"/g, '&quot;')}" height="44">\n\n${tag}${desc}\n`
  }).join('\n')

const readmeUrl = new URL('README.md', root)
let readme = readFileSync(readmeUrl, 'utf8').replace(/\r\n/g, '\n')
const swap = (start, end, lang) => {
  const re = new RegExp(`(${start}\\n\\n)[\\s\\S]*?(\\n${end})`)
  if (!re.test(readme)) throw new Error(`README section "${start}" not found`)
  readme = readme.replace(re, `$1${block(lang)}$2`)
}
swap('## Features', '## Screenshots', 'en')
swap('### المزايا', '### التثبيت', 'ar')
writeFileSync(readmeUrl, readme)
console.log(`${F.length} features × 2 languages written`)
