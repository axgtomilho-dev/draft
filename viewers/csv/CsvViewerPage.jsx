import { useState, useMemo, useEffect, useRef } from 'react'
import { diffLines } from 'diff'
import { initSession, createSession, saveSession, setHashInUrl } from './sessionStore'
import { detectDelimiter, parseCSV, isNumeric, formatCellForCopy, toQuotedCSV, delimiterLabel } from './csvUtils'
import RowDetailModal from './RowDetailModal'
import './CsvViewerPage.css'

const MAX_PERSIST_SIZE = 500000
const ROWS_PER_PAGE = 200

/* ── Components ── */

function CopyButton({ text, label }) {
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
      className={`cv-copy-btn${copied ? ' copied' : ''}`}
    >
      {copied ? '✓ Copiado!' : (label || '⎘ Copy')}
    </button>
  )
}

function CsvStats({ headers, rows }) {
  const stats = useMemo(() => {
    if (!headers || !rows) return null

    const colStats = headers.map((h, ci) => {
      let nums = 0, empties = 0, strings = 0
      for (const row of rows) {
        const val = row[ci] || ''
        if (val.trim() === '') empties++
        else if (isNumeric(val)) nums++
        else strings++
      }
      return { name: h, nums, strings, empties }
    })

    return {
      totalRows: rows.length,
      totalCols: headers.length,
      columns: colStats,
    }
  }, [headers, rows])

  if (!stats) return null

  return (
    <div className="cv-stats-content">
      <div className="cv-stats-summary">
        <span className="cv-stat"><b>{stats.totalRows}</b> linhas</span>
        <span className="cv-stat"><b>{stats.totalCols}</b> colunas</span>
      </div>
      <table className="cv-stats-table">
        <thead>
          <tr>
            <th>Coluna</th>
            <th>Numericos</th>
            <th>Texto</th>
            <th>Vazios</th>
          </tr>
        </thead>
        <tbody>
          {stats.columns.map((col, i) => (
            <tr key={i}>
              <td className="cv-stats-col-name">{col.name}</td>
              <td>{col.nums}</td>
              <td>{col.strings}</td>
              <td>{col.empties}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── Main page ── */

export default function CsvViewerPage() {
  const [session, setSession] = useState(() => initSession())
  const [csv, setCsv] = useState(session.csv || '')
  const [delimiter, setDelimiter] = useState(',')
  const [tab, setTab] = useState('table')
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [searchQuery, setSearchQuery] = useState('')
  const [visibleRows, setVisibleRows] = useState(ROWS_PER_PAGE)
  const [showCompare, setShowCompare] = useState(false)
  const [compareText, setCompareText] = useState(session.compareText || '')
  const [sizeWarning, setSizeWarning] = useState(false)
  const [selectedRow, setSelectedRow] = useState(null)
  const [parquetLoading, setParquetLoading] = useState(false)
  const [parquetError, setParquetError] = useState(null)
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('cv-theme') || 'light' } catch { return 'light' }
  })
  const saveTimerRef = useRef(null)

  // Auto-detect delimiter when csv changes
  useEffect(() => {
    if (csv.trim()) {
      setDelimiter(detectDelimiter(csv))
    }
  }, []) // only on mount

  // Debounced save with size check
  useEffect(() => {
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const tooLarge = csv.length > MAX_PERSIST_SIZE
      setSizeWarning(tooLarge)
      saveSession({
        ...session,
        csv: tooLarge ? '' : csv,
        compareText: tooLarge ? '' : compareText,
      })
    }, 400)
    return () => clearTimeout(saveTimerRef.current)
  }, [csv, compareText, session.id])

  // Theme persistence
  useEffect(() => {
    try { localStorage.setItem('cv-theme', theme) } catch {}
  }, [theme])

  // Parse CSV
  const parsed = useMemo(() => {
    if (!csv.trim()) return null
    const allRows = parseCSV(csv, delimiter)
    if (allRows.length === 0) return null

    const headers = allRows[0]
    const dataRows = allRows.slice(1)

    // Normalize row lengths
    const colCount = headers.length
    const normalized = dataRows.map(row => {
      if (row.length === colCount) return row
      if (row.length < colCount) return [...row, ...Array(colCount - row.length).fill('')]
      return row.slice(0, colCount)
    })

    return { headers, rows: normalized }
  }, [csv, delimiter])

  // Sort
  const sortedRows = useMemo(() => {
    if (!parsed || sortCol === null) return parsed?.rows || []
    const rows = [...parsed.rows]
    rows.sort((a, b) => {
      const va = a[sortCol] || ''
      const vb = b[sortCol] || ''
      const na = isNumeric(va) ? parseFloat(va) : null
      const nb = isNumeric(vb) ? parseFloat(vb) : null

      let cmp
      if (na !== null && nb !== null) {
        cmp = na - nb
      } else {
        cmp = va.localeCompare(vb, undefined, { sensitivity: 'base' })
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return rows
  }, [parsed, sortCol, sortDir])

  // Search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !parsed) return []
    const query = searchQuery.toLowerCase()
    return sortedRows
      .map((row, origIdx) => ({ row, idx: origIdx }))
      .filter(({ row }) => row.some(cell => cell.toLowerCase().includes(query)))
  }, [searchQuery, parsed, sortedRows])

  // Quoted CSV for copy
  const quotedCSV = useMemo(() => {
    if (!parsed) return ''
    return toQuotedCSV(parsed.headers, sortedRows, delimiter)
  }, [parsed, sortedRows, delimiter])

  // Compare
  const diffResult = useMemo(() => {
    if (!showCompare) return null
    const leftText = quotedCSV || csv
    const rightText = compareText
    if (!leftText && !rightText) return null
    return diffLines(leftText, rightText)
  }, [quotedCSV, csv, compareText, showCompare])

  function handleSort(colIdx) {
    if (sortCol === colIdx) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(colIdx)
      setSortDir('asc')
    }
  }

  function handleCsvChange(text) {
    setCsv(text)
    setDelimiter(detectDelimiter(text))
    setVisibleRows(ROWS_PER_PAGE)
    setSortCol(null)
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.name.endsWith('.parquet')) {
      setParquetLoading(true)
      setParquetError(null)
      try {
        const buffer = await file.arrayBuffer()
        const { parquetMetadata, parquetRead } = await import('hyparquet')

        const metadata = parquetMetadata(buffer)
        const columns = metadata.schema
          .filter(s => s.num_children === undefined || s.num_children === null)
          .map(s => s.name)

        await parquetRead({
          file: buffer,
          onComplete: (data) => {
            const csvLines = [columns.join(',')]
            for (const row of data) {
              csvLines.push(
                row.map(val => {
                  if (val === null || val === undefined) return ''
                  const str = String(val)
                  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`
                  }
                  return str
                }).join(',')
              )
            }
            const text = csvLines.join('\n')
            setCsv(text)
            setDelimiter(',')
            setVisibleRows(ROWS_PER_PAGE)
            setSortCol(null)
            setParquetLoading(false)
          },
        })
      } catch (err) {
        setParquetError(`Erro ao ler Parquet: ${err.message}`)
        setParquetLoading(false)
      }
    } else {
      const reader = new FileReader()
      reader.onload = (ev) => {
        handleCsvChange(ev.target.result)
      }
      reader.readAsText(file)
    }
    e.target.value = ''
  }

  function handleNewSession() {
    const tooLarge = csv.length > MAX_PERSIST_SIZE
    saveSession({
      ...session,
      csv: tooLarge ? '' : csv,
      compareText: tooLarge ? '' : compareText,
    })
    const newSession = createSession()
    setHashInUrl(newSession.id)
    setSession(newSession)
    setCsv('')
    setCompareText('')
    setSearchQuery('')
    setShowCompare(false)
    setSortCol(null)
    setSizeWarning(false)
    setVisibleRows(ROWS_PER_PAGE)
  }

  function handleRowSave(rowIdx, newRow) {
    if (!parsed) return
    const allRows = parseCSV(csv, delimiter)
    const dataIdx = rowIdx + 1 // +1 for header
    if (dataIdx < allRows.length) {
      allRows[dataIdx] = newRow
      const rebuilt = allRows.map(r =>
        r.map(cell => {
          if (cell.includes(delimiter) || cell.includes('"') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`
          }
          return cell
        }).join(delimiter)
      ).join('\n')
      setCsv(rebuilt)
    }
  }

  const displayRows = tab === 'search' ? searchResults.map(r => r.row) : sortedRows
  const paginatedRows = displayRows.slice(0, visibleRows)
  const hasMore = displayRows.length > visibleRows

  return (
    <div className="cv" data-theme={theme}>
      {/* Header */}
      <div className="cv-header">
        <div className="cv-header-left">
          <h1>CSV<span>Viewer</span></h1>
          <button
            className="cv-btn cv-btn-secondary cv-btn-sm"
            onClick={handleNewSession}
          >
            + Nova sessao
          </button>
          <span className="cv-session-id">#{session.id}</span>
        </div>
        <button
          className="cv-theme-toggle"
          onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
        >
          <span className="toggle-icon">{theme === 'light' ? '☾' : '☀'}</span>
          {theme === 'light' ? 'Dark' : 'Light'}
        </button>
      </div>

      {/* Size warning */}
      {sizeWarning && (
        <div className="cv-warning">
          CSV muito grande ({(csv.length / 1000).toFixed(0)}K chars) — os dados nao serao salvos ao recarregar a pagina.
        </div>
      )}

      {/* Parquet loading/error */}
      {parquetLoading && (
        <div className="cv-info">Lendo arquivo Parquet...</div>
      )}
      {parquetError && (
        <div className="cv-error">{parquetError}</div>
      )}

      {/* Toolbar */}
      <div className="cv-toolbar">
        <label className="cv-btn cv-btn-primary">
          ↑ Upload .csv / .parquet
          <input
            type="file"
            accept=".csv,.tsv,.txt,.parquet"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </label>
        <div className="cv-delimiter-control">
          <label>Delimitador:</label>
          <select
            value={delimiter}
            onChange={(e) => {
              setDelimiter(e.target.value)
              setSortCol(null)
              setVisibleRows(ROWS_PER_PAGE)
            }}
          >
            <option value=",">{delimiterLabel(',')}</option>
            <option value={'\t'}>{delimiterLabel('\t')}</option>
            <option value=";">{delimiterLabel(';')}</option>
            <option value="|">{delimiterLabel('|')}</option>
          </select>
        </div>
        <button className="cv-btn cv-btn-secondary" onClick={() => { setCsv(''); setSortCol(null); setSizeWarning(false) }}>
          Limpar
        </button>

        {parsed && (
          <span className="cv-status valid">
            ✓ {parsed.rows.length} linhas, {parsed.headers.length} colunas
          </span>
        )}
      </div>

      {/* Editor */}
      <textarea
        className="cv-textarea"
        value={csv}
        onChange={(e) => handleCsvChange(e.target.value)}
        placeholder="Cole ou digite seu CSV aqui, ou faca upload de um arquivo .csv / .parquet..."
        spellCheck={false}
      />
      {csv && (
        <div className="cv-copy-row">
          <CopyButton text={quotedCSV || csv} label='⎘ Copy (quoted)' />
        </div>
      )}

      {/* Tabs */}
      {parsed && (
        <>
          <div className="cv-tabs">
            <button
              className={`cv-tab ${tab === 'table' ? 'active' : ''}`}
              onClick={() => setTab('table')}
            >
              Tabela
            </button>
            <button
              className={`cv-tab ${tab === 'search' ? 'active' : ''}`}
              onClick={() => setTab('search')}
            >
              Buscar
            </button>
            <button
              className={`cv-tab ${tab === 'stats' ? 'active' : ''}`}
              onClick={() => setTab('stats')}
            >
              Stats
            </button>
          </div>

          {/* Search input */}
          {tab === 'search' && (
            <div className="cv-search-bar">
              <input
                type="text"
                className="cv-search-input"
                placeholder="Filtrar linhas por texto..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setVisibleRows(ROWS_PER_PAGE) }}
                autoFocus
              />
              {searchQuery && (
                <span className="cv-search-count">
                  {searchResults.length} resultado(s)
                </span>
              )}
            </div>
          )}

          {/* Table view */}
          {(tab === 'table' || tab === 'search') && (
            <div className="cv-table-wrap">
              <table className="cv-table">
                <thead>
                  <tr>
                    <th className="cv-row-num">#</th>
                    {parsed.headers.map((h, i) => (
                      <th
                        key={i}
                        className="cv-sortable"
                        onClick={() => handleSort(i)}
                        title={`Ordenar por ${h}`}
                      >
                        {h}
                        {sortCol === i && (
                          <span className="cv-sort-icon">
                            {sortDir === 'asc' ? ' ▲' : ' ▼'}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={parsed.headers.length + 1} className="cv-empty-row">
                        {tab === 'search' ? 'Nenhum resultado encontrado.' : 'Sem dados.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row, ri) => (
                      <tr
                        key={ri}
                        className="cv-row-clickable"
                        onClick={() => setSelectedRow(ri)}
                      >
                        <td className="cv-row-num">{ri + 1}</td>
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            className={isNumeric(cell) ? 'cv-cell-num' : ''}
                            title={cell.length > 60 ? cell : undefined}
                          >
                            {cell.length > 100 ? cell.slice(0, 100) + '...' : cell}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {hasMore && (
                <button
                  className="cv-load-more"
                  onClick={() => setVisibleRows(v => v + ROWS_PER_PAGE)}
                >
                  Carregar mais ({displayRows.length - visibleRows} restantes)
                </button>
              )}
            </div>
          )}

          {/* Stats */}
          {tab === 'stats' && (
            <div className="cv-stats-wrap">
              <CsvStats headers={parsed.headers} rows={parsed.rows} />
              <div className="cv-size-info">
                <span>Tamanho original: <b>{csv.length.toLocaleString()}</b> chars</span>
                <span>Tamanho quoted: <b>{quotedCSV.length.toLocaleString()}</b> chars</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Compare toggle */}
      <div className="cv-compare-bar">
        <button
          className={`cv-btn ${showCompare ? 'cv-btn-danger' : 'cv-btn-primary'}`}
          onClick={() => setShowCompare(!showCompare)}
        >
          {showCompare ? '✕ Fechar Compare' : '↔ Compare'}
        </button>
      </div>

      {/* Row Detail Modal */}
      {selectedRow !== null && parsed && displayRows[selectedRow] && (
        <RowDetailModal
          headers={parsed.headers}
          row={displayRows[selectedRow]}
          rowIndex={selectedRow}
          delimiter={delimiter}
          onClose={() => setSelectedRow(null)}
          onSave={(newRow) => handleRowSave(selectedRow, newRow)}
        />
      )}

      {/* Compare section */}
      {showCompare && (
        <>
          <h2 className="cv-section-title">CSV para comparar</h2>
          <textarea
            className="cv-textarea"
            value={compareText}
            onChange={(e) => setCompareText(e.target.value)}
            placeholder="Cole o segundo CSV aqui para comparar..."
            spellCheck={false}
          />
          {compareText && <CopyButton text={compareText} />}

          <h2 className="cv-section-title">Diff</h2>
          <div className="cv-diff">
            {diffResult && diffResult.map((part, i) => (
              <div
                key={i}
                className={`cv-diff-line ${
                  part.added ? 'added' : part.removed ? 'removed' : 'neutral'
                }`}
              >
                {part.value}
              </div>
            ))}
            {(!diffResult || diffResult.length === 0) && (
              <p className="cv-diff-empty">
                Digite CSV em ambos os campos para ver o diff.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
