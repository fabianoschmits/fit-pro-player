# Repository Cleanup and README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover artefatos comprovadamente mortos ou temporários, alinhar documentação e entregar um README fiel ao Fit Pro Player atual.

**Architecture:** A limpeza será guiada por referências reais: primeiro inventariar arquivos rastreados e consumidores, depois remover apenas candidatos sem uso confirmado. O README será refeito a partir dos scripts, configuração Vercel, frontend, Supabase, Capacitor e documentação mantida.

**Tech Stack:** Git, PowerShell, React 19, Vite, Vitest, Capacitor, Supabase, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-14-repository-cleanup-and-readme-design.md`

## Global Constraints

- Não remover código, migrations, assets, testes ou configuração usada em runtime, deploy ou validação.
- Não alterar comportamento do produto como parte da limpeza.
- Não versionar `.env`, dados, builds, dependências ou logs locais.
- O logo do topo do README será `assets/brand/final/web/brand-logo.svg`, centralizado e sem repetir o nome da marca em texto.
- O site documentado será `https://www.fitpp.com.br`.
- Commits finais devem ser enviados para `main` e `master`.

## Review Focus

- Arquivos carregados por caminhos dinâmicos ou referenciados somente em configuração/build.
- Assets de exercícios e marca usados fora de imports estáticos.
- Scripts de auditoria que ainda são chamados por `package.json`, CI ou documentação.
- Documentação que descreve funcionalidades removidas ou ambientes antigos.
- Diferenças entre `main`, `master`, Vercel e arquivos efetivamente rastreados.

### Task 1: Evidence inventory

**Files:**
- Create: `docs/repository-cleanup-audit.md`
- Inspect: `package.json`, `frontend/package.json`, `vercel.json`, `.github/`, `docs/`, `frontend/src/`, `frontend/public/`, `assets/`, `supabase/`

**Interfaces:**
- Produces: a classified list of `remove`, `keep`, and `review` candidates with reference evidence.

- [ ] Inventory tracked files by root, type, size and generated/temporary pattern.
- [ ] Trace imports, dynamic asset paths, package scripts, CI, Vercel and documentation references.
- [ ] Record every candidate and the reason it is safe, required, or ambiguous.
- [ ] Commit the audit before destructive cleanup.

### Task 2: Remove confirmed repository debris

**Files:**
- Delete: only paths classified `remove` in `docs/repository-cleanup-audit.md`
- Modify: `.gitignore`, `.vercelignore` only when needed to prevent recurrence

**Interfaces:**
- Consumes: Task 1 audit classifications.
- Produces: a smaller tracked repository with no broken references.

- [ ] Recheck each candidate immediately before deletion.
- [ ] Remove scratch scripts, completed audits, stale generated artifacts and duplicate files only when unreferenced.
- [ ] Keep ambiguous brand concepts, native resources, exercise media and operational docs unless evidence proves they are unused.
- [ ] Run a repository-wide reference search after deletion.
- [ ] Commit cleanup separately from README changes.

### Task 3: Rewrite README and repository entry points

**Files:**
- Modify: `README.md`
- Inspect/modify: `assets/banner.svg`, `assets/brand/final/web/brand-logo.svg`, `vercel.json`, root `package.json`

**Interfaces:**
- Consumes: Task 1 architecture inventory and Task 2 final repository contents.
- Produces: README whose commands, links, architecture and directories match the repository.

- [ ] Replace the README content with a concise Portuguese guide for the current product.
- [ ] Put the official logo centered at the top without duplicating its wordmark in text.
- [ ] Document the real local setup, environment variables, tests, build, Vercel deployment, Supabase migrations, mobile build and security boundaries.
- [ ] Remove claims about absent API, Docker, self-hosting or professional capabilities unless verified in the current tree.
- [ ] Link the production site as `https://www.fitpp.com.br`.
- [ ] Commit documentation separately.

### Task 4: Full verification and branch synchronization

**Files:**
- Modify: none unless verification exposes a broken reference caused by cleanup.

- [ ] Run `npm test` and record the exact result.
- [ ] Run `npm run build` and record the exact result.
- [ ] Run `npm run check:supabase`.
- [ ] Run `npm run check:database` when the configured database test environment is available.
- [ ] Run final reference, tracked-file and secret scans.
- [ ] Push the validated commits to `main` and cherry-pick the same changes to `master`.
- [ ] Confirm clean working tree and matching remote branch state.
