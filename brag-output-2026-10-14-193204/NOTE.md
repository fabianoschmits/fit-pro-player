# Fit Pro Player — produção de três minutos

## Estado

Projeto produzido para revisão no Hyperframes Studio. O MP4 final ainda depende da revisão da prévia e autorização da exportação, conforme a etapa de entrega de brag/Hyperframes. Não tratar a composição ou um teste verde como prova de que o arquivo final já foi entregue.

## O filme

Ideia aprovada: do plano à evolução, tudo conectado. Uma rotina demonstrativa liga a preparação da semana à execução, às consultas, à leitura corporal e ao acompanhamento profissional. Os componentes são montados em camadas; campos de texto são preenchidos; gráficos são desenhados; o BodyMap e as demonstrações usam assets originais.

A composição tem 180 segundos, 1080×1920 e 30 fps, nove capítulos em subcomposições e uma faixa de legenda. Os tempos de cada capítulo foram ajustados levemente às durações reais da voz, preservando a sequência aprovada. O arquivo `narration-meta.json` é a fonte do agendamento, e `narration.json` é a fonte editável do roteiro.

82 frases com áudio medido, 171,27 segundos de narração e intervalos de 0,09 segundo dentro dos capítulos e 0,24 segundo entre eles. As legendas correspondem a frases completas geradas como arquivos de áudio independentes; não foram obtidas distribuindo palavras uniformemente no tempo. `fit-pro-player-3min.srt` usa esses mesmos limites e preserva a escrita correta da marca.

## Fontes e procedência

Marca, SVG anatômico e sprites são do repositório Fit Pro Player. Fontes funcionais e limites de verdade estão em `brag-plan.md`. As telas são composições editoriais dos recursos do produto, não captura de conta real. Cargas, peso e circunferências mostrados são exemplos demonstrativos; não provam resultados nem representam alunos reais.

Kokoro local, `pm_alex`, `pt-br`, sem clone de voz. O sintetizador usa o ambiente Python local já instalado na produção anterior e modelos em cache. A normalização e o ajuste de tempo preservam a altura da voz; todas as frases usam o mesmo fator medido de aproximadamente 1,341.

Música eletrônica original de academia a 128 BPM, 180 segundos, 48 kHz estéreo PCM24. Master medido em −15,0 LUFS e −1,5 dBTP; sem samples musicais externos. Procedência e medições do WAV em `music-notes.md` e `composition/assets/music/verification.json`. O grupo voiceover contém exclusivamente as 82 falas. A música recebe carve nativo espectral e de ganho contra esse grupo; atributos salvos em `music-mix.json`.

## Verificação

Testes de agendamento, rejeição de durações inválidas, quebra de legenda e SRT tiveram falhas observadas antes da implementação, seguidas de aprovação dos quatro testes. A auditoria de navegador fica em `qc/check.json`; `audit-qc.mjs` verifica as regressões de alvo vazio e do painel de comparação. As evidências de revisão visual ficam em `qc/stills/` e nas folhas de contato.

A inspeção visual também encontrou uma abertura sem marca, apesar do check estrutural verde: dois sets de opacidade no instante zero mantinham a primeira superfície invisível. Um teste real no navegador reproduziu opacidade zero em 2,5 segundos. A substituição por um tween finito explícito confirmou opacidade um; o snapshot corrigido mostra a marca. Os títulos de rotina tiveram seus tamanhos explícitos corrigidos, e a cintura passou a usar destaque e elipse de guia derivados dos landmarks de MeasurementBodyMap.jsx.

Último check antes da revisão: zero erros ou warnings de lint, runtime e movimento; zero erros/warnings de layout, com um aviso informativo de viagem na entrada do quadro zero; 44/44 contrastes aprovados. O navegador foi executado e a verificação de movimento fez 300 amostras. Há 5.400 frames de análise musical pré-calculados: a luz de fundo reage discretamente ao baixo, e o foco anatômico inicia no retorno musical de 86,25 segundos.

Quadros revisados: 2,5s marca e gancho; 7,5s jornada; 13,5s semana; 22s observações sendo escritas; 29,5s sessão preparada; 35,5s supino; 43,5s série em execução; 49,5s série concluída e descanso; 57,5s ajustes; 65s supino na biblioteca; 71,5s agachamento; 79s terra; 88s equilíbrio; 97s fadiga; 106s força; 115s histórico; 125s peso; 131s tendência; 139s cintura e campo; 147s comparação; 156s edição profissional; 166s programa recebido; 176s marca/endereço; 179,7s fechamento. Os quadros em `qc/final-proof/` substituem os estados anteriores da abertura, rótulos e cintura. O gosto pela voz e pelo ritmo continua sujeito à revisão humana; não houve avaliação auditiva humana nesta produção.

Antes da entrega final ainda serão necessários: exportar o MP4, conferir 180 segundos/5.400 quadros e decodificação integral, medir a mixagem final, confirmar voz/música no áudio exportado, revisar a presença das legendas no MP4, escolher e aplicar a capa ao quadro zero. As medições do WAV musical não são medições da mixagem final.

## Edição

Na pasta `composition/`: `npm test`, `npm run build`, `npm run check`, `npm run preview`. `npm run render` gera o render de entrega após a aprovação. O CLI da nova produção é 0.8.158; as versões antigas continuam intactas com suas dependências anteriores.

Edite `narration.json` para texto; rode `node narrate.mjs` na pasta desta produção para áudio e SRT. Refaça o carve e rode `node save-mix.mjs` se a narração ou a música mudar. Edite `build.mjs` para as montagens. `music.py` reproduz a trilha. Nenhuma alteração foi feita no código funcional do aplicativo e nada foi publicado externamente.
