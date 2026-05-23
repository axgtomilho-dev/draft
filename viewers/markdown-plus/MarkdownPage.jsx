import { useState, useMemo } from 'react'
import { marked } from 'marked'

marked.setOptions({ breaks: true, gfm: true })

export default function MarkdownPage() {
  const [markdown, setMarkdown] = useState('')

  const html = useMemo(() => {
    try {
      return marked.parse(markdown)
    } catch {
      return '<p style="color:red">Erro ao processar markdown</p>'
    }
  }, [markdown])

  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setMarkdown(ev.target.result)
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Markdown Preview</h1>

      <div style={styles.toolbar}>
        <label style={styles.uploadBtn}>
          Upload .md
          <input
            type="file"
            accept=".md,.markdown,.txt"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </label>
        <button style={styles.clearBtn} onClick={() => setMarkdown('')}>
          Limpar
        </button>
      </div>

      <textarea
        style={styles.textarea}
        value={markdown}
        onChange={(e) => setMarkdown(e.target.value)}
        placeholder="Cole ou digite seu markdown aqui..."
        spellCheck={false}
      />

      <h2 style={styles.previewTitle}>Preview</h2>
      <div
        style={styles.preview}
        className="markdown-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <style>{markdownStyles}</style>
    </div>
  )
}

const styles = {
  container: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '2rem 1rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#1f2937',
    background: '#f9fafb',
    minHeight: '100vh',
  },
  title: {
    margin: 0,
    fontSize: '1.8rem',
    color: '#111827',
  },
  toolbar: {
    display: 'flex',
    gap: '0.5rem',
    margin: '1rem 0',
  },
  uploadBtn: {
    padding: '0.5rem 1rem',
    background: '#2563eb',
    color: '#fff',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: '0.9rem',
    border: 'none',
  },
  clearBtn: {
    padding: '0.5rem 1rem',
    background: '#e5e7eb',
    color: '#333',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: '0.9rem',
    border: 'none',
  },
  textarea: {
    width: '100%',
    minHeight: 250,
    padding: '0.75rem',
    fontSize: '0.95rem',
    fontFamily: '"Fira Code", "Consolas", monospace',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    resize: 'vertical',
    boxSizing: 'border-box',
    lineHeight: 1.6,
  },
  previewTitle: {
    marginTop: '1.5rem',
    marginBottom: '0.5rem',
    fontSize: '1.2rem',
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: '0.3rem',
  },
  preview: {
    padding: '1rem',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    minHeight: 100,
    background: '#fff',
  },
}

const markdownStyles = `
.markdown-body h1, .markdown-body h2, .markdown-body h3,
.markdown-body h4, .markdown-body h5, .markdown-body h6 {
  margin-top: 1.2em; margin-bottom: 0.4em; line-height: 1.3;
}
.markdown-body h1 { font-size: 1.8em; border-bottom: 1px solid #eee; padding-bottom: 0.2em; }
.markdown-body h2 { font-size: 1.4em; border-bottom: 1px solid #eee; padding-bottom: 0.2em; }
.markdown-body h3 { font-size: 1.2em; }
.markdown-body p { margin: 0.6em 0; line-height: 1.7; }
.markdown-body ul, .markdown-body ol { padding-left: 1.8em; margin: 0.5em 0; }
.markdown-body li { margin: 0.25em 0; }
.markdown-body code {
  background: #f3f4f6; padding: 0.15em 0.4em; border-radius: 4px;
  font-size: 0.9em; font-family: "Fira Code", "Consolas", monospace;
}
.markdown-body pre {
  background: #1e293b; color: #e2e8f0; padding: 1rem;
  border-radius: 8px; overflow-x: auto; margin: 0.8em 0;
}
.markdown-body pre code {
  background: none; padding: 0; color: inherit;
}
.markdown-body blockquote {
  border-left: 4px solid #2563eb; margin: 0.8em 0;
  padding: 0.4em 1em; color: #555; background: #f8fafc;
}
.markdown-body table { border-collapse: collapse; width: 100%; margin: 0.8em 0; }
.markdown-body th, .markdown-body td {
  border: 1px solid #d1d5db; padding: 0.5em 0.75em; text-align: left;
}
.markdown-body th { background: #f3f4f6; font-weight: 600; }
.markdown-body img { max-width: 100%; border-radius: 4px; }
.markdown-body a { color: #2563eb; }
.markdown-body hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.5em 0; }
`
