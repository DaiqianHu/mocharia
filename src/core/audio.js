/* ============================================================
   Tiny WebAudio synth for game "juice" — blips, hisses, jingles —
   plus a procedural background-music loop and a persistent mute.
   Everything routes through one master gain so mute kills it all.
   ============================================================ */

let AC = null, noiseBuf = null, master = null, musicGain = null;
const MUTE_KEY = 'mocha-rush-muted';
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch(e){}

export function audioCtx(){
  if (AC) return AC;
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    AC = new C();
    master = AC.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(AC.destination);
    musicGain = AC.createGain();
    musicGain.gain.value = 0.9;
    musicGain.connect(master);
    const len = AC.sampleRate * 0.5;
    noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i=0;i<len;i++) d[i] = Math.random()*2-1;
    // save battery when the tab is hidden
    document.addEventListener('visibilitychange', ()=>{
      if (!AC) return;
      if (document.hidden) AC.suspend(); else AC.resume();
    });
  } catch(e){ AC = null; }
  return AC;
}

export function isMuted(){ return muted; }
export function toggleMuted(){
  muted = !muted;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch(e){}
  if (master) master.gain.value = muted ? 0 : 1;
  return muted;
}

export function blip(freq=600, dur=0.08, type='sine', gain=0.12, slide=0){
  const a = audioCtx(); if(!a) return;
  try{
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, a.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40,freq+slide), a.currentTime+dur);
    g.gain.setValueAtTime(gain, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime+dur);
    o.connect(g); g.connect(master);
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
    s.connect(f); f.connect(g); g.connect(master);
    s.start(); s.stop(a.currentTime+dur+0.02);
  }catch(e){}
}

export function ding(){ blip(880,0.12,'sine',0.14); setTimeout(()=>blip(1320,0.22,'sine',0.12),90); }
export function buzz(){ blip(160,0.25,'sawtooth',0.10,-60); }
export function chaChing(){ blip(988,0.09,'square',0.07); setTimeout(()=>blip(1319,0.16,'square',0.07),70); setTimeout(()=>blip(1760,0.24,'sine',0.10),140); }

/* one ascending chime per star on the result card (i = 1..5) */
const STAR_FREQS = [523.25, 587.33, 659.25, 783.99, 880];
export function starChime(i){
  blip(STAR_FREQS[Math.min(4, Math.max(0, i-1))], 0.16, 'sine', 0.13);
}

/* rank-up / holiday-complete fanfare */
export function fanfare(){
  blip(523,0.14,'square',0.06);
  setTimeout(()=>blip(659,0.14,'square',0.06),130);
  setTimeout(()=>blip(784,0.14,'square',0.06),260);
  setTimeout(()=>{ blip(1047,0.5,'square',0.07); blip(1319,0.5,'sine',0.06); },400);
}

/* rush-hour horn — two quick honks then a rising chord */
export function rushHorn(){
  blip(392,0.16,'square',0.09);
  setTimeout(()=>blip(392,0.16,'square',0.09),180);
  setTimeout(()=>{ blip(523,0.4,'square',0.1); blip(659,0.4,'sine',0.07); },360);
}

/* liquid pour — filtered noise sweeping down */
export function pour(dur=0.45){
  const a = audioCtx(); if(!a || !noiseBuf) return;
  try{
    const s = a.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = a.createBiquadFilter(); f.type='bandpass'; f.Q.value=1.4;
    f.frequency.setValueAtTime(900, a.currentTime);
    f.frequency.exponentialRampToValueAtTime(420, a.currentTime+dur);
    const g = a.createGain();
    g.gain.setValueAtTime(0.001, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.09, a.currentTime+0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime+dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(); s.stop(a.currentTime+dur+0.02);
  }catch(e){}
}

/* ============================================================
   Background music — a cozy pentatonic café loop, scheduled a
   little ahead of time. Two alternating 4-bar phrases over a
   C · Am · F · G progression so it noodles without grating.
   ============================================================ */
const BPM = 96, STEP = 60/BPM/2;            // one step = an eighth note
const mtof = m => 440*Math.pow(2,(m-69)/12);
const BASS = [[36,43],[33,40],[29,36],[31,38]];   // root + fifth per bar
const PHRASES = [
  [76, 0,72,74, 76,79,76,74,   72, 0,69,72, 76,74,72,69,
   69,65,69,72, 74,72,69,65,   67, 0,71,74, 79,74,71,67],
  [72,74,76, 0, 79, 0,84,79,   76,72,69, 0, 72, 0,76,72,
   77,76,74,72, 69, 0,65,69,   67,69,71,74,  0,74,79, 0],
];
let musicTimer = null, nextT = 0, step = 0;

function note(when, midi, dur, type, vol){
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.value = mtof(midi);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(vol, when+0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, when+dur);
  o.connect(g); g.connect(musicGain);
  o.start(when); o.stop(when+dur+0.03);
}

export function startMusic(){
  if (musicTimer || !audioCtx()) return;
  nextT = AC.currentTime + 0.1; step = 0;
  musicTimer = setInterval(()=>{
    try{
      while (nextT < AC.currentTime + 0.3){
        const s = step % 32, bar = (s/8)|0;
        const phrase = PHRASES[((step/32)|0) % 2];
        if (s % 8 === 0) note(nextT, BASS[bar][0], STEP*1.8, 'triangle', 0.06);
        if (s % 8 === 4) note(nextT, BASS[bar][1], STEP*1.8, 'triangle', 0.05);
        if (s % 4 === 2) note(nextT, 96, 0.03, 'sine', 0.015);   // soft tick
        const m = phrase[s];
        if (m) note(nextT, m, STEP*0.92, 'triangle', 0.055);
        nextT += STEP; step++;
      }
    }catch(e){}
  }, 90);
}
