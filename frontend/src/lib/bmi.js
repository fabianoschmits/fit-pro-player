/**
 * Cálculos, classificações e recomendações sobre o Índice de Massa Corporal (IMC / BMI).
 * Segue os padrões internacionais da OMS (Organização Mundial da Saúde).
 */

export const BMI_CATEGORIES = [
  {
    key: 'underweight_severe',
    label: 'Abaixo do peso (Grave)',
    status: 'needs_attention',
    color: '#ff375f', // red-pink
    badgeBg: 'rgba(255, 55, 95, 0.15)',
    min: 0,
    max: 16,
    summary: 'Seu IMC indica baixo peso severo.',
    evaluation: 'Você está bem abaixo da faixa de peso recomendada para sua altura. Isso pode comprometer sua imunidade, energia e massa muscular.',
    recommendation: 'Recomendamos acompanhamento médico e nutricional para ganho de massa magra de forma estruturada e segura, combinando superávit calórico e treinos de hipertrofia.',
  },
  {
    key: 'underweight_moderate',
    label: 'Abaixo do peso (Moderado)',
    status: 'needs_attention',
    color: '#ff9f0a', // orange
    badgeBg: 'rgba(255, 159, 10, 0.15)',
    min: 16,
    max: 17,
    summary: 'Seu IMC indica baixo peso moderado.',
    evaluation: 'Seu peso atual está abaixo do ideal para sua estatura. Pode haver margem para construir massa muscular e densidade corporal.',
    recommendation: 'Foque em treinos de força no Fit Pro Player e em bater suas metas de ingestão de proteínas e calorias diárias para evoluir com saúde.',
  },
  {
    key: 'underweight_mild',
    label: 'Abaixo do peso (Leve)',
    status: 'caution',
    color: '#ffd60a', // gold / yellow
    badgeBg: 'rgba(255, 214, 10, 0.15)',
    min: 17,
    max: 18.5,
    summary: 'Seu IMC está ligeiramente abaixo da faixa normal.',
    evaluation: 'Você está bem próximo da faixa normal, mas com peso relativamente baixo. Muitas pessoas com metabolismo acelerado ficam nessa faixa.',
    recommendation: 'Com consistência nos treinos resistidos e alimentação equilibrada voltada para hipertrofia, você logo atinge a faixa ideal.',
  },
  {
    key: 'normal',
    label: 'Peso saudável',
    status: 'great',
    color: '#34c759', // green / healthy
    badgeBg: 'rgba(52, 199, 89, 0.15)',
    min: 18.5,
    max: 24.9,
    summary: 'Parabéns! Seu IMC está na faixa saudável ideal.',
    evaluation: 'Sua relação entre peso e altura está em um excelente equilíbrio segundo as diretrizes de saúde. O risco de doenças crônicas associadas ao peso é baixo.',
    recommendation: 'Continue firme com sua rotina de treinos e alimentação saudável! O foco agora é na composição corporal: manter ou ganhar massa muscular enquanto preserva a saúde cardiovascular.',
  },
  {
    key: 'overweight',
    label: 'Sobrepeso',
    status: 'caution',
    color: '#ff9f0a', // orange
    badgeBg: 'rgba(255, 159, 10, 0.15)',
    min: 25,
    max: 29.9,
    summary: 'Seu IMC aponta sobrepeso.',
    evaluation: 'Seu peso está acima da faixa padrão para sua altura. Nota importante: em praticantes de musculação com boa massa muscular, o IMC pode superestimar a gordura corporal.',
    recommendation: 'Avalie suas medidas e percentual de gordura. Se o objetivo for definição e queima de gordura, combine os treinos de força com déficit calórico leve e cardio consistente.',
  },
  {
    key: 'obesity_1',
    label: 'Obesidade Grau I',
    status: 'needs_attention',
    color: '#ff6937', // red-orange
    badgeBg: 'rgba(255, 105, 55, 0.15)',
    min: 30,
    max: 34.9,
    summary: 'Seu IMC aponta obesidade grau I.',
    evaluation: 'Seu peso está significativamente acima do ideal para sua altura. Esta faixa requer atenção para evitar sobrecarga nas articulações e riscos cardiovasculares.',
    recommendation: 'Você está no lugar certo! Com o Fit Pro Player, treinos consistentes e ajustes na rotina alimentar geram resultados graduais e transformadores. Consulte também um nutricionista.',
  },
  {
    key: 'obesity_2',
    label: 'Obesidade Grau II',
    status: 'needs_attention',
    color: '#ff375f', // strong red-pink
    badgeBg: 'rgba(255, 55, 95, 0.15)',
    min: 35,
    max: 39.9,
    summary: 'Seu IMC aponta obesidade grau II.',
    evaluation: 'Faixa com excesso de peso acentuado que demanda cuidado preventivo e acompanhamento contínuo da saúde metabólica e cardiovascular.',
    recommendation: 'Priorize a consistência diária sem exageros nas cargas no início. Exercícios de baixo impacto articular aliados à musculação e orientação médica são os melhores aliados.',
  },
  {
    key: 'obesity_3',
    label: 'Obesidade Grau III',
    status: 'urgent',
    color: '#ff453a', // red
    badgeBg: 'rgba(255, 69, 58, 0.2)',
    min: 40,
    max: Infinity,
    summary: 'Seu IMC aponta obesidade grau III.',
    evaluation: 'Esta faixa exige cuidados especiais de saúde e acompanhamento multidisciplinar (médico, educador físico e nutricionista).',
    recommendation: 'Dê um passo de cada vez! Manter-se ativo diariamente, controlar a dieta e progredir de forma segura trará ganhos enormes na sua disposição e qualidade de vida.',
  },
]

/**
 * Calcula o IMC exato dado peso em kg e altura em cm.
 * Retorna null se dados forem inválidos ou faltantes.
 */
export function calculateBmi(weightKg, heightCm) {
  const w = Number(weightKg)
  const h = Number(heightCm)
  if (!Number.isFinite(w) || w <= 10 || w > 400) return null
  if (!Number.isFinite(h) || h < 80 || h > 260) return null
  const heightM = h / 100
  const bmi = w / (heightM * heightM)
  if (!Number.isFinite(bmi) || bmi <= 5 || bmi > 120) return null
  return Math.round(bmi * 10) / 10
}

/**
 * Retorna a categoria, cor, diagnósticos e faixa ideal para o IMC fornecido.
 */
export function getBmiDetails(bmi, heightCm) {
  if (bmi == null) return null
  const category = BMI_CATEGORIES.find(c => bmi >= c.min && (bmi < c.max || (c.max === 24.9 && bmi <= 24.99) || c.max === Infinity))
    || BMI_CATEGORIES[BMI_CATEGORIES.length - 1]

  let idealWeightMin = null
  let idealWeightMax = null
  if (heightCm > 0) {
    const heightM = heightCm / 100
    const h2 = heightM * heightM
    idealWeightMin = Math.round(18.5 * h2 * 10) / 10
    idealWeightMax = Math.round(24.9 * h2 * 10) / 10
  }

  return {
    bmi,
    category,
    label: category.label,
    color: category.color,
    badgeBg: category.badgeBg,
    status: category.status,
    summary: category.summary,
    evaluation: category.evaluation,
    recommendation: category.recommendation,
    idealWeightMin,
    idealWeightMax,
  }
}
