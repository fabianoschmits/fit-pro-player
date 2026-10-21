import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();await page.goto('http://localhost:3019/api/projects/composition/preview?__hf_shader_capture_scale=1&__hf_shader_loading=player',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.__timelines?.['scene-intro']);
 console.log('FRAMES',page.frames().map(f=>f.url()));
 for(const frame of page.frames()){
  const result=await frame.evaluate(()=>({hasLogo:!!document.querySelector('#intro-brand .logo'),globals:Object.keys(window).filter(k=>/seek|hyper|timeline|hf/i.test(k)).slice(0,40),images:Array.from(document.images).filter(i=>/brand-logo/.test(i.src)).map(i=>({src:i.src,width:i.naturalWidth,complete:i.complete,opacity:getComputedStyle(i).opacity,visibility:getComputedStyle(i).visibility,display:getComputedStyle(i).display,box:i.getBoundingClientRect().toJSON(),ancestors:Array.from((function*(el){while(el){yield el;el=el.parentElement;}})(i)).slice(0,6).map(e=>({id:e.id,class:e.className,opacity:getComputedStyle(e).opacity,display:getComputedStyle(e).display,visibility:getComputedStyle(e).visibility}))}))}));
  console.log(JSON.stringify(result));
  if(result.hasLogo){const state=await frame.evaluate(()=>{
   const tl=window.__timelines['scene-intro'];const p=document.querySelector('#intro-brand');
   const before={time:tl.time(),opacity:getComputedStyle(p).opacity};
   const tweens=tl.getChildren(false,true,false).filter(t=>t.targets().some(e=>e.id==='intro-brand')).map(t=>({start:t.startTime(),duration:t.duration(),opacity:t.vars.opacity,immediate:t.vars.immediateRender}));
   tl.seek(2.5,false);return {keys:Object.keys(window.__hyperframes),hfKeys:Object.keys(window.__hf||{}),seekSource:typeof window.__hf?.seek==='function'?String(window.__hf.seek).slice(0,500):null,before,after:{time:tl.time(),opacity:getComputedStyle(p).opacity},tweens};
  });console.log(JSON.stringify(state));assert.equal(state.after.opacity,'1','The intro brand must be visible at 2.5 seconds');
  const captions=await frame.evaluate(()=>{
   const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
   const groups=Array.from(document.querySelectorAll('.caption'));
   return {count:groups.length,groups:groups.map(g=>({id:g.id,start:Number(g.dataset.start),duration:Number(g.dataset.duration),lines:Array.from(g.querySelectorAll('.caption-line')).map(p=>{const s=getComputedStyle(p);ctx.font=`${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;return {text:p.textContent,width:ctx.measureText(p.textContent).width,fontSize:parseFloat(s.fontSize)};})}))};
  });
  assert.equal(captions.count,82);assert.ok(captions.groups.every(g=>g.lines.length>0&&g.lines.length<=2&&g.lines.every(l=>l.width<=816&&l.fontSize>=48)),'Every real caption must fit at readable size');
  await writeFile(new URL('../qc/browser-proof.json',import.meta.url),JSON.stringify({intro:state.after,captions},null,2)+'\n');
  console.log('PASS: intro visible and all 82 real caption groups fit, at 52px.');}
 }
}finally{await browser.close();}
