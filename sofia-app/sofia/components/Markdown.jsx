'use client'

export default function Markdown({ content }) {
  if (!content) return null

  const lines = content.split('\n')
  const elements = []
  let i = 0
  let listBuffer = []
  let listType = null

  function inlineFormat(str) {
    if (!str) return str
    const parts = []
    let key = 0
    const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g
    let lastIndex = 0
    let match
    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) parts.push(<span key={key++}>{str.slice(lastIndex, match.index)}</span>)
      if (match[2]) parts.push(<strong key={key++}><em>{match[2]}</em></strong>)
      else if (match[3]) parts.push(<strong key={key++} className="font-semibold">{match[3]}</strong>)
      else if (match[4]) parts.push(<em key={key++} className="italic">{match[4]}</em>)
      else if (match[5]) parts.push(<code key={key++} className="bg-cream-200 px-1.5 py-0.5 rounded text-sm font-mono">{match[5]}</code>)
      else if (match[6] && match[7]) parts.push(<a key={key++} href={match[7]} target="_blank" rel="noreferrer" className="text-gold-500 underline hover:text-gold-600">{match[6]}</a>)
      lastIndex = regex.lastIndex
    }
    if (lastIndex < str.length) parts.push(<span key={key++}>{str.slice(lastIndex)}</span>)
    return parts.length ? parts : str
  }

  function flushList() {
    if (listBuffer.length > 0) {
      if (listType === 'ol') {
        elements.push(
          <ol key={`ol-${elements.length}`} className="my-2 pl-6 space-y-1 leading-relaxed list-decimal">
            {listBuffer.map((item, idx) => <li key={idx}>{inlineFormat(item)}</li>)}
          </ol>
        )
      } else {
        elements.push(
          <ul key={`ul-${elements.length}`} className="my-2 pl-6 space-y-1 leading-relaxed list-disc">
            {listBuffer.map((item, idx) => <li key={idx}>{inlineFormat(item)}</li>)}
          </ul>
        )
      }
      listBuffer = []
      listType = null
    }
  }

  while (i < lines.length) {
    const line = lines[i]

    // Code blocks
    if (line.startsWith('```')) {
      flushList()
      let code = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        code.push(lines[i])
        i++
      }
      elements.push(
        <pre key={`code-${elements.length}`} className="bg-ink-500 text-cream-200 p-4 rounded-lg overflow-auto text-sm font-mono my-3 leading-relaxed">
          <code>{code.join('\n')}</code>
        </pre>
      )
      i++
      continue
    }

    // Headings
    if (line.startsWith('### ')) { flushList(); elements.push(<h3 key={`h3-${i}`} className="text-lg font-bold mt-5 mb-2 text-ink-500 font-serif">{inlineFormat(line.slice(4))}</h3>); i++; continue }
    if (line.startsWith('## ')) { flushList(); elements.push(<h2 key={`h2-${i}`} className="text-xl font-bold mt-6 mb-2 text-ink-500 font-serif">{inlineFormat(line.slice(3))}</h2>); i++; continue }
    if (line.startsWith('# ')) { flushList(); elements.push(<h1 key={`h1-${i}`} className="text-2xl font-bold mt-4 mb-2 text-ink-500 font-serif">{inlineFormat(line.slice(2))}</h1>); i++; continue }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { flushList(); elements.push(<hr key={`hr-${i}`} className="border-cream-300 my-6" />); i++; continue }

    // Blockquote
    if (line.startsWith('> ')) { flushList(); elements.push(<blockquote key={`bq-${i}`} className="border-l-[3px] border-gold-500 pl-4 my-3 text-cream-700 italic">{inlineFormat(line.slice(2))}</blockquote>); i++; continue }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      if (listType !== 'ol') flushList()
      listType = 'ol'
      listBuffer.push(line.replace(/^\d+\.\s/, ''))
      i++; continue
    }

    // Unordered list
    if (/^[-*+]\s/.test(line)) {
      if (listType !== 'ul') flushList()
      listType = 'ul'
      listBuffer.push(line.replace(/^[-*+]\s/, ''))
      i++; continue
    }

    // Empty line
    if (line.trim() === '') { flushList(); i++; continue }

    // Paragraph
    flushList()
    elements.push(<p key={`p-${i}`} className="my-2 leading-[1.75] text-cream-900">{inlineFormat(line)}</p>)
    i++
  }

  flushList()
  return <div>{elements}</div>
}
