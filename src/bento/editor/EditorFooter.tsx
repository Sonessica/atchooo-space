'use client'

/**
 * Footer: settings + auto-layout + edit/view toggle.
 */

import React, { useState } from 'react'
import { Gear, PencilSimple, Check, Shuffle } from 'phosphor-react'

export const EditorFooter: React.FC<{
    isEditing?: boolean
    onToggleEdit?: () => void
    onOpenSettings?: () => void
    onOpenLibrary?: () => void
    onAutoLayout?: (mode?: 'compact' | 'balanced' | 'organic' | 'rows' | 'columns' | 'focus') => void
}> = ({ isEditing = false, onToggleEdit, onOpenSettings, onOpenLibrary, onAutoLayout }) => {
    const [layoutsOpen, setLayoutsOpen] = useState(false)
    return (
        <div
            className="fixed bottom-6 left-6 z-[10000] flex items-center gap-2 rounded-2xl border border-white/50 bg-white/85 p-2 shadow-lg backdrop-blur-md"
            style={{
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                viewTransitionName: 'space-controls',
            }}
        >
            <button
                type="button"
                onClick={onOpenSettings}
                className="flex items-center justify-center w-9 h-9 rounded-lg text-black/40 hover:text-black/60 hover:bg-black/5 transition-colors"
                aria-label="Settings"
            >
                <Gear size={20} weight="regular" />
            </button>

            <div className="flex items-center gap-2">
                <button type="button" onClick={onOpenLibrary} className="rounded-full bg-black/5 px-3 py-2 text-[13px] font-semibold text-black/70 hover:bg-black/10">收藏夹</button>
                {isEditing && onAutoLayout && (
                    <button
                        type="button"
                        onClick={() => onAutoLayout?.('balanced')}
                        onContextMenu={(event) => { event.preventDefault(); setLayoutsOpen(true) }}
                        className="flex items-center gap-2 rounded-full bg-black/5 px-4 py-2 text-[13px] font-semibold text-black/70 transition hover:bg-black/10"
                        aria-label="Auto layout"
                    >
                        <Shuffle size={16} weight="bold" />
                        自动布局
                    </button>
                )}
                {layoutsOpen && <div className="absolute bottom-full left-10 mb-2 grid grid-cols-2 gap-1 rounded-2xl bg-black/90 p-2 text-xs text-white shadow-xl">
                    {(['compact', 'balanced', 'organic', 'rows', 'columns', 'focus'] as const).map(mode => <button key={mode} className="rounded-lg px-3 py-2 capitalize hover:bg-white/15" onClick={() => { onAutoLayout?.(mode); setLayoutsOpen(false) }}>{mode}</button>)}
                </div>}

                <button
                    type="button"
                    onClick={onToggleEdit}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition ${
                        isEditing
                            ? 'bg-black text-white hover:bg-black/85'
                            : 'bg-black/5 text-black/70 hover:bg-black/10'
                    }`}
                    aria-label={isEditing ? 'Finish editing' : 'Edit page'}
                >
                    {isEditing ? <Check size={16} weight="bold" /> : <PencilSimple size={16} weight="bold" />}
                    {isEditing ? '完成' : '编辑'}
                </button>
            </div>
        </div>
    )
}

export default EditorFooter
