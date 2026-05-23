import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.min.css'
import mermaid from 'mermaid'
import { diffLines } from 'diff'
import { initSession, createSession, saveSession, setHashInUrl } from './sessionStore'
import './MarkdownPlusPage.css'

const marked = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      if (lang === 'mermaid') return code
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value
      }
      return hljs.highlightAuto(code).value
    },
  })
)
marked.setOptions({ breaks: true, gfm: true })

marked.use({
  extensions: [{
    name: 'code',
    level: 'block',
    renderer(token) {
      if (token.lang === 'mermaid') {
        return `<div class="mermaid-block" data-mermaid>${token.text}</div>`
      }
      return false
    },
  }],
})

let mermaidCounter = 0

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={handleCopy}
      className={`mdplus-copy-btn${copied ? ' copied' : ''}`}
    >
      {copied ? '✓ Copiado!' : '⎘ Copy to clipboard'}
    </button>
  )
}

export default function MarkdownPlusPage() {
  const [session, setSession] = useState(() => initSession())
  const [markdown, setMarkdown] = useState(session.markdown)
  const [showCompare, setShowCompare] = useState(false)
  const [compareText, setCompareText] = useState(session.compareText)
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('mdplus-theme') || 'light' } catch { return 'light' }
  })
  const previewRef = useRef(null)
  const saveTimerRef = useRef(null)

  // Debounced save to localStorage
  useEffect(() => {
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveSession({ ...session, markdown, compareText })
    }, 400)
    return () => clearTimeout(saveTimerRef.current)
  }, [markdown, compareText, session.id])

  // Theme persistence
  useEffect(() => {
    try { localStorage.setItem('mdplus-theme', theme) } catch {}
    mermaid.initialize({ startOnLoad: false, theme: theme === 'dark' ? 'dark' : 'default' })
  }, [theme])

  const html = useMemo(() => {
    try {
      return marked.parse(markdown)
    } catch {
      return '<p style="color:red">Erro ao processar markdown</p>'
    }
  }, [markdown])

  const renderMermaid = useCallback(async () => {
    if (!previewRef.current) return
    const blocks = previewRef.current.querySelectorAll('[data-mermaid]')
    for (const block of blocks) {
      if (block.dataset.rendered) continue
      block.dataset.rendered = 'true'
      const id = `mermaid-${++mermaidCounter}`
      try {
        const { svg } = await mermaid.render(id, block.textContent)
        block.innerHTML = svg
      } catch {
        block.innerHTML = '<pre style="color:#ef4444">Mermaid syntax error</pre>'
      }
    }
  }, [])

  useEffect(() => { renderMermaid() }, [html, renderMermaid])

  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setMarkdown(ev.target.result)
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleNewSession() {
    // Save current before switching
    saveSession({ ...session, markdown, compareText })
    const newSession = createSession()
    setHashInUrl(newSession.id)
    setSession(newSession)
    setMarkdown('')
    setCompareText('')
    setShowCompare(false)
  }

  const diffResult = useMemo(() => {
    if (!showCompare || (!markdown && !compareText)) return null
    return diffLines(markdown, compareText)
  }, [markdown, compareText, showCompare])

  return (
    <div className="mdplus" data-theme={theme}>
      {/* Header */}
      <div className="mdplus-header">
        <div className="mdplus-header-left">
          <h1>Markdown<span>+</span></h1>
          <button
            className="mdplus-btn mdplus-btn-secondary mdplus-btn-sm"
            onClick={handleNewSession}
            title="Criar nova sessao"
          >
            + Nova sessao
          </button>
          <span className="mdplus-session-id" title={`Sessao: ${session.id}`}>
            #{session.id}
          </span>
        </div>
        <button
          className="mdplus-theme-toggle"
          onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
        >
          <span className="toggle-icon">{theme === 'light' ? '☾' : '☀'}</span>
          {theme === 'light' ? 'Dark' : 'Light'}
        </button>
      </div>

      {/* Toolbar */}
      <div className="mdplus-toolbar">
        <label className="mdplus-btn mdplus-btn-primary">
          ↑ Upload .md
          <input
            type="file"
            accept=".md,.markdown,.txt"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </label>
        <button className="mdplus-btn mdplus-btn-secondary" onClick={() => setMarkdown('')}>
          Limpar
        </button>
      </div>

      {/* Editor */}
      <textarea
        className="mdplus-textarea"
        value={markdown}
        onChange={(e) => setMarkdown(e.target.value)}
        placeholder="Cole ou digite seu markdown aqui..."
        spellCheck={false}
      />
      {markdown && <CopyButton text={markdown} />}

      {/* Preview */}
      <h2 className="mdplus-section-title">Preview</h2>
      <div
        ref={previewRef}
        className="mdplus-preview mdplus-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* Compare toggle */}
      <div className="mdplus-compare-bar">
        <button
          className={`mdplus-btn ${showCompare ? 'mdplus-btn-danger' : 'mdplus-btn-primary'}`}
          onClick={() => setShowCompare(!showCompare)}
        >
          {showCompare ? '✕ Fechar Compare' : '↔ Compare'}
        </button>
      </div>

      {/* Compare section */}
      {showCompare && (
        <>
          <h2 className="mdplus-section-title">Texto para comparar</h2>
          <textarea
            className="mdplus-textarea"
            value={compareText}
            onChange={(e) => setCompareText(e.target.value)}
            placeholder="Cole o segundo texto/markdown aqui para comparar..."
            spellCheck={false}
          />
          {compareText && <CopyButton text={compareText} />}

          <h2 className="mdplus-section-title">Diff</h2>
          <div className="mdplus-diff">
            {diffResult && diffResult.map((part, i) => (
              <div
                key={i}
                className={`mdplus-diff-line ${
                  part.added ? 'added' : part.removed ? 'removed' : 'neutral'
                }`}
              >
                {part.value}
              </div>
            ))}
            {(!diffResult || diffResult.length === 0) && (
              <p className="mdplus-diff-empty">
                Digite texto em ambos os campos para ver o diff.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
