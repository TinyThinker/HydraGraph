import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarkdownContent } from './MarkdownContent'

describe('MarkdownContent', () => {
  it('renders markdown with headings, tables, code, links, and blockquotes', () => {
    const markdown = `# Results

| Header | Value |
|--------|-------|
| Alpha  | 100   |

\`\`\`ts
const x: number = 1
\`\`\`

Here is \`inline\` code.

[click](https://example.com)

> This is a quote
`

    const { container } = render(<MarkdownContent markdown={markdown} />)

    // Assert h1
    expect(screen.getByText('Results')).toBeInTheDocument()
    const h1 = screen.getByText('Results').closest('h1')
    expect(h1).toBeInTheDocument()

    // Assert table content
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    const alphaTd = screen.getByText('Alpha').closest('td')
    expect(alphaTd).toBeInTheDocument()

    // Assert fenced code block exists with language class AND its text is intact
    // (regression guard: rehype-highlight turns children into span nodes, so a
    // naive String(children) would render "[object Object]" garbage instead).
    const codeBlock = container.querySelector('pre code.language-ts')
    expect(codeBlock).toBeInTheDocument()
    expect(codeBlock?.textContent).toContain('const x: number = 1')

    // Assert link has correct attributes
    const link = screen.getByText('click')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(link.getAttribute('rel')).toContain('noreferrer')

    // Assert blockquote is present
    expect(screen.getByText(/This is a quote/)).toBeInTheDocument()

    // Verify no script or img tags
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })

  it('sanitizes raw HTML - does not render script tags', () => {
    const markdown = 'Some text <script>alert(1)</script> more text'
    const { container } = render(<MarkdownContent markdown={markdown} />)

    expect(container.querySelector('script')).toBeNull()
  })

  it('sanitizes raw HTML - does not render img tags with onerror', () => {
    const markdown = 'Image: <img src=x onerror=alert(1)>'
    const { container } = render(<MarkdownContent markdown={markdown} />)

    expect(container.querySelector('img')).toBeNull()
  })

  it('has copy button for code blocks and preserves the raw code text', () => {
    const markdown = '```ts\nconst answer = 42\n```'
    const { container } = render(<MarkdownContent markdown={markdown} />)

    const copyButton = screen.getByTitle('Copy code')
    expect(copyButton).toBeInTheDocument()
    // The text the copy button will read (code element's textContent) is the real source
    expect(container.querySelector('pre code')?.textContent).toContain('const answer = 42')
  })

  it('renders inline code differently from fenced code', () => {
    const markdown = 'Inline `code` and\n```ts\nblock code\n```'
    const { container } = render(<MarkdownContent markdown={markdown} />)

    // Inline code should be in a <code> element with indigo styling (not highlighted)
    const inlineCodes = container.querySelectorAll('code.text-indigo-300')
    expect(inlineCodes.length).toBeGreaterThan(0)

    // Block code should have language class (from rehypeHighlight)
    const blockCodeElem = container.querySelector('code.language-ts')
    expect(blockCodeElem).toBeInTheDocument()
  })

  it('renders GFM tables with proper structure', () => {
    const markdown = `| A | B |
|---|---|
| 1 | 2 |`

    const { container } = render(<MarkdownContent markdown={markdown} />)

    // Check table exists
    const table = container.querySelector('table')
    expect(table).toBeInTheDocument()

    // Check header cells
    const headers = container.querySelectorAll('th')
    expect(headers.length).toBeGreaterThanOrEqual(2)

    // Check body cells
    const cells = container.querySelectorAll('td')
    expect(cells.length).toBeGreaterThanOrEqual(2)
  })

  it('renders lists with proper elements', () => {
    const markdown = `- Item 1
- Item 2

1. First
2. Second`

    const { container } = render(<MarkdownContent markdown={markdown} />)

    // Check unordered list
    const ul = container.querySelector('ul')
    expect(ul).toBeInTheDocument()
    const lis = container.querySelectorAll('li')
    expect(lis.length).toBeGreaterThanOrEqual(4)

    // Check ordered list
    const ol = container.querySelector('ol')
    expect(ol).toBeInTheDocument()
  })
})
