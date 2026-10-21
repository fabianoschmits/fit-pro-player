# Fit Pro Player — trilha original de 180 segundos

Master: `composition/assets/music/gym-electronic.wav`, relativo a esta pasta. Instrumental house/EDM de academia, **128 BPM**, 4/4, Fá♯ menor, exatamente **180,000000 segundos**. São 96 compassos, 384 beats e **8.640.000 frames por canal**, a 48.000 Hz, estéreo PCM24.

## Fonte, autoria e licença

Fonte: síntese procedural local. A instrumentação parte de `../brag-output/one-minute/music.py`, importado somente para reutilizar seus osciladores, envelopes, filtros e instrumentos sintetizados. O arquivo anterior e seus artefatos não foram alterados. O arranjo novo, os padrões por seção, a sala procedural e a masterização são implementados em `music.py` nesta pasta.

Autoria: composição, programação e arranjo original por Codex para Fit Pro Player. Dedicação **CC0-1.0** para o áudio e arranjo novos, permitindo uso, edição e distribuição sem exigência de atribuição. A identificação de autoria permanece nos metadados do WAV e nos JSONs como registro de origem. Não há vozes, samples externos, trechos de músicas, biblioteca de áudio de terceiros ou imitação de uma música/artista específico. Não foi usado serviço externo de geração musical.

## Estrutura e alinhamento

Cada beat dura 0,46875s e cada compasso 1,875s. As mudanças principais usam o início de compasso mais próximo do tempo editorial pedido; os tempos editoriais continuam registrados em `nominalStartSeconds` / `nominalEndSeconds` no `cues.json`. Nenhuma alteração de BPM foi necessária. O afastamento máximo de uma mudança principal em relação ao tempo pedido é 0,875s.

| Seção | Janela editorial pedida | Janela musical real | Compassos | Evolução |
| --- | --- | --- | --- | --- |
| Introdução rápida | 0–12s | 0–11,250s | 1–6 | Kick desde o início; hats em 1,875s, clap em 3,750s, baixo e stabs em 5,625s, arpejo em 9,375s. |
| Groove explicativo | 12–66s | 11,250–65,625s | 7–35 | Groove contínuo; baixo A→B→C→D, inversões de acordes, respostas curtas e entradas de shakers. A percussão afina em 56,250s antes da mudança. |
| Mudança | 66–86s | 65,625–86,250s | 36–46 | Retirada real de kick e baixo; pads suspensos, retorno do kick em half-time em 73,125s, baixo discreto em 76,875s, reconstrução em 78,750s. Um beat de espaço em 85,78125s anuncia o retorno. |
| Corpo | 86–111s | 86,250–110,625s | 47–59 | Volta do groove completo, baixo sincopado, Bm7/C#m7 na progressão e respostas melódicas espaçadas. |
| Variação | 111–151s | 110,625–151,875s | 60–81 | Progressão começando em Dmaj7, novo desenho do baixo, ponte reduzida entre 118,125–125,625s, relançamento com outra inversão, troca de padrão em 140,625s. |
| Profissional | 151–171s | 151,875–170,625s | 82–91 | Shakers e hats abertos saem, clap mais espaçado, F#m11/D6/Bm7/Eadd9, respostas arredondadas e harmonia sustentada. |
| Fechamento | 171–180s | 170,625–180,000s | 92–96 | Resolução tônica, retirada progressiva da bateria, último hit em 176,250s, cauda de sala/delay e fade final. |

O arranjo soma **4.047 eventos** individuais, registrados em `arrangement-events.json`. `synthesis.json` contém os 96 compassos com harmonia, voicing, padrão de baixo, brilho e contagens por seção. Trata-se de uma composição contínua de 180s; os trechos de um minuto não são cópias do WAV anterior.

Instrumentação: kick analítico com queda de pitch, clap/noise com vários ataques, hats metálicos, shakers, toms e cymbals sintetizados; baixo centralizado; acordes, pads e respostas com osciladores PolyBLEP estéreo. Sidechain acompanha os kicks reais e recupera em aproximadamente 110ms. Delay de colcheia pontuada e sala escura procedural com convolução em blocos preservam as caudas.

A faixa foi concebida como cama para narração contínua: o lead é curto e discreto, os timbres harmônicos são filtrados, e a master usa cortes suaves em 1.800 Hz (−1,8 dB) e 3.200 Hz (−2,3 dB), high-pass em 28 Hz e low-pass em 16 kHz. A energia mono medida em 1.800–4.500 Hz é 0,892% da energia espectral total. Essa medição descreve o espectro; a mistura final com a narração é responsabilidade do agente principal.

## Medições reais do WAV final

As medidas abaixo vêm do arquivo exportado, não apenas dos alvos configurados. ffprobe confirmou o formato; ffmpeg fez medições sem modificar o master. A normalização em duas passagens selecionou processamento dinâmico para atingir simultaneamente o loudness e o teto de pico.

| Medição | Resultado |
| --- | --- |
| ffprobe — duração | **180,000000s** |
| ffprobe — codec | **`pcm_s24le`**, PCM signed 24-bit little-endian |
| ffprobe — sample rate / canais / layout | **48.000 Hz / 2 / stereo** |
| ffprobe — duration_ts / time_base | **8.640.000 / 1:48.000** |
| ffmpeg `ebur128=peak=true` — integrated | **−15,0 LUFS** |
| ffmpeg — loudness range | **4,9 LU** |
| ffmpeg — true peak | **−1,5 dBTP**, abaixo de −1 dBTP |
| Reconstrução bandlimited 8× — pico | **−1,4622 dBFS**, abaixo de −1 dB |
| Pico de amostra decodificada | **−1,4816 dBFS** |
| ffmpeg `volumedetect` — mean / max | **−16,1 / −1,5 dB** |
| ffmpeg `astats` — RMS overall | **−16,112161 dBFS** |
| Amostras com amplitude absoluta ≥ 1 | **0 de 17.280.000 amostras intercaladas** |
| ffmpeg `astats` — flat factor | **0,000000** |
| Correlação estéreo | **0,962934**, grave centralizado |
| RMS nos últimos 250ms | **−100,3563 dBFS** |
| Último frame | **[0,0; 0,0]** |
| Tamanho do master | **51.840.292 bytes** |

RMS por seção: introdução −15,3249; groove −15,1654; mudança −19,9783; corpo −15,2965; variação −15,9153; profissional −17,3753; fechamento −19,9955 dBFS. A mudança reduz a energia aproximadamente 4,8 dB em relação ao groove, com retorno definido no corpo.

Comparação dos três trechos de 60s, alinhados no tempo: nenhum par é idêntico. Correlação de waveform mono 1↔2 = 0,710021; 2↔3 = 0,626291; 1↔3 = 0,752018. O beat permanece firme, mas harmonia, padrões e instrumentação evoluem. Contagens de eventos e o mapa de compassos complementam essa verificação.

O fade musical começa em 176,250s e dura 3,750s. Um taper adicional de 250ms depois do processamento evita qualquer resíduo de filtro no limite final. O último beat começa em 179,53125s; o limite exclusivo do beat 384 é 180s. O endpoint termina em zero.

SHA-256:

```text
e56c62f22d82811e88ed2ca5bb64e636d9845e3fa197f9ceb0b0eda9194329ec
```

Verificação técnica e de arranjo: duração, formato, loudness, picos, ausência de clipping, seções distintas e cauda final passaram. Não se alega audição humana nem avaliação da narração junto com esta trilha.

## Arquivos entregues e reprodução

- `music.py`: gerador novo; reutiliza os instrumentos do gerador anterior sem executar seu `main()` e desabilita bytecode no import.
- `music-notes.md`: esta documentação.
- `composition/assets/music/gym-electronic.wav`: master principal para o vídeo.
- `composition/assets/music/cues.json`: 384 beats, 96 inícios de compasso, sete seções, tempos editoriais e cues fortes.
- `composition/assets/music/verification.json`: métricas, SHA-256 e sete verificações aprovadas.
- `composition/assets/music/synthesis.json` e `arrangement-events.json`: mapa de compassos, parâmetros e eventos.
- `composition/assets/music/ffprobe.json`, `ebur128.log`, `volumedetect.log`, `astats.log`, `master-pass1.log`, `master-pass2.log`: evidências de exportação e medição.
- `composition/assets/music/synthesis-mix.f32`: intermediário float32 estéreo, antes da equalização/masterização; usar o WAV final no vídeo.

Na raiz `C:\MeusProjetos\Fitproplayer`:

```powershell
python -B brag-output-2026-10-14-193204/music.py
python -B brag-output-2026-10-14-193204/music.py --verify-only
```

Dependências utilizadas: Python 3.13.5, NumPy 2.5.1, ffmpeg/ffprobe 9.0.2. Não foi necessário instalar pacotes. Todas as escritas ficam nesta pasta, no gerador/notas e em `composition/assets/music/`.

Medições independentes, somente leitura:

```powershell
ffprobe -v error -show_entries 'format=duration,size:stream=codec_name,sample_rate,channels,channel_layout,bits_per_sample,duration,duration_ts,time_base' -of json brag-output-2026-10-14-193204/composition/assets/music/gym-electronic.wav
ffmpeg -hide_banner -i brag-output-2026-10-14-193204/composition/assets/music/gym-electronic.wav -af 'ebur128=peak=true' -f null -
ffmpeg -hide_banner -i brag-output-2026-10-14-193204/composition/assets/music/gym-electronic.wav -af volumedetect -f null -
```

Nenhum app, artefato antigo, narração, HTML ou arquivo do agente principal foi alterado. O master e seus cues estão disponíveis para integração e ajuste de nível sob a narração.
