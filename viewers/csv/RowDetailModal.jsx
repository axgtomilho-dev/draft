import { useState, useEffect } from 'react'
import { formatCellForCopy, isNumeric } from './csvUtils'

/* ── Value type detection ── */

export function detectValueType(val) {
  if (val === null || val === undefined || val.trim() === '') return 'empty'
  if (isNumeric(val)) return 'number'
  if (/^\d{4}-\d{2}-\d{2}/.test(val.trim())) return 'date'
  if (/^\{.*\}$/s.test(val.trim()) || /^\[.*\]$/s.test(val.trim())) return 'structured'
  if (val.length > 80) return 'long'
  return 'string'
}

/* ── Structured data pretty-printer ── */

export function formatStructured(val) {
  // Try JSON first
  try {
    const parsed = JSON.parse(val)
    return JSON.stringify(parsed, null, 2)
  } catch {}

  // Athena-style: {key=val, ...} → pretty print
  let depth = 0
  let result = ''
  let i = 0
  while (i < val.length) {
    const ch = val[i]
    if (ch === '{' || ch === '[') {
      result += ch + '\n'
      depth++
      result += '  '.repeat(depth)
    } else if (ch === '}' || ch === ']') {
      result += '\n'
      depth = Math.max(0, depth - 1)
      result += '  '.repeat(depth) + ch
    } else if (ch === ',' && (val[i + 1] === '{' || val[i + 1] === '[')) {
      result += ',\n' + '  '.repeat(depth)
    } else if (ch === ',') {
      result += ',\n' + '  '.repeat(depth)
    } else {
      result += ch
    }
    i++
  }
  return result
}

/* ── Copy button (local) ── */

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

/* ── RowDetailModal ── */

export default function RowDetailModal({ headers, row, rowIndex, onClose, onSave, delimiter }) {
  const [editedRow, setEditedRow] = useState([...row])

  useEffect(() => {
    setEditedRow([...row])
  }, [row])

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handleFieldChange(colIdx, value) {
    setEditedRow(prev => {
      const next = [...prev]
      next[colIdx] = value
      return next
    })
  }

  const hasChanges = editedRow.some((val, i) => val !== row[i])

  const previewLine = editedRow.map(formatCellForCopy).join(delimiter)

  return (
    <div className="cv-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="cv-modal">
        {/* Modal header */}
        <div className="cv-modal-header">
          <h2>Linha {rowIndex + 1}</h2>
          <button className="cv-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Fields */}
        <div className="cv-modal-body">
          {headers.map((header, ci) => {
            const original = row[ci] || ''
            const value = editedRow[ci] || ''
            const type = detectValueType(original)
            const isLargeField = type === 'structured' || type === 'long'
            const changed = value !== original

            return (
              <div key={ci} className={`cv-modal-field ${changed ? 'changed' : ''}`}>
                <div className="cv-modal-field-header">
                  <span className="cv-modal-field-name">{header}</span>
                  <span className={`cv-modal-field-type type-${type}`}>{type}</span>
                  {changed && <span className="cv-modal-field-badge">editado</span>}
                </div>

                {isLargeField ? (
                  <textarea
                    className="cv-modal-field-textarea"
                    value={value}
                    onChange={(e) => handleFieldChange(ci, e.target.value)}
                    rows={Math.min(12, Math.max(3, value.split('\n').length + 1))}
                    spellCheck={false}
                  />
                ) : (
                  <input
                    type="text"
                    className="cv-modal-field-input"
                    value={value}
                    onChange={(e) => handleFieldChange(ci, e.target.value)}
                    spellCheck={false}
                  />
                )}

                {type === 'structured' && (
                  <pre className="cv-modal-field-preview">{formatStructured(original)}</pre>
                )}
              </div>
            )
          })}
        </div>

        {/* Preview */}
        <div className="cv-modal-footer">
          <div className="cv-modal-preview-label">Resultado CSV da linha:</div>
          <pre className="cv-modal-preview-line">{previewLine}</pre>
          <div className="cv-modal-actions">
            <CopyButton text={previewLine} label="⎘ Copiar linha" />
            {hasChanges && (
              <button
                className="cv-btn cv-btn-primary cv-btn-sm"
                onClick={() => { onSave(editedRow); onClose() }}
              >
                Aplicar alteracoes
              </button>
            )}
            <button
              className="cv-btn cv-btn-secondary cv-btn-sm"
              onClick={onClose}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
