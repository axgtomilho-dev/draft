import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CsvViewerPage from './CsvViewerPage'

const SIMPLE_CSV = 'id,name,amount\n1,Alice,100\n2,Bob,200\n3,Carol,300'
const SEMICOLON_CSV = 'id;name;amount\n1;Alice;100\n2;Bob;200'

function renderPage() {
  return render(<CsvViewerPage />)
}

async function pasteCSV(user, csv) {
  const textarea = screen.getByPlaceholderText(/Cole ou digite/i)
  await user.clear(textarea)
  await user.type(textarea, csv)
}

describe('CsvViewerPage', () => {
  beforeEach(() => {
    localStorage.clear()
    // Mock clipboard (navigator.clipboard is a getter-only property in jsdom)
    const clipboardMock = { writeText: vi.fn(() => Promise.resolve()) }
    Object.defineProperty(navigator, 'clipboard', {
      value: clipboardMock,
      writable: true,
      configurable: true,
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the page header', () => {
    renderPage()
    expect(screen.getByText('CSV')).toBeDefined()
    expect(screen.getByText('Viewer')).toBeDefined()
  })

  it('shows session id', () => {
    renderPage()
    const sessionEl = document.querySelector('.cv-session-id')
    expect(sessionEl).not.toBeNull()
    expect(sessionEl.textContent).toMatch(/^#[a-z0-9]{8}$/)
  })

  it('shows empty state with placeholder', () => {
    renderPage()
    const textarea = screen.getByPlaceholderText(/Cole ou digite/i)
    expect(textarea).toBeDefined()
    expect(textarea.value).toBe('')
  })

  it('does not show tabs or table when no CSV is loaded', () => {
    renderPage()
    expect(screen.queryByText('Tabela')).toBeNull()
    expect(screen.queryByText('Buscar')).toBeNull()
    expect(screen.queryByText('Stats')).toBeNull()
  })

  it('parses and renders CSV table after typing', async () => {
    const user = userEvent.setup()
    renderPage()
    await pasteCSV(user, SIMPLE_CSV)

    // Status badge should appear
    await waitFor(() => {
      expect(screen.getByText(/3 linhas/)).toBeDefined()
    })

    // Tab buttons should appear
    expect(screen.getByText('Tabela')).toBeDefined()
    expect(screen.getByText('Buscar')).toBeDefined()
    expect(screen.getByText('Stats')).toBeDefined()

    // Table headers
    expect(screen.getByText('id')).toBeDefined()
    expect(screen.getByText('name')).toBeDefined()
    expect(screen.getByText('amount')).toBeDefined()

    // Data cells
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.getByText('Bob')).toBeDefined()
    expect(screen.getByText('Carol')).toBeDefined()
  })

  it('shows size warning for large CSV', async () => {
    const user = userEvent.setup()
    renderPage()

    // Create a large CSV by repeating rows
    const header = 'col1,col2,col3'
    const row = 'abcdefghijklmnop,qrstuvwxyz,1234567890'
    const largeCsv = [header, ...Array(15000).fill(row)].join('\n')

    const textarea = screen.getByPlaceholderText(/Cole ou digite/i)
    // Directly set value to avoid slow typing
    await user.clear(textarea)
    // Use fireEvent for large text since userEvent.type is too slow
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(textarea, { target: { value: largeCsv } })

    await waitFor(() => {
      expect(screen.getByText(/CSV muito grande/)).toBeDefined()
    }, { timeout: 3000 })
  })

  it('switches to search tab and filters rows', async () => {
    const user = userEvent.setup()
    renderPage()
    await pasteCSV(user, SIMPLE_CSV)

    await waitFor(() => {
      expect(screen.getByText('Buscar')).toBeDefined()
    })

    await user.click(screen.getByText('Buscar'))

    const searchInput = screen.getByPlaceholderText(/Filtrar linhas/i)
    expect(searchInput).toBeDefined()

    await user.type(searchInput, 'Alice')

    await waitFor(() => {
      expect(screen.getByText('1 resultado(s)')).toBeDefined()
    })

    // Only Alice row should be visible
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.queryByText('Bob')).toBeNull()
    expect(screen.queryByText('Carol')).toBeNull()
  })

  it('switches to stats tab and shows column statistics', async () => {
    const user = userEvent.setup()
    renderPage()
    await pasteCSV(user, SIMPLE_CSV)

    await waitFor(() => {
      expect(screen.getByText('Stats')).toBeDefined()
    })

    await user.click(screen.getByText('Stats'))

    await waitFor(() => {
      expect(screen.getByText(/3.*linhas/)).toBeDefined()
      expect(screen.getByText(/3.*colunas/)).toBeDefined()
    })

    // Column stats table headers
    expect(screen.getByText('Coluna')).toBeDefined()
    expect(screen.getByText('Numericos')).toBeDefined()
    expect(screen.getByText('Texto')).toBeDefined()
    expect(screen.getByText('Vazios')).toBeDefined()
  })

  it('clears CSV when "Limpar" button is clicked', async () => {
    const user = userEvent.setup()
    renderPage()
    await pasteCSV(user, SIMPLE_CSV)

    await waitFor(() => {
      expect(screen.getByText(/3 linhas/)).toBeDefined()
    })

    await user.click(screen.getByText('Limpar'))

    const textarea = screen.getByPlaceholderText(/Cole ou digite/i)
    expect(textarea.value).toBe('')
    expect(screen.queryByText('Tabela')).toBeNull()
  })

  it('toggles theme between light and dark', async () => {
    const user = userEvent.setup()
    renderPage()

    const container = document.querySelector('.cv')
    expect(container.getAttribute('data-theme')).toBe('light')

    await user.click(screen.getByText('Dark'))

    expect(container.getAttribute('data-theme')).toBe('dark')
    expect(screen.getByText('Light')).toBeDefined()

    await user.click(screen.getByText('Light'))
    expect(container.getAttribute('data-theme')).toBe('light')
  })

  it('creates a new session when "Nova sessao" is clicked', async () => {
    const user = userEvent.setup()
    renderPage()

    const sessionBefore = document.querySelector('.cv-session-id').textContent

    await user.click(screen.getByText('+ Nova sessao'))

    const sessionAfter = document.querySelector('.cv-session-id').textContent
    expect(sessionAfter).not.toBe(sessionBefore)
  })

  it('toggles compare section', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(screen.queryByText('CSV para comparar')).toBeNull()

    await user.click(screen.getByText(/Compare/))

    expect(screen.getByText('CSV para comparar')).toBeDefined()
    expect(screen.getByText('Diff')).toBeDefined()
  })

  it('sorts columns when header is clicked', async () => {
    const user = userEvent.setup()
    renderPage()
    await pasteCSV(user, SIMPLE_CSV)

    await waitFor(() => {
      expect(screen.getByText('name')).toBeDefined()
    })

    // Click on name header to sort
    await user.click(screen.getByText('name'))

    // Get all name cells - they should be in alphabetical order
    const rows = document.querySelectorAll('.cv-row-clickable')
    const names = Array.from(rows).map(r => r.children[2].textContent) // index 2 is name (after # and id)
    expect(names).toEqual(['Alice', 'Bob', 'Carol'])

    // Click again for descending
    await user.click(screen.getByText('name'))
    const rowsDesc = document.querySelectorAll('.cv-row-clickable')
    const namesDesc = Array.from(rowsDesc).map(r => r.children[2].textContent)
    expect(namesDesc).toEqual(['Carol', 'Bob', 'Alice'])
  })

  it('opens row detail modal when row is clicked', async () => {
    const user = userEvent.setup()
    renderPage()
    await pasteCSV(user, SIMPLE_CSV)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeDefined()
    })

    // Click on the first data row
    const firstRow = document.querySelector('.cv-row-clickable')
    await user.click(firstRow)

    // Modal should appear
    await waitFor(() => {
      expect(screen.getByText('Linha 1')).toBeDefined()
    })

    // Modal should show field names
    expect(screen.getByText('Fechar')).toBeDefined()
  })

  it('changes delimiter via select', async () => {
    const user = userEvent.setup()
    renderPage()

    const textarea = screen.getByPlaceholderText(/Cole ou digite/i)
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(textarea, { target: { value: SEMICOLON_CSV } })

    // Manually trigger delimiter change
    const select = document.querySelector('.cv-delimiter-control select')
    fireEvent.change(select, { target: { value: ';' } })

    await waitFor(() => {
      expect(screen.getByText(/2 linhas/)).toBeDefined()
    })

    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.getByText('Bob')).toBeDefined()
  })
})
