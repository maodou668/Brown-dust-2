// ============================================================
//  音频系统（纯 Web Audio 实时合成，无需任何音频素材文件）
//  - BGM：按情境（主菜单 / 战斗 / BOSS / 剧情）程序化生成的循环配乐
//  - SFX：点击、攻击、暴击、治疗、击退、胜利、失败、抽卡等一次性音效
//  - 移动端自动播放策略：首次用户手势时再创建/恢复 AudioContext
//  注意：命名为 Sound，避免覆盖浏览器内置的 window.Audio
// ============================================================

const Sound = {
  ctx: null,
  master: null,
  musicGain: null,
  sfxGain: null,
  noiseBuf: null,
  muted: false,
  mood: null,
  _timer: null,
  _beat: 0,
  _pendingMood: 'home',

  MOODS: {
    home:   { bpm: 96,  chords: [[60,64,67],[57,60,64],[53,57,60],[55,59,62]], wave: 'triangle', bass: false, pad: 0.045, mel: 0.085 },
    battle: { bpm: 130, chords: [[57,60,64],[53,57,60],[60,64,67],[55,59,62]], wave: 'sawtooth', bass: true,  pad: 0.035, mel: 0.075 },
    boss:   { bpm: 82,  chords: [[50,53,57],[46,50,53],[43,46,50],[45,48,52]], wave: 'sawtooth', bass: true,  pad: 0.05,  mel: 0.07  },
    story:  { bpm: 68,  chords: [[60,64,67],[59,62,67],[57,60,64],[53,57,60]], wave: 'sine',     bass: false, pad: 0.05,  mel: 0.05  },
  },

  freq(m) { return 440 * Math.pow(2, (m - 69) / 12); },

  /** 在首次用户手势中创建 / 恢复音频上下文 */
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try { this.ctx = new AC(); } catch (e) { return false; }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.6; this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 1.0; this.sfxGain.connect(this.master);
      // 白噪声缓冲（攻击/受击用）
      const len = Math.floor(this.ctx.sampleRate * 0.3);
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  },

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('bd2_muted', m ? '1' : '0'); } catch (e) {}
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
    const btn = document.getElementById('btn-mute');
    if (btn) btn.textContent = m ? '🔇' : '🔊';
  },
  toggleMute() { this.ensure(); this.setMuted(!this.muted); if (!this.muted && !this.mood) this.bgm(this._pendingMood); },

  // ---------- 单个音符 ----------
  note(freq, t, dur, type, gain, target) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'triangle';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(target || this.sfxGain);
    o.start(t); o.stop(t + dur + 0.04);
  },

  noiseBurst(t, dur, cutoff, gain) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t); src.stop(t + dur + 0.02);
  },

  // ---------- 一次性音效 ----------
  sfx(name) {
    if (this.muted || !this.ensure()) return;
    const ctx = this.ctx, t = ctx.currentTime, F = this.freq.bind(this);
    switch (name) {
      case 'tap':
        this.note(880, t, 0.06, 'triangle', 0.05); break;
      case 'hit':
        this.noiseBurst(t, 0.12, 1800, 0.18); this.note(160, t, 0.12, 'sine', 0.12); break;
      case 'crit':
        this.noiseBurst(t, 0.16, 3000, 0.22);
        this.note(F(84), t, 0.1, 'square', 0.10); this.note(F(88), t + 0.05, 0.12, 'square', 0.10); break;
      case 'skill':
        this.note(300, t, 0.18, 'sawtooth', 0.07);
        this.note(600, t + 0.04, 0.16, 'sawtooth', 0.06); break;
      case 'heal':
        [60, 64, 67, 72].forEach((m, i) => this.note(F(m), t + i * 0.05, 0.25, 'sine', 0.09)); break;
      case 'knock':
        { const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'sine'; o.frequency.setValueAtTime(620, t); o.frequency.exponentialRampToValueAtTime(180, t + 0.22);
          g.gain.setValueAtTime(0.14, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
          o.connect(g).connect(this.sfxGain); o.start(t); o.stop(t + 0.26); } break;
      case 'status':
        this.note(F(70), t, 0.14, 'square', 0.06); this.note(F(66), t + 0.06, 0.16, 'square', 0.06); break;
      case 'enrage':
        { const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'sawtooth'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.5);
          g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
          o.connect(g).connect(this.sfxGain); o.start(t); o.stop(t + 0.6); } break;
      case 'victory':
        [60, 64, 67, 72].forEach((m, i) => this.note(F(m), t + i * 0.12, 0.4, 'triangle', 0.14)); break;
      case 'defeat':
        [57, 53, 48].forEach((m, i) => this.note(F(m), t + i * 0.18, 0.5, 'sine', 0.12)); break;
      case 'levelup':
        [60, 67, 72].forEach((m, i) => this.note(F(m), t + i * 0.07, 0.3, 'triangle', 0.11)); break;
      case 'pull':
        [72, 76, 79].forEach((m, i) => this.note(F(m), t + i * 0.05, 0.2, 'triangle', 0.10)); break;
      case 'pull5':
        [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => this.note(F(m), t + i * 0.06, 0.5, 'triangle', 0.13));
        this.noiseBurst(t, 0.3, 6000, 0.06); break;
      case 'open':
        this.note(F(67), t, 0.12, 'triangle', 0.08); this.note(F(72), t + 0.06, 0.18, 'triangle', 0.08); break;
    }
  },

  // ---------- 循环 BGM ----------
  bgm(mood) {
    if (mood === this.mood) return;
    this.mood = mood;
    this._pendingMood = mood;
    if (this.muted || !this.ensure()) return;
    this._startLoop();
  },

  stopBgm() { if (this._timer) { clearInterval(this._timer); this._timer = null; } this.mood = null; },

  _startLoop() {
    if (this._timer) clearInterval(this._timer);
    const cfg = this.MOODS[this.mood] || this.MOODS.home;
    const beatSec = 60 / cfg.bpm;
    this._beat = 0;
    const tick = () => {
      if (this.muted || !this.ctx) return;
      const t = this.ctx.currentTime + 0.04;
      const chord = cfg.chords[Math.floor(this._beat / 4) % cfg.chords.length];
      // 每 4 拍换一个和弦垫底
      if (this._beat % 4 === 0) {
        chord.forEach(m => this.note(this.freq(m), t, beatSec * 4 * 0.95, cfg.wave === 'sawtooth' ? 'triangle' : cfg.wave, cfg.pad, this.musicGain));
      }
      // 旋律（高八度琶音）
      const mel = chord[(this._beat * 2) % chord.length] + 12;
      this.note(this.freq(mel), t, beatSec * 0.85, cfg.wave, cfg.mel, this.musicGain);
      // 贝斯脉冲
      if (cfg.bass) this.note(this.freq(chord[0] - 12), t, beatSec * 0.5, 'sine', 0.06, this.musicGain);
      this._beat++;
    };
    tick();
    this._timer = setInterval(tick, beatSec * 1000);
  },
};

// 首次手势解锁音频 + 启动 BGM
(function () {
  try { Sound.muted = localStorage.getItem('bd2_muted') === '1'; } catch (e) {}
  const unlock = () => {
    if (!Sound.ensure()) return;
    if (!Sound.muted && !Sound.mood) Sound.bgm(Sound._pendingMood);
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('click', unlock);
  };
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('click', unlock);
  // 全局点击轻音（按钮 / 卡片）
  document.addEventListener('click', (e) => {
    if (e.target.closest('button, .btn, .nav-btn, .roster-card, .chapter-card, .trial-card, .gacha-tab, .comic-entry-card, .gear-slot, .gear-pick-item, .team-slot')) {
      Sound.sfx('tap');
    }
  });
  // 静音按钮
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-mute');
    if (btn) {
      btn.textContent = Sound.muted ? '🔇' : '🔊';
      btn.onclick = (e) => { e.stopPropagation(); Sound.toggleMute(); };
    }
  });
})();

window.Sound = Sound;
