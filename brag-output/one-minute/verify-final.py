"""Verify the delivered video, including each spoken segment in its actual mix."""
import json
import subprocess
from pathlib import Path
import numpy as np

BASE = Path(__file__).resolve().parent
VIDEO = BASE.parent / 'fit-pro-player-1min.mp4'
SR = 16000

def run(args):
    p = subprocess.run(args, capture_output=True)
    if p.returncode:
        raise RuntimeError(p.stderr.decode('utf-8', errors='replace'))
    return p.stdout

def decode(path):
    return np.frombuffer(run(['ffmpeg','-v','error','-i',str(path),'-vn','-ac','1','-ar',str(SR),'-f','f32le','-']), dtype='<f4').copy()

def voice_band(samples, low=600, high=4000):
    spectrum=np.fft.rfft(samples)
    frequencies=np.fft.rfftfreq(len(samples),1/SR)
    spectrum[(frequencies<low)|(frequencies>high)]=0
    return np.fft.irfft(spectrum,n=len(samples))

meta=json.loads(run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(VIDEO)]))
v=next(s for s in meta['streams'] if s['codec_type']=='video')
a=next(s for s in meta['streams'] if s['codec_type']=='audio')
assert v['codec_name']=='h264' and (v['width'],v['height'])==(1080,1920)
assert v['r_frame_rate']=='30/1' and int(v['nb_frames'])==1800
assert abs(float(meta['format']['duration'])-60)<.001
assert a['codec_name']=='aac' and int(a['channels'])==2
run(['ffmpeg','-v','error','-xerror','-i',str(VIDEO),'-f','null','-'])

mixed=decode(VIDEO)
voices=json.loads((BASE/'narration-meta.json').read_text(encoding='utf-8'))
checks=[]
for line in voices['lines']:
    source=BASE/'composition'/line['path'].replace('.wav','-mix.wav')
    expected=decode(source)
    start=round(line['start']*SR)
    best=(-1,None)
    for shift in [0,-16,16,-32,32,-80,80,-160,160,-320,320]:
        observed=mixed[start+shift:start+shift+len(expected)]
        if len(observed)!=len(expected):
            continue
        e=voice_band(expected)
        o=voice_band(observed)
        correlation=float(np.dot(e,o)/np.sqrt(np.dot(e,e)*np.dot(o,o)))
        if correlation>best[0]:
            best=(correlation,shift/SR)
    check={'id':line['id'],'start':line['start'],'duration':line['duration'],'vocalBandCorrelation':round(best[0],6),'bestOffsetSeconds':best[1],'present':best[0]>.85}
    checks.append(check)
    print(json.dumps(check),flush=True)
    if not check['present']:
        raise RuntimeError(f"Narration {line['id']} was not verified in the actual video mix.")

raw=BASE.parent/'fit-pro-player-1min.render.mp4'
def audio_hash(path):
    return run(['ffmpeg','-v','error','-i',str(path),'-map','0:a:0','-c','copy','-f','hash','-hash','sha256','-']).decode().strip()
music=decode(BASE/'composition/assets/music/gym-electronic.wav')
music_checks=[]
for start,end in [(11.4,12.05),(21.15,22.4),(46.9,47.8)]:
    lo,hi=round(start*SR),round(end*SR)
    reference=voice_band(music[lo:hi],50,180)
    observed=voice_band(mixed[lo:hi],50,180)
    correlation=float(np.dot(reference,observed)/np.sqrt(np.dot(reference,reference)*np.dot(observed,observed)))
    rms_db=float(20*np.log10(max(np.sqrt(np.mean(observed**2)),1e-12)))
    item={'start':start,'end':end,'bassCorrelation':round(correlation,6),'bassRmsDbfs':round(rms_db,2),'present':correlation>.70 and rms_db>-55}
    music_checks.append(item)
    print(json.dumps(item),flush=True)
    assert item['present'], 'Original gym music was not verified in the delivered audio.'

original_hash=audio_hash(raw)
delivered_hash=audio_hash(VIDEO)
assert original_hash==delivered_hash, 'Poster processing changed the audio.'

result={'ok':True,'durationSeconds':60,'frames':1800,'width':1080,'height':1920,'fps':'30/1','videoCodec':v['codec_name'],'audioCodec':a['codec_name'],'sampleRate':a['sample_rate'],'channels':a['channels'],'sizeBytes':int(meta['format']['size']),'decodePassed':True,'voiceSegments':checks,'musicPresence':music_checks,'audioPreservedByPoster':True,'audioPacketHash':delivered_hash}
(BASE/'final-verification.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print('PASS: 60 seconds / 1800 frames, all 8 narration segments present, audio preserved, complete decoding.')
