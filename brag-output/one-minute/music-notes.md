# Fit Pro Player — trilha instrumental original

`composition/assets/music/gym-electronic.wav` é uma composição **original**, criada para este vídeo com síntese local. Melodia, harmonia, padrões rítmicos, timbres e efeitos foram compostos/programados neste subtask. Não há vozes, samples de terceiros, áudio externo, referências ou imitações de músicas/artistas específicos. Nenhum serviço de música, rede, publicação ou credencial foi usado.

House/EDM para academia: **128 BPM**, 4/4, **32 compassos / 128 beats**, Fá♯ menor. Cada beat dura 0,46875s e cada compasso 1,875s. O último beat começa em 59,53125s; o limite exclusivo do beat 128 é **60,000000s**. O WAV tem exatamente **2.880.000 frames por canal**.

## Estrutura musical

| Tempo | Compassos | Arranjo |
| --- | --- | --- |
| 0–15s | 1–8 | Intro com kick firme, pads filtrados; hats em 1,875s, clap em 3,75s, baixo e stabs em 7,5s, arpejo em 11,25s. Fill e reverse cymbal anunciam o drop. |
| 15–30s | 9–16 | Primeiro drop: four-on-floor, baixo sincopado, clap nos backbeats, hats abertos no contratempo, shakers e acordes com sidechain. Motivo melódico próprio entra em 18,75s. |
| 30–37,5s | 17–20 | Quebra real: kick e baixo saem; pads Dmaj7/Eadd9, arpejo espaçado e caudas de delay/reverb sustentam a harmonia. |
| 37,5–45s | 21–24 | Build com retorno do kick, clap/snare passando de colcheias a semicolcheias e fusas, noise riser e tensão harmônica. Um beat de espaço começa em 44,53125s. |
| 45–56,25s | 25–30 | Segundo drop: baixo mais brilhante, acordes e hook mais presentes, respostas de oitava discretas, shakers reforçados e fills. |
| 56,25–60s | 31–32 | Resolução em Fá♯ menor; último hit tônico em 58,59375s; cauda e fade final de 1,2s. |

Progressão principal: **F#m9 → Dmaj7 → Aadd9 → Eadd9**, com voicings próximos e adaptação nas transições. O baixo é mono; acordes, pads e lead usam osciladores desafinados em estéreo. Osciladores PolyBLEP reduzem aliasing. Kick com queda de pitch integrada, clap em múltiplos ataques, hats metálicos/noise, shakers, toms, crashes e risers são todos sintetizados. Há delay estéreo em colcheia pontuada e uma resposta de sala procedural própria. O sidechain recupera em aproximadamente 104ms e segue os kicks efetivamente presentes no arranjo. Abertura com taper de 8ms.

## Métricas reais do WAV final

Resultados medidos após a masterização, não valores apenas configurados:

| Verificação | Resultado |
| --- | --- |
| ffprobe — duração | **60,000000s** |
| ffprobe — formato | **WAV / PCM signed 24-bit little-endian (`pcm_s24le`)** |
| ffprobe — áudio | **48.000 Hz, 2 canais, layout stereo** |
| ffprobe — duration_ts / time_base | **2.880.000 / 1:48.000** |
| ffmpeg `ebur128=peak=true` — integrated | **−13,9 LUFS** |
| ffmpeg — loudness range | **5,8 LU** |
| ffmpeg — true peak | **−1,3 dBTP** (log rotulado dBFS pelo filtro) |
| Reconstrução bandlimited 8× — pico | **−1,2245 dBFS**, também abaixo do teto de −1 dB |
| Pico de amostra decodificada | **−1,2970 dBFS** |
| ffmpeg `volumedetect` — mean / max | **−15,5 / −1,3 dB** |
| ffmpeg `astats` — RMS overall | **−15,482574 dBFS** |
| Amostras com amplitude absoluta ≥ 1,0 | **0 de 5.760.000 amostras intercaladas** |
| ffmpeg `astats` — flat factor | **0,000000** |
| Correlação estéreo | **0,94754**, com grave centralizado |
| Primeiro / último frame — maior amplitude absoluta | **≈ −119,4 / −124,5 dBFS**, início/final praticamente silenciosos |
| Tamanho do WAV | **17.280.224 bytes** |

RMS por seção: intro −14,990; drop 1 −14,325; quebra −21,670; build −17,547; drop 2 −14,171; outro −18,361 dBFS. A queda na quebra e o crescimento dos drops foram confirmados numericamente. A avaliação registrada é técnica e de arranjo; não representa uma alegação de audição humana ou validação da mistura com a narração.

SHA-256 do master final:

```text
af50c569d8ed7ea01d202d9eeed0e77d1874ef075bdff64090fd099770ccd584
```

## Arquivos e reprodução

- **Master para o agente principal:** `composition/assets/music/gym-electronic.wav`.
- **Sincronização:** `composition/assets/music/cues.json`: `tempo`, `bpm` e `tempoBpm` = 128; 128 timestamps em `beats`, 32 em `barStarts`, seções e `strongCues` com beat, tempo e tipo. Beats começam em zero; compassos em um. `endCue` = 60s.
- **Evidências:** `verification.json`, `ffprobe.json`, `ebur128.log`, `volumedetect.log`, `astats.log`, `master-pass1.log`, `master-pass2.log`, todos no mesmo diretório de música.
- **Reprodutibilidade:** `synthesis.json` registra seed, contagens de eventos, níveis dos buses e medições das duas passagens. `synthesis-mix.f32` é o intermediário float32 estéreo a 48 kHz, antes da equalização/masterização; usar o WAV final no vídeo.

Na raiz `C:\MeusProjetos\Fitproplayer`:

```powershell
python -B brag-output/one-minute/music.py
python -B brag-output/one-minute/music.py --verify-only
```

Dependências usadas: Python 3.13.5, NumPy 2.5.1 e ffmpeg/ffprobe 9.0.2. Não foi necessário scipy ou instalar pacotes. O gerador escreve exclusivamente em `brag-output/one-minute/composition/assets/music/`.

Comandos de medição equivalentes:

```powershell
ffprobe -v error -show_entries 'format=duration,size:stream=codec_name,sample_rate,channels,channel_layout,bits_per_sample,duration,duration_ts,time_base' -of json brag-output/one-minute/composition/assets/music/gym-electronic.wav
ffmpeg -hide_banner -i brag-output/one-minute/composition/assets/music/gym-electronic.wav -af 'ebur128=peak=true' -f null -
ffmpeg -hide_banner -i brag-output/one-minute/composition/assets/music/gym-electronic.wav -af volumedetect -f null -
ffmpeg -hide_banner -i brag-output/one-minute/composition/assets/music/gym-electronic.wav -af 'astats=metadata=0:reset=0' -f null -
```

Nenhum app, template/composição de vídeo, narração, outro asset ou plano foi editado. Não houve novos agentes ou commit. O master está pronto para o agente principal inserir e balancear com a narração.
