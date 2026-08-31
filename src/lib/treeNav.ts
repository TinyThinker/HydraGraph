import type { TurnNode } from '../types'

export type NavDirection = 'parent' | 'child' | 'prev' | 'next'

export function resolveNavTarget(
  currentId: string | null,
  dir: NavDirection,
  nodes: Map<string, TurnNode>
): string | null {
  if (currentId == null) return null

  const node = nodes.get(currentId)
  if (!node) return null

  switch (dir) {
    case 'parent':
      return node.parentId ?? null

    case 'child':
      return node.childrenIds[0] ?? null

    case 'prev': {
      if (node.parentId == null) return null
      const parent = nodes.get(node.parentId)
      if (!parent) return null
      const sibs = parent.childrenIds
      const i = sibs.indexOf(currentId)
      if (i < 0) return null
      return i > 0 ? sibs[i - 1] : null
    }

    case 'next': {
      if (node.parentId == null) return null
      const parent = nodes.get(node.parentId)
      if (!parent) return null
      const sibs = parent.childrenIds
      const i = sibs.indexOf(currentId)
      if (i < 0) return null
      return i < sibs.length - 1 ? sibs[i + 1] : null
    }

    default:
      return null
  }
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  if (target instanceof HTMLInputElement) return true
  if (target instanceof HTMLTextAreaElement) return true
  if (target instanceof HTMLSelectElement) return true

  return target.contentEditable === 'true'
}
