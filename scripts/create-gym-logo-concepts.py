"""Build the second, gym-focused round of editable logo concepts."""
from pathlib import Path
import math

OUT = Path(__file__).resolve().parents[1] / 'assets/brand/gym-concepts'
OUT.mkdir(parents=True, exist_ok=True)

def svg(name, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><title>Fit Pro Player — {name}</title>{body}</svg>\n'

def grip(angle, width=48, height=20):
    # A pill cutout, rotated about the plate centre; arc radii remain exact.
    a = math.radians(angle)
    def pt(x, y):
        x, y = x - 128, y - 128
        return f'{128+x*math.cos(a)-y*math.sin(a):.2f} {128+x*math.sin(a)+y*math.cos(a):.2f}'
    left, right, top, bottom = 128-width/2, 128+width/2, 56-height/2, 56+height/2
    r=height/2
    return f'M{pt(left+r,top)} L{pt(right-r,top)} A{r} {r} {angle} 0 1 {pt(right-r,bottom)} L{pt(left+r,bottom)} A{r} {r} {angle} 0 1 {pt(left+r,top)} Z'

for version in (1, 2):
    # A: two solid hexagonal heads and a short grip, on a 45-degree axis.
    inset = 12 if version == 1 else 16
    dumbbell = f'M24 {72+inset} L{24+inset} 72 H{88-inset} L88 {72+inset} V112 H168 V{72+inset} L{168+inset} 72 H{232-inset} L232 {72+inset} V{184-inset} L{232-inset} 184 H{168+inset} L168 {184-inset} V144 H88 V{184-inset} L{88-inset} 184 H{24+inset} L24 {184-inset} Z'
    body=f'<path fill="#111111" transform="rotate(-45 128 128)" d="{dumbbell}"/>'
    (OUT/f'a-v{version}.svg').write_text(svg('Halter / Força em movimento',body),encoding='utf-8')
    # B: unmistakable plate silhouette, central bore and three broad grip cutouts.
    r=24 if version==1 else 28
    plate=f'M128 24 A104 104 0 1 1 128 232 A104 104 0 1 1 128 24 Z M128 {128-r} A{r} {r} 0 1 1 128 {128+r} A{r} {r} 0 1 1 128 {128-r} Z '
    plate+=' '.join(grip(a,44 if version==1 else 48,16 if version==1 else 20) for a in (0,120,240))
    (OUT/f'b-v{version}.svg').write_text(svg('Anilha / Evolução de carga',f'<path fill="#111111" fill-rule="evenodd" d="{plate}"/>'),encoding='utf-8')
    # C: closed handle unified with the weight; spacious counter survives small sizes.
    handle='M72 91 V72 A56 56 0 0 1 184 72 V91 C207 108 224 136 224 165 C224 202 197 232 160 232 H96 C59 232 32 202 32 165 C32 136 49 108 72 91 Z '
    hole='M100 80 V72 A28 28 0 0 1 156 72 V80 Z' if version==1 else 'M96 82 V72 A32 32 0 0 1 160 72 V82 Z'
    (OUT/f'c-v{version}.svg').write_text(svg('Kettlebell / Treino completo',f'<path fill="#111111" fill-rule="evenodd" d="{handle+hole}"/>'),encoding='utf-8')

(OUT/'brief.md').write_text('''# Fit Pro Player — segunda rodada

Direção solicitada: referências reconhecíveis de academia, exercício ou peso. Esta instrução substitui a premissa anterior de evitar equipamentos literais.

A — Halter: dois pesos hexagonais unidos por uma pegada, eixo de 45°. Energia e musculação; recomendação por leitura direta como ícone.
B — Anilha: disco com furo central e três pegadas. Foco em cargas e progressão; forma circular adequada ao PWA.
C — Kettlebell: alça e peso em uma silhueta contínua. Treinamento funcional; pode sugerir uma especialidade mais restrita.

Outras ideias consideradas: barra com anilhas (muito larga para o PWA), halter com F recortado (detalhe extra), PP em forma de peso (leitura ambígua), anilha com play (confusão com streaming), torso (perda de detalhe), peso com degraus (complexidade) e barra em arco (equipamento menos reconhecível).

SVGs em uma cor; versões 1 e 2 preservadas. A rodada define o símbolo. Após a escolha, desenvolver tipografia, cores e arquivos finais do logo e do PWA.
''',encoding='utf-8')
print(OUT)
