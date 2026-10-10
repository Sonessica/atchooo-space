'use client'

/** Styled multi-line section heading. Canvas owns membership and visibility. */
import { ChevronDown, ChevronRight, ArrowUpRight, GripVertical } from 'lucide-react'
import type { SectionTitleConfig, WidgetProps } from '../types'

const fonts = {
    system: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
    sans: 'Arial, "Microsoft YaHei", sans-serif',
    serif: 'Georgia, "Songti SC", SimSun, serif',
    mono: 'ui-monospace, Consolas, monospace',
}

export function SectionTitleWidget({ config, isEditing = false, groupCount = 0, groupCollapsed, onToggleGroup }: WidgetProps<SectionTitleConfig>) {
    const collapsed = groupCollapsed ?? config.collapsed ?? false
    const imageIcon = config.icon && /^(https?:\/\/|\/|data:image\/)/i.test(config.icon)
    const align = config.align || 'left'
    const background = config.background || 'transparent'
    return <section style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 24, overflow: 'hidden', color: config.color || '#1a1a1a', fontFamily: fonts[config.fontFamily || 'system'] }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: background === 'transparent' ? 'transparent' : config.backgroundColor || '#ffffff', opacity: Math.max(0, Math.min(1, config.backgroundOpacity ?? (background === 'glass' ? .65 : 1))), borderRadius: 'inherit' }} />
        {background === 'glass' && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, backdropFilter: 'blur(22px) saturate(140%)', WebkitBackdropFilter: 'blur(22px) saturate(140%)', border: '1px solid rgba(255,255,255,.45)', borderRadius: 'inherit', pointerEvents: 'none' }} />}
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: config.verticalAlign === 'top' ? 'flex-start' : config.verticalAlign === 'bottom' ? 'flex-end' : 'center', alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start', gap: 10, padding: '42px 18px 18px', textAlign: align, overflow: 'hidden' }}>
            {config.icon && (imageIcon ? <img src={config.icon} alt="" draggable={false} style={{ width: 34, height: 34, objectFit: 'contain', flexShrink: 0 }} /> : <span aria-hidden="true" style={{ fontSize: 30, lineHeight: 1.2 }}>{config.icon}</span>)}
            <h2 style={{ margin: 0, width: '100%', fontSize: Math.max(12, Math.min(96, config.fontSize ?? 16)), fontWeight: config.fontWeight || 500, lineHeight: 1.2, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: config.size === '1x1' || config.size === '2x1' ? 2 : 5, overflow: 'hidden', flexShrink: 1 }}>{config.title || (isEditing ? '添加标题…' : '')}</h2>
            {config.subtitle && <p style={{ margin: 0, width: '100%', fontSize: Math.max(10, Math.min(48, config.subtitleSize ?? 13)), lineHeight: 1.5, color: config.subtitleColor || '#6b7280', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: config.size === '1x1' || config.size === '2x1' ? 2 : 6, overflow: 'hidden', minHeight: 0, flexShrink: 2 }}>{config.subtitle}</p>}
        </div>
        <div style={{ position: 'absolute', top: 10, left: 12, right: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            {isEditing && <span data-section-drag title="拖动标题，移动整个分区" aria-label="拖动整个分区" style={{ cursor: 'grab', display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 8, background: 'rgba(128,128,128,.1)' }}><GripVertical size={16} /></span>}
            {groupCount > 0 && <button type="button" data-section-control onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onToggleGroup?.() }} aria-expanded={!collapsed} title={collapsed ? '展开分区' : '折叠分区'} style={{ display: 'flex', alignItems: 'center', gap: 4, border: 0, borderRadius: 99, padding: '4px 8px', background: 'rgba(128,128,128,.12)', color: 'inherit', cursor: 'pointer', fontSize: 11 }}>{collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}{groupCount}</button>}
            {config.url && /^(https?:\/\/)/i.test(config.url) && <a href={isEditing ? undefined : config.url} tabIndex={isEditing ? -1 : undefined} target="_blank" rel="noopener noreferrer" data-section-control aria-label="打开分区链接" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} style={{ marginLeft: 'auto', display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: '50%', background: 'rgba(128,128,128,.1)', color: 'inherit' }}><ArrowUpRight size={15} /></a>}
        </div>
    </section>
}

export function createSectionTitleConfig(title: string, size: SectionTitleConfig['size'] = '2x1'): SectionTitleConfig {
    return { id: `section-${crypto.randomUUID()}`, category: 'section', size, title }
}
export default SectionTitleWidget
