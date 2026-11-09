import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../../components/Icon.jsx'
import ConsoleShell from './ConsoleLayout.jsx'
import { AccessGate, useConsoleAccess } from './ConsoleAccess.jsx'
import { Empty, SectionBody } from './ConsoleUI.jsx'
import {
  ACTIVE_SPRITE_COUNT,
  getExercisePrompt,
  getPendingExercises,
  TOTAL_CATALOGUE_EXERCISES,
} from '../../lib/admin-pending-sprites.js'
import { getExerciseFullPrompt } from '../../lib/exercise-sprite-prompts.js'
import './console-sprites.css'

const COMPLETED_SPRITES_STORAGE_KEY = 'fpp_admin_completed_sprites'
const COPIED_SPRITES_STORAGE_KEY = 'fpp_admin_copied_sprites'
const CUSTOM_TEMPLATE_STORAGE_KEY = 'fpp_admin_sprite_prompt_template'

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
  const [filterMode, setFilterMode] = useState('pending') // 'pending' | 'completed' | 'all' | 'needs_review'
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchInputRef = useRef(null)

  // Feedback state for copied items
  const [activeCopiedFeedback, setActiveCopiedFeedback] = useState(null) // { id, type }

  // Modal / Sheet for viewing full prompt on demand
  const [previewItem, setPreviewItem] = useState(null)
  const [previewPromptText, setPreviewPromptText] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewCopied, setPreviewCopied] = useState(false)

  // Ensure legacy custom template does not silently overwrite official prompts
  useEffect(() => {
    try {
      if (localStorage.getItem(CUSTOM_TEMPLATE_STORAGE_KEY)) {
        localStorage.removeItem(CUSTOM_TEMPLATE_STORAGE_KEY)
      }
    } catch {
      // ignore
    }
  }, [])

  // Load pending list sorted by internet popularity / relevance with new prompt metadata
  const allPendingExercises = useMemo(() => getPendingExercises(), [])

  // Auto focus search field when expanded
  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus()
    }
  }, [searchOpen])

  // Clear temporary "Copiado!" feedback after 2s
  useEffect(() => {
    if (!activeCopiedFeedback) return undefined
    const timer = setTimeout(() => setActiveCopiedFeedback(null), 2000)
    return () => clearTimeout(timer)
  }, [activeCopiedFeedback])

  // Mark as completed
  const markAsCompleted = id => {
    setCompletedMap(prev => {
      const next = { ...prev, [id]: { completedAt: new Date().toISOString() } }
      saveStorageMap(COMPLETED_SPRITES_STORAGE_KEY, next)
      return next
    })
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

  const copyTextToClipboard = text => {
    if (navigator?.clipboard?.writeText) {
      return navigator.clipboard.writeText(text).catch(() => {})
    }
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
    } catch {
      // ignore
    }
    document.body.removeChild(textArea)
    return Promise.resolve()
  }

  // Copy full prepared prompt directly from the official 1.324 prompts catalogue
  const handleCopyPrompt = async item => {
    const promptText = await getExercisePrompt(item)
    if (!promptText || !promptText.trim()) {
      alert(`Prompt não encontrado para o exercício #${item.id} (${item.namePt}).`)
      return
    }

    await copyTextToClipboard(promptText)
    setActiveCopiedFeedback({ id: item.id, type: 'prompt' })
    setCopiedMap(prev => {
      const next = { ...prev, [item.id]: 'prompt' }
      saveStorageMap(COPIED_SPRITES_STORAGE_KEY, next)
      return next
    })
  }

  // Copy ONLY the exercise name in Portuguese
  const handleCopyNamePt = async item => {
    await copyTextToClipboard(item.namePt)
    setActiveCopiedFeedback({ id: item.id, type: 'name' })
    setCopiedMap(prev => {
      const next = { ...prev, [item.id]: 'name' }
      saveStorageMap(COPIED_SPRITES_STORAGE_KEY, next)
      return next
    })
  }

  // Open preview modal for an exercise prompt
  const handleOpenPreview = async item => {
    setPreviewItem(item)
    setPreviewPromptText('')
    setPreviewLoading(true)
    setPreviewCopied(false)
    try {
      const text = await getExerciseFullPrompt(item.id)
      setPreviewPromptText(text || 'Prompt não disponível para este exercício.')
    } catch {
      setPreviewPromptText('Erro ao carregar o prompt do exercício.')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleClosePreview = () => {
    setPreviewItem(null)
    setPreviewPromptText('')
  }

  const handleCopyFromPreview = async () => {
    if (!previewPromptText) return
    await copyTextToClipboard(previewPromptText)
    setPreviewCopied(true)
    if (previewItem) {
      setActiveCopiedFeedback({ id: previewItem.id, type: 'prompt' })
      setCopiedMap(prev => {
        const next = { ...prev, [previewItem.id]: 'prompt' }
        saveStorageMap(COPIED_SPRITES_STORAGE_KEY, next)
        return next
      })
    }
    setTimeout(() => setPreviewCopied(false), 2000)
  }

  const completedCount = useMemo(
    () => Object.keys(completedMap).length,
    [completedMap],
  )
  const remainingCount = Math.max(0, allPendingExercises.length - completedCount)

  // Count exercises with needs_review in the backlog
  const reviewCount = useMemo(
    () => allPendingExercises.filter(ex => ex.needsReview).length,
    [allPendingExercises],
  )

  // Filter based on completion status, review status and search query
  const filteredList = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')

    return allPendingExercises.filter(item => {
      const isDone = Boolean(completedMap[item.id])

      if (filterMode === 'pending' && isDone) return false
      if (filterMode === 'completed' && !isDone) return false
      if (filterMode === 'needs_review' && !item.needsReview) return false

      if (!normalizedQuery) return true

      const text = `${item.id} ${item.namePt} ${item.nameEn} ${item.eq} ${item.bp} ${item.tg} ${item.family}`.toLocaleLowerCase('pt-BR')
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
                1.324 prompts biomecânicos oficiais e individuais integrados. Visualize, confira pendências e copie com um clique.
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
                  placeholder="Buscar por ID (ex: 0755), nome, equipamento, músculo..."
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

          {/* Quick Metrics */}
          <div className="console-sprites-metrics-grid">
            <div className="console-sprites-metric-card is-active-card">
              <span className="console-sprites-metric-val">{ACTIVE_SPRITE_COUNT}</span>
              <strong className="console-sprites-metric-title">Sprites já ativos</strong>
              <small className="console-sprites-metric-sub">Publicados no app</small>
            </div>

            <div className="console-sprites-metric-card is-pending-card">
              <span className="console-sprites-metric-val">{remainingCount}</span>
              <strong className="console-sprites-metric-title">Restantes para desenhar</strong>
              <small className="console-sprites-metric-sub">De {TOTAL_CATALOGUE_EXERCISES} do catálogo</small>
            </div>

            <div className="console-sprites-metric-card is-done-card">
              <span className="console-sprites-metric-val">{completedCount}</span>
              <strong className="console-sprites-metric-title">Marcados como prontos</strong>
              <small className="console-sprites-metric-sub">Salvo localmente</small>
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
                  aria-selected={filterMode === 'needs_review'}
                  className={`console-sprites-tab console-sprites-tab--review ${filterMode === 'needs_review' ? 'is-active' : ''}`}
                  onClick={() => setFilterMode('needs_review')}
                  title="Exercícios que possuem observações ou pendências biomecânicas na fonte"
                >
                  Revisão necessária ({reviewCount})
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
                  : filterMode === 'needs_review'
                  ? 'Exercícios com pendências ou observações na fonte'
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
                    : filterMode === 'needs_review'
                    ? 'Nenhum exercício com pendência nessa seleção.'
                    : 'Todos os exercícios foram marcados como concluídos!'
                }
              />
            ) : (
              <SectionBody className="console-sprites-list">
                {filteredList.map((item, index) => {
                  const isDone = Boolean(completedMap[item.id])
                  const copiedMode = copiedMap[item.id] || null
                  const isCopied = Boolean(copiedMode)
                  const hasPrompt = item.hasPrompt
                  const isNeedsReview = item.needsReview

                  return (
                    <div
                      key={item.id}
                      className={`console-sprite-item ${isDone ? 'is-completed' : ''} ${isCopied ? 'is-item-copied' : ''} ${isNeedsReview ? 'has-review-issue' : ''}`}
                    >
                      <span className="console-sprite-index" title={`Ordem #${index + 1}`}>
                        {index + 1}
                      </span>

                      {/* Action button: mark completed */}
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

                      {/* Exercise Info */}
                      <div className="console-sprite-info">
                        <div className="console-sprite-name-row">
                          <strong className="console-sprite-name-pt">{item.namePt}</strong>
                          <span className="console-sprite-id-badge" title="ID oficial do catálogo">
                            #{item.id}
                          </span>
                          {isCopied && !isDone && (
                            <span className="console-sprite-copied-tag">
                              {copiedMode === 'name' ? 'Nome copiado' : 'Prompt copiado'}
                            </span>
                          )}
                        </div>

                        <span className="console-sprite-name-en">{item.nameEn}</span>

                        {/* Metadata badges: frames, equipment, status */}
                        <div className="console-sprite-meta-row">
                          <span className="console-sprite-meta-pill" title="Equipamento">
                            {item.eq}
                          </span>
                          {item.frameCount && (
                            <span className="console-sprite-meta-pill console-sprite-meta-pill--frames" title="Quantidade recomendada de frames">
                              {item.frameCount} frames
                            </span>
                          )}

                          {/* Status badge: Disponível, Revisão necessária, Ausente */}
                          {hasPrompt ? (
                            isNeedsReview ? (
                              <span
                                className="console-sprite-status-badge is-review"
                                title={item.issues?.join('; ') || 'Revisão biomecânica recomendada'}
                              >
                                ⚠ Revisão necessária
                              </span>
                            ) : (
                              <span className="console-sprite-status-badge is-ready" title="Prompt oficial disponível">
                                ✓ Prompt disponível
                              </span>
                            )
                          ) : (
                            <span className="console-sprite-status-badge is-missing" title="Prompt ausente">
                              ✕ Prompt ausente
                            </span>
                          )}

                          {/* Preview button */}
                          <button
                            type="button"
                            className="console-sprite-preview-link"
                            onClick={() => handleOpenPreview(item)}
                            title="Visualizar prompt completo e instruções de biomecânica"
                          >
                            <Icon name="eye" />
                            <span>Ver prompt</span>
                          </button>
                        </div>

                        {/* Issue description when in review mode */}
                        {isNeedsReview && item.issues && item.issues.length > 0 && (
                          <div className="console-sprite-issue-box">
                            <strong>Atenção:</strong> {item.issues.join(' ')}
                          </div>
                        )}
                      </div>

                      {/* Actions side column */}
                      <div className="console-sprite-actions-col">
                        <div className="console-sprite-copy-group">
                          {/* Copy only Portuguese name button */}
                          {(() => {
                            const isThisJustCopied = activeCopiedFeedback?.id === item.id && activeCopiedFeedback?.type === 'name'
                            const hasBeenCopied = copiedMode === 'name'

                            return (
                              <button
                                type="button"
                                className={`console-sprite-copy-btn console-sprite-copy-btn--name ${hasBeenCopied ? 'is-copied' : ''}`}
                                onClick={() => handleCopyNamePt(item)}
                                title="Clique para copiar novamente o nome em português"
                                aria-label={`Copiar apenas nome de ${item.namePt}`}
                              >
                                <Icon name={hasBeenCopied ? 'check' : 'clipboard'} />
                                <span>{isThisJustCopied ? 'Copiado!' : hasBeenCopied ? 'Já copiado' : 'Copiar nome'}</span>
                              </button>
                            )
                          })()}

                          {/* Copy full sprite prompt button */}
                          {(() => {
                            const isThisJustCopied = activeCopiedFeedback?.id === item.id && activeCopiedFeedback?.type === 'prompt'
                            const hasBeenCopied = copiedMode === 'prompt'

                            return (
                              <button
                                type="button"
                                className={`console-sprite-copy-btn console-sprite-copy-btn--prompt ${hasBeenCopied ? 'is-copied' : ''} ${!hasPrompt ? 'is-disabled' : ''}`}
                                onClick={() => handleCopyPrompt(item)}
                                disabled={!hasPrompt}
                                title={hasPrompt ? 'Clique para copiar o prompt individual oficial' : 'Prompt não disponível'}
                                aria-label={`Copiar prompt de ${item.namePt}`}
                              >
                                <Icon name={hasBeenCopied ? 'check' : 'copy'} />
                                <span>{isThisJustCopied ? 'Copiado!' : hasBeenCopied ? 'Já copiado' : 'Copiar prompt'}</span>
                              </button>
                            )
                          })()}
                        </div>

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

          {/* Modal / Dialog for viewing full prompt on demand */}
          {previewItem && (
            <div className="console-prompt-modal-overlay" onClick={handleClosePreview}>
              <div
                className="console-prompt-modal"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={`Prompt completo do exercício ${previewItem.namePt}`}
              >
                <div className="console-prompt-modal-header">
                  <div>
                    <h3 className="console-prompt-modal-title">
                      #{previewItem.id} — {previewItem.namePt}
                    </h3>
                    <span className="console-prompt-modal-subtitle">
                      {previewItem.nameEn} • {previewItem.eq} • {previewItem.frameCount} frames
                    </span>
                  </div>
                  <button
                    type="button"
                    className="console-prompt-modal-close"
                    onClick={handleClosePreview}
                    aria-label="Fechar pré-visualização"
                  >
                    <Icon name="xmark" />
                  </button>
                </div>

                {previewItem.needsReview && previewItem.issues?.length > 0 && (
                  <div className="console-prompt-modal-alert">
                    <Icon name="alert" />
                    <div>
                      <strong>Atenção biomecânica:</strong> {previewItem.issues.join(' ')}
                    </div>
                  </div>
                )}

                <div className="console-prompt-modal-body">
                  {previewLoading ? (
                    <div className="console-prompt-modal-loading">Carregando prompt completo...</div>
                  ) : (
                    <pre className="console-prompt-modal-text">{previewPromptText}</pre>
                  )}
                </div>

                <div className="console-prompt-modal-footer">
                  <button
                    type="button"
                    className="cx-pill-btn"
                    onClick={handleClosePreview}
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    className={`cx-pill-btn cx-pill-btn--accent ${previewCopied ? 'is-copied' : ''}`}
                    onClick={handleCopyFromPreview}
                    disabled={previewLoading || !previewPromptText}
                  >
                    <Icon name={previewCopied ? 'check' : 'copy'} />
                    <span>{previewCopied ? 'Copiado para a área de transferência!' : 'Copiar prompt completo'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </ConsoleShell>
    </AccessGate>
  )
}
