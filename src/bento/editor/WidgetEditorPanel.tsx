'use client'

import { useRef, useState } from 'react'

import type {
    LinkWidgetConfig,
    MapWidgetConfig,
    SectionTitleConfig,
    TextWidgetConfig,
    WidgetConfig,
} from '../widgets/types'
import { ImageEditorModal } from './ImageEditorModal'
import { uploadImage } from '@/lib/client/upload-image'
import { detectPlatform } from '@/bento/widgets/registry'
import { nearbySectionMembers, removeSectionWidgets, setSectionMembers } from './sectionGroups'

interface WidgetEditorPanelProps {
    onPickSectionRange?: (id: string) => void
    widgets?: WidgetConfig[]
    selectedIds?: string[]
    onWidgetsChange?: (widgets: WidgetConfig[]) => void
    widget: WidgetConfig
    onUpdate: (updates: Partial<WidgetConfig>) => void
    onClose: () => void
}

const fieldClass = 'w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-black/40 focus:ring-2 focus:ring-black/5'
const labelClass = 'grid gap-1.5 text-xs font-medium text-black/60'
const btnClassDark = 'rounded-xl bg-black px-3 py-2.5 text-sm font-medium text-white hover:bg-black/80'
const btnGhostClass = 'rounded-xl border border-black/15 px-3 py-2.5 text-sm font-medium text-black hover:bg-black/5'

function OptionalText({ value, onChange, placeholder }: {
    value?: string
    onChange: (value: string | undefined) => void
    placeholder?: string
}) {
    return <input className={fieldClass} value={value || ''} placeholder={placeholder}
        onChange={event => onChange(event.target.value || undefined)} />
}

export function WidgetEditorPanel({ widget, onUpdate, onClose, widgets = [], selectedIds = [], onWidgetsChange, onPickSectionRange }: WidgetEditorPanelProps) {
    if (widget.category === 'image') {
        return (
            <ImageEditorModal
                widget={widget}
                onUpdate={onUpdate}
                onClose={onClose}
            />
        )
    }

    return (
        <aside
            data-widget-editor
            className="fixed inset-x-3 bottom-24 z-[10000] max-h-[62vh] overflow-y-auto rounded-3xl bg-white p-5 text-black shadow-2xl ring-1 ring-black/5 md:inset-x-auto md:bottom-auto md:right-5 md:top-5 md:max-h-[calc(100vh-7rem)] md:w-[360px]"
            onPointerDown={event => event.stopPropagation()}
            onClick={event => event.stopPropagation()}
        >
            <div className="mb-5 flex items-center justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/35">编辑卡片</p>
                    <h2 className="mt-1 text-lg font-semibold capitalize">{widget.category}</h2>
                </div>
                <button type="button" onClick={onClose} aria-label="关闭编辑面板"
                    className="grid size-9 place-items-center rounded-full bg-black/5 text-xl leading-none hover:bg-black/10">×</button>
            </div>

            <div className="grid gap-4">
                {widget.category === 'link' && <LinkFields widget={widget} onUpdate={onUpdate} />}
                {widget.category === 'text' && <TextFields widget={widget} onUpdate={onUpdate} />}
                {widget.category === 'map' && <MapFields widget={widget} onUpdate={onUpdate} />}
                {widget.category === 'section' && <SectionFields key={widget.id} widget={widget} onUpdate={onUpdate} widgets={widgets} selectedIds={selectedIds} onWidgetsChange={onWidgetsChange} onClose={onClose} onPickSectionRange={onPickSectionRange} />}
            </div>
        </aside>
    )
}

function LinkFields({ widget, onUpdate }: { widget: LinkWidgetConfig; onUpdate: WidgetEditorPanelProps['onUpdate'] }) {
    const [status, setStatus] = useState<string | null>(null)
    const fileRef = useRef<HTMLInputElement>(null)

    const uploadBg = async (file?: File) => {
        if (!file) return
        setStatus('上传背景中…')
        try {
            onUpdate({ backgroundImage: await uploadImage(file) })
            setStatus('背景已更新')
        } catch (error) {
            setStatus(error instanceof Error ? error.message : '背景上传失败')
        }
    }

    return <>
        <label className={labelClass}>链接地址
            <input className={fieldClass} type="url" value={widget.url} onChange={event => onUpdate({ url: event.target.value, platform: detectPlatform(event.target.value), linkHealth: undefined })} />
        </label>
        <label className={labelClass}>标题
            <OptionalText value={widget.title} placeholder="自动识别平台名称" onChange={title => onUpdate({ title })} />
        </label>
        <label className={labelClass}>副标题
            <OptionalText value={widget.subtitle} onChange={subtitle => onUpdate({ subtitle })} />
        </label>
        <label className={labelClass}>按钮文字
            <OptionalText value={widget.ctaLabel} onChange={ctaLabel => onUpdate({ ctaLabel })} />
        </label>
        <label className={labelClass}>左下角图标跳转（可选，默认同链接）
            <OptionalText value={widget.iconUrl} placeholder={widget.url} onChange={iconUrl => onUpdate({ iconUrl })} />
        </label>
        <label className={labelClass}>卡片背景图（悬停时缩为左上头像）
            <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={btnClassDark} onClick={() => fileRef.current?.click()}>上传图片</button>
                {widget.backgroundImage && (
                    <button type="button" className={btnGhostClass} onClick={() => { onUpdate({ backgroundImage: undefined }); setStatus(null) }}>清除</button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { void uploadBg(e.target.files?.[0]); e.target.value = '' }} />
            </div>
            {widget.backgroundImage && (
                <img src={widget.backgroundImage} alt="" className="mt-1 h-20 w-full rounded-xl object-cover" />
            )}
            {status && <span className="text-xs font-normal text-black/50">{status}</span>}
        </label>
        <label className={labelClass}>自定义图标（URL 或 Emoji）
            <OptionalText value={widget.customIcon} onChange={customIcon => onUpdate({ customIcon })} />
        </label>
        <label className={labelClass}>收藏夹
            <OptionalText value={widget.collection} placeholder="未分类" onChange={collection => onUpdate({ collection: collection?.trim().slice(0, 64) })} />
        </label>
        <label className={labelClass}>标签（用逗号分隔）
            <input className={fieldClass} defaultValue={(widget.tags || []).join(', ')} onBlur={event => onUpdate({ tags: [...new Set(event.target.value.split(',').map(value => value.trim().slice(0, 32)).filter(Boolean))].slice(0, 12) })} />
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-black/60">
            <input type="checkbox" checked={widget.onCanvas !== false} onChange={event => onUpdate(event.target.checked ? { onCanvas: true, x: undefined, y: undefined } : { onCanvas: false })} />
            显示在画布上
        </label>
    </>
}

function TextFields({ widget, onUpdate }: { widget: TextWidgetConfig; onUpdate: WidgetEditorPanelProps['onUpdate'] }) {
    return <>
        <label className={labelClass}>文本内容
            <textarea className={`${fieldClass} min-h-28 resize-y`} value={widget.content}
                onChange={event => onUpdate({ content: event.target.value })} />
        </label>
        <label className={labelClass}>样式
            <select className={fieldClass} value={widget.variant}
                onChange={event => onUpdate({ variant: event.target.value as TextWidgetConfig['variant'] })}>
                <option value="plain">普通文本</option>
                <option value="note">便签</option>
                <option value="quote">引用</option>
            </select>
        </label>
        {widget.variant === 'quote' && <label className={labelClass}>署名
            <OptionalText value={widget.attribution} onChange={attribution => onUpdate({ attribution })} />
        </label>}
        {widget.variant === 'note' && <label className={labelClass}>Emoji
            <OptionalText value={widget.emoji} onChange={emoji => onUpdate({ emoji })} />
        </label>}
    </>
}

function parseNumberInput(raw: string): number | null {
    if (raw.trim() === '' || raw.trim() === '-') return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
}

function MapFields({ widget, onUpdate }: { widget: MapWidgetConfig; onUpdate: WidgetEditorPanelProps['onUpdate'] }) {
    const location = widget.location
    const updateLocation = (patch: Partial<NonNullable<MapWidgetConfig['location']>>) => {
        const next = {
            lat: typeof location?.lat === 'number' ? location.lat : 0,
            lng: typeof location?.lng === 'number' ? location.lng : 0,
            ...location,
            ...patch,
        }
        if (typeof next.lat === 'number') next.lat = Math.max(-90, Math.min(90, next.lat))
        if (typeof next.lng === 'number') next.lng = Math.max(-180, Math.min(180, next.lng))
        onUpdate({ location: next })
    }

    return <>
        <label className={labelClass}>标题
            <OptionalText value={widget.title} onChange={title => onUpdate({ title })} />
        </label>
        <label className={labelClass}>位置标签
            <OptionalText value={location?.label} onChange={label => updateLocation({ label })} />
        </label>
        <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>纬度
                <input className={fieldClass} type="number" step="any" value={location?.lat ?? ''}
                    onChange={event => {
                        const lat = parseNumberInput(event.target.value)
                        if (lat === null) return
                        updateLocation({ lat })
                    }} />
            </label>
            <label className={labelClass}>经度
                <input className={fieldClass} type="number" step="any" value={location?.lng ?? ''}
                    onChange={event => {
                        const lng = parseNumberInput(event.target.value)
                        if (lng === null) return
                        updateLocation({ lng })
                    }} />
            </label>
        </div>
        <label className={labelClass}>缩放级别
            <input className={fieldClass} type="range" min="1" max="20" value={widget.zoom || 11}
                onChange={event => onUpdate({ zoom: Number(event.target.value) })} />
            <span className="text-right text-xs text-black/40">{widget.zoom || 11}</span>
        </label>
        <label className={labelClass}>地图样式
            <select className={fieldClass} value={widget.style || 'light'}
                onChange={event => onUpdate({ style: event.target.value as MapWidgetConfig['style'] })}>
                <option value="light">浅色</option>
                <option value="dark">深色</option>
                <option value="satellite">卫星</option>
            </select>
        </label>
    </>
}

function SectionFields({ widget, onUpdate, widgets, selectedIds, onWidgetsChange, onClose, onPickSectionRange }: { widget: SectionTitleConfig; onUpdate: WidgetEditorPanelProps['onUpdate']; widgets: WidgetConfig[]; selectedIds: string[]; onWidgetsChange?: (widgets: WidgetConfig[]) => void; onClose: () => void; onPickSectionRange?: (id: string) => void }) {
    const [tab, setTab] = useState('content')
    const [draft, setDraft] = useState<string[] | null>(null)
    const [columns, setColumns] = useState(6)
    const [rows, setRows] = useState(6)
    const fileRef = useRef<HTMLInputElement>(null)
    const [uploadStatus, setUploadStatus] = useState('')
    const members = widgets.filter(w => w.groupId === widget.id).map(w => w.id)
    const chosen = draft ?? members
    const select = (label: string, value: string, options: [string, string][], change: (value: string) => void) => <label className={labelClass}>{label}<select className={fieldClass} value={value} onChange={e => change(e.target.value)}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
    return <>
        <div className="flex gap-2">{[['content', '内容'], ['style', '样式'], ['group', `分组 (${members.length})`]].map(([key, text]) => <button key={key} type="button" className={tab === key ? btnClassDark : btnGhostClass} onClick={() => setTab(key)}>{text}</button>)}</div>
        {tab === 'content' && <>
            <label className={labelClass}>主标题（支持换行）<textarea rows={3} className={fieldClass} value={widget.title} onChange={e => onUpdate({ title: e.target.value })} /></label>
            <label className={labelClass}>副标题<textarea rows={3} className={fieldClass} value={widget.subtitle || ''} onChange={e => onUpdate({ subtitle: e.target.value })} /></label>
            <label className={labelClass}>图标（Emoji 或图片 URL）<OptionalText value={widget.icon} onChange={icon => onUpdate({ icon })} /></label>
            <div className="flex flex-wrap gap-2">{['📁', '⭐', '📌', '📚', '🎨', '🔗'].map(icon => <button key={icon} type="button" className={btnGhostClass} onClick={() => onUpdate({ icon })}>{icon}</button>)}</div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={async e => {
                const file = e.target.files?.[0]; if (!file) return
                setUploadStatus('上传中…')
                try { onUpdate({ icon: await uploadImage(file) }); setUploadStatus('图标已更新') } catch { setUploadStatus('上传失败，请重试') }
                e.target.value = ''
            }} />
            <button type="button" className={btnGhostClass} onClick={() => fileRef.current?.click()}>上传图标</button>{uploadStatus && <p className="text-xs">{uploadStatus}</p>}
            <label className={labelClass}>链接（http / https）<OptionalText value={widget.url} onChange={url => onUpdate({ url })} placeholder="https://…" /></label>
        </>}
        {tab === 'style' && <>
            {select('字体', widget.fontFamily || 'system', [['system', '系统默认'], ['sans', '无衬线'], ['serif', '衬线'], ['mono', '等宽']], value => onUpdate({ fontFamily: value as SectionTitleConfig['fontFamily'] }))}
            {select('字重', String(widget.fontWeight || 500), [['400', '常规'], ['500', '中等'], ['700', '加粗']], value => onUpdate({ fontWeight: Number(value) as SectionTitleConfig['fontWeight'] }))}
            <label className={labelClass}>标题字号：{widget.fontSize ?? 16}px<input type="range" min={12} max={96} value={widget.fontSize ?? 16} onChange={e => onUpdate({ fontSize: Number(e.target.value) })} /></label>
            <label className={labelClass}>副标题字号：{widget.subtitleSize ?? 13}px<input type="range" min={10} max={48} value={widget.subtitleSize ?? 13} onChange={e => onUpdate({ subtitleSize: Number(e.target.value) })} /></label>
            <div className="grid grid-cols-2 gap-3"><label className={labelClass}>标题颜色<input type="color" value={widget.color || '#1a1a1a'} onChange={e => onUpdate({ color: e.target.value })} /></label><label className={labelClass}>副标题颜色<input type="color" value={widget.subtitleColor || '#6b7280'} onChange={e => onUpdate({ subtitleColor: e.target.value })} /></label></div>
            {select('水平对齐', widget.align || 'left', [['left', '左对齐'], ['center', '居中'], ['right', '右对齐']], value => onUpdate({ align: value as SectionTitleConfig['align'] }))}
            {select('垂直对齐', widget.verticalAlign || 'center', [['top', '顶部'], ['center', '居中'], ['bottom', '底部']], value => onUpdate({ verticalAlign: value as SectionTitleConfig['verticalAlign'] }))}
            {select('背景', widget.background || 'transparent', [['transparent', '透明'], ['solid', '纯色'], ['glass', '磨砂玻璃']], value => onUpdate({ background: value as SectionTitleConfig['background'] }))}
            {widget.background && widget.background !== 'transparent' && <><label className={labelClass}>背景色<input type="color" value={widget.backgroundColor || '#ffffff'} onChange={e => onUpdate({ backgroundColor: e.target.value })} /></label><label className={labelClass}>背景透明度<input type="range" min={0} max={1} step={.05} value={widget.backgroundOpacity ?? (widget.background === 'glass' ? .65 : 1)} onChange={e => onUpdate({ backgroundOpacity: Number(e.target.value) })} /></label></>}
        </>}
        {tab === 'group' && <>
            <p className="text-xs leading-5 text-black/50">成员仅属于一个分区。勾选其他分区成员会转移归属；标题不能嵌套。修改成员后点击确认。</p>
            <button type="button" className={btnGhostClass} onClick={() => setDraft([...new Set([...chosen, ...selectedIds])])}>加入当前多选卡片</button>
            <button type="button" className={btnGhostClass} onClick={() => { onPickSectionRange?.(widget.id); onClose() }}>在画布拖框选择成员…</button>
            <div className="grid grid-cols-2 gap-2"><label className={labelClass}>下方范围宽（格）<input type="number" min={1} max={50} className={fieldClass} value={columns} onChange={e => setColumns(Math.max(1, Math.min(50, Number(e.target.value))))} /></label><label className={labelClass}>下方范围高（格）<input type="number" min={1} max={50} className={fieldClass} value={rows} onChange={e => setRows(Math.max(1, Math.min(50, Number(e.target.value))))} /></label></div>
            <button type="button" className={btnGhostClass} onClick={() => setDraft([...new Set([...members, ...nearbySectionMembers(widgets, widget.id, columns, rows)])])}>预选下方范围内卡片</button>
            <div className="max-h-60 space-y-2 overflow-y-auto">{widgets.filter(w => w.category !== 'section' && !(w.category === 'link' && w.onCanvas === false)).map(w => <label key={w.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={chosen.includes(w.id)} onChange={e => setDraft(e.target.checked ? [...chosen, w.id] : chosen.filter(id => id !== w.id))} /><span className="truncate">{'title' in w && w.title || w.category} {w.groupId && w.groupId !== widget.id ? '（其他分区）' : ''}</span></label>)}</div>
            <button type="button" className={btnClassDark} onClick={() => { onWidgetsChange?.(setSectionMembers(widgets, widget.id, chosen)); setDraft(null) }}>确认成员 ({chosen.filter(id => widgets.some(w => w.id === id && w.category !== 'section')).length})</button>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!widget.collapsed} onChange={e => onUpdate({ collapsed: e.target.checked })} />默认折叠（保存到 NAS）</label>
            <p className="text-xs text-black/45">折叠保留成员占位；访客展开/收起不会修改共享数据。</p>
            <button type="button" className={btnGhostClass} onClick={() => { onWidgetsChange?.(setSectionMembers(widgets, widget.id, [])); setDraft(null) }}>解散分组，保留所有卡片</button>
            <button type="button" className="rounded-xl bg-red-50 p-3 text-sm text-red-700" onClick={() => { if (window.confirm('删除标题和该分区全部成员？此操作可撤销。')) { onWidgetsChange?.(removeSectionWidgets(widgets, [widget.id, ...members])); onClose() } }}>删除整个分区</button>
        </>}
    </>
}
