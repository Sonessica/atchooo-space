import type { WidgetConfig } from '../widgets/types'

/** Never allow nested groups, orphan ownership, or off-canvas links as members. */
export function setSectionMembers(widgets: WidgetConfig[], sectionId: string, ids: string[]) {
  if (!widgets.some(w => w.id === sectionId && w.category === 'section')) return widgets
  const selected = new Set(ids)
  return widgets.map(w => {
    if (w.category === 'section' || (w.category === 'link' && w.onCanvas === false)) return w
    if (selected.has(w.id)) return { ...w, groupId: sectionId }
    return w.groupId === sectionId ? { ...w, groupId: undefined } : w
  })
}

export function removeSectionWidgets(widgets: WidgetConfig[], ids: string[]) {
  const removed = new Set(ids)
  return widgets.filter(w => !removed.has(w.id)).map(w => w.groupId && removed.has(w.groupId) ? { ...w, groupId: undefined } : w)
}

export function sectionMoveIds(widgets: WidgetConfig[], id: string) {
  const header = widgets.find(w => w.id === id)
  return new Set(widgets.filter(w => w.id === id || (header?.category === 'section' && w.groupId === id && !(w.category === 'link' && w.onCanvas === false))).map(w => w.id))
}

export function nearbySectionMembers(widgets: WidgetConfig[], id: string, columns: number, rows: number) {
  const title = widgets.find(w => w.id === id)
  if (!title) return []
  const x = title.x ?? 0, y = (title.y ?? 0) + Number(title.size.split('x')[1])
  return widgets.filter(w => {
    if (w.category === 'section' || (w.groupId && w.groupId !== id) || (w.category === 'link' && w.onCanvas === false)) return false
    const [width, height] = w.size.split('x').map(Number)
    return (w.x ?? 0) >= x && (w.y ?? 0) >= y && (w.x ?? 0) + width <= x + columns && (w.y ?? 0) + height <= y + rows
  }).map(w => w.id)
}

export function sectionMembersInRect(widgets: WidgetConfig[], sectionId: string, rect: { left: number; top: number; right: number; bottom: number }) {
  return widgets.filter(w => {
    if (w.category === 'section' || (w.groupId && w.groupId !== sectionId) || (w.category === 'link' && w.onCanvas === false)) return false
    const [width, height] = w.size.split('x').map(Number)
    return (w.x ?? 0) >= rect.left && (w.y ?? 0) >= rect.top && (w.x ?? 0) + width <= rect.right && (w.y ?? 0) + height <= rect.bottom
  }).map(w => w.id)
}
