'use client'

/**
 * [INPUT]: LinkWidgetConfig, edit selection handler, editing state
 * [OUTPUT]: LinkWidget, createLinkWidgetConfig
 * [POS]: Animated cover/avatar, glass details and size-specific fixed action bar.
 * [PROTOCOL]: Keep this header and /src/bento/widgets/.folder.md in sync with behavior.
 */
import { useState } from 'react'
import { ArrowUpRight, Expand, Minimize } from 'lucide-react'
import { BentoCard } from '@/bento/core'
import { PLATFORM_REGISTRY, extractPlatformInfo } from '../registry'
import type { LinkWidgetConfig, WidgetProps } from '../types'
import styles from './LinkWidget.module.css'

const PLATFORM_ICONS: Record<string, string> = {
    instagram: 'instagram', twitter: 'twitter', youtube: 'youtube', github: 'github',
    linkedin: 'linkedin', discord: 'discord', twitch: 'twitch', behance: 'behance',
    dribbble: 'dribbble', pinterest: 'pinterest', reddit: 'reddit', whatsapp: 'whatsapp',
    medium: 'medium', patreon: 'patreon', buymeacoffee: 'buymeacoffee', dev: 'dev', google: 'google',
}

function LinkIcon({ platform, customIcon }: { platform: string; customIcon?: string }) {
    const fallback = `/icons/social/${PLATFORM_ICONS[platform] || 'unknown'}.svg`
    const icon = customIcon?.trim()
    const isImage = icon && /^(https?:\/\/|data:image\/|blob:|\/)/i.test(icon)
    if (icon && !isImage) return <span className={styles.emoji}>{icon}</span>
    return <img src={isImage ? icon : fallback} alt="" draggable={false}
        onError={event => {
            const image = event.currentTarget
            if (image.getAttribute('src') !== fallback) image.src = fallback
        }} />
}

function getHost(url: string) {
    try { return new URL(url).hostname.replace(/^www\./, '') }
    catch { return '' }
}

export function LinkWidget({ config, onClick, isEditing = false }: WidgetProps<LinkWidgetConfig>) {
    const [hovered, setHovered] = useState(false)
    const [pinned, setPinned] = useState(false)
    const [focused, setFocused] = useState(false)
    const expanded = hovered || pinned || focused
    const platform = config.platform || extractPlatformInfo(config.url).platform
    const platformConfig = PLATFORM_REGISTRY[platform] || PLATFORM_REGISTRY.generic
    const title = config.title || platformConfig.name
    const host = getHost(config.url)
    const tags = [...new Set(config.tags || [])].filter(Boolean).slice(0, 3)
    const category = config.collection || tags[0] || host
    const media = config.backgroundImage?.trim()
    const imageStyle = media ? { backgroundImage: `url(${JSON.stringify(media)})` } : undefined
    const linkEvents = {
        onPointerDown: (event: React.PointerEvent) => { if (!isEditing) event.stopPropagation() },
        onClick: (event: React.MouseEvent) => { if (!isEditing) event.stopPropagation() },
        onDoubleClick: (event: React.MouseEvent) => { if (!isEditing) event.stopPropagation() },
    }

    return <BentoCard size={config.size} disableHover onClick={isEditing ? onClick : undefined}
        style={{ padding: 0, position: 'relative', overflow: 'hidden', border: 'none', background: '#e5ebf4' }}>
        <div className={styles.card} data-size={config.size} data-expanded={expanded}
            onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
            onFocusCapture={() => { if (!isEditing) setFocused(true) }}
            onBlurCapture={event => {
                if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
            }}>
            <div className={styles.ambient} style={imageStyle} aria-hidden="true" />
            <div className={styles.media} style={imageStyle} aria-hidden="true">
                {!media && <div className={styles.mediaFallback}><LinkIcon platform={platform} customIcon={config.customIcon} /></div>}
            </div>
            <div className={styles.top}>
                {category && <span className={styles.category} title={category}>{category}</span>}
                <button type="button" className={styles.detail} disabled={isEditing}
                    aria-label={pinned ? '收起链接详情' : '展开链接详情'} aria-expanded={expanded}
                    onPointerDown={event => { if (!isEditing) event.stopPropagation() }}
                    onDoubleClick={event => event.stopPropagation()}
                    onClick={event => { event.stopPropagation(); setPinned(value => !value) }}>
                    {expanded ? <Minimize size={13} /> : <Expand size={13} />}
                </button>
            </div>
            <div className={styles.sheet}>
                <div className={styles.content} aria-hidden={!expanded}>
                    <div className={styles.heading}>
                        {config.collection && <span className={styles.eyebrow}>{config.collection}</span>}
                        <h3 className={styles.title} title={title}>{title}</h3>
                        {host && <span className={styles.domain} title={host}>{host}</span>}
                    </div>
                    {config.subtitle && <p className={styles.description} title={config.subtitle}>{config.subtitle}</p>}
                    {tags.length > 0 && <div className={styles.tags}>
                        {tags.map(tag => <span key={tag} title={tag}>{tag}</span>)}
                    </div>}
                </div>
                <div className={styles.actions}>
                    <div className={styles.iconZone}>
                        <a className={styles.icon} href={isEditing ? undefined : config.iconUrl || config.url}
                            target="_blank" rel="noopener noreferrer" tabIndex={isEditing ? -1 : undefined}
                            aria-label={`打开${title}图标链接`} aria-disabled={isEditing || undefined} {...linkEvents}>
                            <LinkIcon platform={platform} customIcon={config.customIcon} />
                        </a>
                    </div>
                    <div className={styles.visitZone}>
                        <a className={styles.visit} href={isEditing ? undefined : config.url}
                            target="_blank" rel="noopener noreferrer" tabIndex={isEditing ? -1 : undefined}
                            aria-label={`${config.ctaLabel || platformConfig.ctaLabel || 'Visit'}：${title}`}
                            aria-disabled={isEditing || undefined} {...linkEvents}>
                            <span>{config.ctaLabel || platformConfig.ctaLabel || 'Visit'}</span><ArrowUpRight size={13} aria-hidden="true" />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </BentoCard>
}

export function createLinkWidgetConfig(url: string, size: LinkWidgetConfig['size'] = '1x1', overrides?: Partial<LinkWidgetConfig>): LinkWidgetConfig {
    const info = extractPlatformInfo(url)
    return { id: `link-${crypto.randomUUID()}`, category: 'link', size, url, platform: info.platform,
        title: info.title, subtitle: info.subtitle, ctaLabel: info.ctaLabel, ...overrides }
}

export default LinkWidget
