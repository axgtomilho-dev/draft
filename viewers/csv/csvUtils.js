/* ── CSV parsing utilities ── */

export function detectDelimiter(text) {
  const lines = text.split('\n').slice(0, 5).filter(l => l.trim())
  if (lines.length === 0) return ','

  const delimiters = [',', '\t', ';', '|']
  let best = ','
  let bestScore = -1

  for (const d of delimiters) {
    const counts = lines.map(line => {
      let count = 0
      let inQuotes = false
      for (const char of line) {
        if (char === '"') inQuotes = !inQuotes
        else if (char === d && !inQuotes) count++
      }
      return count
    })

    const avg = counts.reduce((a, b) => a + b, 0) / counts.length
    const allSame = counts.length > 1 && counts.every(c => c === counts[0])
    const score = avg * (allSame ? 2 : 1)

    if (score > bestScore) {
      bestScore = score
      best = d
    }
  }

  return best
}

export function parseCSV(text, delimiter = ',') {
  const rows = []
  let current = ''
  let inQuotes = false
  let row = []

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === delimiter) {
        row.push(current)
        current = ''
      } else if (char === '\r' && next === '\n') {
        row.push(current)
        current = ''
        if (row.some(c => c.trim())) rows.push(row)
        row = []
        i++
      } else if (char === '\n') {
        row.push(current)
        current = ''
        if (row.some(c => c.trim())) rows.push(row)
        row = []
      } else {
        current += char
      }
    }
  }

  if (current || row.length) {
    row.push(current)
    if (row.some(c => c.trim())) rows.push(row)
  }

  return rows
}

export function isNumeric(val) {
  if (val === null || val === undefined || val === '') return false
  return /^-?\d+\.?\d*([eE][+-]?\d+)?$/.test(val.trim())
}

export function formatCellForCopy(value) {
  if (value === null || value === undefined) return '""'
  const str = String(value)
  if (str === '') return '""'
  if (isNumeric(str)) return str.trim()
  return `"${str.replace(/"/g, '""')}"`
}

export function toQuotedCSV(headers, rows, delimiter = ',') {
  const headerLine = headers.map(formatCellForCopy).join(delimiter)
  const dataLines = rows.map(row =>
    row.map(formatCellForCopy).join(delimiter)
  )
  return [headerLine, ...dataLines].join('\n')
}

export function delimiterLabel(d) {
  if (d === ',') return 'Virgula (,)'
  if (d === '\t') return 'Tab'
  if (d === ';') return 'Ponto e virgula (;)'
  if (d === '|') return 'Pipe (|)'
  return d
}
