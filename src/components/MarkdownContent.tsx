import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
import { CodeBlock } from './CodeBlock'
import type { Components } from 'react-markdown'

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-lg font-bold text-slate-100 mt-3 mb-2">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-bold text-slate-200 mt-2 mb-2">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-bold text-slate-200 mt-2 mb-1">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-sm text-slate-200 my-2 break-words">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 my-2">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 my-2">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-sm text-slate-200">
      {children}
    </li>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-indigo-400 hover:text-indigo-300 underline"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-slate-600 pl-3 text-slate-400 italic my-2">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <table className="w-full text-xs border-collapse my-2">
      {children}
    </table>
  ),
  thead: ({ children }) => (
    <thead>{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody>{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr>{children}</tr>
  ),
  th: ({ children }) => (
    <th className="border border-slate-700 bg-slate-800 px-2 py-1 text-left text-slate-300">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-slate-700 px-2 py-1 text-slate-300">
      {children}
    </td>
  ),
  // react-markdown renders block code inside a <pre>; we handle the block layout
  // in CodeBlock, so flatten the wrapper to avoid nested <pre> elements.
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    // Fenced code blocks carry a `language-xxx` class; inline code does not.
    const isFenced = typeof className === 'string' && className.includes('language-')
    if (!isFenced) {
      return (
        <code className="rounded bg-slate-800 px-1 py-0.5 text-xs text-indigo-300 font-mono">
          {children}
        </code>
      )
    }
    // `children` is the highlighted node tree from rehype-highlight — pass it
    // through untouched so token colours survive.
    return <CodeBlock className={className}>{children}</CodeBlock>
  },
}

interface MarkdownContentProps {
  markdown: string
}

export function MarkdownContent({ markdown }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={components}
    >
      {markdown}
    </ReactMarkdown>
  )
}
