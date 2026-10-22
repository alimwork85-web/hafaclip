/** Hot zone: a thin strip on the chosen screen edge, covering the middle part of its height. */
export const HOT_ZONE_WIDTH = 4
export const HOT_ZONE_HEIGHT = 0.4

export function isInHotZone(x, y, width, height, edge = 'left') {
  const fromEdge = edge === 'right' ? width - 1 - x : x
  const top = (height * (1 - HOT_ZONE_HEIGHT)) / 2
  return fromEdge <= HOT_ZONE_WIDTH && y >= top && y <= height - top
}
