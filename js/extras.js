/**
 * XuanKen Music — extras pack
 * 12 ban (in music.js) · 13 banner · 29 badges · 32 flash · 33 gift · 43 bulk PIN (admin)
 * 46 dead link (admin) · 51 hotkeys · 62 story · 64 reactions · 69 XP · 70 season
 * 72 gacha · 73 freeze · 74 hidden ach · 84 night · 85 media session
 * 89 offline · 94 broadcast · 96 invite · 98 countdown · 99 QR · 100 year review
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
      const uid = (typeof getCurrentUid === 'function' && getCurrentUid()) || (acc && acc.uid) || '';
      if (!uid) return;
      await db.ref((typeof dataPath === 'function' ? dataPath('users') : 'users') + '/' + uid).update({
        xp: Number(acc.xp) || 0,
        level: Number(acc.level) || 1,
        seasonXp: Number(acc.seasonXp) || 0,
        achievements: acc.achievements || [],
        frame: acc.frame || '',
        streak: Number(acc.streak) || 0,
        streakFreeze: Number(acc.streakFreeze) || 0,
        listenedSongs: acc.listenedSongs || {},
        listenTime: acc.listenTime || { total: 0, byDay: {} },
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
      } else if (e.key === '?') {
        toast('PHÍM TẮT', 'Space play · ←→ bài · F yêu thích', '#a78bfa');
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
    code = String(code || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!code) return toast('GIFT', 'Nhập mã', '#ff9800');
    const user = typeof getCurrentUsername === 'function' && getCurrentUsername();
    if (!user) return toast('GIFT', 'Cần đăng nhập username', '#ff4444');
    try {
      const db = getDb();
      if (!db) return toast('GIFT', 'Không kết nối được', '#ff4444');
      const path = (typeof dataPath === 'function' ? dataPath('giftCodes') : 'giftCodes') + '/' + code;
      const ref = db.ref(path);
      const snap = await ref.once('value');
      const data = snap.val();
      if (!data || !ref) return toast('GIFT', 'Mã không tồn tại', '#ff4444');
      const coins = Number(data.coins) || 0;
      const maxUses = data.maxUses == null ? 1 : Number(data.maxUses); // -1 = vĩnh viễn
      const usedCount = Number(data.usedCount) || 0;
      const usedByMap = (data.usedByMap && typeof data.usedByMap === 'object') ? data.usedByMap : {};
      // 1 user chỉ nhận 1 lần / mã
      if (usedByMap[user]) return toast('GIFT', 'Bạn đã nhận mã này rồi', '#ff9800');
      // maxUses = 1 kiểu cũ: usedBy string
      if (maxUses === 1 && data.usedBy && String(data.usedBy).trim() && !data.usedByMap) {
        return toast('GIFT', 'Mã đã được dùng bởi ' + data.usedBy, '#ff9800');
      }
      if (maxUses >= 0 && usedCount >= maxUses) {
        return toast('GIFT', 'Mã đã hết lượt dùng', '#ff9800');
      }
      const result = await ref.transaction(current => {
        if (!current) return current;
        const max = current.maxUses == null ? 1 : Number(current.maxUses);
        const cnt = Number(current.usedCount) || 0;
        const map = (current.usedByMap && typeof current.usedByMap === 'object') ? current.usedByMap : {};
        if (map[user]) return; // abort — đã nhận
        if (max === 1 && current.usedBy && String(current.usedBy).trim() && !current.usedByMap) return;
        if (max >= 0 && cnt >= max) return;
        if (!current.usedByMap) current.usedByMap = {};
        current.usedByMap[user] = Date.now();
        current.usedCount = cnt + 1;
        current.usedBy = user; // user cuối
        current.usedAt = Date.now();
        return current;
      });
      if (!result.committed) {
        return toast('GIFT', 'Mã hết lượt / đã dùng / Rules chặn ghi', '#ff9800');
      }
      updateCurrentAccount(acc => { acc.coins = (acc.coins | 0) + coins; });
      toast('GIFT', '+' + coins + ' xu XK', '#4ade80');
      if (typeof updateShopBalanceUI === 'function') updateShopBalanceUI();
      if (typeof updateUsernameBadge === 'function') updateUsernameBadge();
    } catch (err) {
      const msg = String(err.code || err.message || err);
      if (/PERMISSION|permission/i.test(msg)) {
        toast('GIFT', 'Rules chặn ghi giftCodes — cập nhật Firebase Rules (cho phép nhận mã)', '#ff4444');
      } else {
        toast('GIFT', 'Lỗi: ' + msg, '#ff4444');
      }
    }
  }


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
      const ukey = sanitizeUsernameKey(code);
      const mapSnap = await db.ref(dataPath('usernames') + '/' + ukey).once('value');
      const map = mapSnap.val();
      const invUid = map && map.uid;
      if (!invUid) return toast('INVITE', 'Username mời không tồn tại', '#ff9800');
      const inv = await db.ref(dataPath('users') + '/' + invUid).once('value');
      if (!inv.exists()) return toast('INVITE', 'Username mời không tồn tại', '#ff9800');
      updateCurrentAccount(a => {
        a.inviteBy = code;
        a.coins = (a.coins | 0) + reward;
      });
      const invCoins = (inv.val().coins | 0) + reward;
      await db.ref(dataPath('users') + '/' + invUid).update({ coins: invCoins });
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



  
  function formatListenDuration(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return h + ' giờ ' + m + ' phút ' + s + ' giây';
    if (m > 0) return m + ' phút ' + s + ' giây';
    return s + ' giây';
  }

  function sumListenTime(period) {
    const acc = getAcc();
    if (!acc || !acc.listenTime) return 0;
    const byDay = (acc.listenTime.byDay && typeof acc.listenTime.byDay === 'object') ? acc.listenTime.byDay : {};
    const now = new Date();
    let sum = 0;
    Object.keys(byDay).forEach(k => {
      const parts = String(k).split('-');
      if (parts.length < 3) return;
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      if (Number.isNaN(d.getTime())) return;
      if (period === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
        if (d >= weekAgo) sum += Number(byDay[k]) || 0;
      } else if (period === 'month') {
        if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
          sum += Number(byDay[k]) || 0;
        }
      } else if (period === 'year') {
        if (d.getFullYear() === now.getFullYear()) {
          sum += Number(byDay[k]) || 0;
        }
      }
    });
    return sum;
  }

  function ensureExtrasUi() {
    const panel = $('extras-modal');
    if (!panel) return;

    function openExtras() {
      panel.classList.add('show');
      if (typeof lucide !== 'undefined') {
        try { lucide.createIcons({ nodes: Array.from(panel.querySelectorAll('[data-lucide]')) }); } catch (err) {}
      }
      updateXpUi();
      startGlobalChat();
    }
    function closeExtras() {
      panel.classList.remove('show');
    }

    const bindExtrasBtn = () => {
      const btn = $('extras-btn');
      if (!btn || btn._xkBound) return;
      btn._xkBound = true;
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (panel.classList.contains('show')) closeExtras();
        else openExtras();
      });
    };
    bindExtrasBtn();
    setInterval(bindExtrasBtn, 1500);

    const closeBtn = $('close-extras-btn');
    if (closeBtn && !closeBtn._xkBound) {
      closeBtn._xkBound = true;
      closeBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        closeExtras();
      });
    }

    const giftBtn = $('gift-redeem-btn');
    if (giftBtn && !giftBtn._xkBound) {
      giftBtn._xkBound = true;
      giftBtn.onclick = () => redeemGiftCode(($('gift-code-input') || {}).value);
    }

    let lastResultKey = null;

    function showResult(html, key) {
      const box = $('extras-result');
      if (!box) return;
      // Click cùng nút lần nữa → ẩn đi
      if (key && lastResultKey === key && box.classList.contains('show')) {
        box.classList.remove('show');
        box.innerHTML = '';
        lastResultKey = null;
        return;
      }
      box.innerHTML = html;
      box.classList.add('show');
      lastResultKey = key || null;
    }

    function topSongsByPeriod(period) {
      const songs = window.songs || [];
      const sorted = [...songs].sort((a, b) => (Number(b.listenCount) || 0) - (Number(a.listenCount) || 0));
      const top = sorted.slice(0, 10);
      const title = period === 'week' ? 'Top tuần' : period === 'month' ? 'Top tháng' : 'Top năm';
      // listenCount là tổng — chưa có breakdown theo tuần/tháng (hiển thị top tổng, gắn nhãn)
      let html = '<b>' + title + '</b> <span style="opacity:.7">(theo lượt nghe hiện tại)</span><br/>';
      if (!top.length) html += 'Chưa có dữ liệu';
      else top.forEach((s, i) => {
        html += (i + 1) + '. ' + escapeHtml(s.name || s.id) + ' — <b>' + (s.listenCount || 0) + '</b><br/>';
      });
      showResult(html, 'top-' + period);
    }

    function userReview(period) {
      const acc = getAcc();
      if (!acc) return toast('REVIEW', 'Cần đăng nhập', '#ff9800');
      const listened = acc.listenedSongs ? Object.keys(acc.listenedSongs).length : 0;
      const owned = (acc.owned || []).length;
      const label = period === 'week' ? 'Tuần này' : period === 'month' ? 'Tháng này' : 'Năm nay';
      // Approximate from available fields
      let html = '<b>Review ' + label + '</b><br/>';
      html += '• Bài đã nghe (unique): <b>' + listened + '</b><br/>';
      html += '• Đã mua: <b>' + owned + '</b><br/>';
      html += '• Level: <b>' + (acc.level || 1) + '</b> · XP: <b>' + (acc.xp || 0) + '</b><br/>';
      html += '• Season XP: <b>' + (acc.seasonXp || 0) + '</b><br/>';
      html += '• Streak điểm danh: <b>' + (acc.streak || 0) + '</b><br/>';
      if (period === 'year') {
        html += '• Rank: <b>' + (acc.rank || 'member') + '</b>';
      }
      showResult(html, 'rev-' + period);
    }

    panel.querySelectorAll('[data-x]').forEach(btn => {
      if (btn._xkBound) return;
      btn._xkBound = true;
      btn.onclick = () => {
        const x = btn.getAttribute('data-x');
        if (x === 'top-week') topSongsByPeriod('week');
        if (x === 'top-month') topSongsByPeriod('month');
        if (x === 'top-year') topSongsByPeriod('year');
        if (x === 'rev-week') userReview('week');
        if (x === 'rev-month') userReview('month');
        if (x === 'rev-year') userReview('year');
        if (x === 'time-week' || x === 'time-month' || x === 'time-year') {
          const period = x.replace('time-', '');
          const label = period === 'week' ? '7 ngày gần nhất' : period === 'month' ? 'tháng này' : 'năm nay';
          const sec = sumListenTime(period);
          const total = (getAcc() && getAcc().listenTime && getAcc().listenTime.total) || 0;
          showResult(
            '<b>Thời gian nghe (' + label + ')</b><br/>' +
            '• Giai đoạn: <b>' + formatListenDuration(sec) + '</b><br/>' +
            '• Tổng mọi thời điểm: <b>' + formatListenDuration(total) + '</b>',
            x
          );
        }

      };
    });

    const sendBtn = $('global-chat-send');
    const input = $('global-chat-input');
    if (sendBtn && !sendBtn._xkBound) {
      sendBtn._xkBound = true;
      sendBtn.onclick = () => sendGlobalChat();
    }
    if (input && !input._xkBound) {
      input._xkBound = true;
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); sendGlobalChat(); }
      });
    }
  }

  let _chatStarted = false;
  function startGlobalChat() {
    if (_chatStarted) return;
    const box = $('global-chat-box');
    if (!box) return;
    try {
      const db = getDb();
      if (!db) { box.textContent = 'Không kết nối chat'; return; }
      _chatStarted = true;
      const path = (typeof dataPath === 'function' ? dataPath('chat') : 'chat');
      db.ref(path).limitToLast(40).on('value', snap => {
        const val = snap.val() || {};
        const items = Object.keys(val).map(k => ({ k, ...val[k] })).sort((a, b) => (a.at || a.t || 0) - (b.at || b.t || 0));
        box.innerHTML = items.map(m => {
          const rank = (m.rank || 'member').toLowerCase();
          const badge = '<span class="chat-badge ' + escapeHtml(rank) + '">' + escapeHtml(rank) + '</span>';
          let text = escapeHtml(m.text || '');
          text = text.replace(/@([\w\u00C0-\u024F\u1E00-\u1EFF.-]+)/gi, '<span class="chat-mention">@$1</span>');
          const ts = Number(m.at || m.t) || 0;
          let timeStr = '';
          if (ts) {
            const d = new Date(ts);
            const pad = n => String(n).padStart(2, '0');
            timeStr = pad(d.getDate()) + '/' + pad(d.getMonth()+1) + '/' + d.getFullYear()
              + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
          }
          return '<div class="chat-msg">'
            + '<div class="chat-msg-main">'
            + badge
            + '<span class="chat-user">' + escapeHtml(m.u || '?') + ':</span> '
            + '<span class="chat-text">' + text + '</span>'
            + (timeStr ? '<button type="button" class="chat-time-toggle" title="Thời gian">▼</button>' : '')
            + '</div>'
            + (timeStr ? '<div class="chat-msg-time" hidden>' + escapeHtml(timeStr) + '</div>' : '')
            + '</div>';
        }).join('') || '<div style="opacity:.6">Chưa có tin nhắn</div>';
        box.querySelectorAll('.chat-time-toggle').forEach(btn => {
          btn.onclick = (ev) => {
            ev.preventDefault();
            const wrap = btn.closest('.chat-msg');
            const timeEl = wrap && wrap.querySelector('.chat-msg-time');
            if (!timeEl) return;
            const open = timeEl.hasAttribute('hidden');
            if (open) timeEl.removeAttribute('hidden');
            else timeEl.setAttribute('hidden', '');
            btn.classList.toggle('open', open);
            btn.textContent = open ? '▲' : '▼';
          };
        });
        box.scrollTop = box.scrollHeight;
      });
    } catch (err) {
      box.textContent = 'Lỗi chat';
    }
  }

  async function isChatMuted(username) {
    try {
      const db = getDb();
      if (!db) return false;
      const snap = await db.ref('settings/chatMutes/' + (typeof sanitizeUsernameKey === 'function' ? sanitizeUsernameKey(username) : username)).once('value');
      const v = snap.val();
      if (!v) return false;
      if (v === 'forever' || v.forever) return true;
      const until = Number(v.until || v) || 0;
      return until > Date.now();
    } catch (e) { return false; }
  }

  async function sendGlobalChat() {
    const input = $('global-chat-input');
    let text = (input && input.value || '').trim();
    if (!text) return;
    const user = typeof getCurrentUsername === 'function' && getCurrentUsername();
    if (!user) return toast('CHAT', 'Cần đăng nhập', '#ff4444');
    const acc = getAcc() || {};
    const rank = (acc.rank || 'member').toLowerCase();
    const isAdmin = rank === 'admin' || rank === 'owner' || rank === 'mod';

    // Admin mute commands
    if (isAdmin && text.startsWith('/')) {
      const parts = text.split(/\\s+/);
      const cmd = (parts[0] || '').toLowerCase();
      const target = parts[1] || '';
      if ((cmd === '/mute' || cmd === '/unmute') && target) {
        try {
          const db = getDb();
          const key = typeof sanitizeUsernameKey === 'function' ? sanitizeUsernameKey(target) : target;
          if (cmd === '/unmute') {
            await db.ref('settings/chatMutes/' + key).remove();
            toast('CHAT', 'Đã gỡ cấm ' + target, '#4ade80');
          } else {
            const dur = (parts[2] || '1h').toLowerCase();
            let payload;
            if (dur === 'forever' || dur === 'vĩnh' || dur === 'vinhvien') {
              payload = { until: 9999999999999, forever: true, by: user, at: Date.now() };
            } else {
              const hours = parseFloat(dur) || (dur.endsWith('h') ? parseFloat(dur) : 1);
              const h = Number.isFinite(hours) && hours > 0 ? hours : 1;
              payload = { until: Date.now() + h * 3600000, by: user, at: Date.now() };
            }
            await db.ref('settings/chatMutes/' + key).set(payload);
            toast('CHAT', 'Đã cấm chat ' + target, '#ff9800');
          }
          if (input) input.value = '';
          return;
        } catch (err) {
          toast('CHAT', 'Lỗi mute: ' + (err.message || err), '#ff4444');
          return;
        }
      }
    }

    if (await isChatMuted(user)) {
      toast('CHAT', 'Bạn đang bị cấm chat', '#ff4444');
      return;
    }

    try {
      const db = getDb();
      if (!db) return;
      const path = (typeof dataPath === 'function' ? dataPath('chat') : 'chat');
      const now = Date.now();
      await db.ref(path).push({
        u: String(user || '').slice(0, 39),
        text: text.slice(0, 300),
        at: now,
        t: now,
        rank: String(rank || 'member').slice(0, 31)
      });
      if (input) input.value = '';
    } catch (err) {
      toast('CHAT', 'Không gửi được: ' + (err.message || err), '#ff4444');
    }
  }


  function boot() {
    ensureExtrasUi();
    applyBanner();
    flashBadge();
    listenBroadcast();
    initHotkeys();
    listenReactions();
    autoNightMode();
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
      updateXpUi();
      applyFrame();
    }, 5000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 600));
  else setTimeout(boot, 600);

  window.xkExtras = {
    redeemGiftCode, sendReaction, buyFrame, buyStreakFreeze,
    openYearReview, openQrCheckin, applyInvite, unlockAchievement, checkAchievements
  };
})();
