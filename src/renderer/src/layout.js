/** Fixes text typed with the wrong keyboard layout: "hgsghl ugd;l" ⇄ "السلام عليكم" (US ⇄ Arabic 101). */

// US key → the character the Arabic (101) layout types on the same key. Digits and most punctuation are shared.
const TO_ARABIC = {
  '`': 'ذ', q: 'ض', w: 'ص', e: 'ث', r: 'ق', t: 'ف', y: 'غ', u: 'ع', i: 'ه', o: 'خ', p: 'ح', '[': 'ج', ']': 'د',
  a: 'ش', s: 'س', d: 'ي', f: 'ب', g: 'ل', h: 'ا', j: 'ت', k: 'ن', l: 'م', ';': 'ك', "'": 'ط',
  z: 'ئ', x: 'ء', c: 'ؤ', v: 'ر', b: 'لا', n: 'ى', m: 'ة', ',': 'و', '.': 'ز', '/': 'ظ',
  '~': 'ّ', Q: 'َ', W: 'ً', E: 'ُ', R: 'ٌ', T: 'لإ', Y: 'إ', U: '‘', I: '÷', O: '×', P: '؛', '{': '<', '}': '>',
  A: 'ِ', S: 'ٍ', D: ']', F: '[', G: 'لأ', H: 'أ', J: 'ـ', K: '،', L: '/',
  Z: '~', X: 'ْ', C: '}', V: '{', B: 'لآ', N: 'آ', M: '’', '<': ',', '>': '.', '?': '؟'
}
// Arabic → US, one character at a time (so "لا" goes back as "gh", which is also what typing ل then ا gives).
const TO_LATIN = {}
for (const [key, ar] of Object.entries(TO_ARABIC)) if ([...ar].length === 1 && !(ar in TO_LATIN)) TO_LATIN[ar] = key

/** Converts toward whichever side has fewer letters, since the text was typed on the wrong layout. */
export function fixLayout(text) {
  const arabic = (text.match(/[؀-ۿ]/g) ?? []).length
  const latin = (text.match(/[a-z]/gi) ?? []).length
  const map = latin > arabic ? TO_ARABIC : TO_LATIN
  return [...text].map((ch) => map[ch] ?? ch).join('')
}
