/**
 * XuanKen Music — extras pack (gọn)
 * Banner · Broadcast · Flash · Gift · Badges/XP · Chat · Checkin
 * Leaderboards · Countdown · Top tuần · Liên kết · Hotkeys · Media session
 */
(function () {
  'use strict';

  const ACHIEVEMENTS = {
    first_listen: { name: 'Lần nghe đầu', desc: 'Nghe 1 bài qua 5 giây', icon: 'fa-solid fa-headphones' },
    listens_5: { name: 'Khởi động ấm', desc: '5 bài đã nghe', icon: 'fa-solid fa-play' },
    listens_10: { name: 'Tai nghe bền', desc: '10 bài đã nghe', icon: 'fa-solid fa-radio' },
    listens_25: { name: 'Fan cứng', desc: '25 bài đã nghe', icon: 'fa-solid fa-compact-disc' },
    listens_50: { name: 'Nghiện nhạc', desc: '50 bài đã nghe', icon: 'fa-solid fa-fire' },
    listens_100: { name: 'Huyền thoại nghe', desc: '100 bài đã nghe', icon: 'fa-solid fa-crown' },
    listens_200: { name: 'Không ngủ', desc: '200 bài đã nghe', icon: 'fa-solid fa-moon' },
    checkin_1: { name: 'Có mặt', desc: 'Điểm danh lần đầu', icon: 'fa-solid fa-calendar-check' },
    checkin_3: { name: 'Bắt đầu đều', desc: 'Streak 3 ngày', icon: 'fa-solid fa-calendar-day' },
    checkin_7: { name: 'Tuần đầy đủ', desc: 'Streak 7 ngày', icon: 'fa-solid fa-calendar-week' },
    checkin_14: { name: 'Hai tuần kiên trì', desc: 'Streak 14 ngày', icon: 'fa-solid fa-dumbbell' },
    checkin_30: { name: 'Tháng chuyên cần', desc: 'Streak 30 ngày', icon: 'fa-solid fa-trophy' },
    night_owl: { name: 'Cú đêm', desc: 'Nghe trong 0h–4h', icon: 'fa-solid fa-moon', hidden: true },
    early_bird: { name: 'Chim sớm', desc: 'Nghe trong 5h–7h', icon: 'fa-solid fa-sun', hidden: true },
    collector: { name: 'Nhà sưu tập', desc: 'Sở hữu 5 bài', icon: 'fa-solid fa-box-open' },
    collector_10: { name: 'Kho nhạc', desc: 'Sở hữu 10 bài', icon: 'fa-solid fa-folder-open' },
    collector_25: { name: 'Thư viện sống', desc: 'Sở hữu 25 bài', icon: 'fa-solid fa-book' },
    collector_50: { name: 'Đại gia nhạc', desc: 'Sở hữu 50 bài', icon: 'fa-solid fa-gem' },
    first_buy: { name: 'Giao dịch đầu', desc: 'Mua bài đầu tiên', icon: 'fa-solid fa-cart-shopping' },
    renter: { name: 'Thuê bao', desc: 'Thuê 1 bài 24h', icon: 'fa-solid fa-clock' },
    level_5: { name: 'Level 5', desc: 'Đạt level 5', icon: 'fa-solid fa-star' },
    level_10: { name: 'Level 10', desc: 'Đạt level 10', icon: 'fa-solid fa-star-half-stroke' },
    level_20: { name: 'Level 20', desc: 'Đạt level 20', icon: 'fa-solid fa-certificate' },
    level_50: { name: 'Level 50', desc: 'Đạt level 50', icon: 'fa-solid fa-crown' },
    gift_first: { name: 'Quà đầu tay', desc: 'Đổi gift code lần đầu', icon: 'fa-solid fa-gift' },
    gift_3: { name: 'Săn quà', desc: 'Đổi gift code 3 lần', icon: 'fa-solid fa-gifts' },
    chat_first: { name: 'Lên tiếng', desc: 'Gửi tin chat đầu tiên', icon: 'fa-solid fa-comments' },
    chat_10: { name: 'Tám chuyện', desc: 'Gửi 10 tin chat', icon: 'fa-solid fa-comment-dots' },
    thumb_buyer: { name: 'Trang trí', desc: 'Mua 1 progress thumb', icon: 'fa-solid fa-palette' },
    playlist_5: { name: 'DJ nghiệp dư', desc: '5 bài trong playlist', icon: 'fa-solid fa-music' },
    playlist_10: { name: 'Setlist ngon', desc: '10 bài trong playlist', icon: 'fa-solid fa-list' },
    playlist_20: { name: 'DJ chính hiệu', desc: '20 bài trong playlist', icon: 'fa-solid fa-sliders' },
    fav_5: { name: 'Thả tim', desc: '5 bài yêu thích (tim)', icon: 'fa-solid fa-heart' },
    fav_10: { name: 'Yêu thích', desc: '10 bài yêu thích (tim)', icon: 'fa-solid fa-heart' },
    fav_20: { name: 'Tim máy', desc: '20 bài yêu thích (tim)', icon: 'fa-solid fa-heart' },
    listen_1h: { name: '1 giờ nhạc', desc: 'Tổng thời gian nghe ≥ 1 giờ', icon: 'fa-solid fa-hourglass-half' },
    listen_10h: { name: '10 giờ nhạc', desc: 'Tổng thời gian nghe ≥ 10 giờ', icon: 'fa-solid fa-hourglass' },
    secret_333: { name: '3:33', desc: 'Nghe đúng lúc 3:33', icon: 'fa-solid fa-clock', hidden: true },
    marathon: { name: 'Marathon', desc: 'Nghe ≥ 60 phút trong phiên', icon: 'fa-solid fa-person-running' },
    rich: { name: 'Túi đầy', desc: 'Có ≥ 500 XK', icon: 'fa-solid fa-coins' },
    richer: { name: 'Đại gia XK', desc: 'Có ≥ 2000 XK', icon: 'fa-solid fa-building-columns' },
    vip_rank: { name: 'VIP', desc: 'Đạt hạng VIP', icon: 'fa-solid fa-medal' },
    super_vip_rank: { name: 'SUPER VIP', desc: 'Đạt hạng SUPER VIP', icon: 'fa-solid fa-crown' }
  };

  function badgeIconHtml(iconClass, extraClass) {
    const cls = String(iconClass || 'fa-solid fa-award').trim();
    // Đã là HTML sẵn
    if (cls.indexOf('<') >= 0) return cls;
    // Emoji cũ (fallback)
    if (!/^fa[srb]?\s|^fa-solid|^fa-regular|^fa-light|^fa-brands/.test(cls) && !cls.startsWith('fa-')) {
      return '<span class="badge-emoji">' + cls + '</span>';
    }
    return '<i class="' + cls + (extraClass ? ' ' + extraClass : '') + '" aria-hidden="true"></i>';
  }

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
    if (!def || typeof updateCurrentAccount !== 'function') return false;
    let got = false;
    updateCurrentAccount(acc => {
      if (!Array.isArray(acc.achievements)) acc.achievements = [];
      if (acc.achievements.includes(id)) return;
      acc.achievements.push(id);
      got = true;
    });
    if (got) {
      const iconPart = badgeIconHtml(def.icon, 'noti-badge-fa');
      toast('Huy hiệu:', iconPart + ' ' + def.name + (def.hidden ? ' <i class="fa-solid fa-sparkles"></i>' : ''), '#fbbf24');
    }
    return got;
  }

  function checkAchievements() {
    const acc = getAcc();
    if (!acc) return;
    const listened = acc.listenedSongs ? Object.keys(acc.listenedSongs).length : 0;
    const owned = (acc.owned || []).length;
    const streak = Number(acc.streak) || 0;
    const level = Number(acc.level) || 1;
    const coins = acc.coins | 0;
    const favs = (acc.favorites || []).length;
    const pl = (acc.myPlaylist || []).length;
    const thumbs = (acc.ownedThumbs || []).length;
    const rank = String(acc.rank || 'member').toLowerCase().replace(/\s+/g, '_');
    const giftN = Number(acc.giftClaimCount) || 0;
    const chatN = Number(acc.chatCount) || 0;
    const checkinDaysN = acc.checkinDays && typeof acc.checkinDays === 'object'
      ? Object.keys(acc.checkinDays).length
      : 0;
    let listenTotal = 0;
    if (acc.listenTime) {
      listenTotal = Number(acc.listenTime.total) || 0;
      const bd = acc.listenTime.byDay;
      if (bd && typeof bd === 'object') {
        let s = 0;
        Object.keys(bd).forEach(k => { s += Number(bd[k]) || 0; });
        listenTotal = Math.max(listenTotal, s);
      }
    }

    if (listened >= 1) unlockAchievement('first_listen');
    if (listened >= 5) unlockAchievement('listens_5');
    if (listened >= 10) unlockAchievement('listens_10');
    if (listened >= 25) unlockAchievement('listens_25');
    if (listened >= 50) unlockAchievement('listens_50');
    if (listened >= 100) unlockAchievement('listens_100');
    if (listened >= 200) unlockAchievement('listens_200');

    if (checkinDaysN >= 1 || acc.lastCheckin) unlockAchievement('checkin_1');
    if (streak >= 3) unlockAchievement('checkin_3');
    if (streak >= 7) unlockAchievement('checkin_7');
    if (streak >= 14) unlockAchievement('checkin_14');
    if (streak >= 30) unlockAchievement('checkin_30');

    if (owned >= 1) unlockAchievement('first_buy');
    if (owned >= 5) unlockAchievement('collector');
    if (owned >= 10) unlockAchievement('collector_10');
    if (owned >= 25) unlockAchievement('collector_25');
    if (owned >= 50) unlockAchievement('collector_50');

    if (level >= 5) unlockAchievement('level_5');
    if (level >= 10) unlockAchievement('level_10');
    if (level >= 20) unlockAchievement('level_20');
    if (level >= 50) unlockAchievement('level_50');

    if (coins >= 500) unlockAchievement('rich');
    if (coins >= 2000) unlockAchievement('richer');

    if (favs >= 5) unlockAchievement('fav_5');
    if (favs >= 10) unlockAchievement('fav_10');
    if (favs >= 20) unlockAchievement('fav_20');

    if (pl >= 5) unlockAchievement('playlist_5');
    if (pl >= 10) unlockAchievement('playlist_10');
    if (pl >= 20) unlockAchievement('playlist_20');

    if (thumbs >= 1) unlockAchievement('thumb_buyer');
    if (acc.rentals && typeof acc.rentals === 'object' && Object.keys(acc.rentals).length >= 1) {
      unlockAchievement('renter');
    }

    if (giftN >= 1) unlockAchievement('gift_first');
    if (giftN >= 3) unlockAchievement('gift_3');
    if (chatN >= 1) unlockAchievement('chat_first');
    if (chatN >= 10) unlockAchievement('chat_10');

    if (listenTotal >= 3600) unlockAchievement('listen_1h');
    if (listenTotal >= 36000) unlockAchievement('listen_10h');

    if (rank === 'vip' || rank === 'super_vip' || rank === 'admin' || rank === 'owner') {
      unlockAchievement('vip_rank');
    }
    if (rank === 'super_vip' || rank === 'admin' || rank === 'owner') {
      unlockAchievement('super_vip_rank');
    }

    const h = new Date().getHours();
    if (h >= 0 && h < 4) unlockAchievement('night_owl');
    if (h >= 5 && h < 7) unlockAchievement('early_bird');
    if (h === 3 && new Date().getMinutes() === 33) unlockAchievement('secret_333');

    const sessionSec = Number(window._sessionListenSec) || 0;
    if (sessionSec >= 3600) unlockAchievement('marathon');
  }

  /** Quét giftCodes một lần — bù huy hiệu nếu đã đổi mã trước đây mà chưa ghi */
  async function recoverGiftAchievements() {
    try {
      const acc = getAcc();
      if (!acc) return;
      if ((Number(acc.giftClaimCount) || 0) >= 1) {
        unlockAchievement('gift_first');
        return;
      }
      if ((acc.achievements || []).includes('gift_first')) return;
      const user = typeof getCurrentUsername === 'function' && getCurrentUsername();
      if (!user || typeof getDb !== 'function') return;
      const db = getDb();
      if (!db) return;
      const userKey = (typeof sanitizeUsernameKey === 'function'
        ? sanitizeUsernameKey(user)
        : String(user).replace(/[.#$\[\]\/]/g, '_'));
      const path = (typeof dataPath === 'function' ? dataPath('giftCodes') : 'giftCodes');
      const snap = await db.ref(path).once('value');
      const all = snap.val() || {};
      let count = 0;
      Object.keys(all).forEach(code => {
        const g = all[code] || {};
        const map = (g.usedByMap && typeof g.usedByMap === 'object') ? g.usedByMap : {};
        if (map[userKey] || map[user]) count += 1;
        else if (g.usedBy && String(g.usedBy).toLowerCase() === String(user).toLowerCase()) count += 1;
      });
      if (count > 0 && typeof updateCurrentAccount === 'function') {
        updateCurrentAccount(a => {
          a.giftClaimCount = Math.max(Number(a.giftClaimCount) || 0, count);
        });
        unlockAchievement('gift_first');
        if (count >= 3) unlockAchievement('gift_3');
      }
    } catch (e) {}
  }

  function playerHost() {
    return document.getElementById('player-container') || document.body;
  }

  function openBadgesModal() {
    let modal = document.getElementById('badges-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'badges-modal';
      modal.className = 'shop-modal badges-modal';
      modal.innerHTML = '<div class="shop-modal-header">'
        + '<div class="close-shop" id="close-badges-btn" title="Quay lại"><i data-lucide="arrow-left"></i></div>'
        + '<div class="shop-title"><i data-lucide="award"></i><span>HUY HIỆU</span></div>'
        + '<div style="width:40px;"></div></div>'
        + '<div class="badges-modal-body" id="badges-list"></div>';
      playerHost().appendChild(modal);
      const close = () => { modal.classList.remove('show'); };
      modal.querySelector('#close-badges-btn').onclick = close;
    } else if (modal.parentElement !== playerHost()) {
      playerHost().appendChild(modal);
    }
    function renderBadgesList() {
      const list = modal.querySelector('#badges-list');
      if (!list) return;
      const acc = getAcc() || {};
      const owned = new Set((acc.achievements || []).map(String));
      const ids = Object.keys(ACHIEVEMENTS);
      list.innerHTML = ids.map(id => {
        const def = ACHIEVEMENTS[id];
        if (def.hidden && !owned.has(id)) {
          return '<div class="badge-card locked"><div class="badge-icon"><i class="fa-solid fa-question" aria-hidden="true"></i></div><div class="badge-info"><div class="badge-name">???</div><div class="badge-desc">Huy hiệu ẩn</div></div></div>';
        }
        const got = owned.has(id);
        return '<div class="badge-card' + (got ? ' got' : ' locked') + '">'
          + '<div class="badge-icon">' + badgeIconHtml(def.icon) + '</div>'
          + '<div class="badge-info"><div class="badge-name">' + escapeHtml(def.name) + '</div>'
          + '<div class="badge-desc">' + escapeHtml(def.desc || '') + '</div></div>'
          + (got ? '<span class="badge-got-tag">Đã nhận</span>' : '<span class="badge-lock-tag">Chưa</span>')
          + '</div>';
      }).join('');
    }
    // Bù huy hiệu đã đạt (playlist, gift, checkin…) rồi vẽ
    try { checkAchievements(); } catch (e) {}
    renderBadgesList();
    modal.classList.add('show');
    recoverGiftAchievements().then(() => {
      try { checkAchievements(); } catch (e) {}
      renderBadgesList();
    }).catch(() => {});
    if (typeof lucide !== 'undefined') {
      try { lucide.createIcons({ nodes: Array.from(modal.querySelectorAll('[data-lucide]')) }); } catch (e) {}
    }
  }

  function openChatModal() {
    const modal = document.getElementById('chat-modal');
    if (!modal) return;
    // Đảm bảo nằm trong player
    const host = playerHost();
    if (modal.parentElement !== host) host.appendChild(modal);
    modal.classList.add('show');
    if (typeof lucide !== 'undefined') {
      try { lucide.createIcons({ nodes: Array.from(modal.querySelectorAll('[data-lucide]')) }); } catch (e) {}
    }
    // Scroll chat xuống cuối
    const box = document.getElementById('global-chat-box');
    if (box) setTimeout(() => { box.scrollTop = box.scrollHeight; }, 50);
  }

  function closeChatModal() {
    const modal = document.getElementById('chat-modal');
    if (modal) modal.classList.remove('show');
  }

  /** Modal kết quả (Top / Review / Thời gian) — khung player + nút quay lại */
  function openResultModal(title, icon, bodyHtml) {
    let modal = document.getElementById('extras-result-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'extras-result-modal';
      modal.className = 'shop-modal extras-result-modal';
      modal.innerHTML = '<div class="shop-modal-header">'
        + '<div class="close-shop" id="close-result-btn" title="Quay lại"><i data-lucide="arrow-left"></i></div>'
        + '<div class="shop-title"><i data-lucide="sparkles" id="result-modal-icon"></i><span id="result-modal-title">KẾT QUẢ</span></div>'
        + '<div style="width:40px;"></div></div>'
        + '<div class="extras-result-modal-body" id="extras-result-modal-body"></div>';
      playerHost().appendChild(modal);
      modal.querySelector('#close-result-btn').onclick = () => modal.classList.remove('show');
    } else if (modal.parentElement !== playerHost()) {
      playerHost().appendChild(modal);
    }
    const titleEl = modal.querySelector('#result-modal-title');
    if (titleEl) titleEl.textContent = title || 'KẾT QUẢ';
    const iconWrap = modal.querySelector('.shop-title');
    if (iconWrap) {
      iconWrap.innerHTML = '<i data-lucide="' + (icon || 'sparkles') + '"></i><span id="result-modal-title">' +
        (title || 'KẾT QUẢ').replace(/</g, '&lt;') + '</span>';
    }
    const body = modal.querySelector('#extras-result-modal-body');
    if (body) body.innerHTML = bodyHtml || '';
    modal.classList.add('show');
    if (typeof lucide !== 'undefined') {
      try { lucide.createIcons({ nodes: Array.from(modal.querySelectorAll('[data-lucide]')) }); } catch (e) {}
    }
  }


  let _usersCache = null;
  let _usersCacheAt = 0;

  async function fetchAllUsersLite() {
    if (_usersCache && Date.now() - _usersCacheAt < 60000) return _usersCache;
    try {
      const db = typeof getDb === 'function' ? getDb() : (window.db || null);
      if (!db) return [];
      const path = (typeof dataPath === 'function' ? dataPath('users') : 'users');
      const snap = await db.ref(path).once('value');
      const val = snap.val() || {};
      const list = Object.keys(val).map(uid => {
        const u = val[uid] || {};
        let ownedCount = 0;
        if (Array.isArray(u.owned)) ownedCount = u.owned.length;
        else if (u.owned && typeof u.owned === 'object') ownedCount = Object.keys(u.owned).length;
        else if (typeof u.owned === 'string') ownedCount = u.owned.split(',').filter(Boolean).length;
        const lt = (u.listenTime && typeof u.listenTime === 'object') ? u.listenTime : {};
        const byDay = (lt.byDay && typeof lt.byDay === 'object') ? lt.byDay : {};
        return {
          uid,
          username: String(u.username || uid).slice(0, 32),
          rank: String(u.rank || 'member'),
          listenTotal: Number(lt.total) || 0,
          byDay,
          ownedCount,
          createdAt: Number(u.createdAt) || 0
        };
      });
      _usersCache = list;
      _usersCacheAt = Date.now();
      return list;
    } catch (e) {
      console.warn('[lb] fetch users', e);
      return _usersCache || [];
    }
  }

  function sumByDayPeriod(byDay, period) {
    const now = new Date();
    // So sánh theo ngày lịch (0h local), tránh lệch timezone / nửa ngày
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = startOfToday - 6 * 24 * 3600 * 1000; // 7 ngày gồm hôm nay
    let sum = 0;
    Object.keys(byDay || {}).forEach(k => {
      const parts = String(k).split('-');
      if (parts.length < 3) return;
      const y = Number(parts[0]), m = Number(parts[1]) - 1, day = Number(parts[2]);
      if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(day)) return;
      const d = new Date(y, m, day);
      if (Number.isNaN(d.getTime())) return;
      const t = d.getTime();
      if (period === 'week') {
        if (t >= weekStart && t <= startOfToday) sum += Number(byDay[k]) || 0;
      } else if (period === 'month') {
        if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) sum += Number(byDay[k]) || 0;
      } else {
        if (d.getFullYear() === now.getFullYear()) sum += Number(byDay[k]) || 0;
      }
    });
    return sum;
  }

  async function showListenLeaderboard(period) {
    const titles = { week: 'TOP NGHE · TUẦN', month: 'TOP NGHE · THÁNG', year: 'TOP NGHE · NĂM' };
    openResultModal(titles[period] || 'TOP NGHE', 'headphones', '<div class="xr-empty">Đang tải…</div>');
    const users = await fetchAllUsersLite();
    const ranked = users.map(u => ({
      ...u,
      score: period === 'year' && !Object.keys(u.byDay || {}).length
        ? u.listenTotal
        : sumByDayPeriod(u.byDay, period) || (period === 'year' ? u.listenTotal : 0)
    })).filter(u => u.score > 0).sort((a, b) => b.score - a.score).slice(0, 10);
    let rows = '';
    if (!ranked.length) rows = '<div class="xr-empty">Chưa có dữ liệu nghe</div>';
    else ranked.forEach((u, i) => {
      const rankCls = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
      rows += '<div class="xr-row ' + rankCls + '">'
        + '<span class="xr-rank">' + (i + 1) + '</span>'
        + '<div class="xr-info"><div class="xr-name">' + escapeHtml(u.username) + '</div>'
        + '<div class="xr-sub">' + escapeHtml(String(u.rank).replace(/_/g, ' ').toUpperCase()) + '</div></div>'
        + '<span class="xr-val">' + escapeHtml(formatListenDuration(u.score)) + '</span></div>';
    });
    openResultModal(titles[period] || 'TOP NGHE', 'headphones',
      '<div class="xr-note">Xếp theo thời gian nghe (' + (period === 'week' ? '7 ngày' : period === 'month' ? 'tháng này' : 'năm nay') + ')</div><div class="xr-list">' + rows + '</div>');
  }

  async function showOwnLeaderboard(period) {
    // Owned không có breakdown theo tuần — dùng tổng sở hữu; period chỉ là nhãn UI
    const titles = { week: 'TOP SỞ HỮU · TUẦN', month: 'TOP SỞ HỮU · THÁNG', year: 'TOP SỞ HỮU · NĂM' };
    openResultModal(titles[period] || 'TOP SỞ HỮU', 'library', '<div class="xr-empty">Đang tải…</div>');
    const users = await fetchAllUsersLite();
    const ranked = users.filter(u => u.ownedCount > 0).sort((a, b) => b.ownedCount - a.ownedCount).slice(0, 10);
    let rows = '';
    if (!ranked.length) rows = '<div class="xr-empty">Chưa có dữ liệu sở hữu</div>';
    else ranked.forEach((u, i) => {
      const rankCls = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
      rows += '<div class="xr-row ' + rankCls + '">'
        + '<span class="xr-rank">' + (i + 1) + '</span>'
        + '<div class="xr-info"><div class="xr-name">' + escapeHtml(u.username) + '</div>'
        + '<div class="xr-sub">' + escapeHtml(String(u.rank).replace(/_/g, ' ').toUpperCase()) + '</div></div>'
        + '<span class="xr-val">' + u.ownedCount + ' bài</span></div>';
    });
    openResultModal(titles[period] || 'TOP SỞ HỮU', 'library',
      '<div class="xr-note">Xếp theo số bài đã mua (tổng)</div><div class="xr-list">' + rows + '</div>');
  }


  /* ===== Điểm danh lịch (dương + âm) ===== */
  // Âm lịch VN — thuật toán Hồ Ngọc Đức (rút gọn)
  function _jdFromDate(dd, mm, yy) {
    const a = Math.floor((14 - mm) / 12);
    const y = yy + 4800 - a;
    const m = mm + 12 * a - 3;
    let jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
    return jd;
  }
  function _getNewMoonDay(k, timeZone) {
    const T = k / 1236.85;
    const T2 = T * T;
    const T3 = T2 * T;
    let jd = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
    jd = jd + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * Math.PI / 180);
    const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
    const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
    const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
    let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * Math.PI / 180) + 0.0021 * Math.sin(2 * M * Math.PI / 180);
    C1 = C1 - 0.4068 * Math.sin(Mpr * Math.PI / 180) + 0.0161 * Math.sin(2 * Mpr * Math.PI / 180);
    C1 = C1 - 0.0004 * Math.sin(3 * Mpr * Math.PI / 180);
    C1 = C1 + 0.0104 * Math.sin(2 * F * Math.PI / 180) - 0.0051 * Math.sin((M + Mpr) * Math.PI / 180);
    C1 = C1 - 0.0074 * Math.sin((M - Mpr) * Math.PI / 180) + 0.0004 * Math.sin((2 * F + M) * Math.PI / 180);
    C1 = C1 - 0.0004 * Math.sin((2 * F - M) * Math.PI / 180) - 0.0006 * Math.sin((2 * F + Mpr) * Math.PI / 180);
    C1 = C1 + 0.0010 * Math.sin((2 * F - Mpr) * Math.PI / 180) + 0.0005 * Math.sin((2 * Mpr + M) * Math.PI / 180);
    const deltaT = T < -11 ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3 : 0.0003 * T2 - 0.000019;
    return Math.floor(jd + C1 - deltaT + 0.5 + timeZone / 24);
  }
  function _getLunarMonth11(yy, timeZone) {
    const off = _jdFromDate(31, 12, yy) - 2415021.076998695;
    const k = Math.floor(off / 29.530588853);
    let nm = _getNewMoonDay(k, timeZone);
    const sunLong = (function (jdn, tz) {
      const T = (jdn - 2451545.5 - tz / 24) / 36525;
      const T2 = T * T;
      const dr = Math.PI / 180;
      let M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
      const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
      let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
      DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
      let L = L0 + DL;
      L = L * dr;
      L = L - Math.PI * 2 * Math.floor(L / (Math.PI * 2));
      return Math.floor(L / Math.PI * 6);
    })(nm, timeZone);
    if (sunLong >= 9) nm = _getNewMoonDay(k - 1, timeZone);
    return nm;
  }
  function _getLeapMonthOffset(a11, timeZone) {
    const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
    let last = 0;
    let i = 1;
    let arc = (function (jdn, tz) {
      const T = (jdn - 2451545.5 - tz / 24) / 36525;
      const T2 = T * T;
      const dr = Math.PI / 180;
      let M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
      const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
      let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
      DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
      let L = (L0 + DL) * dr;
      L = L - Math.PI * 2 * Math.floor(L / (Math.PI * 2));
      return Math.floor(L / Math.PI * 6);
    })(_getNewMoonDay(k + i, timeZone), timeZone);
    do {
      last = arc;
      i++;
      arc = (function (jdn, tz) {
        const T = (jdn - 2451545.5 - tz / 24) / 36525;
        const T2 = T * T;
        const dr = Math.PI / 180;
        let M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
        const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
        let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
        DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
        let L = (L0 + DL) * dr;
        L = L - Math.PI * 2 * Math.floor(L / (Math.PI * 2));
        return Math.floor(L / Math.PI * 6);
      })(_getNewMoonDay(k + i, timeZone), timeZone);
    } while (arc !== last && i < 14);
    return i - 1;
  }
  function solarToLunar(dd, mm, yy, timeZone) {
    timeZone = timeZone == null ? 7 : timeZone;
    const dayNumber = _jdFromDate(dd, mm, yy);
    const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
    let monthStart = _getNewMoonDay(k + 1, timeZone);
    if (monthStart > dayNumber) monthStart = _getNewMoonDay(k, timeZone);
    let a11 = _getLunarMonth11(yy, timeZone);
    let b11 = a11;
    let lunarYear;
    if (a11 >= monthStart) {
      lunarYear = yy;
      a11 = _getLunarMonth11(yy - 1, timeZone);
    } else {
      lunarYear = yy + 1;
      b11 = _getLunarMonth11(yy + 1, timeZone);
    }
    const lunarDay = dayNumber - monthStart + 1;
    const diff = Math.floor((monthStart - a11) / 29);
    let lunarLeap = 0;
    let lunarMonth = diff + 11;
    if (b11 - a11 > 365) {
      const leapMonthDiff = _getLeapMonthOffset(a11, timeZone);
      if (diff >= leapMonthDiff) {
        lunarMonth = diff + 10;
        if (diff === leapMonthDiff) lunarLeap = 1;
      }
    }
    if (lunarMonth > 12) lunarMonth = lunarMonth - 12;
    if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
    return { day: lunarDay, month: lunarMonth, year: lunarYear, leap: lunarLeap };
  }

  function openCheckinModal() {
    const modal = document.getElementById('checkin-modal');
    if (!modal) return;
    const host = playerHost();
    if (modal.parentElement !== host) host.appendChild(modal);
    modal.classList.add('show');
    renderCheckinCalendar();
    const closeBtn = document.getElementById('close-checkin-btn');
    if (closeBtn && !closeBtn._xkBound) {
      closeBtn._xkBound = true;
      closeBtn.onclick = (e) => { e.preventDefault(); modal.classList.remove('show'); };
    }
    if (typeof lucide !== 'undefined') {
      try { lucide.createIcons({ nodes: Array.from(modal.querySelectorAll('[data-lucide]')) }); } catch (e) {}
    }
  }

  function renderCheckinCalendar() {
    const body = document.getElementById('checkin-modal-body');
    if (!body) return;
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-11
    const todayKey = (typeof getTodayKey === 'function') ? getTodayKey() : (
      y + '-' + String(m + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')
    );
    const acc = getAcc() || {};
    const daysMap = (acc.checkinDays && typeof acc.checkinDays === 'object') ? { ...acc.checkinDays } : {};
    if (acc.lastCheckin && !daysMap[acc.lastCheckin]) daysMap[acc.lastCheckin] = true;

    const monthNames = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
    const weekDays = ['T2','T3','T4','T5','T6','T7','CN'];
    const first = new Date(y, m, 1);
    // Monday-based: 0=Mon ... 6=Sun
    let startPad = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const reward = (typeof getAdminSettings === 'function' && getAdminSettings().checkinReward) || 15;

    let cells = '';
    for (let i = 0; i < startPad; i++) cells += '<div class="ci-cell empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const key = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      let lunar;
      try { lunar = solarToLunar(d, m + 1, y, 7); } catch (e) { lunar = { day: '', month: '' }; }
      const lunarTxt = lunar.day === 1 ? (lunar.day + '/' + lunar.month) : String(lunar.day || '');
      const done = !!daysMap[key];
      const isFuture = key > todayKey;
      const isToday = key === todayKey;
      const canMakeup = !done && !isFuture;
      let cls = 'ci-cell';
      if (done) cls += ' done';
      else if (!isFuture) cls += ' miss';
      else cls += ' future';
      if (isToday) cls += ' today';
      if (canMakeup) cls += ' clickable';
      cells += '<button type="button" class="' + cls + '" data-ci-day="' + key + '"' + (canMakeup ? '' : ' disabled') + '>'
        + (done ? '<span class="ci-check">✓</span>' : '')
        + '<span class="ci-solar">' + d + '</span>'
        + '<span class="ci-lunar">' + escapeHtml(lunarTxt) + '</span>'
        + '</button>';
    }

    
    // Đủ 6 hàng (42 ô) để grid giãn đều, không trống lệch
    const totalCells = startPad + daysInMonth;
    const need = Math.max(0, 42 - totalCells);
    for (let i = 0; i < need; i++) cells += '<div class="ci-cell empty"></div>';

    const streakN = Number(acc.streak) || 0;
    body.innerHTML = '<div class="ci-head">'
      + '<div class="ci-month">'
      + '<i class="fa-solid fa-calendar-days ci-month-icon" aria-hidden="true"></i>'
      + '<span class="ci-month-text">' + monthNames[m] + ' · ' + y + '</span>'
      + '</div>'
      + '<div class="ci-legend">'
      + '<span class="ci-pill"><span class="ci-lg done"></span>Đã điểm danh</span>'
      + '<span class="ci-pill"><span class="ci-lg miss"></span>Chưa / bỏ lỡ</span>'
      + '</div>'
      + '<div class="ci-reward"><i class="fa-solid fa-coins"></i> Hôm nay +' + reward + ' XK &nbsp;·&nbsp; Điểm danh bù −5 XK</div>'
      + '</div>'
      + '<div class="ci-week">' + weekDays.map(w => '<div class="ci-wd">' + w + '</div>').join('') + '</div>'
      + '<div class="ci-grid">' + cells + '</div>'
      + '<div class="ci-streak">'
      + '<span class="ci-streak-badge"><i class="fa-solid fa-fire-flame-curved" aria-hidden="true"></i></span>'
      + '<div class="ci-streak-body">'
      + '<span class="ci-streak-label">Chuỗi điểm danh</span>'
      + '<span class="ci-streak-val"><b>' + streakN + '</b> ngày' + (streakN > 0 ? ' liên tiếp' : '') + '</span>'
      + (acc.lastCheckin ? '<span class="ci-streak-meta"><i class="fa-regular fa-clock"></i> Lần cuối: ' + escapeHtml(acc.lastCheckin) + '</span>' : '')
      + '</div>'
      + '</div>';

    body.querySelectorAll('.ci-cell.clickable[data-ci-day]').forEach(btn => {
      btn.onclick = () => {
        const key = btn.getAttribute('data-ci-day');
        if (typeof doDailyCheckin === 'function') {
          if (doDailyCheckin(key)) renderCheckinCalendar();
        }
      };
    });
  }
  window.renderCheckinCalendar = renderCheckinCalendar;


  async function syncUserPartial() {
    // Dùng pushUserToFirebase (merge an toàn) — không .update() ghi đè listenTime/checkin
    try {
      const name = typeof getCurrentUsername === 'function' && getCurrentUsername();
      if (!name || typeof pushUserToFirebase !== 'function') return;
      const acc = getAcc();
      if (!acc) return;
      await pushUserToFirebase(name, acc, {
        achievementsChanged: true,
        xpChanged: true,
        checkinChanged: true,
        listenedSongsChanged: true,
        coinsDelta: 0
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



  // ----- 33 Gift code -----
  async function redeemGiftCode(code) {
    code = String(code || '').trim().toUpperCase().replace(/\s+/g, '').replace(/[.#$\[\]\/]/g, '');
    if (!code) return toast('GIFT', 'Nhập mã', '#ff9800');
    const user = typeof getCurrentUsername === 'function' && getCurrentUsername();
    if (!user) return toast('GIFT', 'Cần đăng nhập username', '#ff4444');
    // Key an toàn cho Firebase (tránh . # $ [ ] /)
    const userKey = (typeof sanitizeUsernameKey === 'function' ? sanitizeUsernameKey(user) : String(user).replace(/[.#$\[\]\/]/g, '_'));
    try {
      const db = typeof getDb === 'function' ? getDb() : null;
      if (!db) return toast('GIFT', 'Không kết nối được', '#ff4444');
      const path = (typeof dataPath === 'function' ? dataPath('giftCodes') : 'giftCodes') + '/' + code;
      const ref = db.ref(path);
      const snap = await ref.once('value');
      const data = snap.val();
      if (!data) return toast('GIFT', 'Mã không tồn tại', '#ff4444');
      const coins = Number(data.coins) || 0;
      if (coins <= 0) return toast('GIFT', 'Mã không hợp lệ (0 xu)', '#ff4444');
      const maxUses = data.maxUses == null ? 1 : Number(data.maxUses); // -1 = vĩnh viễn
      const usedCount = Number(data.usedCount) || 0;
      const usedByMap = (data.usedByMap && typeof data.usedByMap === 'object') ? data.usedByMap : {};
      // 1 user chỉ nhận 1 lần / mã
      if (usedByMap[userKey] || usedByMap[user]) return toast('GIFT', 'Bạn đã nhận mã này rồi', '#ff9800');
      // maxUses = 1 kiểu cũ: usedBy string
      if (maxUses === 1 && data.usedBy && String(data.usedBy).trim() && !data.usedByMap) {
        return toast('GIFT', 'Mã đã được dùng bởi ' + data.usedBy, '#ff9800');
      }
      if (maxUses >= 0 && usedCount >= maxUses) {
        return toast('GIFT', 'Mã đã hết lượt dùng', '#ff9800');
      }
      const result = await ref.transaction(current => {
        if (!current) return; // abort
        const max = current.maxUses == null ? 1 : Number(current.maxUses);
        const cnt = Number(current.usedCount) || 0;
        const map = (current.usedByMap && typeof current.usedByMap === 'object') ? { ...current.usedByMap } : {};
        if (map[userKey] || map[user]) return; // abort — đã nhận
        if (max === 1 && current.usedBy && String(current.usedBy).trim() && !current.usedByMap) return;
        if (max >= 0 && cnt >= max) return;
        map[userKey] = Date.now();
        current.usedByMap = map;
        current.usedCount = cnt + 1;
        current.usedBy = user; // user cuối (hiển thị)
        current.usedAt = Date.now();
        return current;
      });
      if (!result || !result.committed) {
        return toast('GIFT', 'Mã hết lượt / đã dùng / Rules chặn ghi', '#ff9800');
      }
      if (typeof updateCurrentAccount === 'function') {
        updateCurrentAccount(acc => {
          acc.coins = (acc.coins | 0) + coins;
          acc.giftClaimCount = (Number(acc.giftClaimCount) || 0) + 1;
        });
      }
      unlockAchievement('gift_first');
      const gCount = Number((getAcc() || {}).giftClaimCount) || 1;
      if (gCount >= 3) unlockAchievement('gift_3');
      toast('GIFT', '+' + coins + ' XK', '#4ade80');
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
      toast('INVITE', 'Cả hai +' + reward + ' xu', '#4ade80');
    } catch (e) {}
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


  /* ===== Đếm ngược sự kiện (admin cấu hình) ===== */
  let _cdTimer = null;
  function stopCountdownTimer() {
    if (_cdTimer) { clearInterval(_cdTimer); _cdTimer = null; }
  }
  function formatCdUnit(n) {
    return String(Math.max(0, n | 0)).padStart(2, '0');
  }
  async function loadCountdownConfig() {
    try {
      const db = typeof getDb === 'function' ? getDb() : null;
      if (!db) return null;
      const snap = await db.ref('settings').once('value');
      const s = snap.val() || {};
      if (!s.countdownAt) return null;
      const at = Date.parse(s.countdownAt);
      if (!at || Number.isNaN(at)) return null;
      return { title: s.countdownTitle || 'Đếm ngược', at };
    } catch (e) {
      console.warn('[cd]', e);
      return null;
    }
  }
  function buildCountdownBody(cfg) {
    const target = new Date(cfg.at);
    const y = target.getFullYear();
    const m = target.getMonth() + 1;
    const d = target.getDate();
    const weekday = ['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'][target.getDay()];
    let lunar = { day: '—', month: '—', year: '—', leap: 0 };
    try {
      if (typeof solarToLunar === 'function') lunar = solarToLunar(d, m, y, 7);
    } catch (e) {}
    const monthNames = ['','Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
    const lunarMonthTxt = (lunar.leap ? 'Nhuận ' : '') + (monthNames[lunar.month] || ('Tháng ' + lunar.month));
    const hh = String(target.getHours()).padStart(2,'0');
    const mm = String(target.getMinutes()).padStart(2,'0');
    return ''
      + '<div class="cd-wrap">'
      +   '<div class="cd-hero">'
      +     '<div class="cd-hero-glow"></div>'
      +     '<div class="cd-title">' + escapeHtml(cfg.title) + '</div>'
      +     '<div class="cd-calendar">'
      +       '<div class="cd-cal-head">' + escapeHtml(weekday) + '</div>'
      +       '<div class="cd-cal-day">' + d + '</div>'
      +       '<div class="cd-cal-month">' + escapeHtml(monthNames[m] + ' · ' + y) + '</div>'
      +       '<div class="cd-cal-lunar">'
      +         '<span class="cd-lunar-badge">Âm lịch</span>'
      +         '<span class="cd-lunar-txt">Ngày ' + escapeHtml(String(lunar.day)) + ' · ' + escapeHtml(lunarMonthTxt) + ' · ' + escapeHtml(String(lunar.year)) + '</span>'
      +       '</div>'
      +       '<div class="cd-cal-time"><i data-lucide="clock"></i> ' + hh + ':' + mm + '</div>'
      +     '</div>'
      +   '</div>'
      +   '<div class="cd-clock" id="cd-clock-live">'
      +     '<div class="cd-unit"><span class="cd-num" data-u="d">00</span><span class="cd-lab">Ngày</span></div>'
      +     '<div class="cd-sep">:</div>'
      +     '<div class="cd-unit"><span class="cd-num" data-u="h">00</span><span class="cd-lab">Giờ</span></div>'
      +     '<div class="cd-sep">:</div>'
      +     '<div class="cd-unit"><span class="cd-num" data-u="m">00</span><span class="cd-lab">Phút</span></div>'
      +     '<div class="cd-sep">:</div>'
      +     '<div class="cd-unit"><span class="cd-num" data-u="s">00</span><span class="cd-lab">Giây</span></div>'
      +   '</div>'
      +   '<div class="cd-status" id="cd-status-live">Đang đếm…</div>'
      + '</div>';
  }
  function tickCountdown(cfg) {
    const root = document.getElementById('cd-clock-live');
    const status = document.getElementById('cd-status-live');
    if (!root) return;
    const left = cfg.at - Date.now();
    const done = left <= 0;
    const abs = Math.abs(left);
    const days = Math.floor(abs / 86400000);
    const hours = Math.floor((abs % 86400000) / 3600000);
    const mins = Math.floor((abs % 3600000) / 60000);
    const secs = Math.floor((abs % 60000) / 1000);
    const set = (u, v) => {
      const el = root.querySelector('[data-u="' + u + '"]');
      if (el) el.textContent = formatCdUnit(v);
    };
    set('d', days);
    set('h', hours);
    set('m', mins);
    set('s', secs);
    if (status) {
      if (done) {
        status.textContent = 'Đã đến ngày sự kiện!';
        status.classList.add('done');
      } else {
        status.textContent = 'Còn lại đến sự kiện';
        status.classList.remove('done');
      }
    }
  }
  async function openEventCountdown() {
    stopCountdownTimer();
    openResultModal('ĐẾM NGƯỢC', 'hourglass', '<div class="xr-empty">Đang tải…</div>');
    const cfg = await loadCountdownConfig();
    if (!cfg) {
      openResultModal('ĐẾM NGƯỢC', 'hourglass',
        '<div class="xr-empty">Chưa cấu hình ngày đếm ngược.<br/><span style="opacity:0.7;font-size:0.8rem">Admin → Cài đặt → Đếm ngược sự kiện</span></div>');
      return;
    }
    openResultModal('ĐẾM NGƯỢC', 'hourglass', buildCountdownBody(cfg));
    if (typeof lucide !== 'undefined') {
      try {
        const modal = document.getElementById('extras-result-modal');
        if (modal) lucide.createIcons({ nodes: Array.from(modal.querySelectorAll('[data-lucide]')) });
      } catch (e) {}
    }
    tickCountdown(cfg);
    _cdTimer = setInterval(() => tickCountdown(cfg), 1000);
  }

  /* ===== Top bài theo tuần (mỗi tuần 1 bảng riêng + khoảng ngày) ===== */
  function parseWeekKey(key) {
    const m = String(key || '').match(/^(\d{4})-(\d{2})-W(\d+)$/);
    if (!m) return null;
    return { y: +m[1], m: +m[2], w: +m[3], key: m[0] };
  }
  function weekDateRangeFromKey(key) {
    if (typeof weekOfMonthDateRange === 'function') {
      const r = weekOfMonthDateRange(key);
      if (r) return r;
    }
    if (typeof getWeekOfMonthRange === 'function') {
      const r = getWeekOfMonthRange(key);
      if (r) {
        const pad = n => String(n).padStart(2, '0');
        return pad(r.startDay) + '/' + pad(r.m) + '/' + r.y + ' – ' + pad(r.endDay) + '/' + pad(r.m) + '/' + r.y;
      }
    }
    const p = parseWeekKey(key);
    if (!p) return '';
    const start = (p.w - 1) * 7 + 1;
    const endGuess = p.w * 7;
    const pad = n => String(n).padStart(2, '0');
    return pad(start) + '/' + pad(p.m) + '/' + p.y + ' – ' + pad(endGuess) + '/' + pad(p.m) + '/' + p.y;
  }
  function weekLabelFromKey(key) {
    if (typeof weekOfMonthLabel === 'function') return weekOfMonthLabel(key);
    const p = parseWeekKey(key);
    if (!p) return key;
    const range = weekDateRangeFromKey(key);
    return range ? ('Tuần ' + p.w + ' · ' + range) : ('Tuần ' + p.w + ' · Tháng ' + p.m + '/' + p.y);
  }
  function weekStatusLabel(key, curKey) {
    if (key === curKey) return 'Đang diễn ra';
    // key dạng 2026-09-W4 — so sánh chuỗi đủ để biết tuần đã qua
    if (curKey && key < curKey) return 'Đã kết thúc';
    if (curKey && key > curKey) return 'Sắp tới';
    return '';
  }
  async function fetchWeeklyMetaList() {
    try {
      const db = typeof getDb === 'function' ? getDb() : null;
      if (!db) return [];
      const path = typeof dataPath === 'function' ? dataPath('weeklyListensMeta') : 'weeklyListensMeta';
      const snap = await db.ref(path).once('value');
      const val = snap.val() || {};
      const cur = typeof getWeekOfMonthKey === 'function' ? getWeekOfMonthKey() : null;
      const list = Object.keys(val).map(k => {
        const v = val[k] || {};
        const key = v.key || k;
        const range = weekDateRangeFromKey(key);
        const label = weekLabelFromKey(key); // luôn build lại để có khoảng ngày mới
        return {
          key,
          label,
          dateRange: range,
          status: weekStatusLabel(key, cur),
          updatedAt: Number(v.updatedAt) || 0
        };
      });
      // luôn thêm tuần hiện tại nếu chưa có (bảng riêng khi sang tuần mới)
      if (cur && !list.some(x => x.key === cur)) {
        list.push({
          key: cur,
          label: weekLabelFromKey(cur),
          dateRange: weekDateRangeFromKey(cur),
          status: 'Đang diễn ra',
          updatedAt: Date.now()
        });
      }
      list.sort((a, b) => {
        if (a.key < b.key) return 1;
        if (a.key > b.key) return -1;
        return 0;
      });
      return list;
    } catch (e) {
      console.warn('[weekly]', e);
      return [];
    }
  }
  async function fetchWeeklyTop(weekKey) {
    try {
      const db = typeof getDb === 'function' ? getDb() : null;
      if (!db) return [];
      const path = (typeof dataPath === 'function' ? dataPath('weeklyListens') : 'weeklyListens') + '/' + weekKey;
      const snap = await db.ref(path).once('value');
      const val = snap.val() || {};
      const songs = window.songs || [];
      const rows = Object.keys(val).map(sid => {
        const count = Number(val[sid]) || 0;
        const song = songs.find(s => String(s.id) === String(sid));
        return {
          id: sid,
          name: (song && song.name) || sid,
          artist: (song && song.artist) || '',
          count
        };
      }).filter(r => r.count > 0).sort((a, b) => b.count - a.count).slice(0, 10);
      return rows;
    } catch (e) {
      console.warn('[weekly top]', e);
      return [];
    }
  }
  function renderWeeklyList(weeks) {
    if (!weeks.length) {
      return '<div class="xr-empty">Chưa có dữ liệu top tuần.<br/><span style="opacity:0.7;font-size:0.8rem">Nghe nhạc sẽ tự ghi nhận từng tuần — hết tuần sẽ có bảng riêng</span></div>';
    }
    const cur = typeof getWeekOfMonthKey === 'function' ? getWeekOfMonthKey() : '';
    let html = '<div class="wk-list">';
    weeks.forEach((w, i) => {
      const isCur = w.key === cur;
      const range = w.dateRange || weekDateRangeFromKey(w.key);
      const status = w.status || weekStatusLabel(w.key, cur);
      const title = 'Tuần ' + (parseWeekKey(w.key) ? parseWeekKey(w.key).w : '') + (isCur ? ' (hiện tại)' : '');
      html += '<button type="button" class="wk-card' + (isCur ? ' current' : '') + '" data-week="' + escapeHtml(w.key) + '">'
        + '<div class="wk-badge">' + (isCur ? 'NOW' : (status === 'Đã kết thúc' ? 'DONE' : ('#' + (i + 1)))) + '</div>'
        + '<div class="wk-info"><div class="wk-title">' + escapeHtml(title) + '</div>'
        + '<div class="wk-sub">' + escapeHtml(range || w.key)
        + (status ? (' · ' + status) : '')
        + '</div></div>'
        + '<div class="wk-arrow"><i data-lucide="chevron-right"></i></div>'
        + '</button>';
    });
    html += '</div>';
    return html;
  }
  function renderWeeklyTopRows(rows, weekKey) {
    const range = weekDateRangeFromKey(weekKey);
    const p = parseWeekKey(weekKey);
    const cur = typeof getWeekOfMonthKey === 'function' ? getWeekOfMonthKey() : '';
    const status = weekStatusLabel(weekKey, cur);
    const titleBits = [];
    if (p) titleBits.push('Tuần ' + p.w);
    if (range) titleBits.push(range);
    if (status) titleBits.push(status);
    let body = '<div class="xr-note">' + escapeHtml(titleBits.join(' · ')) + ' — Top 10 lượt nghe</div>';
    if (!rows.length) {
      body += '<div class="xr-empty">Tuần này chưa có lượt nghe</div>';
      return body;
    }
    body += '<div class="xr-list">';
    rows.forEach((s, i) => {
      const rankCls = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
      body += '<div class="xr-row ' + rankCls + '">'
        + '<span class="xr-rank">' + (i + 1) + '</span>'
        + '<div class="xr-info"><div class="xr-name">' + escapeHtml(s.name) + '</div>'
        + '<div class="xr-sub">' + escapeHtml(s.artist || s.id) + '</div></div>'
        + '<span class="xr-val"><i data-lucide="headphones"></i> ' + s.count + '</span>'
        + '</div>';
    });
    body += '</div>';
    body += '<button type="button" class="wk-back-btn" id="wk-back-btn"><i data-lucide="arrow-left"></i> Về danh sách tuần</button>';
    return body;
  }
  async function openWeeklyArchive() {
    openResultModal('TOP TUẦN', 'list-music', '<div class="xr-empty">Đang tải…</div>');
    const weeks = await fetchWeeklyMetaList();
    openResultModal('TOP TUẦN', 'list-music',
      '<div class="xr-note">Mỗi tuần một bảng riêng · Hết tuần tự chuyển bảng mới · Hiện khoảng ngày rõ ràng</div>' + renderWeeklyList(weeks));
    bindWeeklyClicks(weeks);
  }
  function bindWeeklyClicks(weeks) {
    const modal = document.getElementById('extras-result-modal');
    if (!modal) return;
    if (typeof lucide !== 'undefined') {
      try { lucide.createIcons({ nodes: Array.from(modal.querySelectorAll('[data-lucide]')) }); } catch (e) {}
    }
    modal.querySelectorAll('[data-week]').forEach(btn => {
      btn.onclick = async () => {
        const key = btn.getAttribute('data-week');
        const p = parseWeekKey(key);
        const range = weekDateRangeFromKey(key);
        const modalTitle = p ? ('TUẦN ' + p.w) : weekLabelFromKey(key);
        openResultModal(modalTitle, 'trophy', '<div class="xr-empty">Đang tải…</div>');
        const rows = await fetchWeeklyTop(key);
        openResultModal(modalTitle, 'trophy', renderWeeklyTopRows(rows, key));
        if (typeof lucide !== 'undefined') {
          try {
            const m2 = document.getElementById('extras-result-modal');
            if (m2) lucide.createIcons({ nodes: Array.from(m2.querySelectorAll('[data-lucide]')) });
          } catch (e) {}
        }
        const back = document.getElementById('wk-back-btn');
        if (back) {
          back.onclick = () => {
            openResultModal('TOP TUẦN', 'list-music',
              '<div class="xr-note">Mỗi tuần một bảng riêng · Hết tuần tự chuyển bảng mới · Hiện khoảng ngày rõ ràng</div>' + renderWeeklyList(weeks));
            bindWeeklyClicks(weeks);
          };
        }
      };
    });
  }

  /* ===== Liên kết (admin cấu hình) ===== */
  async function loadPartnerLinks() {
    try {
      const db = typeof getDb === 'function' ? getDb() : null;
      if (!db) return [];
      const snap = await db.ref('settings/partnerLinks').once('value');
      let val = snap.val();
      if (!val) {
        const s = await db.ref('settings').once('value');
        val = (s.val() || {}).partnerLinks;
      }
      if (Array.isArray(val)) return val.filter(x => x && x.url);
      if (val && typeof val === 'object') return Object.keys(val).map(k => val[k]).filter(x => x && x.url);
      return [];
    } catch (e) {
      console.warn('[links]', e);
      return [];
    }
  }
  function iconForLink(L) {
    const ic = String((L && L.icon) || '').toLowerCase();
    if (ic) return ic;
    const u = String((L && L.url) || '').toLowerCase();
    if (u.includes('youtube') || u.includes('youtu.be')) return 'youtube';
    if (u.includes('facebook') || u.includes('fb.com')) return 'facebook';
    if (u.includes('tiktok')) return 'music-2';
    if (u.includes('instagram')) return 'instagram';
    if (u.includes('twitter') || u.includes('x.com')) return 'twitter';
    if (u.includes('discord')) return 'message-circle';
    if (u.includes('telegram')) return 'send';
    return 'external-link';
  }
  async function openPartnerLinks() {
    openResultModal('LIÊN KẾT', 'link', '<div class="xr-empty">Đang tải…</div>');
    const links = await loadPartnerLinks();
    if (!links.length) {
      openResultModal('LIÊN KẾT', 'link',
        '<div class="xr-empty">Chưa có liên kết.<br/><span style="opacity:0.7;font-size:0.8rem">Admin → Cài đặt → Liên kết</span></div>');
      return;
    }
    let html = '<div class="lk-grid">';
    links.forEach((L, i) => {
      const icon = iconForLink(L);
      const title = escapeHtml(L.title || ('Link ' + (i + 1)));
      const url = escapeHtml(L.url || '#');
      html += '<a class="lk-card" href="' + url + '" target="_blank" rel="noopener noreferrer">'
        + '<div class="lk-icon"><i data-lucide="' + escapeHtml(icon) + '"></i></div>'
        + '<div class="lk-body"><div class="lk-title">' + title + '</div>'
        + '<div class="lk-url">' + url + '</div></div>'
        + '<div class="lk-go"><i data-lucide="arrow-up-right"></i></div>'
        + '</a>';
    });
    html += '</div>';
    openResultModal('LIÊN KẾT', 'link', html);
    if (typeof lucide !== 'undefined') {
      try {
        const modal = document.getElementById('extras-result-modal');
        if (modal) lucide.createIcons({ nodes: Array.from(modal.querySelectorAll('[data-lucide]')) });
      } catch (e) {}
    }
  }

  // ----- Extras panel UI -----



  
  function formatListenDuration(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return h + ' giờ ' + m + ' phút' + (s > 0 ? ' ' + s + ' giây' : '');
    if (m > 0) return m + ' phút' + (s > 0 ? ' ' + s + ' giây' : '');
    return s + ' giây';
  }

  function sumListenTime(period) {
    const acc = getAcc();
    if (!acc || !acc.listenTime) return 0;
    const byDay = (acc.listenTime.byDay && typeof acc.listenTime.byDay === 'object') ? acc.listenTime.byDay : {};
    // Dùng chung logic với leaderboard
    return sumByDayPeriod(byDay, period);
  }

  /** Tổng nghe: ưu tiên max(total field, tổng byDay) — tránh số 0 sai khi total chưa sync */
  function getListenTotalSec() {
    const acc = getAcc();
    if (!acc || !acc.listenTime) return 0;
    const total = Number(acc.listenTime.total) || 0;
    const byDay = (acc.listenTime.byDay && typeof acc.listenTime.byDay === 'object') ? acc.listenTime.byDay : {};
    let sumDays = 0;
    Object.keys(byDay).forEach(k => { sumDays += Number(byDay[k]) || 0; });
    return Math.max(total, sumDays);
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
      stopCountdownTimer();
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

    const closeChatBtn = $('close-chat-btn');
    if (closeChatBtn && !closeChatBtn._xkBound) {
      closeChatBtn._xkBound = true;
      closeChatBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        closeChatModal();
      });
    }

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

    function topSongsByPeriod(period) {
      const songs = window.songs || [];
      const sorted = [...songs].sort((a, b) => (Number(b.listenCount) || 0) - (Number(a.listenCount) || 0));
      const top = sorted.slice(0, 10);
      // period chỉ còn alltime (và alias cũ week/month/year) — luôn là tổng lượt nghe
      let rows = '';
      if (!top.length) {
        rows = '<div class="xr-empty">Chưa có dữ liệu lượt nghe</div>';
      } else {
        top.forEach((s, i) => {
          const rankCls = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
          rows += '<div class="xr-row ' + rankCls + '">'
            + '<span class="xr-rank">' + (i + 1) + '</span>'
            + '<div class="xr-info"><div class="xr-name">' + escapeHtml(s.name || s.id) + '</div>'
            + '<div class="xr-sub">' + escapeHtml(s.artist || '') + '</div></div>'
            + '<span class="xr-val"><i data-lucide="headphones"></i> ' + (s.listenCount || 0) + '</span>'
            + '</div>';
        });
      }
      const body = '<div class="xr-note">Xếp theo tổng lượt nghe (mọi thời điểm)</div><div class="xr-list">' + rows + '</div>';
      openResultModal('TOP MỌI THỜI ĐIỂM', 'trophy', body);
    }

    function userReview(period) {
      const acc = getAcc();
      if (!acc) return toast('REVIEW', 'Cần đăng nhập', '#ff9800');
      const listened = acc.listenedSongs ? Object.keys(acc.listenedSongs).length : 0;
      const owned = (acc.owned || []).length;
      const labels = { week: 'REVIEW TUẦN', month: 'REVIEW THÁNG', year: 'REVIEW NĂM' };
      const icons = { week: 'calendar-days', month: 'calendar', year: 'calendar-range' };
      const rank = String(acc.rank || 'member').replace(/_/g, ' ').toUpperCase();
      const cards = [
        { icon: 'fa-solid fa-headphones', label: 'Bài đã nghe', val: listened },
        { icon: 'fa-solid fa-cart-shopping', label: 'Đã mua', val: owned },
        { icon: 'fa-solid fa-star', label: 'Level', val: (acc.level || 1) },
        { icon: 'fa-solid fa-bolt', label: 'XP', val: (acc.xp || 0) },
        { icon: 'fa-solid fa-fire', label: 'Season XP', val: (acc.seasonXp || 0) },
        { icon: 'fa-solid fa-calendar-check', label: 'Streak', val: (acc.streak || 0) }
      ];
      if (period === 'year') cards.push({ icon: 'fa-solid fa-crown', label: 'Hạng', val: rank });
      const grid = cards.map(c =>
        '<div class="xr-stat-card"><div class="xr-stat-icon">' + badgeIconHtml(c.icon) + '</div>'
        + '<div class="xr-stat-val">' + escapeHtml(String(c.val)) + '</div>'
        + '<div class="xr-stat-label">' + escapeHtml(c.label) + '</div></div>'
      ).join('');
      openResultModal(labels[period] || 'REVIEW', icons[period] || 'calendar', '<div class="xr-stat-grid">' + grid + '</div>');
    }

    function showListenTime(period) {
      const labels = { week: 'THỜI GIAN · TUẦN', month: 'THỜI GIAN · THÁNG', year: 'THỜI GIAN · NĂM' };
      const sub = { week: '7 ngày gần nhất (gồm hôm nay)', month: 'Tháng này', year: 'Năm nay' };
      const sec = sumListenTime(period);
      const total = getListenTotalSec();
      const body = '<div class="xr-time-wrap">'
        + '<div class="xr-time-card primary"><div class="xr-time-label">' + escapeHtml(sub[period] || '') + '</div>'
        + '<div class="xr-time-val">' + escapeHtml(formatListenDuration(sec)) + '</div></div>'
        + '<div class="xr-time-card"><div class="xr-time-label">Tổng mọi thời điểm</div>'
        + '<div class="xr-time-val">' + escapeHtml(formatListenDuration(total)) + '</div></div>'
        + '</div>';
      openResultModal(labels[period] || 'THỜI GIAN', 'clock', body);
    }

    panel.querySelectorAll('[data-x]').forEach(btn => {
      if (btn._xkBound) return;
      btn._xkBound = true;
      btn.onclick = () => {
        const x = btn.getAttribute('data-x');
        if (x === 'badges') { openBadgesModal(); return; }
        if (x === 'chat') { openChatModal(); return; }
        if (x === 'checkin') { openCheckinModal(); return; }
        if (x === 'countdown') { openEventCountdown(); return; }
        if (x === 'weekly-archive') { openWeeklyArchive(); return; }
        if (x === 'links') { openPartnerLinks(); return; }
        if (x === 'top-alltime' || x === 'top-week' || x === 'top-month' || x === 'top-year') {
          topSongsByPeriod('alltime');
        }
        if (x === 'rev-week') userReview('week');
        if (x === 'rev-month') userReview('month');
        if (x === 'rev-year') userReview('year');
        if (x === 'time-week' || x === 'time-month' || x === 'time-year') {
          showListenTime(x.replace('time-', ''));
        }
        if (x === 'lb-listen-week') showListenLeaderboard('week');
        if (x === 'lb-listen-month') showListenLeaderboard('month');
        if (x === 'lb-listen-year') showListenLeaderboard('year');
        if (x === 'lb-own-week') showOwnLeaderboard('week');
        if (x === 'lb-own-month') showOwnLeaderboard('month');
        if (x === 'lb-own-year') showOwnLeaderboard('year');
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
          const rankClass = String(rank || 'member').toLowerCase().replace(/\s+/g, '_');
          const rankLabel = String(rank || 'member').replace(/_/g, ' ').toUpperCase();
          const badge = '<span class="chat-badge ' + escapeHtml(rankClass) + '">' + escapeHtml(rankLabel) + '</span>';
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
          const uname = String(m.u || '?');
          return '<div class="chat-msg">'
            + '<div class="chat-msg-main">'
            + badge
            + '<button type="button" class="chat-user" data-chat-user="' + escapeHtml(uname) + '"'
            + (timeStr ? ' data-chat-time="' + escapeHtml(timeStr) + '"' : '')
            + ' title="Bấm để @tag và xem thời gian">' + escapeHtml(uname) + ':</button> '
            + '<span class="chat-text">' + text + '</span>'
            + '</div>'
            + (timeStr ? '<div class="chat-msg-time" hidden><i class="fa-regular fa-clock"></i> ' + escapeHtml(timeStr) + '</div>' : '')
            + '</div>';
        }).join('') || '<div style="opacity:.6">Chưa có tin nhắn</div>';
        box.querySelectorAll('.chat-user[data-chat-user]').forEach(btn => {
          btn.onclick = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const wrap = btn.closest('.chat-msg');
            const uname = btn.getAttribute('data-chat-user') || '';
            // Hiện / ẩn thời gian gửi
            const timeEl = wrap && wrap.querySelector('.chat-msg-time');
            if (timeEl) {
              const open = timeEl.hasAttribute('hidden');
              if (open) timeEl.removeAttribute('hidden');
              else timeEl.setAttribute('hidden', '');
              btn.classList.toggle('time-open', open);
            }
            // Chèn @username vào ô nhập (tag)
            if (uname && uname !== '?') {
              const input = $('global-chat-input');
              if (input) {
                const tag = '@' + uname;
                const cur = String(input.value || '');
                // Không chèn trùng nếu đã có tag đó ở cuối
                if (!new RegExp('@' + uname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(cur)) {
                  input.value = (cur.replace(/\s+$/, '') + (cur.trim() ? ' ' : '') + tag + ' ').replace(/^\s+/, '');
                }
                input.focus();
                try {
                  const len = input.value.length;
                  input.setSelectionRange(len, len);
                } catch (e) {}
              }
            }
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
      if (typeof updateCurrentAccount === 'function') {
        updateCurrentAccount(acc => {
          acc.chatCount = (Number(acc.chatCount) || 0) + 1;
        });
      }
      unlockAchievement('chat_first');
      if ((Number((getAcc() || {}).chatCount) || 0) >= 10) unlockAchievement('chat_10');
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
    autoNightMode();
    updateXpUi();
    checkAchievements();
    setTimeout(() => { try { recoverGiftAchievements(); } catch (e) {} }, 1500);
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
      }, 5000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 600));
  else setTimeout(boot, 600);

  window.xkExtras = {
    redeemGiftCode, applyInvite, unlockAchievement, checkAchievements, recoverGiftAchievements
  };
})();
