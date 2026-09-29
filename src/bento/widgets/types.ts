/**
 * OpenBento - Widget Types
 * 
 * Widget 系统核心类型定义
 */

// ============ Widget 尺寸 ============

export type WidgetSize = '1x1' | '2x1' | '1x2' | '2x2'

export const WIDGET_SIZES = {
    '1x1': { cols: 1, rows: 1, width: 175, height: 175, label: 'Small' },
    '2x1': { cols: 2, rows: 1, width: 390, height: 175, label: 'Wide' },
    '1x2': { cols: 1, rows: 2, width: 175, height: 390, label: 'Tall' },
    '2x2': { cols: 2, rows: 2, width: 390, height: 390, label: 'Large' },
} as const

// Size variants array (for size picker UI)
export const SIZE_VARIANTS: WidgetSize[] = ['1x1', '2x1', '1x2', '2x2']



// ============ Widget Categories ============

export type WidgetCategory = 'link' | 'image' | 'text' | 'map' | 'section'

// ============ Platform Types ============

export type SocialPlatform =
    | 'instagram'
    | 'twitter'
    | 'tiktok'
    | 'youtube'
    | 'spotify'
    | 'github'
    | 'linkedin'
    | 'facebook'
    | 'pinterest'
    | 'threads'
    | 'discord'
    | 'telegram'
    | 'twitch'
    | 'behance'
    | 'dribbble'
    | 'medium'
    | 'whatsapp'
    | 'reddit'
    | 'patreon'
    | 'buymeacoffee'
    | 'dev'
    | 'google'
    | 'appstore'
    | 'playstore'
    | 'generic' // Unrecognized link

// ============ Base Widget Config ============

export interface BaseWidgetConfig {
    id: string
    category: WidgetCategory
    size: WidgetSize
    /** Grid column origin on infinite canvas (search box occupies 0..3, row 0) */
    x?: number
    /** Grid row origin on infinite canvas */
    y?: number
    entityId?: string
    locked?: boolean
    hidden?: boolean
    variantKey?: string
}

// ============ Link Widget ============

export interface LinkWidgetConfig extends BaseWidgetConfig {
    category: 'link'
    url: string
    platform: SocialPlatform
    title?: string
    subtitle?: string // handle, description
    ctaLabel?: string // Follow, Get, Listen, etc.
    customIcon?: string // URL or emoji
    customColor?: string // Card face / media fallback color
    /** Separate URL for the bottom-left icon (defaults to url) */
    iconUrl?: string
    /** Bottom menu / panel background color */
    menuBg?: string
    /** Full-card background image (uploaded WebP or remote URL) */
    backgroundImage?: string
    /** Collection and tags are shared concepts across the four Spaces. */
    collection?: string
    tags?: string[]
    /** A saved link can remain in the library without occupying the canvas. */
    onCanvas?: boolean
    linkHealth?: {
        status: 'ok' | 'redirected' | 'broken' | 'unknown'
        checkedAt: string
        httpStatus?: number
        finalUrl?: string
        error?: string
    }
    vaultwardenSource?: { itemId: string; uriIndex: number; sourceTitle: string }
}

// ============ Image Widget ============

export interface GalleryImage {
    id: string
    src: string
    /** Missing on legacy snapshots; defaults to a static image. */
    type?: 'image' | 'live-photo' | 'video'
    /** H.264/AAC MP4 used by Live Photos and videos. */
    videoSrc?: string
    duration?: number
    alt?: string
}

export type ImageCoverMode = 'fixed' | 'random'

export type CoverEffect =
    | 'crossfade'
    | 'blur'
    | 'drift'
    | 'kenburns'
    | 'reveal'
    | 'shutter'
    | 'random'

export const GALLERY_MAX_IMAGES = 9
export const DEFAULT_COVER_INTERVAL_MS = 15_000
export const DEFAULT_COVER_EFFECT: CoverEffect = 'crossfade'
/** Hover-tour dwell for still photos before advancing. */
export const TOUR_PHOTO_DWELL_MS = 2_000
/** Hover-tour cap so long videos cannot stall the gallery. */
export const TOUR_VIDEO_MAX_MS = 5000
/** Delay before hover preview / tour starts. */
export const HOVER_PREVIEW_DELAY_MS = 300

export const COVER_EFFECT_OPTIONS: { value: CoverEffect; label: string }[] = [
    { value: 'crossfade', label: '柔和缩放 + Crossfade（默认）' },
    { value: 'blur', label: '景深模糊对焦' },
    { value: 'drift', label: '轻微方向漂移' },
    { value: 'kenburns', label: 'Ken Burns 微镜头' },
    { value: 'reveal', label: '遮罩 Reveal' },
    { value: 'shutter', label: '快门闪光' },
    { value: 'random', label: '每次随机特效' },
]

export interface ImageWidgetConfig extends BaseWidgetConfig {
    category: 'image'
    /** Legacy single-image field; kept in sync with the active cover */
    src: string
    images?: GalleryImage[]
    coverMode?: ImageCoverMode
    coverId?: string
    coverIntervalMs?: number
    coverEffect?: CoverEffect
    alt?: string
    title?: string
    subtitle?: string
    objectFit?: 'cover' | 'contain'
}

// ============ Text Widget ============

export type TextWidgetVariant = 'quote' | 'note' | 'plain'

export interface TextWidgetConfig extends BaseWidgetConfig {
    category: 'text'
    variant: TextWidgetVariant
    content: string
    attribution?: string // Quote attribution
    emoji?: string // Custom emoji for note variant (default: 📝)
}

// ============ Map Widget ============

export interface MapWidgetConfig extends BaseWidgetConfig {
    category: 'map'
    title?: string
    location?: {
        lat: number
        lng: number
        label?: string
    }
    zoom?: number // Map zoom level (default: 11)
    style?: 'light' | 'dark' | 'satellite'
}

// ============ Section Title Widget ============

export interface SectionTitleConfig extends BaseWidgetConfig {
    category: 'section'
    title: string
}

// ============ Union Type ============

export type WidgetConfig =
    | LinkWidgetConfig
    | ImageWidgetConfig
    | TextWidgetConfig
    | MapWidgetConfig
    | SectionTitleConfig

// ============ Widget Props ============

export interface WidgetProps<T extends WidgetConfig = WidgetConfig> {
    config: T
    isEditing?: boolean
    onConfigChange?: (config: Partial<T>) => void
    onClick?: () => void
}
