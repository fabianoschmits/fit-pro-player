# Hyperframes Composition Brief: Fit Pro Player

## Objetivo e saída

Executar o storyboard de `brag-plan.md` como filme vertical 1080 × 1920, 30 fps, 20 segundos, em português brasileiro. Composição em `composition/`; entrega final em `brag.mp4` e `brag.jpg`. Trabalho local, com edição/renderização autorizadas pelo pedido de instalar brag e continuar o vídeo existente.

## Fontes e conteúdo

Raiz: `C:/MeusProjetos/Fitproplayer`. Ler o plano para os arquivos de origem. Usar logo PNG oficial, frames originais de Supino reto e geometria de `body-paths.js`. Recriar elementos específicos das prévias públicas de `Landing.jsx`, mantendo os números exemplificativos do código; não acessar contas nem dados reais.

Copy obrigatório: “Treine com contexto.”, “Dia de Peito”, “Começar”, “Supino reto”, “Volume bem distribuído”, “Recuperação em andamento”, “Evolua com clareza.” e `fitpp.com.br`.

## Direção

Preset polished, com personalidade esportiva do mascote. Interface e anatomia grandes, tipografia legível, cortes ligados às ações. Preservar preto, branco e teal #0F8B8D da aplicação; usar variante teal clara somente para garantir contraste de texto. Não transformar anatomia em forma abstrata ou substituir exercícios por símbolos. Ações simuladas são demonstrações editoriais.

## Cenas

1. Marca e gancho: 0–3,27 s.
2. Plano e treino guiado: 3,27–9,83 s, clique em 4,91 s; execução em 5,34 s; série em 8,19 s.
3. Análise corporal: 9,83–16,38 s, fadiga em 13,11 s.
4. Marca e próxima decisão: 16,38–20 s, assentamento em 17,47 s.

## Áudio

Copiar vol.12 e cues da skill para `composition/assets/music/`. SFX da análise `sfx-analysis.md`: `ui/click2.ogg` para ações e `impact/impactSoft_medium_001.ogg` para troca de análise. Volume de música moderado; SFX discretos. Fazer o trim e fades com a automação nativa Hyperframes. Sem narração.

Music cue source: preset vol.12 (109,96 BPM estimado); strong cue 13,11 s para troca muscular. Grade 3,27 / 4,91 / 5,34 / 8,19 s orienta as ações. Textos permanecem até a ação seguinte; grade não reduz os tempos de leitura.

Audio-reactive: usar `hyperframes-creative/scripts/extract-audio-data.py` e amostrar os dados na timeline determinística; intensidade afeta apenas a luz de fundo. Se a extração falhar, documentar antes de ignorar.

## Contrato técnico

Skills usadas: hyperframes-core, hyperframes-animation, hyperframes-creative, hyperframes-keyframes e hyperframes-cli. Root standalone com id/timeline correspondentes, duração finita, quatro cenas narrativas divididas em seis clips (gancho, plano, execução, equilíbrio, fadiga, desfecho), dependências e mídias locais, movimento seek-safe. Hyperframes decide a mecânica concreta. Preparar `frame.md` com tokens do projeto, verificar `hyperframes check` com zero erros, olhar snapshots de todas as cenas e renderizar em qualidade delivery. Escolher poster no gancho assentado e aplicar somente ao primeiro quadro mantendo duração, número de quadros e áudio.
