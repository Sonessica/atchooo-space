'use client'

/**
 * Infinite bento canvas. Home anchors on a 1x4 search pill; other spaces anchor on origin (0,0).
 * Every space mount / menu switch recenters that anchor to the viewport middle.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useSpring } from 'framer-motion'
import { BENTO_GAP, BENTO_UNIT } from '@/bento/core/BentoSizeMap'
import { WidgetRenderer } from '@/bento/widgets'
import { WidgetEditOverlay } from '@/bento/editor'
import { WidgetEditorPanel } from '@/bento/editor'
import type { GalleryImage, ImageWidgetConfig, WidgetConfig, WidgetSize } from '@/bento/widgets/types'
import { WIDGET_SIZES } from '@/bento/widgets/types'
import { assignCanvasPositions, resolveCanvasDrop, resolveCanvasResize, SEARCH_COLS } from './canvasPlacement'
import { normalizeImageGallery, resolveCoverIndex } from '@/bento/widgets/image/gallery'
import { useGlobalSettings } from './GlobalSettingsProvider'
import { sectionMoveIds, setSectionMembers, sectionMembersInRect } from './sectionGroups'
import { createSectionTitleConfig } from '../widgets/section/SectionTitleWidget'
import {
  bindCanvasRecenter,
  bindCanvasZoom,
  clampZoom,
  publishCanvasZoom,
  unbindCanvasRecenter,
  unbindCanvasZoom,
} from './canvasViewControls'

const STEP = BENTO_UNIT + BENTO_GAP

function canvasParticipants(widgets: WidgetConfig[]) {
  return widgets.filter(widget => widget.category !== 'link' || widget.onCanvas !== false)
}

function mergePositions(all: WidgetConfig[], positioned: WidgetConfig[]) {
  const byId = new Map(positioned.map(widget => [widget.id, widget]))
  return all.map(widget => byId.get(widget.id) || widget)
}

function widgetPixelSize(size: WidgetSize) {
  const meta = WIDGET_SIZES[size]
  if (meta) return { width: meta.width, height: meta.height }
  return { width: BENTO_UNIT, height: BENTO_UNIT }
}

export { assignCanvasPositions, autoLayoutFromCenter } from './canvasPlacement'

function matchesQuery(w: WidgetConfig, q: string) {
  if (!q) return true
  const s = q.toLowerCase()
  const title = 'title' in w ? String((w as { title?: string }).title || '') : ''
  const url = 'url' in w ? String((w as { url?: string }).url || '') : ''
  const content = 'content' in w ? String((w as { content?: string }).content || '') : ''
  const tags = w.category === 'link' ? (w.tags || []).join(' ') : ''
  return `${title} ${url} ${content} ${tags} ${w.category}`.toLowerCase().includes(s)
}

function targetIsFormControl(target: EventTarget | null) {
  return !!(target as HTMLElement | null)?.closest?.(
    'input, textarea, select, button, [data-widget-overlay]'
  )
}

type CanvasProps = {
  widgets: WidgetConfig[]
  isEditing: boolean
  onUpdateWidget: (id: string, updates: Partial<WidgetConfig>) => void
  onRemoveWidget: (id: string) => void
  onSelect: (id: string | null) => void
  selectedWidgetId: string | null
  selectedWidgetIds?: string[]
  onToggleSelection?: (id: string) => void
  onOpenEdit: (id: string) => void
  editingWidgetId: string | null
  onDragStateChange?: (draggingId: string | null) => void
  onAutoLayout?: () => void
  onWidgetsChange?: (widgets: WidgetConfig[]) => void
  onDuplicateWidget?: (id: string) => void
  centerVersion?: number
  showSearch?: boolean
  space?: string
  onExternalDrop?: (payload: { urls: string[]; files: File[] }) => void
}

export function InfiniteCanvas({
  widgets,
  isEditing,
  onUpdateWidget,
  onRemoveWidget,
  onSelect,
  selectedWidgetId,
  selectedWidgetIds = selectedWidgetId ? [selectedWidgetId] : [],
  onToggleSelection,
  onOpenEdit,
  editingWidgetId,
  onDragStateChange,
  onAutoLayout,
  onWidgetsChange,
  centerVersion = 0,
  showSearch = true,
  onDuplicateWidget,
  space = 'home',
  onExternalDrop,
}: CanvasProps) {
  const { settings } = useGlobalSettings()
  const viewportRef = useRef<HTMLDivElement>(null)
  const savedView = useRef<{ zoom: number; pan: { x: number; y: number } } | null>(null)
  if (savedView.current === null && typeof window !== 'undefined') {
    try {
      const raw =
        localStorage.getItem(`atchooo-space-view-${space}`) ||
        localStorage.getItem(`account-hub-view-${space}`) ||
        'null'
      const parsed = JSON.parse(raw) as { zoom?: number; pan?: { x?: number; y?: number } } | null
      savedView.current = {
        zoom: typeof parsed?.zoom === 'number' ? clampZoom(parsed.zoom) : settings.defaultCanvasZoom,
        pan: {
          x: typeof parsed?.pan?.x === 'number' && Number.isFinite(parsed.pan.x) ? parsed.pan.x : 0,
          y: typeof parsed?.pan?.y === 'number' && Number.isFinite(parsed.pan.y) ? parsed.pan.y : 0,
        },
      }
    } catch { savedView.current = { zoom: settings.defaultCanvasZoom, pan: { x: 0, y: 0 } } }
  }
  const [pan, setPan] = useState(() => savedView.current?.pan || { x: 0, y: 0 })
  const [zoom, setZoom] = useState(() => savedView.current?.zoom ?? settings.defaultCanvasZoom)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const [query, setQuery] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [visitorCollapsed, setVisitorCollapsed] = useState<Record<string, boolean>>({})
  const [rangeSection, setRangeSection] = useState<string | null>(null)
  const [rangeRect, setRangeRect] = useState<{ left: number; top: number; right: number; bottom: number } | null>(null)
  const [rangePreview, setRangePreview] = useState<string[] | null>(null)
  const rangeStart = useRef<{ x: number; y: number } | null>(null)
  const sections = useMemo(() => new Map(widgets.filter(w => w.category === 'section').map(w => [w.id, w])), [widgets])
  const isCollapsed = (id: string) => {
    const section = sections.get(id)
    return section?.category === 'section' && (isEditing ? !!section.collapsed : visitorCollapsed[id] ?? !!section.collapsed)
  }
  const movingIds = draggingId ? sectionMoveIds(widgets, draggingId) : new Set<string>()
  const [lightbox, setLightbox] = useState<{
    widgetId: string
    index: number
  } | null>(null)
  const panDrag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const cardDrag = useRef<{
    id: string
    startX: number
    startY: number
    origX: number
    origY: number
    moved: boolean
  } | null>(null)
  const centeredVersion = useRef<number | null>(null)

  const dragX = useMotionValue(0)
  const dragY = useMotionValue(0)
  const smoothX = useSpring(dragX, { stiffness: 420, damping: 38, mass: 0.55 })
  const smoothY = useSpring(dragY, { stiffness: 420, damping: 38, mass: 0.55 })

  /** Anchor (search pill on home, or origin 1x1 cell elsewhere) to viewport center */
  const recenterView = React.useCallback(() => {
    const el = viewportRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const anchorW = showSearch
      ? SEARCH_COLS * BENTO_UNIT + (SEARCH_COLS - 1) * BENTO_GAP
      : BENTO_UNIT
    const anchorH = BENTO_UNIT
    setPan({
      x: rect.width / 2 - anchorW / 2,
      y: rect.height / 2 - anchorH / 2,
    })
  }, [showSearch])

  // Always re-anchor on mount / space switch / search visibility / manual centerVersion
  useEffect(() => {
    const shouldCenter = settings.autoRecenter || (centeredVersion.current !== null && centeredVersion.current !== centerVersion)
    centeredVersion.current = centerVersion
    if (!shouldCenter) return
    recenterView()
    const timer = window.setTimeout(recenterView, 80)
    return () => window.clearTimeout(timer)
  }, [recenterView, centerVersion, space, showSearch, settings.autoRecenter])

  useEffect(() => {
    const timer = window.setTimeout(() => localStorage.setItem(`atchooo-space-view-${space}`, JSON.stringify({ pan, zoom })), 180)
    return () => window.clearTimeout(timer)
  }, [pan, space, zoom])

  // Expose zoom/recenter to Settings modal
  useEffect(() => {
    bindCanvasZoom((next) => {
      setZoom((prev) => {
        const value = typeof next === 'function' ? next(prev) : next
        return clampZoom(value)
      })
    })
    bindCanvasRecenter(recenterView)
    return () => {
      unbindCanvasZoom()
      unbindCanvasRecenter()
    }
  }, [recenterView])

  useEffect(() => {
    publishCanvasZoom(zoom)
  }, [zoom])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    let first = true
    const observer = new ResizeObserver(([entry]) => {
      setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height })
      if (first) {
        first = false
        if (settings.autoRecenter) recenterView()
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [recenterView, settings.autoRecenter])

  const cullPan = useMemo(() => {
    const q = STEP / 2
    return { x: Math.round(pan.x / q) * q, y: Math.round(pan.y / q) * q }
  }, [pan.x, pan.y])

  const visibleWidgets = useMemo(() => {
    if (!viewportSize.width || !viewportSize.height) return []
    const overscan = STEP * 2
    return widgets.filter((w) => {
      const parent = w.groupId ? sections.get(w.groupId) : undefined
      if (parent?.category === 'section' && ((isEditing ? parent.collapsed : visitorCollapsed[parent.id] ?? parent.collapsed) || (parent.hidden && !isEditing))) return false
      if (w.category === 'link' && w.onCanvas === false) return false
      if (w.hidden && !isEditing) return false
      if (w.id === selectedWidgetId || w.id === draggingId || w.id === editingWidgetId || w.id === lightbox?.widgetId) return true
      const x = (typeof w.x === 'number' ? w.x : 0) * STEP + cullPan.x
      const y = (typeof w.y === 'number' ? w.y : 0) * STEP + cullPan.y
      const size = widgetPixelSize(w.size)
      return (
        x + size.width >= -overscan &&
        x <= viewportSize.width + overscan &&
        y + size.height >= -overscan &&
        y <= viewportSize.height + overscan
      )
    })
  }, [widgets, selectedWidgetId, draggingId, editingWidgetId, lightbox?.widgetId, cullPan, viewportSize, isEditing, sections, visitorCollapsed])

  const onViewportPointerDown = (e: React.PointerEvent) => {
    if (rangeSection && !(e.target as HTMLElement).closest('[data-canvas-chrome]')) {
      const rect = viewportRef.current!.getBoundingClientRect()
      const x = (e.clientX - rect.left - pan.x) / zoom / STEP
      const y = (e.clientY - rect.top - pan.y) / zoom / STEP
      rangeStart.current = { x, y }; setRangeRect(null); setRangePreview(null)
      e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault(); return
    }
    if ((e.target as HTMLElement).closest('[data-canvas-card]')) return
    if ((e.target as HTMLElement).closest('[data-canvas-search]')) return
    if ((e.target as HTMLElement).closest('[data-canvas-chrome]')) return
    panDrag.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    if (isEditing) onSelect(null)
  }

  const onViewportPointerMove = (e: React.PointerEvent) => {
    if (rangeStart.current) {
      const rect = viewportRef.current!.getBoundingClientRect()
      const x = (e.clientX - rect.left - pan.x) / zoom / STEP
      const y = (e.clientY - rect.top - pan.y) / zoom / STEP
      setRangeRect({ left: Math.floor(Math.min(x, rangeStart.current.x)), top: Math.floor(Math.min(y, rangeStart.current.y)), right: Math.ceil(Math.max(x, rangeStart.current.x)), bottom: Math.ceil(Math.max(y, rangeStart.current.y)) }); return
    }
    const p = panDrag.current
    if (p) {
      setPan({ x: p.panX + (e.clientX - p.x), y: p.panY + (e.clientY - p.y) })
      return
    }
    const c = cardDrag.current
    if (c && isEditing) {
      const dx = e.clientX - c.startX
      const dy = e.clientY - c.startY
      if (!c.moved && Math.abs(dx) + Math.abs(dy) > 8) {
        c.moved = true
        setDraggingId(c.id)
        onDragStateChange?.(c.id)
        ;(viewportRef.current as HTMLElement)?.setPointerCapture(e.pointerId)
      }
      if (c.moved) {
        dragX.set(dx / zoom)
        dragY.set(dy / zoom)
      }
    }
  }

  const onViewportPointerUp = () => {
    if (rangeStart.current) {
      if (rangeRect && rangeSection) setRangePreview(sectionMembersInRect(widgets, rangeSection, rangeRect))
      rangeStart.current = null; return
    }
    const c = cardDrag.current
    if (c && isEditing && c.moved) {
      const dx = dragX.get()
      const dy = dragY.get()
      const cellX = Math.round((c.origX * STEP + dx) / STEP)
      const cellY = Math.round((c.origY * STEP + dy) / STEP)
      const next = mergePositions(widgets, resolveCanvasDrop(canvasParticipants(widgets), c.id, cellX, cellY, showSearch))
      const changed = next.some((widget, index) => widget.x !== widgets[index].x || widget.y !== widgets[index].y)
      if (changed && onWidgetsChange) onWidgetsChange(next)
      else if (changed) {
        for (const widget of next) {
          const before = widgets.find((item) => item.id === widget.id)
          if (before && (before.x !== widget.x || before.y !== widget.y)) {
            onUpdateWidget(widget.id, { x: widget.x, y: widget.y })
          }
        }
      }
    }
    panDrag.current = null
    cardDrag.current = null
    setDraggingId(null)
    onDragStateChange?.(null)
    dragX.set(0)
    dragY.set(0)
  }

  const startCardDrag = (e: React.PointerEvent, w: WidgetConfig) => {
    if (rangeSection) return
    if (!isEditing || e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('[data-section-control], button, a')) return
    if (w.locked || (w.category === 'section' && widgets.some(item => item.groupId === w.id && item.locked))) return
    if (target.closest('input, textarea, select, [contenteditable="true"]')) return
    if (target.closest('[data-widget-overlay]')) return
    const x = typeof w.x === 'number' ? w.x : 0
    const y = typeof w.y === 'number' ? w.y : 0
    cardDrag.current = {
      id: w.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: x,
      origY: y,
      moved: false,
    }
    dragX.set(0)
    dragY.set(0)
    e.preventDefault()
    if (e.shiftKey) onToggleSelection?.(w.id)
    else onSelect(w.id)
  }

  const editingWidget = widgets.find((w) => w.id === editingWidgetId) || null

  const lightboxWidget = lightbox
    ? widgets.find((w) => w.id === lightbox.widgetId && w.category === 'image')
    : null
  const lightboxGallery = lightboxWidget
    ? normalizeImageGallery(lightboxWidget as ImageWidgetConfig)
    : null
  const lightboxImages: GalleryImage[] = lightboxGallery?.images ?? []
  const lightboxIndex = lightboxImages.length
    ? Math.min(Math.max(lightbox?.index ?? 0, 0), lightboxImages.length - 1)
    : 0
  const lightboxImage = lightboxImages[lightboxIndex] || null
  const lightboxTitle = lightboxWidget
    ? String((lightboxWidget as ImageWidgetConfig).title || '')
    : ''
  const lightboxRef = useRef<HTMLDivElement | null>(null)

  const stepLightbox = (delta: number) => {
    if (!lightboxImages.length) return
    setLightbox((prev) => {
      if (!prev) return prev
      const len = lightboxImages.length
      return { ...prev, index: ((prev.index + delta) % len + len) % len }
    })
  }

  useEffect(() => {
    if (!lightbox) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightbox(null)
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        stepLightbox(-1)
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        stepLightbox(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox, lightboxImages.length])

  useEffect(() => {
    if (!lightbox) return
    const el = lightboxRef.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      stepLightbox(delta > 0 ? 1 : -1)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox, lightboxImages.length, lightboxIndex])

  return (
    <div
      ref={viewportRef}
      className="relative h-screen w-full cursor-grab overflow-hidden bg-[#F5F5F7] active:cursor-grabbing"
      style={{ touchAction: 'none' }}
      onPointerDown={onViewportPointerDown}
      onPointerMoveCapture={onViewportPointerMove}
      onPointerUpCapture={onViewportPointerUp}
      onPointerCancelCapture={onViewportPointerUp}
      onWheel={(event) => {
        if (!event.ctrlKey && !event.metaKey) return
        event.preventDefault()
        setZoom((value) => clampZoom(value - event.deltaY * .001))
      }}
      onDragOver={(event) => { if (isEditing) event.preventDefault() }}
      onDrop={(event) => {
        if (!isEditing || !onExternalDrop) return
        event.preventDefault()
        const urls = [event.dataTransfer.getData('text/uri-list'), event.dataTransfer.getData('text/plain')]
          .flatMap(value => value.split(/\r?\n/)).filter(value => /^https?:\/\//i.test(value))
        onExternalDrop({ urls: [...new Set(urls)], files: [...event.dataTransfer.files] })
      }}
    >
      <div
        className="absolute left-0 top-0 will-change-transform"
        style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`, transformOrigin: '0 0' }}
      >
        {rangeRect && <div aria-hidden="true" className="pointer-events-none absolute z-50 border-2 border-blue-500 bg-blue-400/10" style={{ left: rangeRect.left * STEP, top: rangeRect.top * STEP, width: (rangeRect.right - rangeRect.left) * STEP, height: (rangeRect.bottom - rangeRect.top) * STEP }} />}
        {isEditing && [...sections.values()].filter(section => section.id === selectedWidgetId || widgets.some(w => w.groupId === section.id && w.id === selectedWidgetId)).map(section => {
          const items = widgets.filter(w => w.id === section.id || (!section.collapsed && w.groupId === section.id))
          const left = Math.min(...items.map(w => (w.x ?? 0) * STEP)) - 10
          const top = Math.min(...items.map(w => (w.y ?? 0) * STEP)) - 10
          const right = Math.max(...items.map(w => (w.x ?? 0) * STEP + widgetPixelSize(w.size).width)) + 10
          const bottom = Math.max(...items.map(w => (w.y ?? 0) * STEP + widgetPixelSize(w.size).height)) + 10
          return <motion.div key={`boundary-${section.id}`} aria-hidden="true" className="pointer-events-none absolute rounded-[32px] border border-dashed border-blue-400/50 bg-blue-400/[.025]" style={{ left, top, width: right - left, height: bottom - top, x: draggingId === section.id ? smoothX : 0, y: draggingId === section.id ? smoothY : 0 }} />
        })}
        {showSearch && <div
          data-canvas-search
          className="absolute z-20 flex items-center"
          style={{
            left: 0,
            top: 0,
            width: SEARCH_COLS * BENTO_UNIT + (SEARCH_COLS - 1) * BENTO_GAP,
            height: BENTO_UNIT,
            padding: 16,
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cards..."
            className="atch-search-input h-full w-full"
            onPointerDown={(e) => e.stopPropagation()}
          />
        </div>}

        {visibleWidgets.map((w) => {
          const x = typeof w.x === 'number' ? w.x : 0
          const y = typeof w.y === 'number' ? w.y : 0
          const px = widgetPixelSize(w.size)
          const hit = matchesQuery(w, query)
          const isDragged = movingIds.has(w.id)
          const isHiddenCard = !!w.hidden
          const gallery =
            w.category === 'image'
              ? normalizeImageGallery(w as ImageWidgetConfig)
              : null
          return (
            <motion.div
              key={w.id}
              id={`widget-${w.id}`}
              data-canvas-card
              role={!isEditing && w.category === 'link' ? 'link' : undefined}
              tabIndex={!isEditing && w.category === 'link' ? 0 : undefined}
              aria-label={!isEditing && w.category === 'link' ? `打开 ${w.title || w.url}` : undefined}
              data-widget-hidden={isHiddenCard ? 'true' : undefined}
              onDragStart={(e) => e.preventDefault()}
              onClick={(event) => {
                if (isEditing || w.category !== 'link' || !w.url) return
                if ((event.target as HTMLElement).closest('a, button')) return
                window.open(w.url, '_blank', 'noopener,noreferrer')
              }}
              onKeyDown={(event) => {
                if (isEditing || w.category !== 'link' || !w.url || event.key !== 'Enter') return
                event.preventDefault()
                window.open(w.url, '_blank', 'noopener,noreferrer')
              }}
              className="absolute cursor-pointer select-none"
              initial={false}
              animate={{
                left: x * STEP,
                top: y * STEP,
                width: px.width,
                height: px.height,
                opacity: hit ? (isEditing && isHiddenCard ? 0.38 : 1) : 0.25,
                scale: isDragged ? 1.045 : selectedWidgetIds.includes(w.id) ? 1.018 : 1,
                zIndex: isDragged ? 40 : 1,
                boxShadow: isDragged
                  ? '0 18px 40px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)'
                  : isEditing && isHiddenCard
                    ? '0 0 0 1.5px rgba(245, 158, 11, 0.85)'
                    : selectedWidgetIds.includes(w.id)
                      ? '0 12px 30px rgba(0,0,0,.12)'
                      : isEditing && w.groupId === selectedWidgetId
                        ? '0 0 0 2px rgba(96,165,250,.35)'
                        : '0 0px 0px rgba(0,0,0,0)',
              }}
              transition={{
                type: 'spring',
                stiffness: 380,
                damping: 32,
                mass: 0.6,
                opacity: { duration: 0.18 },
              }}
              style={
                isDragged
                  ? { x: smoothX, y: smoothY, position: 'absolute', userSelect: 'none' }
                  : { position: 'absolute', userSelect: 'none' }
              }
              onPointerDownCapture={(e) => {
                if (!isEditing) return
                startCardDrag(e, w)
              }}
              onDoubleClickCapture={(e) => {
                if (targetIsFormControl(e.target)) return
                if (isEditing) {
                  onSelect(w.id)
                  onOpenEdit(w.id)
                  return
                }
                if (w.category === 'image' && gallery && gallery.images.length > 0) {
                  const start = resolveCoverIndex(w as ImageWidgetConfig)
                  setLightbox({ widgetId: w.id, index: start })
                }
              }}
            >
              <div
                data-canvas-card-content
                className="h-full w-full overflow-hidden rounded-[27px]"
                // Browsing widgets need their own hover/buttons; editing keeps
                // pointer targeting on the canvas wrapper for selection/dragging.
                style={{ pointerEvents: w.category === 'section' || (!isEditing && (w.category === 'image' || w.category === 'link')) ? 'auto' : 'none' }}
              >
                <WidgetRenderer
                  config={w}
                  isEditing={isEditing}
                  onConfigChange={(u) => onUpdateWidget(w.id, u)}
                  groupCount={w.category === 'section' ? widgets.filter(item => item.groupId === w.id).length : undefined}
                  groupCollapsed={w.category === 'section' ? isCollapsed(w.id) : undefined}
                  onToggleGroup={() => {
                    if (isEditing) onUpdateWidget(w.id, { collapsed: !isCollapsed(w.id) })
                    else setVisitorCollapsed(current => ({ ...current, [w.id]: !isCollapsed(w.id) }))
                  }}
                />
              </div>
              {isEditing && isHiddenCard && (
                <div className="pointer-events-none absolute left-2 top-2 rounded-full bg-amber-400/95 px-2 py-0.5 text-[10px] font-semibold text-black shadow">
                  已隐藏
                </div>
              )}
              {isEditing && selectedWidgetId === w.id && !editingWidgetId && !isDragged && (
                <WidgetEditOverlay
                  widget={w}
                  onEdit={() => onOpenEdit(w.id)}
                  onDuplicate={() => onDuplicateWidget?.(w.id)}
                  onDelete={() => onRemoveWidget(w.id)}
                  onSizeChange={(size) => {
                    const next = mergePositions(widgets, resolveCanvasResize(canvasParticipants(widgets), w.id, size, showSearch))
                    if (onWidgetsChange) onWidgetsChange(next)
                    else {
                      for (const widget of next) {
                        const before = widgets.find((item) => item.id === widget.id)
                        if (before && (before.size !== widget.size || before.x !== widget.x || before.y !== widget.y)) {
                          onUpdateWidget(widget.id, { size: widget.size, x: widget.x, y: widget.y })
                        }
                      }
                    }
                  }}
                  onUpdate={(u) => onUpdateWidget(w.id, u)}
                />
              )}
            </motion.div>
          )
        })}
      </div>

      {onAutoLayout && null}
      {isEditing && onWidgetsChange && selectedWidgetIds.filter(id => widgets.some(w => w.id === id && w.category !== 'section')).length > 1 && <button data-canvas-chrome type="button" className="fixed bottom-36 left-6 z-50 rounded-full bg-black px-5 py-3 text-sm text-white shadow-lg" onClick={() => {
        const title = createSectionTitleConfig('新分区')
        const selected = widgets.filter(w => selectedWidgetIds.includes(w.id))
        title.x = Math.min(...selected.map(w => w.x ?? 0)); title.y = Math.min(...selected.map(w => w.y ?? 0)) - 1
        const next = setSectionMembers([...widgets, title], title.id, selectedWidgetIds)
        const positioned = mergePositions(next, assignCanvasPositions(canvasParticipants(next), showSearch))
        onWidgetsChange(positioned); onSelect(title.id); onOpenEdit(title.id)
      }}>将多选卡片创建为分区</button>}
      {isEditing && rangeSection && <div data-canvas-chrome className="fixed left-1/2 top-6 z-[10000] flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-white p-4 text-sm text-black shadow-xl" onPointerDown={e => e.stopPropagation()}><span>{rangePreview ? `预选 ${rangePreview.length} 张卡片（完整包含）` : '拖动框选范围，松开预览，再确认'}</span>{rangePreview && <button type="button" className="rounded-lg bg-blue-600 px-3 py-2 text-white" onClick={() => {
        const existing = widgets.filter(w => w.groupId === rangeSection).map(w => w.id)
        onWidgetsChange?.(setSectionMembers(widgets, rangeSection, [...new Set([...existing, ...rangePreview])]))
        setRangeSection(null); setRangeRect(null); setRangePreview(null)
      }}>确认加入</button>}<button type="button" onClick={() => { rangeStart.current = null; setRangeSection(null); setRangeRect(null); setRangePreview(null) }}>取消</button></div>}

      <AnimatePresence>
        {lightbox && lightboxImage && (
          <motion.div
            ref={lightboxRef}
            data-canvas-chrome
            className="fixed inset-0 z-[100000] flex flex-col items-center justify-center gap-4 bg-black/70 p-6 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={() => setLightbox(null)}
            role="dialog"
            aria-modal="true"
            aria-label="图片预览"
          >
            <motion.div
              className="relative flex max-h-full max-w-5xl flex-col items-center"
              initial={{ scale: 0.72, opacity: 0, y: 28 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.86, opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 320, damping: 18, mass: 0.7 }}
              onClick={(e) => e.stopPropagation()}
            >
              {lightboxTitle && (
                <motion.div
                  className="mb-3 text-center text-sm font-medium text-white/90"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08, type: 'spring', stiffness: 260, damping: 20 }}
                >
                  {lightboxTitle}
                </motion.div>
              )}

              {lightboxImage.videoSrc ? (
                <motion.video
                  key={lightboxImage.id}
                  src={lightboxImage.videoSrc}
                  poster={lightboxImage.src}
                  controls
                  autoPlay
                  playsInline
                  muted={lightboxImage.type === 'live-photo'}
                  className="max-h-[70vh] w-auto max-w-full rounded-[28px] object-contain shadow-[0_24px_80px_rgba(0,0,0,0.45)] ring-1 ring-white/20"
                  initial={{ opacity: 0.65, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 20 }}
                />
              ) : (
                <motion.img
                  key={lightboxImage.id}
                  src={lightboxImage.src}
                  alt={lightboxImage.alt || lightboxTitle || ''}
                  className="max-h-[70vh] w-auto max-w-full rounded-[28px] object-contain shadow-[0_24px_80px_rgba(0,0,0,0.45)] ring-1 ring-white/20"
                  initial={{ opacity: 0.65, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 20 }}
                />
              )}

              <div className="mt-2 text-xs text-white/55">
                {lightboxIndex + 1} / {lightboxImages.length}
              </div>
            </motion.div>

            {lightboxImages.length > 1 && (
              <div
                className="max-w-[min(96vw,900px)] overflow-x-auto rounded-2xl bg-black/25 px-3 py-2"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2">
                  {lightboxImages.map((image, index) => (
                    <button
                      key={image.id}
                      type="button"
                      aria-label={`查看第 ${index + 1} 张`}
                      className={[
                        'h-14 w-14 shrink-0 overflow-hidden rounded-xl transition',
                        index === lightboxIndex
                          ? 'ring-2 ring-white scale-105'
                          : 'opacity-70 ring-1 ring-white/20 hover:opacity-100',
                      ].join(' ')}
                      onClick={() => setLightbox({ widgetId: lightbox.widgetId, index })}
                    >
                      <img
                        src={image.src}
                        alt=""
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {isEditing && editingWidget && (
        <WidgetEditorPanel
          widget={editingWidget}
          widgets={widgets}
          selectedIds={selectedWidgetIds}
          onWidgetsChange={onWidgetsChange}
          onPickSectionRange={id => { setRangeSection(id); setRangeRect(null); setRangePreview(null) }}
          onUpdate={(u) => onUpdateWidget(editingWidget.id, u)}
          onClose={() => onOpenEdit('')}
        />
      )}

      <style>{`
        .atch-search-input {
          border: none;
          outline: none;
          border-radius: 100px;
          padding: 1.2em 1.6em;
          background-color: #e1e2e3;
          box-shadow: inset 2px 5px 10px rgba(0, 0, 0, 0.3);
          transition: 300ms ease-in-out;
          font-size: 16px;
          color: #222;
        }
        .atch-search-input::placeholder { color: rgba(0,0,0,0.35); }
        .atch-search-input:focus {
          background-color: #ffffff;
          transform: scale(1.03);
          box-shadow: 13px 13px 100px #969696, -13px -13px 100px #ffffff;
        }
        [data-canvas-card] img {
          pointer-events: none;
          user-select: none;
          -webkit-user-drag: none;
        }
      `}</style>
    </div>
  )
}

export default InfiniteCanvas
