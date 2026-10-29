<p align="center">
  <img src="assets/banner.svg" alt="HafaClip" width="100%">
</p>

<p align="center">
  <a href="https://github.com/alimwork85-web/edge-clipboard/releases/latest"><img src="https://img.shields.io/github/v/release/alimwork85-web/edge-clipboard?style=flat-square&color=7c8cff" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-0078d4?style=flat-square&logo=windows" alt="Windows 10 | 11">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/alimwork85-web/edge-clipboard?style=flat-square&color=b07cff" alt="MIT license"></a>
  <a href="https://github.com/alimwork85-web/edge-clipboard/releases"><img src="https://img.shields.io/github/downloads/alimwork85-web/edge-clipboard/total?style=flat-square&color=34d399" alt="Downloads"></a>
  <img src="https://img.shields.io/badge/built%20with-Electron-47848f?style=flat-square&logo=electron" alt="Built with Electron">
</p>

**HafaClip** (حافة, Arabic for *edge*; formerly Edge Clipboard) is a free, open-source clipboard manager for Windows. It hides as a thin line on the edge of your screen; move the mouse there (or press <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>E</kbd>) and your clipboard history slides out. Everything stays on your computer.

<p align="center">
  <img src="assets/demo.gif" alt="Hover the screen edge to open the panel and switch tabs" width="320">
</p>

## Features

- **Lives on the screen edge**: hover the handle to open, move away to close. Left or right edge, your choice.
- **Keyboard shortcut**: <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>E</kbd> opens and closes the panel from anywhere; <kbd>Esc</kbd> closes it.
- **Captures everything**: text, images and files (every file of a multi-file copy).
- **Tabs by type**: All, Files, Images, Videos, Audio, Docs, Text, Links and Emoji, each with its count.
- **Up to 1000 items**, oldest dropped first. **Pinned items are kept forever** and can be hidden with one click.
- **Paste straight into the app you were using**, or just copy with a click.
- **Copy part of a text**: select any words in a card and copy only them; they become a new item.
- **Compact cards**: long text shows 3 lines with **More / Less**.
- **Drag and drop** items out to other apps, or drop files and text onto the panel to keep them.
- **Merge** several items into one group and **split** it back.
- **Emoji picker** with categories, search and recent emoji.
- **Arabic and mixed text** shown in the right direction; search ignores diacritics and hamza forms.
- **Customisable handle**: length, thickness and 9 colours. Light and dark mode follow Windows.
- **Starts with Windows** (can be turned off from the tray icon) and pauses capturing on demand.

## Screenshots

| History | Settings | Light mode |
|:---:|:---:|:---:|
| <img src="assets/screenshots/history.png" width="260" alt="History tab"> | <img src="assets/screenshots/settings.png" width="260" alt="Settings"> | <img src="assets/screenshots/light.png" width="260" alt="Light mode"> |

| Images | Files | Emoji |
|:---:|:---:|:---:|
| <img src="assets/screenshots/images.png" width="260" alt="Images tab"> | <img src="assets/screenshots/files.png" width="260" alt="Files tab"> | <img src="assets/screenshots/emoji.png" width="260" alt="Emoji picker"> |

## Install

1. Download **`HafaClip Setup x.y.z.exe`** from the [latest release](https://github.com/alimwork85-web/edge-clipboard/releases/latest).
2. Run it. It installs for your user only (no admin rights) and adds **HafaClip** to the Start menu. Installing it over Edge Clipboard keeps your history and settings.
3. The handle appears on the left edge of the screen; the app also starts with Windows from now on.

> The installer is not code-signed, so Windows SmartScreen may warn the first time. Choose **More info → Run anyway**.

## How to use

| Action | How |
|---|---|
| Open the panel | Hover the handle on the screen edge, or press <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>E</kbd> |
| Copy an item | Click its card |
| Paste into the previous app | Hover a card → ↩ button, or press <kbd>Enter</kbd> on it |
| Copy part of a text | Select the words → **Copy selection** (or <kbd>Ctrl</kbd>+<kbd>C</kbd>) |
| Pin / unpin | Hover a card → 📌 button |
| Merge items | <kbd>Ctrl</kbd>+click cards → **Merge** |
| Drag a text card out | Drag the ⠿ grip in its corner |
| Settings | ⚙ button in the panel header |
| Pause capturing, quit | Right- or left-click the tray icon |

## Privacy

HafaClip makes **no network connections**. History is stored only on your PC in `%APPDATA%\edge-clipboard` (`items.json` plus an `images` folder). Uninstalling the app does not delete that folder, so remove it yourself if you want the history gone.

## Build from source

Requires [Node.js](https://nodejs.org) 22 or newer.

```bash
git clone https://github.com/alimwork85-web/edge-clipboard.git
cd edge-clipboard
npm install
node node_modules/electron/install.js   # downloads Electron if npm skipped install scripts
npm test
npm start          # run the app
npm run dist       # build the Windows installer into dist/
```

Built with [Electron](https://www.electronjs.org), [React](https://react.dev), [electron-vite](https://electron-vite.org), [koffi](https://koffi.dev) for Win32 clipboard calls and [emojibase-data](https://emojibase.dev) for emoji names.

## License

[MIT](LICENSE) © 2026 **Ali Alhumedi**
