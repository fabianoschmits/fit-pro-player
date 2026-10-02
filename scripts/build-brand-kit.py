"""Rebuild the approved dumbbell identity and PWA assets (requires CairoSVG)."""
from pathlib import Path
import json
import re
import cairosvg

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/brand/final'
PUBLIC = ROOT / 'frontend/public'
OUT.mkdir(parents=True, exist_ok=True)
WEB = OUT / 'web'
WEB.mkdir(parents=True, exist_ok=True)
TEAL, INK = '#0F8B8D', '#101719'
source = (ROOT / 'assets/brand/gym-concepts/a-v2.svg').read_text(encoding='utf-8')
shape = re.search(r'<path[^>]+/>', source)[0]

def symbol(color):
    return shape.replace('#111111', color)

def doc(body, w=256, h=256, title='Fit Pro Player'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}"><title>{title}</title>{body}</svg>'

def save(name, body, w=256, h=256):
    target = OUT / f'{name}.svg'
    target.write_text(doc(body,w,h),encoding='utf-8')
    return target

# Original outlined lettering: broad stems, compact spacing and clipped terminals.
# No font files, installed-font dependencies or live text in logo masters.
glyphs = {
 'F':(40,'M0 0H40V8H8V24H32V32H8V56H0Z'),
 'I':(8,'M0 0H8V56H0Z'),
 'T':(40,'M0 0H40V8H24V56H16V8H0Z'),
 'P':(40,'M0 0H24A16 16 0 0 1 40 16V20A16 16 0 0 1 24 36H8V56H0Z M8 8V28H24A8 8 0 0 0 32 20V16A8 8 0 0 0 24 8Z'),
 'R':(44,'M0 0H24A16 16 0 0 1 40 16V20A16 16 0 0 1 24 36L44 56H33L13 36H8V56H0Z M8 8V28H24A8 8 0 0 0 32 20V16A8 8 0 0 0 24 8Z'),
 'O':(44,'M18 0H26A18 18 0 0 1 44 18V38A18 18 0 0 1 26 56H18A18 18 0 0 1 0 38V18A18 18 0 0 1 18 0Z M18 8A10 10 0 0 0 8 18V38A10 10 0 0 0 18 48H26A10 10 0 0 0 36 38V18A10 10 0 0 0 26 8Z'),
 'L':(36,'M0 0H8V48H36V56H0Z'),
 'A':(48,'M20 0H28L48 56H38L33 42H15L10 56H0Z M18 34H30L24 16Z'),
 'Y':(48,'M0 0H11L24 20L37 0H48L28 30V56H20V30Z'),
 'E':(40,'M0 0H40V8H8V24H32V32H8V48H40V56H0Z'),
}

def line(word,x,y,color):
    paths=[]
    for ch in word:
        if ch==' ':
            x+=20
            continue
        width,d= glyphs[ch]
        paths.append(f'<path fill="{color}" fill-rule="evenodd" transform="translate({x} {y})" d="{d}"/>')
        x+=width+10
    return ''.join(paths)

def wordmark(color,x=0,y=0):
    return line('FIT PRO',x,y,color)+line('PLAYER',x,y+80,color)

for variant,sc,tc in [('color',TEAL,INK),('black','#000000','#000000'),('white','#ffffff','#ffffff'),('mono',TEAL,TEAL)]:
    save(f'fit-pro-player-symbol-{variant}',symbol(sc))
    save(f'fit-pro-player-horizontal-{variant}',symbol(sc)+wordmark(tc,280,60),620,256)
    save(f'fit-pro-player-stacked-{variant}',f'<g transform="translate(42 0)">{symbol(sc)}</g>'+wordmark(tc,12,284),340,440)
    save(f'fit-pro-player-wordmark-{variant}',wordmark(tc,12,12),340,160)

# Full bleed square background. Platform controls the outer clipping shape.
icon = doc(f'<rect width="256" height="256" fill="{TEAL}"/><g transform="translate(36 36) scale(.71875)">{symbol("#ffffff")}</g>')
# Entire mark fits inside the central maskable safe-zone circle (radius 102.4).
mask = doc(f'<rect width="256" height="256" fill="{TEAL}"/><g transform="translate(44 44) scale(.65625)">{symbol("#ffffff")}</g>')
(OUT/'pwa-icon.svg').write_text(icon,encoding='utf-8')
(OUT/'pwa-maskable.svg').write_text(mask,encoding='utf-8')
for size in (180,192,512):
    cairosvg.svg2png(bytestring=icon.encode(),write_to=str(WEB/f'icon-{size}.png'),output_width=size,output_height=size)
for size in (192,512):
    cairosvg.svg2png(bytestring=mask.encode(),write_to=str(WEB/f'icon-maskable-{size}.png'),output_width=size,output_height=size)
for size in (16,32,48):
    cairosvg.svg2png(bytestring=icon.encode(),write_to=str(WEB/f'favicon-{size}.png'),output_width=size,output_height=size)
from PIL import Image
Image.open(WEB/'favicon-48.png').save(WEB/'favicon.ico',sizes=[(16,16),(32,32),(48,48)])
(PUBLIC/'brand-symbol.svg').write_text(doc(symbol(TEAL)),encoding='utf-8')
(PUBLIC/'brand-logo.svg').write_text(doc(symbol(TEAL)+wordmark(TEAL,280,60),620,256),encoding='utf-8')
cairosvg.svg2png(bytestring=doc(symbol(TEAL)).encode(),write_to=str(OUT/'fit-pro-player-symbol-color.png'),output_width=512,output_height=512)
for name in ('horizontal-color','horizontal-white','stacked-color'):
    path=OUT/f'fit-pro-player-{name}.svg'
    cairosvg.svg2png(url=str(path),write_to=str(path.with_suffix('.png')),output_width=1240)

spec={
 'brand':'Fit Pro Player','title':'Identidade final / Halter','status':'final','final':True,'brand_color':TEAL,'greyscale':False,
 'brief':'Planejamento de treinos e acompanhamento de cargas e evolução para alunos e profissionais. Halter aprovado como símbolo; identidade forte, direta e consistente.',
 'industry':'fitness','mockups':['app-icon','website','business-card'],
 'concepts':[{'name':'Força em movimento','idea':'Um halter hexagonal em diagonal identifica a musculação e transmite ação.','symbol':'fit-pro-player-symbol-color.svg','lockup':'fit-pro-player-horizontal-color.svg','symbol_on_tile':'fit-pro-player-symbol-white.svg','lockup_on_dark':'fit-pro-player-horizontal-white.svg','tile_color':TEAL,'rationale':['Silhueta reconhecível de academia.','Forma compacta para instalação no celular.','Letras vetoriais próprias.']}]
}
(OUT/'presentation.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2),encoding='utf-8')

# Native packages and offline/printed plans share the same vector source.
(ROOT/'frontend/src/lib/brand.js').write_text('// Generated by scripts/build-brand-kit.py\nexport const BRAND_SYMBOL_SVG = '+json.dumps(doc(symbol(TEAL)))+';\n',encoding='utf-8')
cairosvg.svg2png(bytestring=icon.encode(),write_to=str(ROOT/'frontend/resources/icon.png'),output_width=1024,output_height=1024)
native=ROOT/'frontend/android/app/src/main/res'
for path in native.glob('mipmap-*/*.png'):
    w,h=Image.open(path).size
    if path.stem=='ic_launcher_foreground':
        art=doc(f'<g transform="translate(51.2 51.2) scale(.6)">{symbol("#ffffff")}</g>')
    elif path.stem=='ic_launcher_background':
        art=doc(f'<rect width="256" height="256" fill="{TEAL}"/>')
    elif path.stem=='ic_launcher_round':
        art=icon.replace('<rect width="256" height="256"', '<circle cx="128" cy="128" r="128"')
    else:
        art=icon
    cairosvg.svg2png(bytestring=art.encode(),write_to=str(path),output_width=w,output_height=h)
ios=ROOT/'frontend/ios/App/App/Assets.xcassets'
cairosvg.svg2png(bytestring=icon.encode(),write_to=str(ios/'AppIcon.appiconset/AppIcon-512@2x.png'),output_width=1024,output_height=1024)
ios_icon=ios/'AppIcon.appiconset/AppIcon-512@2x.png'
with Image.open(ios_icon) as image:
    image.convert('RGB').save(ios_icon)
for path in list(native.glob('drawable*/splash.png'))+list((ios/'Splash.imageset').glob('*.png')):
    w,h=Image.open(path).size
    side=round(min(w,h)*.24)
    art=doc(f'<rect width="{w}" height="{h}" fill="{INK}"/><g transform="translate({(w-side)/2} {(h-side)/2}) scale({side/256})">{symbol("#ffffff")}</g>',w,h)
    cairosvg.svg2png(bytestring=art.encode(),write_to=str(path),output_width=w,output_height=h)
banner=doc(f'<rect width="1320" height="380" rx="28" fill="{INK}"/><g transform="translate(64 60)">{symbol(TEAL)}</g><g transform="translate(100 0)">{wordmark("#ffffff",280,84)}</g><text x="780" y="166" fill="#ffffff" font-family="Segoe UI,Arial,sans-serif" font-size="27">Seu treino. Seu progresso.</text><text x="780" y="212" fill="#ffffff" font-family="Segoe UI,Arial,sans-serif" font-size="27">Seus dados.</text>',1320,380)
(ROOT/'assets/banner.svg').write_text(banner,encoding='utf-8')
print('Created vector masters, PNGs, favicon and PWA icon assets:',OUT)
