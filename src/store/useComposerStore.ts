import { create } from 'zustand'
import { formatQuoteSeed } from '../lib/quotePrompt'

/**
 * The chat composer's draft, lifted out of `ChatInputBar` so anything on screen
 * can put text into it — today that is "branch on this", which seeds a quote
 * from a highlighted passage in a response.
 *
 * Transient session state only: never persisted, and deliberately not part of
 * `useTreeStore` (a half-typed prompt is not tree data).
 */
interface ComposerState {
  draft: string
  /**
   * Bumped whenever something outside the input asks for the caret. The input
   * watches this rather than `draft`, so ordinary typing never re-focuses.
   */
  focusNonce: number
}

interface ComposerActions {
  setDraft: (draft: string) => void
  clear: () => void
  /**
   * Prepend a highlighted passage as a Markdown quote and ask for focus.
   * Anything already typed is kept, below the quote.
   */
  seedQuote: (passage: string) => void
}

export const useComposerStore = create<ComposerState & ComposerActions>((set) => ({
  draft: '',
  focusNonce: 0,

  setDraft: (draft) => set({ draft }),

  clear: () => set({ draft: '' }),

  seedQuote: (passage) => {
    const seed = formatQuoteSeed(passage)
    if (seed === '') return
    set((s) => ({ draft: seed + s.draft, focusNonce: s.focusNonce + 1 }))
  },
}))
