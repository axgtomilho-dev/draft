import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RowDetailModal, { detectValueType, formatStructured } from './RowDetailModal'

/* ── detectValueType ── */
describe('detectValueType', () => {
  it('returns "empty" for empty/blank values', () => {
    expect(detectValueType('')).toBe('empty')
    expect(detectValueType('   ')).toBe('empty')
    expect(detectValueType(null)).toBe('empty')
    expect(detectValueType(undefined)).toBe('empty')
  })

  it('returns "number" for numeric values', () => {
    expect(detectValueType('42')).toBe('number')
    expect(detectValueType('-3.14')).toBe('number')
    expect(detectValueType('1e10')).toBe('number')
    expect(detectValueType('  100  ')).toBe('number')
  })

  it('returns "date" for ISO date-like values', () => {
    expect(detectValueType('2026-05-23')).toBe('date')
    expect(detectValueType('2026-05-23 10:30:00')).toBe('date')
    expect(detectValueType('  2024-01-01T00:00:00Z  ')).toBe('date')
  })

  it('returns "structured" for JSON objects/arrays', () => {
    expect(detectValueType('{"key":"value"}')).toBe('structured')
    expect(detectValueType('[1,2,3]')).toBe('structured')
    expect(detectValueType('{"a":1}')).toBe('structured')
  })

  it('returns "structured" for Athena-style objects', () => {
    expect(detectValueType('{customer={id=1001,name=Joao}}')).toBe('structured')
    expect(detectValueType('[{orderId=5001}]')).toBe('structured')
  })

  it('returns "long" for strings longer than 80 chars', () => {
    const longStr = 'a'.repeat(81)
    expect(detectValueType(longStr)).toBe('long')
  })

  it('returns "string" for regular text', () => {
    expect(detectValueType('hello')).toBe('string')
    expect(detectValueType('Pedido A')).toBe('string')
    expect(detectValueType('short text here')).toBe('string')
  })
})

/* ── formatStructured ── */
describe('formatStructured', () => {
  it('formats JSON with indentation', () => {
    const input = '{"name":"Alice","age":30}'
    const result = formatStructured(input)
    expect(result).toBe(JSON.stringify(JSON.parse(input), null, 2))
  })

  it('formats nested JSON', () => {
    const input = '{"user":{"name":"Bob","items":[1,2]}}'
    const result = formatStructured(input)
    expect(result).toBe(JSON.stringify(JSON.parse(input), null, 2))
  })

  it('formats Athena-style with indentation', () => {
    const input = '{key=val,nested={a=1,b=2}}'
    const result = formatStructured(input)
    // Should contain line breaks and indentation
    expect(result).toContain('key=val')
    expect(result).toContain('\n')
    expect(result.split('\n').length).toBeGreaterThan(1)
  })

  it('handles Athena arrays', () => {
    const input = '[{id=1},{id=2}]'
    const result = formatStructured(input)
    expect(result).toContain('id=1')
    expect(result).toContain('id=2')
    expect(result).toContain('\n')
  })
})

/* ── RowDetailModal component ── */
const writeTextMock = vi.fn(() => Promise.resolve())

describe('RowDetailModal', () => {
  const defaultProps = {
    headers: ['id', 'name', 'amount', 'date'],
    row: ['1', 'Alice', '159.90', '2026-05-23 10:30:00'],
    rowIndex: 0,
    delimiter: ',',
    onClose: vi.fn(),
    onSave: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    writeTextMock.mockClear()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    })
  })

  function renderModal(props = {}) {
    return render(<RowDetailModal {...defaultProps} {...props} />)
  }

  it('renders modal with row number in header', () => {
    renderModal()
    expect(screen.getByText('Linha 1')).toBeDefined()
  })

  it('renders correct row number for other indices', () => {
    renderModal({ rowIndex: 4 })
    expect(screen.getByText('Linha 5')).toBeDefined()
  })

  it('renders all field names', () => {
    renderModal()
    const fieldNames = document.querySelectorAll('.cv-modal-field-name')
    const names = Array.from(fieldNames).map(el => el.textContent)
    expect(names).toEqual(['id', 'name', 'amount', 'date'])
  })

  it('shows correct type badges', () => {
    renderModal()
    const typeBadges = document.querySelectorAll('.cv-modal-field-type')
    const types = Array.from(typeBadges).map(el => el.textContent)
    expect(types).toEqual(['number', 'string', 'number', 'date'])
  })

  it('renders input fields for simple values', () => {
    renderModal()
    const inputs = document.querySelectorAll('.cv-modal-field-input')
    expect(inputs.length).toBe(4) // all 4 are simple fields
  })

  it('renders textarea for structured data', () => {
    renderModal({
      headers: ['id', 'payload'],
      row: ['1', '{customer={id=1001,name=Joao}}'],
    })
    const textareas = document.querySelectorAll('.cv-modal-field-textarea')
    expect(textareas.length).toBe(1)

    // Should also show the structured preview
    const preview = document.querySelector('.cv-modal-field-preview')
    expect(preview).not.toBeNull()
    expect(preview.textContent).toContain('customer')
  })

  it('renders textarea for long text', () => {
    const longText = 'x'.repeat(100)
    renderModal({
      headers: ['id', 'desc'],
      row: ['1', longText],
    })
    const textareas = document.querySelectorAll('.cv-modal-field-textarea')
    expect(textareas.length).toBe(1)
  })

  it('shows CSV preview line at the bottom', () => {
    renderModal()
    const preview = document.querySelector('.cv-modal-preview-line')
    expect(preview).not.toBeNull()
    // Preview should use formatCellForCopy: numbers bare, strings quoted
    expect(preview.textContent).toContain('1')
    expect(preview.textContent).toContain('"Alice"')
    expect(preview.textContent).toContain('159.90')
  })

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderModal({ onClose })

    await user.click(screen.getByText('✕'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when "Fechar" button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderModal({ onClose })

    await user.click(screen.getByText('Fechar'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when ESC key is pressed', () => {
    const onClose = vi.fn()
    renderModal({ onClose })

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when clicking on overlay background', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderModal({ onClose })

    const overlay = document.querySelector('.cv-modal-overlay')
    await user.click(overlay)
    expect(onClose).toHaveBeenCalled()
  })

  it('does NOT call onClose when clicking inside the modal', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderModal({ onClose })

    const modal = document.querySelector('.cv-modal')
    await user.click(modal)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not show "Aplicar alteracoes" button before any edits', () => {
    renderModal()
    expect(screen.queryByText('Aplicar alteracoes')).toBeNull()
  })

  it('shows "editado" badge and "Aplicar alteracoes" after editing a field', async () => {
    const user = userEvent.setup()
    renderModal()

    const inputs = document.querySelectorAll('.cv-modal-field-input')
    const nameInput = inputs[1] // name field
    await user.clear(nameInput)
    await user.type(nameInput, 'Charlie')

    expect(screen.getByText('editado')).toBeDefined()
    expect(screen.getByText('Aplicar alteracoes')).toBeDefined()
  })

  it('updates preview line when fields are edited', async () => {
    const user = userEvent.setup()
    renderModal()

    const inputs = document.querySelectorAll('.cv-modal-field-input')
    const nameInput = inputs[1] // name field
    await user.clear(nameInput)
    await user.type(nameInput, 'Charlie')

    const preview = document.querySelector('.cv-modal-preview-line')
    expect(preview.textContent).toContain('"Charlie"')
    expect(preview.textContent).not.toContain('"Alice"')
  })

  it('calls onSave and onClose when "Aplicar alteracoes" is clicked', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const onClose = vi.fn()
    renderModal({ onSave, onClose })

    const inputs = document.querySelectorAll('.cv-modal-field-input')
    await user.clear(inputs[1])
    await user.type(inputs[1], 'Charlie')

    await user.click(screen.getByText('Aplicar alteracoes'))

    expect(onSave).toHaveBeenCalledOnce()
    const savedRow = onSave.mock.calls[0][0]
    expect(savedRow[0]).toBe('1')
    expect(savedRow[1]).toBe('Charlie')
    expect(savedRow[2]).toBe('159.90')

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('copies preview line and shows feedback after copy', async () => {
    const user = userEvent.setup()
    renderModal()

    const copyBtn = screen.getByText('⎘ Copiar linha')
    await user.click(copyBtn)

    // Should show success feedback
    await waitFor(() => {
      expect(screen.getByText('✓ Copiado!')).toBeDefined()
    })
  })

  it('renders empty field as type "empty"', () => {
    renderModal({
      headers: ['a', 'b'],
      row: ['hello', ''],
    })
    const types = document.querySelectorAll('.cv-modal-field-type')
    const typeTexts = Array.from(types).map(el => el.textContent)
    expect(typeTexts).toEqual(['string', 'empty'])
  })

  it('uses the delimiter in preview line', () => {
    renderModal({
      headers: ['a', 'b'],
      row: ['1', 'test'],
      delimiter: ';',
    })
    const preview = document.querySelector('.cv-modal-preview-line')
    expect(preview.textContent).toBe('1;"test"')
  })

  it('handles structured JSON field with pretty-print preview', () => {
    const jsonPayload = '{"name":"Alice","age":30}'
    renderModal({
      headers: ['id', 'data'],
      row: ['1', jsonPayload],
    })

    const preview = document.querySelector('.cv-modal-field-preview')
    expect(preview).not.toBeNull()
    // Should be pretty-printed JSON
    expect(preview.textContent).toContain('"name": "Alice"')
    expect(preview.textContent).toContain('"age": 30')
  })
})
