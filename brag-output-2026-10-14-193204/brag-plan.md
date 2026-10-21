# Fit Pro Player — do plano à evolução, tudo conectado

Direção aprovada pelo usuário em 14/10/2026. Nova versão de aproximadamente três minutos, vertical 1080×1920, 30 fps, narração brasileira, música eletrônica de academia, montagem animada de componentes e textos escritos dentro das interfaces. Legendas incorporadas e SRT separado. O pedido explícito de três minutos prevalece sobre a duração curta padrão de brag. Não alterar o aplicativo nem substituir as versões anteriores.

## Intenção e decisões

Problema: o treino perde contexto quando planejamento, execução e registros ficam separados. Público presumido: pessoas que treinam e profissionais interessados no produto. Objetivo: explicar a jornada real do aplicativo. Emoção: segurança para organizar o próximo treino, com energia esportiva.

O filme será uma demonstração editorial de uma rotina, não uma lista de slogans. A alternativa de trailer exclusivamente tipográfico explicaria menos; a alternativa de gravação estática mostraria menos das montagens solicitadas. Escolha: componentes e assets reais do produto em uma composição filmada, com dados demonstrativos declarados nesta documentação.

Marca: mascote oficial, anatomia própria e sprites de exercícios do repositório; preto, branco e teal #0F8B8D. Controles de treino e mapa corporal são a assinatura visual, não um motivo genérico de academia. Sem depoimentos, números de usuários, resultados garantidos ou dados privados.

## Roteiro e storyboard

| Tempo | Papel e crença adquirida | Ação e passagem |
|---|---|---|
| 0–12 | Gancho: um treino faz parte de uma sequência de escolhas | Marca oficial entra; três fragmentos da jornada se organizam; agenda toma o foco. |
| 12–36 | Prova: preparar a semana e a prescrição | Dias e exercícios montados em camadas; nome e campos recebem texto; iniciar leva ao exercício. |
| 36–66 | Prova: registrar o que acontece na sessão | Supino original em movimento; carga/repetições escritas; iniciar, finalizar e descanso respondem; últimos valores entram como referência. |
| 66–86 | Prova: consultar execução e músculos | Sprites originais de supino, agachamento e levantamento terra; área anatômica responde à seleção. |
| 86–111 | Momento principal: compreender o registro pelo corpo | Anatomia frontal/posterior montada; equilíbrio, fadiga e força são mostrados separadamente, como estimativas e informações de histórico. |
| 111–135 | Prova: reler sessões e acompanhar tendências | Sessão finalizada vira registro; gráfico desenha pontos e percorre datas. |
| 135–151 | Prova: registrar medidas e comparar momentos | Selecionar cintura; campo recebe medida; comparação e linha do tempo mostram registros demonstrativos. |
| 151–171 | Prova: profissional prepara e acompanha programas | Programa com título escrito, semana e versão publicada; relação com treino recebido pelo aluno e acompanhamento. |
| 171–180 | Convite: conectar a jornada ao próximo treino | Interface continua mudando; endereço entra pela mesma composição; resolução final curta, sem fade para preto. |

Os capítulos contêm ações internas e cortes motivados; não são nove telas paradas. Entradas com viagem rápida e desaceleração, saídas aceleradas, microtransições de aproximadamente 0,3–0,6 s. Escrita letra a letra nos campos reais do produto; títulos com palavras reveladas. Legendas completas por frase curta, sincronizadas com arquivos de voz medidos, nunca digitadas lentamente.

## Voz, som e leitura

Kokoro local, pm_alex, pt-br: continuidade com a versão aprovada anterior, sem clone e sem consumo de serviço pago. Narração explicativa quase contínua; segmentação por frases curtas para medir cada legenda e controlar pausas. Música original 128 BPM com arranjo de 180 segundos; aplicar carve à música contra o grupo voiceover. Eventos de interface discretos, não um clique em cada palavra. A anatomia é o maior foco; texto e mapas usam safe zones e faixa separada para legendas.

## Fontes e limites de verdade

README.md; frontend/src/views/Landing.jsx, Workout.jsx, Stats.jsx, BodyProgress.jsx, ProfessionalDashboard.jsx, ProfessionalPrograms.jsx, ProfessionalStudents.jsx; frontend/src/components/StudentProgramOverview.jsx, BodyMap.jsx, MeasurementBodyMap.jsx; frontend/src/lib/body-paths.js; catálogo de sprites e nomes portugueses. BodyMap não é medição médica; medidas digitadas não são centímetros derivados de uma silhueta estimada. Nenhum dado de conta real será acessado. Os números de demonstração de peso, cargas e circunferências são exemplos editoriais, não prova de resultado.

## Verificação e entrega

Testar agendamento, limites de duração e geração de SRT antes de implementar os helpers. Uma subcomposição por cena, uma trilha de legenda, trilhas de narração/música separadas. Hyperframes check com navegador, contrastes e layout; snapshots por capítulo e nos pontos de montagem; revisão visual do arquivo renderizado; ffprobe, decodificação completa, presença das falas e música e loudness medido. Entregar MP4 final, JPG, SRT, roteiro editável e NOTE.md com evidências. Manter o goal ativo até a versão final estar comprovada.
