/**
 * XuanKen Music — extras pack
 * 12 ban (in music.js) · 13 banner · 29 badges · 32 flash · 33 gift · 43 bulk PIN (admin)
 * 46 dead link (admin) · 51 hotkeys · 62 story · 64 reactions · 69 XP · 70 season
 * 72 gacha · 73 freeze · 74 hidden ach · 83 multi-profile · 84 night · 85 media session
 * 86 share card · 89 offline · 94 broadcast · 96 invite · 98 countdown · 99 QR · 100 year review
 */
(function () {
  'use strict';

  const ACHIEVEMENTS = {
    first_listen: { name: 'Lần nghe đầu', desc: 'Nghe 1 bài qua 5 giây', xp: 0 },
    listens_10: { name: 'Tai nghe bền', desc: 'Đã tính 10 lượt nghe (bài khác nhau)', hidden: false },
    listens_50: { name: 'Nghiện nhạc', desc: '50 bài đã nghe', hidden: false },
    checkin_7: { name: 'Tuần đầy đủ', desc: 'Streak 7 ngày', hidden: false },
    night_owl: { name: 'Cú đêm', desc: 'Nghe trong 0h–4h', hidden: true },
    collector: { name: 'Nhà sưu tập', desc: 'Sở hữu 5 bài', hidden: false },
    level_5: { name: 'Level 5', desc: 'Đạt level 5', hidden: false },
    level_10: { name: 'Level 10', desc: 'Đạt level 10', hidden: false },
    inviter: { name: 'Người dẫn đường', desc: 'Mời 1 bạn thành công', hidden: false },
    secret_333: { name: '3:33', desc: 'Nghe đúng lúc 3:33', hidden: true }
  };

  const FRAMES = [
    { id: '', name: 'Mặc định', cost: 0 },
    { id: 'gold', name: 'Vàng', cost: 50 },
    { id: 'neon', name: 'Neon', cost: 80 },
    { id: 'crystal', name: 'Crystal', cost: 120 },
    { id: 'legend', name: 'Huyền thoại', cost: 200 }
  ];

  function $(id) { return document.getElementById(id); }
  function toast(title, msg, color) {
    if (typeof showNotification === 'function') showNotification(title, msg, color || '#8c00ff', 'sparkles');
  }

  function getAcc() {
    return typeof getCurrentAccount === 'function' ? getCurrentAccount() : null;
  }

  function seasonId() {
    const d = new Date();
    return d.getFullYear() + '-S' + (Math.floor(d.getMonth() / 3) + 1);
  }

  // ----- 13 Banner + 94 Broadcast -----
  function applyBanner() {
    const s = typeof getAdminSettings === 'function' ? getAdminSettings() : {};
    let el = $('site-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'site-banner';
      el.className = 'site-banner';
      document.body.appendChild(el);
    }
    const text = (s.siteBanner || '').trim();
    if (!text) {
      el.style.display = 'none';
      el.textContent = '';
      return;
    }
    el.style.display = 'block';
    el.innerHTML = '<span>' + escapeHtml(text) + '</span><button type="button" class="site-banner-x" aria-label="Đóng">&times;</button>';
    el.querySelector('.site-banner-x').onclick = () => { el.style.display = 'none'; };
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function listenBroadcast() {
    try {
      const db = typeof getDb === 'function' ? getDb() : null;
      if (!db || typeof dataPath !== 'function') return;
      db.ref('settings/broadcast').on('value', snap => {
        const v = snap.val();
        if (!v || !v.msg || !v.at) return;
        const last = sessionStorage.getItem('xk_bc_at');
        if (String(v.at) === last) return;
        sessionStorage.setItem('xk_bc_at', String(v.at));
        toast('THÔNG BÁO', escapeHtml(v.msg), '#60a5fa');
      });
    } catch (e) {}
  }

  // ----- 32 Flash sale badge -----
  function flashBadge() {
    const s = typeof getAdminSettings === 'function' ? getAdminSettings() : {};
    const pct = Number(s.flashSalePercent) || 0;
    const until = s.flashSaleUntil ? Date.parse(s.flashSaleUntil) : 0;
    let el = $('flash-sale-badge');
    if (pct > 0 && until && Date.now() < until) {
      if (!el) {
        el = document.createElement('div');
        el.id = 'flash-sale-badge';
        el.className = 'flash-sale-badge';
        document.body.appendChild(el);
      }
      el.style.display = 'block';
      el.textContent = 'FLASH -' + pct + '%';
    } else if (el) el.style.display = 'none';
  }

  // ----- 29 / 69 / 70 / 74 Achievements + XP -----
  function unlockAchievement(id) {
    const def = ACHIEVEMENTS[id];
    if (!def || typeof updateCurrentAccount !== 'function') return;
    let got = false;
    updateCurrentAccount(acc => {
      if (!Array.isArray(acc.achievements)) acc.achievements = [];
      if (acc.achievements.includes(id)) return;
      acc.achievements.push(id);
      got = true;
    });
    if (got) toast('HUY HIỆU', def.name + (def.hidden ? ' ✨' : ''), '#fbbf24');
    syncUserPartial();
  }

  function checkAchievements() {
    const acc = getAcc();
    if (!acc) return;
    const listened = acc.listenedSongs ? Object.keys(acc.listenedSongs).length : 0;
    if (listened >= 1) unlockAchievement('first_listen');
    if (listened >= 10) unlockAchievement('listens_10');
    if (listened >= 50) unlockAchievement('listens_50');
    if ((acc.streak || 0) >= 7) unlockAchievement('checkin_7');
    if ((acc.owned || []).length >= 5) unlockAchievement('collector');
    if ((acc.level || 1) >= 5) unlockAchievement('level_5');
    if ((acc.level || 1) >= 10) unlockAchievement('level_10');
    const h = new Date().getHours();
    if (h >= 0 && h < 4) unlockAchievement('night_owl');
    if (new Date().getHours() === 3 && new Date().getMinutes() === 33) unlockAchievement('secret_333');
  }

  async function syncUserPartial() {
    try {
      const name = typeof getCurrentUsername === 'function' && getCurrentUsername();
      if (!name || typeof getDb !== 'function') return;
      const db = getDb();
      if (!db) return;
      const acc = getAcc();
      if (!acc) return;
      const key = typeof sanitizeUsernameKey === 'function' ? sanitizeUsernameKey(name) : name;
      await db.ref((typeof dataPath === 'function' ? dataPath('users') : 'users') + '/' + key).update({
        xp: Number(acc.xp) || 0,
        level: Number(acc.level) || 1,
        seasonXp: Number(acc.seasonXp) || 0,
        achievements: acc.achievements || [],
        frame: acc.frame || '',
        streak: Number(acc.streak) || 0,
        streakFreeze: Number(acc.streakFreeze) || 0,
        listenedSongs: acc.listenedSongs || {}
      });
    } catch (e) {}
  }

  window.onListenCounted = function () {
    checkAchievements();
    updateXpUi();
  };

  function updateXpUi() {
    const acc = getAcc();
    const el = $('user-xp-badge');
    if (!el || !acc) return;
    el.textContent = 'Lv.' + (acc.level || 1) + ' · ' + (acc.xp || 0) + ' XP · S' + (acc.seasonXp || 0);
    el.style.display = 'block';
  }

  // ----- 51 Keyboard shortcuts -----
  function initHotkeys() {
    document.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.target.isContentEditable) return;
      const audio = window.audio || document.querySelector('audio');
      if (!audio) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (audio.paused) audio.play().catch(() => {});
        else audio.pause();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (typeof handleNextAction === "function") handleNextAction();
        else if (typeof changeSong === 'function') { /* skip */ }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (typeof prevSong === 'function') prevSong();
      } else if (e.key === 'f' || e.key === 'F') {
        const id = window.songs && window.songs[window.index] && window.songs[window.index].id;
        if (id && typeof toggleFavorite === 'function') toggleFavorite(String(id));
      } else if (e.key === 's' || e.key === 'S') {
        openShareCard();
      } else if (e.key === '?') {
        toast('PHÍM TẮT', 'Space play · ←→ bài · F yêu thích · S share · R reaction', '#a78bfa');
      } else if (e.key === 'r' || e.key === 'R') {
        sendReaction('🔥');
      }
    });
  }

  // ----- 85 Media Session -----
  function updateMediaSession() {
    if (!('mediaSession' in navigator)) return;
    try {
      const songs = window.songs;
      const index = window.index;
      if (!songs || !songs[index]) return;
      const s = songs[index];
      navigator.mediaSession.metadata = new MediaMetadata({
        title: s.name || s.id,
        artist: s.artist || 'XuanKen',
        artwork: s.albumArt ? [{ src: s.albumArt, sizes: '512x512', type: 'image/png' }] : []
      });
      navigator.mediaSession.setActionHandler('play', () => { const a = document.querySelector('audio'); if (a) a.play(); });
      navigator.mediaSession.setActionHandler('pause', () => { const a = document.querySelector('audio'); if (a) a.pause(); });
      navigator.mediaSession.setActionHandler('previoustrack', () => { if (typeof prevSong === 'function') prevSong(); });
      navigator.mediaSession.setActionHandler('nexttrack', () => { if (typeof handleNextAction === "function") handleNextAction(); });
    } catch (e) {}
  }

  // ----- 86 Share card -----
  function openShareCard() {
    const songs = window.songs;
    const index = window.index;
    if (!songs || !songs[index]) {
      toast('SHARE', 'Chưa có bài đang phát', '#ff9800');
      return;
    }
    const s = songs[index];
    const lyricEl = document.getElementById('lyric-text');
    const lyric = lyricEl ? lyricEl.innerText.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');
    const grd = ctx.createLinearGradient(0, 0, 720, 900);
    grd.addColorStop(0, '#1a1025');
    grd.addColorStop(1, '#8c00ff');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 720, 900);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('XUANKEN MUSIC', 40, 60);
    ctx.font = 'bold 36px sans-serif';
    wrapText(ctx, s.name || s.id, 40, 200, 640, 44);
    ctx.font = '22px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(s.artist || 'XuanKen Official', 40, 280);
    if (lyric) {
      ctx.font = 'italic 20px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      wrapText(ctx, '“' + lyric + '”', 40, 360, 640, 30);
    }
    ctx.font = '16px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(location.origin + '/?song=' + encodeURIComponent(s.id), 40, 860);
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'xuanken-' + (s.id || 'share') + '.png';
      a.click();
      URL.revokeObjectURL(url);
      toast('SHARE CARD', 'Đã tải ảnh chia sẻ', '#4ade80');
    });
  }
  function wrapText(ctx, text, x, y, maxW, lineH) {
    const words = String(text).split(' ');
    let line = '';
    let yy = y;
    for (let n = 0; n < words.length; n++) {
      const test = line + words[n] + ' ';
      if (ctx.measureText(test).width > maxW && n > 0) {
        ctx.fillText(line, x, yy);
        line = words[n] + ' ';
        yy += lineH;
      } else line = test;
    }
    ctx.fillText(line, x, yy);
  }

  // ----- 64 Reactions -----
  function sendReaction(emoji) {
    try {
      const db = typeof getDb === 'function' ? getDb() : null;
      if (!db) return;
      const songs = window.songs;
      const index = window.index;
      const sid = songs && songs[index] ? songs[index].id : 'global';
      const ref = db.ref((typeof dataPath === 'function' ? dataPath('reactions') : 'reactions') + '/' + sid).push();
      ref.set({ e: emoji || '❤️', t: Date.now(), u: (typeof getCurrentUsername === 'function' && getCurrentUsername()) || '?' });
      setTimeout(() => ref.remove(), 8000);
      floatEmoji(emoji || '❤️');
    } catch (e) {}
  }
  function floatEmoji(emoji) {
    const span = document.createElement('div');
    span.className = 'react-float';
    span.textContent = emoji;
    span.style.left = (20 + Math.random() * 60) + 'vw';
    document.body.appendChild(span);
    setTimeout(() => span.remove(), 2000);
  }
  function listenReactions() {
    try {
      const db = typeof getDb === 'function' ? getDb() : null;
      if (!db) return;
      const path = (typeof dataPath === 'function' ? dataPath('reactions') : 'reactions');
      db.ref(path).on('child_changed', () => {});
      db.ref(path).on('child_added', snap => {
        snap.forEach && snap.forEach(() => {});
      });
      // lighter: listen to song reactions
      setInterval(() => {
        const songs = window.songs;
        const index = window.index;
        if (!songs || !songs[index]) return;
        const sid = songs[index].id;
        db.ref(path + '/' + sid).limitToLast(3).once('value').then(s => {
          const v = s.val();
          if (!v) return;
          Object.keys(v).forEach(k => {
            const item = v[k];
            if (item && item.t && Date.now() - item.t < 3000 && !item._shown) {
              item._shown = true;
              floatEmoji(item.e || '❤️');
            }
          });
        }).catch(() => {});
      }, 2500);
    } catch (e) {}
  }

  // ----- 33 Gift code -----
  async function redeemGiftCode(code) {
    code = String(code || '').trim().toUpperCase();
    if (!code) return toast('GIFT', 'Nhập mã', '#ff9800');
    const user = typeof getCurrentUsername === 'function' && getCurrentUsername();
    if (!user) return toast('GIFT', 'Cần đăng nhập', '#ff4444');
    try {
      const db = getDb();
      if (!db) return toast('GIFT', 'Không kết nối được', '#ff4444');
      const ref = db.ref((typeof dataPath === 'function' ? dataPath('giftCodes') : 'giftCodes') + '/' + code);
      const snap = await ref.once('value');
      const data = snap.val();
      if (!data) return toast('GIFT', 'Mã không tồn tại', '#ff4444');
      if (data.usedBy) return toast('GIFT', 'Mã đã được dùng', '#ff9800');
      const coins = Number(data.coins) || 0;
      await ref.update({ usedBy: user, usedAt: Date.now() });
      updateCurrentAccount(acc => { acc.coins = (acc.coins | 0) + coins; });
      toast('GIFT', '+' + coins + ' xu XK', '#4ade80');
      if (typeof updateShopBalanceUI === 'function') updateShopBalanceUI();
    } catch (e) {
      toast('GIFT', 'Lỗi: ' + (e.message || e), '#ff4444');
    }
  }

  // ----- 96 Invite -----
  async function applyInvite(code) {
    code = String(code || '').trim();
    const user = typeof getCurrentUsername === 'function' && getCurrentUsername();
    if (!user || !code || code === user) return;
    const acc = getAcc();
    if (acc && acc.inviteBy) return;
    const reward = (typeof getAdminSettings === 'function' && getAdminSettings().inviteReward) || 20;
    try {
      const db = getDb();
      if (!db) return;
      const key = sanitizeUsernameKey(code);
      const inv = await db.ref(dataPath('users') + '/' + key).once('value');
      if (!inv.exists()) return toast('INVITE', 'Username mời không tồn tại', '#ff9800');
      updateCurrentAccount(a => {
        a.inviteBy = code;
        a.coins = (a.coins | 0) + reward;
      });
      const invCoins = (inv.val().coins | 0) + reward;
      await db.ref(dataPath('users') + '/' + key).update({ coins: invCoins });
      unlockAchievement('inviter');
      toast('INVITE', 'Cả hai +' + reward + ' xu', '#4ade80');
    } catch (e) {}
  }

  // ----- 72 Gacha frame -----
  function buyFrame(frameId) {
    const f = FRAMES.find(x => x.id === frameId);
    if (!f) return;
    const acc = getAcc();
    if (!acc) return toast('GACHA', 'Cần đăng nhập', '#ff4444');
    if ((acc.coins | 0) < f.cost) return toast('GACHA', 'Thiếu xu', '#ff9800');
    updateCurrentAccount(a => {
      a.coins = (a.coins | 0) - f.cost;
      a.frame = f.id;
    });
    applyFrame();
    toast('FRAME', 'Đã trang bị: ' + f.name, '#fbbf24');
    syncUserPartial();
    if (typeof updateShopBalanceUI === 'function') updateShopBalanceUI();
  }
  function applyFrame() {
    const acc = getAcc();
    const art = document.getElementById('current-art');
    if (!art) return;
    art.classList.remove('frame-gold', 'frame-neon', 'frame-crystal', 'frame-legend');
    if (acc && acc.frame) art.classList.add('frame-' + acc.frame);
  }

  // ----- 73 Buy streak freeze -----
  function buyStreakFreeze() {
    const cost = 30;
    const acc = getAcc();
    if (!acc) return;
    if ((acc.coins | 0) < cost) return toast('FREEZE', 'Cần 30 xu', '#ff9800');
    updateCurrentAccount(a => {
      a.coins = (a.coins | 0) - cost;
      a.streakFreeze = (Number(a.streakFreeze) || 0) + 1;
    });
    toast('STREAK FREEZE', 'Đang có ' + (getAcc().streakFreeze || 0), '#60a5fa');
    syncUserPartial();
  }

  // ----- 83 Multi-profile (device list of usernames) -----
  const STORAGE_PROFILES = 'xuanken_device_profiles';
  function saveProfileToDevice(name) {
    try {
      let list = JSON.parse(localStorage.getItem(STORAGE_PROFILES) || '[]');
      if (!Array.isArray(list)) list = [];
      if (name && !list.includes(name)) list.unshift(name);
      list = list.slice(0, 5);
      localStorage.setItem(STORAGE_PROFILES, JSON.stringify(list));
    } catch (e) {}
  }
  function renderProfileSwitcher() {
    let el = $('profile-switcher');
    if (!el) {
      el = document.createElement('div');
      el.id = 'profile-switcher';
      el.className = 'profile-switcher';
      document.body.appendChild(el);
    }
    let list = [];
    try { list = JSON.parse(localStorage.getItem(STORAGE_PROFILES) || '[]'); } catch (e) {}
    if (!list.length) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    el.innerHTML = list.map(n => '<button type="button" data-prof="' + escapeHtml(n) + '">' + escapeHtml(n) + '</button>').join('');
    el.querySelectorAll('[data-prof]').forEach(btn => {
      btn.onclick = () => {
        const n = btn.getAttribute('data-prof');
        const input = document.getElementById('username-input');
        if (input) {
          input.value = n;
          input.dispatchEvent(new Event('input'));
        }
        toast('PROFILE', 'Chọn: ' + n + ' — nhập PIN nếu cần', '#a78bfa');
      };
    });
  }

  // ----- 84 Night mode -----
  function autoNightMode() {
    const h = new Date().getHours();
    if (h >= 23 || h < 6) {
      document.body.classList.add('night-soft');
    } else {
      document.body.classList.remove('night-soft');
    }
  }

  // ----- 89 Offline vault (cache current full URL if owned) -----
  async function cacheCurrentForOffline() {
    if (!('caches' in window)) return toast('OFFLINE', 'Trình duyệt không hỗ trợ', '#ff9800');
    const songs = window.songs;
    const index = window.index;
    if (!songs || !songs[index]) return;
    const s = songs[index];
    if (typeof isSongOwned === 'function' && !isSongOwned(s.id)) {
      return toast('OFFLINE', 'Chỉ cache bài đã mua', '#ff9800');
    }
    const url = s.audioFull || s.audio;
    if (!url) return;
    try {
      const cache = await caches.open('xuanken-vault-v1');
      await cache.add(url);
      toast('OFFLINE', 'Đã lưu vào vault: ' + s.id, '#4ade80');
    } catch (e) {
      toast('OFFLINE', 'Không cache được (CORS?)', '#ff9800');
    }
  }

  // ----- 98 Countdown for scheduled songs -----
  function showPublishCountdown() {
    const songs = window.songs;
    if (!songs) return;
    const soon = songs.filter(s => s.publishAt && Date.parse(s.publishAt) > Date.now())
      .sort((a, b) => Date.parse(a.publishAt) - Date.parse(b.publishAt))[0];
    let el = $('drop-countdown');
    if (!soon) {
      if (el) el.style.display = 'none';
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'drop-countdown';
      el.className = 'drop-countdown';
      document.body.appendChild(el);
    }
    const t = Date.parse(soon.publishAt) - Date.now();
    const h = Math.floor(t / 3600000);
    const m = Math.floor((t % 3600000) / 60000);
    const sec = Math.floor((t % 60000) / 1000);
    el.style.display = 'block';
    el.textContent = 'Sắp ra mắt: ' + (soon.name || soon.id) + ' · ' + h + 'h ' + m + 'm ' + sec + 's';
  }

  // ----- 99 QR check-in (link) -----
  function openQrCheckin() {
    const url = location.origin + location.pathname + '?checkin=1';
    const qr = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(url);
    toast('QR CHECK-IN', 'Mở ảnh QR / quét link điểm danh', '#60a5fa');
    window.open(qr, '_blank');
  }

  // ----- 100 Year in review -----
  function openYearReview() {
    const acc = getAcc();
    if (!acc) return toast('REVIEW', 'Cần đăng nhập', '#ff9800');
    const listened = acc.listenedSongs ? Object.keys(acc.listenedSongs).length : 0;
    const owned = (acc.owned || []).length;
    const msg = 'Năm nay bạn: ' + listened + ' bài đã nghe · sở hữu ' + owned +
      ' · Lv.' + (acc.level || 1) + ' · streak ' + (acc.streak || 0) +
      ' · XP ' + (acc.xp || 0) + ' · season ' + (acc.seasonXp || 0);
    toast('YEAR IN REVIEW', msg, '#f472b6');
  }

  // ----- 62 Story overlay -----
  function openStoryIfAny() {
    const songs = window.songs;
    const index = window.index;
    if (!songs || !songs[index] || !songs[index].story) return;
    const story = songs[index].story;
    const urls = Array.isArray(story) ? story : String(story).split(',').map(s => s.trim()).filter(Boolean);
    if (!urls.length) return;
    let i = 0;
    const ov = document.createElement('div');
    ov.className = 'story-overlay';
    ov.innerHTML = '<img alt="story" /><button type="button" class="story-close">&times;</button>';
    document.body.appendChild(ov);
    const img = ov.querySelector('img');
    img.src = urls[0];
    const next = () => {
      i++;
      if (i >= urls.length) { ov.remove(); return; }
      img.src = urls[i];
    };
    ov.addEventListener('click', (e) => {
      if (e.target.classList.contains('story-close')) ov.remove();
      else next();
    });
  }

  // ----- ?song= deep link -----
  function handleDeepLink() {
    const params = new URLSearchParams(location.search);
    if (params.get('checkin') === '1') {
      setTimeout(() => {
        if (typeof doDailyCheckin === 'function') doDailyCheckin();
      }, 1500);
    }
    const song = params.get('song');
    if (song && window.songs && window.songs.length) {
      const i = window.songs.findIndex(s => String(s.id) === String(song));
      if (i >= 0 && typeof changeSong === 'function') {
        setTimeout(() => { try { changeSong(i); } catch (e) {} }, 800);
      }
    }
    const inv = params.get('invite') || params.get('ref');
    if (inv) {
      setTimeout(() => applyInvite(inv), 2000);
    }
  }

  // ----- Extras panel UI -----
  function ensureExtrasUi() {
    if ($('extras-fab')) return;
    const fab = document.createElement('button');
    fab.id = 'extras-fab';
    fab.type = 'button';
    fab.className = 'extras-fab';
    fab.title = 'Tiện ích';
    fab.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
    document.body.appendChild(fab);

    const panel = document.createElement('div');
    panel.id = 'extras-panel';
    panel.className = 'extras-panel';
    panel.innerHTML = `
      <div class="extras-panel-h">Tiện ích <button type="button" id="extras-close">&times;</button></div>
      <div id="user-xp-badge" class="user-xp-badge"></div>
      <div class="extras-row">
        <input id="gift-code-input" placeholder="Mã gift code" maxlength="24" />
        <button type="button" id="gift-redeem-btn">Nhận</button>
      </div>
      <div class="extras-actions">
        <button type="button" data-x="share">Share card</button>
        <button type="button" data-x="react">Reaction 🔥</button>
        <button type="button" data-x="story">Story</button>
        <button type="button" data-x="offline">Offline</button>
        <button type="button" data-x="freeze">+Freeze (30xu)</button>
        <button type="button" data-x="review">Year review</button>
        <button type="button" data-x="qr">QR check-in</button>
        <button type="button" data-x="gacha">Gacha frame</button>
      </div>
      <div id="gacha-list" class="gacha-list" style="display:none"></div>
    `;
    document.body.appendChild(panel);
    fab.onclick = () => panel.classList.toggle('show');
    panel.querySelector('#extras-close').onclick = () => panel.classList.remove('show');
    panel.querySelector('#gift-redeem-btn').onclick = () => redeemGiftCode($('gift-code-input').value);
    panel.querySelectorAll('[data-x]').forEach(btn => {
      btn.onclick = () => {
        const x = btn.getAttribute('data-x');
        if (x === 'share') openShareCard();
        if (x === 'react') sendReaction('🔥');
        if (x === 'story') openStoryIfAny();
        if (x === 'offline') cacheCurrentForOffline();
        if (x === 'freeze') buyStreakFreeze();
        if (x === 'review') openYearReview();
        if (x === 'qr') openQrCheckin();
        if (x === 'gacha') {
          const box = $('gacha-list');
          box.style.display = box.style.display === 'none' ? 'block' : 'none';
          box.innerHTML = FRAMES.map(f =>
            `<button type="button" data-frame="${f.id}">${f.name} (${f.cost}xu)</button>`
          ).join('');
          box.querySelectorAll('[data-frame]').forEach(b => {
            b.onclick = () => buyFrame(b.getAttribute('data-frame'));
          });
        }
      };
    });
  }

  function boot() {
    ensureExtrasUi();
    applyBanner();
    flashBadge();
    listenBroadcast();
    initHotkeys();
    listenReactions();
    autoNightMode();
    renderProfileSwitcher();
    const name = typeof getCurrentUsername === 'function' && getCurrentUsername();
    if (name) saveProfileToDevice(name);
    updateXpUi();
    applyFrame();
    checkAchievements();
    handleDeepLink();
    setInterval(showPublishCountdown, 1000);
    setInterval(autoNightMode, 60000);
    setInterval(flashBadge, 30000);
    // Media session on song change
    const audio = document.querySelector('audio');
    if (audio) {
      audio.addEventListener('play', updateMediaSession);
      audio.addEventListener('loadedmetadata', updateMediaSession);
    }
    // Hook profile on successful login
    const _orig = window.loginWithUsername;
    // save profile when username set
    setInterval(() => {
      const n = typeof getCurrentUsername === 'function' && getCurrentUsername();
      if (n) saveProfileToDevice(n);
      updateXpUi();
      applyFrame();
    }, 5000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 600));
  else setTimeout(boot, 600);

  window.xkExtras = {
    redeemGiftCode, openShareCard, sendReaction, buyFrame, buyStreakFreeze,
    openYearReview, openQrCheckin, applyInvite, unlockAchievement, checkAchievements
  };
})();
