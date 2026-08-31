import { useRef, useState, type ReactNode } from 'react'
import { Copy, Check } from 'lucide-react'

interface CodeBlockProps {
  className?: string
  children: ReactNode
}

// Renders a fenced code block. `children` is the already-highlighted node tree
// produced by rehype-highlight, so it is rendered as-is to keep the token
// colours; the copy button reads the block's plain text from the DOM instead of
// trying to stringify the highlighted React nodes.
export function CodeBlock({ className, children }: CodeBlockProps) {
  const codeRef = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const text = codeRef.current?.textContent ?? ''
    if (!navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error('Failed to copy code block:', err)
    }
  }

  return (
    <div className="relative my-2">
      <pre className="overflow-x-auto rounded-lg bg-slate-800 p-3 text-xs">
        <code ref={codeRef} className={className}>{children}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="nodrag absolute top-2 right-2 bg-slate-700 hover:text-slate-200 text-slate-400 p-1.5 rounded transition-colors"
        title="Copy code"
        aria-label="Copy code"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  )
}
