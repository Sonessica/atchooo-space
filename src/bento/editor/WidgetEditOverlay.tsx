'use client'

/**
 * [INPUT]: widget + edit callbacks
 * [OUTPUT]: single floating control menu (actions + size + map search)
 * [POS]: /bento/editor — portal overlay for the selected card
 */

import React from 'react'
import ReactDOM from 'react-dom'
import { motion } from 'framer-motion'
import type { WidgetConfig, WidgetSize, MapWidgetConfig } from '../widgets/types'
import { SIZE_VARIANTS } from '../widgets/types'
import { cn } from '@/design-system/utils/cn'
import { LocationSearch } from './LocationSearch'

interface WidgetEditOverlayProps {
    widget: WidgetConfig
    onDelete: () => void
    onSizeChange: (size: WidgetSize) => void
    onUpdate?: (updates: Partial<WidgetConfig>) => void
    onClose?: () => void
    onEdit?: () => void
    onDuplicate?: () => void
}

const DeleteIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
)

const SizeIcon: React.FC<{ size: WidgetSize; isActive: boolean }> = ({ size, isActive }) => {
    const stroke = isActive ? 'black' : 'rgba(255,255,255,0.6)'
    const strokeWidth = 1.5
    const renderShape = () => {
        switch (size) {
            case '1x1':
                return <rect x="7" y="7" width="10" height="10" rx="2.5" stroke={stroke} strokeWidth={strokeWidth} />
            case '2x1':
                return <rect x="4" y="8" width="16" height="8" rx="2.5" stroke={stroke} strokeWidth={strokeWidth} />
            case '1x2':
                return <rect x="8" y="4" width="8" height="16" rx="2.5" stroke={stroke} strokeWidth={strokeWidth} />
            case '2x2':
                return <rect x="4" y="4" width="16" height="16" rx="2.5" stroke={stroke} strokeWidth={strokeWidth} />
            default:
                return null
        }
    }
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            {renderShape()}
        </svg>
    )
}

const actionBtnClass = 'rounded-lg px-2.5 py-1.5 whitespace-nowrap hover:bg-white/15 transition-colors'
const actionBtnActiveClass = 'rounded-lg px-2.5 py-1.5 whitespace-nowrap bg-white text-black hover:bg-white/90 transition-colors'

export const WidgetEditOverlay: React.FC<WidgetEditOverlayProps> = ({
    widget,
    onDelete,
    onSizeChange,
    onUpdate,
    onClose,
    onEdit,
    onDuplicate,
}) => {
    const [rect, setRect] = React.useState<DOMRect | null>(null)
    const [isVisible, setIsVisible] = React.useState(false)
    const [showLocationSearch, setShowLocationSearch] = React.useState(false)

    React.useEffect(() => {
        let lastRect: DOMRect | null = null

        const updatePosition = () => {
            const element = document.getElementById(`widget-${widget.id}`)
            if (element) {
                const newRect = element.getBoundingClientRect()
                setRect((prev) => {
                    if (!prev) {
                        lastRect = newRect
                        return newRect
                    }
                    if (
                        Math.abs(prev.x - newRect.x) > 1 ||
                        Math.abs(prev.y - newRect.y) > 1 ||
                        prev.width !== newRect.width
                    ) {
                        lastRect = newRect
                        return newRect
                    }
                    return prev
                })
                setIsVisible(true)
            } else {
                setIsVisible(false)
            }
        }

        const handleClose = () => {
            if (onClose) onClose()
        }

        updatePosition()

        const element = document.getElementById(`widget-${widget.id}`)
        let resizeObserver: ResizeObserver | null = null
        if (element) {
            resizeObserver = new ResizeObserver(updatePosition)
            resizeObserver.observe(element)
        }

        window.addEventListener('scroll', handleClose, { passive: true, capture: true })
        window.addEventListener('wheel', handleClose, { passive: true, capture: true })
        window.addEventListener('touchmove', handleClose, { passive: true, capture: true })
        window.addEventListener('resize', updatePosition, { passive: true })
        document.addEventListener('scroll', handleClose, { passive: true, capture: true })
        document.addEventListener('wheel', handleClose, { passive: true, capture: true })
        document.addEventListener('touchmove', handleClose, { passive: true, capture: true })

        let currentElement: HTMLElement | null = element?.parentElement || null
        const scrollableParents: HTMLElement[] = []
        while (currentElement && currentElement !== document.body) {
            const overflow = window.getComputedStyle(currentElement).overflow
            const overflowY = window.getComputedStyle(currentElement).overflowY
            if (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay' ||
                overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
                scrollableParents.push(currentElement)
                currentElement.addEventListener('scroll', handleClose, { passive: true })
                currentElement.addEventListener('wheel', handleClose, { passive: true })
                currentElement.addEventListener('touchmove', handleClose, { passive: true })
            }
            currentElement = currentElement.parentElement
        }

        let animationFrameId: number
        const checkPosition = () => {
            if (element && lastRect) {
                const currentRect = element.getBoundingClientRect()
                if (
                    Math.abs(currentRect.top - lastRect.top) > 1 ||
                    Math.abs(currentRect.left - lastRect.left) > 1
                ) {
                    if (onClose) onClose()
                    return
                }
                lastRect = currentRect
            }
            animationFrameId = requestAnimationFrame(checkPosition)
        }
        animationFrameId = requestAnimationFrame(checkPosition)

        return () => {
            window.removeEventListener('scroll', handleClose, { capture: true })
            window.removeEventListener('wheel', handleClose, { capture: true })
            window.removeEventListener('touchmove', handleClose, { capture: true })
            window.removeEventListener('resize', updatePosition)
            document.removeEventListener('scroll', handleClose, { capture: true })
            document.removeEventListener('wheel', handleClose, { capture: true })
            document.removeEventListener('touchmove', handleClose, { capture: true })
            scrollableParents.forEach(parent => {
                parent.removeEventListener('scroll', handleClose)
                parent.removeEventListener('wheel', handleClose)
                parent.removeEventListener('touchmove', handleClose)
            })
            if (resizeObserver) resizeObserver.disconnect()
            cancelAnimationFrame(animationFrameId)
        }
    }, [widget.id, onClose])

    if (!rect || !isVisible) return null
    if (typeof document === 'undefined') return null

    const isMapWidget = widget.category === 'map'
    const isHidden = !!widget.hidden
    const isLocked = !!widget.locked

    const overlayContent = (
        <div
            data-widget-overlay
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {/* Unified control menu above the card */}
            <motion.div
                className="fixed z-[9999] min-w-[220px] overflow-hidden rounded-2xl border border-white/10 bg-black/90 text-xs text-white shadow-xl backdrop-blur-xl"
                style={{
                    left: rect.left + rect.width / 2,
                    top: rect.top - 10,
                    transform: 'translate(-50%, -100%)',
                }}
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            >
                {/* Actions row */}
                <div className="flex items-center gap-0.5 p-1.5">
                    <button type="button" className={actionBtnClass} onClick={onEdit}>编辑</button>
                    <button type="button" className={actionBtnClass} onClick={onDuplicate}>复制</button>
                    <button
                        type="button"
                        className={isLocked ? actionBtnActiveClass : actionBtnClass}
                        onClick={() => onUpdate?.({ locked: !isLocked })}
                    >
                        {isLocked ? '解锁' : '锁定'}
                    </button>
                    <button
                        type="button"
                        className={isHidden ? actionBtnActiveClass : actionBtnClass}
                        onClick={() => onUpdate?.({ hidden: !isHidden })}
                    >
                        {isHidden ? '显示' : '隐藏'}
                    </button>
                    <div className="mx-0.5 h-4 w-px shrink-0 bg-white/15" />
                    <button
                        type="button"
                        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-white/90 hover:bg-white/15 hover:text-white"
                        onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            onDelete()
                        }}
                    >
                        <DeleteIcon />
                        删除
                    </button>
                </div>

                {/* Size + map tools row */}
                {(
                    <div className="flex items-center gap-1 border-t border-white/10 p-1.5">
                        <span className="pl-1 pr-0.5 text-[10px] uppercase tracking-wide text-white/40">尺寸</span>
                        {SIZE_VARIANTS.map((size) => {
                            const isActive = widget.size === size
                            return (
                                <motion.button
                                    key={size}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        e.preventDefault()
                                        onSizeChange(size)
                                    }}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    className={cn(
                                        'rounded-lg flex items-center justify-center size-[28px]',
                                        isActive ? 'bg-white shadow-sm' : 'bg-transparent text-white/60 hover:bg-white/10'
                                    )}
                                    title={size}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <SizeIcon size={size} isActive={isActive} />
                                </motion.button>
                            )
                        })}

                        {isMapWidget && (
                            <>
                                <div className="ml-0.5 h-4 w-px bg-white/10" />
                                <button
                                    type="button"
                                    className={cn(
                                        'rounded-lg flex items-center justify-center size-[28px]',
                                        showLocationSearch ? 'bg-white text-black shadow-sm' : 'text-white/60 hover:bg-white/10'
                                    )}
                                    title="搜索位置"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        e.preventDefault()
                                        setShowLocationSearch(!showLocationSearch)
                                    }}
                                    onPointerDown={(e) => e.stopPropagation()}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="11" cy="11" r="8" />
                                        <path d="m21 21-4.35-4.35" />
                                    </svg>
                                </button>
                            </>
                        )}
                    </div>
                )}

                {isHidden && (
                    <div className="border-t border-white/10 px-3 py-1.5 text-[10px] text-amber-200/90">
                        当前卡片已隐藏，查看模式不显示；点「显示」可恢复
                    </div>
                )}
            </motion.div>

            {isMapWidget && showLocationSearch && onUpdate && (
                <LocationSearch
                    rect={rect}
                    onSelect={(location) => {
                        const mapConfig = widget as MapWidgetConfig
                        const newZoom = mapConfig.zoom ?? 13
                        onUpdate({
                            location,
                            zoom: newZoom,
                            title: location.label,
                        } as Partial<MapWidgetConfig>)
                        setShowLocationSearch(false)
                    }}
                    onClose={() => setShowLocationSearch(false)}
                />
            )}
        </div>
    )

    return ReactDOM.createPortal(overlayContent, document.body)
}

export default WidgetEditOverlay
