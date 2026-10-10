'use client'

import React, { useEffect, useRef, useState } from 'react'

import { EditorToolbar, useEditor, EditorFooter, CommandPalette } from '@/bento/editor'
import { SettingsModal } from '@/bento/editor/SettingsModal'
import { InfiniteCanvas, assignCanvasPositions } from '@/bento/editor/InfiniteCanvas'
import { autoLayoutWidgets, type AutoLayoutMode } from '@/bento/editor/canvasPlacement'
import { PersistentEditorProvider } from '@/bento/editor/PersistentEditorProvider'
import { GlobalSettingsProvider } from '@/bento/editor/GlobalSettingsProvider'
import { RadialNavigation } from '@/components/site/RadialNavigation'
import { resolveCanvasDrop } from '@/bento/editor/canvasPlacement'
import type { WidgetConfig } from '@/bento/widgets/types'
import { createImageWidgetConfig, createLinkWidgetConfig } from '@/bento/widgets'
import { createGalleryImage } from '@/bento/widgets/image/gallery'
import { pairMediaFiles, uploadMedia } from '@/lib/client/upload-image'
import { LinkLibraryPanel } from './LinkLibraryPanel'
import { removeSectionWidgets } from './sectionGroups'

// ============ Editor View Wrapper ============

const EditorView: React.FC<{ children: React.ReactNode; space: string }> = ({ children, space }) => {
    const { isEditing } = useEditor()
    return (
        <div
            className="relative min-h-screen bg-[#F5F5F7] transition-colors duration-500"
            data-space-canvas={space}
            style={{ viewTransitionName: 'space-content' }}
        >
            {children}
            {isEditing && <EditorToolbar />}
        </div>
    )
}

// ============ Editor Content ============

const EditorContent: React.FC<{ centerVersion: number; showSearch: boolean; space: string }> = ({ centerVersion, showSearch, space }) => {
    const {
        widgets,
        selectedWidgetId,
        setSelectedWidgetId,
        isEditing,
        removeWidget,
        updateWidget,
        reorderWidgets,
        undo,
        redo,
        duplicateWidget,
        addWidget,
    } = useEditor()
    const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null)
    const [selectedWidgetIds, setSelectedWidgetIds] = useState<string[]>([])
    const draggingIdRef = useRef<string | null>(null)
    const repairedOnce = useRef(false)
    const clipboard = useRef<WidgetConfig | null>(null)

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (!isEditing || /input|textarea|select/i.test((event.target as HTMLElement)?.tagName || '')) return
            const command = event.ctrlKey || event.metaKey
            if (command && event.key.toLowerCase() === 'z') {
                event.preventDefault()
                if (event.shiftKey) redo()
                else undo()
                return
            }
            if (command && event.key.toLowerCase() === 'd' && selectedWidgetId) {
                event.preventDefault(); duplicateWidget(selectedWidgetId); return
            }
            if (command && event.key.toLowerCase() === 'a') {
                event.preventDefault(); setSelectedWidgetIds(widgets.map((widget) => widget.id)); setSelectedWidgetId(widgets[0]?.id || null); return
            }
            if (command && event.key.toLowerCase() === 'c' && selectedWidgetId) {
                event.preventDefault()
                clipboard.current = structuredClone(widgets.find((widget) => widget.id === selectedWidgetId) || null)
                return
            }
            if (command && event.key.toLowerCase() === 'v' && clipboard.current) {
                event.preventDefault()
                duplicateWidget(clipboard.current.id)
                return
            }
            if ((event.key === 'Delete' || event.key === 'Backspace') && selectedWidgetId) {
                event.preventDefault()
                const ids = selectedWidgetIds.length ? selectedWidgetIds : [selectedWidgetId]
                reorderWidgets(removeSectionWidgets(widgets, ids)); setSelectedWidgetIds([]); setSelectedWidgetId(null); return
            }
            if (event.key === 'Escape') { setSelectedWidgetId(null); return }
            if (selectedWidgetId && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
                event.preventDefault()
                const widget = widgets.find((item) => item.id === selectedWidgetId)
                if (!widget || widget.locked) return
                const step = event.shiftKey ? 2 : 1
                const x = (widget.x ?? 0) + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0)
                const y = (widget.y ?? 0) + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0)
                const participants = widgets.filter(item => item.category !== 'link' || item.onCanvas !== false)
                const positioned = resolveCanvasDrop(participants, widget.id, x, y, showSearch)
                const byId = new Map(positioned.map(item => [item.id, item]))
                reorderWidgets(widgets.map(item => byId.get(item.id) || item))
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [duplicateWidget, isEditing, redo, removeWidget, reorderWidgets, selectedWidgetId, selectedWidgetIds, setSelectedWidgetId, showSearch, undo, widgets])

    // Repair once after load, then only when a widget lacks x,y (new card).
    // Never rewrite coordinates while a card is being dragged.
    useEffect(() => {
        if (!widgets.length || draggingIdRef.current) return
        const canvasWidgets = widgets.filter(w => w.category !== 'link' || w.onCanvas !== false)
        const missing = canvasWidgets.some((w) => typeof w.x !== 'number' || typeof w.y !== 'number')
        if (repairedOnce.current && !missing) return
        const positioned = assignCanvasPositions(canvasWidgets, showSearch)
        const byId = new Map(positioned.map(widget => [widget.id, widget]))
        const next = widgets.map(widget => byId.get(widget.id) || widget)
        repairedOnce.current = true
        if (next.some((w, i) => w.x !== widgets[i].x || w.y !== widgets[i].y)) {
            reorderWidgets(next)
        }
    }, [widgets, reorderWidgets, showSearch])

    return (
        <InfiniteCanvas
            widgets={widgets}
            isEditing={isEditing}
            onUpdateWidget={updateWidget}
            onRemoveWidget={removeWidget}
            onSelect={(id) => { setSelectedWidgetId(id); setSelectedWidgetIds(id ? [id] : []) }}
            selectedWidgetId={selectedWidgetId}
            selectedWidgetIds={selectedWidgetIds}
            onToggleSelection={(id) => {
                setSelectedWidgetIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
                setSelectedWidgetId(id)
            }}
            onOpenEdit={(id) => setEditingWidgetId(id || null)}
            editingWidgetId={editingWidgetId}
            onDragStateChange={(id) => { draggingIdRef.current = id }}
            onWidgetsChange={(next) => {
                draggingIdRef.current = null
                repairedOnce.current = true
                reorderWidgets(next)
            }}
            centerVersion={centerVersion}
            showSearch={showSearch}
            onDuplicateWidget={duplicateWidget}
            space={space}
            onExternalDrop={async ({ urls, files }) => {
                urls.forEach((url) => addWidget(createLinkWidgetConfig(url, '1x1')))
                for (const item of pairMediaFiles(files)) {
                    const uploaded = await uploadMedia(item.photo, item.video)
                    const media = createGalleryImage(uploaded.url, undefined, {
                        type: uploaded.type,
                        videoSrc: uploaded.videoUrl,
                        duration: uploaded.duration,
                    })
                    addWidget(createImageWidgetConfig(uploaded.url, '1x1', {
                        images: [media],
                        coverId: media.id,
                    }))
                }
            }}
        />
    )
}

// ============ Page Shell ============

const HubShell: React.FC<{ space: 'home' | 'notes' | 'gallery' | 'bookmarks' }> = ({ space }) => {
    const {
        isEditing,
        setIsEditing,
        profile,
        updateProfile,
        widgets,
        reorderWidgets,
        updateWidget,
        addWidget,
    } = useEditor()
    const [showSettings, setShowSettings] = useState(false)
    const [showLibrary, setShowLibrary] = useState(false)
    const [centerVersion, setCenterVersion] = useState(0)
    const applyAutoLayout = (mode: AutoLayoutMode = 'balanced') => {
        if (!isEditing || !widgets.length) return
        const canvasWidgets = widgets.filter(widget => widget.category !== 'link' || widget.onCanvas !== false)
        const positioned = autoLayoutWidgets(canvasWidgets, mode, space === 'home')
        const byId = new Map(positioned.map(widget => [widget.id, widget]))
        reorderWidgets(widgets.map(widget => byId.get(widget.id) || widget))
        setCenterVersion((version) => version + 1)
    }

    return (
        <>
            <EditorContent centerVersion={centerVersion} showSearch={space === 'home'} space={space} />
            <EditorFooter
                isEditing={isEditing}
                onToggleEdit={() => setIsEditing(!isEditing)}
                onOpenSettings={() => setShowSettings(true)}
                onOpenLibrary={() => setShowLibrary(true)}
                onAutoLayout={applyAutoLayout}
            />
            <CommandPalette onAutoLayout={applyAutoLayout} />
            <RadialNavigation hidden={showSettings} compact={isEditing} />
            {showLibrary && <LinkLibraryPanel space={space} widgets={widgets} isEditing={isEditing} onUpdate={updateWidget} onAdd={addWidget} onClose={() => setShowLibrary(false)} />}
            {showSettings && (
                <SettingsModal
                    profile={profile}
                    onProfileChange={updateProfile}
                    onClose={() => setShowSettings(false)}
                />
            )}
        </>
    )
}

// ============ Page ============

export function BentoEditorPage({
    space = 'home',
    showSplash = true,
}: {
    space?: 'home' | 'notes' | 'gallery' | 'bookmarks'
    showSplash?: boolean
}) {
    return (
        <GlobalSettingsProvider>
            <PersistentEditorProvider key={space} space={space} showSplash={showSplash}>
                <EditorView space={space}>
                    <HubShell space={space} />
                </EditorView>
            </PersistentEditorProvider>
        </GlobalSettingsProvider>
    )
}
