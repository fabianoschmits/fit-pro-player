"""Generate a visual review sheet from the actual Hyperframes snapshots."""
from pathlib import Path
from PIL import Image, ImageDraw
root=Path(__file__).resolve().parent
files=sorted((root/'qc/stills').glob('*.png'))
assert len(files)==24, f'Expected 24 real snapshots, found {len(files)}'
for n in range(3):
    sheet=Image.new('RGB',(4*270,2*510),(16,25,26))
    draw=ImageDraw.Draw(sheet)
    for k,path in enumerate(files[n*8:(n+1)*8]):
        frame=Image.open(path).convert('RGB')
        frame.thumbnail((270,480))
        x,y=(k%4)*270,(k//4)*510
        sheet.paste(frame,(x,y))
        draw.text((x+8,y+486),path.stem,fill=(255,255,255))
    target=root/f'qc/contact-{n+1}.jpg'
    sheet.save(target,quality=93)
    print(target)
