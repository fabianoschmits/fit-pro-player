# Fit Pro Player — vídeo completo de 1 minuto

## Entrega

- Vídeo final: `../fit-pro-player-1min.mp4`.
- Capa: `../fit-pro-player-1min.jpg`.
- Legenda para compartilhar: `share-copy.txt`.
- Projeto editável: `film.html`, `build.mjs` e `composition/`.

O vídeo vertical tem 60 segundos, 1080×1920, 30 fps e oito capítulos: apresentação, plano semanal, treino guiado, biblioteca visual, leitura corporal, evolução, área profissional e convite final. A versão anterior de 20 segundos foi preservada em `../brag.mp4`.

## Imagem e fontes

Marca, mascote, geometria do BodyMap e sprites de exercícios vêm do repositório do Fit Pro Player. O roteiro se baseia no README e nas telas Landing, Workout, Stats e da área profissional. As interfaces são recriações editoriais; os dados são exemplos das prévias públicas, não dados de contas ou alunos reais. Não se promete resultado físico garantido. Consulte `brag-plan.md` para o storyboard e as fontes.

## Narração e música

Narração sintetizada localmente com Kokoro, voz `pm_alex`, português brasileiro, velocidade 1,05×. Oito trechos separados, com 46,42 segundos de fala no total, cabem nas respectivas cenas. Não há clone de voz. Textos e tempos estão em `narration.json` e `narration-meta.json`.

Trilha original eletrônica/house de academia, 128 BPM, fá sustenido menor, sintetizada pelo gerador `music.py`, sem samples musicais externos. Kick, baixo, hats, palmas e synths acompanham dois drops e um encerramento. A trilha dura exatamente 60 segundos. Detalhes técnicos e procedência em `music-notes.md`.

A música recebe redução de volume e espaço espectral durante as falas, com fades nas extremidades. A mixagem nativa foi salva em `music-mix.json`. Dois efeitos discretos de interface usam o click2 da coleção Kenney, CC0.

## Verificação da entrega

- MP4 final: H.264, 1080×1920, 30 fps, 1.800 quadros, 60,000 segundos, áudio AAC estéreo a 48 kHz, 8.998.168 bytes.
- Decodificação integral de áudio e vídeo sem erros.
- Os oito trechos de voz foram confirmados no áudio exportado, nos tempos previstos, com correlação na banda vocal entre 0,9962 e 0,9991.
- A música original também foi confirmada no áudio exportado em três pausas da narração.
- Mixagem medida: −16,53 LUFS integrados, −2,47 dBTP, LRA 4,80 LU.
- Hyperframes: zero erros de runtime, layout e movimento; 49/49 verificações de contraste aprovadas. Há 11 avisos estruturais de organização em subcomposições; não são erros de execução ou de layout.
- Inspeção visual dos capítulos em snapshots e no contato de quadros do MP4 renderizado.
- Capa extraída em 2 segundos e aplicada somente ao quadro zero. Similaridade SSIM 0,997710; pacotes de áudio preservados sem alteração.

Resultados detalhados: `verification.json` e `final-verification.json`. A validação automatizada confirma presença e sincronização dos sinais, não substitui uma avaliação humana da pronúncia ou do gosto musical.

## Edição

Na pasta `composition/`, execute `npm install` se necessário. Edite `../film.html` e rode `npm run build`, `npm run check` e `npm run preview`. O build preserva a mixagem salva quando as falas não mudaram.

Para alterar a narração, edite `narration.json`, execute `node narrate.mjs` na pasta `one-minute/`, normalize os novos WAVs para as respectivas versões `*-mix.wav` e refaça o carve/mix nativo. Salve os novos atributos com `node save-mix.mjs` antes de reconstruir. O build rejeita uma mixagem salva incompatível com as novas falas.

`npm run render` gera `../fit-pro-player-1min.render.mp4` em relação à pasta `one-minute/`. Depois aplique a capa ao quadro zero para gerar o MP4 final e execute `python verify-final.py` em `one-minute/`. O render bruto foi preservado para essa verificação.

Nenhuma alteração foi feita no código funcional do aplicativo, e nada foi publicado externamente.
