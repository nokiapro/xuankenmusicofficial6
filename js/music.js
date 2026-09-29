let shuffleHistory = [];
let remainingQueue = [];
let myPlaylistMode = false;
let myPlaylistQueue = [];
let currentShuffleCycle = [];
let index = 0;
let isPlaying = false;
let isShuffle = true;
let isRepeatOne = false;
let isChanging = false;
let lyrics = [];
let lastLyric = "";
let wakeLock = null;
let isLoopingHandled = false;
let listenInterval = null;
let songs = [];
let currentSource = 'play';
let autoRefreshInterval = null;
let notificationTimeout = null;
let isRefreshing = false;
let pendingPlayAfterLoad = false;
let hasUserInteracted = false;
let demoLockedSongId = null;
let lastListenFetch = 0;
const LISTEN_FETCH_INTERVAL = 15000;

const audio = document.getElementById('audio-player');
const playIcon = document.getElementById('play-icon');
const art = document.getElementById('current-art');
const lyricDisplay = document.getElementById('lyric-text');
const lyricContainer = document.getElementById('lyric-container');
const hint = document.getElementById('interaction-hint');
const shuffleBtn = document.getElementById('shuffle-btn');
const repeatBtn = document.getElementById('repeat-btn');
const playlistOverlay = document.getElementById('playlist');
const songTitleEl = document.getElementById('current-title');
const artistNameEl = document.getElementById('current-artist');

function isPcLayout() {
    return typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches;
}
function isPcPlaylistOpen() {
    const layout = document.querySelector('.pc-layout');
    return !!(layout && layout.classList.contains('playlist-open'));
}

let pcPlaylistPhase = 'idle';
let pcPlaylistTriggerIndex = -1;
let pcPlaylistNextIndex = -1;
let pcPlaylistAutoHideTimer = null;

function showPcPlaylist() {
    if (!isPcLayout() || !playlistOverlay) return;
    const layout = document.querySelector('.pc-layout');
    if (!layout) return;
    try {
        if (typeof renderPlaylist === 'function') renderPlaylist();
    } catch (e) {}
    playlistOverlay.classList.remove('element-out-right-blur');
    playlistOverlay.classList.add('active');
    layout.classList.add('playlist-open');
    void playlistOverlay.offsetWidth;
    playlistOverlay.classList.add('element-in-right-blur');
    if (typeof refreshModalIcons === 'function') refreshModalIcons(playlistOverlay);
    setTimeout(() => {
        try { if (typeof scrollToActiveTop === 'function') scrollToActiveTop('smooth'); } catch (e) {}
    }, 650);
}

function hidePcPlaylist() {
    if (!isPcLayout()) return;
    if (pcPlaylistAutoHideTimer) {
        clearTimeout(pcPlaylistAutoHideTimer);
        pcPlaylistAutoHideTimer = null;
    }
    const layout = document.querySelector('.pc-layout');
    if (!playlistOverlay || !layout) {
        if (layout) layout.classList.remove('playlist-open');
        pcPlaylistPhase = 'idle';
        pcPlaylistTriggerIndex = -1;
        pcPlaylistNextIndex = -1;
        return;
    }
    if (!layout.classList.contains('playlist-open') && !playlistOverlay.classList.contains('element-in-right-blur')) {
        pcPlaylistPhase = 'idle';
        pcPlaylistTriggerIndex = -1;
        pcPlaylistNextIndex = -1;
        return;
    }
    playlistOverlay.classList.remove('element-in-right-blur');
    void playlistOverlay.offsetWidth;
    playlistOverlay.classList.add('element-out-right-blur');
    let done = false;
    const onEnd = () => {
        if (done) return;
        done = true;
        playlistOverlay.removeEventListener('animationend', onEnd);
        playlistOverlay.classList.remove('element-out-right-blur', 'active');
        layout.classList.remove('playlist-open');
        pcPlaylistPhase = 'idle';
        pcPlaylistTriggerIndex = -1;
        pcPlaylistNextIndex = -1;
    };
    playlistOverlay.addEventListener('animationend', onEnd);
    setTimeout(onEnd, 700);
}

function ensurePcPlaylistOpen() {
}

function getDb() {
    return window.fbDB || (typeof firebase !== 'undefined' ? firebase.database() : null);
}

function getAuth() {
    return window.fbAuth || (typeof firebase !== 'undefined' && firebase.auth ? firebase.auth() : null);
}

function getCurrentUid() {
    const a = getAuth();
    if (!a || !a.currentUser || !a.currentUser.uid) return '';
    const email = String(a.currentUser.email || '').toLowerCase();
    if (email && !email.endsWith('@xuanken.user')) return '';
    return a.currentUser.uid;
}

function ensurePlayerAuthOnly() {
    try {
        const a = getAuth();
        if (!a || !a.currentUser) return;
        const email = String(a.currentUser.email || '').toLowerCase();
        if (email && !email.endsWith('@xuanken.user')) {
            console.warn('[player] signOut phiên admin còn sót trên default Auth:', email);
            a.signOut().catch(function () {});
        }
    } catch (e) {}
}

function usernameToEmail(username) {
    const key = sanitizeUsernameKey(username).toLowerCase();
    return key + '@xuanken.user';
}

function authErrorMessage(err) {
    const code = (err && err.code) || '';
    if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        return 'Sai username hoặc PIN';
    }
    if (code === 'auth/email-already-in-use') return 'Username đã được đăng ký';
    if (code === 'auth/weak-password') return 'PIN phải đủ 6 chữ số';
    if (code === 'auth/too-many-requests') return 'Thử quá nhiều lần — đợi vài phút';
    if (code === 'auth/network-request-failed') return 'Lỗi mạng — kiểm tra kết nối';
    if (code === 'auth/operation-not-allowed') return 'Chưa bật Email/Password trên Firebase Console';
    return (err && (err.message || err.code)) || 'Đăng nhập thất bại';
}

const STORAGE_ACCOUNTS = 'xuanken_accounts';
const STORAGE_CURRENT_USER = 'xuanken_current_user';
const STORAGE_ADMIN_SETTINGS = 'xuanken_admin_settings';
const STORAGE_SONG_PRICES = 'xuanken_song_prices';
const STORAGE_LISTENS = 'xuanken_listens';
const STORAGE_THEME = 'xuanken_theme';
const STORAGE_DEVICE_ID = 'xuanken_device_id';
const STORAGE_PIN_TRUST = 'xuanken_pin_trust';
const PIN_TRUST_MS = 7 * 24 * 60 * 60 * 1000;

const DEFAULT_ADMIN_SETTINGS = {
    siteName: 'XuanKen Music Official',
    siteTitle: 'XuanKen Music Official',
    siteIcon: 'https://raw.githubusercontent.com/nokiapro/xuankenofficial/main/icon.png',
    sitePrefix: 'music6',
    requirePin: true,
    allowRegister: true,
    maxRegistrations: 0,
    registrationCount: 0,
    siteBanner: '',
    flashSalePercent: 0,
    flashSaleUntil: '',
    inviteReward: 20
};

function getAdminSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_ADMIN_SETTINGS);
        if (!raw) return { ...DEFAULT_ADMIN_SETTINGS };
        return { ...DEFAULT_ADMIN_SETTINGS, ...JSON.parse(raw) };
    } catch (e) {
        return { ...DEFAULT_ADMIN_SETTINGS };
    }
}

function saveAdminSettings(settings) {
    localStorage.setItem(STORAGE_ADMIN_SETTINGS, JSON.stringify({ ...DEFAULT_ADMIN_SETTINGS, ...settings }));
}

function storageKey(base) {
    const p = String((getAdminSettings().sitePrefix || '')).trim().replace(/^\/+|\/+$/g, '');
    return p ? `${p}_${base}` : base;
}

function dataPath(key) {
    return String(key || '').replace(/^\/+|\/+$/g, '');
}

function applyBranding() {
    const s = getAdminSettings();
    const name = (s.siteName || DEFAULT_ADMIN_SETTINGS.siteName).trim() || DEFAULT_ADMIN_SETTINGS.siteName;
    const pageTitle = (s.siteTitle || name).trim() || name;
    const icon = (s.siteIcon || DEFAULT_ADMIN_SETTINGS.siteIcon).trim() || DEFAULT_ADMIN_SETTINGS.siteIcon;
    document.title = pageTitle;
    let fav = document.getElementById('site-favicon');
    if (!fav) {
        fav = document.querySelector('link[rel="shortcut icon"], link[rel="icon"]');
        if (fav) fav.id = 'site-favicon';
    }
    if (fav && icon) fav.href = icon;
    const hintTitle = document.querySelector('.hint-title');
    if (hintTitle && name) {
        hintTitle.textContent = name.length > 24 ? name.slice(0, 22) + '…' : name.toUpperCase();
    }
}

function setLucideIcon(container, iconName) {
    if (!container) return;
    container.innerHTML = `<i data-lucide="${iconName}"></i>`;
    if (typeof lucide !== 'undefined') {
        lucide.createIcons({ nodes: [container] });
    }
}

function refreshLucideIcons(container = document) {
    if (typeof lucide !== 'undefined') {
        const nodes = container.querySelectorAll ? Array.from(container.querySelectorAll('[data-lucide]')) : [container];
        if (nodes.length) lucide.createIcons({ nodes });
    }
}

let listenData = {};
let isUpdatingListen = false;
let hasRecordedCurrentSong = false;

function showPlayerLoading() {
    let loadingDiv = document.getElementById('player-loading');
    if (loadingDiv) return;
    
    const playerContainer = document.getElementById('player-container');
    if (!playerContainer) return;
    
    playerContainer.style.position = 'relative';
    
    loadingDiv = document.createElement('div');
    loadingDiv.id = 'player-loading';
    loadingDiv.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: var(--card-bg);
        backdrop-filter: blur(10px);
        border-radius: 32px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 200;
        transition: opacity 0.3s ease;
    `;
    loadingDiv.innerHTML = `
        <div style="width: 50px; height: 50px; border: 3px solid rgba(0,0,0,0.1); border-top: 3px solid var(--accent-color); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 15px;"></div>
        <div style="font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; color: var(--text-secondary);">ĐANG TẢI DỮ LIỆU...</div>
    `;
    playerContainer.appendChild(loadingDiv);
}

function hidePlayerLoading() {
    const loadingDiv = document.getElementById('player-loading');
    if (loadingDiv) {
        loadingDiv.style.opacity = '0';
        setTimeout(() => {
            if (loadingDiv && loadingDiv.parentNode) {
                loadingDiv.parentNode.removeChild(loadingDiv);
            }
        }, 300);
    }
}

function generateDataHash(data) {
    if (!data || !data.length) return null;
    return JSON.stringify(data.map(s => ({
        id: s.id,
        audio: s.audio || '',
        name: s.name || '',
        artist: s.artist || '',
        publishAt: s.publishAt || null,
        hidden: !!s.hidden
    })));
}

/** Cache link full (songFulls) — chỉ nạp khi user đã mua/thuê */
const fullAudioCache = Object.create(null);

function songsObjectToArray(obj) {
    if (!obj) return [];
    const list = Object.keys(obj).map(id => {
        const s = obj[id] || {};
        const sid = String(s.id || id);
        const cached = fullAudioCache[sid] || null;
        return {
            id: sid,
            _fbKey: String(id),
            name: s.name || id,
            artist: s.artist || '',
            audio: s.audio || '',
            // Không lấy audioFull từ node public songs — chỉ từ cache songFulls
            audioFull: (cached && cached.audioFull) || '',
            audioFull2: (cached && cached.audioFull2) || '',
            albumArt: s.albumArt || '',
            listenCount: Number(s.listenCount) || 0,
            lrc1: s.lrc1 || '',
            lrc2: s.lrc2 || '',
            price: s.price != null ? Number(s.price) : null,
            rentPrice: s.rentPrice != null ? Number(s.rentPrice) : null,
            publishAt: s.publishAt || null,
            hidden: !!s.hidden
        };
    }).filter(s => s.audio)
      .filter(s => !s.hidden)
      .filter(s => {
        if (!s.publishAt) return true;
        const t = Date.parse(s.publishAt);
        if (Number.isNaN(t)) return true;
        return Date.now() >= t;
      });
    list.sort((a, b) => {
        const na = String(a.name || '').localeCompare(String(b.name || ''), 'vi', { sensitivity: 'base' });
        if (na !== 0) return na;
        return String(a.id || '').localeCompare(String(b.id || ''), 'vi', { sensitivity: 'base' });
    });
    return list;
}

function applyFullCacheToSongs() {
    if (!Array.isArray(songs)) return;
    songs.forEach(s => {
        const f = fullAudioCache[String(s.id)];
        if (f) {
            s.audioFull = f.audioFull || '';
            s.audioFull2 = f.audioFull2 || '';
        }
    });
}

async function fetchSongFull(songId) {
    const id = String(songId || '');
    if (!id) return null;
    if (fullAudioCache[id] && (fullAudioCache[id].audioFull || fullAudioCache[id].audioFull2)) {
        return fullAudioCache[id];
    }
    const db = getDb();
    if (!db) return null;
    try {
        const snap = await db.ref(dataPath('songFulls') + '/' + id).once('value');
        const v = snap.val();
        if (v && (v.audioFull || v.audioFull2)) {
            fullAudioCache[id] = {
                audioFull: v.audioFull || '',
                audioFull2: v.audioFull2 || ''
            };
            return fullAudioCache[id];
        }
        // Legacy fallback: full còn nằm trong songs (trước khi migrate)
        const leg = await db.ref(dataPath('songs') + '/' + id).once('value');
        const ls = leg.val() || {};
        if (ls.audioFull || ls.audioFull2) {
            fullAudioCache[id] = {
                audioFull: ls.audioFull || '',
                audioFull2: ls.audioFull2 || ''
            };
            return fullAudioCache[id];
        }
    } catch (e) {
        console.warn('[songFulls] fetch', id, e && (e.code || e.message));
    }
    return null;
}

async function ensureFullAudioForOwned() {
    const ids = new Set();
    loadOwnedSongs().forEach(id => ids.add(String(id)));
    const acc = getCurrentAccount();
    if (acc && acc.rentals && typeof acc.rentals === 'object') {
        Object.keys(acc.rentals).forEach(id => {
            if (isSongRented(id)) ids.add(String(id));
        });
    }
    const list = [...ids];
    if (!list.length) return;
    await Promise.all(list.map(id => fetchSongFull(id)));
    applyFullCacheToSongs();
}

function getFullAudioCandidates(song) {
    if (!song) return [];
    const id = String(song.id || '');
    const cached = fullAudioCache[id];
    const list = [];
    const a1 = (song.audioFull || (cached && cached.audioFull) || '');
    const a2 = (song.audioFull2 || (cached && cached.audioFull2) || '');
    if (a1) list.push(a1);
    if (a2) list.push(a2);
    return list.filter(Boolean);
}

function normalizeAudioUrl(u) {
    if (!u) return '';
    try {
        const url = new URL(u, (typeof location !== 'undefined' ? location.href : 'https://local/'));
        url.hash = '';
        return url.href;
    } catch (e) {
        return String(u);
    }
}

function isSameAudioSrc(a, b) {
    if (!a || !b) return false;
    return normalizeAudioUrl(a) === normalizeAudioUrl(b);
}

function pickFullAudioUrl(song, preferOtherThan) {
    const cands = getFullAudioCandidates(song);
    if (!cands.length) return song.audio || '';
    if (preferOtherThan) {
        const pref = normalizeAudioUrl(preferOtherThan);
        const alt = cands.find(u => normalizeAudioUrl(u) !== pref);
        if (alt) return alt;
    }
    if (cands.length === 1) return cands[0];
    return cands[Math.floor(Math.random() * cands.length)];
}

function getPlayableAudio(song) {
    if (!song) return '';
    if (isSongOwned(song.id)) {
        const cands = getFullAudioCandidates(song);
        if (!cands.length) return song.audio || '';
        const id = String(song.id);
        const sticky = lastTriedFullUrl[id];
        if (sticky && cands.some(c => isSameAudioSrc(c, sticky))) {
            return sticky;
        }
        if (typeof audio !== 'undefined' && audio && audio.src) {
            const match = cands.find(c => isSameAudioSrc(audio.src, c));
            if (match) {
                lastTriedFullUrl[id] = match;
                return match;
            }
        }
        const picked = pickFullAudioUrl(song);
        if (picked) lastTriedFullUrl[id] = picked;
        return picked || song.audio || '';
    }
    return song.audio || '';
}

let lastTriedFullUrl = {};
let preloadAudioEl = null;

async function fetchSongsFromFirebase() {
    const db = getDb();
    if (!db) throw new Error('Firebase chưa sẵn sàng');
    const snap = await db.ref(dataPath('songs')).once('value');
    return songsObjectToArray(snap.val());
}

async function checkForUpdates() {
    if (isRefreshing || !songs.length) return;
    
    try {
        isRefreshing = true;
        const newSongs = await fetchSongsFromFirebase();
        if (!newSongs.length) return;
        
        const newHash = generateDataHash(newSongs);
        
        if (lastDataHash !== null && lastDataHash !== newHash) {
            console.log("PHÁT HIỆN THAY ĐỔI DỮ LIỆU (Firebase)...");
            
            const oldSongs = songs.slice();
            const oldSongIds = new Set(oldSongs.map(s => s.id));
            const addedSongs = newSongs.filter(s => {
                if (oldSongIds.has(s.id)) return false;
                if (notifiedNewSongIds.has(s.id)) return false;
                notifiedNewSongIds.add(s.id);
                return true;
            });
            newSongs.forEach(s => { if (oldSongIds.has(s.id)) notifiedNewSongIds.add(s.id); });
            
            const currentSongId = oldSongs[index]?.id;
            
            const remapIdx = (oldIdx) => {
                const id = oldSongs[oldIdx]?.id;
                if (!id) return -1;
                return newSongs.findIndex(s => s.id === id);
            };
            const remapList = (arr) => arr.map(remapIdx).filter(i => i >= 0);
            
            const oldShuffleHistory = [...shuffleHistory];
            const oldRemainingQueue = [...remainingQueue];
            const oldCurrentShuffleCycle = [...currentShuffleCycle];
            const oldIsShuffle = isShuffle;
            
            songs = newSongs;
            lastDataHash = newHash;
            
            listenData = {};
            songs.forEach(song => {
                listenData[song.id] = song.listenCount || 0;
            });
            
            const newIndex = currentSongId
                ? songs.findIndex(s => s.id === currentSongId)
                : -1;
            if (newIndex !== -1) {
                index = newIndex;
                if (songTitleEl && songs[index]) {
                    songTitleEl.innerText = songs[index].name;
                    applyGradientToSongTitle();
                }
                if (artistNameEl && songs[index]) {
                    artistNameEl.innerText = songs[index].artist || "ĐANG CẬP NHẬT";
                    applyGradientToArtistName();
                }
                autoScaleSongTitle();
                updateArtImage();
            } else if (songs.length) {
                index = Math.min(index, songs.length - 1);
            }
            
            if (oldIsShuffle) {
                shuffleHistory = remapList(oldShuffleHistory);
                remainingQueue = remapList(oldRemainingQueue);
                currentShuffleCycle = remapList(oldCurrentShuffleCycle);
                if (!remainingQueue.length && songs.length) {
                    resetShuffleState(index);
                }
            }
            
            renderPlaylist();
            updateListenStatsModal();
            
            if (addedSongs.length > 0) {
                addedSongs.forEach(song => {
                    const sid = song.id || '';
                    const wasScheduled = song.publishAt && Date.parse(song.publishAt) <= Date.now();
                    const head = wasScheduled ? 'ADMIN ĐÃ ĐĂNG BÀI MỚI:' : 'BÀI HÁT MỚI:';
                    showNotification(
                        head,
                        '<i class="fa-regular fa-star"></i> ' + sid + ' <i class="fa-regular fa-star"></i>',
                        '#4ade80',
                        'sparkles'
                    );
                });
            }
        }
        
        await fetchListenDataSilent();
        
    } catch (error) {
        console.error("LỖI KIỂM TRA CẬP NHẬT:", error);
    } finally {
        isRefreshing = false;
    }
}

async function fetchListenDataSilent() {
    if (isUpdatingListen) return listenData;
    
    const now = Date.now();
    if (now - lastListenFetch < LISTEN_FETCH_INTERVAL) return listenData;
    lastListenFetch = now;
    
    try {
        const list = await fetchSongsFromFirebase();
        let hasChange = false;
        list.forEach(s => {
            const newCount = s.listenCount || 0;
            listenData[s.id] = newCount;
            const local = songs.find(x => x.id === s.id);
            if (local && local.listenCount !== newCount) {
                local.listenCount = newCount;
                hasChange = true;
            }
        });
        if (hasChange) {
            updateListenStatsModal();
            localStorage.setItem(storageKey(STORAGE_LISTENS), JSON.stringify(listenData));
        }
        return listenData;
    } catch (error) {
        console.log('Firebase listen error, using local data');
        const saved = localStorage.getItem(storageKey(STORAGE_LISTENS));
        if (saved) {
            try { listenData = JSON.parse(saved); } catch (e) {}
            updateListenStatsModal();
        }
    }
    return listenData;
}

let publishCheckTimer = null;
let songsRealtimeBound = false;
let notifiedNewSongIds = new Set();

function startAutoRefresh(intervalSeconds = 60) {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    setTimeout(() => checkForUpdates(), 3000);
    autoRefreshInterval = setInterval(checkForUpdates, Math.min(intervalSeconds, 15) * 1000);
    console.log('ĐÃ BẬT TỰ ĐỘNG CẬP NHẬT + lịch đăng bài');
    startSongsRealtimeListener();
    scheduleNextPublishUnlock();
}

async function fetchSongsRawFromFirebase() {
    const db = getDb();
    if (!db) return [];
    const snap = await db.ref(dataPath('songs')).once('value');
    const obj = snap.val() || {};
    return Object.keys(obj).map(id => {
        const s = obj[id] || {};
        return {
            id: String(s.id || id),
            name: s.name || id,
            publishAt: s.publishAt || null,
            hidden: !!s.hidden,
            audio: s.audio || ''
        };
    }).filter(s => s.audio && !s.hidden);
}

async function scheduleNextPublishUnlock() {
    if (publishCheckTimer) {
        clearTimeout(publishCheckTimer);
        publishCheckTimer = null;
    }
    try {
        const raw = await fetchSongsRawFromFirebase();
        const now = Date.now();
        let nextAt = null;
        raw.forEach(s => {
            if (!s.publishAt) return;
            const t = Date.parse(s.publishAt);
            if (Number.isNaN(t) || t <= now) return;
            if (nextAt == null || t < nextAt) nextAt = t;
        });
        if (nextAt == null) return;
        const wait = Math.max(500, Math.min(nextAt - now + 300, 24 * 3600 * 1000));
        publishCheckTimer = setTimeout(async () => {
            await checkForUpdates();
            scheduleNextPublishUnlock();
        }, wait);
        console.log('Hẹn mở bài mới sau', Math.round(wait / 1000), 'giây');
    } catch (e) {
        console.warn('scheduleNextPublishUnlock', e);
    }
}

function startSongsRealtimeListener() {
    if (songsRealtimeBound) return;
    const db = getDb();
    if (!db) return;
    songsRealtimeBound = true;
    const path = dataPath('songs');
    let ready = false;
    let debounceTimer = null;
    const onChange = () => {
        if (!ready) return;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            checkForUpdates();
            scheduleNextPublishUnlock();
        }, 400);
    };
    try {
        db.ref(path).on('child_added', onChange);
        db.ref(path).on('child_changed', onChange);
        db.ref(path).on('child_removed', onChange);
        setTimeout(() => { ready = true; }, 1500);
    } catch (e) {
        console.warn('songs realtime', e);
        songsRealtimeBound = false;
    }
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

if (!Array.prototype.findLast) {
    Array.prototype.findLast = function(predicate) {
        for (let i = this.length - 1; i >= 0; i--) {
            if (predicate(this[i], i, this)) return this[i];
        }
        return undefined;
    };
}

async function loadSongsFromFirebase() {
    try {
        const list = await fetchSongsFromFirebase();
        
        if (list && list.length > 0) {
            songs = list;
            lastDataHash = generateDataHash(songs);
            notifiedNewSongIds = new Set(songs.map(s => s.id));
            
            listenData = {};
            songs.forEach(song => {
                listenData[song.id] = song.listenCount || 0;
            });
            
            console.log(`ĐÃ TẢI ${songs.length} BÀI HÁT TỪ FIREBASE`);
            try { scrubOwnedAgainstCatalog(); } catch (e) {}
            try { await ensureFullAudioForOwned(); } catch (e) { console.warn('ensureFullAudioForOwned', e); }
            initPlayerAfterLoad();
            updateListenStatsModal();
            
            startAutoRefresh(60);
            
            if (pendingPlayAfterLoad) {
                pendingPlayAfterLoad = false;
                startPlayback();
            }
        } else {
            console.warn('Firebase chưa có bài hát — thêm bài trong Admin');
            songs = [];
            isLoadingSongs = false;
            hidePlayerLoading();
            showToastMsg('CHƯA CÓ BÀI HÁT — VÀO ADMIN THÊM BÀI', false);
        }
        
    } catch (error) {
        console.error("LỖI TẢI DỮ LIỆU FIREBASE:", error);
        showToastMsg("KHÔNG THỂ TẢI DỮ LIỆU!", false);
        songs = [];
        isLoadingSongs = false;
        hidePlayerLoading();
    }
}

const loadSongsFromSheet = loadSongsFromFirebase;

function updateArtImage() {
    if (!art || !songs[index]) return;
    const song = songs[index];
    const albumArt = song.albumArt || 'https://raw.githubusercontent.com/nokiapro/xuankenofficial/main/logoofficial.png';
    art.src = albumArt;
    art.alt = song.artist || "Ca sĩ";
}

function initPlayerAfterLoad() {
    if (!songs.length) return;
    
    isLoadingSongs = false;
    
    const initIdx = getInitialShuffleIndex();
    index = initIdx;
    
    const playerContainer = document.getElementById('player-container');
    if (playerContainer) playerContainer.style.display = 'none';
    
    if (hint) {
        hint.classList.remove('hide');
        hint.style.display = 'flex';
        hint.style.opacity = '1';
        hint.style.visibility = 'visible';
        hint.style.pointerEvents = 'auto';
    }
    
    isShuffle = true;
    if (shuffleBtn) {
        shuffleBtn.classList.add('active');
    }
    
    loadSongInfoOnly(index);
    renderPlaylist();
}

function loadSongInfoOnly(i) {
    if (!songs[i]) return;
    
    index = i;
    const song = songs[index];
    
    if (songTitleEl) {
        songTitleEl.innerText = song.name;
        applyGradientToSongTitle();
    }
    if (artistNameEl) {
        artistNameEl.innerText = song.artist || "ĐANG CẬP NHẬT";
        applyGradientToArtistName();
    }
    
    updateArtImage();
    autoScaleSongTitle();
    
    const colors = getRandomPastel();
    document.documentElement.style.setProperty('--bg-color', colors.bg);
    document.documentElement.style.setProperty('--accent-color', colors.accent);
    
    fetchLyricWithFallback(song.lrc1, song.lrc2).then(lyricData => {
        lyrics = lyricData || [];
        if (lyrics.length === 0) {
            adjustLyricFontSize("BÀI HÁT TẠM CHƯA CÓ LYRIC NHA HIHI");
        } else {
            adjustLyricFontSize("NHẤN PLAY ĐỂ NGHE NHẠC");
        }
    }).catch(e => {
        console.error("LỖI TẢI LYRIC:", e);
        lyrics = [];
        adjustLyricFontSize("BÀI HÁT TẠM CHƯA CÓ LYRIC NHA HIHI");
    });
    
    renderPlaylist();
    updateMediaSession();
}

function getGradientByTheme() {
    const isDarkMode = document.body.classList.contains('dark');
    if (isDarkMode) {
        return 'linear-gradient(135deg, #ffd89b, #c7e9fb)';
    } else {
        return 'linear-gradient(135deg, #ff0040, #8c00ff, #ff0040)';
    }
}

function getArtistGradientByTheme() {
    const isDarkMode = document.body.classList.contains('dark');
    if (isDarkMode) {
        return 'linear-gradient(135deg, #fbc2eb, #a6c1ee)';
    } else {
        return 'linear-gradient(135deg, #f5af19, #f12711, #f5af19)';
    }
}

function autoScaleNotificationMessage() {
    const noti = document.getElementById('custom-notification');
    if (!noti || !noti.classList.contains('show')) return;

    const content = noti.querySelector('.notification-content');
    const msgEl = noti.querySelector('.notification-message');
    if (!content || !msgEl) return;

    content.classList.remove('is-marquee');
    content.style.maxWidth = '';
    content.style.transform = 'none';

    const targetElement = msgEl.querySelector('span') || msgEl;
    targetElement.style.transform = 'none';

    const isMobile = window.innerWidth <= 768;
    const isSmallMobile = window.innerWidth <= 480;
    let paddingReduce = 15;
    if (isSmallMobile) paddingReduce = 25;
    else if (isMobile) paddingReduce = 20;

    const containerWidth = content.clientWidth || Math.min(window.innerWidth * 0.9, 520);
    const textWidth = targetElement.scrollWidth || msgEl.scrollWidth;

    if (textWidth > containerWidth - paddingReduce) {
        let scale = (containerWidth - paddingReduce) / textWidth;
        const minScale = isSmallMobile ? 0.75 : (isMobile ? 0.7 : 0.5);
        scale = scale * 0.95;
        const finalScale = Math.max(scale, minScale);
        targetElement.style.transform = 'scale(' + finalScale + ')';
        targetElement.style.transformOrigin = 'left center';
    } else {
        targetElement.style.transform = 'none';
    }
}

function forceScaleNotification() {
    autoScaleNotificationMessage();
    setTimeout(() => autoScaleNotificationMessage(), 40);
    setTimeout(() => autoScaleNotificationMessage(), 120);
}

function hideNotification() {
    const noti = document.getElementById('custom-notification');
    if (noti) noti.classList.remove('show');
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        notificationTimeout = null;
    }
}

function showNotification(title, message, color = "#4ade80", icon = "headphones") {
    const noti = document.getElementById('custom-notification');
    if (!noti) return;

    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        notificationTimeout = null;
    }

    noti.style.borderBottomColor = color;

    const iconContainer = noti.querySelector('.notification-icon');
    if (iconContainer) {
        const iconMap = {
            'fa-headphones': 'headphones',
            'headphones': 'headphones',
            'fa-plus-circle': 'plus-circle',
            'fa-music': 'music',
            'fa-circle-exclamation': 'alert-circle',
            'fa-circle-info': 'info',
            'fa-circle-notch': 'loader',
            'fa-random': 'shuffle',
            'fa-list': 'list',
            'fa-repeat-1': 'repeat-1',
            'fa-repeat': 'repeat',
            'fa-trash-alt': 'trash-2',
            'fa-bell': 'bell',
            'fa-stopwatch': 'timer',
            'fa-sun': 'sun',
            'fa-moon': 'moon'
        };
        const lucideName = iconMap[icon] || String(icon || 'headphones').replace(/^fa-/, '');
        iconContainer.innerHTML = '<i data-lucide="' + lucideName + '"></i>';
        if (typeof lucide !== 'undefined') {
            try { lucide.createIcons({ nodes: [iconContainer] }); } catch (e) {}
        }
        const svg = iconContainer.querySelector('svg');
        if (svg) svg.style.color = color;
        const iEl = iconContainer.querySelector('i');
        if (iEl) iEl.style.color = color;
    }

    let formattedMessage = message;
    if (typeof message === 'string' && !message.includes('<span')) {
        const gradient = (typeof getGradientByTheme === 'function') ? getGradientByTheme() : 'linear-gradient(90deg,#fff,#a78bfa,#fff)';
        formattedMessage = '<span style="font-weight:700;background:' + gradient + ';-webkit-background-clip:text;background-clip:text;color:transparent;letter-spacing:0.5px;font-size:inherit;display:inline-block;white-space:nowrap;">' + message + '</span>';
    }

    const content = noti.querySelector('.notification-content');
    if (content) {
        content.classList.remove('is-marquee');
        let titleEl = content.querySelector('.notification-title');
        let msgEl = content.querySelector('.notification-message');
        if (!titleEl || !msgEl || content.querySelector('.notification-content-inner')) {
            content.innerHTML = '<div class="notification-title"></div><div class="notification-message"></div>';
            titleEl = content.querySelector('.notification-title');
            msgEl = content.querySelector('.notification-message');
        }
        if (titleEl) titleEl.innerHTML = title;
        if (msgEl) msgEl.innerHTML = formattedMessage;
    }

    noti.classList.remove('show');
    void noti.offsetHeight;
    noti.classList.add('show');
    forceScaleNotification();

    notificationTimeout = setTimeout(() => {
        noti.classList.remove('show');
        notificationTimeout = null;
    }, 10000);
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const noti = document.getElementById('custom-notification');
    if (!noti || !noti.classList.contains('show')) return;
    if (notificationTimeout) clearTimeout(notificationTimeout);
    notificationTimeout = setTimeout(() => {
        noti.classList.remove('show');
        notificationTimeout = null;
    }, 1500);
});

function showToastMsg(msg, isListen = false) {
    if (isListen) {
        const match = msg.match(/\+1 LISTEN: "(.+)" \((.+)\)/);
        if (match) {
            const songId = match[2] || match[1];
            showNotification('+1 LISTEN:', '<i class="fa-regular fa-star"></i> ' + songId + ' <i class="fa-regular fa-star"></i>', '#4ade80', 'fa-headphones');
        } else {
            showNotification('THÔNG BÁO:', msg, '#4ade80', 'info');
        }
    } else {
        showNotification('THÔNG BÁO:', msg, 'var(--accent-color)', 'info');
    }
}

async function fetchListenData() {
    return fetchListenDataSilent();
}

let _lastListenTickAt = 0;
let _listenTimeDirty = false;
function mergeListenTimeObj(a, b) {
    const out = { total: 0, byDay: Object.create(null) };
    const apply = (src) => {
        if (!src || typeof src !== 'object') return;
        const bd = (src.byDay && typeof src.byDay === 'object') ? src.byDay : {};
        Object.keys(bd).forEach(k => {
            const n = Number(bd[k]) || 0;
            out.byDay[k] = Math.max(Number(out.byDay[k]) || 0, n);
        });
        out.total = Math.max(Number(out.total) || 0, Number(src.total) || 0);
    };
    apply(a);
    apply(b);
    let sumDays = 0;
    Object.keys(out.byDay).forEach(k => { sumDays += Number(out.byDay[k]) || 0; });
    out.total = Math.max(Number(out.total) || 0, sumDays);
    return out;
}
function flushListenTimeToFirebase(force) {
    try {
        if (!force && !_listenTimeDirty) return Promise.resolve(false);
        if (typeof getCurrentUsername !== 'function' || !getCurrentUsername()) return Promise.resolve(false);
        const db = typeof getDb === 'function' ? getDb() : null;
        const name = getCurrentUsername();
        const accounts = typeof getAllAccounts === 'function' ? getAllAccounts() : null;
        const acc = (accounts && accounts[name]) || (typeof getCurrentAccount === 'function' ? getCurrentAccount() : null);
        if (!db || !acc || !acc.listenTime) return Promise.resolve(false);
        const uid = (typeof getCurrentUid === 'function' && getCurrentUid()) || acc.uid || '';
        if (!uid) return Promise.resolve(false);
        const local = mergeListenTimeObj(null, acc.listenTime);
        return db.ref(dataPath('users') + '/' + uid + '/listenTime').transaction((current) => {
            return mergeListenTimeObj(current, local);
        }).then((tx) => {
            if (tx && tx.committed && tx.snapshot) {
                const merged = mergeListenTimeObj(tx.snapshot.val(), local);
                acc.listenTime = merged;
                if (accounts && accounts[name]) {
                    accounts[name].listenTime = merged;
                    if (typeof saveAllAccounts === 'function') saveAllAccounts(accounts);
                }
            }
            _listenTimeDirty = false;
            window._listenTimeSyncAt = Date.now();
            return true;
        }).catch(() => false);
    } catch (e) {
        return Promise.resolve(false);
    }
}

function persistListenTimeNow() {
    try {
        if (_lastListenTickAt > 0) {
            const d = (Date.now() - _lastListenTickAt) / 1000;
            if (d > 0 && d <= 8) recordListenSeconds(d);
            if (typeof audio !== 'undefined' && audio && !audio.paused) {
                _lastListenTickAt = Date.now();
            } else {
                _lastListenTickAt = 0;
            }
        }
        try {
            const name = typeof getCurrentUsername === 'function' && getCurrentUsername();
            if (name && typeof getAllAccounts === 'function' && typeof saveAllAccounts === 'function') {
                saveAllAccounts(getAllAccounts());
                window._listenLocalSaveAt = Date.now();
            }
        } catch (e) {}
        return flushListenTimeToFirebase(true);
    } catch (e) {
        return Promise.resolve(false);
    }
}
window.persistListenTimeNow = persistListenTimeNow;
window.flushListenTimeToFirebase = flushListenTimeToFirebase;

function recordListenSeconds(deltaSec) {
    if (!deltaSec || deltaSec <= 0 || deltaSec > 8) return;
    if (typeof getCurrentUsername !== 'function' || !getCurrentUsername()) return;
    const name = getCurrentUsername();
    if (!name) return;
    const accounts = typeof getAllAccounts === 'function' ? getAllAccounts() : null;
    if (!accounts || !accounts[name]) return;
    const acc = accounts[name];
    if (!acc.listenTime || typeof acc.listenTime !== 'object') acc.listenTime = { total: 0, byDay: {} };
    if (!acc.listenTime.byDay || typeof acc.listenTime.byDay !== 'object') acc.listenTime.byDay = {};
    const day = (typeof getTodayKey === 'function') ? getTodayKey() : (() => {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    })();
    const add = Number(deltaSec) || 0;
    acc.listenTime.byDay[day] = (Number(acc.listenTime.byDay[day]) || 0) + add;
    acc.listenTime.total = (Number(acc.listenTime.total) || 0) + add;
    if (!window._listenLocalSaveAt) window._listenLocalSaveAt = 0;
    if (Date.now() - window._listenLocalSaveAt > 3000) {
        if (typeof saveAllAccounts === 'function') saveAllAccounts(accounts);
        window._listenLocalSaveAt = Date.now();
    } else {
        try { accounts[name] = acc; } catch (e) {}
    }

    window._sessionListenSec = (Number(window._sessionListenSec) || 0) + add;
    if (window._sessionListenSec >= 3600 && window.xkExtras && typeof window.xkExtras.unlockAchievement === 'function') {
        window.xkExtras.unlockAchievement('marathon');
    }
    _listenTimeDirty = true;
    if (!window._listenTimeSyncAt) window._listenTimeSyncAt = 0;
    if (Date.now() - window._listenTimeSyncAt > 15000) {
        if (typeof saveAllAccounts === 'function') saveAllAccounts(accounts);
        window._listenLocalSaveAt = Date.now();
        flushListenTimeToFirebase(true);
    }
}

setInterval(() => {
    try {
        if (typeof audio === 'undefined' || !audio || audio.paused) {
            if (_lastListenTickAt > 0) {
                const d = (Date.now() - _lastListenTickAt) / 1000;
                if (d > 0 && d <= 8) recordListenSeconds(d);
                _lastListenTickAt = 0;
            }
            return;
        }
        if (typeof hasUserInteracted !== 'undefined' && !hasUserInteracted) return;
        if (!songs || !songs[index]) return;
        const now = Date.now();
        if (_lastListenTickAt > 0) {
            const d = (now - _lastListenTickAt) / 1000;
            if (d > 0 && d <= 8) recordListenSeconds(d);
        }
        _lastListenTickAt = now;
    } catch (e) {}
}, 1000);

function withTimeout(promise, ms, label) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout ' + (label || ''))), ms))
    ]);
}

function getWeekOfMonthKey(date) {
    const d = date ? new Date(date) : new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const w = Math.max(1, Math.ceil(d.getDate() / 7));
    return y + '-' + m + '-W' + w;
}
function getWeekOfMonthRange(key) {
    const match = String(key || '').match(/^(\d{4})-(\d{2})-W(\d+)$/);
    if (!match) return null;
    const y = Number(match[1]);
    const m = Number(match[2]);
    const w = Number(match[3]);
    if (!y || !m || !w) return null;
    const lastDay = new Date(y, m, 0).getDate();
    const startDay = Math.min((w - 1) * 7 + 1, lastDay);
    const endDay = Math.min(w * 7, lastDay);
    return { y, m, w, startDay, endDay };
}
function formatWeekDateVN(y, m, d) {
    return String(d).padStart(2, '0') + '/' + String(m).padStart(2, '0') + '/' + y;
}
function weekOfMonthLabel(key) {
    const r = getWeekOfMonthRange(key);
    if (!r) return String(key || '');
    return 'Tuần ' + r.w + ' · ' + formatWeekDateVN(r.y, r.m, r.startDay) + ' – ' + formatWeekDateVN(r.y, r.m, r.endDay);
}
function weekOfMonthDateRange(key) {
    const r = getWeekOfMonthRange(key);
    if (!r) return '';
    const sameYearMonth = true;
    return formatWeekDateVN(r.y, r.m, r.startDay) + ' – ' + formatWeekDateVN(r.y, r.m, r.endDay);
}
window.getWeekOfMonthKey = getWeekOfMonthKey;
window.getWeekOfMonthRange = getWeekOfMonthRange;
window.weekOfMonthLabel = weekOfMonthLabel;
window.weekOfMonthDateRange = weekOfMonthDateRange;

async function incrementListenCount(songId, songName, source = 'normal') {
    if (!songId || isUpdatingListen) return false;
    const sid = String(songId);
    const user = (typeof getCurrentUsername === 'function' && getCurrentUsername()) || '';

    isUpdatingListen = true;
    try {
        if (!listenData[sid]) listenData[sid] = 0;
        listenData[sid]++;
        const songIndex = songs.findIndex(s => String(s.id) === sid);
        if (songIndex !== -1) songs[songIndex].listenCount = listenData[sid];
        try { localStorage.setItem(storageKey(STORAGE_LISTENS), JSON.stringify(listenData)); } catch (e) {}
        try { updateListenStatsModal(); } catch (e) {}
        try { if (typeof renderPlaylist === 'function') renderPlaylist(); } catch (e) {}

        try {
            showNotification(
                '+1 LISTEN:',
                '<i class="fa-regular fa-star"></i> ' + sid + ' <i class="fa-regular fa-star"></i>',
                '#4ade80',
                'fa-headphones'
            );
        } catch (e) {
            console.warn('toast listen fail', e);
        }
        console.log('GHI NHẬN LƯỢT NGHE:', songName, sid, '→', listenData[sid], source, user || '(no-user)');

        if (user) {
            try {
                updateCurrentAccount(acc => {
                    if (!acc.listenedSongs || typeof acc.listenedSongs !== 'object') acc.listenedSongs = {};
                    acc.listenedSongs[sid] = Date.now();
                    acc.xp = (Number(acc.xp) || 0) + 5;
                    acc.seasonXp = (Number(acc.seasonXp) || 0) + 5;
                    acc.level = Math.max(1, Math.floor((Number(acc.xp) || 0) / 100) + 1);
                });
            } catch (e) {}
        }

        const db = getDb();
        if (db) {
            const path = dataPath('songs') + '/' + sid + '/listenCount';
            let serverCount = listenData[sid];
            let wrote = false;
            try {
                const result = await withTimeout(
                    db.ref(path).transaction(current => (Number(current) || 0) + 1),
                    8000,
                    'listenCount-tx'
                );
                if (result && result.committed) {
                    serverCount = Number(result.snapshot.val()) || serverCount;
                    wrote = true;
                }
            } catch (e) {
                console.warn('listenCount tx fail', e && (e.code || e.message));
            }
            if (!wrote) {
                try {
                    const snap = await withTimeout(db.ref(path).once('value'), 5000, 'listenCount-read');
                    const next = (Number(snap.val()) || 0) + 1;
                    await withTimeout(db.ref(path).set(next), 5000, 'listenCount-set');
                    serverCount = next;
                    wrote = true;
                } catch (e2) {
                    console.warn('listenCount set fail', e2 && (e2.code || e2.message));
                }
            }
            if (wrote) {
                listenData[sid] = serverCount;
                if (songIndex !== -1) songs[songIndex].listenCount = serverCount;
                try { localStorage.setItem(storageKey(STORAGE_LISTENS), JSON.stringify(listenData)); } catch (e) {}
                try { updateListenStatsModal(); } catch (e) {}
                try { if (typeof renderPlaylist === 'function') renderPlaylist(); } catch (e) {}
                try {
                    const wk = (typeof getWeekOfMonthKey === 'function')
                        ? getWeekOfMonthKey()
                        : (function () {
                            const now = new Date();
                            const y = now.getFullYear();
                            const m = String(now.getMonth() + 1).padStart(2, '0');
                            const w = Math.ceil(now.getDate() / 7);
                            return y + '-' + m + '-W' + w;
                        })();
                    const wPath = (typeof dataPath === 'function' ? dataPath('weeklyListens') : 'weeklyListens') + '/' + wk + '/' + sid;
                    db.ref(wPath).transaction(c => (Number(c) || 0) + 1).catch(() => {});
                    const metaPath = (typeof dataPath === 'function' ? dataPath('weeklyListensMeta') : 'weeklyListensMeta') + '/' + wk;
                    const range = (typeof getWeekOfMonthRange === 'function') ? getWeekOfMonthRange(wk) : null;
                    const metaUpdate = {
                        key: wk,
                        label: (typeof weekOfMonthLabel === 'function') ? weekOfMonthLabel(wk) : wk,
                        updatedAt: Date.now()
                    };
                    if (range) {
                        metaUpdate.dateFrom = formatWeekDateVN(range.y, range.m, range.startDay);
                        metaUpdate.dateTo = formatWeekDateVN(range.y, range.m, range.endDay);
                        metaUpdate.startDay = range.startDay;
                        metaUpdate.endDay = range.endDay;
                    }
                    db.ref(metaPath).update(metaUpdate).catch(() => {});
                } catch (eW) { console.warn('weeklyListens', eW); }
            } else {
                console.warn('listenCount: Firebase chưa ghi được — đã lưu local + toast');
            }

            const uid = getCurrentUid() || (getCurrentAccount() && getCurrentAccount().uid) || '';
            if (uid) {
                try {
                    await withTimeout(
                        db.ref(dataPath('users') + '/' + uid + '/listenedSongs/' + sid).set(Date.now()),
                        5000,
                        'user-listened'
                    );
                    const acc2 = getCurrentAccount();
                    if (acc2) {
                        await withTimeout(
                            db.ref(dataPath('users') + '/' + uid).update({
                                xp: Number(acc2.xp) || 0,
                                seasonXp: Number(acc2.seasonXp) || 0,
                                level: Number(acc2.level) || 1
                            }),
                            5000,
                            'user-xp'
                        );
                    }
                } catch (ue) {
                    console.warn('user listen/xp write fail', ue && (ue.code || ue.message));
                }
            }
        }

        if (typeof window.onListenCounted === 'function') {
            try { window.onListenCounted(sid); } catch (e) {}
        }
        return true;
    } catch (error) {
        console.error('LỖI TĂNG LƯỢT NGHE:', error);
        return false;
    } finally {
        isUpdatingListen = false;
    }
}

function updateListenStatsModal() {
    const container = document.getElementById('listen-stats-content');
    const totalContainer = document.getElementById('listen-total-stats');
    if (!container) return;
    
    if (!songs || !songs.length) {
        container.innerHTML = '<div style="text-align:center;padding:40px">ĐANG TẢI DANH SÁCH BÀI HÁT...</div>';
        if (totalContainer) {
            totalContainer.innerHTML = `<span>TỔNG LƯỢT NGHE:</span><span>0</span>`;
        }
        return;
    }
    
    const currentSongId = songs[index]?.id;
    const statsHtml = songs.map(song => {
        const count = song.listenCount || 0;
        const isCurrent = (song.id === currentSongId);
        return `
            <div class="listen-stat-item ${isCurrent ? 'current-playing' : ''}" data-song-id="${song.id}">
                <span class="listen-stat-name">${escapeHtmlStat(song.name).toUpperCase()}</span>
                <span class="listen-stat-count">${formatNumberStat(count)}</span>
            </div>
        `;
    }).join('');
    
    const total = songs.reduce((sum, song) => sum + (song.listenCount || 0), 0);
    container.innerHTML = statsHtml;
    
    if (totalContainer) {
        totalContainer.innerHTML = `<span>TỔNG LƯỢT NGHE:</span><span>${formatNumberStat(total)}</span>`;
    }
}

function formatNumberStat(num) {
    return num.toLocaleString('en-US');
}

function escapeHtmlStat(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function scrollToCurrentListenSong() {
    const modal = document.getElementById('listen-stats-modal');
    if (!modal || !modal.classList.contains('show')) return;
    
    const currentPlayingItem = modal.querySelector('.listen-stat-item.current-playing');
    if (!currentPlayingItem) return;
    
    const scrollContainer = modal.querySelector('.listen-stats');
    if (!scrollContainer) return;
    
    const header = modal.querySelector('.listen-modal-header');
    const headerHeight = header ? header.offsetHeight : 65;
    const spacingFromHeader = 4;
    
    const itemOffsetTop = currentPlayingItem.offsetTop;
    const containerHeight = scrollContainer.clientHeight;
    const scrollHeight = scrollContainer.scrollHeight;
    
    const allItems = modal.querySelectorAll('.listen-stat-item');
    const isLastItem = allItems.length > 0 && allItems[allItems.length - 1] === currentPlayingItem;
    
    let targetScroll = isLastItem ? scrollHeight - containerHeight : itemOffsetTop - headerHeight - spacingFromHeader;
    targetScroll = Math.max(0, targetScroll);
    scrollContainer.scrollTo({ top: targetScroll, behavior: 'smooth' });
}

function showListenStats() {
    let modal = document.getElementById('listen-stats-modal');
    const isFirstCreate = !modal;
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'listen-stats-modal';
        modal.className = 'listen-modal';
        modal.innerHTML = `<div class="listen-modal-header"><div class="close-listen" id="close-listen-modal"><i data-lucide="x"></i></div><div class="listen-title"><i data-lucide="headphones" class="listen-title-icon"></i><span>THỐNG KÊ LƯỢT NGHE</span></div><div style="width:40px"></div></div><div class="listen-stats" id="listen-stats-content"><div style="text-align:center;padding:40px">ĐANG TẢI...</div></div><div class="listen-total" id="listen-total-stats"></div>`;
        const playerContainer = document.querySelector('.player-container');
        if (playerContainer) playerContainer.appendChild(modal);
        else document.body.appendChild(modal);
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: Array.from(modal.querySelectorAll('[data-lucide]')) });
        const closeBtn = document.getElementById('close-listen-modal');
        if (closeBtn) closeBtn.onclick = () => modal.classList.remove('show');
    }
    
    updateListenStatsModal();
    
    const openWithAnimation = () => {
        void modal.offsetWidth;
        requestAnimationFrame(() => {
            modal.classList.add('show');
            setTimeout(() => scrollToCurrentListenSong(), 300);
        });
    };
    
    if (isFirstCreate || modal.classList.contains('show')) {
        modal.classList.remove('show');
        openWithAnimation();
    } else {
        openWithAnimation();
    }
}

function updateCurrentSongHighlightAndScroll() {
    const modal = document.getElementById('listen-stats-modal');
    if (!modal) return;
    
    const currentSongId = songs[index]?.id;
    const statItems = modal.querySelectorAll('.listen-stat-item');
    
    statItems.forEach(item => {
        const songId = item.getAttribute('data-song-id');
        if (songId === currentSongId) item.classList.add('current-playing');
        else item.classList.remove('current-playing');
    });
    
    if (modal.classList.contains('show')) setTimeout(() => scrollToCurrentListenSong(), 100);
}

function createShuffledArray() {
    const arr = [...Array(songs.length).keys()];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function refreshShuffleCycle() {
    currentShuffleCycle = createShuffledArray();
    remainingQueue = [...currentShuffleCycle];
    if (shuffleHistory.length > 0 && remainingQueue.length > 0 && remainingQueue[0] === shuffleHistory[shuffleHistory.length - 1]) {
        if (remainingQueue.length > 1) {
            [remainingQueue[0], remainingQueue[1]] = [remainingQueue[1], remainingQueue[0]];
        }
    }
}

function getNextShuffleIndex(currentIdx) {
    if (!remainingQueue.length || remainingQueue.length === 0) refreshShuffleCycle();
    const nextIndex = remainingQueue.shift();
    shuffleHistory.push(nextIndex);
    if (shuffleHistory.length > 10) shuffleHistory.shift();
    if (remainingQueue.length === 0) refreshShuffleCycle();
    return nextIndex;
}

function resetShuffleState(currentIdx) {
    refreshShuffleCycle();
    shuffleHistory = [];
    if (remainingQueue.length > 0 && remainingQueue[0] === currentIdx) {
        if (remainingQueue.length > 1) {
            const first = remainingQueue.shift();
            remainingQueue.push(first);
        } else {
            refreshShuffleCycle();
            if (remainingQueue[0] === currentIdx && remainingQueue.length > 1) {
                const first = remainingQueue.shift();
                remainingQueue.push(first);
            }
        }
    }
}

function getInitialShuffleIndex() {
    refreshShuffleCycle();
    const initIdx = remainingQueue.shift();
    shuffleHistory = [initIdx];
    return initIdx;
}

function getPrevShuffleIndex(currentIdx) {
    if (shuffleHistory.length < 2) return getNextShuffleIndex(currentIdx);
    const prevTrack = shuffleHistory[shuffleHistory.length - 2];
    shuffleHistory.pop();
    if (remainingQueue.length > 0 && !remainingQueue.includes(currentIdx)) remainingQueue.unshift(currentIdx);
    return prevTrack;
}

function getRandomPastel() {
    const h = Math.floor(Math.random() * 360);
    return { bg: `hsl(${h}, 70%, 94%)`, accent: `hsl(${h}, 60%, 40%)` };
}

function scrollToActiveTop(behavior) {
    const scrollContainer = document.getElementById('playlist-content');
    if (!scrollContainer) return;
    const activeItem = scrollContainer.querySelector('.song-item.active');
    if (!activeItem) return;
    const gap = 6;
    const containerRect = scrollContainer.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    let targetTop = itemRect.top - containerRect.top + scrollContainer.scrollTop - gap;
    if (!isFinite(targetTop)) targetTop = Math.max(0, activeItem.offsetTop - gap);
    targetTop = Math.max(0, targetTop);

    if (behavior === 'auto') {
        scrollContainer.scrollTop = targetTop;
        return;
    }
    const startTop = scrollContainer.scrollTop;
    const distance = targetTop - startTop;
    if (Math.abs(distance) < 2) return;
    const duration = 900;
    const startTime = performance.now();
    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    function step(now) {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        scrollContainer.scrollTop = startTop + distance * easeInOutCubic(t);
        if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try { if (document.visibilityState === 'visible') wakeLock = await navigator.wakeLock.request('screen'); } catch (err) { }
    }
}

function releaseWakeLock() {
    if (wakeLock) { wakeLock.release().catch(() => { }); wakeLock = null; }
}

function updateMediaSession() {
    if ('mediaSession' in navigator && songs[index]) {
        const song = songs[index];
        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.name,
            artist: song.artist || "XuanKen Official",
            album: 'XuanKen Music Collection',
            artwork: [{ src: song.albumArt || 'https://raw.githubusercontent.com/nokiapro/xuankenofficial/main/logoofficial.png', sizes: '512x512', type: 'image/png' }]
        });
        navigator.mediaSession.setActionHandler('play', () => audio.play());
        navigator.mediaSession.setActionHandler('pause', () => audio.pause());
        navigator.mediaSession.setActionHandler('previoustrack', () => prevSong());
        navigator.mediaSession.setActionHandler('nexttrack', () => handleNextAction());
    }
}

function formatTime(sec) {
    if (!sec || isNaN(sec)) return "00:00";
    let m = Math.floor(sec / 60);
    let s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function parseLRC(text) {
    try {
        if (!text || typeof text !== 'string') return [];
        const lines = text.split(/\r?\n/);
        const result = [];
        const timeReg = /\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?\]/g;
        lines.forEach(line => {
            let match;
            let lastIndex = 0;
            let times = [];
            timeReg.lastIndex = 0;
            while ((match = timeReg.exec(line)) !== null) {
                const mins = parseInt(match[1], 10);
                const secs = parseInt(match[2], 10);
                const frac = match[3] ? parseFloat('0.' + match[3]) : 0;
                times.push(mins * 60 + secs + frac);
                lastIndex = timeReg.lastIndex;
            }
            if (times.length) {
                const lyricText = line.slice(lastIndex).trim();
                if (lyricText) {
                    times.forEach(t => result.push({ time: t, text: lyricText }));
                }
            }
        });
        return result.sort((a, b) => a.time - b.time);
    } catch (e) {
        console.error("LỖI PARSE LRC:", e);
        return [];
    }
}

function looksLikeLrcText(s) {
    if (!s || typeof s !== 'string') return false;
    const t = s.trim();
    return /^\[(ti|ar|al|by|offset):/i.test(t) || /\[\d{1,2}:\d{1,2}(?:\.\d{1,3})?\]/.test(t);
}

function looksLikeUrl(s) {
    if (!s || typeof s !== 'string') return false;
    return /^https?:\/\//i.test(s.trim());
}

async function fetchLyricWithFallback(lrc1, lrc2) {
    try {
        const sources = [lrc1, lrc2].filter(v => v && typeof v === 'string' && v.trim() !== "");
        for (let i = 0; i < sources.length; i++) {
            const src = sources[i].trim();
            try {
                if (looksLikeLrcText(src) && !looksLikeUrl(src)) {
                    const parsed = parseLRC(src);
                    if (parsed && parsed.length > 0) return parsed;
                    continue;
                }
                const res = await fetch(src);
                if (res.ok) {
                    const text = await res.text();
                    const parsed = parseLRC(text);
                    if (parsed && parsed.length > 0) return parsed;
                }
            } catch (e) { console.error("LỖI FETCH LYRIC:", e); }
        }
    } catch (e) {
        console.error("LỖI FETCH LYRIC FALLBACK:", e);
    }
    return [];
}

function autoScaleSongTitle() {
    if (!songTitleEl) return;
    const parent = songTitleEl.parentElement;
    const containerWidth = (parent && parent.clientWidth) || window.innerWidth - 80;
    songTitleEl.classList.remove('is-marquee');
    songTitleEl.style.removeProperty('--scroll-dist');
    songTitleEl.style.animationDuration = '';
    songTitleEl.style.transform = '';
    let originalFontSize = 1.4;
    songTitleEl.style.fontSize = originalFontSize + 'rem';
    songTitleEl.style.whiteSpace = 'nowrap';
    songTitleEl.style.wordBreak = '';
    let currentFontSize = originalFontSize;
    while (songTitleEl.scrollWidth > containerWidth && currentFontSize > 0.7) {
        currentFontSize -= 0.05;
        songTitleEl.style.fontSize = currentFontSize + 'rem';
    }
    if (songTitleEl.scrollWidth > containerWidth && currentFontSize <= 0.7) {
        songTitleEl.style.whiteSpace = 'normal';
        songTitleEl.style.wordBreak = 'break-word';
        songTitleEl.style.fontSize = '0.75rem';
    } else {
        songTitleEl.style.whiteSpace = 'nowrap';
    }
}

function adjustLyricFontSize(text) {
    if (!lyricDisplay || !lyricContainer) return;
    lyricDisplay.style.transform = 'none';
    lyricDisplay.style.fontSize = '16px';
    lyricDisplay.innerText = text;

    const containerWidth = lyricContainer.clientWidth;
    if (containerWidth <= 0) return;

    const textWidth = lyricDisplay.scrollWidth;

    if (textWidth > containerWidth - 20) {
        const scale = (containerWidth - 20) / textWidth;
        const finalScale = Math.max(scale, 0.5);
        lyricDisplay.style.transform = `scale(${finalScale})`;
        lyricDisplay.style.fontSize = '16px';
    } else {
        lyricDisplay.style.transform = 'none';
        let currentFontSize = 16;
        const maxFontSize = Math.min(20, 16 + (containerWidth - textWidth) / 10);
        while (lyricDisplay.scrollWidth < containerWidth - 30 && currentFontSize < maxFontSize) {
            currentFontSize += 1;
            lyricDisplay.style.fontSize = currentFontSize + 'px';
        }
    }
}

function applyGradientToSongTitle() {
    if (!songTitleEl) return;
    const isDarkMode = document.body.classList.contains('dark');
    const gradient = isDarkMode
        ? 'linear-gradient(135deg, #ffd89b, #c7e9fb)'
        : 'linear-gradient(135deg, #ff0040, #8c00ff, #ff0040)';
    songTitleEl.style.background = gradient;
    songTitleEl.style.backgroundSize = '200% 200%';
    songTitleEl.style.webkitBackgroundClip = 'text';
    songTitleEl.style.backgroundClip = 'text';
    songTitleEl.style.color = 'transparent';
    songTitleEl.style.animation = 'titleGradientMove 3s ease infinite';
}

function applyGradientToArtistName() {
    if (!artistNameEl) return;
    const isDarkMode = document.body.classList.contains('dark');
    const gradient = isDarkMode
        ? 'linear-gradient(135deg, #fbc2eb, #a6c1ee)'
        : 'linear-gradient(135deg, #f5af19, #f12711, #f5af19)';
    artistNameEl.style.background = gradient;
    artistNameEl.style.backgroundSize = '200% 200%';
    artistNameEl.style.webkitBackgroundClip = 'text';
    artistNameEl.style.backgroundClip = 'text';
    artistNameEl.style.color = 'transparent';
    artistNameEl.style.animation = 'artistGradientMove 3s ease infinite';
}

async function loadSong(i) {
    if (isChanging || !songs[i]) return;
    
    isChanging = true;
    index = i;
    const song = songs[index];

    if (pcPlaylistPhase === 'showing_end_of_a' && isPcPlaylistOpen()) {
        pcPlaylistPhase = 'waiting_10s_of_b';
        pcPlaylistNextIndex = i;
    } else if (pcPlaylistPhase !== 'waiting_10s_of_b') {
        pcPlaylistPhase = 'idle';
        pcPlaylistTriggerIndex = -1;
        pcPlaylistNextIndex = -1;
    }
    
    if (songTitleEl) {
        songTitleEl.innerText = song.name;
        applyGradientToSongTitle();
    }
    if (artistNameEl) {
        artistNameEl.innerText = song.artist || "ĐANG CẬP NHẬT";
        applyGradientToArtistName();
    }
    
    updateArtImage();
    autoScaleSongTitle();
    const colors = getRandomPastel();
    document.documentElement.style.setProperty('--bg-color', colors.bg);
    document.documentElement.style.setProperty('--accent-color', colors.accent);
    
    if (isSongOwned(song.id)) {
        try {
            const full = await fetchSongFull(song.id);
            if (full) {
                song.audioFull = full.audioFull || '';
                song.audioFull2 = full.audioFull2 || '';
            }
        } catch (e) {}
    }
    const playUrl = getPlayableAudio(song);
    if (isSongOwned(song.id) && playUrl) lastTriedFullUrl[String(song.id)] = playUrl;
    if (!isSameAudioSrc(audio.src, playUrl)) {
        audio.pause();
        audio.src = playUrl || '';
        audio.load();
    }
    preloadNextSong();
    
    lyrics = [];
    lastLyric = "";
    adjustLyricFontSize("ĐANG TẢI LỜI BÀI HÁT...");
    
    try {
        lyrics = await fetchLyricWithFallback(song.lrc1, song.lrc2);
        if (!lyrics || lyrics.length === 0) {
            lyrics = [];
            adjustLyricFontSize("BÀI HÁT TẠM CHƯA CÓ LYRIC NHA HIHI");
        }
    } catch (e) {
        console.error("LỖI TẢI LYRIC:", e);
        lyrics = [];
        adjustLyricFontSize("BÀI HÁT TẠM CHƯA CÓ LYRIC NHA HIHI");
    }
    
    renderPlaylist();
    updateMediaSession();
    if (playlistOverlay.classList.contains('active')) setTimeout(scrollToActiveTop, 100);
    
    hasRecordedCurrentSong = false;
    demoLockedSongId = null;
    isChanging = false;
}

function changeSong(i, source = 'normal') {
    currentSource = source;
    hasUserInteracted = true;
    loadSong(i).then(() => {
        audio.play().catch(e => console.log("CẦN TƯƠNG TÁC TRƯỚC:", e));
        setTimeout(() => {
            updateCurrentSongHighlightAndScroll();
            updateListenStatsModal();
        }, 100);
    }).catch(e => {
        console.error("LỖI LOAD SONG:", e);
        isChanging = false;
    });
}

function selectSongFromList(i) {
    if (playlistOverlay && !isPcLayout()) playlistOverlay.classList.remove('active');
    myPlaylistMode = false;
    myPlaylistQueue = [];
    changeSong(i, 'select');
}

function getMyPlaylistIndices() {
    const ids = loadMyPlaylist();
    return ids
        .map(id => songs.findIndex(s => String(s.id) === String(id)))
        .filter(i => i >= 0);
}

function getNextMyPlaylistIndex(currentIdx) {
    const indices = getMyPlaylistIndices();
    if (!indices.length) {
        myPlaylistMode = false;
        myPlaylistQueue = [];
        return isShuffle ? getNextShuffleIndex(currentIdx) : ((currentIdx + 1) % songs.length);
    }
    if (isShuffle) {
        if (!myPlaylistQueue.length) {
            myPlaylistQueue = [...indices].sort(() => Math.random() - 0.5);
            if (myPlaylistQueue.length > 1 && myPlaylistQueue[0] === currentIdx) {
                myPlaylistQueue.push(myPlaylistQueue.shift());
            }
        }
        let next = myPlaylistQueue.shift();
        if (next === currentIdx && myPlaylistQueue.length) {
            myPlaylistQueue.push(next);
            next = myPlaylistQueue.shift();
        }
        return typeof next === 'number' ? next : indices[0];
    }
    const pos = indices.indexOf(currentIdx);
    if (pos < 0) return indices[0];
    return indices[(pos + 1) % indices.length];
}

function getPrevMyPlaylistIndex(currentIdx) {
    const indices = getMyPlaylistIndices();
    if (!indices.length) {
        myPlaylistMode = false;
        return isShuffle ? getPrevShuffleIndex(currentIdx) : ((currentIdx - 1 + songs.length) % songs.length);
    }
    if (isShuffle) {
        const pos = indices.indexOf(currentIdx);
        if (pos < 0) return indices[indices.length - 1];
        return indices[(pos - 1 + indices.length) % indices.length];
    }
    const pos = indices.indexOf(currentIdx);
    if (pos < 0) return indices[indices.length - 1];
    return indices[(pos - 1 + indices.length) % indices.length];
}

function playAllMyPlaylist() {
    const indices = getMyPlaylistIndices();
    if (!indices.length) {
        showNotification('PLAYLIST:', 'CHƯA CÓ BÀI NÀO', '#ff9800', 'list-plus');
        return;
    }
    myPlaylistMode = true;
    if (isShuffle) {
        myPlaylistQueue = [...indices].sort(() => Math.random() - 0.5);
    } else {
        myPlaylistQueue = [...indices];
    }
    const start = myPlaylistQueue.shift();
    document.getElementById('my-playlist-overlay')?.classList.remove('active');
    hasUserInteracted = true;
    changeSong(start, 'my-playlist');
    setTimeout(() => {
        audio.play().catch(e => console.log('PLAY ALL:', e));
    }, 120);
    showNotification('PLAYLIST:', `PHÁT ${indices.length} BÀI`, '#4ade80', 'list-plus');
}

function handleNextAction() {
    let next, source = 'next';
    if (myPlaylistMode) {
        next = getNextMyPlaylistIndex(index);
        source = 'my-playlist';
    } else if (isShuffle) {
        next = getNextShuffleIndex(index);
        source = 'shuffle';
    } else {
        next = (index + 1) % songs.length;
    }
    changeSong(next, source);
}

function prevSong() {
    let prev, source = 'prev';
    if (myPlaylistMode) {
        prev = getPrevMyPlaylistIndex(index);
        source = 'my-playlist';
    } else if (isShuffle) {
        prev = getPrevShuffleIndex(index);
        source = 'shuffle';
    } else {
        prev = (index - 1 + songs.length) % songs.length;
    }
    changeSong(prev, source);
}

async function startPlayback() {
    if (typeof getCurrentUsername === 'function' && !getCurrentUsername()) {
        const input = document.getElementById('username-input');
        const err = document.getElementById('username-error');
        if (input) input.focus();
        if (err) {
            err.textContent = 'Vui lòng nhập username để bắt đầu';
            err.style.display = 'block';
        }
        return;
    }
    
    hasUserInteracted = true;
    
    const playerContainer = document.getElementById('player-container');
    const hintEl = document.getElementById('interaction-hint');
    
    if (hintEl) {
        hintEl.classList.add('hide');
        hintEl.style.display = 'none';
        hintEl.style.opacity = '0';
        hintEl.style.visibility = 'hidden';
        hintEl.style.pointerEvents = 'none';
    }
    
    if (playerContainer) {
        playerContainer.style.display = 'flex';
        playerContainer.style.opacity = '0';
        playerContainer.style.transform = 'translateY(15px)';
        playerContainer.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        void playerContainer.offsetHeight;
        playerContainer.style.opacity = '1';
        playerContainer.style.transform = 'translateY(0)';
    }

    hidePlayerLoading();
    
    if (!songs.length) {
        pendingPlayAfterLoad = true;
        return;
    }

    if (songs[index]) {
        const needLoad = !audio.src || !isSameAudioSrc(audio.src, getPlayableAudio(songs[index]));
        const playFn = () => {
            audio.play().catch(e => console.log("LỖI PHÁT:", e));
            setTimeout(() => {
                updateCurrentSongHighlightAndScroll();
                updateListenStatsModal();
            }, 100);
        };
        if (needLoad) {
            loadSong(index).then(playFn).catch(e => {
                console.error("LỖI LOAD SONG:", e);
                isChanging = false;
            });
        } else {
            playFn();
        }
    }
}

let isHidingHint = false;

function togglePlay() {
    const hintEl = document.getElementById('interaction-hint');
    
    if (!hasUserInteracted) {
        if (typeof getCurrentUsername === 'function' && !getCurrentUsername()) {
            const input = document.getElementById('username-input');
            const err = document.getElementById('username-error');
            if (input) input.focus();
            if (err) {
                err.textContent = 'Vui lòng nhập username để bắt đầu';
                err.style.display = 'block';
            }
            return;
        }
        if (isHidingHint) return;
        isHidingHint = true;
        
        if (hintEl) {
            hintEl.classList.add('hide');
            hintEl.style.display = 'none';
            hintEl.style.opacity = '0';
            hintEl.style.visibility = 'hidden';
            hintEl.style.pointerEvents = 'none';
        }
        
        showPlayerLoading();
        
        const playerContainer = document.getElementById('player-container');
        if (playerContainer) {
            playerContainer.style.display = 'flex';
            playerContainer.style.opacity = '0';
            playerContainer.style.transform = 'translateY(15px)';
            playerContainer.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
            void playerContainer.offsetHeight;
            playerContainer.style.opacity = '1';
            playerContainer.style.transform = 'translateY(0)';
        }

        hasUserInteracted = true;
        
        if (songs.length > 0 && !isLoadingSongs) {
            hidePlayerLoading();
            if (songs[index] && (!audio.src || !isSameAudioSrc(audio.src, getPlayableAudio(songs[index])))) {
                loadSong(index);
                setTimeout(() => audio.play().catch(e => console.log("LỖI PHÁT:", e)), 100);
            } else if (songs[index]) {
                setTimeout(() => audio.play().catch(e => console.log("LỖI PHÁT:", e)), 100);
            }
        } else {
            const loadingDiv = document.getElementById('player-loading');
            if (loadingDiv) {
                loadingDiv.innerHTML = `
                    <div style="width: 50px; height: 50px; border: 3px solid rgba(0,0,0,0.1); border-top: 3px solid var(--accent-color); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 15px;"></div>
                    <div style="font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; color: var(--text-secondary);">ĐANG TẢI DỮ LIỆU...</div>
                `;
            }
            pendingPlayAfterLoad = true;
        }
        
        isHidingHint = false;
        return;
    }
    
    if (audio.paused) {
        audio.play().catch(e => console.log("LỖI PHÁT:", e));
    } else {
        audio.pause();
    }
}

audio.onerror = () => {
    if (!songs[index]) return;
    const song = songs[index];
    if (isSongOwned(song.id)) {
        const failed = lastTriedFullUrl[song.id] || audio.src;
        const alt = pickFullAudioUrl(song, failed);
        if (alt && alt !== failed && !audio.dataset.retried) {
            audio.dataset.retried = '1';
            lastTriedFullUrl[song.id] = alt;
            audio.src = alt;
            audio.load();
            audio.play().catch(() => {});
            showNotification('DỰ PHÒNG:', 'ĐANG THỬ LINK FULL 2...', '#ff9800', 'refresh-cw');
            return;
        }
    }
    delete audio.dataset.retried;
    showNotification('LỖI:', 'KHÔNG THỂ PHÁT BÀI HÁT!', '#ff4444', 'alert-circle');
    hidePlayerLoading();
};

audio.addEventListener('playing', () => {
    delete audio.dataset.retried;
});

const progressArea = document.getElementById('progress-area');
const progressFill = document.getElementById('progress-fill');
const progressThumb = document.getElementById('progress-thumb');

function updateProgressUI() {
    const dur = audio.duration;
    const cur = audio.currentTime;
    if (dur && !isNaN(dur)) {
        const percent = (cur / dur) * 100;
        progressFill.style.width = percent + '%';
        const wrapperWidth = progressArea.clientWidth;
        const leftPos = (percent / 100) * wrapperWidth;
        progressThumb.style.left = leftPos + 'px';
    }
}

if (progressArea) {
    progressArea.onclick = (e) => {
        if (!audio.duration) return;
        const rect = progressArea.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const newTime = percent * audio.duration;
        audio.currentTime = newTime;
        if (newTime < 5 && hasRecordedCurrentSong) hasRecordedCurrentSong = false;
        updateProgressUI();
    };
}

let isDragging = false;
if (progressThumb) {
    progressThumb.onmousedown = (e) => {
        e.stopPropagation();
        isDragging = true;
        document.body.style.userSelect = 'none';
        const onMouseMove = (moveEvent) => {
            if (!isDragging) return;
            const rect = progressArea.getBoundingClientRect();
            let newLeft = moveEvent.clientX - rect.left;
            newLeft = Math.max(0, Math.min(newLeft, rect.width));
            const percent = newLeft / rect.width;
            const newTime = percent * audio.duration;
            audio.currentTime = newTime;
            if (newTime < 5 && hasRecordedCurrentSong) hasRecordedCurrentSong = false;
            progressFill.style.width = percent * 100 + '%';
            progressThumb.style.left = newLeft + 'px';
        };
        const onMouseUp = () => {
            isDragging = false;
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };
}

let lastProgressUiAt = 0;
let lastTimeLabelAt = 0;


function tryRecordListenCount() {
    try {
        if (!songs || !songs[index]) return;
        if (hasRecordedCurrentSong) return;
        if (isUpdatingListen) return;
        if (demoLockedSongId) return;
        const cur = (typeof audio !== 'undefined' && audio) ? (Number(audio.currentTime) || 0) : 0;
        if (cur < 5) return;
        if (!hasUserInteracted) hasUserInteracted = true;
        hasRecordedCurrentSong = true;
        const song = songs[index];
        Promise.resolve(incrementListenCount(song.id, song.name, currentSource || 'play'))
            .then(ok => {
                if (!ok) hasRecordedCurrentSong = false;
            })
            .catch(() => { hasRecordedCurrentSong = false; });
    } catch (e) {
        console.warn('tryRecordListenCount', e);
        hasRecordedCurrentSong = false;
    }
}

setInterval(() => {
    try {
        if (typeof audio === 'undefined' || !audio) return;
        if (audio.paused) return;
        tryRecordListenCount();
    } catch (e) {}
}, 1000);

audio.ontimeupdate = () => {
    if (demoLockedSongId) return;

    const cur = audio.currentTime;
    const dur = audio.duration;
    const now = performance.now();

    if (dur && now - lastTimeLabelAt > 250) {
        lastTimeLabelAt = now;
        const timeCurrent = document.getElementById('time-current');
        const timeTotal = document.getElementById('time-total');
        if (timeCurrent) timeCurrent.innerText = formatTime(cur);
        if (timeTotal) timeTotal.innerText = formatTime(dur);
    }
    if (now - lastProgressUiAt > 80) {
        lastProgressUiAt = now;
        updateProgressUI();
    }

    if (lyrics.length > 0) {
        const active = lyrics.findLast(l => cur >= l.time);
        if (active && lastLyric !== active.text) {
            lastLyric = active.text;
            adjustLyricFontSize(active.text);
        }
    }
    
    if (songs[index] && !isSongOwned(songs[index].id) && cur >= DEMO_SECONDS) {
        const demoSong = songs[index];
        demoLockedSongId = String(demoSong.id);
        showNotification('DEMO HẾT:', 'MUA ĐỂ NGHE FULL — ' + (demoSong.name || demoSong.id), '#ff9800', 'store');
        openShopModal(demoSong.id);
        audio.pause();
        try { audio.currentTime = DEMO_SECONDS; } catch (e) {}
        updateProgressUI();
        return;
    }
    
    tryRecordListenCount();

    if (isPcLayout() && dur && isFinite(dur) && dur > 0) {
        const remaining = dur - cur;
        if (pcPlaylistPhase === 'idle' || pcPlaylistPhase === 'showing_end_of_a') {
            if (!audio.paused && remaining <= 10 && remaining > 0.05 && dur > 12) {
                if (pcPlaylistPhase !== 'showing_end_of_a' || pcPlaylistTriggerIndex !== index) {
                    pcPlaylistPhase = 'showing_end_of_a';
                    pcPlaylistTriggerIndex = index;
                    pcPlaylistNextIndex = -1;
                    showPcPlaylist();
                }
            } else if (remaining > 10.5 && pcPlaylistPhase === 'showing_end_of_a' && pcPlaylistTriggerIndex === index) {
                hidePcPlaylist();
            }
        } else if (pcPlaylistPhase === 'waiting_10s_of_b') {
            if (index === pcPlaylistNextIndex && cur >= 10) {
                hidePcPlaylist();
            } else if (index !== pcPlaylistNextIndex && index !== pcPlaylistTriggerIndex) {
                hidePcPlaylist();
            }
        }
    }
    
    if (isRepeatOne && dur && (dur - cur) <= 0.15 && !isLoopingHandled && dur > 0) {
        if (demoLockedSongId) return;
        isLoopingHandled = true;
        if (hasRecordedCurrentSong) {
            hasRecordedCurrentSong = false;
            currentSource = 'loop';
        }
        try {
            audio.currentTime = 0;
            const p = audio.play();
            if (p && p.catch) p.catch(() => setTimeout(() => audio.play().catch(() => {}), 30));
        } catch (e) {}
    }
    
    if (cur > 0.3 && dur && (dur - cur) > 0.3) isLoopingHandled = false;
};

audio.onended = () => {
    if (demoLockedSongId || (songs[index] && !isSongOwned(songs[index].id))) {
        audio.pause();
        if (songs[index] && !isSongOwned(songs[index].id) && demoLockedSongId == null) {
            demoLockedSongId = String(songs[index].id);
            try { audio.currentTime = Math.min(DEMO_SECONDS, audio.duration || DEMO_SECONDS); } catch (e) {}
            showNotification('DEMO HẾT:', 'MUA ĐỂ NGHE FULL — ' + (songs[index].name || songs[index].id), '#ff9800', 'store');
            openShopModal(songs[index].id);
        }
        return;
    }
    if (isRepeatOne) {
        if (!isLoopingHandled) {
            isLoopingHandled = true;
            if (hasRecordedCurrentSong) {
                hasRecordedCurrentSong = false;
                currentSource = 'loop';
            }
            try {
                audio.currentTime = 0;
                const p = audio.play();
                if (p && p.catch) p.catch(() => setTimeout(() => audio.play().catch(() => {}), 40));
            } catch (e) {}
        }
    } else {
        handleNextAction();
    }
};

audio.onplay = () => {
    isPlaying = true;
    setLucideIcon(document.getElementById('play-pause-btn'), 'pause');
    if (art) art.style.animationPlayState = 'running';
    const wrap = document.getElementById('album-art-wrap');
    if (wrap) wrap.classList.add('ring-playing');
    requestWakeLock();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing";
    hidePlayerLoading();
    _lastListenTickAt = Date.now();
};

audio.onpause = () => {
    isPlaying = false;
    setLucideIcon(document.getElementById('play-pause-btn'), 'play');
    if (art) art.style.animationPlayState = 'paused';
    const wrap = document.getElementById('album-art-wrap');
    if (wrap) wrap.classList.remove('ring-playing');
    releaseWakeLock();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused";
    persistListenTimeNow();
};

function resolveArtRingName(raw) {
    let t = String(raw || '').trim();
    if (!t) {
        t = (typeof getCurrentUsername === 'function' && getCurrentUsername()) || '';
        t = String(t || '').trim();
    }
    if (!t) {
        try {
            const s = typeof getAdminSettings === 'function' ? getAdminSettings() : null;
            t = (s && (s.siteName || s.siteTitle)) || 'XuanKen Music';
        } catch (e) {
            t = 'XuanKen Music';
        }
    }
    return t.slice(0, 28);
}

/**
 * Tính chuỗi lặp vừa khít 1 vòng path:
 * - đo chiều dài path (chu vi)
 * - lặp "TÊN · " sao cho độ dài tự nhiên ≤ chu vi
 * - gán textLength = chu vi + lengthAdjust=spacing → dãn đều, không thừa/thiếu
 */
function updateArtRingPathRadius() {
    const wrap = document.getElementById('album-art-wrap');
    const art = wrap && wrap.querySelector('.album-art');
    const pathGeom = document.getElementById('art-ring-path');
    const svg = document.getElementById('art-name-ring');
    if (!wrap || !art || !pathGeom || !svg) return 92;

    const wrapSize = wrap.clientWidth || 200;
    const artSize = art.clientWidth || 170;
    let fontPx = 10.5;
    try {
        const te = svg.querySelector('text.art-name-text');
        if (te) fontPx = parseFloat(getComputedStyle(te).fontSize) || fontPx;
    } catch (e) {}

    const GAP = 12; // px cách mép album art (không sát quá)
    const artR = artSize / 2;
    // Path = đường giữa chữ; mép trong ≈ pathR - 0.35*font → artR + GAP
    const pathRpx = artR + GAP + fontPx * 0.35;
    let rVb = (pathRpx / wrapSize) * 200;
    const maxR = 100 - (fontPx / wrapSize) * 100 - 1;
    rVb = Math.max(20, Math.min(maxR, rVb));

    const d = 'M 100,' + (100 - rVb) + ' A ' + rVb + ',' + rVb + ' 0 1,1 99.999,' + (100 - rVb);
    pathGeom.setAttribute('d', d);
    return rVb;
}

function fitArtRingTextToPath(name) {
    const pathGeom = document.getElementById('art-ring-path');
    const textEl = document.querySelector('#art-name-ring text.art-name-text');
    if (!pathGeom || !textEl) return;

    updateArtRingPathRadius();

    const pathLen = (typeof pathGeom.getTotalLength === 'function')
        ? pathGeom.getTotalLength()
        : (2 * Math.PI * 90);

    const base = String(name || 'XuanKen').trim().replace(/\s+/g, ' ');
    if (!base) return;

    const NS = 'http://www.w3.org/2000/svg';
    const XLINK = 'http://www.w3.org/1999/xlink';

    function makeTp(content, offset) {
        const tp = document.createElementNS(NS, 'textPath');
        tp.setAttribute('href', '#art-ring-path');
        try { tp.setAttributeNS(XLINK, 'xlink:href', '#art-ring-path'); } catch (e) {}
        tp.setAttribute('startOffset', String(Math.round(offset * 1000) / 1000));
        tp.textContent = content;
        return tp;
    }

    function measure(str) {
        textEl.innerHTML = '';
        textEl.appendChild(makeTp(str, 0));
        let len = 0;
        try { len = textEl.querySelector('textPath').getComputedTextLength(); } catch (e) {}
        return (len && len > 1) ? len : Math.max(8, str.length * 7);
    }

    const nameLen = measure(base);
    const sep = '·';
    const sepLen = measure(sep);

    const minSlot = nameLen + sepLen + 8;
    let n = Math.max(1, Math.floor(pathLen / minSlot));
    const slot = pathLen / n;

    textEl.innerHTML = '';
    for (let i = 0; i < n; i++) {
        const nameStart = i * slot;
        textEl.appendChild(makeTp(base, nameStart));
        const gap = Math.max(0, slot - nameLen);
        const dotCenter = nameStart + nameLen + gap / 2;
        const dotStart = Math.max(0, dotCenter - sepLen / 2);
        textEl.appendChild(makeTp(sep, dotStart));
    }
}

/** Gói thuê vòng tên quanh art (ngày) */
const ART_RING_RENT_DAYS = [1, 3, 5, 7];
/** Giá mặc định XK theo số ngày */
const ART_RING_RENT_PRICES = { 1: 15, 3: 35, 5: 50, 7: 65 };

function getArtRingRentPrice(days) {
    const d = Number(days) || 1;
    try {
        const s = typeof getAdminSettings === 'function' ? getAdminSettings() : null;
        const map = s && s.artRingRentPrices;
        if (map && map[d] != null && !Number.isNaN(Number(map[d]))) {
            return Math.max(0, Number(map[d]));
        }
    } catch (e) {}
    return ART_RING_RENT_PRICES[d] != null ? ART_RING_RENT_PRICES[d] : Math.max(1, 15 * d);
}

function getArtRingUntil() {
    const acc = typeof getCurrentAccount === 'function' ? getCurrentAccount() : null;
    return Math.max(0, Number(acc && acc.artRingUntil) || 0);
}

function hasArtRingAccess() {
    const acc = typeof getCurrentAccount === 'function' ? getCurrentAccount() : null;
    if (!acc) return false;
    // Admin / rank cao: miễn phí
    const rank = String(acc.rank || '').toLowerCase();
    if (rank === 'admin' || rank === 'super_vip' || rank === 'toi_thuong' || rank === 'tối thượng') return true;
    return getArtRingUntil() > Date.now();
}

function updateArtNameRing() {
    const wrap = document.getElementById('album-art-wrap');
    const textEl = document.querySelector('#art-name-ring text.art-name-text');
    const enEl = document.getElementById('art-ring-enabled');
    const txEl = document.getElementById('art-ring-text');
    if (!wrap || !textEl) return;

    let preferOn = true;
    let custom = '';
    const acc = typeof getCurrentAccount === 'function' ? getCurrentAccount() : null;
    if (acc) {
        preferOn = acc.artRingOn !== false;
        custom = String(acc.artRingText || '');
    }
    const access = hasArtRingAccess();
    const on = access && preferOn;

    if (enEl) {
        enEl.checked = preferOn;
        enEl.disabled = !access;
    }
    if (txEl) {
        if (document.activeElement !== txEl) txEl.value = custom;
        txEl.disabled = !access;
    }

    wrap.classList.toggle('ring-off', !on);
    if (on) {
        const name = resolveArtRingName(custom);
        requestAnimationFrame(() => {
            try { fitArtRingTextToPath(name); } catch (e) {
                console.warn('fitArtRingTextToPath', e);
            }
        });
    }
    if (isPlaying && on) wrap.classList.add('ring-playing');
    else wrap.classList.remove('ring-playing');
}

function saveArtRingSettings() {
    if (!getCurrentUsername()) {
        if (typeof showNotification === 'function') {
            showNotification('LỖI:', 'CHƯA ĐĂNG NHẬP USERNAME', '#ff4444', 'user');
        }
        return;
    }
    if (!hasArtRingAccess()) {
        if (typeof showNotification === 'function') {
            showNotification('VÒNG TÊN:', 'CẦN THUÊ TRONG CỬA HÀNG (1·3·5·7 NGÀY)', '#ff9800', 'clock');
        }
        return;
    }
    const enEl = document.getElementById('art-ring-enabled');
    const txEl = document.getElementById('art-ring-text');
    const on = !!(enEl && enEl.checked);
    const text = (txEl && txEl.value || '').trim().slice(0, 28);
    updateCurrentAccount(acc => {
        acc.artRingOn = on;
        acc.artRingText = text;
    });
    updateArtNameRing();
    if (typeof showNotification === 'function') {
        showNotification('VÒNG TÊN:', on ? ('Đã bật · ' + (text || getCurrentUsername() || 'username')) : 'Đã tắt', '#4ade80', 'sparkles');
    } else if (typeof showToastMsg === 'function') {
        showToastMsg(on ? 'Đã lưu vòng tên' : 'Đã tắt vòng tên', true);
    }
}

function rentArtRing(days) {
    if (!getCurrentUsername()) {
        showNotification('LỖI:', 'CHƯA ĐĂNG NHẬP USERNAME', '#ff4444', 'user');
        return false;
    }
    const d = ART_RING_RENT_DAYS.includes(Number(days)) ? Number(days) : 1;
    const price = getArtRingRentPrice(d);
    const coins = loadCoins();
    if (coins < price) {
        showNotification('THIẾU XK:', `THUÊ VÒNG TÊN ${d} NGÀY CẦN ${price} XK — ĐANG CÓ ${coins} XK`, '#ff9800', 'coins');
        return false;
    }
    const now = Date.now();
    const cur = getArtRingUntil();
    const base = cur > now ? cur : now;
    const until = base + d * 24 * 60 * 60 * 1000;
    const wasActive = cur > now;
    updateCurrentAccount(acc => {
        acc.coins = (acc.coins | 0) - price;
        acc.artRingUntil = until;
        if (acc.artRingOn == null) acc.artRingOn = true;
    });
    updateArtNameRing();
    if (typeof renderShopRing === 'function') renderShopRing();
    updateShopBalanceUI();
    showNotification(
        wasActive ? ('GIA HẠN VÒNG TÊN +' + d + 'N:') : ('THUÊ VÒNG TÊN ' + d + ' NGÀY:'),
        'Chữ gradient quanh album art đã mở',
        '#4ade80',
        'sparkles'
    );
    return true;
}

function renderShopRing() {
    const list = document.getElementById('shop-ring-list');
    if (!list) return;
    const access = hasArtRingAccess();
    const until = getArtRingUntil();
    const left = Math.max(0, until - Date.now());
    let statusHtml = '';
    if (access && until > Date.now()) {
        statusHtml = `<div class="shop-ring-status active">
            <div class="shop-ring-status-title">Đang có vòng tên</div>
            <div class="shop-ring-status-time shop-rent-countdown" data-ring-exp="${until}">${formatRentCountdown(until).replace(/^THUÊ /, 'Còn ')}</div>
            <p class="shop-ring-hint">Thuê thêm để gia hạn · Tùy chỉnh chữ ở Tiện ích</p>
        </div>`;
    } else if (access) {
        statusHtml = `<div class="shop-ring-status active">
            <div class="shop-ring-status-title">Vòng tên miễn phí (rank)</div>
            <p class="shop-ring-hint">Tùy chỉnh chữ ở Tiện ích → Vòng tên quanh art</p>
        </div>`;
    } else {
        statusHtml = `<div class="shop-ring-status">
            <div class="shop-ring-status-title">Chưa thuê vòng tên</div>
            <p class="shop-ring-hint">Chữ username gradient chạy quanh album art tròn</p>
        </div>`;
    }
    const packs = ART_RING_RENT_DAYS.map(d => {
        const p = getArtRingRentPrice(d);
        return `<button type="button" class="shop-buy-btn shop-rent-btn shop-ring-pack" data-ring-days="${d}">
            <span class="shop-ring-pack-days">${d} ngày</span>
            <span class="shop-ring-pack-price">${p} XK</span>
        </button>`;
    }).join('');
    list.innerHTML = `
        <div class="shop-ring-card">
            ${statusHtml}
            <div class="shop-ring-packs">${packs}</div>
        </div>`;
    list.querySelectorAll('[data-ring-days]').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            rentArtRing(Number(btn.getAttribute('data-ring-days')) || 1);
        };
    });
    if (window._shopRingTimer) clearInterval(window._shopRingTimer);
    const tick = () => {
        list.querySelectorAll('[data-ring-exp]').forEach(el => {
            const exp = Number(el.getAttribute('data-ring-exp')) || 0;
            const t = formatRentCountdown(exp);
            el.textContent = t === 'HẾT HẠN THUÊ' ? 'HẾT HẠN' : t.replace(/^THUÊ /, 'Còn ');
            if (exp <= Date.now()) {
                try { updateArtNameRing(); renderShopRing(); } catch (e) {}
            }
        });
    };
    tick();
    window._shopRingTimer = setInterval(tick, 1000);
}

function bindArtRingResize() {
    if (window.artRingResizeBound) return;
    window.artRingResizeBound = true;
    let t = null;
    window.addEventListener('resize', () => {
        clearTimeout(t);
        t = setTimeout(() => {
            try { if (typeof updateArtNameRing === 'function') updateArtNameRing(); } catch (e) {}
        }, 120);
    });
}

function bindArtRingSettingsUI() {
    const btn = document.getElementById('art-ring-save-btn');
    if (btn && !btn._artRingBound) {
        btn._artRingBound = true;
        btn.onclick = () => saveArtRingSettings();
    }
    const enEl = document.getElementById('art-ring-enabled');
    if (enEl && !enEl._artRingBound) {
        enEl._artRingBound = true;
        enEl.onchange = () => {
            if (!getCurrentUsername()) {
                enEl.checked = false;
                return;
            }
            if (!hasArtRingAccess()) {
                enEl.checked = false;
                showNotification('VÒNG TÊN:', 'CẦN THUÊ TRONG CỬA HÀNG', '#ff9800', 'clock');
                return;
            }
            updateCurrentAccount(acc => { acc.artRingOn = !!enEl.checked; });
            updateArtNameRing();
        };
    }
    updateArtNameRing();
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function updatePlaylistStatsFooter() {
    const totalEl = document.getElementById('ps-total');
    const favEl = document.getElementById('ps-fav');
    const plEl = document.getElementById('ps-pl');
    const footer = document.getElementById('playlist-stats-footer');
    if (!footer) return;
    const total = (songs && songs.length) ? songs.length : 0;
    const songIds = new Set((songs || []).map(s => String(s.id)));
    let favCount = 0;
    let plCount = 0;
    try {
        favCount = loadFavorites().filter(id => songIds.has(String(id))).length;
    } catch (e) {}
    try {
        plCount = loadMyPlaylist().filter(id => songIds.has(String(id))).length;
    } catch (e) {}
    if (totalEl) totalEl.textContent = String(total);
    if (favEl) favEl.textContent = String(favCount);
    if (plEl) plEl.textContent = String(plCount);
    try {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ nodes: Array.from(footer.querySelectorAll('[data-lucide]')) });
        }
    } catch (e) {}
}

function renderPlaylist() {
    const list = document.getElementById('playlist-content');
    if (!list) return;
    if (!songs || !songs.length) {
        list.innerHTML = '<div style="text-align:center;padding:40px">ĐANG TẢI DANH SÁCH...</div>';
        updatePlaylistStatsFooter();
        return;
    }
    list.innerHTML = songs.map((s, i) => {
        const artistName = s.artist && s.artist.trim() !== "" ? s.artist : "ĐANG CẬP NHẬT";
        const id = String(s.id);
        const fav = isFavorite(id);
        const inPl = isInMyPlaylist(id);
        return `<div class="song-item ${i === index ? 'active' : ''}" data-idx="${i}">
            <div class="song-item-info" data-play-idx="${i}">
                <div class="item-title text-sm uppercase font-bold">${escapeHtml(s.name)}</div>
                <div class="song-artist-line text-xs text-gray-500"><i data-lucide="mic"></i><span>${escapeHtml(artistName)}</span></div>
            </div>
            <div class="song-item-actions">
                <button type="button" class="song-act-btn ${fav ? 'on-fav' : ''}" data-act="fav" data-id="${escapeHtml(id)}" title="Yêu thích"><i data-lucide="heart" style="${fav ? 'fill:currentColor' : ''}"></i></button>
                <button type="button" class="song-act-btn ${inPl ? 'on-pl' : ''}" data-act="pl" data-id="${escapeHtml(id)}" title="Thêm playlist"><i data-lucide="list-plus"></i></button>
            </div>
        </div>`;
    }).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: Array.from(list.querySelectorAll('[data-lucide]')) });
    list.querySelectorAll('[data-play-idx]').forEach(el => {
        el.onclick = (e) => {
            e.stopPropagation();
            window.selectSongFromList(parseInt(el.getAttribute('data-play-idx'), 10));
        };
    });
    list.querySelectorAll('.song-act-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const act = btn.getAttribute('data-act');
            const id = btn.getAttribute('data-id');
            if (act === 'fav') toggleFavorite(id);
            else if (act === 'pl') toggleMyPlaylistSong(id);
        };
    });
    updatePlaylistStatsFooter();
}

function renderMyPlaylist() {
    const list = document.getElementById('my-playlist-content');
    const toolbar = document.getElementById('my-playlist-toolbar');
    if (!list) return;
    const ids = loadMyPlaylist();
    if (toolbar) toolbar.style.display = ids.length ? 'flex' : 'none';
    if (!ids.length) {
        list.innerHTML = '<div style="text-align:center;padding:40px 16px;color:var(--text-secondary);font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Chưa có bài — bấm icon playlist bên cạnh bài hát để thêm</div>';
        return;
    }
    list.innerHTML = ids.map(id => {
        const s = songs.find(x => String(x.id) === String(id));
        if (!s) return '';
        const i = songs.findIndex(x => String(x.id) === String(id));
        const artistName = s.artist && s.artist.trim() !== "" ? s.artist : "ĐANG CẬP NHẬT";
        return `<div class="song-item ${i === index ? 'active' : ''}">
            <div class="song-item-info" data-play-idx="${i}">
                <div class="item-title text-sm uppercase font-bold">${escapeHtml(s.name)}</div>
                <div class="song-artist-line text-xs text-gray-500"><i data-lucide="mic"></i><span>${escapeHtml(artistName)}</span></div>
            </div>
            <div class="song-item-actions">
                <button type="button" class="song-act-btn on-pl" data-act="pl-remove" data-id="${escapeHtml(String(id))}" title="Xóa khỏi playlist"><i data-lucide="trash-2"></i></button>
            </div>
        </div>`;
    }).join('');
    if (typeof lucide !== 'undefined') {
        lucide.createIcons({ nodes: Array.from(list.querySelectorAll('[data-lucide]')) });
        const playAllBtn = document.getElementById('my-playlist-playall-btn');
        if (playAllBtn) lucide.createIcons({ nodes: Array.from(playAllBtn.querySelectorAll('[data-lucide]')) });
    }
    list.querySelectorAll('[data-play-idx]').forEach(el => {
        el.onclick = () => {
            const i = parseInt(el.getAttribute('data-play-idx'), 10);
            if (!Number.isNaN(i) && i >= 0) {
                myPlaylistMode = true;
                myPlaylistQueue = [];
                document.getElementById('my-playlist-overlay')?.classList.remove('active');
                changeSong(i, 'my-playlist');
                setTimeout(() => audio.play().catch(() => {}), 100);
            }
        };
    });
    list.querySelectorAll('[data-act="pl-remove"]').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            toggleMyPlaylistSong(btn.getAttribute('data-id'));
            renderMyPlaylist();
        };
    });
    const playAllBtn = document.getElementById('my-playlist-playall-btn');
    if (playAllBtn) {
        playAllBtn.onclick = (e) => {
            e.stopPropagation();
            playAllMyPlaylist();
        };
    }
}

const playerContainer = document.getElementById('player-container');
if (playerContainer) playerContainer.style.display = 'none';

if (hint) {
    hint.onclick = null;
}

const playPauseBtn = document.getElementById('play-pause-btn');
if (playPauseBtn) playPauseBtn.onclick = togglePlay;

const nextBtn = document.getElementById('next-btn');
if (nextBtn) nextBtn.onclick = handleNextAction;

const prevBtn = document.getElementById('prev-btn');
if (prevBtn) prevBtn.onclick = prevSong;

const listBtn = document.getElementById('list-btn');
if (listBtn) {
    listBtn.onclick = (e) => {
        e.stopPropagation();
        if (isPcLayout()) {
            if (isPcPlaylistOpen()) hidePcPlaylist();
            else showPcPlaylist();
            return;
        }
        renderPlaylist();
        if (playlistOverlay) {
            playlistOverlay.classList.add('active');
            refreshModalIcons(playlistOverlay);
        }
        setTimeout(scrollToActiveTop, 150);
    };
}

const closePlaylistBtn = document.getElementById('close-playlist-btn');
if (closePlaylistBtn && playlistOverlay) {
    closePlaylistBtn.onclick = () => {
        if (isPcLayout()) {
            hidePcPlaylist();
            return;
        }
        playlistOverlay.classList.remove('active');
    };
}

window.addEventListener('resize', () => {
    if (!isPcLayout()) {
        const layout = document.querySelector('.pc-layout');
        if (layout) layout.classList.remove('playlist-open');
    }
});

if (shuffleBtn) {
    shuffleBtn.onclick = function() {
        isShuffle = !isShuffle;
        this.classList.toggle('active', isShuffle);
        if (isShuffle) {
            resetShuffleState(index);
            showNotification('XÁO TRỘN:', 'BẬT XÁO TRỘN THÔNG MINH', 'var(--accent-color)', 'shuffle');
        } else {
            showNotification('TUẦN TỰ:', 'TẮT XÁO TRỘN, PHÁT TUẦN TỰ', 'var(--accent-color)', 'list');
        }
    };
}

if (repeatBtn) {
    repeatBtn.onclick = function() {
        isRepeatOne = !isRepeatOne;
        this.classList.toggle('active', isRepeatOne);
        isLoopingHandled = false;
        setLucideIcon(this, isRepeatOne ? 'repeat-1' : 'repeat');
        
        if (isRepeatOne) {
            showNotification('LẶP LẠI:', 'LẶP LẠI 1 BÀI', 'var(--accent-color)', 'repeat-1');
        } else {
            showNotification('TẮT LẶP:', 'ĐÃ TẮT LẶP', 'var(--accent-color)', 'repeat');
        }
    };
}

window.addEventListener('resize', () => {
    updateProgressUI();
    autoScaleSongTitle();
    if (lastLyric) adjustLyricFontSize(lastLyric);
});

let sleepTimerId = null;

function refreshModalIcons(root) {
    if (typeof lucide === 'undefined' || !root) return;
    try { lucide.createIcons({ nodes: Array.from(root.querySelectorAll('[data-lucide]')) }); } catch (e) {}
}

let countdownInterval = null;
let remainSeconds = 0;

const timerModal = document.getElementById('timer-modal');
const timerOverlay = document.getElementById('timer-overlay');
const openTimerBtn = document.getElementById('open-timer-btn');
const startTimerBtn = document.getElementById('start-timer-btn');
const cancelTimerBtn = document.getElementById('cancel-timer-btn');
const timerMinutesInput = document.getElementById('timer-minutes');
const timerStatus = document.getElementById('timer-status');
const closeTimerModalBtn = document.getElementById('close-timer-modal');
const presetBtns = document.querySelectorAll('.timer-preset');

function toggleTimerModal() {
    if (!timerModal || !timerOverlay) return;
    if (timerModal.classList.contains('show')) {
        timerModal.classList.remove('show');
        timerOverlay.classList.remove('show');
        setTimeout(() => {
            if (!timerModal.classList.contains('show')) timerOverlay.style.display = 'none';
        }, 550);
    } else {
        timerOverlay.style.display = 'block';
        void timerOverlay.offsetHeight;
        timerOverlay.classList.add('show');
        timerModal.classList.add('show');
        if (typeof lucide !== 'undefined') {
            try { lucide.createIcons({ nodes: Array.from(timerModal.querySelectorAll('[data-lucide]')) }); } catch (e) {}
        }
    }
}

function cancelTimer() {
    if (sleepTimerId) {
        clearTimeout(sleepTimerId);
        sleepTimerId = null;
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    remainSeconds = 0;
    if (timerStatus) timerStatus.innerHTML = 'BẠN CHƯA ĐẶT HẸN GIỜ';
    if (openTimerBtn) openTimerBtn.classList.remove('active');
    showNotification('HỦY HẸN GIỜ:', 'ĐÃ HỦY HẸN GIỜ', '#ff9800', 'trash-2');
}

function updateTimerDisplay() {
    if (remainSeconds > 0) {
        const hrs = Math.floor(remainSeconds / 3600);
        const mins = Math.floor((remainSeconds % 3600) / 60);
        const secs = remainSeconds % 60;
        const pad = (n) => String(n).padStart(2, '0');
        const clock = hrs > 0
            ? (pad(hrs) + ':' + pad(mins) + ':' + pad(secs))
            : (pad(mins) + ':' + pad(secs));
        let label = '';
        if (hrs > 0) label += '<strong>' + hrs + '</strong> GIỜ ';
        if (mins > 0 || hrs > 0) label += '<strong>' + mins + '</strong> PHÚT ';
        label += '<strong>' + secs + '</strong> GIÂY';
        if (timerStatus) timerStatus.innerHTML = 'TẮT SAU: ' + label;
        if (openTimerBtn) openTimerBtn.classList.add('active');
    } else {
        if (timerStatus) timerStatus.innerHTML = 'BẠN CHƯA ĐẶT HẸN GIỜ';
        if (openTimerBtn) openTimerBtn.classList.remove('active');
    }
}

function startCountdown(seconds) {
    if (countdownInterval) clearInterval(countdownInterval);
    remainSeconds = seconds;
    updateTimerDisplay();
    countdownInterval = setInterval(() => {
        if (remainSeconds <= 1) {
            clearInterval(countdownInterval);
            countdownInterval = null;
            if (sleepTimerId) {
                clearTimeout(sleepTimerId);
                sleepTimerId = null;
            }
            if (audio && !audio.paused) audio.pause();
            showNotification('HẾT GIỜ:', 'ĐÃ TẮT NHẠC!', '#ff9800', 'bell');
            if (timerStatus) timerStatus.innerHTML = 'ĐÃ TẮT NHẠC';
            if (openTimerBtn) openTimerBtn.classList.remove('active');
        } else {
            remainSeconds--;
            updateTimerDisplay();
        }
    }, 1000);
}

window.setTimer = function(minutes) {
    if (!minutes || minutes <= 0) {
        showNotification('LỖI:', 'NHẬP SỐ PHÚT HỢP LỆ!', '#ff4444', 'alert-circle');
        return;
    }
    cancelTimer();
    const seconds = minutes * 60;
    sleepTimerId = setTimeout(() => {
        if (audio && !audio.paused) audio.pause();
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        showNotification('HẾT GIỜ:', 'ĐÃ TẮT NHẠC THEO HẸN GIỜ!', '#ff9800', 'bell');
        if (timerStatus) timerStatus.innerHTML = 'ĐÃ TẮT NHẠC';
        if (openTimerBtn) openTimerBtn.classList.remove('active');
        remainSeconds = 0;
    }, seconds * 1000);
    startCountdown(seconds);
    toggleTimerModal();
    showNotification('HẸN GIỜ:', `TẮT SAU ${minutes} PHÚT`, '#4ade80', 'timer');
};

presetBtns.forEach(btn => {
    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        let minutes = parseInt(this.getAttribute('data-minutes'));
        if (isNaN(minutes)) {
            const text = this.textContent;
            if (text.includes('30')) minutes = 30;
            else if (text.includes('60')) minutes = 60;
            else if (text.includes('15')) minutes = 15;
            else if (text.includes('90')) minutes = 90;
            else if (text.includes('120')) minutes = 120;
        }
        if (minutes > 0) {
            if (timerMinutesInput) timerMinutesInput.value = minutes;
            window.setTimer(minutes);
        }
    });
});

if (openTimerBtn) openTimerBtn.onclick = toggleTimerModal;
if (closeTimerModalBtn) closeTimerModalBtn.onclick = toggleTimerModal;
if (timerOverlay) timerOverlay.onclick = toggleTimerModal;
if (startTimerBtn) {
    startTimerBtn.onclick = () => {
        const mins = parseInt(timerMinutesInput?.value);
        if (!isNaN(mins) && mins > 0) window.setTimer(mins);
        else showNotification('LỖI:', 'NHẬP SỐ PHÚT HỢP LỆ!', '#ff4444', 'alert-circle');
    };
}
if (cancelTimerBtn) {
    cancelTimerBtn.onclick = () => {
        cancelTimer();
        toggleTimerModal();
    };
}
if (timerModal) timerModal.addEventListener('click', (e) => e.stopPropagation());

const observer = new ResizeObserver(() => autoScaleSongTitle());
if (songTitleEl && songTitleEl.parentElement) observer.observe(songTitleEl.parentElement);
document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && !audio.paused) await requestWakeLock();
});

const themeToggle = document.getElementById('theme-toggle');

function setThemeIcon(isDark) {
    if (!themeToggle) return;
    setLucideIcon(themeToggle, isDark ? 'moon' : 'sun');
}

function loadTheme() {
    const savedTheme = localStorage.getItem(storageKey(STORAGE_THEME));
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
        document.body.classList.add('dark');
        setThemeIcon(true);
    } else {
        document.body.classList.remove('dark');
        setThemeIcon(false);
    }
    applyGradientToSongTitle();
    applyGradientToArtistName();
}

function toggleTheme() {
    document.body.classList.add('no-transition');
    
    if (document.body.classList.contains('dark')) {
        document.body.classList.remove('dark');
        localStorage.setItem(storageKey(STORAGE_THEME), 'light');
        setThemeIcon(false);
        showNotification('LIGHT MODE:', 'ĐÃ CHUYỂN LIGHT', '#ff9800', 'sun');
    } else {
        document.body.classList.add('dark');
        localStorage.setItem(storageKey(STORAGE_THEME), 'dark');
        setThemeIcon(true);
        showNotification('DARK MODE:', 'ĐÃ CHUYỂN DARK', '#bb86fc', 'moon');
    }
    applyGradientToSongTitle();
    applyGradientToArtistName();
    
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            document.body.classList.remove('no-transition');
        });
    });
}

if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
loadTheme();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const savedTheme = localStorage.getItem(storageKey(STORAGE_THEME));
    if (!savedTheme) {
        if (e.matches) {
            document.body.classList.add('dark');
            setThemeIcon(true);
        } else {
            document.body.classList.remove('dark');
            setThemeIcon(false);
        }
        applyGradientToSongTitle();
        applyGradientToArtistName();
    }
});

const listenCountBtn = document.getElementById('listen-count-btn');
if (listenCountBtn) {
    listenCountBtn.onclick = (e) => {
        e.stopPropagation();
        showListenStats();
    };
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        persistListenTimeNow();
    }
});
window.addEventListener('pagehide', () => {
    persistListenTimeNow();
});
window.addEventListener('beforeunload', () => {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    persistListenTimeNow();
});

window.adjustLyricFontSize = adjustLyricFontSize;


window.selectSongFromList = selectSongFromList;

const DEMO_SECONDS = 60;

let sheetPricesCache = {};

async function syncSettingsFromFirebase() {
    try {
        const db = getDb();
        if (!db) return;
        const snap = await db.ref('settings').once('value');
        const val = snap.val();
        if (val && typeof val === 'object') {
            saveAdminSettings({ ...getAdminSettings(), ...val });
        }
        applyBranding();
    } catch (e) {
        console.warn('Không đồng bộ Settings Firebase:', e);
        applyBranding();
    }
}

function getSongPriceOverrides() {
    try {
        const raw = localStorage.getItem(storageKey(STORAGE_SONG_PRICES));
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

function saveSongPriceOverrides(map) {
    localStorage.setItem(storageKey(STORAGE_SONG_PRICES), JSON.stringify(map || {}));
    sheetPricesCache = { ...(map || {}) };
}

async function syncPricesFromFirebase() {
    try {
        const db = getDb();
        if (!db) return;
        const list = await fetchSongsFromFirebase();
        const map = {};
        list.forEach(s => {
            if (s.price != null && !Number.isNaN(Number(s.price))) {
                map[s.id] = Number(s.price);
            }
        });
        const snap = await db.ref(dataPath('prices')).once('value');
        const prices = snap.val() || {};
        Object.keys(prices).forEach(id => {
            map[id] = Number(prices[id]) || 0;
        });
        sheetPricesCache = map;
        localStorage.setItem(storageKey(STORAGE_SONG_PRICES), JSON.stringify(map));
    } catch (e) {
        console.warn('Không đồng bộ Prices Firebase:', e);
        sheetPricesCache = getSongPriceOverrides();
    }
}

function getAllAccounts() {
    try {
        const raw = localStorage.getItem(storageKey(STORAGE_ACCOUNTS));
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

function saveAllAccounts(accounts) {
    localStorage.setItem(storageKey(STORAGE_ACCOUNTS), JSON.stringify(accounts || {}));
}

function getCurrentUsername() {
    return (localStorage.getItem(storageKey(STORAGE_CURRENT_USER)) || '').trim();
}

function setCurrentUsername(name) {
    localStorage.setItem(storageKey(STORAGE_CURRENT_USER), String(name || '').trim());
}

function ensureUserAccount(username) {
    const name = String(username || '').trim();
    if (!name) return null;
    const accounts = getAllAccounts();
    const settings = getAdminSettings();
    if (!accounts[name]) {
        accounts[name] = {
            coins: settings.starterCoins,
            owned: [],
            favorites: [],
            likes: [],
            dislikes: [],
            myPlaylist: [],
            rentals: {},
            lastCheckin: '',
            checkinDays: {},
            createdAt: Date.now(),
            pin: '',
            banned: false,
            xp: 0,
            level: 1,
            seasonXp: 0,
            achievements: [],
            frame: '',
            streak: 0,
            streakFreeze: 0,
            listenedSongs: {},
            listenTime: { total: 0, byDay: {} },
            artRingOn: true,
            artRingText: '',
            artRingUntil: 0
        };
        saveAllAccounts(accounts);
    } else {
        const a = accounts[name];
        if (!Array.isArray(a.favorites)) a.favorites = [];
        if (!Array.isArray(a.likes)) a.likes = [];
        if (!Array.isArray(a.dislikes)) a.dislikes = [];
        if (!Array.isArray(a.myPlaylist)) a.myPlaylist = [];
        if (!a.rentals || typeof a.rentals !== 'object') a.rentals = {};
        if (a.artRingOn == null) a.artRingOn = true;
        if (a.artRingText == null) a.artRingText = '';
        if (a.artRingUntil == null) a.artRingUntil = 0;
        saveAllAccounts(accounts);
    }
    return accounts[name];
}

function sanitizeUsernameKey(name) {
    return String(name || '').trim().replace(/[.#$\[\]/]/g, '_');
}

function mapUserProfile(data, name) {
    const d = data || {};
    return {
        uid: d.uid || '',
        coins: d.coins | 0,
        owned: Array.isArray(d.owned) ? d.owned.map(String) : (d.owned ? String(d.owned).split(',').filter(Boolean) : []),
        favorites: Array.isArray(d.favorites) ? d.favorites.map(String) : [],
        likes: Array.isArray(d.likes) ? d.likes.map(String) : [],
        dislikes: Array.isArray(d.dislikes) ? d.dislikes.map(String) : [],
        myPlaylist: Array.isArray(d.myPlaylist) ? d.myPlaylist.map(String) : [],
        rentals: (d.rentals && typeof d.rentals === 'object') ? d.rentals : {},
        lastCheckin: d.lastCheckin || '',
        checkinDays: (d.checkinDays && typeof d.checkinDays === 'object') ? d.checkinDays : {},
        createdAt: d.createdAt || Date.now(),
        rank: d.rank || 'member',
        banned: !!d.banned,
        banReason: d.banReason || '',
        xp: Number(d.xp) || 0,
        level: Number(d.level) || 1,
        seasonXp: Number(d.seasonXp) || 0,
        achievements: Array.isArray(d.achievements) ? d.achievements.map(String) : [],
        frame: d.frame || '',
        streak: Number(d.streak) || 0,
        streakFreeze: Number(d.streakFreeze) || 0,
        listenedSongs: (d.listenedSongs && typeof d.listenedSongs === 'object') ? d.listenedSongs : {},
        listenTime: (d.listenTime && typeof d.listenTime === 'object') ? d.listenTime : { total: 0, byDay: {} },
        ownedThumbs: Array.isArray(d.ownedThumbs) ? d.ownedThumbs.map(String) : [],
        activeThumb: d.activeThumb || '',
        inviteBy: d.inviteBy || '',
        giftClaimCount: Number(d.giftClaimCount) || 0,
        chatCount: Number(d.chatCount) || 0,
        profiles: Array.isArray(d.profiles) ? d.profiles : [],
        artRingOn: d.artRingOn !== false,
        artRingText: typeof d.artRingText === 'string' ? d.artRingText : '',
        artRingUntil: Number(d.artRingUntil) || 0
    };
}

let _userProfileUnsub = null;
let _pendingOwnedAdds = Object.create(null);
let _pendingRentals = Object.create(null);
let _profileSyncedFromRemote = false;
const PENDING_OWNED_MS = 30000;
const PENDING_RENTAL_MS = 60000;

function markPendingOwned(songId) {
    _pendingOwnedAdds[String(songId)] = Date.now();
}

function consumePendingOwned(remoteOwned) {
    const remote = new Set((remoteOwned || []).map(String));
    const now = Date.now();
    const keep = [];
    Object.keys(_pendingOwnedAdds).forEach(id => {
        if (remote.has(id)) {
            delete _pendingOwnedAdds[id];
            return;
        }
        if (now - (_pendingOwnedAdds[id] || 0) > PENDING_OWNED_MS) {
            delete _pendingOwnedAdds[id];
            return;
        }
        keep.push(id);
    });
    return keep;
}

function mergeRentalsMap(a, b) {
    const out = Object.create(null);
    const now = Date.now();
    const apply = (src) => {
        if (!src || typeof src !== 'object') return;
        Object.keys(src).forEach(sid => {
            const exp = Number(src[sid]) || 0;
            if (exp <= now) return;
            const prev = Number(out[sid]) || 0;
            if (exp > prev) out[sid] = exp;
        });
    };
    apply(a);
    apply(b);
    return out;
}

function markPendingRental(songId, expiry) {
    const id = String(songId);
    const exp = Number(expiry) || 0;
    if (exp > Date.now()) _pendingRentals[id] = exp;
}

function consumePendingRentals(remoteRentals) {
    const now = Date.now();
    const remote = (remoteRentals && typeof remoteRentals === 'object') ? remoteRentals : {};
    const keep = Object.create(null);
    Object.keys(_pendingRentals).forEach(id => {
        const localExp = Number(_pendingRentals[id]) || 0;
        const remoteExp = Number(remote[id]) || 0;
        if (remoteExp >= localExp && remoteExp > now) {
            delete _pendingRentals[id];
            return;
        }
        if (localExp <= now) {
            delete _pendingRentals[id];
            return;
        }
        keep[id] = localExp;
    });
    return keep;
}

function stopUserProfileListener() {
    if (typeof _userProfileUnsub === 'function') {
        try { _userProfileUnsub(); } catch (e) {}
    }
    _userProfileUnsub = null;
}

function startUserProfileListener(uid) {
    stopUserProfileListener();
    const id = String(uid || '').trim();
    if (!id) return;
    const db = getDb();
    if (!db) return;
    const ref = db.ref(dataPath('users') + '/' + id);
    const handler = (snap) => {
        const data = snap.val();
        if (!data) return;
        const name = String(data.username || getCurrentUsername() || '').trim();
        if (!name) return;
        const accounts = getAllAccounts();
        const mapped = mapUserProfile(data, name);
        mapped.uid = id;
        const prev = accounts[name];
        const remoteOwned = filterOwnedIds(Array.isArray(mapped.owned) ? mapped.owned.map(String) : []);
        const pending = consumePendingOwned(remoteOwned);
        mapped.owned = filterOwnedIds(unionIdArrays(remoteOwned, unionIdArrays(pending, prev && prev.owned)));
        const pendingRent = consumePendingRentals(mapped.rentals);
        mapped.rentals = mergeRentalsMap(
            mergeRentalsMap(mapped.rentals, prev && prev.rentals),
            pendingRent
        );
        mapped.ownedThumbs = unionIdArrays(mapped.ownedThumbs, prev && prev.ownedThumbs);
        mapped.achievements = unionIdArrays(mapped.achievements, prev && prev.achievements);
        const preferRemoteList = (remote, local) => {
            const r = Array.isArray(remote) ? remote.map(String) : [];
            const l = Array.isArray(local) ? local.map(String) : [];
            if (r.length === 0 && l.length > 0) return l;
            return r;
        };
        mapped.favorites = preferRemoteList(mapped.favorites, prev && prev.favorites);
        mapped.myPlaylist = preferRemoteList(mapped.myPlaylist, prev && prev.myPlaylist);
        mapped.listenedSongs = mergeNumericMaps(mapped.listenedSongs, prev && prev.listenedSongs);
        mapped.checkinDays = mergeNumericMaps(mapped.checkinDays, prev && prev.checkinDays);
        mapped.listenTime = mergeListenTimeObj(mapped.listenTime, prev && prev.listenTime);
        mapped.xp = Math.max(Number(mapped.xp) || 0, Number(prev && prev.xp) || 0);
        mapped.level = Math.max(Number(mapped.level) || 1, Number(prev && prev.level) || 1);
        mapped.seasonXp = Math.max(Number(prev && prev.seasonXp) || 0, Number(mapped.seasonXp) || 0);
        mapped.streak = Math.max(Number(mapped.streak) || 0, Number(prev && prev.streak) || 0);
        mapped.giftClaimCount = Math.max(Number(mapped.giftClaimCount) || 0, Number(prev && prev.giftClaimCount) || 0);
        mapped.chatCount = Math.max(Number(mapped.chatCount) || 0, Number(prev && prev.chatCount) || 0);
        if (prev && prev.lastCheckin && (!mapped.lastCheckin || String(prev.lastCheckin) > String(mapped.lastCheckin))) {
            mapped.lastCheckin = prev.lastCheckin;
        }
        const prevCoins = prev ? (prev.coins | 0) : null;
        accounts[name] = mapped;
        saveAllAccounts(accounts);
        _profileSyncedFromRemote = true;
        if (getCurrentUsername() === name) {
            updateShopBalanceUI();
            if (typeof updateUsernameBadge === 'function') updateUsernameBadge();
            if (typeof updateCheckinButtonUI === 'function') updateCheckinButtonUI();
            if (typeof applyActiveProgressThumb === 'function') applyActiveProgressThumb();
            try {
                const modal = document.getElementById('shop-modal');
                if (modal && modal.classList.contains('show') && typeof renderShopList === 'function') {
                    renderShopList();
                }
            } catch (e) {}
        }
        if (prevCoins != null && prevCoins !== (mapped.coins | 0)) {
            console.log('[sync] coins từ Firebase:', prevCoins, '→', mapped.coins | 0);
        }
    };
    ref.on('value', handler);
    _userProfileUnsub = () => ref.off('value', handler);
}

async function fetchUserByUid(uid, usernameHint) {
    const id = String(uid || '').trim();
    if (!id) return null;
    try {
        const db = getDb();
        if (!db) throw new Error('No DB');
        const snap = await db.ref(dataPath('users') + '/' + id).once('value');
        const data = snap.val();
        if (!data) return null;
        const remoteName = String(data.username || '').trim();
        const hint = String(usernameHint || '').trim();
        const name = remoteName || hint;
        if (!name) return null;
        if (remoteName && hint && remoteName.toLowerCase() !== hint.toLowerCase()) {
            console.warn('[sync] username lệch: local="' + hint + '" firebase="' + remoteName + '" → dùng Firebase');
        }
        const accounts = getAllAccounts();
        const prevLocal = accounts[name];
        Object.keys(accounts).forEach(k => {
            const a = accounts[k];
            if (!a) return;
            if (String(a.uid || '') === id && k !== name) {
                delete accounts[k];
            }
        });
        const mapped = mapUserProfile(data, name);
        mapped.uid = id;
        const remoteRentalsBefore = mapped.rentals || {};
        const pendingRent = consumePendingRentals(mapped.rentals);
        mapped.rentals = mergeRentalsMap(
            mergeRentalsMap(mapped.rentals, prevLocal && prevLocal.rentals),
            pendingRent
        );
        const remoteOwned = filterOwnedIds(Array.isArray(mapped.owned) ? mapped.owned.map(String) : []);
        const pendingOwned = consumePendingOwned(remoteOwned);
        mapped.owned = filterOwnedIds(unionIdArrays(remoteOwned, unionIdArrays(pendingOwned, prevLocal && prevLocal.owned)));
        mapped.ownedThumbs = unionIdArrays(mapped.ownedThumbs, prevLocal && prevLocal.ownedThumbs);
        mapped.achievements = unionIdArrays(mapped.achievements, prevLocal && prevLocal.achievements);
        const preferRemoteList = (remote, local) => {
            const r = Array.isArray(remote) ? remote.map(String) : [];
            const l = Array.isArray(local) ? local.map(String) : [];
            if (r.length === 0 && l.length > 0) return l;
            return r.length ? r : l;
        };
        mapped.favorites = preferRemoteList(mapped.favorites, prevLocal && prevLocal.favorites);
        mapped.myPlaylist = preferRemoteList(mapped.myPlaylist, prevLocal && prevLocal.myPlaylist);
        mapped.listenedSongs = mergeNumericMaps(mapped.listenedSongs, prevLocal && prevLocal.listenedSongs);
        mapped.checkinDays = mergeNumericMaps(mapped.checkinDays, prevLocal && prevLocal.checkinDays);
        mapped.listenTime = mergeListenTimeObj(mapped.listenTime, prevLocal && prevLocal.listenTime);
        mapped.xp = Math.max(Number(mapped.xp) || 0, Number(prevLocal && prevLocal.xp) || 0);
        mapped.level = Math.max(Number(mapped.level) || 1, Number(prevLocal && prevLocal.level) || 1);
        mapped.seasonXp = Math.max(Number(mapped.seasonXp) || 0, Number(prevLocal && prevLocal.seasonXp) || 0);
        mapped.streak = Math.max(Number(mapped.streak) || 0, Number(prevLocal && prevLocal.streak) || 0);
        mapped.giftClaimCount = Math.max(Number(mapped.giftClaimCount) || 0, Number(prevLocal && prevLocal.giftClaimCount) || 0);
        mapped.chatCount = Math.max(Number(mapped.chatCount) || 0, Number(prevLocal && prevLocal.chatCount) || 0);
        if (prevLocal && prevLocal.lastCheckin && (!mapped.lastCheckin || String(prevLocal.lastCheckin) > String(mapped.lastCheckin))) {
            mapped.lastCheckin = prevLocal.lastCheckin;
        }
        accounts[name] = mapped;
        saveAllAccounts(accounts);
        if (getCurrentUsername() !== name) {
            setCurrentUsername(name);
        }
        _profileSyncedFromRemote = true;
        startUserProfileListener(id);
        try {
            pushUserToFirebase(name, mapped, {
                forceAll: true,
                coinsDelta: 0
            });
        } catch (e) {}
        return accounts[name];
    } catch (e) {
        console.warn('fetchUserByUid', e);
        return null;
    }
}

async function fetchUserFromFirebase(username) {
    const name = String(username || '').trim();
    if (!name) return null;
    const uid = getCurrentUid();
    if (uid) {
        const byUid = await fetchUserByUid(uid, name);
        if (byUid) return byUid;
    }
    try {
        const db = getDb();
        if (!db) throw new Error('No DB');
        const key = sanitizeUsernameKey(name);
        const mapSnap = await db.ref(dataPath('usernames') + '/' + key).once('value');
        const map = mapSnap.val();
        if (map && map.uid) {
            return await fetchUserByUid(map.uid, name);
        }
    } catch (e) {
        console.warn('Lấy user Firebase thất bại, dùng local:', e);
    }
    return ensureUserAccount(name);
}

function buildUserPayload(uid, name, account, includeCoins) {
    const payload = {
        uid: uid,
        username: name,
        owned: account.owned || [],
        favorites: account.favorites || [],
        likes: account.likes || [],
        dislikes: account.dislikes || [],
        myPlaylist: account.myPlaylist || [],
        rentals: account.rentals || {},
        lastCheckin: account.lastCheckin || '',
        checkinDays: account.checkinDays || {},
        createdAt: account.createdAt || Date.now(),
        xp: Number(account.xp) || 0,
        level: Number(account.level) || 1,
        seasonXp: Number(account.seasonXp) || 0,
        achievements: account.achievements || [],
        frame: account.frame || '',
        streak: Number(account.streak) || 0,
        streakFreeze: Number(account.streakFreeze) || 0,
        listenedSongs: account.listenedSongs || {},
        listenTime: account.listenTime || { total: 0, byDay: {} },
        ownedThumbs: account.ownedThumbs || [],
        activeThumb: account.activeThumb || '',
        inviteBy: account.inviteBy || ''
    };
    if (includeCoins !== false) {
        payload.coins = account.coins | 0;
    }
    return payload;
}

function unionIdArrays(a, b) {
    const out = new Set();
    (Array.isArray(a) ? a : []).forEach(x => { if (x != null && String(x)) out.add(String(x)); });
    (Array.isArray(b) ? b : []).forEach(x => { if (x != null && String(x)) out.add(String(x)); });
    return [...out];
}

function getCatalogSongIdSet() {
    const set = new Set();
    const list = (typeof songs !== 'undefined' && Array.isArray(songs)) ? songs : [];
    list.forEach(s => {
        if (!s) return;
        [s.id, s._fbKey].forEach(raw => {
            const id = String(raw == null ? '' : raw).trim();
            if (!id) return;
            set.add(id);
            set.add(id.toLowerCase());
        });
    });
    return set;
}

function filterOwnedIds(ids) {
    const raw = (Array.isArray(ids) ? ids : []).map(x => String(x == null ? '' : x).trim()).filter(Boolean);
    const catalog = getCatalogSongIdSet();
    const seen = new Set();
    const out = [];
    raw.forEach(id => {
        const low = id.toLowerCase();
        if (seen.has(low)) return;
        if (catalog.size > 0 && !catalog.has(id) && !catalog.has(low)) return;
        seen.add(low);
        out.push(id);
    });
    return out;
}

function scrubOwnedAgainstCatalog() {
    try {
        if (!getCatalogSongIdSet().size) return;
        const name = (typeof getCurrentUsername === 'function' && getCurrentUsername()) || '';
        const acc = typeof getCurrentAccount === 'function' ? getCurrentAccount() : null;
        if (!acc || !Array.isArray(acc.owned)) return;
        const before = acc.owned.map(String);
        const cleaned = filterOwnedIds(before);
        if (cleaned.length === before.length) {
            const b = new Set(before.map(x => x.toLowerCase()));
            const c = new Set(cleaned.map(x => x.toLowerCase()));
            if (b.size === c.size && [...b].every(x => c.has(x))) return;
        }
        updateCurrentAccount(a => { a.owned = cleaned; });
        if (name && typeof pushUserToFirebase === 'function') {
            pushUserToFirebase(name, getCurrentAccount(), { ownedChanged: true });
        }
        console.log('[owned] đã lọc ID mồ côi:', before.length, '→', cleaned.length);
    } catch (e) {
        console.warn('[owned] scrub', e);
    }
}

function mergeNumericMaps(a, b) {
    const out = Object.create(null);
    const apply = (src) => {
        if (!src || typeof src !== 'object') return;
        Object.keys(src).forEach(k => {
            const v = src[k];
            if (v === true) { out[k] = true; return; }
            const n = Number(v);
            if (!Number.isFinite(n)) {
                if (v != null && out[k] == null) out[k] = v;
                return;
            }
            const prev = Number(out[k]);
            out[k] = Number.isFinite(prev) ? Math.max(prev, n) : n;
        });
    };
    apply(a);
    apply(b);
    return out;
}

async function txUnionArrayField(db, uid, field, localArr) {
    const ref = db.ref(dataPath('users') + '/' + uid + '/' + field);
    let local = (Array.isArray(localArr) ? localArr : []).map(String);
    if (field === 'owned') local = filterOwnedIds(local);
    const tx = await ref.transaction((current) => {
        let remote = Array.isArray(current) ? current.map(String) : [];
        if (field === 'owned') remote = filterOwnedIds(remote);
        const merged = unionIdArrays(remote, local);
        return field === 'owned' ? filterOwnedIds(merged) : merged;
    });
    if (tx.committed) {
        const val = Array.isArray(tx.snapshot.val()) ? tx.snapshot.val().map(String) : local;
        return field === 'owned' ? filterOwnedIds(val) : val;
    }
    return local;
}

async function pushUserToFirebase(username, account, options) {
    const name = String(username || '').trim();
    if (!name || !account) return false;
    const uid = getCurrentUid() || account.uid || '';
    if (!uid) {
        console.warn('pushUser: chưa có uid (chưa Auth)');
        return false;
    }
    if (account.uid && account.uid !== uid) {
        console.warn('[sync] account.uid lệch Auth, sửa:', account.uid, '→', uid);
        account.uid = uid;
    }
    const opts = options || {};
    const forceAll = !!opts.forceAll;
    try {
        const db = getDb();
        if (!db) return false;
        const userRef = db.ref(dataPath('users') + '/' + uid);
        const accounts = getAllAccounts();

        await userRef.update({ uid: uid, username: name });

        if ((opts.ownedChanged || forceAll) && Array.isArray(account.owned)) {
            const merged = await txUnionArrayField(db, uid, 'owned', account.owned);
            account.owned = merged;
            if (accounts[name]) { accounts[name].owned = merged; saveAllAccounts(accounts); }
            // ownedMap phục vụ Firebase Rules đọc songFulls
            try {
                const map = {};
                (merged || []).forEach(id => { map[String(id)] = true; });
                await db.ref(dataPath('users') + '/' + uid + '/ownedMap').set(map);
            } catch (e) { console.warn('ownedMap sync', e); }
        }

        if ((opts.rentalsChanged || forceAll) && account.rentals && typeof account.rentals === 'object') {
            const localRentals = account.rentals;
            const rentalsRef = db.ref(dataPath('users') + '/' + uid + '/rentals');
            const txRent = await rentalsRef.transaction((current) => mergeRentalsMap(current, localRentals));
            if (txRent.committed) {
                const merged = mergeRentalsMap(txRent.snapshot.val(), localRentals);
                account.rentals = merged;
                if (accounts[name]) { accounts[name].rentals = merged; saveAllAccounts(accounts); }
            }
        }

        if ((opts.ownedThumbsChanged || forceAll) && Array.isArray(account.ownedThumbs)) {
            const merged = await txUnionArrayField(db, uid, 'ownedThumbs', account.ownedThumbs);
            account.ownedThumbs = merged;
            if (accounts[name]) { accounts[name].ownedThumbs = merged; saveAllAccounts(accounts); }
        }
        if ((opts.achievementsChanged || forceAll) && Array.isArray(account.achievements)) {
            const merged = await txUnionArrayField(db, uid, 'achievements', account.achievements);
            account.achievements = merged;
            if (accounts[name]) { accounts[name].achievements = merged; saveAllAccounts(accounts); }
        }

        const arrayReplaceOrUnion = async (field, localArr, changedFlag) => {
            if (!(opts[changedFlag] || forceAll)) return;
            const local = (Array.isArray(localArr) ? localArr : []).map(String);
            if (forceAll && !opts[changedFlag]) {
                const merged = await txUnionArrayField(db, uid, field, local);
                account[field] = merged;
                if (accounts[name]) { accounts[name][field] = merged; saveAllAccounts(accounts); }
            } else {
                await db.ref(dataPath('users') + '/' + uid + '/' + field).set(local);
            }
        };
        await arrayReplaceOrUnion('favorites', account.favorites, 'favoritesChanged');
        await arrayReplaceOrUnion('myPlaylist', account.myPlaylist, 'myPlaylistChanged');
        await arrayReplaceOrUnion('likes', account.likes, 'likesChanged');
        await arrayReplaceOrUnion('dislikes', account.dislikes, 'dislikesChanged');

        const mergeMapField = async (field, localMap, changedFlag) => {
            if (!(opts[changedFlag] || forceAll)) return;
            const local = (localMap && typeof localMap === 'object') ? localMap : {};
            const ref = db.ref(dataPath('users') + '/' + uid + '/' + field);
            const tx = await ref.transaction((current) => mergeNumericMaps(current, local));
            if (tx.committed && tx.snapshot.val()) {
                account[field] = tx.snapshot.val();
                if (accounts[name]) { accounts[name][field] = account[field]; saveAllAccounts(accounts); }
            }
        };
        await mergeMapField('listenedSongs', account.listenedSongs, 'listenedSongsChanged');
        await mergeMapField('checkinDays', account.checkinDays, 'checkinChanged');
        if (opts.listenTimeChanged || forceAll) {
            const local = (account.listenTime && typeof account.listenTime === 'object')
                ? account.listenTime
                : { total: 0, byDay: {} };
            const ref = db.ref(dataPath('users') + '/' + uid + '/listenTime');
            const tx = await ref.transaction((current) => {
                const cur = (current && typeof current === 'object') ? current : { total: 0, byDay: {} };
                const byDay = mergeNumericMaps(cur.byDay, local.byDay);
                let total = 0;
                Object.keys(byDay).forEach(k => { total += Number(byDay[k]) || 0; });
                total = Math.max(total, Number(cur.total) || 0, Number(local.total) || 0);
                return { total, byDay };
            });
            if (tx.committed && tx.snapshot.val()) {
                account.listenTime = tx.snapshot.val();
                if (accounts[name]) { accounts[name].listenTime = account.listenTime; saveAllAccounts(accounts); }
            }
        }

        const scalarPayload = {};
        if (opts.checkinChanged || forceAll) {
            scalarPayload.lastCheckin = account.lastCheckin || '';
            scalarPayload.streak = Number(account.streak) || 0;
            scalarPayload.streakFreeze = Number(account.streakFreeze) || 0;
        }
        if (opts.xpChanged || forceAll) {
            scalarPayload.xp = Number(account.xp) || 0;
            scalarPayload.level = Number(account.level) || 1;
            scalarPayload.seasonXp = Number(account.seasonXp) || 0;
        }
        if (opts.activeThumbChanged || forceAll) {
            scalarPayload.activeThumb = account.activeThumb || '';
            scalarPayload.frame = account.frame || '';
        }
        if (opts.artRingChanged || forceAll) {
            scalarPayload.artRingOn = account.artRingOn !== false;
            scalarPayload.artRingText = String(account.artRingText || '').slice(0, 28);
            scalarPayload.artRingUntil = Math.max(0, Number(account.artRingUntil) || 0);
        }
        if (opts.inviteChanged || forceAll) {
            if (account.inviteBy) scalarPayload.inviteBy = account.inviteBy;
        }
        if (opts.countersChanged || forceAll) {
            const gLocal = Math.max(0, Number(account.giftClaimCount) || 0);
            const cLocal = Math.max(0, Number(account.chatCount) || 0);
            try {
                await db.ref(dataPath('users') + '/' + uid + '/giftClaimCount').transaction(cur =>
                    Math.max(Number(cur) || 0, gLocal)
                );
                await db.ref(dataPath('users') + '/' + uid + '/chatCount').transaction(cur =>
                    Math.max(Number(cur) || 0, cLocal)
                );
            } catch (e) {
                scalarPayload.giftClaimCount = gLocal;
                scalarPayload.chatCount = cLocal;
            }
        }
        if (account.createdAt) scalarPayload.createdAt = account.createdAt;
        if (Object.keys(scalarPayload).length) {
            if (scalarPayload.xp != null) {
                const xpRef = db.ref(dataPath('users') + '/' + uid + '/xp');
                const localXp = Number(scalarPayload.xp) || 0;
                await xpRef.transaction((cur) => Math.max(Number(cur) || 0, localXp));
                delete scalarPayload.xp;
                const levelRef = db.ref(dataPath('users') + '/' + uid + '/level');
                const localLv = Number(scalarPayload.level) || 1;
                await levelRef.transaction((cur) => Math.max(Number(cur) || 1, localLv));
                delete scalarPayload.level;
                if (scalarPayload.seasonXp != null) {
                    const sRef = db.ref(dataPath('users') + '/' + uid + '/seasonXp');
                    const localS = Number(scalarPayload.seasonXp) || 0;
                    await sRef.transaction((cur) => Math.max(Number(cur) || 0, localS));
                    delete scalarPayload.seasonXp;
                }
            }
            if (Object.keys(scalarPayload).length) {
                await userRef.update(scalarPayload);
            }
        }

        if (typeof opts.coinsDelta === 'number' && opts.coinsDelta !== 0) {
            const coinsRef = db.ref(dataPath('users') + '/' + uid + '/coins');
            const tx = await coinsRef.transaction((current) => {
                const cur = Number(current);
                const base = Number.isFinite(cur) ? cur : 0;
                return Math.max(0, base + opts.coinsDelta);
            });
            if (tx.committed) {
                account.coins = Number(tx.snapshot.val()) || 0;
                if (accounts[name]) {
                    accounts[name].coins = account.coins;
                    saveAllAccounts(accounts);
                }
                if (typeof updateShopBalanceUI === 'function') updateShopBalanceUI();
            }
        }

        const key = sanitizeUsernameKey(name);
        await db.ref(dataPath('usernames') + '/' + key).set({ uid: uid, username: name });
        return true;
    } catch (e) {
        console.warn('Lưu user Firebase thất bại:', e);
        return false;
    }
}

const fetchUserFromSheet = fetchUserFromFirebase;
const pushUserToSheet = pushUserToFirebase;

function getCurrentAccount() {
    const name = getCurrentUsername();
    if (!name) return null;
    const acc = ensureUserAccount(name);
    const authUid = getCurrentUid();
    if (acc && authUid && acc.uid && acc.uid !== authUid) {
        console.warn('[sync] getCurrentAccount uid lệch, sửa local:', acc.uid, '→', authUid);
        acc.uid = authUid;
        const accounts = getAllAccounts();
        if (accounts[name]) {
            accounts[name].uid = authUid;
            saveAllAccounts(accounts);
        }
    } else if (acc && authUid && !acc.uid) {
        acc.uid = authUid;
    }
    return acc;
}

function updateCurrentAccount(mutator) {
    const name = getCurrentUsername();
    if (!name) return null;
    const accounts = getAllAccounts();
    if (!accounts[name]) {
        const settings = getAdminSettings();
        accounts[name] = {
            coins: settings.starterCoins, owned: [], rentals: {}, favorites: [],
            myPlaylist: [], ownedThumbs: [], achievements: [], lastCheckin: '', createdAt: Date.now()
        };
    }
    const acc = accounts[name];
    const snap = (v) => JSON.stringify(v == null ? null : v);
    const before = {
        coins: acc.coins | 0,
        owned: snap((acc.owned || []).map(String).sort()),
        rentals: snap(acc.rentals || {}),
        favorites: snap((acc.favorites || []).map(String).sort()),
        myPlaylist: snap((acc.myPlaylist || []).map(String).sort()),
        likes: snap((acc.likes || []).map(String).sort()),
        dislikes: snap((acc.dislikes || []).map(String).sort()),
        ownedThumbs: snap((acc.ownedThumbs || []).map(String).sort()),
        achievements: snap((acc.achievements || []).map(String).sort()),
        listenedSongs: snap(acc.listenedSongs || {}),
        listenTime: snap(acc.listenTime || {}),
        checkin: snap({ last: acc.lastCheckin, days: acc.checkinDays, streak: acc.streak, freeze: acc.streakFreeze }),
        xp: snap({ xp: acc.xp, level: acc.level, seasonXp: acc.seasonXp }),
        activeThumb: snap({ t: acc.activeThumb, f: acc.frame }),
        artRing: snap({ on: acc.artRingOn !== false, t: acc.artRingText || '', u: acc.artRingUntil || 0 }),
        inviteBy: snap(acc.inviteBy || ''),
        counters: snap({ gift: acc.giftClaimCount, chat: acc.chatCount })
    };
    mutator(acc);
    const afterCoins = acc.coins | 0;
    const opts = {
        coinsDelta: afterCoins - before.coins,
        ownedChanged: before.owned !== snap((acc.owned || []).map(String).sort()),
        rentalsChanged: before.rentals !== snap(acc.rentals || {}),
        favoritesChanged: before.favorites !== snap((acc.favorites || []).map(String).sort()),
        myPlaylistChanged: before.myPlaylist !== snap((acc.myPlaylist || []).map(String).sort()),
        likesChanged: before.likes !== snap((acc.likes || []).map(String).sort()),
        dislikesChanged: before.dislikes !== snap((acc.dislikes || []).map(String).sort()),
        ownedThumbsChanged: before.ownedThumbs !== snap((acc.ownedThumbs || []).map(String).sort()),
        achievementsChanged: before.achievements !== snap((acc.achievements || []).map(String).sort()),
        listenedSongsChanged: before.listenedSongs !== snap(acc.listenedSongs || {}),
        listenTimeChanged: before.listenTime !== snap(acc.listenTime || {}),
        checkinChanged: before.checkin !== snap({ last: acc.lastCheckin, days: acc.checkinDays, streak: acc.streak, freeze: acc.streakFreeze }),
        xpChanged: before.xp !== snap({ xp: acc.xp, level: acc.level, seasonXp: acc.seasonXp }),
        activeThumbChanged: before.activeThumb !== snap({ t: acc.activeThumb, f: acc.frame }),
        artRingChanged: before.artRing !== snap({ on: acc.artRingOn !== false, t: acc.artRingText || '', u: acc.artRingUntil || 0 }),
        inviteChanged: before.inviteBy !== snap(acc.inviteBy || ''),
        countersChanged: before.counters !== snap({ gift: acc.giftClaimCount, chat: acc.chatCount })
    };
    saveAllAccounts(accounts);
    pushUserToFirebase(name, acc, opts);
    return acc;
}

function getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadCoins() {
    const acc = getCurrentAccount();
    return acc ? (acc.coins | 0) : 0;
}

function saveCoins(n) {
    updateCurrentAccount(acc => { acc.coins = Math.max(0, n | 0); });
    updateShopBalanceUI();
    updateUsernameBadge();
        if (typeof applyActiveProgressThumb === "function") applyActiveProgressThumb();
}

function loadOwnedSongs() {
    const acc = getCurrentAccount();
    return acc && Array.isArray(acc.owned) ? acc.owned.map(String) : [];
}

function saveOwnedSongs(ids) {
    updateCurrentAccount(acc => {
        acc.owned = filterOwnedIds(ids);
    });
}

function isSongOwned(songId) {
    if (songId == null || songId === '') return true;
    const id = String(songId);
    if (loadOwnedSongs().includes(id)) return true;
    if (_pendingOwnedAdds[id] && (Date.now() - (_pendingOwnedAdds[id] || 0) < PENDING_OWNED_MS)) {
        return true;
    }
    const acc = getCurrentAccount();
    if (acc && acc.rentals && acc.rentals[id]) {
        const exp = Number(acc.rentals[id]) || 0;
        if (exp > Date.now()) return true;
    }
    if (isSongRented(id)) return true;
    return false;
}

function isSongRented(songId) {
    const id = String(songId);
    const now = Date.now();
    const acc = getCurrentAccount();
    const fromAcc = acc && acc.rentals ? Number(acc.rentals[id]) || 0 : 0;
    const fromPending = Number(_pendingRentals[id]) || 0;
    return Math.max(fromAcc, fromPending) > now;
}

function getRentExpiry(songId) {
    const id = String(songId);
    const acc = getCurrentAccount();
    const fromAcc = acc && acc.rentals ? Number(acc.rentals[id]) || 0 : 0;
    const fromPending = Number(_pendingRentals[id]) || 0;
    return Math.max(fromAcc, fromPending);
}

/** Gói thuê: 1 / 3 / 5 / 7 ngày */
const RENT_DAY_OPTIONS = [1];

/** Giá thuê 1 ngày (base) — từ rentPrice bài hoặc 40% giá mua */
function getRentPrice(song) {
    if (song && song.rentPrice != null && !Number.isNaN(Number(song.rentPrice))) {
        return Math.max(0, Number(song.rentPrice));
    }
    const buy = getSongPrice(song);
    return Math.max(1, Math.ceil(buy * 0.4));
}

/**
 * Giá thuê theo số ngày (có giảm nhẹ gói dài):
 * 1 ngày = base
 * 3 ngày ≈ base × 2.7
 * 5 ngày ≈ base × 4.2
 * 7 ngày ≈ base × 5.5
 */
function getRentPriceForDays(song, days) {
    const d = Math.max(1, Number(days) || 1);
    const base = getRentPrice(song);
    if (d <= 1) return base;
    const multipliers = { 3: 2.7, 5: 4.2, 7: 5.5 };
    const m = multipliers[d] != null ? multipliers[d] : (d * (1 - Math.min(0.25, (d - 1) * 0.04)));
    return Math.max(base, Math.ceil(base * m));
}

function formatRentCountdown(expMs) {
    let left = Math.max(0, (Number(expMs) || 0) - Date.now());
    if (left <= 0) return 'HẾT HẠN THUÊ';
    const day = Math.floor(left / 86400000);
    const h = Math.floor((left % 86400000) / 3600000);
    const mi = Math.floor((left % 3600000) / 60000);
    const s = Math.floor((left % 60000) / 1000);
    const hh = String(h).padStart(2, '0');
    const mm = String(mi).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    // Đầy đủ: ngày + giờ + phút + giây
    if (day > 0) {
        return 'THUÊ ' + day + 'n ' + hh + 'g ' + mm + 'p ' + ss + 's';
    }
    return 'THUÊ ' + hh + 'g ' + mm + 'p ' + ss + 's';
}

function rentSong(songId, days) {
    if (!getCurrentUsername()) {
        showNotification('LỖI:', 'CHƯA ĐĂNG NHẬP USERNAME', '#ff4444', 'user');
        return false;
    }
    const song = songs.find(s => String(s.id) === String(songId));
    if (!song) {
        showNotification('LỖI:', 'KHÔNG TÌM THẤY BÀI HÁT', '#ff4444', 'alert-circle');
        return false;
    }
    if (loadOwnedSongs().includes(String(songId))) {
        showNotification('CỬA HÀNG:', 'BẠN ĐÃ MUA BÀI NÀY', '#4ade80', 'check');
        return false;
    }
    const d = RENT_DAY_OPTIONS.includes(Number(days)) ? Number(days) : 1;
    const price = getRentPriceForDays(song, d);
    const coins = loadCoins();
    if (coins < price) {
        showNotification('THIẾU XK:', `THUÊ 24H CẦN ${price} XK — ĐANG CÓ ${coins} XK`, '#ff9800', 'coins');
        return false;
    }
    // Gia hạn: cộng thêm từ hạn hiện tại (nếu còn) hoặc từ bây giờ
    const now = Date.now();
    const curExp = getRentExpiry(songId);
    const baseStart = curExp > now ? curExp : now;
    const expiry = baseStart + d * 24 * 60 * 60 * 1000;
    const wasRented = curExp > now;
    markPendingRental(songId, expiry);
    updateCurrentAccount(acc => {
        acc.coins = (acc.coins | 0) - price;
        if (!acc.rentals) acc.rentals = {};
        acc.rentals[String(songId)] = expiry;
    });
    showNotification(
        wasRented ? ('GIA HẠN +24H:') : ('THUÊ 24H:'),
        '<i class="fa-regular fa-star"></i> ' + String(songId) + ' <i class="fa-regular fa-star"></i>',
        '#4ade80',
        'clock'
    );
    renderShopList();
    if (typeof renderShopThumbs === 'function') renderShopThumbs();
    updateShopBalanceUI();
    const isCurrentOrDemo = (songs[index] && String(songs[index].id) === String(songId))
        || (demoLockedSongId != null && String(demoLockedSongId) === String(songId));
    if (isCurrentOrDemo) {
        const songIdx = songs.findIndex(s => String(s.id) === String(songId));
        if (songIdx !== -1) index = songIdx;
        demoLockedSongId = null;
        (async () => {
            try {
                const full = await fetchSongFull(songId);
                if (full && songs[index] && String(songs[index].id) === String(songId)) {
                    songs[index].audioFull = full.audioFull || '';
                    songs[index].audioFull2 = full.audioFull2 || '';
                }
            } catch (e) {}
            const fullUrl = getPlayableAudio(songs[index]);
            if (!fullUrl) return;
            audio.src = fullUrl;
            audio.load();
            const seekPlay = () => {
                try {
                    const seekTo = Math.min(DEMO_SECONDS, (audio.duration || DEMO_SECONDS) - 0.5);
                    audio.currentTime = Math.max(0, seekTo);
                } catch (e) {}
                audio.play().catch(() => {});
                if (typeof updateProgressUI === 'function') updateProgressUI();
            };
            audio.addEventListener('loadedmetadata', function once() {
                audio.removeEventListener('loadedmetadata', once);
                seekPlay();
            });
            if (audio.readyState >= 1) seekPlay();
        })();
    }
    return true;
}

function loadFavorites() {
    const acc = getCurrentAccount();
    return acc && Array.isArray(acc.favorites) ? acc.favorites.map(String) : [];
}
function isFavorite(id) { return loadFavorites().includes(String(id)); }
function toggleFavorite(id) {
    if (!getCurrentUsername()) {
        showNotification('LỖI:', 'CHƯA ĐĂNG NHẬP USERNAME', '#ff4444', 'user');
        return;
    }
    const sid = String(id);
    updateCurrentAccount(acc => {
        if (!Array.isArray(acc.favorites)) acc.favorites = [];
        const i = acc.favorites.indexOf(sid);
        if (i >= 0) acc.favorites.splice(i, 1);
        else acc.favorites.push(sid);
    });
    renderPlaylist();
    if (typeof window.xkExtras !== 'undefined' && typeof window.xkExtras.checkAchievements === 'function') {
        try { window.xkExtras.checkAchievements(); } catch (e) {}
    }
}

function loadLikes() {
    const acc = getCurrentAccount();
    return acc && Array.isArray(acc.likes) ? acc.likes.map(String) : [];
}
function isLiked(id) { return loadLikes().includes(String(id)); }
function toggleLike(id) {
    if (!getCurrentUsername()) {
        showNotification('LỖI:', 'CHƯA ĐĂNG NHẬP USERNAME', '#ff4444', 'user');
        return;
    }
    const sid = String(id);
    updateCurrentAccount(acc => {
        if (!Array.isArray(acc.likes)) acc.likes = [];
        if (!Array.isArray(acc.dislikes)) acc.dislikes = [];
        const i = acc.likes.indexOf(sid);
        if (i >= 0) acc.likes.splice(i, 1);
        else {
            acc.likes.push(sid);
            const d = acc.dislikes.indexOf(sid);
            if (d >= 0) acc.dislikes.splice(d, 1);
        }
    });
    renderPlaylist();
}

function loadDislikes() {
    const acc = getCurrentAccount();
    return acc && Array.isArray(acc.dislikes) ? acc.dislikes.map(String) : [];
}
function isDisliked(id) { return loadDislikes().includes(String(id)); }
function toggleDislike(id) {
    if (!getCurrentUsername()) {
        showNotification('LỖI:', 'CHƯA ĐĂNG NHẬP USERNAME', '#ff4444', 'user');
        return;
    }
    const sid = String(id);
    updateCurrentAccount(acc => {
        if (!Array.isArray(acc.dislikes)) acc.dislikes = [];
        if (!Array.isArray(acc.likes)) acc.likes = [];
        const i = acc.dislikes.indexOf(sid);
        if (i >= 0) acc.dislikes.splice(i, 1);
        else {
            acc.dislikes.push(sid);
            const l = acc.likes.indexOf(sid);
            if (l >= 0) acc.likes.splice(l, 1);
        }
    });
    renderPlaylist();
}

function loadMyPlaylist() {
    const acc = getCurrentAccount();
    return acc && Array.isArray(acc.myPlaylist) ? acc.myPlaylist.map(String) : [];
}
function isInMyPlaylist(id) { return loadMyPlaylist().includes(String(id)); }
function toggleMyPlaylistSong(id) {
    if (!getCurrentUsername()) {
        showNotification('LỖI:', 'CHƯA ĐĂNG NHẬP USERNAME', '#ff4444', 'user');
        return;
    }
    const sid = String(id);
    let added = false;
    updateCurrentAccount(acc => {
        if (!Array.isArray(acc.myPlaylist)) acc.myPlaylist = [];
        const i = acc.myPlaylist.indexOf(sid);
        if (i >= 0) acc.myPlaylist.splice(i, 1);
        else { acc.myPlaylist.push(sid); added = true; }
    });
    showNotification('PLAYLIST:', added ? 'ĐÃ THÊM' : 'ĐÃ XÓA', added ? '#4ade80' : '#ff9800', 'list-plus');
    renderPlaylist();
    if (document.getElementById('my-playlist-overlay')?.classList.contains('active')) renderMyPlaylist();
    if (typeof window.xkExtras !== 'undefined' && typeof window.xkExtras.checkAchievements === 'function') {
        try { window.xkExtras.checkAchievements(); } catch (e) {}
    }
}

function getSongPrice(song) {
    const settings = getAdminSettings();
    const overrides = { ...getSongPriceOverrides(), ...sheetPricesCache };
    if (song && song.id != null && overrides[String(song.id)] != null) {
        const p = Number(overrides[String(song.id)]);
        if (!Number.isNaN(p) && p >= 0) return p;
    }
    if (song && song.price != null && song.price !== '') {
        const p = Number(song.price);
        if (!Number.isNaN(p) && p >= 0) return p;
    }
    let price = settings.songPrice;
    try {
        const pct = Number(settings.flashSalePercent) || 0;
        const until = settings.flashSaleUntil ? Date.parse(settings.flashSaleUntil) : 0;
        if (pct > 0 && pct < 100 && until && Date.now() < until) {
            price = Math.max(0, Math.round(price * (100 - pct) / 100));
        }
    } catch (e) {}
    return price;
}

function hasCheckedInToday() {
    const acc = getCurrentAccount();
    return !!(acc && acc.lastCheckin === getTodayKey());
}

function doDailyCheckin(dayKeyOpt) {
    if (!getCurrentUsername()) {
        showNotification('LỖI:', 'CHƯA ĐĂNG NHẬP USERNAME', '#ff4444', 'user');
        return false;
    }
    const today = getTodayKey();
    const dayKey = dayKeyOpt ? String(dayKeyOpt) : today;
    const now = new Date();
    const monthStart = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01';
    if (dayKey < monthStart || dayKey > today) {
        showNotification('ĐIỂM DANH:', 'Chỉ điểm danh trong tháng này đến hôm nay', '#ff9800', 'calendar-check');
        return false;
    }
    const acc0 = getCurrentAccount() || {};
    const days0 = (acc0.checkinDays && typeof acc0.checkinDays === 'object') ? acc0.checkinDays : {};
    if (days0[dayKey] || (dayKey === today && acc0.lastCheckin === today)) {
        showNotification('ĐIỂM DANH:', 'Ngày này đã điểm danh rồi', '#ff9800', 'calendar-check');
        return false;
    }
    const reward = Number(getAdminSettings().checkinReward) || 15;
    const isMakeup = dayKey !== today;
    const MAKEUP_COST = 5;
    if (isMakeup) {
        const coins = (acc0.coins | 0);
        if (coins < MAKEUP_COST) {
            showNotification('ĐIỂM DANH BÙ:', 'Cần ' + MAKEUP_COST + ' XK (đang có ' + coins + ')', '#ff9800', 'coins');
            return false;
        }
    }
    let streakMsg = '';
    updateCurrentAccount(acc => {
        if (!acc.checkinDays || typeof acc.checkinDays !== 'object') acc.checkinDays = {};
        // Lưu timestamp (số) — merge Firebase ổn định hơn boolean true
        if (acc.lastCheckin && !acc.checkinDays[acc.lastCheckin]) {
            acc.checkinDays[acc.lastCheckin] = Date.now();
        }
        acc.checkinDays[dayKey] = Date.now();
        let streak = Number(acc.streak) || 0;
        if (!isMakeup) {
            const y = new Date(); y.setDate(y.getDate() - 1);
            const yKey = y.getFullYear() + '-' + String(y.getMonth()+1).padStart(2,'0') + '-' + String(y.getDate()).padStart(2,'0');
            if (acc.lastCheckin === yKey || acc.checkinDays[yKey]) streak += 1;
            else if ((Number(acc.streakFreeze) || 0) > 0) {
                acc.streakFreeze = (Number(acc.streakFreeze) || 0) - 1;
                streak = Math.max(1, streak);
                streakMsg = ' (dùng 1 Streak Freeze)';
            } else {
                streak = 1;
            }
            acc.streak = streak;
            acc.lastCheckin = today;
            const bonus = Math.min(10, Math.floor(streak / 7) * 5);
            acc.coins = (acc.coins | 0) + reward + bonus;
            acc.xp = (Number(acc.xp) || 0) + 10;
            acc.seasonXp = (Number(acc.seasonXp) || 0) + 10;
            acc.level = Math.max(1, Math.floor((Number(acc.xp) || 0) / 100) + 1);
        } else {
            acc.coins = Math.max(0, (acc.coins | 0) - MAKEUP_COST);
            if (dayKey > (acc.lastCheckin || '')) acc.lastCheckin = dayKey;
        }
    });
    try {
        const name = getCurrentUsername();
        const accNow = getCurrentAccount();
        if (name && accNow && typeof pushUserToFirebase === 'function') {
            pushUserToFirebase(name, accNow, {
                checkinChanged: true,
                xpChanged: !isMakeup,
                coinsDelta: 0,
                achievementsChanged: false
            });
        }
    } catch (e) {}
    if (typeof window.xkExtras !== 'undefined' && typeof window.xkExtras.checkAchievements === 'function') {
        try { window.xkExtras.checkAchievements(); } catch (e) {}
    }
    const st = (getCurrentAccount() || {}).streak || 1;
    const label = isMakeup
        ? ('Bù ' + dayKey + ': -' + MAKEUP_COST + ' XK')
        : ('+' + reward + ' XK · Streak ' + st + streakMsg);
    showNotification('ĐIỂM DANH:', label, isMakeup ? '#f87171' : '#4ade80', 'coins');
    updateCheckinButtonUI();
    updateShopBalanceUI();
    updateUsernameBadge();
    if (typeof window.renderCheckinCalendar === 'function') window.renderCheckinCalendar();
    return true;
}

function markShopItemOwnedUI(songId) {
    const id = String(songId);
    const list = document.getElementById('shop-list');
    if (!list) return;
    const item = list.querySelector('.shop-item[data-song-id="' + id.replace(/"/g, '') + '"]');
    if (!item) return;
    item.classList.add('owned');
    const nameEl = item.querySelector('.shop-item-name');
    if (nameEl) {
        const demo = nameEl.querySelector('.demo-badge');
        if (demo) demo.remove();
    }
    const priceEl = item.querySelector('.shop-item-price');
    if (priceEl) priceEl.remove();
    const actions = item.querySelector('.shop-item-actions-col');
    if (actions) {
        actions.innerHTML = '<span class="shop-owned-badge">ĐÃ MUA</span>';
    }
}

function buySong(songId) {
    if (!getCurrentUsername()) {
        showNotification('LỖI:', 'CHƯA ĐĂNG NHẬP USERNAME', '#ff4444', 'user');
        return false;
    }
    const song = songs.find(s => String(s.id) === String(songId));
    if (!song) {
        showNotification('LỖI:', 'KHÔNG TÌM THẤY BÀI HÁT', '#ff4444', 'alert-circle');
        return false;
    }
    if (isSongOwned(songId)) {
        showNotification('CỬA HÀNG:', 'BẠN ĐÃ SỞ HỮU BÀI NÀY', '#4ade80', 'check');
        return false;
    }
    const price = getSongPrice(song);
    const coins = loadCoins();
    if (coins < price) {
        showNotification('THIẾU XK:', `CẦN ${price} XK — ĐANG CÓ ${coins} XK`, '#ff9800', 'coins');
        return false;
    }
    updateCurrentAccount(acc => {
        acc.coins = (acc.coins | 0) - price;
        if (!Array.isArray(acc.owned)) acc.owned = [];
        acc.owned.push(String(songId));
        acc.owned = [...new Set(acc.owned)];
    });
    markPendingOwned(songId);
    showNotification(
        'MUA THÀNH CÔNG:',
        '<i class="fa-regular fa-star"></i> ' + String(songId) + ' <i class="fa-regular fa-star"></i>',
        '#4ade80',
        'shopping-bag'
    );
    renderShopList();
    markShopItemOwnedUI(songId);
    if (typeof renderShopThumbs === 'function') renderShopThumbs();
    updateShopBalanceUI();
    updateUsernameBadge();
    
    const isCurrentOrDemo = (songs[index] && String(songs[index].id) === String(songId))
        || (demoLockedSongId != null && String(demoLockedSongId) === String(songId));
    
    if (isCurrentOrDemo) {
        const songIdx = songs.findIndex(s => String(s.id) === String(songId));
        if (songIdx !== -1) index = songIdx;
        
        demoLockedSongId = null;
        (async () => {
            try {
                const full = await fetchSongFull(songId);
                if (full && songs[index] && String(songs[index].id) === String(songId)) {
                    songs[index].audioFull = full.audioFull || '';
                    songs[index].audioFull2 = full.audioFull2 || '';
                }
            } catch (e) {}
            const fullUrl = getPlayableAudio(songs[index]);
            if (!fullUrl) return;
            audio.src = fullUrl;
            audio.load();
            audio.addEventListener('loadedmetadata', function once() {
                audio.removeEventListener('loadedmetadata', once);
                try {
                    const seekTo = Math.min(DEMO_SECONDS, (audio.duration || DEMO_SECONDS) - 0.5);
                    audio.currentTime = Math.max(0, seekTo);
                } catch (e) {}
                audio.play().catch(() => {});
                updateProgressUI();
            });
            if (audio.readyState >= 1) {
                try {
                    const seekTo = Math.min(DEMO_SECONDS, (audio.duration || DEMO_SECONDS) - 0.5);
                    audio.currentTime = Math.max(0, seekTo);
                } catch (e) {}
                audio.play().catch(() => {});
            }
        })();
    }
    return true;
}

function updateShopBalanceUI() {
    const el = document.getElementById('shop-coin-count');
    if (el) el.textContent = String(loadCoins());
    updateShopUserProfile();
}

function getUserRank(account) {
    const r = String((account && account.rank) || 'member').toLowerCase().trim();
    if (r === 'admin' || r === 'super_vip' || r === 'vip') return r;
    return 'member';
}

function rankLabel(rank) {
    if (rank === 'admin') return 'ADMIN';
    if (rank === 'super_vip') return 'SUPER VIP';
    if (rank === 'vip') return 'VIP';
    return 'Thành viên';
}

function updateShopUserProfile() {
    const name = getCurrentUsername();
    const nameEl = document.getElementById('shop-user-name');
    const badgeEl = document.getElementById('shop-rank-badge');
    const acc = getCurrentAccount();
    const rank = getUserRank(acc);

    if (nameEl) nameEl.textContent = name || '—';
    if (badgeEl) {
        if (rank === 'member') {
            badgeEl.style.display = 'none';
            badgeEl.textContent = '';
            badgeEl.className = 'rank-badge';
        } else {
            badgeEl.style.display = 'inline-flex';
            badgeEl.textContent = rankLabel(rank);
            badgeEl.className = 'rank-badge rank-' + rank;
        }
    }
}

function updateUsernameBadge() {
    updateShopUserProfile();
}

function updateCheckinButtonUI() {
    const btn = document.getElementById('checkin-btn');
    const txt = document.getElementById('checkin-btn-text');
    if (!btn) return;
    if (hasCheckedInToday()) {
        btn.disabled = true;
        btn.classList.add('done');
        if (txt) txt.textContent = 'ĐÃ ĐIỂM DANH';
    } else {
        btn.disabled = false;
        btn.classList.remove('done');
        if (txt) txt.textContent = 'ĐIỂM DANH';
    }
}

function renderShopList(highlightSongId) {
    const list = document.getElementById('shop-list');
    if (!list) return;
    if (!songs || !songs.length) {
        list.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-secondary);font-size:0.8rem;">CHƯA CÓ BÀI HÁT</div>';
        return;
    }
    const focusId = highlightSongId != null ? String(highlightSongId) : '';
    const focusSong = focusId ? songs.find(s => String(s.id) === focusId) : null;
    const hintHtml = focusSong
        ? `<div class="shop-buy-hint">Bạn vừa nghe demo « ${escapeHtml(focusSong.name || focusSong.id)} » — mua để nghe full bài nhé!</div>`
        : '';
    list.innerHTML = hintHtml + songs.map(s => {
        const id = String(s.id);
        const owned = isSongOwned(id);
        const price = getSongPrice(s);
        const name = escapeHtml(s.name || id);
        const artist = escapeHtml(s.artist || 'ĐANG CẬP NHẬT');
        const isFocus = focusId && id === focusId;
        const rented = isSongRented(id);
        const rentP1 = getRentPriceForDays(s, 1);
        const permanentlyOwned = loadOwnedSongs().includes(id);
        let action = '';
        if (permanentlyOwned) {
            action = `<span class="shop-owned-badge">ĐÃ MUA</span>`;
        } else {
            const rentBtns = RENT_DAY_OPTIONS.map(d => {
                const p = getRentPriceForDays(s, d);
                return `<button type="button" class="shop-buy-btn shop-rent-btn shop-rent-day" data-rent-id="${id}" data-rent-days="${d}" title="Thuê 24h — ${p} XK">24H · ${p}</button>`;
            }).join('');
            action = `
                <button type="button" class="shop-buy-btn" data-buy-id="${id}">MUA ${price} XK</button>
                ${rented ? `<span class="shop-owned-badge shop-rent-countdown" data-rent-exp="${getRentExpiry(id)}">THUÊ …</span>` : ''}
                <div class="shop-rent-days" title="Thuê 24h / gia hạn">${rentBtns}</div>
            `;
        }
        const priceLabel = permanentlyOwned
            ? ''
            : `<div class="shop-item-price">Mua ${price} XK · Thuê 24h: ${rentP1} XK</div>`;
        return `<div class="shop-item ${permanentlyOwned || owned ? 'owned' : ''} ${isFocus ? 'highlight-buy' : ''}" data-song-id="${id}">
            <div class="shop-item-info">
                <div class="shop-item-name">${name}${permanentlyOwned || owned ? '' : ' <span class="demo-badge">DEMO 1P</span>'}</div>
                <div class="shop-item-artist">${artist}</div>
                ${priceLabel}
            </div>
            <div class="shop-item-actions-col">${action}</div>
        </div>`;
    }).join('');
    
    list.querySelectorAll('.shop-buy-btn[data-buy-id]').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            buySong(btn.getAttribute('data-buy-id'));
        };
    });
    list.querySelectorAll('[data-rent-id]').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const days = Number(btn.getAttribute('data-rent-days')) || 1;
            rentSong(btn.getAttribute('data-rent-id'), days);
        };
    });

    if (window._shopRentTimer) clearInterval(window._shopRentTimer);
    const tickRent = () => {
        list.querySelectorAll('.shop-rent-countdown[data-rent-exp]').forEach(el => {
            const exp = Number(el.getAttribute('data-rent-exp')) || 0;
            el.textContent = formatRentCountdown(exp);
        });
    };
    tickRent();
    window._shopRentTimer = setInterval(tickRent, 1000);

    if (focusId) {
        const el = list.querySelector(`.shop-item[data-song-id="${CSS.escape ? CSS.escape(focusId) : focusId}"]`);
        if (el) {
            setTimeout(() => {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 120);
        }
    }
}

let _progressThumbsCache = null;
let _progressThumbsCacheAt = 0;
async function fetchProgressThumbs(force) {
    if (!force && _progressThumbsCache && Date.now() - _progressThumbsCacheAt < 60000) {
        return _progressThumbsCache;
    }
    try {
        const db = getDb();
        if (!db) return _progressThumbsCache || [];
        const snap = await db.ref('settings/progressThumbs').once('value');
        const v = snap.val();
        let list = [];
        if (Array.isArray(v)) list = v.filter(x => x && (x.id || x.url));
        else if (v && typeof v === 'object') list = Object.values(v).filter(x => x && (x.id || x.url));
        _progressThumbsCache = list;
        _progressThumbsCacheAt = Date.now();
        return list;
    } catch (e) {
        console.warn('fetchProgressThumbs', e);
    }
    return _progressThumbsCache || [];
}

function patchThumbItemUI(thumbId) {
    const list = document.getElementById('shop-thumb-list');
    if (!list) return;
    const id = String(thumbId || '');
    const item = list.querySelector('.shop-thumb-item[data-thumb-id="' + id.replace(/"/g, '') + '"]');
    if (!item) {
        if (typeof renderShopThumbs === 'function') renderShopThumbs();
        return;
    }
    const acc = (typeof getCurrentAccount === 'function' && getCurrentAccount()) || {};
    const owned = Array.isArray(acc.ownedThumbs) ? acc.ownedThumbs.map(String) : [];
    const active = acc.activeThumb ? String(acc.activeThumb) : '';
    const has = owned.includes(id);
    const isActive = active === id;
    let btn = item.querySelector('.shop-buy-btn');
    if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'shop-buy-btn';
        item.appendChild(btn);
    }
    btn.removeAttribute('data-buy-thumb');
    btn.removeAttribute('data-use-thumb');
    btn.removeAttribute('data-clear-thumb');
    if (isActive) {
        btn.className = 'shop-buy-btn shop-rent-btn';
        btn.setAttribute('data-clear-thumb', '1');
        btn.textContent = 'HỦY DÙNG';
        btn.onclick = (e) => {
            e.stopPropagation();
            updateCurrentAccount(a => { a.activeThumb = ''; });
            applyActiveProgressThumb();
            patchThumbItemUI(id);
            list.querySelectorAll('.shop-thumb-item').forEach(el => {
                const tid = el.getAttribute('data-thumb-id');
                if (tid && tid !== id) patchThumbItemUI(tid);
            });
            updateShopBalanceUI();
            showNotification('THUMB:', 'Đã hủy dùng', '#9a9aaa', 'check');
        };
    } else if (has) {
        btn.className = 'shop-buy-btn';
        btn.setAttribute('data-use-thumb', id);
        btn.textContent = 'DÙNG';
        btn.onclick = (e) => {
            e.stopPropagation();
            const prev = String((getCurrentAccount() || {}).activeThumb || '');
            updateCurrentAccount(a => { a.activeThumb = id; });
            applyActiveProgressThumb();
            if (prev) patchThumbItemUI(prev);
            patchThumbItemUI(id);
            updateShopBalanceUI();
            showNotification('THUMB:', 'Đã áp dụng', '#4ade80', 'check');
        };
    } else {
        btn.className = 'shop-buy-btn';
        const priceEl = item.querySelector('.price');
        const priceTxt = priceEl ? priceEl.textContent : '';
        const m = priceTxt.match(/(\d+)/);
        const price = m ? m[1] : '';
        btn.setAttribute('data-buy-thumb', id);
        btn.textContent = 'MUA ' + (price ? price + ' XK' : '');
        btn.onclick = (e) => {
            e.stopPropagation();
            fetchProgressThumbs().then(thumbs => buyProgressThumb(id, thumbs));
        };
    }
    const priceEl = item.querySelector('.price');
    if (priceEl && has) priceEl.textContent = 'Đã sở hữu';
}

function applyActiveProgressThumb() {
    const thumb = document.getElementById('progress-thumb');
    if (!thumb) return;
    const acc = typeof getCurrentAccount === 'function' ? getCurrentAccount() : null;
    const id = acc && acc.activeThumb;
    if (!id) {
        thumb.classList.remove('has-custom-img');
        thumb.style.backgroundImage = '';
        return;
    }
    fetchProgressThumbs().then(list => {
        const th = list.find(x => String(x.id) === String(id));
        if (th && th.url) {
            thumb.classList.add('has-custom-img');
            thumb.style.backgroundImage = 'url("' + String(th.url).replace(/"/g, '%22') + '")';
        } else {
            thumb.classList.remove('has-custom-img');
            thumb.style.backgroundImage = '';
        }
    }).catch(() => {});
}

async function renderShopThumbs() {
    const list = document.getElementById('shop-thumb-list');
    if (!list) return;
    const hadContent = list.children.length > 0 && !list.querySelector('[data-loading]');
    if (!hadContent) {
        list.innerHTML = '<div data-loading="1" style="text-align:center;padding:20px;color:var(--text-secondary);font-size:0.75rem;">Đang tải...</div>';
    }
    const thumbs = await fetchProgressThumbs();
    if (!thumbs.length) {
        list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-secondary);font-size:0.78rem;">Chưa có progress thumb<br/><span style="opacity:0.7">Admin thêm ở Cài đặt → Progress thumb</span></div>';
        return;
    }
    const acc = (typeof getCurrentAccount === 'function' && getCurrentAccount()) || {};
    const owned = Array.isArray(acc.ownedThumbs) ? acc.ownedThumbs.map(String) : [];
    const active = acc.activeThumb ? String(acc.activeThumb) : '';
    list.innerHTML = thumbs.map(th => {
        const id = String(th.id || '');
        const has = owned.includes(id);
        const isActive = active === id;
        let btn = '';
        if (isActive) {
            btn = '<button type="button" class="shop-buy-btn shop-rent-btn" data-clear-thumb="1">HỦY DÙNG</button>';
        } else if (has) {
            btn = '<button type="button" class="shop-buy-btn" data-use-thumb="' + id.replace(/"/g, '') + '">DÙNG</button>';
        } else {
            btn = '<button type="button" class="shop-buy-btn" data-buy-thumb="' + id.replace(/"/g, '') + '">MUA ' + (Number(th.price) || 0) + ' XK</button>';
        }
        const name = (typeof escapeHtml === 'function' ? escapeHtml(th.name || id) : (th.name || id));
        const url = th.url ? String(th.url).replace(/"/g, '&quot;') : '';
        const isGif = /\.gif(\?|$)/i.test(url) || /\.webp(\?|$)/i.test(url);
        const preview = url
            ? ('<button type="button" class="shop-thumb-preview' + (isGif ? ' is-gif' : '') + '" data-thumb-src="' + url + '" title="Xem ảnh">' +
               (isGif
                 ? '<span class="thumb-play-icon">▶</span><span class="thumb-placeholder">GIF</span>'
                 : '<img src="' + url + '" alt="" loading="lazy">') +
               '</button>')
            : '<div style="width:40px;height:40px;border-radius:8px;background:var(--progress-bg);"></div>';
        return '<div class="shop-thumb-item" data-thumb-id="' + id.replace(/"/g, '') + '">' +
            preview +
            '<div class="info"><div class="name">' + name + '</div>' +
            '<div class="price">' + (has ? 'Đã sở hữu' : ((Number(th.price) || 0) + ' XK')) + '</div></div>' +
            btn + '</div>';
    }).join('');
    function showThumbDemo(src) {
        if (!src) return;
        let overlay = document.getElementById('shop-thumb-demo-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'shop-thumb-demo-overlay';
            overlay.className = 'shop-thumb-preview-demo';
            overlay.onclick = () => overlay.remove();
            document.body.appendChild(overlay);
        }
        overlay.innerHTML = '<img src="' + String(src).replace(/"/g, '&quot;') + '" alt="demo">';
        overlay.style.display = 'flex';
        document.body.appendChild(overlay);
    }
    list.querySelectorAll('.shop-thumb-preview[data-thumb-src]').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const src = btn.getAttribute('data-thumb-src');
            if (!src) return;
            if (btn.dataset.loaded !== '1') {
                btn.dataset.loaded = '1';
                btn.innerHTML = '<img src="' + src.replace(/"/g, '&quot;') + '" alt="">';
                btn.classList.add('loaded');
            }
            showThumbDemo(src);
        };
    });
    list.querySelectorAll('.shop-thumb-item').forEach(item => {
        item.onclick = (e) => {
            if (e.target.closest('button.shop-buy-btn')) return;
            if (e.target.closest('.shop-thumb-preview')) return; // đã xử lý
            const prev = item.querySelector('.shop-thumb-preview[data-thumb-src]');
            const src = prev && prev.getAttribute('data-thumb-src');
            if (!src) return;
            if (prev && prev.dataset.loaded !== '1') {
                prev.dataset.loaded = '1';
                prev.innerHTML = '<img src="' + src.replace(/"/g, '&quot;') + '" alt="">';
                prev.classList.add('loaded');
            }
            showThumbDemo(src);
        };
    });
    list.querySelectorAll('[data-buy-thumb]').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            buyProgressThumb(btn.getAttribute('data-buy-thumb'), thumbs);
        };
    });
    list.querySelectorAll('[data-use-thumb]').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const tid = btn.getAttribute('data-use-thumb');
            updateCurrentAccount(acc => { acc.activeThumb = tid; });
            applyActiveProgressThumb();
            const prevActive = list.querySelectorAll('.shop-thumb-item');
            prevActive.forEach(el => patchThumbItemUI(el.getAttribute('data-thumb-id')));
            if (typeof showNotification === 'function') showNotification('THUMB:', 'Đã áp dụng', '#4ade80', 'check');
        };
    });
    list.querySelectorAll('[data-clear-thumb]').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            updateCurrentAccount(acc => { acc.activeThumb = ''; });
            applyActiveProgressThumb();
            list.querySelectorAll('.shop-thumb-item').forEach(el => patchThumbItemUI(el.getAttribute('data-thumb-id')));
            if (typeof showNotification === 'function') showNotification('THUMB:', 'Đã về mặc định', '#60a5fa', 'check');
        };
    });
}

function buyProgressThumb(thumbId, thumbsList) {
    if (!getCurrentUsername()) {
        showNotification('LỖI:', 'CHƯA ĐĂNG NHẬP', '#ff4444', 'user');
        return;
    }
    const th = (thumbsList || []).find(x => String(x.id) === String(thumbId));
    if (!th) {
        showNotification('LỖI:', 'Không tìm thấy thumb', '#ff4444', 'alert-circle');
        return;
    }
    const price = Number(th.price) || 0;
    if (loadCoins() < price) {
        showNotification('THIẾU XK:', 'Cần ' + price + ' XK', '#ff9800', 'coins');
        return;
    }
    updateCurrentAccount(acc => {
        acc.coins = (acc.coins | 0) - price;
        if (!Array.isArray(acc.ownedThumbs)) acc.ownedThumbs = [];
        if (!acc.ownedThumbs.includes(String(thumbId))) acc.ownedThumbs.push(String(thumbId));
    });
    patchThumbItemUI(thumbId);
    updateShopBalanceUI();
    showNotification('MUA THUMB:', (th.name || thumbId) + ' — bấm DÙNG để áp dụng', '#4ade80', 'shopping-bag');
}


function openShopModal(highlightSongId) {
    const modal = document.getElementById('shop-modal');
    if (!modal) return;
    updateShopBalanceUI();
    updateCheckinButtonUI();
    renderShopList(highlightSongId);
    if (typeof renderShopThumbs === "function") renderShopThumbs();
    if (typeof renderShopRing === "function") renderShopRing();
    modal.classList.remove('show');
    void modal.offsetWidth;
    requestAnimationFrame(() => {
        modal.classList.add('show');
        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ nodes: Array.from(modal.querySelectorAll('[data-lucide]')) });
        }
    });
}

function closeShopModal() {
    const modal = document.getElementById('shop-modal');
    if (modal) modal.classList.remove('show');
}

const PIN_LEN = 6;

function buildPinBoxes() {
    const wrap = document.getElementById('pin-boxes');
    if (!wrap) return;
    let html = '';
    for (let i = 0; i < PIN_LEN; i++) {
        html += '<div class="pin-box empty' + (i === 0 ? ' active' : '') + '" data-i="' + i + '">–</div>';
    }
    wrap.innerHTML = html;
}

function renderPinBoxes(digits) {
    const boxes = document.querySelectorAll('#pin-boxes .pin-box');
    if (!boxes.length) return;
    const d = String(digits || '').replace(/\D/g, '').slice(0, PIN_LEN);
    boxes.forEach((box, i) => {
        box.classList.remove('empty', 'active', 'filled', 'error');
        if (i < d.length) {
            box.textContent = '•';
            box.classList.add('filled');
        } else {
            box.textContent = '–';
            box.classList.add('empty');
            if (i === d.length) box.classList.add('active');
        }
    });
}

function getPinValue() {
    const inp = document.getElementById('pin-hidden');
    return inp ? String(inp.value || '').replace(/\D/g, '').slice(0, PIN_LEN) : '';
}

function clearPinInput() {
    const inp = document.getElementById('pin-hidden');
    if (inp) inp.value = '';
    renderPinBoxes('');
}

function focusPinInput() {
    const inp = document.getElementById('pin-hidden');
    if (inp) {
        try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); }
    }
}

function shakePinBoxes() {
    document.querySelectorAll('#pin-boxes .pin-box').forEach(b => {
        b.classList.add('error');
    });
    setTimeout(() => {
        clearPinInput();
        focusPinInput();
    }, 450);
}

function initPinBoxes() {
    const inp = document.getElementById('pin-hidden');
    const wrap = document.getElementById('pin-boxes');
    if (!inp || !wrap) return;
    buildPinBoxes();
    wrap.addEventListener('click', (e) => {
        e.preventDefault();
        focusPinInput();
    });
    inp.addEventListener('input', () => {
        let v = inp.value.replace(/\D/g, '').slice(0, PIN_LEN);
        inp.value = v;
        renderPinBoxes(v);
    });
    inp.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
            setTimeout(() => renderPinBoxes(inp.value.replace(/\D/g, '').slice(0, PIN_LEN)), 0);
        }
    });
}

function readPinTrust() {
    try {
        const raw = localStorage.getItem(storageKey(STORAGE_PIN_TRUST));
        if (!raw) return null;
        const o = JSON.parse(raw);
        if (!o || !o.username || !o.verifiedAt) return null;
        return o;
    } catch (e) {
        return null;
    }
}

function isPinTrusted(username) {
    const name = String(username || '').trim();
    if (!name) return false;
    const t = readPinTrust();
    if (!t || t.username !== name) return false;
    const at = Number(t.verifiedAt) || 0;
    if (!at) return false;
    return (Date.now() - at) < PIN_TRUST_MS;
}

function markPinTrusted(username) {
    const name = String(username || '').trim();
    if (!name) return;
    try {
        localStorage.setItem(storageKey(STORAGE_PIN_TRUST), JSON.stringify({
            username: name,
            verifiedAt: Date.now()
        }));
    } catch (e) {}
}

function clearPinTrust() {
    try {
        localStorage.removeItem(storageKey(STORAGE_PIN_TRUST));
    } catch (e) {}
}

function clearLocalUserSession() {
    try {
        localStorage.removeItem(storageKey(STORAGE_CURRENT_USER));
        localStorage.removeItem(storageKey(STORAGE_ACCOUNTS));
        localStorage.removeItem(storageKey(STORAGE_PIN_TRUST));
        _profileSyncedFromRemote = false;
        _pendingOwnedAdds = Object.create(null);
        stopUserProfileListener();
    } catch (e) {}
}

async function reconcileLocalWithAuth() {
    const authUid = getCurrentUid();
    if (!authUid) return false;
    const name = getCurrentUsername();
    const accounts = getAllAccounts();
    const acc = name ? accounts[name] : null;
    const badUid = acc && acc.uid && acc.uid !== authUid;
    const missing = !name;
    if (!badUid && !missing && _profileSyncedFromRemote) return true;
    console.log('[sync] reconcile local ↔ Auth uid=', authUid);
    await fetchUserByUid(authUid, name || '');
    return true;
}

function setPinSectionVisible(show) {
    const boxes = document.getElementById('pin-boxes');
    const hint = document.getElementById('pin-hint');
    const label = document.querySelector('label.username-label[for="pin-hidden"], label.username-label');
    const form = document.getElementById('username-form');
    let pinLabel = null;
    if (form) {
        form.querySelectorAll('.username-label').forEach(el => {
            if (/PIN/i.test(el.textContent || '')) pinLabel = el;
        });
    }
    const display = show ? '' : 'none';
    if (boxes) boxes.style.display = show ? 'flex' : 'none';
    if (hint) hint.style.display = display;
    if (pinLabel) pinLabel.style.display = display;
    if (!show) clearPinInput();
}

async function loginWithUsername(rawName, rawPin) {
    const name = String(rawName || '').trim().replace(/\s+/g, ' ');
    let pin = String(rawPin || '').trim();
    const settings = getAdminSettings();
    const requirePin = settings.requirePin !== false;
    const allowRegister = settings.allowRegister !== false;
    const maxReg = Math.max(0, Number(settings.maxRegistrations) || 0);
    const regCount = Math.max(0, Number(settings.registrationCount) || 0);

    if (!name || name.length < 2) {
        return { ok: false, message: 'Username tối thiểu 2 ký tự' };
    }
    if (name.length > 20) {
        return { ok: false, message: 'Username tối đa 20 ký tự' };
    }
    if (!/^[\w\u00C0-\u024F\u1E00-\u1EFF .-]+$/i.test(name)) {
        return { ok: false, message: 'Username không hợp lệ' };
    }
    const reservedAdmin = ['tối thượng', 'toi thuong', 'toithuong', 'administrator', 'admin', 'xuanken admin'];
    if (reservedAdmin.includes(name.toLowerCase().replace(/\s+/g, ' '))) {
        return { ok: false, message: 'Username này dành riêng cho Admin (Tối Thượng)' };
    }


    const auth = getAuth();
    if (!auth) {
        return { ok: false, message: 'Firebase Auth chưa sẵn sàng — tải lại trang' };
    }

    const hasAuthSession = !!(auth.currentUser);
    if (!hasAuthSession) {
        if (!/^[0-9]{6}$/.test(pin)) {
            return { ok: false, message: 'PIN phải đúng 6 chữ số' };
        }
    }

    const email = usernameToEmail(name);
    const key = sanitizeUsernameKey(name);
    const db = getDb();

    let existingUid = null;
    try {
        if (db) {
            const mapSnap = await db.ref(dataPath('usernames') + '/' + key).once('value');
            const map = mapSnap.val();
            if (map && map.uid) existingUid = map.uid;
        }
    } catch (e) {
        console.warn('lookup username', e);
    }

    let cred = null;
    let isNew = false;

    try {
        if (existingUid || !allowRegister) {
            if (!/^[0-9]{6}$/.test(pin) && auth.currentUser) {
                cred = { user: auth.currentUser };
            } else {
                try {
                    cred = await auth.signInWithEmailAndPassword(email, pin);
                } catch (signErr1) {
                    const code1 = signErr1 && signErr1.code;
                    if ((code1 === 'auth/wrong-password' || code1 === 'auth/invalid-credential' || code1 === 'auth/invalid-login-credentials') && existingUid && db) {
                        try {
                            const pinSnap = await db.ref(dataPath('users') + '/' + existingUid + '/loginPin').once('value');
                            const dbPin = pinSnap.val();
                            if (dbPin && String(dbPin) === String(pin)) {
                                const apiKey = (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey) || '';
                                if (apiKey) {
                                    await fetch('https://identitytoolkit.googleapis.com/v1/accounts:update?key=' + encodeURIComponent(apiKey), {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ localId: existingUid, password: pin, returnSecureToken: false })
                                    });
                                }
                                cred = await auth.signInWithEmailAndPassword(email, pin);
                            } else {
                                throw signErr1;
                            }
                        } catch (e2) {
                            throw signErr1;
                        }
                    } else {
                        throw signErr1;
                    }
                }
            }
        } else {
            try {
                cred = await auth.signInWithEmailAndPassword(email, pin);
            } catch (signErr) {
                const code = signErr && signErr.code;
                if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/invalid-email') {
                    if (!allowRegister) {
                        return { ok: false, message: 'Username chưa được đăng ký — liên hệ admin' };
                    }
                    if (maxReg > 0 && regCount >= maxReg) {
                        return { ok: false, message: 'Đã hết lượt đăng ký (' + regCount + '/' + maxReg + ')' };
                    }
                    if (!/^[0-9]{6}$/.test(pin)) {
                        return { ok: false, message: 'Đăng ký mới cần đặt PIN đúng 6 số' };
                    }
                    cred = await auth.createUserWithEmailAndPassword(email, pin);
                    isNew = true;
                } else {
                    return { ok: false, message: authErrorMessage(signErr) };
                }
            }
        }
    } catch (err) {
        return { ok: false, message: authErrorMessage(err) };
    }

    const uid = cred && cred.user ? cred.user.uid : getCurrentUid();
    if (!uid) {
        return { ok: false, message: 'Không lấy được phiên đăng nhập' };
    }

    let profile = null;
    try {
        if (db) {
            const snap = await db.ref(dataPath('users') + '/' + uid).once('value');
            profile = snap.val();
        }
    } catch (e) {}

    if (profile && profile.banned) {
        try { await auth.signOut(); } catch (e) {}
        return { ok: false, message: 'Tài khoản đã bị khóa' + (profile.banReason ? (': ' + profile.banReason) : '') };
    }

    if (isNew || !profile) {
        let legacy = null;

        const neu = {
            uid: uid,
            username: name,
            coins: legacy && legacy.coins != null ? (legacy.coins | 0) : settings.starterCoins,
            owned: legacy && Array.isArray(legacy.owned) ? legacy.owned.map(String) : [],
            favorites: legacy && Array.isArray(legacy.favorites) ? legacy.favorites.map(String) : [],
            likes: legacy && Array.isArray(legacy.likes) ? legacy.likes.map(String) : [],
            dislikes: legacy && Array.isArray(legacy.dislikes) ? legacy.dislikes.map(String) : [],
            myPlaylist: legacy && Array.isArray(legacy.myPlaylist) ? legacy.myPlaylist.map(String) : [],
            rentals: (legacy && legacy.rentals && typeof legacy.rentals === 'object') ? legacy.rentals : {},
            lastCheckin: (legacy && legacy.lastCheckin) || '',
            createdAt: (legacy && legacy.createdAt) || Date.now(),
            rank: (legacy && legacy.rank) || 'member',
            xp: legacy ? (Number(legacy.xp) || 0) : 0,
            level: legacy ? (Number(legacy.level) || 1) : 1,
            seasonXp: legacy ? (Number(legacy.seasonXp) || 0) : 0,
            listenedSongs: (legacy && legacy.listenedSongs && typeof legacy.listenedSongs === 'object') ? legacy.listenedSongs : {},
            listenTime: (legacy && legacy.listenTime && typeof legacy.listenTime === 'object') ? legacy.listenTime : { total: 0, byDay: {} },
            achievements: legacy && Array.isArray(legacy.achievements) ? legacy.achievements : [],
            frame: (legacy && legacy.frame) || '',
            streak: legacy ? (Number(legacy.streak) || 0) : 0,
            streakFreeze: legacy ? (Number(legacy.streakFreeze) || 0) : 0,
            ownedThumbs: legacy && Array.isArray(legacy.ownedThumbs) ? legacy.ownedThumbs.map(String) : [],
            activeThumb: (legacy && legacy.activeThumb) || '',
            inviteBy: (legacy && legacy.inviteBy) || '',
            banned: !!(legacy && legacy.banned),
            banReason: (legacy && legacy.banReason) || ''
        };
        try {
            if (db) {
                await db.ref(dataPath('users') + '/' + uid).set(neu);
                await db.ref(dataPath('usernames') + '/' + key).set({ uid: uid, username: name });
                if (isNew) {
                    const t = await db.ref('settings/registrationCount').transaction(c => (Number(c) || 0) + 1);
                    if (t && t.committed) {
                        const next = Number(t.snapshot.val()) || (regCount + 1);
                        saveAdminSettings({ ...getAdminSettings(), registrationCount: next });
                    }
                }
            }
        } catch (e) {
            console.warn('Tạo profile lỗi', e);
        }
        const accounts = getAllAccounts();
        accounts[name] = mapUserProfile(neu, name);
        accounts[name].uid = uid;
        saveAllAccounts(accounts);
    } else {
        await fetchUserByUid(uid, name);
        try {
            if (db) {
                await db.ref(dataPath('usernames') + '/' + key).set({ uid: uid, username: name });
            }
        } catch (e) {}
    }

    setCurrentUsername(name);
    const accounts = getAllAccounts();
    Object.keys(accounts).forEach(k => {
        if (k !== name && accounts[k] && String(accounts[k].uid || '') === String(uid)) {
            delete accounts[k];
        }
    });
    if (!accounts[name]) {
        accounts[name] = { coins: 0, owned: [], lastCheckin: '', createdAt: Date.now() };
    }
    accounts[name].uid = uid;
    saveAllAccounts(accounts);
    const acc = accounts[name];
    markPinTrusted(name);
    startUserProfileListener(uid);
    updateUsernameBadge();
    updateShopBalanceUI();
    updateCheckinButtonUI();
    try { updateArtNameRing(); } catch (e) {}
    return { ok: true, username: name, uid: uid, isNew: isNew };
}

function setupUsernameGate() {
    const form = document.getElementById('username-form');
    const input = document.getElementById('username-input');
    const err = document.getElementById('username-error');
    const startBtn = document.getElementById('username-start-btn');
    const existing = getCurrentUsername();
    initPinBoxes();

    function refreshPinVisibility() {
        const auth = getAuth();
        const hasAuthSession = !!(auth && auth.currentUser);
        setPinSectionVisible(!hasAuthSession);
        const hint = document.getElementById('pin-hint');
        if (hint) {
            hint.textContent = hasAuthSession
                ? 'Đã đăng nhập · Chạm BẮT ĐẦU để nghe'
                : 'PIN 6 số = mật khẩu · User mới = đặt PIN mới';
        }
    }
    
    if (existing && input) {
        input.value = existing;
        const authUid = getCurrentUid();
        const loader = authUid
            ? fetchUserByUid(authUid, existing)
            : fetchUserFromSheet(existing);
        loader.then(() => {
            const real = getCurrentUsername();
            if (real && input) input.value = real;
            updateUsernameBadge();
            updateShopBalanceUI();
            updateCheckinButtonUI();
        }).catch(() => {});
        updateUsernameBadge();
    }
    refreshPinVisibility();

    if (input) {
        input.addEventListener('input', () => {
            refreshPinVisibility();
            if (err) err.style.display = 'none';
        });
        input.addEventListener('change', refreshPinVisibility);
    }
    
    const submit = async () => {
        if (!input) return;
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.style.opacity = '0.7';
        }
        try {
            const name = input.value;
            const auth = getAuth();
            const hasAuthSession = !!(auth && auth.currentUser);
            const pinVal = hasAuthSession ? '' : getPinValue();
            const result = await loginWithUsername(name, pinVal);
            if (!result.ok) {
                if (err) {
                    err.textContent = result.message;
                    err.style.display = 'block';
                }
                if (/PIN|pin|mã/i.test(result.message || '')) {
                    setPinSectionVisible(true);
                    shakePinBoxes();
                    focusPinInput();
                }
                return;
            }
            if (err) err.style.display = 'none';
            refreshPinVisibility();
            startPlayback();
        } finally {
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.style.opacity = '';
            }
        }
    };
    
    if (form) {
        form.onsubmit = (e) => {
            e.preventDefault();
            submit();
        };
    }
    if (startBtn) {
        startBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            submit();
        };
    }
    
    const hintEl = document.getElementById('interaction-hint');
    if (hintEl) {
        hintEl.onclick = (e) => {
            if (e.target.closest('#username-form') || e.target.closest('#username-start-btn')) return;
            if (!getCurrentUsername()) {
                if (input) input.focus();
                if (err) {
                    err.textContent = 'Vui lòng nhập username để bắt đầu';
                    err.style.display = 'block';
                }
                return;
            }
            if (getAdminSettings().requirePin !== false && !isPinTrusted(getCurrentUsername())) {
                setPinSectionVisible(true);
                focusPinInput();
                if (err) {
                    err.textContent = 'Nhập lại mã PIN 6 số để tiếp tục';
                    err.style.display = 'block';
                }
                return;
            }
            if (!e.target.closest('input') && !e.target.closest('button') && !e.target.closest('.pin-boxes')) {
                startPlayback();
            }
        };
    }
}

function initShopTabs() {
    const bar = document.querySelector('.shop-tab-bar');
    if (!bar || bar._xkBound) return;
    bar._xkBound = true;
    bar.querySelectorAll('.shop-tab').forEach(tab => {
        tab.onclick = () => {
            const key = tab.getAttribute('data-shop-tab');
            bar.querySelectorAll('.shop-tab').forEach(t => t.classList.toggle('active', t === tab));
            document.querySelectorAll('.shop-tab-panel').forEach(p => {
                p.classList.toggle('active', p.getAttribute('data-panel') === key);
            });
            if (key === 'thumb' && typeof renderShopThumbs === 'function') renderShopThumbs();
            if (key === 'ring' && typeof renderShopRing === 'function') renderShopRing();
            if (typeof lucide !== 'undefined') {
                try { lucide.createIcons({ nodes: Array.from(bar.querySelectorAll('[data-lucide]')) }); } catch (e) {}
            }
        };
    });
}
initShopTabs();

const shopBtn = document.getElementById('shop-btn');
if (shopBtn) {
    shopBtn.onclick = (e) => {
        e.stopPropagation();
        openShopModal();
    };
}
const closeShopBtn = document.getElementById('close-shop-btn');
if (closeShopBtn) {
    closeShopBtn.onclick = (e) => {
        e.stopPropagation();
        closeShopModal();
    };
}
const checkinBtn = document.getElementById('checkin-btn');
if (checkinBtn) {
    checkinBtn.onclick = (e) => {
        e.stopPropagation();
        doDailyCheckin();
    };
}

setupUsernameGate();
updateUsernameBadge();
updateShopBalanceUI();
updateCheckinButtonUI();

(function bindAuthSessionRestore() {
    const auth = getAuth();
    if (!auth) return;
    ensurePlayerAuthOnly();
    auth.onAuthStateChanged(async (user) => {
        if (!user) return;
        try {
            const email = String(user.email || '').toLowerCase();
            if (email && !email.endsWith('@xuanken.user')) {
                console.warn('[player] Bỏ qua phiên Auth admin/email thật:', email);
                return;
            }
            const db = getDb();
            if (!db) return;
            const snap = await db.ref(dataPath('users') + '/' + user.uid).once('value');
            const data = snap.val();
            if (!data || !data.username) return;
            if (data.banned) {
                try { await auth.signOut(); } catch (e) {}
                return;
            }
            const name = String(data.username).trim();
            const localName = getCurrentUsername();
            if (localName && localName !== name) {
                console.warn('[sync] localStorage user="' + localName + '" ≠ Auth profile="' + name + '" → ép theo Firebase');
            }
            setCurrentUsername(name);
            await fetchUserByUid(user.uid, name);
            markPinTrusted(name);
            updateUsernameBadge();
            updateShopBalanceUI();
            updateCheckinButtonUI();
            try { updateArtNameRing(); } catch (e) {}
            const hint = document.getElementById('interaction-hint');
            const player = document.getElementById('player-container');
            if (hint && player && player.style.display === 'none') {
                const input = document.getElementById('username-input');
                if (input) input.value = name;
                setPinSectionVisible(false);
                const hintEl = document.getElementById('pin-hint');
                if (hintEl) hintEl.textContent = 'Đã đăng nhập · Chạm BẮT ĐẦU để nghe';
            }
        } catch (e) {
            console.warn('auth session restore', e);
        }
    });
})();

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    reconcileLocalWithAuth().then(() => {
        updateShopBalanceUI();
        if (typeof updateUsernameBadge === 'function') updateUsernameBadge();
        if (typeof updateCheckinButtonUI === 'function') updateCheckinButtonUI();
        try {
            const modal = document.getElementById('shop-modal');
            if (modal && modal.classList.contains('show') && typeof renderShopList === 'function') renderShopList();
        } catch (e) {}
    }).catch(() => {});
});

function getNextSongIndexForPreload() {
    if (!songs.length) return -1;
    if (isShuffle) {
        if (remainingQueue && remainingQueue.length) return remainingQueue[0];
        return -1;
    }
    return (index + 1) % songs.length;
}

function preloadNextSong() {
    try {
        const nextIdx = getNextSongIndexForPreload();
        if (nextIdx < 0 || !songs[nextIdx]) return;
        const url = getPlayableAudio(songs[nextIdx]);
        if (!url) return;
        if (!preloadAudioEl) {
            preloadAudioEl = new Audio();
            preloadAudioEl.preload = 'auto';
        }
        if (preloadAudioEl.dataset.url === url) return;
        preloadAudioEl.dataset.url = url;
        preloadAudioEl.src = url;
        preloadAudioEl.load();
    } catch (e) {}
}

const DEVICE_ID = (() => {
    let id = localStorage.getItem(storageKey(STORAGE_DEVICE_ID));
    if (!id) {
        const legacy = localStorage.getItem(STORAGE_DEVICE_ID);
        if (legacy) {
            id = legacy;
            try { localStorage.setItem(storageKey(STORAGE_DEVICE_ID), id); } catch (e) {}
        } else {
            id = 'd_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
            localStorage.setItem(storageKey(STORAGE_DEVICE_ID), id);
        }
    }
    return id;
})();
let syncApplying = false;
let lastSyncPush = 0;
async function restorePlaybackState() { return false; }
function startPlaybackSyncListener() {}
function pushPlaybackSync() {}
function savePlaybackOnLeave() {}

audio.addEventListener('play', () => {
    hasUserInteracted = true;
    preloadNextSong();
});

const myPlaylistBtn = document.getElementById('my-playlist-btn');
const myPlaylistOverlay = document.getElementById('my-playlist-overlay');
const closeMyPlaylistBtn = document.getElementById('close-my-playlist-btn');
if (myPlaylistBtn) {
    myPlaylistBtn.onclick = (e) => {
        e.stopPropagation();
        renderMyPlaylist();
        if (myPlaylistOverlay) myPlaylistOverlay.classList.add('active'); refreshModalIcons(myPlaylistOverlay);
    };
}
if (closeMyPlaylistBtn && myPlaylistOverlay) {
    closeMyPlaylistBtn.onclick = () => myPlaylistOverlay.classList.remove('active');
}

window.buySong = buySong;
window.rentSong = rentSong;
window.isSongOwned = isSongOwned;
window.openShopModal = openShopModal;
window.renderShopThumbs = renderShopThumbs;
window.renderShopRing = renderShopRing;
window.rentArtRing = rentArtRing;
window.fetchProgressThumbs = fetchProgressThumbs;
window.getCurrentUsername = getCurrentUsername;
window.clearLocalUserSession = clearLocalUserSession;
window.reconcileLocalWithAuth = reconcileLocalWithAuth;
Object.defineProperty(window, 'songs', { get: () => songs });
Object.defineProperty(window, 'index', { get: () => index });
window.audio = typeof audio !== 'undefined' ? audio : document.getElementById('audio-player');
window.handleNextAction = typeof handleNextAction === 'function' ? handleNextAction : undefined;
window.prevSong = typeof prevSong === 'function' ? prevSong : undefined;

window.toggleFavorite = toggleFavorite;
window.toggleLike = toggleLike;
window.toggleDislike = toggleDislike;
window.toggleMyPlaylistSong = toggleMyPlaylistSong;
window.getAllAccounts = getAllAccounts;
window.getAdminSettings = getAdminSettings;
window.pushUserToFirebase = pushUserToFirebase;
window.fetchUserFromFirebase = fetchUserFromFirebase;
window.syncPricesFromFirebase = syncPricesFromFirebase;
window.getDb = getDb;

(async () => {
    await syncSettingsFromFirebase();
    syncPricesFromFirebase();
    loadSongsFromFirebase();
    try { bindArtRingSettingsUI(); } catch (e) {}
    try { updateArtNameRing(); } catch (e) {}
    try { bindArtRingResize(); } catch (e) {}
})();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        try { bindArtRingSettingsUI(); } catch (e) {}
        try { updateArtNameRing(); } catch (e) {}
        try { bindArtRingResize(); } catch (e) {}
    });
} else {
    try { bindArtRingSettingsUI(); } catch (e) {}
    try { updateArtNameRing(); } catch (e) {}
    try { bindArtRingResize(); } catch (e) {}
}