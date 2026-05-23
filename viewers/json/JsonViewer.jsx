import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { initSession, createSession, saveSession, setHashInUrl } from './sessionStore'
import './JsonViewerPage.css'

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
      className={`jv-copy-btn${copied ? ' copied' : ''}`}
    >
      {copied ? '✓ Copiado!' : '⎘ Copy'}
    </button>
  )
}

function TreeNode({ name, value, depth = 0, defaultExpanded = true }) {
  const [expanded, setExpanded] = useState(defaultExpanded && depth < 3)

  if (value === null) {
    return (
      <div className="jv-tree-line" style={{ paddingLeft: depth * 20 }}>
        {name !== undefined && <span className="jv-tree-key">{name}: </span>}
        <span className="jv-tree-null">null</span>
      </div>
    )
  }

  if (typeof value === 'boolean') {
    return (
      <div className="jv-tree-line" style={{ paddingLeft: depth * 20 }}>
        {name !== undefined && <span className="jv-tree-key">{name}: </span>}
        <span className="jv-tree-bool">{String(value)}</span>
      </div>
    )
  }

  if (typeof value === 'number') {
    return (
      <div className="jv-tree-line" style={{ paddingLeft: depth * 20 }}>
        {name !== undefined && <span className="jv-tree-key">{name}: </span>}
        <span className="jv-tree-number">{value}</span>
      </div>
    )
  }

  if (typeof value === 'string') {
    return (
      <div className="jv-tree-line" style={{ paddingLeft: depth * 20 }}>
        {name !== undefined && <span className="jv-tree-key">{name}: </span>}
        <span className="jv-tree-string">"{value}"</span>
      </div>
    )
  }

  if (Array.isArray(value)) {
    return (
      <div style={{ paddingLeft: depth * 20 }}>
        <div className="jv-tree-toggle" onClick={() => setExpanded(!expanded)}>
          <span className="jv-tree-arrow">{expanded ? '▼' : '▶'}</span>
          {name !== undefined && <span className="jv-tree-key">{name}: </span>}
          <span className="jv-tree-bracket">[</span>
          {!expanded && <span className="jv-tree-ellipsis">{value.length} items</span>}
          {!expanded && <span className="jv-tree-bracket">]</span>}
        </div>
        {expanded && (
          <>
            {value.map((item, i) => (
              <TreeNode key={i} name={i} value={item} depth={depth + 1} defaultExpanded={depth < 2} />
            ))}
            <div className="jv-tree-line" style={{ paddingLeft: depth * 20 }}>
              <span className="jv-tree-bracket">]</span>
            </div>
          </>
        )}
      </div>
    )
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value)
    return (
      <div style={{ paddingLeft: depth * 20 }}>
        <div className="jv-tree-toggle" onClick={() => setExpanded(!expanded)}>
          <span className="jv-tree-arrow">{expanded ? '▼' : '▶'}</span>
          {name !== undefined && <span className="jv-tree-key">{name}: </span>}
          <span className="jv-tree-bracket">{'{'}</span>
          {!expanded && <span className="jv-tree-ellipsis">{keys.length} keys</span>}
          {!expanded && <span className="jv-tree-bracket">{'}'}</span>}
        </div>
        {expanded && (
          <>
            {keys.map((key) => (
              <TreeNode key={key} name={key} value={value[key]} depth={depth + 1} defaultExpanded={depth < 2} />
            ))}
            <div className="jv-tree-line" style={{ paddingLeft: depth * 20 }}>
              <span className="jv-tree-bracket">{'}'}</span>
            </div>
          </>
        )}
      </div>
    )
  }

  return null
}

function JsonStats({ parsed }) {
  const stats = useMemo(() => {
    if (!parsed) return null
    let objects = 0, arrays = 0, strings = 0, numbers = 0, booleans = 0, nulls = 0, keys = 0

    function walk(val) {
      if (val === null) { nulls++; return }
      if (Array.isArray(val)) { arrays++; val.forEach(walk); return }
      if (typeof val === 'object') {
        objects++
        const k = Object.keys(val)
        keys += k.length
        k.forEach(key => walk(val[key]))
        return
      }
      if (typeof val === 'string') strings++
      else if (typeof val === 'number') numbers++
      else if (typeof val === 'boolean') booleans++
    }

    walk(parsed)
    return { objects, arrays, strings, numbers, booleans, nulls, keys }
  }, [parsed])

  if (!stats) return null

  return (
    <div className="jv-stats">
      <span className="jv-stat"><b>{stats.keys}</b> keys</span>
      <span className="jv-stat"><b>{stats.objects}</b> objects</span>
      <span className="jv-stat"><b>{stats.arrays}</b> arrays</span>
      <span className="jv-stat"><b>{stats.strings}</b> strings</span>
      <span className="jv-stat"><b>{stats.numbers}</b> numbers</span>
      <span className="jv-stat"><b>{stats.booleans}</b> bools</span>
      <span className="jv-stat"><b>{stats.nulls}</b> nulls</span>
    </div>
  )
}

export default function JsonViewerPage() {
  const [session, setSession] = useState(() => initSession())
  const [json, setJson] = useState(session.json)
  const [tab, setTab] = useState('formatted')
  const [indentSize, setIndentSize] = useState(2)
  const [searchQuery, setSearchQuery] = useState('')
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('jv-theme') || 'light' } catch { return 'light' }
  })
  const saveTimerRef = useRef(null)

  useEffect(() => {
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveSession({ ...session, json })
    }, 400)
    return () => clearTimeout(saveTimerRef.current)
  }, [json, session.id])

  useEffect(() => {
    try { localStorage.setItem('jv-theme', theme) } catch {}
  }, [theme])

  const parseResult = useMemo(() => {
    if (!json.trim()) return { valid: null, parsed: null, error: null }
    try {
      const parsed = JSON.parse(json)
      return { valid: true, parsed, error: null }
    } catch (e) {
      return { valid: false, parsed: null, error: e.message }
    }
  }, [json])

  const formatted = useMemo(() => {
    if (!parseResult.parsed) return ''
    return JSON.stringify(parseResult.parsed, null, indentSize)
  }, [parseResult.parsed, indentSize])

  const minified = useMemo(() => {
    if (!parseResult.parsed) return ''
    return JSON.stringify(parseResult.parsed)
  }, [parseResult.parsed])

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !parseResult.parsed) return []
    const results = []
    const query = searchQuery.toLowerCase()

    function walk(val, path) {
      if (val === null) {
        if ('null'.includes(query)) results.push({ path, value: 'null' })
        return
      }
      if (Array.isArray(val)) {
        val.forEach((item, i) => walk(item, `${path}[${i}]`))
        return
      }
      if (typeof val === 'object') {
        Object.entries(val).forEach(([k, v]) => {
          if (k.toLowerCase().includes(query)) {
            results.push({ path: `${path}.${k}`, value: JSON.stringify(v), matchType: 'key' })
          }
          walk(v, `${path}.${k}`)
        })
        return
      }
      if (String(val).toLowerCase().includes(query)) {
        results.push({ path, value: String(val) })
      }
    }

    walk(parseResult.parsed, '$')
    return results.slice(0, 50)
  }, [searchQuery, parseResult.parsed])

  function handleFormat() {
    if (parseResult.valid) {
      setJson(formatted)
    }
  }

  function handleMinify() {
    if (parseResult.valid) {
      setJson(minified)
    }
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setJson(ev.target.result)
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleNewSession() {
    saveSession({ ...session, json })
    const newSession = createSession()
    setHashInUrl(newSession.id)
    setSession(newSession)
    setJson('')
    setSearchQuery('')
  }

  return (
    <div className="jv" data-theme={theme}>
      {/* Header */}
      <div className="jv-header">
        <div className="jv-header-left">
          <h1>JSON<span>Viewer</span></h1>
          <button
            className="jv-btn jv-btn-secondary jv-btn-sm"
            onClick={handleNewSession}
          >
            + Nova sessao
          </button>
          <span className="jv-session-id">#{session.id}</span>
        </div>
        <button
          className="jv-theme-toggle"
          onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
        >
          <span className="toggle-icon">{theme === 'light' ? '☾' : '☀'}</span>
          {theme === 'light' ? 'Dark' : 'Light'}
        </button>
      </div>

      {/* Toolbar */}
      <div className="jv-toolbar">
        <label className="jv-btn jv-btn-primary">
          ↑ Upload .json
          <input
            type="file"
            accept=".json,.txt"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </label>
        <button className="jv-btn jv-btn-secondary" onClick={handleFormat} disabled={!parseResult.valid}>
          Formatar
        </button>
        <button className="jv-btn jv-btn-secondary" onClick={handleMinify} disabled={!parseResult.valid}>
          Minificar
        </button>
        <button className="jv-btn jv-btn-secondary" onClick={() => setJson('')}>
          Limpar
        </button>

        {parseResult.valid !== null && (
          <span className={`jv-status ${parseResult.valid ? 'valid' : 'invalid'}`}>
            {parseResult.valid ? '✓ JSON valido' : '✕ JSON invalido'}
          </span>
        )}
      </div>

      {/* Editor */}
      <textarea
        className="jv-textarea"
        value={json}
        onChange={(e) => setJson(e.target.value)}
        placeholder='Cole ou digite seu JSON aqui...'
        spellCheck={false}
      />
      {json && <CopyButton text={json} />}

      {/* Error */}
      {parseResult.error && (
        <div className="jv-error">
          <strong>Erro:</strong> {parseResult.error}
        </div>
      )}

      {/* Tabs */}
      {parseResult.valid && (
        <>
          <div className="jv-tabs">
            <button
              className={`jv-tab ${tab === 'formatted' ? 'active' : ''}`}
              onClick={() => setTab('formatted')}
            >
              Formatado
            </button>
            <button
              className={`jv-tab ${tab === 'tree' ? 'active' : ''}`}
              onClick={() => setTab('tree')}
            >
              Tree View
            </button>
            <button
              className={`jv-tab ${tab === 'search' ? 'active' : ''}`}
              onClick={() => setTab('search')}
            >
              Buscar
            </button>
            <button
              className={`jv-tab ${tab === 'stats' ? 'active' : ''}`}
              onClick={() => setTab('stats')}
            >
              Stats
            </button>

            {tab === 'formatted' && (
              <div className="jv-indent-control">
                <label>Indent:</label>
                <select value={indentSize} onChange={(e) => setIndentSize(Number(e.target.value))}>
                  <option value={2}>2 spaces</option>
                  <option value={4}>4 spaces</option>
                  <option value={8}>Tab (8)</option>
                </select>
              </div>
            )}
          </div>

          {/* Formatted */}
          {tab === 'formatted' && (
            <div className="jv-output-wrap">
              <pre className="jv-output">{formatted}</pre>
              <CopyButton text={formatted} />
            </div>
          )}

          {/* Tree View */}
          {tab === 'tree' && (
            <div className="jv-tree-wrap">
              <TreeNode value={parseResult.parsed} />
            </div>
          )}

          {/* Search */}
          {tab === 'search' && (
            <div className="jv-search-wrap">
              <input
                type="text"
                className="jv-search-input"
                placeholder="Buscar chaves ou valores..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searchQuery && (
                <div className="jv-search-results">
                  {searchResults.length === 0 ? (
                    <p className="jv-search-empty">Nenhum resultado encontrado.</p>
                  ) : (
                    <>
                      <p className="jv-search-count">{searchResults.length} resultado(s)</p>
                      {searchResults.map((r, i) => (
                        <div key={i} className="jv-search-item">
                          <span className="jv-search-path">{r.path}</span>
                          <span className="jv-search-value">{r.value}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Stats */}
          {tab === 'stats' && (
            <div className="jv-stats-wrap">
              <JsonStats parsed={parseResult.parsed} />
              <div className="jv-size-info">
                <span>Original: <b>{json.length.toLocaleString()}</b> chars</span>
                <span>Formatado: <b>{formatted.length.toLocaleString()}</b> chars</span>
                <span>Minificado: <b>{minified.length.toLocaleString()}</b> chars</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
