/**
 * Reads the text in captured images with the OCR engine built into Windows (Windows.Media.Ocr), only so images can be found by search.
 * One hidden Windows PowerShell stays open and handles one image at a time; it runs every installed OCR language,
 * so a line mixing Arabic and English is caught by both engines.
 */
import { spawn } from 'node:child_process'

const SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::InputEncoding = [Console]::OutputEncoding = New-Object Text.UTF8Encoding $false
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$asTask = [WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation${'`'}1' } | Select-Object -First 1
function Await($op, $t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait() | Out-Null; $task.Result }
$langs = @([Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages)
$engines = @($langs | ForEach-Object { [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($_) } | Where-Object { $_ })
[Console]::Out.WriteLine((ConvertTo-Json -Compress @{ languages = @($langs | ForEach-Object { $_.LanguageTag }) }))
while ($null -ne ($path = [Console]::In.ReadLine())) {
  try {
    $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($path)) ([Windows.Storage.StorageFile])
    $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $dec = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    # Small UI text is missed at its real size; doubling it (within the engine's limit) recovers most of it.
    $scale = [Math]::Min(2, [Windows.Media.Ocr.OcrEngine]::MaxImageDimension / [Math]::Max($dec.PixelWidth, $dec.PixelHeight))
    $tf = New-Object Windows.Graphics.Imaging.BitmapTransform
    if ($scale -gt 1) { $tf.ScaledWidth = [uint32]($dec.PixelWidth * $scale); $tf.ScaledHeight = [uint32]($dec.PixelHeight * $scale); $tf.InterpolationMode = 'Fant' }
    $bmp = Await ($dec.GetSoftwareBitmapAsync([Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8, [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied, $tf, [Windows.Graphics.Imaging.ExifOrientationMode]::RespectExifOrientation, [Windows.Graphics.Imaging.ColorManagementMode]::DoNotColorManage)) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $stream.Dispose()
    $text = foreach ($e in $engines) {
      $rtl = $e.RecognizerLanguage.LayoutDirection -eq 'Rtl'
      foreach ($line in (Await ($e.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])).Lines) {
        # Arabic lines from a right-to-left engine come back with their words in left-to-right order.
        $words = @($line.Words | ForEach-Object { $_.Text }); if ($rtl -and $line.Text -match '\p{IsArabic}') { [array]::Reverse($words) }
        $words -join ' '
      }
    }
    $bmp.Dispose()
    [Console]::Out.WriteLine((ConvertTo-Json -Compress @{ text = ($text -join [char]10) }))
  } catch {
    [Console]::Out.WriteLine((ConvertTo-Json -Compress @{ error = "$_" }))
  }
}
`

let proc = null
let languages = null
let queue = []
let pending = null // { path, done }
let buffer = ''

function start() {
  const encoded = Buffer.from(SCRIPT, 'utf16le').toString('base64')
  // Windows PowerShell 5.1, not pwsh: only it can load the WinRT types this needs.
  proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], { windowsHide: true })
  proc.stdout.setEncoding('utf8')
  proc.stdout.on('data', (chunk) => {
    buffer += chunk
    let nl
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (line) onLine(line)
    }
  })
  proc.stderr.on('data', (d) => console.error('[ocr]', String(d).trim()))
  const died = () => {
    proc = null
    languages = null
    buffer = ''
    pending?.done(null)
    pending = null
    // A dead engine is not restarted here; the next image starts a fresh one.
  }
  proc.on('exit', died)
  proc.on('error', died)
}

function onLine(line) {
  let msg
  try {
    msg = JSON.parse(line)
  } catch {
    return
  }
  if (msg.languages) {
    languages = msg.languages
    return next()
  }
  const job = pending
  pending = null
  job?.done(msg.error ? null : msg.text)
  next()
}

function next() {
  if (pending || !languages || !queue.length) return
  pending = queue.shift()
  proc.stdin.write(`${pending.path}\n`)
}

/** Resolves with the text found in the PNG at `path` ('' when none), or null when it could not be read. */
export function readImageText(path) {
  return new Promise((done) => {
    queue.push({ path, done })
    if (!proc) start()
    next()
  })
}

/** The OCR languages installed in Windows (BCP-47 tags such as 'ar-SA'); starts the engine if needed. */
export function ocrLanguages() {
  if (languages) return Promise.resolve(languages)
  if (!proc) start()
  return new Promise((done) => {
    const wait = setInterval(() => {
      if (languages || !proc) clearInterval(wait), done(languages ?? [])
    }, 100)
  })
}

export function stopOcr() {
  proc?.kill()
  queue.forEach((job) => job.done(null))
  queue = []
}
