/* ============================================================
   Tiny WebAudio synth for game "juice" — blips, hisses, jingles.
   ============================================================ */

let AC = null, noiseBuf = null;

export function audioCtx(){
  if (AC) return AC;
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    AC = new C();
    const len = AC.sampleRate * 0.5;
    noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i=0;i<len;i++) d[i] = Math.random()*2-1;
  } catch(e){ AC = null; }
  return AC;
}

export function blip(freq=600, dur=0.08, type='sine', gain=0.12, slide=0){
  const a = audioCtx(); if(!a) return;
  try{
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, a.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40,freq+slide), a.currentTime+dur);
    g.gain.setValueAtTime(gain, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime+dur);
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime+dur+0.02);
  }catch(e){}
}

export function hiss(dur=0.12, gain=0.05, freq=900){
  const a = audioCtx(); if(!a || !noiseBuf) return;
  try{
    const s = a.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = a.createBiquadFilter(); f.type='bandpass'; f.frequency.value=freq; f.Q.value=0.8;
    const g = a.createGain();
    g.gain.setValueAtTime(gain, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime+dur);
    s.connect(f); f.connect(g); g.connect(a.destination);
    s.start(); s.stop(a.currentTime+dur+0.02);
  }catch(e){}
}

export function ding(){ blip(880,0.12,'sine',0.14); setTimeout(()=>blip(1320,0.22,'sine',0.12),90); }
export function buzz(){ blip(160,0.25,'sawtooth',0.10,-60); }
export function chaChing(){ blip(988,0.09,'square',0.07); setTimeout(()=>blip(1319,0.16,'square',0.07),70); setTimeout(()=>blip(1760,0.24,'sine',0.10),140); }
