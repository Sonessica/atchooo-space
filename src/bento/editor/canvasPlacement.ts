import type { WidgetConfig, WidgetSize } from '../widgets/types'

export const SEARCH_COLS = 4
export const SEARCH_ROWS = 1

type Point = { x: number; y: number }
type Span = { cols: number; rows: number }

const SPANS: Record<WidgetSize, Span> = {
  '1x1': { cols: 1, rows: 1 },
  '2x1': { cols: 2, rows: 1 },
  '1x2': { cols: 1, rows: 2 },
  '2x2': { cols: 2, rows: 2 },
}

const key = (x: number, y: number) => `${x},${y}`
const pointOf = (widget: WidgetConfig): Point => ({ x: widget.x!, y: widget.y! })
const hasPoint = (widget: WidgetConfig) => Number.isSafeInteger(widget.x) && Number.isSafeInteger(widget.y)
const area = (widget: WidgetConfig) => SPANS[widget.size].cols * SPANS[widget.size].rows

function searchCells(reserveSearch = true) {
  const occupied = new Set<string>()
  if (!reserveSearch) return occupied
  for (let x = 0; x < SEARCH_COLS; x++) {
    for (let y = 0; y < SEARCH_ROWS; y++) occupied.add(key(x, y))
  }
  return occupied
}

function forEachCell(point: Point, size: WidgetSize, visit: (x: number, y: number) => void) {
  const { cols, rows } = SPANS[size]
  for (let dx = 0; dx < cols; dx++) {
    for (let dy = 0; dy < rows; dy++) visit(point.x + dx, point.y + dy)
  }
}

function isFree(occupied: Set<string>, point: Point, size: WidgetSize) {
  let free = true
  forEachCell(point, size, (x, y) => {
    if (occupied.has(key(x, y))) free = false
  })
  return free
}

function reserve(occupied: Set<string>, point: Point, size: WidgetSize) {
  forEachCell(point, size, (x, y) => occupied.add(key(x, y)))
}

function occupiedBy(widgets: WidgetConfig[], excluded: Set<string> = new Set(), reserveSearch = true) {
  const occupied = searchCells(reserveSearch)
  for (const widget of widgets) {
    if (!excluded.has(widget.id) && hasPoint(widget)) reserve(occupied, pointOf(widget), widget.size)
  }
  return occupied
}

function* spiral(origin: Point, reverse = false): Generator<Point> {
  yield origin
  for (let radius = 1; ; radius++) {
    const ring: Point[] = []
    for (let x = origin.x - radius; x <= origin.x + radius; x++) ring.push({ x, y: origin.y - radius })
    for (let y = origin.y - radius + 1; y <= origin.y + radius; y++) ring.push({ x: origin.x + radius, y })
    for (let x = origin.x + radius - 1; x >= origin.x - radius; x--) ring.push({ x, y: origin.y + radius })
    for (let y = origin.y + radius - 1; y > origin.y - radius; y--) ring.push({ x: origin.x - radius, y })
    if (reverse) ring.reverse()
    yield* ring
  }
}

// The canvas is unbounded. With finitely many cards, the spiral always finds
// a free rectangle; returning an unchecked fallback would reintroduce overlap.
function firstFree(occupied: Set<string>, size: WidgetSize, origin: Point, reverse = false) {
  for (const point of spiral(origin, reverse)) {
    if (isFree(occupied, point, size)) {
      reserve(occupied, point, size)
      return point
    }
  }
  throw new Error('Unreachable: the infinite canvas has no free cells')
}

export function isValidCanvasLayout(widgets: WidgetConfig[], reserveSearch = true) {
  const occupied = searchCells(reserveSearch)
  for (const widget of widgets) {
    if (!hasPoint(widget) || !isFree(occupied, pointOf(widget), widget.size)) return false
    reserve(occupied, pointOf(widget), widget.size)
  }
  return true
}

export function assignCanvasPositions(widgets: WidgetConfig[], reserveSearch = true): WidgetConfig[] {
  const occupied = searchCells(reserveSearch)
  const positions = new Map<string, Point>()
  const pending: WidgetConfig[] = []

  for (const widget of widgets) {
    if (hasPoint(widget) && isFree(occupied, pointOf(widget), widget.size)) {
      positions.set(widget.id, pointOf(widget))
      reserve(occupied, pointOf(widget), widget.size)
    } else pending.push(widget)
  }

  // Place large rectangles first, but return cards in their original order.
  pending.sort((a, b) => area(b) - area(a))
  for (const widget of pending) positions.set(widget.id, firstFree(occupied, widget.size, { x: 0, y: 0 }))
  return widgets.map((widget) => ({ ...widget, ...positions.get(widget.id)! }))
}

/** Arrange rigid sections as units, preserving member offsets, including folded slots. */
function layoutSectionUnits(widgets: WidgetConfig[], reserveSearch: boolean): WidgetConfig[] {
  const occupied = searchCells(reserveSearch)
  const units = new Map<string, WidgetConfig[]>()
  const positions = new Map<string, Point>()
  for (const w of widgets) {
    const id = w.category === 'section' ? w.id : w.groupId || w.id
    units.set(id, [...(units.get(id) || []), w])
  }
  for (const unit of units.values()) {
    if (!unit.some(w => w.locked)) continue
    for (const w of unit) { reserve(occupied, { x: w.x ?? 0, y: w.y ?? 0 }, w.size); positions.set(w.id, { x: w.x ?? 0, y: w.y ?? 0 }) }
  }
  for (const unit of units.values()) {
    if (unit.some(w => w.locked)) continue
    const anchor = unit.find(w => w.category === 'section') || unit[0]
    for (const candidate of spiral({ x: 0, y: 0 })) {
      const trial = unit.map(w => ({ ...w, x: (w.x ?? 0) - (anchor.x ?? 0) + candidate.x, y: (w.y ?? 0) - (anchor.y ?? 0) + candidate.y }))
      // Reject invalid incoming internal geometry instead of searching forever.
      if (!isValidCanvasLayout(trial, false)) return widgets
      if (!trial.every(w => isFree(occupied, pointOf(w), w.size))) continue
      for (const w of trial) { reserve(occupied, pointOf(w), w.size); positions.set(w.id, pointOf(w)) }
      break
    }
  }
  const next = withPositions(widgets, positions)
  return isValidCanvasLayout(next, reserveSearch) ? next : widgets
}

export function autoLayoutFromCenter(widgets: WidgetConfig[], reserveSearch = true): WidgetConfig[] {
  if (widgets.some(w => w.groupId)) return layoutSectionUnits(widgets, reserveSearch)
  const occupied = searchCells(reserveSearch)
  const order = widgets.map((widget, index) => ({ widget, index }))
    .sort((a, b) => area(b.widget) - area(a.widget) || a.index - b.index)
  const positions = new Map<string, Point>()
  const placed: { point: Point; size: WidgetSize }[] = []
  for (const { widget } of order) {
    const point = balancedFreePosition(occupied, widget.size, placed, reserveSearch)
    positions.set(widget.id, point)
    placed.push({ point, size: widget.size })
  }
  return widgets.map((widget) => ({ ...widget, ...positions.get(widget.id)! }))
}

export type AutoLayoutMode = 'compact' | 'balanced' | 'organic' | 'rows' | 'columns' | 'focus'

export function autoLayoutWidgets(widgets: WidgetConfig[], mode: AutoLayoutMode = 'balanced', reserveSearch = true) {
  if (widgets.some(w => w.groupId)) return layoutSectionUnits(widgets, reserveSearch)
  if (mode === 'balanced' || mode === 'organic' || mode === 'focus') return autoLayoutFromCenter(widgets, reserveSearch)
  const occupied = searchCells(reserveSearch)
  const positions = new Map<string, Point>()
  const ordered = mode === 'compact' ? [...widgets].sort((a, b) => area(b) - area(a)) : widgets
  for (const widget of ordered) {
    let selected: Point | null = null
    for (let lane = 0; !selected; lane++) {
      for (let cross = -32; cross <= 32; cross++) {
        const point = mode === 'columns' ? { x: lane, y: cross } : { x: cross, y: lane }
        if (isFree(occupied, point, widget.size)) { selected = point; reserve(occupied, point, widget.size); break }
      }
    }
    positions.set(widget.id, selected || { x: 0, y: 0 })
  }
  return widgets.map(widget => ({ ...widget, ...positions.get(widget.id)! }))
}

function distanceFromAnchor(point: Point, size: WidgetSize, reserveSearch: boolean) {
  const span = SPANS[size]
  const anchorCols = reserveSearch ? SEARCH_COLS : 1
  const anchorRows = reserveSearch ? SEARCH_ROWS : 1
  const right = point.x + span.cols - 1
  const bottom = point.y + span.rows - 1
  const dx = point.x >= anchorCols ? point.x - anchorCols : right < 0 ? -right - 1 : 0
  const dy = point.y >= anchorRows ? point.y - anchorRows : bottom < 0 ? -bottom - 1 : 0
  return Math.max(0, dx, dy)
}

function balanceScore(placed: { point: Point; size: WidgetSize }[], point: Point, size: WidgetSize, reserveSearch: boolean) {
  const anchorCols = reserveSearch ? SEARCH_COLS : 1
  const anchorRows = reserveSearch ? SEARCH_ROWS : 1
  let minX = 0
  let maxX = anchorCols - 1
  let minY = 0
  let maxY = anchorRows - 1
  for (const item of [...placed, { point, size }]) {
    const span = SPANS[item.size]
    minX = Math.min(minX, item.point.x)
    maxX = Math.max(maxX, item.point.x + span.cols - 1)
    minY = Math.min(minY, item.point.y)
    maxY = Math.max(maxY, item.point.y + span.rows - 1)
  }
  const left = -minX
  const right = maxX - (anchorCols - 1)
  const top = -minY
  const bottom = maxY - (anchorRows - 1)
  return [
    Math.abs(left - right) + Math.abs(top - bottom),
    (maxX - minX + 1) * (maxY - minY + 1),
    Math.abs((minX + maxX) / 2 - (anchorCols - 1) / 2),
    Math.abs((minY + maxY) / 2 - (anchorRows - 1) / 2),
    point.y,
    point.x,
  ]
}

function scoreBefore(a: number[], b: number[]) {
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) return a[index] < b[index]
  }
  return false
}

function balancedFreePosition(
  occupied: Set<string>,
  size: WidgetSize,
  placed: { point: Point; size: WidgetSize }[],
  reserveSearch: boolean,
) {
  const span = SPANS[size]
  const anchorCols = reserveSearch ? SEARCH_COLS : 1
  const anchorRows = reserveSearch ? SEARCH_ROWS : 1
  for (let distance = 0; ; distance++) {
    let best: Point | null = null
    let bestScore: number[] | null = null
    for (let y = -distance - span.rows; y <= anchorRows + distance; y++) {
      for (let x = -distance - span.cols; x <= anchorCols + distance; x++) {
        const point = { x, y }
        if (distanceFromAnchor(point, size, reserveSearch) !== distance || !isFree(occupied, point, size)) continue
        const score = balanceScore(placed, point, size, reserveSearch)
        if (!bestScore || scoreBefore(score, bestScore)) {
          best = point
          bestScore = score
        }
      }
    }
    if (best) {
      reserve(occupied, best, size)
      return best
    }
  }
}

function overlaps(point: Point, size: WidgetSize, other: WidgetConfig) {
  const span = SPANS[size]
  const otherSpan = SPANS[other.size]
  return point.x < other.x! + otherSpan.cols && point.x + span.cols > other.x! &&
    point.y < other.y! + otherSpan.rows && point.y + span.rows > other.y!
}

function withPositions(widgets: WidgetConfig[], positions: Map<string, Point>) {
  return widgets.map((widget) => {
    const point = positions.get(widget.id)
    return point ? { ...widget, ...point } : widget
  })
}

/** Atomic rigid-body move. Reserve actual occupied cells, never the bounding box.
 * External sections are displaced as rigid units; locked units cannot be pushed.
 */
export function resolveCanvasGroupDrop(widgets: WidgetConfig[], ids: Set<string>, anchorId: string, x: number, y: number, reserveSearch = true): WidgetConfig[] {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return widgets
  const anchor = widgets.find(w => w.id === anchorId)
  const moving = widgets.filter(w => ids.has(w.id))
  if (!anchor || !moving.length || moving.some(w => w.locked)) return widgets
  const dx = Math.round(x) - (anchor.x ?? 0), dy = Math.round(y) - (anchor.y ?? 0)
  const targets = moving.map(w => ({ ...w, x: (w.x ?? 0) + dx, y: (w.y ?? 0) + dy }))
  if (!isValidCanvasLayout(targets, reserveSearch)) return widgets
  const movingCells = occupiedBy(targets, new Set(), reserveSearch)
  const remaining = widgets.filter(w => !ids.has(w.id))
  const groupKey = (w: WidgetConfig) => w.category === 'section' ? w.id : w.groupId || w.id
  const units = new Map<string, WidgetConfig[]>()
  for (const w of remaining) {
    const key = groupKey(w)
    units.set(key, [...(units.get(key) || []), w])
  }
  const blockers = [...units.values()].filter(unit => unit.some(w => !isFree(movingCells, { x: w.x ?? 0, y: w.y ?? 0 }, w.size)))
  if (blockers.some(unit => unit.some(w => w.locked))) return widgets
  const blockerIds = new Set(blockers.flatMap(unit => unit.map(w => w.id)))
  const occupied = occupiedBy(remaining, blockerIds, reserveSearch)
  for (const target of targets) {
    if (!isFree(occupied, pointOf(target), target.size)) return widgets
    reserve(occupied, pointOf(target), target.size)
  }
  const positions = new Map(targets.map(w => [w.id, pointOf(w)]))
  for (const unit of blockers) {
    if (!isValidCanvasLayout(unit, false)) return widgets
    // Finitely many occupied cells guarantee an eventual free rigid placement.
    for (const offset of spiral({ x: 0, y: 0 })) {
      const trial = unit.map(w => ({ ...w, x: (w.x ?? 0) + offset.x, y: (w.y ?? 0) + offset.y }))
      if (!trial.every(w => isFree(occupied, pointOf(w), w.size))) continue
      for (const w of trial) { reserve(occupied, pointOf(w), w.size); positions.set(w.id, pointOf(w)) }
      break
    }
  }
  const result = withPositions(widgets, positions)
  return isValidCanvasLayout(result, reserveSearch) ? result : widgets
}

export function resolveCanvasDrop(widgets: WidgetConfig[], id: string, x: number, y: number, reserveSearch = true): WidgetConfig[] {
  if (widgets.some(w => w.groupId)) {
    const moving = widgets.find(w => w.id === id)
    const ids = new Set(widgets.filter(w => w.id === id || (moving?.category === 'section' && w.groupId === id)).map(w => w.id))
    return resolveCanvasGroupDrop(widgets, ids, id, x, y, reserveSearch)
  }
  // Repair any pre-existing overlap before planning the drop. Every returned
  // layout is checked as a whole, including the search bar and all card cells.
  const placed = isValidCanvasLayout(widgets, reserveSearch) ? widgets : assignCanvasPositions(widgets, reserveSearch)
  const moving = placed.find((widget) => widget.id === id)
  if (!moving) return placed

  const target = { x: Math.round(x), y: Math.round(y) }
  const others = placed.filter((widget) => widget.id !== id)
  const blockers = others.filter((widget) => overlaps(target, moving.size, widget))
  const searchHit = !isFree(searchCells(reserveSearch), target, moving.size)

  if (!searchHit && blockers.length === 0) {
    return withPositions(placed, new Map([[id, target]]))
  }

  // Swap only when the pointer lands on the other card's origin AND both
  // resulting rectangles fit. Checking the full trial also catches overlap
  // between the swapped cards when their old/new footprints intersect.
  if (!searchHit && blockers.length === 1) {
    const other = blockers[0]
    if (target.x === other.x && target.y === other.y) {
      const swapped = withPositions(placed, new Map([
        [id, target], [other.id, pointOf(moving)],
      ]))
      if (isValidCanvasLayout(swapped, reserveSearch)) return swapped
    }
  }

  if (!searchHit) {
    // Remove every direct blocker atomically, reserve the complete moving
    // footprint, then place blockers one by one in verified free rectangles.
    const excluded = new Set([id, ...blockers.map((widget) => widget.id)])
    const occupied = occupiedBy(placed, excluded, reserveSearch)
    if (isFree(occupied, target, moving.size)) {
      reserve(occupied, target, moving.size)
      const positions = new Map<string, Point>([[id, target]])
      for (const blocker of [...blockers].sort((a, b) => area(b) - area(a))) {
        positions.set(blocker.id, firstFree(occupied, blocker.size, pointOf(blocker)))
      }
      const pushed = withPositions(placed, positions)
      if (isValidCanvasLayout(pushed, reserveSearch)) return pushed
    }
  }

  // Search-bar collisions (or an unexpected invalid plan) use the nearest
  // checked free rectangle. Never return the unchecked drop coordinates.
  const occupied = occupiedBy(placed, new Set([id]), reserveSearch)
  const fallback = firstFree(occupied, moving.size, target)
  return withPositions(placed, new Map([[id, fallback]]))
}

export function resolveCanvasResize(widgets: WidgetConfig[], id: string, size: WidgetSize, reserveSearch = true): WidgetConfig[] {
  if (widgets.some(w => w.groupId)) {
    const current = widgets.find(w => w.id === id)
    if (!current || current.locked) return widgets
    const proposed = widgets.map(w => w.id === id ? { ...w, size } : w)
    const next = resolveCanvasGroupDrop(proposed, new Set([id]), id, current.x ?? 0, current.y ?? 0, reserveSearch)
    return isValidCanvasLayout(next, reserveSearch) ? next : widgets
  }
  const placed = isValidCanvasLayout(widgets, reserveSearch) ? widgets : assignCanvasPositions(widgets, reserveSearch)
  const current = placed.find((widget) => widget.id === id)
  if (!current || current.size === size) return placed

  const target = pointOf(current)
  const resized = { ...current, size } as WidgetConfig
  const others = placed.filter((widget) => widget.id !== id)
  const blockers = others.filter((widget) => overlaps(target, size, widget))
  const searchHit = !isFree(searchCells(reserveSearch), target, size)

  if (!searchHit && blockers.length === 0) {
    return placed.map((widget) => widget.id === id ? resized : widget)
  }

  if (searchHit) {
    const occupied = occupiedBy(placed, new Set([id]), reserveSearch)
    const fallback = firstFree(occupied, size, target)
    return placed.map((widget) => widget.id === id ? { ...resized, ...fallback } : widget)
  }

  const excluded = new Set([id, ...blockers.map((widget) => widget.id)])
  const occupied = occupiedBy(placed, excluded, reserveSearch)
  reserve(occupied, target, size)
  const positions = new Map<string, Point>([[id, target]])
  for (const blocker of [...blockers].sort((a, b) => area(b) - area(a))) {
    positions.set(blocker.id, firstFree(occupied, blocker.size, pointOf(blocker)))
  }
  const next = withPositions(
    placed.map((widget) => widget.id === id ? resized : widget),
    positions,
  )
  return isValidCanvasLayout(next, reserveSearch) ? next : assignCanvasPositions(next, reserveSearch)
}
