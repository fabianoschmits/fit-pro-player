// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { AccountAssociationSheet } from './AccountAssociationSheet.jsx'

describe('AccountAssociationSheet', () => {
  it('offers explicit device, cloud and separate choices', () => {
    const onChoice = vi.fn().mockResolvedValue(undefined)
    const container = document.createElement('div')
    const root = createRoot(container)
    document.body.appendChild(container)
    act(() => root.render(<AccountAssociationSheet close={vi.fn()} onChoice={onChoice} />))
    expect(container.textContent).toContain('Usar dados deste dispositivo')
    expect(container.textContent).toContain('Usar dados da nuvem')
    expect(container.textContent).toContain('Manter separados')
    act(() => [...container.querySelectorAll('button')].find(button => button.textContent.includes('Manter separados')).click())
    expect(onChoice).toHaveBeenCalledWith('keep-separate')
    act(() => root.unmount())
  })
})
