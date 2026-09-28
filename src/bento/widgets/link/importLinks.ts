export type LinkImportRow = {
  url: string
  title?: string
  subtitle?: string
  ctaLabel?: string
  backgroundImage?: string
  customIcon?: string
  menuBg?: string
  collection?: string
  tags?: string[]
  onCanvas?: boolean
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (quoted && line[i + 1] === '"') { cell += '"'; i++ }
      else quoted = !quoted
    } else if (line[i] === ',' && !quoted) {
      cells.push(cell.trim()); cell = ''
    } else cell += line[i]
  }
  if (quoted) throw new Error('CSV 引号未闭合')
  cells.push(cell.trim())
  return cells
}

function normalizeRow(value: unknown, index: number): LinkImportRow {
  if (!value || typeof value !== 'object') throw new Error(`第 ${index} 行不是链接对象`)
  const row = value as Record<string, unknown>
  if (typeof row.url !== 'string') throw new Error(`第 ${index} 行缺少 url`)
  let url: URL
  try { url = new URL(row.url.trim()) } catch { throw new Error(`第 ${index} 行 URL 无效`) }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`第 ${index} 行只支持 HTTP/HTTPS`)
  const result: LinkImportRow = { url: url.toString() }
  for (const key of ['title', 'subtitle', 'ctaLabel', 'backgroundImage', 'customIcon', 'menuBg', 'collection'] as const) {
    if (row[key] === undefined || row[key] === '') continue
    if (typeof row[key] !== 'string') throw new Error(`第 ${index} 行 ${key} 必须是文字`)
    result[key] = row[key]
  }
  if (row.tags !== undefined && row.tags !== '') {
    const values = Array.isArray(row.tags) ? row.tags : typeof row.tags === 'string' ? row.tags.split(';') : null
    if (!values || values.some(value => typeof value !== 'string')) throw new Error(`第 ${index} 行 tags 必须是文字或文字数组`)
    result.tags = [...new Set(values.map(value => value.trim().slice(0, 32)).filter(Boolean))].slice(0, 12)
  }
  if (row.onCanvas !== undefined && row.onCanvas !== '') {
    if (![true, false, 'true', 'false'].includes(row.onCanvas as boolean | string)) throw new Error(`第 ${index} 行 onCanvas 须为 true 或 false`)
    result.onCanvas = row.onCanvas === true || row.onCanvas === 'true'
  }
  return result
}

export function parseLinkImport(input: string): LinkImportRow[] {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('请粘贴 CSV 或 JSON 内容')
  let rows: unknown[]
  if (trimmed.startsWith('[')) {
    let parsed: unknown
    try { parsed = JSON.parse(trimmed) } catch { throw new Error('JSON 格式无效') }
    if (!Array.isArray(parsed)) throw new Error('JSON 须为链接对象数组')
    rows = parsed
  } else {
    const lines = trimmed.split(/\r?\n/).filter(line => line.trim())
    const headers = parseCsvLine(lines[0]).map(header => header.trim())
    if (!headers.includes('url')) throw new Error('CSV 第一行须包含 url 列')
    rows = lines.slice(1).map((line, index) => {
      const cells = parseCsvLine(line)
      if (cells.length !== headers.length) throw new Error(`第 ${index + 2} 行列数不一致`)
      return Object.fromEntries(headers.map((header, i) => [header, cells[i]]))
    })
  }
  if (!rows.length) throw new Error('没有可导入的链接')
  if (rows.length > 200) throw new Error('每次最多导入 200 条链接')
  return rows.map((row, index) => normalizeRow(row, index + 1))
}
