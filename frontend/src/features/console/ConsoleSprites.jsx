import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../../components/Icon.jsx'
import ConsoleShell from './ConsoleLayout.jsx'
import { AccessGate, useConsoleAccess } from './ConsoleAccess.jsx'
import { Empty, SectionBody } from './ConsoleUI.jsx'
import {
  ACTIVE_SPRITE_COUNT,
  getPendingExercises,
  TOTAL_CATALOGUE_EXERCISES,
} from '../../lib/admin-pending-sprites.js'
import './console-sprites.css'

const COMPLETED_SPRITES_STORAGE_KEY = 'fpp_admin_completed_sprites'
const COPIED_SPRITES_STORAGE_KEY = 'fpp_admin_copied_sprites'

function readStorageMap(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    return JSON.parse(raw) || {}
  } catch {
    return {}
  }
}

function saveStorageMap(key, map) {
  try {
    localStorage.setItem(key, JSON.stringify(map))
  } catch (error) {
    console.error(`Failed to save ${key} to localStorage`, error)
  }
}

export default function ConsoleSprites() {
  const { userId, allowed } = useConsoleAccess()
  const [completedMap, setCompletedMap] = useState(() => readStorageMap(COMPLETED_SPRITES_STORAGE_KEY))
  const [copiedMap, setCopiedMap] = useState(() => readStorageMap(COPIED_SPRITES_STORAGE_KEY))
  const [filterMode, setFilterMode] = useState('pending') // 'pending' | 'completed' | 'all'
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchInputRef = useRef(null)

  // Load pending list sorted by internet popularity / relevance
  const allPendingExercises = useMemo(() => getPendingExercises(), [])

  // Auto focus search field when expanded
  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus()
    }
  }, [searchOpen])

  // Mark as completed (removes from pending, adds to completed, unmarks copied)
  const markAsCompleted = id => {
    setCompletedMap(prev => {
      const next = { ...prev, [id]: { completedAt: new Date().toISOString() } }
      saveStorageMap(COMPLETED_SPRITES_STORAGE_KEY, next)
      return next
    })
    // Unmark copied once marked as done
    setCopiedMap(prev => {
      if (!prev[id]) return prev
      const next = { ...prev }
      delete next[id]
      saveStorageMap(COPIED_SPRITES_STORAGE_KEY, next)
      return next
    })
  }

  // Restore exercise back to pending list
  const restoreToPending = id => {
    setCompletedMap(prev => {
      if (!prev[id]) return prev
      const next = { ...prev }
      delete next[id]
      saveStorageMap(COMPLETED_SPRITES_STORAGE_KEY, next)
      return next
    })
  }

  // Copy exercise name and keep marked as copied until marked as done
  const handleCopyName = (id, namePt, nameEn) => {
    const textToCopy = `${namePt} (${nameEn})`
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy).catch(() => {})
    } else {
      const textArea = document.createElement('textarea')
      textArea.value = textToCopy
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
      } catch {
        // ignore
      }
      document.body.removeChild(textArea)
    }

    setCopiedMap(prev => {
      const next = { ...prev, [id]: true }
      saveStorageMap(COPIED_SPRITES_STORAGE_KEY, next)
      return next
    })
  }

  const completedCount = useMemo(
    () => Object.keys(completedMap).length,
    [completedMap],
  )
  const remainingCount = Math.max(0, allPendingExercises.length - completedCount)

  // Filter based on completion status and search query
  const filteredList = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')

    return allPendingExercises.filter(item => {
      const isDone = Boolean(completedMap[item.id])

      if (filterMode === 'pending' && isDone) return false
      if (filterMode === 'completed' && !isDone) return false

      if (!normalizedQuery) return true

      const text = `${item.namePt} ${item.nameEn} ${item.eq} ${item.bp} ${item.tg}`.toLocaleLowerCase('pt-BR')
      return text.includes(normalizedQuery)
    })
  }, [allPendingExercises, completedMap, filterMode, query])

  return (
    <AccessGate allowed={allowed}>
      <ConsoleShell userId={userId} allowed={allowed} back="/console" backLabel="Visão geral">
        <div className="cx-page-body fpp-console-page fpp-console-page--sprites">
          <div className="cx-page-head console-page-heading">
            <div>
              <h1 className="cx-page-title">Fila de criação de sprites</h1>
              <p className="cx-page-sub">
                Organize e acompanhe os exercícios que ainda não possuem animações (sprites) desenhadas.
              </p>
            </div>

            <div className="console-sprites-head-actions">
              <button
                type="button"
                className={`cx-pill-btn ${searchOpen ? 'cx-pill-btn--accent' : ''}`}
                onClick={() => {
                  setSearchOpen(prev => !prev)
                  if (searchOpen) setQuery('')
                }}
                aria-label="Abrir ou fechar busca de exercícios"
                aria-expanded={searchOpen}
              >
                <Icon name="magnifier" />
                <span>{searchOpen ? 'Fechar busca' : 'Buscar exercício'}</span>
              </button>
            </div>
          </div>

          {/* Collapsible search bar */}
          {searchOpen && (
            <div className="console-sprites-search-wrap" role="search">
              <div className="console-sprites-search-bar">
                <Icon name="magnifier" className="console-sprites-search-icon" />
                <input
                  ref={searchInputRef}
                  type="search"
                  className="cx-field console-sprites-search-input"
                  placeholder="Buscar pelo nome do exercício em português ou inglês, equipamento..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  aria-label="Pesquisar exercícios"
                />
                {query && (
                  <button
                    type="button"
                    className="console-sprites-search-clear"
                    onClick={() => setQuery('')}
                    aria-label="Limpar texto da busca"
                  >
                    <Icon name="xmark" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Quick Metrics: Compact, side-by-side, centered with legible small text */}
          <div className="console-sprites-metrics-grid">
            <div className="console-sprites-metric-card is-active-card">
              <span className="console-sprites-metric-val">{ACTIVE_SPRITE_COUNT}</span>
              <strong className="console-sprites-metric-title">Sprites já ativos</strong>
              <small className="console-sprites-metric-sub">No app de {TOTAL_CATALOGUE_EXERCISES} do catálogo</small>
            </div>

            <div className="console-sprites-metric-card is-pending-card">
              <span className="console-sprites-metric-val">{remainingCount}</span>
              <strong className="console-sprites-metric-title">Restantes para desenhar</strong>
              <small className="console-sprites-metric-sub">Ordenados por relevância e busca</small>
            </div>

            <div className="console-sprites-metric-card is-done-card">
              <span className="console-sprites-metric-val">{completedCount}</span>
              <strong className="console-sprites-metric-title">Marcados como prontos</strong>
              <small className="console-sprites-metric-sub">Salvo automaticamente</small>
            </div>
          </div>

          {/* Filter options bar */}
          <section className="console-filter-section" aria-label="Filtros da lista">
            <div className="console-sprites-filter-bar">
              <div className="console-sprites-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={filterMode === 'pending'}
                  className={`console-sprites-tab ${filterMode === 'pending' ? 'is-active' : ''}`}
                  onClick={() => setFilterMode('pending')}
                >
                  Pendentes ({remainingCount})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filterMode === 'completed'}
                  className={`console-sprites-tab ${filterMode === 'completed' ? 'is-active' : ''}`}
                  onClick={() => setFilterMode('completed')}
                >
                  Já feitos ({completedCount})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filterMode === 'all'}
                  className={`console-sprites-tab ${filterMode === 'all' ? 'is-active' : ''}`}
                  onClick={() => setFilterMode('all')}
                >
                  Todos ({allPendingExercises.length})
                </button>
              </div>

              <span className="console-sprites-count-tag">
                Exibindo {filteredList.length} exercício{filteredList.length === 1 ? '' : 's'}
              </span>
            </div>
          </section>

          {/* Exercise list */}
          <section aria-label="Lista de exercícios">
            <div className="console-list-heading">
              <h2>
                {filterMode === 'completed'
                  ? 'Exercícios já feitos'
                  : 'Exercícios sem sprites (ordenados por relevância)'}
              </h2>
            </div>

            {filteredList.length === 0 ? (
              <Empty
                title="Nenhum exercício encontrado"
                sub={
                  query
                    ? 'Tente buscar com outro termo ou limpe a busca.'
                    : filterMode === 'completed'
                    ? 'Você ainda não marcou nenhum exercício como concluído.'
                    : 'Todos os exercícios foram marcados como concluídos!'
                }
              />
            ) : (
              <SectionBody className="console-sprites-list">
                {filteredList.map((item, index) => {
                  const isDone = Boolean(completedMap[item.id])
                  const isCopied = Boolean(copiedMap[item.id])

                  return (
                    <div
                      key={item.id}
                      className={`console-sprite-item ${isDone ? 'is-completed' : ''} ${isCopied ? 'is-item-copied' : ''}`}
                    >
                      <span className="console-sprite-index" title={`Ordem #${index + 1}`}>
                        {index + 1}
                      </span>

                      {/* Action button: in pending list, clicking + marks as done and moves it to completed */}
                      {!isDone ? (
                        <button
                          type="button"
                          className="console-sprite-check-btn"
                          onClick={() => markAsCompleted(item.id)}
                          title="Marcar como feito (move para Já feitos)"
                          aria-label={`Marcar ${item.namePt} como feito`}
                        >
                          <Icon name="plus" />
                        </button>
                      ) : (
                        <span className="console-sprite-done-badge" title="Já concluído">
                          <Icon name="check" />
                        </span>
                      )}

                      {/* Exercise Name (PT + EN) */}
                      <div className="console-sprite-info">
                        <div className="console-sprite-name-row">
                          <strong className="console-sprite-name-pt">{item.namePt}</strong>
                          {isCopied && !isDone && (
                            <span className="console-sprite-copied-tag">Copiado</span>
                          )}
                        </div>
                        <span className="console-sprite-name-en">{item.nameEn}</span>
                      </div>

                      {/* Actions side column */}
                      <div className="console-sprite-actions-col">
                        {/* Copy name button */}
                        <button
                          type="button"
                          className={`console-sprite-copy-btn ${isCopied ? 'is-copied' : ''}`}
                          onClick={() => handleCopyName(item.id, item.namePt, item.nameEn)}
                          title="Copiar nome do exercício"
                          aria-label={`Copiar nome de ${item.namePt}`}
                        >
                          <Icon name={isCopied ? 'check' : 'copy'} />
                          <span>{isCopied ? 'Copiado' : 'Copiar'}</span>
                        </button>

                        {/* In completed list: button to restore back to pending list */}
                        {isDone && (
                          <button
                            type="button"
                            className="console-sprite-restore-btn"
                            onClick={() => restoreToPending(item.id)}
                            title="Voltar para a lista de não feitos"
                            aria-label={`Voltar ${item.namePt} para não feitos`}
                          >
                            <Icon name="reset" />
                            <span>Voltar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </SectionBody>
            )}
          </section>
        </div>
      </ConsoleShell>
    </AccessGate>
  )
}
