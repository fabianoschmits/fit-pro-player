# Fit Pro Player — apresentação completa, 1 minuto

Pedido vigente: refazer o vídeo com **60 segundos**, narração em português e música eletrônica de academia. A duração pedida pelo usuário substitui a janela padrão de 15–25 s da skill brag. A versão de 20 s permanece em `../brag.mp4`.

## Conceito

Mostrar uma rotina inteira: organizar → executar → consultar movimentos → interpretar o corpo → acompanhar o histórico → organizar o trabalho profissional. O mascote oficial abre e fecha a apresentação; a anatomia e as animações originais identificam o produto no centro do filme. Formato vertical 1080×1920, 30 fps, exatamente 60 s. Tom direto e esportivo, com tempo para ouvir a explicação e ler a interface.

## Fontes e verdade do produto

`README.md`, `frontend/src/views/Landing.jsx`, `frontend/src/views/Workout.jsx`, `frontend/src/views/Stats.jsx`, `frontend/src/components/BodyMap.jsx`, `frontend/src/lib/body-paths.js`, catálogo original de sprites e arquivos da área profissional. As interfaces são recriações editoriais das prévias públicas, não gravações de contas reais. Valores de séries, peso e anatomia são retirados das prévias de Landing.jsx. Não incluir nomes ou dados de alunos reais nem tratar os exemplos como resultado garantido.

## Storyboard e narração

| Tempo | Cena | Imagem e ação | O que explica |
|---|---|---|---|
| 0–5 s | Apresentação | Mascote oficial, gancho “Treine com contexto.” | Apresenta o Fit Pro Player e a proposta. |
| 5–13 s | Plano semanal | Semana, Dia de Peito, toque em Começar | Organizar a rotina e iniciar a sessão. |
| 13–23 s | Treino guiado | Supino animado, cargas/repetições, marcar série, descanso | Registrar o treino no fluxo de execução. |
| 23–31 s | Biblioteca visual | Supino → Agachamento → Levantamento terra, sprites originais | Consultar demonstrações e entender o movimento. |
| 31–40 s | Leitura corporal | BodyMap frontal/posterior; equilíbrio → fadiga | Ver volume e recuperação em contexto. |
| 40–48 s | Evolução | Curva de peso, histórico e dados exemplificativos públicos | Consultar o que foi registrado e acompanhar a evolução. |
| 48–54 s | Área profissional | Alunos e programas, esquema de organização do treino | Mostrar que o produto também apoia o trabalho profissional. |
| 54–60 s | Convite | Marca oficial, “Evolua com clareza.”, fitpp.com.br | Encerrar com uma ação concreta. |

**Total: 5 + 8 + 10 + 8 + 9 + 8 + 6 + 6 = 60 s, 1.800 quadros.**

## Áudio

Narração opt-in autorizada pelo usuário: Kokoro local, voz brasileira, oito trechos com durações medidas e posicionamento por cena. Textos em `narration.json`; pequenas adaptações fonéticas na marca são exclusivamente para pronúncia. Sem clone de voz e sem provedor pago.

Trilha original eletrônica/house de academia a 128 BPM, com kick, baixo, hats, synths e mudanças de energia. Música sob a voz; maior presença nas pausas. Registrar autoria/síntese, beats e métricas em music-notes.md. Efeitos de interface discretos. Não usar a trilha corporativa da primeira versão.

Mix: voz inteligível, trilha reduzida durante cada segmento; medir loudness/true peak e ausência de clipping. Preservar pausas de respiro entre frases. As durações das falas devem caber nos intervalos, sem esticar o vídeo ou cortar palavras.

## Identidade e entrega

Preto, branco, teal #0F8B8D, variantes de contraste do próprio sistema e cores semânticas do BodyMap. Títulos grandes, sem excesso de texto. UI ampliada, movimentos curtos com holds; fluxo real de usar o app como conteúdo, não repetir o vídeo de 20 s.

Entregar `fit-pro-player-1min.mp4`, `fit-pro-player-1min.jpg`, legenda, fontes editáveis e nota de verificação. Capa escolhida em um momento assentado e aplicada somente ao quadro zero. Hyperframes check, snapshots de todas as oito cenas, ffprobe (60 s, 1.800 quadros, H.264/AAC), decodificação de áudio/vídeo e verificação da mixagem.
