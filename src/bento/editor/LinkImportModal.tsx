'use client'

import { useState } from 'react'
import { createLinkWidgetConfig } from '@/bento/widgets'
import { parseLinkImport, type LinkImportRow } from '@/bento/widgets/link/importLinks'

export function LinkImportModal({ onAdd, onClose }: {
  onAdd: (widget: ReturnType<typeof createLinkWidgetConfig>) => void
  onClose: () => void
}) {
  const [source, setSource] = useState('')
  const [rows, setRows] = useState<LinkImportRow[]>([])
  const [error, setError] = useState('')

  const preview = (input: string) => {
    setSource(input)
    try { setRows(parseLinkImport(input)); setError('') }
    catch (caught) { setRows([]); setError(caught instanceof Error ? caught.message : '无法解析导入内容') }
  }

  return <div className="fixed inset-0 z-[120000] flex items-center justify-center bg-black/35 p-4" onMouseDown={onClose}>
    <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={event => event.stopPropagation()}>
      <h2 className="text-lg font-semibold">批量导入 Link 卡片</h2>
      <p className="mt-2 text-sm text-black/60">CSV 首行须有 url 列；也支持 JSON 对象数组。可选列包括 title、backgroundImage、collection、tags、onCanvas。CSV 的多个标签用分号分隔；onCanvas=false 可只保存到收藏夹。同一平台的多个账号请各写一行。</p>
      <input type="file" accept=".csv,.json,text/csv,application/json" className="mt-4 block text-sm" onChange={async event => {
        const file = event.target.files?.[0]
        if (file) preview(await file.text())
      }} />
      <textarea className="mt-3 h-40 w-full rounded-xl border border-black/15 p-3 font-mono text-xs outline-none focus:border-black/40" value={source} onChange={event => preview(event.target.value)} placeholder={'url,title,subtitle,backgroundImage\nhttps://github.com/user-one,GitHub,账号一,https://example.com/avatar.jpg'} />
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      {rows.length > 0 && <div className="mt-2 max-h-32 overflow-auto rounded-lg bg-black/5 p-3 text-sm">
        <p className="font-medium">准备导入 {rows.length} 张卡片</p>
        {rows.slice(0, 5).map((row, index) => <p key={index} className="truncate text-black/60">{row.title || row.url} · {row.url}</p>)}
        {rows.length > 5 && <p className="text-black/50">还有 {rows.length - 5} 张…</p>}
      </div>}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="rounded-lg px-4 py-2 text-sm hover:bg-black/5" onClick={onClose}>取消</button>
        <button type="button" disabled={!rows.length} className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-40" onClick={() => {
          rows.forEach(row => onAdd(createLinkWidgetConfig(row.url, '1x1', row)))
          onClose()
        }}>导入 {rows.length} 张</button>
      </div>
    </div>
  </div>
}
