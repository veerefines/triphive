/**
 * Card cover: a mosaic of real OpenStreetMap tiles, offset so the destination
 * sits in the middle of the card. `rx`/`ry` = tiles on each side of centre.
 */
export function MapCover({ lat, lng, z = 13, rx = 1, ry = 1 }: { lat?: number; lng?: number; z?: number; rx?: number; ry?: number }) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  const n = 2 ** z
  const fx = ((lng + 180) / 360) * n
  const r = (lat * Math.PI) / 180
  const fy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n
  const tx = Math.floor(fx)
  const ty = Math.floor(fy)
  const T = 256
  // Pixel position of the destination inside the grid starting at (tx-rx, ty-ry).
  const px = (fx - (tx - rx)) * T
  const py = (fy - (ty - ry)) * T
  const tiles = []
  for (let dy = -ry; dy <= ry; dy++)
    for (let dx = -rx; dx <= rx; dx++)
      tiles.push(
        <img
          key={`${dx},${dy}`}
          src={`https://tile.openstreetmap.org/${z}/${tx + dx}/${ty + dy}.png`}
          alt=""
          loading="lazy"
          className="absolute"
          style={{ width: T, height: T, left: (dx + rx) * T, top: (dy + ry) * T }}
        />,
      )
  return (
    <div
      className="th-tiles absolute left-1/2 top-1/2 transition duration-700 ease-out group-hover:scale-110"
      style={{ width: (2 * rx + 1) * T, height: (2 * ry + 1) * T, transform: `translate(${-px}px, ${-py}px)`, transformOrigin: `${px}px ${py}px` }}
    >
      {tiles}
    </div>
  )
}

