/*
 * ============================================================
 *  essays 随笔集 · 引擎
 *  ----------------------------------------------------------
 *  结构：
 *    0. 文章选择：?id=xxx 打开指定随笔；不传则自动打开唯一一篇，
 *       多篇时显示目录页
 *    1. 封面（缓冲/开启）→ 进入正文
 *    2. 根据选中随笔渲染整篇内容（每篇可独立主题/音乐）
 *    3. 滚动渐入动画（IntersectionObserver）
 *    4. 音乐引擎：真实音频 + 内置合成占位（Web Audio）
 *    5. 歌词同步 / 试听轮播
 *    6. 阅读进度条 + 漂浮光点背景
 *  ============================================================
 */
(function () {
  'use strict';

  var ESSAYS = window.ESSAYS || [];

  /* 主题默认值 */
  var DEFAULT_THEME = {
    fontFamily: "'LXGW WenKai', 'Kaiti SC', 'STKaiti', 'KaiTi', serif",
    accent: '#e8c68a',
    accentSoft: 'rgba(232, 198, 138, 0.16)',
    text: '#e9e2d0',
    textDim: '#9b8f7d',
    bgTop: '#0d0e13',
    bgBottom: '#16171f',
    particles: 42
  };

  /* ---- 文章选择 ---- */
  var params = new URLSearchParams(window.location.search);
  var pickId = params.get('id');
  var selected = ESSAYS.filter(function (e) { return e.id === pickId; })[0];
  var pickerMode = !selected && ESSAYS.length > 1;
  if (!selected && !pickerMode) selected = ESSAYS[0];

  var CFG = selected;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- 工具 ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* 兼容各平台：play() 可能返回 Promise（现代浏览器）或 undefined（部分内置浏览器） */
  function safePlay(a) {
    try {
      var p = a.play();
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (e) { /* 忽略，等待用户手势 */ }
  }

  /* ---------------- DOM ---------------- */
  var cover = $('#cover');
  var coverBtn = $('#coverBtn');
  var essayRoot = $('#essay');
  var progressBar = $('#progressBar');
  var musicBtn = $('#musicBtn');
  var musicBadge = $('#musicBadge');
  var lyricLine = $('#lyricLine');
  var particlesCanvas = $('#particles');

  /* ---------------- 主题 -> CSS 变量 ---------------- */
  function applyTheme(theme) {
    var t = theme || DEFAULT_THEME;
    var root = document.documentElement.style;
    root.setProperty('--accent', t.accent || DEFAULT_THEME.accent);
    root.setProperty('--accent-soft', t.accentSoft || DEFAULT_THEME.accentSoft);
    root.setProperty('--text', t.text || DEFAULT_THEME.text);
    root.setProperty('--text-dim', t.textDim || DEFAULT_THEME.textDim);
    root.setProperty('--bg-top', t.bgTop || DEFAULT_THEME.bgTop);
    root.setProperty('--bg-bottom', t.bgBottom || DEFAULT_THEME.bgBottom);
    root.setProperty('--font', t.fontFamily || DEFAULT_THEME.fontFamily);
  }

  /* ---------------- 封面信息 ---------------- */
  function applyMeta() {
    if (pickerMode) {
      $('#coverEyebrow').textContent = '随笔集';
      $('#coverTitle').textContent = '我的随笔';
      $('#coverSubtitle').textContent = '一篇一篇，慢慢写';
      $('#coverBtn').textContent = '看看';
      $('#coverTip').textContent = '';
      document.title = '随笔集';
      return;
    }
    var m = CFG.meta;
    $('#coverEyebrow').textContent = m.coverEyebrow || '';
    $('#coverTitle').textContent = m.coverTitle || '';
    $('#coverSubtitle').textContent = m.coverSubtitle || '';
    $('#coverBtn').textContent = m.coverHint || '轻触 开启';
    $('#coverTip').textContent = m.tip || '';
    document.title = m.pageTitle || m.coverTitle || '';
  }

  /* ---------------- 目录页（多篇时） ---------------- */
  function renderPicker() {
    var html = '<div class="essay-list">';
    html += '<h2 class="essay-list-title">随笔集</h2>';
    html += '<p class="essay-list-sub">点击进入任意一篇</p>';
    ESSAYS.forEach(function (e) {
      html += '<a class="essay-item reveal" href="?id=' + encodeURIComponent(e.id) + '">';
      html += '<span class="essay-item-title">' + esc(e.listTitle || e.id) + '</span>';
      if (e.listDesc) html += '<span class="essay-item-desc">' + esc(e.listDesc) + '</span>';
      html += '<span class="essay-item-arrow">→</span>';
      html += '</a>';
    });
    html += '</div>';
    essayRoot.innerHTML = html;
  }

  /* ---------------- 渲染正文 ---------------- */
  function renderEssay() {
    if (pickerMode) { renderPicker(); return; }
    var essay = CFG.essay;
    var html = '';

    html += '<header class="hero">';
    html += '<p class="hero-eyebrow">' + esc(CFG.meta.date) + '</p>';
    html += '<h1 class="hero-title">' + esc(CFG.meta.coverTitle) + '</h1>';
    html += '<p class="hero-greet">' + esc(essay.hero) + '</p>';
    html += '<div class="hero-line"></div>';
    html += '</header>';

    essay.sections.forEach(function (sec) {
      html += '<section class="flow-section">';
      if (sec.heading) {
        html += '<h2 class="section-head reveal">' + esc(sec.heading) + '</h2>';
      }
      html += '<div class="section-body">';
      sec.paragraphs.forEach(function (p) {
        html += '<p class="paragraph reveal">' + esc(p) + '</p>';
      });
      html += '</div>';
      html += '</section>';
    });

    if (essay.lyricInterlude && essay.lyricInterlude.length) {
      html += '<blockquote class="lyric-card reveal">';
      html += '<span class="lyric-card-mark">&#9834;</span>';
      essay.lyricInterlude.forEach(function (line) {
        html += '<p>' + esc(line) + '</p>';
      });
      html += '</blockquote>';
    }

    if (essay.sign && essay.sign.length) {
      html += '<footer class="sign">';
      essay.sign.forEach(function (line) {
        html += '<p class="reveal">' + esc(line) + '</p>';
      });
      html += '</footer>';
    }

    essayRoot.innerHTML = html;
  }

  /* ---------------- 2. 滚动渐入 ---------------- */
  function initReveal() {
    var items = $all('.reveal');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('in-view'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------------- 3. 阅读进度 ---------------- */
  function initProgress() {
    var ticking = false;
    function update() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      progressBar.style.transform = 'scaleX(' + ratio + ')';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  /* ================= 4. 音乐引擎 ================= */
  var Music = {
    audio: null,          // <audio> 实例（有真实文件时）
    usingSynth: false,    // 是否使用内置合成占位音乐
    ctx: null,            // AudioContext（合成模式）
    synthGain: null,      // 合成主音量
    paused: false,        // 合成模式暂停标记
    fakeTime: 0,          // 合成模式累计播放时长（ms）
    fakeBase: 0,          // 合成模式本次播放起点（performance.now）
    lyricTimer: null,
    timeListener: null,

    start: function () {
      var music = CFG.music;
      var audio = new Audio(music.src);
      audio.loop = music.loop !== false;
      audio.volume = music.volume != null ? music.volume : 0.6;
      audio.preload = 'auto';

      var self = this;
      var fallbackTimer = setTimeout(function () {
        if (!self.audio && !self.usingSynth) self.useSynth();
      }, 4000);

      audio.addEventListener('canplaythrough', function () {
        clearTimeout(fallbackTimer);
        self.useAudio(audio);
      });
      audio.addEventListener('error', function () {
        clearTimeout(fallbackTimer);
        audio.src = '';
        self.useSynth();
      });

      this.audio = audio;
      safePlay(audio);
    },

    useAudio: function (audio) {
      this._stopSynth();
      this.audio = audio;
      this.usingSynth = false;
      musicBadge.textContent = CFG.music.title + ' · ' + CFG.music.artist;
      var self = this;
      audio.addEventListener('play', function () {
        self._updateIcon();
        self._startLyricSync();
      });
      audio.addEventListener('pause', function () {
        self._updateIcon();
        self._stopLyricSync();
      });
      safePlay(audio);
    },

    useSynth: function () {
      if (this.usingSynth) return;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { return; }
      this.usingSynth = true;
      var ctx = new AC();
      if (ctx.state === 'suspended') ctx.resume();
      this.ctx = ctx;

      var master = ctx.createGain();
      master.gain.value = 0.0;
      master.connect(ctx.destination);
      this.synthGain = master;

      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      filter.connect(master);

      var lfo = ctx.createOscillator();
      var lfoGain = ctx.createGain();
      lfo.frequency.value = 0.07;
      lfoGain.gain.value = 0.012;
      lfo.connect(lfoGain);
      lfoGain.connect(master.gain);
      lfo.start();

      [110, 138.59, 164.81, 220].forEach(function (f, i) {
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        osc.detune.value = (i % 2 === 0 ? 1 : -1) * (i + 3);
        g.gain.value = 0;
        g.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 4.5);
        osc.connect(g);
        g.connect(filter);
        osc.start();
      });

      master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 3);

      this.paused = false;
      this.fakeBase = performance.now();
      musicBadge.textContent = CFG.music.title + ' · ' + CFG.music.artist + '（试听）';
      this._startLyricCycle();
      this._updateIcon();
    },

    toggle: function () {
      if (this.usingSynth) {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
        if (this.paused) {
          this.paused = false;
          this._rampSynth(0.5);
          this.fakeBase = performance.now() - this.fakeTime;
          this._startLyricCycle();
        } else {
          this.paused = true;
          this.fakeTime = performance.now() - this.fakeBase;
          this._rampSynth(0);
          this._stopLyricCycle();
        }
      } else if (this.audio) {
        if (this.audio.paused) safePlay(this.audio);
        else this.audio.pause();
      }
      this._updateIcon();
    },

    _rampSynth: function (v) {
      if (!this.ctx || !this.synthGain) return;
      this.synthGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.3);
    },

    _stopSynth: function () {
      if (!this.ctx) return;
      try { this._rampSynth(0); } catch (e) {}
      var ctx = this.ctx;
      setTimeout(function () {
        try { ctx.close && ctx.close(); } catch (e) {}
      }, 800);
      this.ctx = null;
      this.synthGain = null;
      this._stopLyricCycle();
      this.usingSynth = false;
      this.paused = false;
    },

    _startLyricSync: function () {
      var self = this;
      this._stopLyricSync();
      var lyrics = CFG.music.lyrics || [];
      if (!lyrics.length) return;
      var hasTime = lyrics.some(function (l) { return typeof l.time === 'number'; });
      if (!hasTime) { this._startLyricCycle(); return; }
      var current = -1;
      var onTime = function () {
        var t = self.audio.currentTime;
        var idx = -1;
        for (var i = 0; i < lyrics.length; i++) {
          if (lyrics[i].time <= t) idx = i; else break;
        }
        if (idx !== current) {
          current = idx;
          self._showLyric(idx >= 0 ? lyrics[idx].text : '');
        }
      };
      this.audio.addEventListener('timeupdate', onTime);
      this.timeListener = onTime;
      onTime();
    },

    _stopLyricSync: function () {
      if (this.timeListener && this.audio) {
        this.audio.removeEventListener('timeupdate', this.timeListener);
        this.timeListener = null;
      }
    },

    _startLyricCycle: function () {
      var self = this;
      this._stopLyricCycle();
      var lyrics = CFG.music.lyrics || [];
      if (!lyrics.length) return;
      var i = 0;
      this._showLyric(lyrics[0].text);
      this.lyricTimer = setInterval(function () {
        i = (i + 1) % lyrics.length;
        self._showLyric(lyrics[i].text);
      }, 2600);
    },

    _stopLyricCycle: function () {
      if (this.lyricTimer) {
        clearInterval(this.lyricTimer);
        this.lyricTimer = null;
      }
    },

    _showLyric: function (text) {
      lyricLine.classList.remove('on');
      setTimeout(function () {
        lyricLine.textContent = text || '';
        lyricLine.classList.add('on');
      }, 180);
    },

    _updateIcon: function () {
      var playing = this.usingSynth ? !this.paused : !!(this.audio && !this.audio.paused);
      musicBtn.classList.toggle('playing', playing);
    }
  };

  /* ---------------- 5. 封面 -> 开启 ---------------- */
  function openPage() {
    if (document.body.classList.contains('opened')) return;
    document.body.classList.add('opened');
    if (!pickerMode) {
      Music.start();
      setTimeout(function () { $('#musicBadge').textContent = CFG.music.title || 'music'; }, 0);
    }
    setTimeout(initReveal, 120);
  }

  function bindCover() {
    coverBtn.addEventListener('click', function (e) { e.stopPropagation(); openPage(); });
    cover.addEventListener('click', openPage);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !document.body.classList.contains('opened')) openPage();
    });
  }

  /* ---------------- 6. 音乐按钮 ---------------- */
  function bindMusic() {
    musicBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      Music.toggle();
    });
  }

  /* ---------------- 7. 漂浮光点 ---------------- */
  function initParticles() {
    if (!particlesCanvas) return;
    var theme = CFG ? (CFG.theme || DEFAULT_THEME) : DEFAULT_THEME;
    var n = theme.particles != null ? theme.particles : 42;
    if (n <= 0 || reduceMotion) return;

    var canvas = particlesCanvas;
    var ctx2d = canvas.getContext && canvas.getContext('2d');
    if (!ctx2d) return;

    var W = canvas.width = window.innerWidth;
    var H = canvas.height = window.innerHeight;
    var hex = (theme.accent || '#e8c68a').replace('#', '');
    var num = parseInt(hex, 16);
    var rgb = [(num >> 16) & 255, (num >> 8) & 255, num & 255];

    var dots = [];
    for (var i = 0; i < n; i++) {
      dots.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.6 + 0.4,
        vy: Math.random() * 0.22 + 0.05,
        a: Math.random() * 0.5 + 0.12,
        ph: Math.random() * Math.PI * 2
      });
    }

    (function draw() {
      ctx2d.clearRect(0, 0, W, H);
      var t = performance.now() * 0.001;
      dots.forEach(function (d) {
        d.y -= d.vy;
        if (d.y < -4) { d.y = H + 4; d.x = Math.random() * W; }
        var tw = 0.55 + 0.45 * Math.sin(t * 0.8 + d.ph);
        ctx2d.beginPath();
        ctx2d.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx2d.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (d.a * tw).toFixed(3) + ')';
        ctx2d.fill();
      });
      requestAnimationFrame(draw);
    })();

    window.addEventListener('resize', function () {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    });
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    if (!CFG && !pickerMode) {
      essayRoot.innerHTML = '<p class="paragraph" style="text-align:center">暂无文章</p>';
      return;
    }
    applyMeta();
    if (pickerMode) document.body.classList.add('picker-mode');
    else applyTheme(CFG.theme);
    renderEssay();
    initProgress();
    bindCover();
    bindMusic();
    initParticles();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
