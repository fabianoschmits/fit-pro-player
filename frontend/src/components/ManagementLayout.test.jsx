// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ManagementLayout from './ManagementLayout.jsx'
import { ManagementAvatar, ManagementEmpty, ManagementPanel, ManagementStatus } from './ManagementUI.jsx'

let root, container
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); container.remove() })
const render = (children, route = '/professional/profile/edit') => act(async () => root.render(<MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>))

describe('management workspace', () => {
  it('provides a contextual header, professional destinations and active profile on an edit deep link', async () => {
    await render(<ManagementLayout title="Editar perfil" subtitle="Sua apresentação" backTo="/professional/profile" action={<a href="/action">Ação</a>}><p>Conteúdo</p></ManagementLayout>)
    expect(container.querySelector('h1').textContent).toBe('Editar perfil')
    expect(container.querySelector('.management-content').textContent).toBe('Conteúdo')
    expect(container.querySelector('[aria-current="page"]').textContent).toBe('Gestão')
    expect(container.querySelector('button[aria-label="Voltar"]')).not.toBeNull()
    expect(container.textContent).toContain('Sua apresentação')
  })
  it('provides student destinations with only materials active on that route', async () => {
    await render(<ManagementLayout audience="student" title="Materiais">Conteúdo</ManagementLayout>, '/student/professionals/materials')
    expect([...container.querySelectorAll('nav a')].map(a => a.getAttribute('href'))).toEqual(['/student/professionals', '/student/professionals/materials', '/student/professionals/add'])
    expect([...container.querySelectorAll('[aria-current="page"]')].map(a => a.textContent)).toEqual(['Materiais'])
  })
  it('keeps the professionals destination active when viewing a linked person', async () => {
    await render(<ManagementLayout audience="student" title="Profissional" />, '/student/professionals/person-1?section=training')
    expect(container.querySelector('[aria-current="page"]').textContent).toBe('Meus profissionais')
  })
  it('allows navigation to be omitted for onboarding', async () => {
    await render(<ManagementLayout title="Criar perfil" nav={false}>Formulário</ManagementLayout>)
    expect(container.querySelector('nav')).toBeNull()
    expect(container.querySelector('.management-content').textContent).toBe('Formulário')
  })
  it('groups content and accessible empty actions with genuine identity initials', async () => {
    await render(<ManagementLayout title="Perfil"><ManagementPanel title="Apresentação" description="Sobre você" action={<a href="/edit">Editar</a>}><ManagementAvatar name="  Ana Paula Silva  " /><ManagementStatus tone="success">Verificado</ManagementStatus></ManagementPanel><ManagementEmpty icon="person" title="Sem perfil" description="Crie sua apresentação" action={<a href="/new">Criar</a>} /></ManagementLayout>)
    expect(container.querySelector('.management-avatar').textContent).toBe('AS')
    expect(container.querySelector('.management-panel h2').textContent).toBe('Apresentação')
    expect(container.querySelector('.management-empty a').textContent).toBe('Criar')
    expect(container.querySelector('.management-status').textContent).toBe('Verificado')
  })
})
