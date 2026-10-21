# Brag Plan: Fit Pro Player

## Rubrica de planejamento

1. **O aplicativo:** organiza o plano de treino, guia a execução com animações e registro de séries, e reúne histórico, progresso e análise corporal.
2. **A frase forte:** “Treine com contexto. Evolua com clareza.”, de `frontend/src/views/Landing.jsx`.
3. **O gancho visual:** o leão oficial com halter abre o filme; a cor teal conecta sua identidade ao treino e aos músculos no BodyMap.
4. **A interface:** plano “Dia de Peito”, execução de Supino reto com carga/repetições/descanso, BodyMap anatômico frontal e posterior.
5. **Duração satisfatória:** 20 segundos, 600 quadros a 30 fps.
6. **Tom:** polished; filme de produto direto, com identidade esportiva, interface grande e movimentos rápidos seguidos de pausas de leitura.
7. **Áudio:** trilha instrumental steady/clean vol. 12 da biblioteca brag, com dois cliques discretos e um impacto suave; sem narração.
8. **Legenda:** “Treine com contexto. Evolua com clareza. Conheça o Fit Pro Player: planejamento, treino guiado e análise corporal no mesmo lugar.”
9. **Fluxo:** plano de hoje → começar o treino e marcar uma série → consultar equilíbrio e fadiga para decidir o próximo treino.

## O ângulo

A clareza vem de ver o treino acontecer. O leão apresenta a marca; a interface assume o protagonismo; a série registrada conduz ao mapa muscular. O diferencial visual é a anatomia original do Fit Pro Player, não uma silhueta genérica. A composição adapta as prévias públicas da landing para o enquadramento vertical; números são exemplos já presentes no código, sem apresentar resultados garantidos.

## Gancho

Marca oficial em grande escala e “Treine com contexto.” nos primeiros dois segundos. O halter do mascote prepara a passagem para a sessão de treino.

## Momentos centrais

- Abrir “Dia de Peito” pelo controle “Começar”.
- Supino reto: animação original, séries de 60 kg / 10 e 62,5 kg / 10; confirmar a terceira série de 62,5 kg / 8.
- Anatomia verdadeira do BodyMap, com “Volume bem distribuído” e mudança para “Recuperação em andamento”.

## Desfecho

“Evolua com clareza.”, o logo oficial e `fitpp.com.br`, endereço público registrado no README.

## Formato e identidade

- Vertical: 1080 × 1920, 30 fps, 20 s; preserva a direção do rascunho `film/roteiro-legenda.md`.
- Fundo do sistema: #000000; superfícies #0e0e10 / #1c1c1e; texto #ffffff.
- Acento: #0F8B8D; teal claro para texto de destaque que precise de contraste maior.
- Tipografia: sans de sistema da aplicação; Segoe UI local na exportação Windows.
- Fontes de produto: `README.md`, `frontend/index.html`, `frontend/src/views/Landing.jsx`, `frontend/src/index.css`, `frontend/src/components/BodyMap.jsx`, `frontend/src/lib/body-paths.js`, `frontend/src/lib/exercise-guide-assets.js`.
- Assets: `frontend/public/brand-logo.png` e frames originais de `bench-press`.
- Dados pessoais: nenhum dado de conta real. Dados numéricos retirados exclusivamente das prévias públicas; sem nome/idade/altura de perfil no filme.

## Áudio e Music cue guidance

- Música: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`, trecho 0–20 s, ganho 0,30, entrada curta e saída suave.
- Preset lido: `.agents/skills/brag/assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.md`; tempo estimado 109,96 BPM.
- Gancho → plano em 3,27 s e plano → execução em 5,34 s usam a grade detectada. Mudança do mapa em 13,11 s usa um strong cue. Encerramento em 17,47 s pode usar o strong cue para assentar a marca.
- Linhas de texto não aparecem em cada beat: todos os conjuntos têm ao menos 1,2 s de leitura estável.
- Audio-reactive: brilho teal atrás do produto varia discretamente com os dados de frequência pré-extraídos; sem pulso no texto.
- SFX: biblioteca CC0 Kenney; cliques na ação “Começar” e na série concluída, impacto suave na mudança de análise.
- Sem voz; não gerar narração nem adicionar faixa de voz.
- A procedência da música será registrada nas notas de entrega, pois o pacote não especifica sua licença exata.

## Storyboard

### Cena 1 — Identidade e gancho — 0–3,27 s (3,27 s)

O leão oficial entra com deslocamento e leve redução de escala, iluminado por teal sobre o fundo preto. “Treine com contexto.” fica legível até a saída. A marca ocupa o quadro e é reconhecível como thumbnail.
Sequencial/interação: revelação da marca, seguida da frase inteira; sem digitação.
Áudio: entrada da trilha; ritmo de expectativa.
Transição: deslocamento lateral para abrir espaço ao plano de hoje.

### Cena 2 — Do plano à série — 3,27–9,83 s (6,56 s)

Plano “Hoje” com “Dia de Peito” e “6 exercícios”. Um toque em “Começar” em 4,91 s abre a prévia de execução em 5,34 s. Animação original de Supino reto e tabela de séries; toque confirma a terceira série em 8,19 s, antes da passagem para análise. “Carga, repetições e descanso” acompanha o detalhe.
Sequencial/interação: toque em Começar; exercício animado; confirmação da terceira série. Dados do exemplo mantidos em conjunto na tela, com leitura estável entre ações.
Áudio: dois cliques discretos sincronizados aos toques.
Transição: enquadramento segue o treino para o mapa corporal.

### Cena 3 — Contexto corporal — 9,83–16,38 s (6,55 s)

BodyMap original frontal/posterior, ampliado, e “Volume bem distribuído”. As linhas Quadríceps 19 séries / Peito 18 séries / Costas 17 séries vêm da landing. Em 13,11 s, o mapa passa para fadiga e “Recuperação em andamento”, com Peito Fadigado / Ombros Recuperando / Costas Pronto. Os dois estados são exemplos independentes da prévia pública, não um cálculo produzido pela série anterior.
Sequencial/interação: mudança de aba Equilíbrio muscular → Fadiga; destacar o estado da região sem inventar geometria.
Áudio: impacto suave na troca de aba; trilha contínua.
Transição: redução do mapa e entrada do desfecho.

### Cena 4 — Próximo treino — 16,38–20 s (3,62 s)

“Evolua com clareza.”, logo oficial e `fitpp.com.br`. Composição de encerramento legível com a marca assentada por 17,47 s e movimento discreto de luz até o final.
Sequencial/interação: frase, marca e endereço; sem botão ilustrativo que prometa interatividade no MP4.
Áudio: trilha termina com fade, sem voz.

**Duração total: 3,27 + 6,56 + 6,55 + 3,62 = 20 segundos.**

## Entrega e verificações

`brag.mp4`, melhor frame em `brag.jpg` também aplicado ao quadro zero, `share-copy.txt`, composição editável e nota de fontes/validação. Validar com Hyperframes check (estrutura, assets, JavaScript, layout e contraste), inspecionar snapshots de todas as cenas e verificar o MP4 com ffprobe/decodificação de vídeo e áudio.
