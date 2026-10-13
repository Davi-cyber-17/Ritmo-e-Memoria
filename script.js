(() => {
  'use strict';

  // ---------- Configuração ----------
  const LEVELS = {
    easy:   { name: 'Fácil',   on: 650, gap: 280, hint: 'Sequência lenta, ideal para aquecer.' },
    medium: { name: 'Médio',   on: 450, gap: 200, hint: 'Ritmo equilibrado. Ouça e repita na mesma ordem.' },
    hard:   { name: 'Difícil', on: 270, gap: 120, hint: 'Rápido! Não pisque.' }
  };
  // Uma nota por botão (escala pentatônica, tom diferente para cada cor)
  const FREQS = [329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
  const STAR_STEP = 6; // pontos por estrela (máx. 5)

  // ---------- Elementos ----------
  const $ = id => document.getElementById(id);
  const pads = [...document.querySelectorAll('.pad')];
  const padsBox = $('pads');
  const scoreEl = $('score'), bestEl = $('best'), starsEl = $('stars'), statusEl = $('status');
  const menu = $('menu'), gameover = $('gameover'), settings = $('settings');

  // ---------- Estado ----------
  let level = 'medium';
  let seq = [];
  let step = 0;
  let accepting = false;
  let running = false;
  let runId = 0; // invalida reproduções antigas
  const opts = { sound: true, vibe: true };
  let best = { easy: 0, medium: 0, hard: 0 };

  try {
    const saved = JSON.parse(localStorage.getItem('memoria-sonora') || '{}');
    if (saved.best) best = { ...best, ...saved.best };
    if (saved.opts) Object.assign(opts, saved.opts);
    if (LEVELS[saved.level]) level = saved.level;
  } catch (e) {}
  const persist = () => {
    try { localStorage.setItem('memoria-sonora', JSON.stringify({ best, opts, level })); } catch (e) {}
  };

  // ---------- Áudio ----------
  let ctx = null;
  const audio = () => {
    if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx = new AC(); }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  function tone(freq, dur, type = 'sine', vol = 0.25) {
    if (!opts.sound) return;
    const c = audio(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    const t = c.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur / 1000);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur / 1000 + 0.05);
  }
  function errorSound() {
    tone(140, 500, 'sawtooth', 0.3); tone(100, 600, 'square', 0.15);
  }
  function winJingle() {
    [523.25, 659.25, 783.99].forEach((f, i) => setTimeout(() => tone(f, 160, 'triangle', 0.2), i * 90));
  }
  const vibrate = p => { if (opts.vibe && navigator.vibrate) navigator.vibrate(p); };

  // ---------- Interface ----------
  const wait = ms => new Promise(r => setTimeout(r, ms));
  function renderStars(score) {
    const n = Math.min(5, Math.floor(score / STAR_STEP));
    starsEl.innerHTML = Array.from({ length: 5 }, (_, i) => `<b class="${i < n ? 'on' : ''}">★</b>`).join('');
  }
  function renderScore(score, bump) {
    scoreEl.textContent = score;
    renderStars(score);
    if (bump) { scoreEl.classList.remove('bump'); void scoreEl.offsetWidth; scoreEl.classList.add('bump'); }
  }
  function renderBest() { bestEl.textContent = `Recorde (${LEVELS[level].name}): ${best[level]}`; }
  function setStatus(t, accent) { statusEl.textContent = t; statusEl.classList.toggle('accent', !!accent); }
  function lock(v) { padsBox.classList.toggle('locked', v); }
  function show(el, v) { el.classList.toggle('show', v); }

  function flash(i, ms) {
    pads[i].classList.add('lit');
    tone(FREQS[i], ms + 80, 'sine');
    return wait(ms).then(() => pads[i].classList.remove('lit'));
  }

  // ---------- Jogo ----------
  function startGame() {
    audio(); // desbloqueia o áudio no primeiro toque
    runId++;
    seq = []; step = 0; running = true; accepting = false;
    renderScore(0); renderBest();
    show(menu, false); show(gameover, false); show(settings, false);
    setStatus('Prepare-se…');
    lock(true);
    const id = runId;
    wait(600).then(() => { if (id === runId) nextRound(); });
  }

  async function nextRound() {
    const id = runId;
    seq.push(Math.floor(Math.random() * pads.length));
    step = 0; accepting = false; lock(true);
    setStatus('Ouça…', true);
    const L = LEVELS[level];
    await wait(400);
    for (const i of seq) {
      if (id !== runId) return;
      await flash(i, L.on);
      await wait(L.gap);
    }
    if (id !== runId) return;
    accepting = true; lock(false);
    setStatus('Sua vez!');
  }

  function press(i) {
    audio();
    if (!running || !accepting) return;
    pads[i].classList.add('lit');
    setTimeout(() => pads[i].classList.remove('lit'), 160);
    tone(FREQS[i], 260, 'sine');
    vibrate(15);

    if (i !== seq[step]) return fail();
    step++;
    if (step === seq.length) {
      accepting = false; lock(true);
      const score = seq.length;
      renderScore(score, true);
      if (score > best[level]) { best[level] = score; renderBest(); persist(); }
      setStatus('Muito bem!', true);
      setTimeout(winJingle, 200);
      const id = runId;
      wait(1100).then(() => { if (id === runId) nextRound(); });
    }
  }

  function fail() {
    running = false; accepting = false; lock(true);
    errorSound(); vibrate([80, 60, 160]);
    padsBox.classList.remove('error'); void padsBox.offsetWidth; padsBox.classList.add('error');
    setStatus('Errou!');
    const score = seq.length - 1;
    const isRecord = score > 0 && score >= best[level];
    $('finalScore').textContent = score;
    $('finalMsg').textContent = isRecord ? 'Novo recorde! 🏆' : `Recorde (${LEVELS[level].name}): ${best[level]}`;
    setTimeout(() => show(gameover, true), 900);
  }

  function goMenu() {
    runId++; running = false; accepting = false; lock(true);
    pads.forEach(p => p.classList.remove('lit'));
    show(gameover, false); show(settings, false); show(menu, true);
    seq = []; renderScore(0); renderBest(); setStatus('Desafie sua memória');
  }

  function setLevel(l) {
    level = l; persist();
    document.querySelectorAll('.level').forEach(b => b.classList.toggle('active', b.dataset.level === l));
    $('levelHint').textContent = LEVELS[l].hint;
    renderBest();
  }

  // ---------- Eventos ----------
  pads.forEach((p, i) => {
    p.addEventListener('pointerdown', e => { e.preventDefault(); press(i); });
  });
  document.addEventListener('keydown', e => {
    const k = parseInt(e.key, 10);
    if (k >= 1 && k <= 6) press(k - 1);
    if (e.key === 'Escape') show(settings, false);
  });
  $('btnPlay').onclick = startGame;
  $('btnAgain').onclick = startGame;
  $('btnMenu').onclick = goMenu;
  $('btnHome').onclick = goMenu;
  $('btnSettings').onclick = () => show(settings, true);
  $('btnCloseSettings').onclick = () => show(settings, false);
  document.querySelectorAll('.level').forEach(b => b.onclick = () => setLevel(b.dataset.level));
  $('optSound').onchange = e => { opts.sound = e.target.checked; persist(); };
  $('optVibe').onchange = e => { opts.vibe = e.target.checked; persist(); };
  $('btnResetBest').onclick = () => { best = { easy: 0, medium: 0, hard: 0 }; persist(); renderBest(); };

  // ---------- Início ----------
  $('optSound').checked = opts.sound;
  $('optVibe').checked = opts.vibe;
  lock(true);
  setLevel(level);
  renderScore(0);
})();
