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
    particles: 110
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
  var backBtn = $('#backBtn');
  var coverFX = { restart: null };   /* 封面特效的恢复入口（返回封面时重启） */

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
      /* 选择页封面为固定文案：增删随笔都不变 */
      $('#coverEyebrow').textContent = '随笔集';
      $('#coverTitle').textContent = '我的随笔';
      $('#coverSubtitle').textContent = '未来可期';
      $('#coverBtn').textContent = '轻触 开启';
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

  /* ---------------- 选择页（进入后先选一篇） ---------------- */
  function renderSelect() {
    var html = '<div class="essay-list">';
    html += '<h2 class="essay-list-title">随笔集</h2>';
    html += '<div class="essay-list-cards">';
    ESSAYS.forEach(function (e) {
      html += '<a class="essay-item select-card" href="?id=' + encodeURIComponent(e.id) + '" data-id="' + esc(e.id) + '">';
      html += '<span class="essay-item-title">' + esc(e.listTitle || e.id) + '</span>';
      if (e.listDesc) html += '<span class="essay-item-desc">' + esc(e.listDesc) + '</span>';
      html += '<span class="essay-item-arrow">→</span>';
      html += '</a>';
    });
    html += '</div>';
    html += '<p class="essay-list-hint" id="listHint">&#9660; 下滑查看更多</p>';
    html += '</div>';
    essayRoot.innerHTML = html;
    /* 篇目溢出时才显示下滑提示 */
    var cards = $('.essay-list-cards');
    var hint = $('#listHint');
    if (cards && hint) {
      hint.style.display = (cards.scrollHeight > cards.clientHeight) ? 'block' : 'none';
    }
  }

  /* 点击选择卡片 → 平滑进入该随笔 */
  function bindSelectCards() {
    essayRoot.addEventListener('click', function (e) {
      var card = e.target && e.target.closest ? e.target.closest('.select-card') : null;
      if (!card) return;
      e.preventDefault();
      openEssay(card.getAttribute('data-id'));
    });
  }

  function openEssay(id) {
    var e = ESSAYS.filter(function (x) { return x.id === id; })[0];
    if (!e || !pickerMode) return;
    if (window.history && history.replaceState) {
      history.replaceState(null, '', '?id=' + encodeURIComponent(id));
    }
    selected = e;
    CFG = e;
    pickerMode = false;
    document.body.classList.remove('picker-mode');

    /* 关键：在点击手势内【同步】启动音乐（移动端/微信自动播放必须在手势上下文，异步会失败） */
    Music.reset();
    Music.start();
    Music.markPlaying();
    setTimeout(function () { $('#musicBadge').textContent = CFG.music.title || 'music'; }, 0);

    function enter() {
      applyMeta();
      applyTheme(CFG.theme);
      renderEssay();
      initReveal();
      setBack(backToSelect);   /* 正文内可返回选择页读其他篇 */
    }

    if (window.gsap && !reduceMotion) {
      gsap.to(essayRoot, {
        opacity: 0, y: 14, duration: 0.32, ease: 'power2.in',
        onComplete: function () {
          enter();
          gsap.fromTo(essayRoot, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' });
          var hero = essayRoot.querySelector('.hero');
          if (hero) gsap.from(hero.children, { opacity: 0, y: 22, duration: 0.5, stagger: 0.12, ease: 'power2.out', delay: 0.15 });
        }
      });
    } else {
      enter();
    }
  }

  /* ---------------- 渲染正文 ---------------- */
  function renderEssay() {
    if (pickerMode) { renderSelect(); bindSelectCards(); return; }
    var essay = CFG.essay;
    var html = '';

    html += '<header class="hero">';
    html += '<p class="hero-eyebrow">' + esc(CFG.meta.date) + '</p>';
    html += '<h1 class="hero-title">' + esc(CFG.meta.coverTitle) + '</h1>';
    if (essay.hero) {
      html += '<p class="hero-greet">' + esc(essay.hero) + '</p>';
    }
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
      if (sec.image && sec.image.src) {
        html += '<figure class="essay-figure reveal">';
        html += '<img src="' + esc(sec.image.src) + '" alt="' + esc(sec.image.alt || '') + '" loading="lazy" />';
        if (sec.image.caption) {
          html += '<figcaption>' + esc(sec.image.caption) + '</figcaption>';
        }
        html += '</figure>';
      }
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
    userPlayed: false,    // 是否被用户手动点过音乐按钮（彩蛋：歌词仅手动开关后才轮播）
    fakeTime: 0,          // 合成模式累计播放时长（ms）
    fakeBase: 0,          // 合成模式本次播放起点（performance.now）
    lyricTimer: null,
    timeListener: null,
    fallbackTimer: null,  // 4s 降级合成音的定时器（退出时必须清除，否则会后播）

    /* 页面加载即预加载音频，进入时立即出声 */
    preload: function () {
      if (this.audio) return;
      var music = CFG.music;
      var a = new Audio(music.src);
      a.preload = 'auto';
      a.loop = music.loop !== false;
      a.volume = music.volume != null ? music.volume : 0.6;
      a.load();
      this.audio = a;
    },

    /* 切换随笔/退出前重置音乐状态 */
    reset: function () {
      if (this.fallbackTimer) { clearTimeout(this.fallbackTimer); this.fallbackTimer = null; }
      if (this.audio) {
        try { this.audio.pause(); } catch (e) {}
        try { this.audio.removeAttribute('src'); this.audio.load(); } catch (e) {}  /* load() 中止未完成的加载/排队播放 */
        this.audio = null;
      }
      if (this.ctx) { try { this.ctx.close(); } catch (e) {} }
      this.ctx = null;
      this.synthGain = null;
      this.usingSynth = false;
      this.paused = false;
      this._stopLyricSync();
      this._stopLyricCycle();
    },

    start: function () {
      var self = this;
      var audio = this.audio;
      if (!audio) { this.preload(); audio = this.audio; }
      if (!audio) return;

      this.fallbackTimer = setTimeout(function () {
        if (self.usingSynth) return;
        if (self.audio && !self.audio.paused) return; /* 已在播 */
        self.useSynth();
      }, 4000);

      audio.addEventListener('canplaythrough', function () {
        if (self.fallbackTimer) { clearTimeout(self.fallbackTimer); self.fallbackTimer = null; }
        self.useAudio(audio);
      });
      audio.addEventListener('error', function () {
        if (self.fallbackTimer) { clearTimeout(self.fallbackTimer); self.fallbackTimer = null; }
        self.useSynth();
      });

      /* 已预加载完成则直接播放 */
      if (audio.readyState >= 3) {
        if (this.fallbackTimer) { clearTimeout(this.fallbackTimer); this.fallbackTimer = null; }
        this.useAudio(audio);
      } else {
        safePlay(audio);
      }
    },

    useAudio: function (audio) {
      this._stopSynth();
      this.audio = audio;
      this.usingSynth = false;
      musicBadge.textContent = CFG.music.artist ? (CFG.music.title + ' · ' + CFG.music.artist) : CFG.music.title;
      var self = this;
      audio.addEventListener('play', function () {
        self._updateIcon();
        if (self.userPlayed) self._startLyricSync();   /* 彩蛋：仅手动开关后才显示歌词 */
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
      musicBadge.textContent = (CFG.music.artist ? (CFG.music.title + ' · ' + CFG.music.artist) : CFG.music.title) + '（试听）';
      if (this.userPlayed) this._startLyricCycle();   /* 彩蛋：仅手动开关后显示歌词 */
      this._updateIcon();
    },

    toggle: function () {
      this.userPlayed = true;   /* 用户手动操作过音乐按钮 */
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
    },

    /* 进入时乐观标记"播放中"，让音柱立即跳动（真实播放状态由事件再校正） */
    markPlaying: function () {
      musicBtn.classList.add('playing');
    }
  };

  /* ---------------- 5. 封面 -> 开启 ---------------- */
  /* 返回箭头控制（选择页/正文共用，圆润融入） */
  function setBack(fn) {
    if (!backBtn) return;
    backBtn.style.display = 'block';
    backBtn._action = fn;
  }
  function hideBack() {
    if (!backBtn) return;
    backBtn.style.display = 'none';
    backBtn._action = null;
  }

  /* 选择页返回封面 */
  function backToCover() {
    if (window.scrollTo) window.scrollTo(0, 0);
    hideBack();
    document.body.classList.remove('opened');
    if (coverFX.restart) coverFX.restart();   /* 恢复星星/流星动画 */
  }

  /* 正文返回选择页（换读其他篇） */
  function backToSelect() {
    if (window.scrollTo) window.scrollTo(0, 0);
    if (window.history && history.replaceState) history.replaceState(null, '', location.pathname);
    pickerMode = true;
    document.body.classList.add('picker-mode');
    Music.reset();
    applyMeta();
    renderEssay();
    setBack(backToCover);
    if (window.gsap && !reduceMotion) {
      gsap.fromTo('.select-card', { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.14, ease: 'power3.out', delay: 0.15 });
      gsap.from('.essay-list-title', { opacity: 0, y: 18, duration: 0.6, ease: 'power2.out', delay: 0.05 });
    }
  }

  function bindBack() {
    if (backBtn) backBtn.addEventListener('click', function () {
      if (backBtn._action) backBtn._action();
    });
  }

  function openPage() {
    if (document.body.classList.contains('opened')) return;
    document.body.classList.add('opened');
    if (pickerMode) {
      /* 选择页：卡片错落入场，不播音乐 */
      setBack(backToCover);
      if (window.gsap && !reduceMotion) {
        gsap.fromTo('.select-card', { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.14, ease: 'power3.out', delay: 0.15 });
        gsap.from('.essay-list-title', { opacity: 0, y: 18, duration: 0.6, ease: 'power2.out', delay: 0.05 });
      }
    } else {
      Music.start();
      Music.markPlaying();
      setTimeout(function () { $('#musicBadge').textContent = CFG.music.title || 'music'; }, 0);
      if (ESSAYS.length > 1) setBack(backToSelect);
      else hideBack();
    }
    setTimeout(initReveal, 120);
  }

  function bindCover() {
    /* 仅"轻触 开启"按钮可进入；点封面空白处不进入 */
    coverBtn.addEventListener('click', function (e) { e.stopPropagation(); openPage(); });
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

  /* ---------------- 7. 漂浮光点（沉浸增强：小星尘 + 大光晕） ---------------- */
  function initParticles() {
    if (!particlesCanvas) return;
    var theme = CFG ? (CFG.theme || DEFAULT_THEME) : DEFAULT_THEME;
    var n = theme.particles != null ? theme.particles : 110;
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
        r: Math.random() * 2.2 + 0.5,
        vy: Math.random() * 0.28 + 0.06,
        a: Math.random() * 0.55 + 0.15,
        ph: Math.random() * Math.PI * 2
      });
    }

    /* 大光晕：缓慢漂移的柔光，制造纵深与沉浸感 */
    var orbs = [];
    for (var o = 0; o < 4; o++) {
      orbs.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 70 + Math.random() * 90,
        a: 0.014 + Math.random() * 0.022,
        vy: Math.random() * 0.05 + 0.01,
        ph: Math.random() * Math.PI * 2
      });
    }

    (function draw() {
      ctx2d.clearRect(0, 0, W, H);
      var t = performance.now() * 0.001;

      orbs.forEach(function (ob) {
        ob.y -= ob.vy;
        if (ob.y < -ob.r) { ob.y = H + ob.r; ob.x = Math.random() * W; }
        var tw = 0.7 + 0.3 * Math.sin(t * 0.4 + ob.ph);
        var g = ctx2d.createRadialGradient(ob.x, ob.y, 0, ob.x, ob.y, ob.r);
        g.addColorStop(0, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (ob.a * tw).toFixed(4) + ')');
        g.addColorStop(1, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)');
        ctx2d.fillStyle = g;
        ctx2d.beginPath();
        ctx2d.arc(ob.x, ob.y, ob.r, 0, Math.PI * 2);
        ctx2d.fill();
      });

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

  /* ---------------- 8. 封面繁星 + 点击光粒 ---------------- */
  function initCoverFX() {
    var canvas = $('#coverCanvas');
    if (!canvas || reduceMotion) return;
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;

    var W = canvas.width = window.innerWidth;
    var H = canvas.height = window.innerHeight;
    var theme = CFG ? (CFG.theme || DEFAULT_THEME) : DEFAULT_THEME;
    var hex = (theme.accent || '#e8c68a').replace('#', '');
    var num = parseInt(hex, 16);
    var gold = [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    var WHITE = [255, 255, 255];
    var rg = function (rgb, a) { return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a.toFixed(3) + ')'; };

    /* 金色粒子流（与正文背景同款，缓慢上飘） */
    var WARM = [255, 250, 235];
    var flows = [];
    for (var i = 0; i < 64; i++) {
      flows.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.6 + 0.4, a: Math.random() * 0.4 + 0.12, vy: Math.random() * 0.25 + 0.06, ph: Math.random() * Math.PI * 2 });
    }

    /* 避开"轻触 开启"按钮的脉冲波动范围，避免冲突 */
    var btnZone = { x: W / 2, y: H / 2, r: 140 };
    function updateBtnZone() {
      var b = coverBtn.getBoundingClientRect();
      if (!b || (b.width === 0 && b.height === 0)) return;
      btnZone.x = b.left + b.width / 2;
      btnZone.y = b.top + b.height / 2;
      btnZone.r = Math.max(b.width, b.height) / 2 * 1.25 + 22;
    }
    updateBtnZone();

    /* 星星边界：封面标题文字上沿，星星只在此之上分布、不越界 */
    var bandTop = H * 0.06;
    var bandBottom = H * 0.35;
    function updateBoundary() {
      var t = $('#coverTitle').getBoundingClientRect();
      var c = canvas.getBoundingClientRect();
      if (t && (t.width > 0 || t.height > 0)) {
        bandBottom = (t.top - c.top) - 18;
      }
      if (bandBottom - bandTop < 40) bandBottom = bandTop + H * 0.2;
    }
    updateBoundary();

    /* 5 颗呼吸金五星：横向均匀分布、错落两行、小范围飘动、不越界、与背景融为一个图层 */
    var stars = [];
    function newStar(i) {
      /* 分 5 列横向均匀排布，带少量抖动避免呆板 */
      var col = (i + 0.5) / 5;
      var bx = Math.max(44, Math.min(W - 44, W * col + (Math.random() - 0.5) * W * 0.06));
      /* 上下错落成两行，避免一条直线 */
      var bandH = Math.max(20, bandBottom - bandTop);
      var stagger = (i % 2 === 0) ? 0.24 : 0.55;
      var by = bandTop + bandH * stagger * (0.72 + Math.random() * 0.28);
      /* 避让按钮（安全兜底，正常不会碰到） */
      var dzx = bx - btnZone.x, dzy = by - btnZone.y;
      if (dzx * dzx + dzy * dzy < btnZone.r * btnZone.r) {
        bx = bx < btnZone.x ? btnZone.x - btnZone.r - 20 : btnZone.x + btnZone.r + 20;
      }
      return {
        bx: bx, by: by,                   /* 基地位置 */
        A: Math.random() * 12 + 6,        /* 小范围飘动 6~18 */
        f1: 0.25 + Math.random() * 0.25,  /* 水平飘速 */
        f2: 0.25 + Math.random() * 0.25,  /* 垂直飘速 */
        p1: Math.random() * Math.PI * 2,  /* 相位 */
        p2: Math.random() * Math.PI * 2,
        x: bx, y: by,
        R: Math.random() * 5 + 9,         /* 外接半径 9~14 */
        rot: Math.random() * Math.PI * 2, /* 固定角度 */
        tw: Math.random() * Math.PI * 2,  /* 呼吸相位 */
        twSp: Math.random() * 0.5 + 0.35, /* 呼吸速度 */
        bn: 0,                            /* 点击回弹进度 0~1 */
        bnSp: 0.06                        /* 回弹速度/帧 */
      };
    }
    for (var s = 0; s < 5; s++) stars.push(newStar(s));

    /* 流星（周期性划过，约每 2.3 秒起一道） */
    var meteors = [];
    var nextMeteor = performance.now() + 1200;

    var bursts = [];

    function burst(x, y) {
      for (var i = 0; i < 26; i++) {
        var ang = Math.random() * Math.PI * 2;
        var sp = Math.random() * 4.4 + 0.9;
        bursts.push({
          x: x, y: y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp - 0.5,
          r: Math.random() * 2 + 0.8,
          white: Math.random() < 0.4,
          life: 1,
          decay: Math.random() * 0.017 + 0.009
        });
      }
    }

    /* 五角星路径（标准多边形算法） */
    function starPath(c, x, y, outerR, innerR, rot) {
      c.beginPath();
      for (var i = 0; i < 10; i++) {
        var r = (i % 2 === 0) ? outerR : innerR;
        var a = rot + (i * Math.PI) / 5;
        var px = x + Math.sin(a) * r;
        var py = y - Math.cos(a) * r;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath();
    }

    /* 整层淡入：与封面文字一同呼吸显示（不再一加载就贴出来） */
    var appearStart = performance.now();
    var appearDur = 1900;

    var raf = null;
    var stopAt = 0;
    var wasOpen = false;

    function draw() {
      var now = performance.now();
      ctx.clearRect(0, 0, W, H);
      var t = now * 0.001;

      /* 整层淡入：与封面文字一同出现（呼吸式显现，easeOutCubic） */
      var op = Math.min(1, (now - appearStart) / appearDur);
      op = 1 - Math.pow(1 - op, 3);
      ctx.globalAlpha = op;

      /* 金色粒子流（缓慢上飘） */
      flows.forEach(function (f) {
        f.y -= f.vy;
        if (f.y < -6) { f.y = H + 6; f.x = Math.random() * W; }
        var tw = 0.5 + 0.5 * Math.sin(t * 0.8 + f.ph);
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = rg(gold, f.a * tw);
        ctx.fill();
      });

      if (!document.body.classList.contains('opened')) {
        /* 3 颗呼吸星：上方小范围飘动，不越界，整星呼吸 */
        stars.forEach(function (st) {
          st.x = st.bx + Math.sin(t * st.f1 + st.p1) * st.A;
          st.y = st.by + Math.sin(t * st.f2 + st.p2) * st.A * 0.7;
          if (st.x < st.R) st.x = st.R; else if (st.x > W - st.R) st.x = W - st.R;
          if (st.y < bandTop + st.R) st.y = bandTop + st.R; else if (st.y > bandBottom - st.R) st.y = bandBottom - st.R;

          /* 点击回弹：收缩到 0.25 再弹回 1（不消失、不换位） */
          var scale = 1;
          if (st.bn > 0) {
            st.bn += st.bnSp;
            if (st.bn >= 1) st.bn = 0;
            scale = 1 - 0.75 * Math.sin(Math.PI * Math.min(st.bn, 1));
          }
          var outer = st.R * scale;
          if (outer < 0.6) return;

          /* 整星呼吸亮度 */
          var breathe = 0.7 + 0.3 * Math.sin(t * st.twSp + st.tw);   /* 0.4~1，最低亮度提升 */

          /* 柔光晕（随呼吸） */
          var g = ctx.createRadialGradient(st.x, st.y, 0, st.x, st.y, outer * 4);
          g.addColorStop(0, rg(gold, 0.15 * breathe + 0.04));
          g.addColorStop(1, rg(gold, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(st.x, st.y, outer * 4, 0, Math.PI * 2);
          ctx.fill();

          /* 投影（轻，增强悬浮） */
          starPath(ctx, st.x + outer * 0.12, st.y + outer * 0.18, outer, outer * 0.45, st.rot);
          ctx.fillStyle = 'rgba(8,12,22,0.35)';
          ctx.fill();

          /* 边缘柔化 */
          starPath(ctx, st.x, st.y, outer * 1.1, outer * 1.1 * 0.45, st.rot);
          ctx.fillStyle = rg(gold, 0.13 * breathe + 0.03);
          ctx.fill();

          /* 星体：金色渐变（亮度随呼吸） */
          starPath(ctx, st.x, st.y, outer, outer * 0.45, st.rot);
          var lg = ctx.createLinearGradient(st.x - outer, st.y - outer, st.x + outer, st.y + outer);
          lg.addColorStop(0, '#fff6dc');
          lg.addColorStop(0.5, 'rgba(240,208,137,' + (0.85 * breathe + 0.13).toFixed(3) + ')');
          lg.addColorStop(1, 'rgba(198,160,96,' + (0.8 * breathe + 0.12).toFixed(3) + ')');
          ctx.fillStyle = lg;
          ctx.fill();

          /* 高光点（暖白） */
          var hx = st.x - outer * 0.3;
          var hy = st.y - outer * 0.34;
          var hr = outer * 0.2;
          var hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr * 2);
          hg.addColorStop(0, 'rgba(255,248,230,' + (0.85 * breathe + 0.1).toFixed(3) + ')');
          hg.addColorStop(1, 'rgba(255,248,230,0)');
          ctx.fillStyle = hg;
          ctx.beginPath();
          ctx.arc(hx, hy, hr * 2, 0, Math.PI * 2);
          ctx.fill();
        });

        /* 流星：周期划过（约每 2.3 秒起一道） */
        if (now > nextMeteor) {
          var fx = W * 0.1 + Math.random() * W * 0.6;
          var fy = H * 0.05 + Math.random() * H * 0.22;
          var ang = Math.PI * 0.35 + Math.random() * Math.PI * 0.3;
          var sp = 5 + Math.random() * 3;
          meteors.push({ x: fx, y: fy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 1, trail: [] });
          nextMeteor = now + (2300 + Math.random() * 2500);
        }
        meteors.forEach(function (mt) {
          mt.x += mt.vx;
          mt.y += mt.vy;
          mt.trail.push({ x: mt.x, y: mt.y });
          if (mt.trail.length > 14) mt.trail.shift();
          mt.life -= 0.006;
          for (var k = 1; k < mt.trail.length; k++) {
            var ta = mt.life * 0.55 * (k / mt.trail.length);
            if (ta <= 0) continue;
            ctx.beginPath();
            ctx.moveTo(mt.trail[k - 1].x, mt.trail[k - 1].y);
            ctx.lineTo(mt.trail[k].x, mt.trail[k].y);
            ctx.strokeStyle = rg(gold, ta);
            ctx.lineWidth = 1.2;
            ctx.lineCap = 'round';
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.arc(mt.x, mt.y, 1.4, 0, Math.PI * 2);
          ctx.fillStyle = rg(WARM, Math.max(0, mt.life));
          ctx.fill();
        });
        meteors = meteors.filter(function (mt) { return mt.life > 0 && mt.x < W + 40 && mt.y < H + 40; });
      }

      /* 迸发光粒 */
      bursts.forEach(function (p) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.life -= p.decay;
        if (p.life > 0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = rg(p.white ? WARM : gold, p.life * 0.92);
          ctx.fill();
        }
      });
      bursts = bursts.filter(function (p) { return p.life > 0; });

      ctx.globalAlpha = 1;

      /* 进入页面后保留短暂效果，随后停止循环（省电）；返回封面时由 startCoverFX 恢复 */
      var isOpen = document.body.classList.contains('opened');
      if (isOpen) {
        if (!wasOpen) stopAt = now + 1400;   /* 仅"刚进入"时开始计时 */
        if (now > stopAt) { raf = null; return; }
      }
      wasOpen = isOpen;
      raf = requestAnimationFrame(draw);
    }
    /* 恢复封面动画（从选择页/正文返回封面时调用） */
    function startCoverFX() {
      if (raf) return;
      stopAt = 0;
      wasOpen = document.body.classList.contains('opened');
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    coverFX.restart = startCoverFX;

    cover.addEventListener('pointerdown', function (e) {
      if (e.target && e.target.closest && e.target.closest('.cover-inner')) return;
      var rect = canvas.getBoundingClientRect();
      var px = e.clientX - rect.left;
      var py = e.clientY - rect.top;
      for (var i = stars.length - 1; i >= 0; i--) {
        var st = stars[i];
        if (st.bn > 0) continue;
        var hit = st.R * 2.6;               /* 命中范围放大，好点 */
        var dx = st.x - px, dy = st.y - py;
        if (dx * dx + dy * dy < hit * hit) {
          st.bn = 0.0001;                   /* 开始收缩-回弹 */
          burst(st.x, st.y);                /* 迸发光粒 */
          coverStarClicked(i);              /* 彩蛋序列检测 */
          return;
        }
      }
    });

    window.addEventListener('resize', function () {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      updateBtnZone();
      updateBoundary();
    });
  }

  /* ================ 彩蛋：亚克力相框 ================ */
  /* 触发：5 颗星从左到右，依次点击第 2、2、4 颗 */
  var EGG_SEQ = [1, 1, 3];
  var eggPos = 0;

  function coverStarClicked(i) {
    if (i === EGG_SEQ[eggPos]) {
      eggPos++;
      if (eggPos >= EGG_SEQ.length) {
        eggPos = 0;
        showEgg();
      }
    } else {
      eggPos = (i === EGG_SEQ[0]) ? 1 : 0;
    }
  }

  var egg = $('#egg');
  var eggClose = $('#eggClose');

  function showEgg() {
    if (!egg) return;
    egg.classList.add('show');
    document.body.classList.add('egg-open');
    egg.setAttribute('aria-hidden', 'false');
    /* 相册已在页面加载时预构建完成，这里直接激活 → 秒开 */
    if (window.Egg3D) Egg3D.setActive(true);
    if (window.gsap && !reduceMotion) {
      gsap.fromTo('.egg-line', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', delay: 0.25 });
    }
  }

  function hideEgg() {
    if (!egg) return;
    egg.classList.remove('show');
    document.body.classList.remove('egg-open');
    egg.setAttribute('aria-hidden', 'true');
    if (window.Egg3D) Egg3D.setActive(false);
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    if (!CFG && !pickerMode) {
      essayRoot.innerHTML = '<p class="paragraph" style="text-align:center">暂无文章</p>';
      return;
    }
    applyMeta();
    if (pickerMode) {
      document.body.classList.add('picker-mode');
      applyTheme(ESSAYS[0] ? ESSAYS[0].theme : DEFAULT_THEME);   /* 选择页用首篇主题作背景 */
    } else {
      applyTheme(CFG.theme);
    }
    renderEssay();
    initProgress();
    bindCover();
    bindMusic();
    bindBack();
    if (eggClose) eggClose.addEventListener('click', hideEgg);
    if (!pickerMode) Music.preload();   /* 提前预加载，进入即响 */
    /* 预构建彩蛋相册 + 预热彩蛋图片（触发时秒开，无需等待） */
    if (window.Egg3D) {
      try { Egg3D.init('eggCanvasWrap', 'assets/images/egg-photo.jpg'); } catch (e) {}
    }
    var eggPreload = new Image();
    eggPreload.src = 'assets/images/egg-photo.jpg';
    initParticles();
    initCoverFX();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* 测试钩子（仅 ?test=1 时暴露） */
  if (params.get('test') === '1') {
    window.__test = {
      coverStarClicked: coverStarClicked,
      showEgg: showEgg,
      hideEgg: hideEgg,
      EGG_SEQ: EGG_SEQ.slice()
    };
  }
})();
