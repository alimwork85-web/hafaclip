/** The edge handle's options and its hot zone (shared by main and renderer). */

/** Handle length as a fraction of the screen height. */
export const HANDLE_LENGTHS = { short: 0.2, medium: 0.4, long: 0.7 }
/** Handle thickness in px. */
export const HANDLE_THICKNESS = { thin: 3, medium: 5, thick: 9 }
/** Handle gradients, top to bottom. */
export const HANDLE_COLORS = {
  purple: ['#7c8cff', '#b07cff'],
  blue: ['#3b9eff', '#5b6cf0'],
  green: ['#34d399', '#10b981'],
  yellow: ['#fde047', '#f59e0b'],
  orange: ['#fdba74', '#f97316'],
  red: ['#fb7185', '#e11d48'],
  pink: ['#f9a8d4', '#ec4899'],
  black: ['#4b5563', '#111827'],
  white: ['#ffffff', '#cbd5e1']
}

/** The hot zone matches the handle: its length, and at least 4px wide so a thin handle is still easy to hit. */
export function isInHotZone(x, y, width, height, edge = 'left', length = 'medium', thickness = 'medium') {
  const fromEdge = edge === 'right' ? width - 1 - x : x
  const top = (height * (1 - (HANDLE_LENGTHS[length] ?? HANDLE_LENGTHS.medium))) / 2
  return fromEdge <= Math.max(4, HANDLE_THICKNESS[thickness] ?? 0) && y >= top && y <= height - top
}
