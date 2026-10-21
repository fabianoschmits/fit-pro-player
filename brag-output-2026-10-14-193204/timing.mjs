export function schedule(lines, start, end) {
  if (!(end > start)) throw new Error('Invalid scene window');
  if (!lines.length || lines.some(l=>!(l.duration>0))) throw new Error('Speech durations must be positive');
  const margin=0.12, gap=0.09;
  const available=end-start-margin*2-gap*(lines.length-1);
  if (!(available>0)) throw new Error('Scene window too short');
  const rate=lines.reduce((s,l)=>s+l.duration,0)/available;
  let cursor=start+margin;
  return lines.map(line=>{const duration=line.duration/rate;const slot={...line,start:cursor,end:cursor+duration,duration,rate};cursor=slot.end+gap;return slot;});
}
export function wrapCaption(text, max=40) {
  const words=text.trim().split(/\s+/);
  if(text.length<=max) return [text.trim()];
  let best=null;
  for(let i=1;i<words.length;i++) {
    const a=words.slice(0,i).join(' '),b=words.slice(i).join(' ');
    if(a.length<=max && b.length<=max && (!best || Math.abs(a.length-b.length)<best.diff)) best={a,b,diff:Math.abs(a.length-b.length)};
  }
  if(!best) throw new Error(`Caption too long: ${text}`);
  return [best.a,best.b];
}
export function toSrt(cues) {
  const stamp=t=>{const ms=Math.round(t*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
  return cues.map((c,i)=>`${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${Array.isArray(c.lines)?c.lines.join('\n'):c.text}\n`).join('\n');
}
