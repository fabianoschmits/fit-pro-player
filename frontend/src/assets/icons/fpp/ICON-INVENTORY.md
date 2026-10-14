# FPP Icon Inventory

| Nome do ícone | Arquivo | Categoria | Significado | Onde será utilizado | Existente / Novo | Status |
|---|---|---|---|---|---|---|
| workout-push | `workouts/workout-push.svg` | workout | Treino de empurrar | Plano | Novo | Fundação |
| workout-pull | `workouts/workout-pull.svg` | workout | Treino de puxar | Plano | Novo | Fundação |
| workout-legs | `workouts/workout-legs.svg` | workout | Treino de pernas | Plano | Novo | Fundação |
| body-map | `frontend/src/components/BodyMap.jsx` | body | Mapa corporal frente/costas | Body Progress, estatísticas | Existente | Preservar |
| exercise-muscle-map | `frontend/src/lib/body-paths.js` | muscle/body | Regiões musculares desenhadas | Exercícios e BodyMap | Existente | Referência futura |
| plan-day-icon | `frontend/src/views/Plan.jsx` | ui/workout | Slot de ícone do dia | Plano | Existente | Integração futura |
| daily-plan-icon | `frontend/src/views/Home.jsx` | ui/workout | Ícone do treino do dia | Home | Existente | Integração futura |
| generic inline icons | `frontend/src/**/*.jsx` | ui | Ações, navegação e estados | Várias telas | Existente | Não substituir automaticamente |
| exercise sprites | `frontend/src/lib/exercise-guide-assets.js` | exercise | Demonstrações de exercícios | Exercícios | Existente | Fora do escopo |

Canonical muscle identifiers are documented in `frontend/src/lib/muscles.js`:
`trapezius`, `deltoids`, `chest`, `upper-back`, `serratus`, `biceps`, `triceps`,
`forearm`, `abs`, `obliques`, `lower-back`, `gluteal`, `quadriceps`, `hamstring`,
`adductors`, `hip-flexors`, `calves`, and `tibialis`.
