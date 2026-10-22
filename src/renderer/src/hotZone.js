/** Hot zone: a thin strip on the screen edge, covering the middle part of its height. */
export const HOT_ZONE_WIDTH = 4
export const HOT_ZONE_HEIGHT = 0.4

export function isInHotZone(x, y, height) {
  const top = (height * (1 - HOT_ZONE_HEIGHT)) / 2
  return x <= HOT_ZONE_WIDTH && y >= top && y <= height - top
}
