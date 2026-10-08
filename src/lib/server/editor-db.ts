import 'server-only'

import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { DEFAULT_GLOBAL_SETTINGS, normalizeGlobalSettings, type GlobalSettings } from '@/bento/editor/globalSettings'

export interface EditorSnapshot {
  widgets: unknown[]
  profile: { name: string; description: string; avatarUrl?: string }
  siteSettings?: {
    quickNav?: { id?: string; label: string; url: string }[]
  }
}

export interface StoredEditor extends EditorSnapshot {
  revision: number
  updatedAt: string
}

let database: DatabaseSync | undefined

function normalizeWidgets(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((widget) => {
    if (!widget || typeof widget !== 'object') return widget
    const data = widget as Record<string, unknown>
    // Vaultwarden source identities belong in the private mapping table, never
    // in the public editor snapshot returned to visitors.
    const { vaultwardenSource: _privateSource, ...publicData } = data
    void _privateSource
    return data.size === 'bar' ? { ...publicData, size: '2x1' } : publicData
  })
}

export interface EditorVersion { id: number; space: string; revision: number; action: string; snapshot: EditorSnapshot; createdAt: string }

function getDatabase() {
  if (database) return database
  const file = resolve(process.env.ATCHOOO_DB_PATH || process.env.ACCOUNT_HUB_DB_PATH || '/app/data/atchooo-space.sqlite')
  mkdirSync(dirname(file), { recursive: true })
  database = new DatabaseSync(file)
  database.exec('PRAGMA journal_mode = WAL')
  database.exec('PRAGMA busy_timeout = 5000')
  database.exec(`
    CREATE TABLE IF NOT EXISTS editor_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      revision INTEGER NOT NULL,
      snapshot TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  database.exec(`
    CREATE TABLE IF NOT EXISTS editor_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      space TEXT NOT NULL,
      revision INTEGER NOT NULL,
      action TEXT NOT NULL DEFAULT 'Changed canvas',
      snapshot TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS editor_versions_space_created ON editor_versions(space, created_at DESC);
    CREATE TABLE IF NOT EXISTS hub_entities (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      data TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS custom_spaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      label TEXT NOT NULL,
      position INTEGER NOT NULL,
      visible INTEGER NOT NULL DEFAULT 1,
      config TEXT NOT NULL DEFAULT '{}'
    )
  `)
  database.exec(`
    CREATE TABLE IF NOT EXISTS editor_spaces (
      space TEXT PRIMARY KEY,
      revision INTEGER NOT NULL,
      snapshot TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  database.exec(`
    CREATE TABLE IF NOT EXISTS global_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      revision INTEGER NOT NULL,
      settings TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  database.exec(`
    CREATE TABLE IF NOT EXISTS vaultwarden_link_sources (
      item_id TEXT NOT NULL,
      uri_index INTEGER NOT NULL,
      widget_id TEXT NOT NULL,
      source_title TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (item_id, uri_index)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS vaultwarden_link_sources_widget
      ON vaultwarden_link_sources(widget_id)
  `)
  return database
}

export type VaultwardenLinkSource = {
  itemId: string
  uriIndex: number
  widgetId: string
  sourceTitle: string
}

export function readVaultwardenLinkSources(): VaultwardenLinkSource[] {
  const rows = getDatabase().prepare(`SELECT item_id, uri_index, widget_id, source_title
    FROM vaultwarden_link_sources`).all() as {
      item_id: string; uri_index: number; widget_id: string; source_title: string
    }[]
  return rows.map(row => ({ itemId: row.item_id, uriIndex: row.uri_index,
    widgetId: row.widget_id, sourceTitle: row.source_title }))
}

export function saveVaultwardenLinkSources(sources: VaultwardenLinkSource[]) {
  if (!sources.length) return
  const db = getDatabase()
  const statement = db.prepare(`INSERT INTO vaultwarden_link_sources
    (item_id, uri_index, widget_id, source_title, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(item_id, uri_index) DO UPDATE SET widget_id = excluded.widget_id,
    source_title = excluded.source_title, updated_at = excluded.updated_at`)
  const updatedAt = new Date().toISOString()
  db.exec('BEGIN IMMEDIATE')
  try {
    for (const source of sources) statement.run(source.itemId, source.uriIndex, source.widgetId, source.sourceTitle, updatedAt)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export type StoredGlobalSettings = {
  settings: GlobalSettings
  revision: number
  updatedAt: string | null
}

export function readGlobalSettings(): StoredGlobalSettings {
  const row = getDatabase().prepare('SELECT revision, settings, updated_at FROM global_settings WHERE id = 1').get() as
    | { revision: number; settings: string; updated_at: string }
    | undefined
  return row
    ? { settings: normalizeGlobalSettings(JSON.parse(row.settings)), revision: row.revision, updatedAt: row.updated_at }
    : { settings: DEFAULT_GLOBAL_SETTINGS, revision: 0, updatedAt: null }
}

export function saveGlobalSettings(value: GlobalSettings, expectedRevision: number): StoredGlobalSettings | 'conflict' {
  const db = getDatabase()
  db.exec('BEGIN IMMEDIATE')
  try {
    const row = db.prepare('SELECT revision FROM global_settings WHERE id = 1').get() as { revision: number } | undefined
    if ((row?.revision ?? 0) !== expectedRevision) {
      db.exec('ROLLBACK')
      return 'conflict'
    }
    const revision = expectedRevision + 1
    const updatedAt = new Date().toISOString()
    const settings = normalizeGlobalSettings(value)
    db.prepare(`INSERT INTO global_settings (id, revision, settings, updated_at)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET revision = excluded.revision,
      settings = excluded.settings, updated_at = excluded.updated_at`)
      .run(revision, JSON.stringify(settings), updatedAt)
    db.exec('COMMIT')
    return { settings, revision, updatedAt }
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function readEditor(space = 'home'): StoredEditor | null {
  const row = space === 'home'
    ? getDatabase().prepare('SELECT revision, snapshot, updated_at FROM editor_state WHERE id = 1').get()
    : getDatabase().prepare('SELECT revision, snapshot, updated_at FROM editor_spaces WHERE space = ?').get(space)
  const stored = row as { revision: number; snapshot: string; updated_at: string } | undefined
  if (!stored) return null
  const parsed = JSON.parse(stored.snapshot) as Partial<EditorSnapshot> & { desktopWidgets?: unknown[] }
  const snapshot: EditorSnapshot = {
    widgets: normalizeWidgets(Array.isArray(parsed.widgets) ? parsed.widgets : parsed.desktopWidgets),
    profile: parsed.profile || { name: 'ATCHOOO', description: '' },
    ...(parsed.siteSettings ? { siteSettings: parsed.siteSettings } : {}),
  }
  return { ...snapshot, revision: stored.revision, updatedAt: stored.updated_at }
}

export function saveEditor(snapshot: EditorSnapshot, expectedRevision: number, space = 'home'): StoredEditor | 'conflict' {
  const db = getDatabase()
  db.exec('BEGIN IMMEDIATE')
  try {
    const existing = (space === 'home'
      ? db.prepare('SELECT revision FROM editor_state WHERE id = 1').get()
      : db.prepare('SELECT revision FROM editor_spaces WHERE space = ?').get(space)) as { revision: number } | undefined
    if ((existing?.revision ?? 0) !== expectedRevision) {
      db.exec('ROLLBACK')
      return 'conflict'
    }
    const revision = expectedRevision + 1
    const updatedAt = new Date().toISOString()
    const normalized = { ...snapshot, widgets: normalizeWidgets(snapshot.widgets) }
    if (existing) {
      const previous = readEditor(space)
      if (previous) db.prepare(`INSERT INTO editor_versions (space, revision, action, snapshot, created_at) VALUES (?, ?, ?, ?, ?)`)
        .run(space, previous.revision, 'Changed canvas', JSON.stringify(previous), updatedAt)
    }
    if (space === 'home') {
      db.prepare(`INSERT INTO editor_state (id, revision, snapshot, updated_at)
        VALUES (1, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET revision = excluded.revision,
        snapshot = excluded.snapshot, updated_at = excluded.updated_at`)
        .run(revision, JSON.stringify(normalized), updatedAt)
    } else {
      db.prepare(`INSERT INTO editor_spaces (space, revision, snapshot, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(space) DO UPDATE SET revision = excluded.revision,
        snapshot = excluded.snapshot, updated_at = excluded.updated_at`)
        .run(space, revision, JSON.stringify(normalized), updatedAt)
    }
    db.exec('COMMIT')
    return { ...normalized, revision, updatedAt }
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function listEditorVersions(space = 'home', limit = 30): EditorVersion[] {
  const rows = getDatabase().prepare(`SELECT id, space, revision, action, snapshot, created_at FROM editor_versions WHERE space = ? ORDER BY id DESC LIMIT ?`).all(space, limit) as { id: number; space: string; revision: number; action: string; snapshot: string; created_at: string }[]
  return rows.map(row => ({ id: row.id, space: row.space, revision: row.revision, action: row.action, snapshot: JSON.parse(row.snapshot), createdAt: row.created_at }))
}
