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

// Dữ liệu trên Firebase Realtime Database (js/firebase-config.js)
function getDb() {
    return window.fbDB || (typeof firebase !== 'undefined' ? firebase.database() : null);
}

// ===== Storage keys & multi-site prefix helpers (định nghĩa sớm) =====
const STORAGE_ACCOUNTS = 'xuanken_accounts';
const STORAGE_CURRENT_USER = 'xuanken_current_user';
const STORAGE_ADMIN_SETTINGS = 'xuanken_admin_settings';
const STORAGE_SONG_PRICES = 'xuanken_song_prices';
const STORAGE_LISTENS = 'xuanken_listens';
const STORAGE_THEME = 'xuanken_theme';
const STORAGE_DEVICE_ID = 'xuanken_device_id';
/** Nhớ đã xác nhận PIN trên máy này (hết hạn 7 ngày) */
const STORAGE_PIN_TRUST = 'xuanken_pin_trust';
const PIN_TRUST_MS = 7 * 24 * 60 * 60 * 1000;

const DEFAULT_ADMIN_SETTINGS = {
    adminPassword: 'xuanken2024',
    songPrice: 10,
    checkinReward: 15,
    starterCoins: 20,
    siteName: 'XuanKen Music Official',
    siteIcon: 'https://raw.githubusercontent.com/nokiapro/xuankenofficial/main/icon.png',
    sitePrefix: '',
    /** Bắt buộc nhập PIN khi vào player */
    requirePin: true,
    /** Cho phép tạo username mới từ màn hình đầu (tắt = chỉ user admin đã tạo) */
    allowRegister: true,
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

/**
 * Key localStorage theo sitePrefix (vd music6_xuanken_accounts).
 * Settings (STORAGE_ADMIN_SETTINGS) cố ý KHÔNG prefix — chứa sitePrefix để các key khác biết dùng prefix nào.
 * Mỗi web set sitePrefix khác nhau → localStorage tách biệt, không đè lên nhau.
 */
function storageKey(base) {
    const p = String((getAdminSettings().sitePrefix || '')).trim().replace(/^\/+|\/+$/g, '');
    return p ? `${p}_${base}` : base;
}

/** Đường dẫn Firebase theo prefix (settings luôn ở root) */
function dataPath(key) {
    const p = String((getAdminSettings().sitePrefix || '')).trim().replace(/^\/+|\/+$/g, '');
    return p ? `${p}/${key}` : key;
}

function applyBranding() {
    const s = getAdminSettings();
    const name = (s.siteName || DEFAULT_ADMIN_SETTINGS.siteName).trim() || DEFAULT_ADMIN_SETTINGS.siteName;
    const icon = (s.siteIcon || DEFAULT_ADMIN_SETTINGS.siteIcon).trim() || DEFAULT_ADMIN_SETTINGS.siteIcon;
    document.title = name;
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

// Helper đổi icon Lucide mà không phá animation của nút
function setLucideIcon(container, iconName) {
    if (!container) return;
    // Giữ nguyên container (btn), chỉ thay nội dung icon bên trong
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
let currentSource = 'normal';
let notificationTimeout = null;
let isLoadingSongs = true;

let autoRefreshInterval = null;
let isRefreshing = false;
let lastDataHash = null;

let pendingListenUpdate = false;
let lastListenFetch = 0;
const LISTEN_FETCH_INTERVAL = 60000;

let hasUserInteracted = false;

let isDataLoading = false;
let pendingPlayAfterLoad = false;

/** Bài đang bị khóa sau khi hết demo 60s — không auto next/random cho đến khi mua hoặc đổi bài */
let demoLockedSongId = null;

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
    // Chỉ hash cấu trúc bài (id + link audio) — KHÔNG gồm listenCount
    // để tránh checkForUpdates coi "có người nghe" là đổi data rồi seek audio → giật nhạc
    if (!data || !data.length) return null;
    return JSON.stringify(data.map(s => ({
        id: s.id,
        audio: s.audio || '',
        audioFull: s.audioFull || '',
        audioFull2: s.audioFull2 || '',
        name: s.name || '',
        artist: s.artist || '',
        publishAt: s.publishAt || null,
        hidden: !!s.hidden
    })));
}

function songsObjectToArray(obj) {
    if (!obj) return [];
    const list = Object.keys(obj).map(id => {
        const s = obj[id] || {};
        return {
            id: String(s.id || id),
            name: s.name || id,
            artist: s.artist || '',
            audio: s.audio || '',
            audioFull: s.audioFull || '',
            audioFull2: s.audioFull2 || '',
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
    // Sắp xếp theo bảng chữ cái (tên bài)
    list.sort((a, b) => {
        const na = String(a.name || '').localeCompare(String(b.name || ''), 'vi', { sensitivity: 'base' });
        if (na !== 0) return na;
        return String(a.id || '').localeCompare(String(b.id || ''), 'vi', { sensitivity: 'base' });
    });
    return list;
}

/** Danh sách link full (đã mua/thuê) — random + fallback */
function getFullAudioCandidates(song) {
    if (!song) return [];
    const list = [];
    if (song.audioFull) list.push(song.audioFull);
    if (song.audioFull2) list.push(song.audioFull2);
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

/**
 * Link phát ổn định:
 * - Đã mua/thuê: giữ nguyên link FULL đã chọn cho bài (không random lại mỗi lần gọi)
 * - Chưa mua: demo
 * Random chỉ khi lần đầu chọn link full cho bài đó.
 */
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
        // Nếu audio đang phát đúng 1 candidate → giữ luôn
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
    const prefix = String((getAdminSettings().sitePrefix || '')).trim();
    const path = dataPath('songs');
    try {
        const snap = await db.ref(path).once('value');
        const arr = songsObjectToArray(snap.val());
        // Nếu có prefix nhưng path đó trống / không có quyền → fallback root (tránh site "chết")
        if (prefix && arr.length === 0) {
            console.warn(`[songs] Prefix "${prefix}" không có dữ liệu, fallback sang root /songs`);
            const snapRoot = await db.ref('songs').once('value');
            return songsObjectToArray(snapRoot.val());
        }
        return arr;
    } catch (e) {
        const msg = (e && (e.message || e.code)) || String(e);
        if (prefix && /permission|PERMISSION_DENIED|permission_denied/i.test(msg)) {
            console.warn(`[songs] Prefix "${prefix}" bị chặn quyền, fallback sang root /songs`, e);
            const snapRoot = await db.ref('songs').once('value');
            return songsObjectToArray(snapRoot.val());
        }
        throw e;
    }
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
            // Đánh dấu các bài đang có để không báo lại sau reload list
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
            
            // Chỉ cập nhật metadata — KHÔNG đụng audio.src / currentTime / load()
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
                // Cập nhật chữ UI nếu tên/ca sĩ đổi — không reload audio
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
                // Bài đang nghe bị xóa khỏi list — giữ audio đang phát, chỉnh index an toàn
                index = Math.min(index, songs.length - 1);
            }
            
            // Map lại queue shuffle theo ID (tránh index lệch khi đổi thứ tự ABC)
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
                    const title = song.name || song.id;
                    const wasScheduled = song.publishAt && Date.parse(song.publishAt) <= Date.now();
                    const head = wasScheduled ? 'ADMIN ĐÃ ĐĂNG BÀI MỚI:' : 'BÀI HÁT MỚI:';
                    showNotification(
                        head,
                        `<i class="fa-regular fa-star"></i> ${title} <i class="fa-regular fa-star"></i>`,
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
/** ID bài đã từng hiện cho user này (tránh spam thông báo) */
let notifiedNewSongIds = new Set();

function startAutoRefresh(intervalSeconds = 60) {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    setTimeout(() => checkForUpdates(), 3000);
    // Kiểm tra thường hơn để bắt giờ đăng bài (15s)
    autoRefreshInterval = setInterval(checkForUpdates, Math.min(intervalSeconds, 15) * 1000);
    console.log('ĐÃ BẬT TỰ ĐỘNG CẬP NHẬT + lịch đăng bài');
    startSongsRealtimeListener();
    scheduleNextPublishUnlock();
}

/** Lấy toàn bộ bài (kể cả chưa tới publishAt) — để hẹn giờ mở */
async function fetchSongsRawFromFirebase() {
    const db = getDb();
    if (!db) return [];
    const path = dataPath('songs');
    let snap;
    try {
        snap = await db.ref(path).once('value');
    } catch (e) {
        snap = await db.ref('songs').once('value');
    }
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

/** Hẹn đúng giây publishAt gần nhất → refresh + thông báo */
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
        if (!ready) return; // bỏ qua lần gắn listener (child_added hàng loạt)
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
        // Sau 1.5s mới nhận sự kiện thật (thêm bài / sửa publishAt)
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
            initPlayerAfterLoad();
            updateListenStatsModal();
            
            startAutoRefresh(60);
            
            // Có username → tiếp tục đúng bài + phút đã lưu
            if (getCurrentUsername()) {
                playbackRestored = false;
                restorePlaybackState();
            }
            
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

// Alias tương thích
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
    if (!content) return;

    const inner = content.querySelector('.notification-content-inner') || content;
    content.classList.remove('is-marquee');
    content.style.maxWidth = '';
    content.style.transform = 'none';
    if (inner && inner.style) {
        inner.style.animationDuration = '';
    }

    const isMobile = window.innerWidth <= 768;
    const isSmallMobile = window.innerWidth <= 480;
    const maxToastW = Math.min(window.innerWidth * 0.92, isSmallMobile ? 340 : (isMobile ? 420 : 520));
    const iconW = 36;
    const maxContentW = Math.max(140, maxToastW - iconW - 28);
    content.style.maxWidth = maxContentW + 'px';

    // Chữ dài → chạy ngang (marquee) thay vì scale nhỏ
    const totalW = inner.scrollWidth || content.scrollWidth;
    if (totalW > maxContentW + 4) {
        content.style.setProperty('--noti-view-w', maxContentW + 'px');
        content.classList.add('is-marquee');
        // Tốc độ ~40px/s, tối thiểu 6s
        const duration = Math.max(6, (totalW - maxContentW) / 40 + 3);
        if (inner && inner.style) {
            inner.style.animationDuration = duration + 's';
        }
    }
}

function forceScaleNotification() {
    autoScaleNotificationMessage();
    setTimeout(() => autoScaleNotificationMessage(), 40);
    setTimeout(() => autoScaleNotificationMessage(), 120);
}

// Toast kiểu music2: chỉ setTimeout gỡ class — đơn giản, ổn định
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
        iconContainer.innerHTML = `<i data-lucide="${icon}"></i>`;
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [iconContainer] });
        const svg = iconContainer.querySelector('svg');
        if (svg) svg.style.color = color;
    }

    let formattedMessage = message;
    if (typeof message === 'string' && !message.includes('<span')) {
        const gradient = getGradientByTheme();
        formattedMessage = `<span style="font-weight: 700; background: ${gradient}; background-size: 200% 200%; -webkit-background-clip: text; background-clip: text; color: transparent; letter-spacing: 0.5px; font-size: inherit; display: inline-block; white-space: nowrap; animation: titleGradientMove 3s ease infinite;">${message}</span>`;
    }

    const content = noti.querySelector('.notification-content');
    if (content) {
        content.classList.remove('is-marquee');
        content.innerHTML = `<div class="notification-content-inner"><span class="notification-title">${title}</span><span class="notification-message">${formattedMessage}</span></div>`;
    } else {
        const titleEl = noti.querySelector('.notification-title');
        const msgEl = noti.querySelector('.notification-message');
        if (titleEl) titleEl.innerHTML = title;
        if (msgEl) msgEl.innerHTML = formattedMessage;
    }

    // Giống music2: tắt show → reflow → bật show → hẹn ẩn 10s
    noti.classList.remove('show');
    void noti.offsetHeight;
    noti.classList.add('show');
    forceScaleNotification();

    notificationTimeout = setTimeout(() => {
        noti.classList.remove('show');
        notificationTimeout = null;
    }, 10000);
}

// Khi bật màn hình / quay lại tab: setTimeout có thể bị hệ thống hủy
// → nếu toast vẫn đang show thì đặt lại hẹn ẩn ngắn (toast cũ không giữ lâu)
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
            showNotification('+1 LISTEN:', `<i class="fa-regular fa-star"></i> ${songId} <i class="fa-regular fa-star"></i>`, '#4ade80', 'headphones');
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


/** Cộng giây nghe thật (khi đang play) — lưu theo ngày */
let _lastListenTickAt = 0;
function recordListenSeconds(deltaSec) {
    if (!deltaSec || deltaSec <= 0 || deltaSec > 5) return;
    if (typeof getCurrentUsername !== 'function' || !getCurrentUsername()) return;
    if (typeof updateCurrentAccount !== 'function') return;
    const day = (typeof getTodayKey === 'function') ? getTodayKey() : new Date().toISOString().slice(0, 10);
    updateCurrentAccount(acc => {
        if (!acc.listenTime || typeof acc.listenTime !== 'object') acc.listenTime = { total: 0, byDay: {} };
        if (!acc.listenTime.byDay || typeof acc.listenTime.byDay !== 'object') acc.listenTime.byDay = {};
        acc.listenTime.total = (Number(acc.listenTime.total) || 0) + deltaSec;
        acc.listenTime.byDay[day] = (Number(acc.listenTime.byDay[day]) || 0) + deltaSec;
    });
    // Sync Firebase thưa (mỗi ~30s nghe)
    if (!window._listenTimeSyncAt) window._listenTimeSyncAt = 0;
    if (Date.now() - window._listenTimeSyncAt > 30000) {
        window._listenTimeSyncAt = Date.now();
        try {
            const db = getDb();
            const name = getCurrentUsername();
            const acc = getCurrentAccount();
            if (db && name && acc && acc.listenTime) {
                const key = sanitizeUsernameKey(name);
                db.ref(dataPath('users') + '/' + key + '/listenTime').set(acc.listenTime);
            }
        } catch (e) {}
    }
}

async function incrementListenCount(songId, songName, source = 'normal') {
    if (!songId || isUpdatingListen) return false;
    const sid = String(songId);
    const user = (typeof getCurrentUsername === 'function' && getCurrentUsername()) || '';
    // Mỗi user chỉ cộng 1 lần / bài (kể cả đăng nhập lại, máy khác cùng account)
    if (user) {
        const acc = typeof getCurrentAccount === 'function' ? getCurrentAccount() : null;
        const listened = (acc && acc.listenedSongs && typeof acc.listenedSongs === 'object') ? acc.listenedSongs : {};
        if (listened[sid]) {
            // Đã từng qua mốc 5s với user này → không cộng nữa
            return false;
        }
    } else {
        // Chưa đăng nhập: không cộng lượt (tránh spam ảo)
        return false;
    }

    isUpdatingListen = true;
    try {
        // Đánh dấu user đã tính bài này (local ngay)
        updateCurrentAccount(acc => {
            if (!acc.listenedSongs || typeof acc.listenedSongs !== 'object') acc.listenedSongs = {};
            acc.listenedSongs[sid] = Date.now();
            // XP nghe bài lần đầu
            acc.xp = (Number(acc.xp) || 0) + 5;
            acc.seasonXp = (Number(acc.seasonXp) || 0) + 5;
            const lvl = Math.max(1, Math.floor((Number(acc.xp) || 0) / 100) + 1);
            acc.level = lvl;
        });

        if (!listenData[sid]) listenData[sid] = 0;
        listenData[sid]++;
        const songIndex = songs.findIndex(s => String(s.id) === sid);
        if (songIndex !== -1) songs[songIndex].listenCount = listenData[sid];
        localStorage.setItem(storageKey(STORAGE_LISTENS), JSON.stringify(listenData));
        updateListenStatsModal();
        console.log(`GHI NHẬN (1 lần/user): ${songName} (${sid}) → ${listenData[sid]}`);
        showNotification('+1 LISTEN:', `<i class="fa-regular fa-star"></i> ${sid} <i class="fa-regular fa-star"></i>`, '#4ade80', 'headphones');

        const db = getDb();
        if (db) {
            // Thử path prefix rồi root — rules cần cho phép ghi listenCount (không cần auth)
            let serverCount = listenData[sid];
            let wrote = false;
            const paths = [dataPath('songs') + '/' + sid + '/listenCount'];
            if (dataPath('songs') !== 'songs') paths.push('songs/' + sid + '/listenCount');
            for (const p of paths) {
                try {
                    const ref = db.ref(p);
                    const result = await ref.transaction(current => (Number(current) || 0) + 1);
                    if (result && result.committed) {
                        serverCount = result.snapshot.val() || serverCount;
                        wrote = true;
                        break;
                    }
                } catch (e) {
                    console.warn('listenCount write fail', p, e && (e.code || e.message));
                }
            }
            if (wrote) {
                listenData[sid] = serverCount;
                if (songIndex !== -1) songs[songIndex].listenCount = serverCount;
                localStorage.setItem(storageKey(STORAGE_LISTENS), JSON.stringify(listenData));
                updateListenStatsModal();
                if (typeof renderPlaylist === 'function') renderPlaylist();
            } else {
                console.warn('Không ghi được listenCount lên Firebase — kiểm tra Rules songs/$id/listenCount');
            }
            // Firebase user.listenedSongs
            const key = sanitizeUsernameKey(user);
            await db.ref(dataPath('users') + '/' + key + '/listenedSongs/' + sid).set(Date.now());
            const acc2 = getCurrentAccount();
            if (acc2) {
                await db.ref(dataPath('users') + '/' + key).update({
                    xp: Number(acc2.xp) || 0,
                    seasonXp: Number(acc2.seasonXp) || 0,
                    level: Number(acc2.level) || 1
                });
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
        // createIcons SAU khi append vào DOM để màu sắc tính đúng
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: Array.from(modal.querySelectorAll('[data-lucide]')) });
        const closeBtn = document.getElementById('close-listen-modal');
        if (closeBtn) closeBtn.onclick = () => modal.classList.remove('show');
    }
    
    updateListenStatsModal();
    
    // Force reflow + rAF để luôn có animation slide in (kể cả lần đầu tạo modal)
    const openWithAnimation = () => {
        void modal.offsetWidth;
        requestAnimationFrame(() => {
            modal.classList.add('show');
            setTimeout(() => scrollToCurrentListenSong(), 300);
        });
    };
    
    if (isFirstCreate || modal.classList.contains('show')) {
        // Lần đầu hoặc đang mở → reset rồi mở lại để có animation
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

function scrollToActiveTop() {
    const activeItem = document.querySelector('.song-item.active');
    if (!activeItem) return;
    const scrollContainer = document.getElementById('playlist-content');
    if (!scrollContainer) return;
    const header = document.querySelector('.playlist-header');
    const headerHeight = header ? header.offsetHeight : 65;
    const targetScroll = activeItem.offsetTop - headerHeight - 4;
    scrollContainer.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
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
        // Hỗ trợ [mm:ss], [mm:ss.x], [mm:ss.xx], [mm:ss.xxx]
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
    // Raw LRC thường bắt đầu bằng [ti:], [ar:], hoặc [mm:ss...]
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
                // Nếu là text LRC thô (admin dán trực tiếp) → parse luôn, không fetch
                if (looksLikeLrcText(src) && !looksLikeUrl(src)) {
                    const parsed = parseLRC(src);
                    if (parsed && parsed.length > 0) return parsed;
                    continue;
                }
                // Còn lại coi như URL
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
    const containerWidth = songTitleEl.parentElement?.clientWidth || window.innerWidth - 80;
    let originalFontSize = 1.4;
    songTitleEl.style.fontSize = originalFontSize + 'rem';
    songTitleEl.style.whiteSpace = 'nowrap';
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
    
    const playUrl = getPlayableAudio(song);
    if (isSongOwned(song.id) && playUrl) lastTriedFullUrl[String(song.id)] = playUrl;
    // Chỉ đổi src/load khi URL thật sự khác — tránh giật khi gọi lại cùng bài
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
    demoLockedSongId = null; // đổi bài → bỏ khóa demo
    isChanging = false;
}

function changeSong(i, source = 'normal') {
    currentSource = source;
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
    if (playlistOverlay) playlistOverlay.classList.remove('active');
    // Chọn từ danh sách tổng → thoát chế độ playlist cá nhân
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
        // Lịch sử đơn giản: bài trước trong indices
        const pos = indices.indexOf(currentIdx);
        if (pos < 0) return indices[indices.length - 1];
        return indices[(pos - 1 + indices.length) % indices.length];
    }
    const pos = indices.indexOf(currentIdx);
    if (pos < 0) return indices[indices.length - 1];
    return indices[(pos - 1 + indices.length) % indices.length];
}

/** Phát tất cả bài trong playlist của tôi (chỉ vòng trong playlist đó) */
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
    // Đưa các bài còn lại vào queue để next dùng
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
    // Bắt buộc có username
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
    
    // Click "Bắt đầu" = user gesture → được autoplay + cộng lượt nghe
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
    
    // Chờ danh sách bài nếu chưa có
    if (!songs.length) {
        pendingPlayAfterLoad = true;
        return;
    }

    // Ưu tiên: tiếp tục đúng bài + đúng phút đã lưu, rồi phát luôn
    try {
        const resumed = await restorePlaybackState({ autoplay: true, force: true });
        if (resumed) {
            setTimeout(() => {
                updateCurrentSongHighlightAndScroll();
                updateListenStatsModal();
            }, 100);
            return;
        }
    } catch (e) {
        console.warn('restore on start:', e);
    }

    // Không có lịch sử → phát bài hiện tại từ đầu
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
    // Thử link full thứ 2 nếu đang nghe full
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

audio.ontimeupdate = () => {
    // Ghi nhận thời gian nghe thực (khi đang play)
    try {
        if (!audio.paused && hasUserInteracted && songs[index]) {
            const now = Date.now();
            if (_lastListenTickAt > 0) {
                const d = (now - _lastListenTickAt) / 1000;
                if (d > 0 && d < 3) recordListenSeconds(d);
            }
            _lastListenTickAt = now;
        } else {
            _lastListenTickAt = 0;
        }
    } catch (e) {}
    // Đã khóa demo → bỏ qua mọi xử lý (tránh seek lặp gây giật)
    if (demoLockedSongId) return;

    const cur = audio.currentTime;
    const dur = audio.duration;
    const now = performance.now();

    // Cập nhật thời gian / progress thưa hơn để nhẹ main thread
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
    
    // Demo 60s nếu chưa sở hữu bài → dừng hẳn, mở cửa hàng đúng bài (không random tiếp)
    if (songs[index] && !isSongOwned(songs[index].id) && cur >= DEMO_SECONDS) {
        const demoSong = songs[index];
        demoLockedSongId = String(demoSong.id);
        showNotification('DEMO HẾT:', 'MUA ĐỂ NGHE FULL — ' + (demoSong.name || demoSong.id), '#ff9800', 'store');
        openShopModal(demoSong.id);
        audio.pause();
        // Chỉ seek 1 lần khi khóa demo
        try { audio.currentTime = DEMO_SECONDS; } catch (e) {}
        updateProgressUI();
        return;
    }
    
    if (cur >= 5 && !hasRecordedCurrentSong && !isUpdatingListen && !isChanging && dur && dur > 5 && songs[index] && hasUserInteracted) {
        hasRecordedCurrentSong = true;
        // Không await — fire-and-forget để không block ontimeupdate
        incrementListenCount(songs[index].id, songs[index].name, currentSource);
    }
    
    if (isRepeatOne && dur && (dur - cur) <= 0.15 && !isLoopingHandled && dur > 0) {
        if (demoLockedSongId) return;
        isLoopingHandled = true;
        if (hasRecordedCurrentSong) {
            hasRecordedCurrentSong = false;
            currentSource = 'loop';
        }
        // Dùng ended/loop native nếu có thể — tránh seek cứng giữa ontimeupdate
        try {
            audio.currentTime = 0;
            const p = audio.play();
            if (p && p.catch) p.catch(() => setTimeout(() => audio.play().catch(() => {}), 30));
        } catch (e) {}
    }
    
    if (cur > 0.3 && dur && (dur - cur) > 0.3) isLoopingHandled = false;
};

audio.onended = () => {
    // File demo ngắn kết thúc / hết 60s → dừng, không nhảy bài random
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
            // Không audio.load() lại — load lại gây giật/ngắt quãng rõ
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
    requestWakeLock();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing";
    hidePlayerLoading();
};

audio.onpause = () => {
    isPlaying = false;
    setLucideIcon(document.getElementById('play-pause-btn'), 'play');
    if (art) art.style.animationPlayState = 'paused';
    releaseWakeLock();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused";
};

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function renderPlaylist() {
    const list = document.getElementById('playlist-content');
    if (!list) return;
    if (!songs || !songs.length) {
        list.innerHTML = '<div style="text-align:center;padding:40px">ĐANG TẢI DANH SÁCH...</div>';
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
}

function renderMyPlaylist() {
    const list = document.getElementById('my-playlist-content');
    const toolbar = document.getElementById('my-playlist-toolbar');
    if (!list) return;
    const ids = loadMyPlaylist();
    if (toolbar) toolbar.style.display = ids.length ? 'flex' : 'none';
    if (!ids.length) {
        list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);font-size:0.85rem;">Chưa có bài — bấm icon playlist bên cạnh bài hát để thêm</div>';
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
                // Phát 1 bài trong playlist → vẫn giữ vòng playlist của tôi
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

// interaction-hint: bắt buộc username trước khi vào (xử lý trong setupUsernameGate)
if (hint) {
    // Xóa handler cũ nếu có
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
        renderPlaylist();
        if (playlistOverlay) {
            playlistOverlay.classList.add('active');
            refreshModalIcons(playlistOverlay);
        }
        setTimeout(scrollToActiveTop, 150);
    };
}

const closePlaylistBtn = document.getElementById('close-playlist-btn');
if (closePlaylistBtn && playlistOverlay) closePlaylistBtn.onclick = () => playlistOverlay.classList.remove('active');

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
        // Đổi icon: bình thường = repeat, khi bật lặp 1 bài = repeat-1
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
        }, 300);
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
        const mins = Math.floor(remainSeconds / 60);
        const secs = remainSeconds % 60;
        if (timerStatus) timerStatus.innerHTML = `TẮT SAU: <strong>${mins}</strong> PHÚT <strong>${secs}</strong> GIÂY`;
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
    // Tắt transition tạm thời để tránh nháy nút khi đổi theme
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
    
    // Bật lại transition sau 1 frame
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

window.addEventListener('beforeunload', () => {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
});

window.adjustLyricFontSize = adjustLyricFontSize;
window.selectSongFromList = selectSongFromList;

// ========== USERNAME + CỬA HÀNG XK (Firebase Realtime Database) ==========
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
        // Giá có thể nằm trong songs/{id}.price
        const list = await fetchSongsFromFirebase();
        const map = {};
        list.forEach(s => {
            if (s.price != null && !Number.isNaN(Number(s.price))) {
                map[s.id] = Number(s.price);
            }
        });
        // + node prices riêng (nếu có)
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
            listenTime: { total: 0, byDay: {} }
        };
        saveAllAccounts(accounts);
    } else {
        const a = accounts[name];
        if (!Array.isArray(a.favorites)) a.favorites = [];
        if (!Array.isArray(a.likes)) a.likes = [];
        if (!Array.isArray(a.dislikes)) a.dislikes = [];
        if (!Array.isArray(a.myPlaylist)) a.myPlaylist = [];
        if (!a.rentals || typeof a.rentals !== 'object') a.rentals = {};
        saveAllAccounts(accounts);
    }
    return accounts[name];
}

function sanitizeUsernameKey(name) {
    // Firebase key không được chứa . # $ [ ]
    return String(name || '').trim().replace(/[.#$\[\]/]/g, '_');
}

async function fetchUserFromFirebase(username) {
    const name = String(username || '').trim();
    if (!name) return null;
    const key = sanitizeUsernameKey(name);
    try {
        const db = getDb();
        if (!db) throw new Error('No DB');
        const snap = await db.ref(dataPath('users') + '/' + key).once('value');
        const data = snap.val();
        const accounts = getAllAccounts();
        if (data) {
            accounts[name] = {
                coins: data.coins | 0,
                owned: Array.isArray(data.owned) ? data.owned.map(String) : (data.owned ? String(data.owned).split(',').filter(Boolean) : []),
                favorites: Array.isArray(data.favorites) ? data.favorites.map(String) : [],
                likes: Array.isArray(data.likes) ? data.likes.map(String) : [],
                dislikes: Array.isArray(data.dislikes) ? data.dislikes.map(String) : [],
                myPlaylist: Array.isArray(data.myPlaylist) ? data.myPlaylist.map(String) : [],
                rentals: (data.rentals && typeof data.rentals === 'object') ? data.rentals : {},
                lastCheckin: data.lastCheckin || '',
                createdAt: data.createdAt || Date.now(),
                rank: data.rank || 'member',
                pin: data.pin != null ? String(data.pin) : '',
                banned: !!data.banned,
                banReason: data.banReason || '',
                xp: Number(data.xp) || 0,
                level: Number(data.level) || 1,
                seasonXp: Number(data.seasonXp) || 0,
                achievements: Array.isArray(data.achievements) ? data.achievements.map(String) : [],
                frame: data.frame || '',
                streak: Number(data.streak) || 0,
                streakFreeze: Number(data.streakFreeze) || 0,
                listenedSongs: (data.listenedSongs && typeof data.listenedSongs === 'object') ? data.listenedSongs : {},
                listenTime: (data.listenTime && typeof data.listenTime === 'object') ? data.listenTime : { total: 0, byDay: {} },
                ownedThumbs: Array.isArray(data.ownedThumbs) ? data.ownedThumbs.map(String) : [],
                activeThumb: data.activeThumb || '',
                inviteBy: data.inviteBy || '',
                profiles: Array.isArray(data.profiles) ? data.profiles : []
            };
            saveAllAccounts(accounts);
            return accounts[name];
        }
        // User mới — tạo trên Firebase
        const settings = getAdminSettings();
        const neu = {
            username: name,
            coins: settings.starterCoins,
            owned: [],
            favorites: [],
            likes: [],
            dislikes: [],
            myPlaylist: [],
            rentals: {},
            lastCheckin: '',
            createdAt: Date.now(),
            rank: 'member',
            pin: ''
        };
        await db.ref(dataPath('users') + '/' + key).set(neu);
        accounts[name] = { coins: neu.coins, owned: [], lastCheckin: '', createdAt: neu.createdAt, rank: 'member' };
        saveAllAccounts(accounts);
        return accounts[name];
    } catch (e) {
        console.warn('Lấy user Firebase thất bại, dùng local:', e);
    }
    return ensureUserAccount(name);
}

async function pushUserToFirebase(username, account) {
    const name = String(username || '').trim();
    if (!name || !account) return false;
    const key = sanitizeUsernameKey(name);
    try {
        const db = getDb();
        if (!db) return false;
        await db.ref(dataPath('users') + '/' + key).set({
            username: name,
            coins: account.coins | 0,
            owned: account.owned || [],
            favorites: account.favorites || [],
            likes: account.likes || [],
            dislikes: account.dislikes || [],
            myPlaylist: account.myPlaylist || [],
            rentals: account.rentals || {},
            lastCheckin: account.lastCheckin || '',
            createdAt: account.createdAt || Date.now(),
            rank: account.rank || 'member',
            pin: account.pin != null ? String(account.pin) : '',
            banned: !!account.banned,
            banReason: account.banReason || '',
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
        });
        return true;
    } catch (e) {
        console.warn('Lưu user Firebase thất bại:', e);
        return false;
    }
}

// Alias cũ
const fetchUserFromSheet = fetchUserFromFirebase;
const pushUserToSheet = pushUserToFirebase;

function getCurrentAccount() {
    const name = getCurrentUsername();
    if (!name) return null;
    return ensureUserAccount(name);
}

function updateCurrentAccount(mutator) {
    const name = getCurrentUsername();
    if (!name) return null;
    const accounts = getAllAccounts();
    if (!accounts[name]) {
        const settings = getAdminSettings();
        accounts[name] = { coins: settings.starterCoins, owned: [], lastCheckin: '', createdAt: Date.now() };
    }
    mutator(accounts[name]);
    saveAllAccounts(accounts);
    pushUserToFirebase(name, accounts[name]);
    return accounts[name];
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
        acc.owned = [...new Set((ids || []).map(String))];
    });
}

function isSongOwned(songId) {
    if (songId == null || songId === '') return true;
    const id = String(songId);
    if (loadOwnedSongs().includes(id)) return true;
    // Thuê 24h còn hạn?
    const acc = getCurrentAccount();
    if (acc && acc.rentals && acc.rentals[id]) {
        const exp = Number(acc.rentals[id]) || 0;
        if (exp > Date.now()) return true;
    }
    return false;
}

function isSongRented(songId) {
    const id = String(songId);
    const acc = getCurrentAccount();
    if (!acc || !acc.rentals || !acc.rentals[id]) return false;
    return Number(acc.rentals[id]) > Date.now();
}

function getRentExpiry(songId) {
    const acc = getCurrentAccount();
    if (!acc || !acc.rentals) return 0;
    return Number(acc.rentals[String(songId)]) || 0;
}

function getRentPrice(song) {
    if (song && song.rentPrice != null && !Number.isNaN(Number(song.rentPrice))) {
        return Math.max(0, Number(song.rentPrice));
    }
    // Mặc định: khoảng 40% giá mua, tối thiểu 1
    const buy = getSongPrice(song);
    return Math.max(1, Math.ceil(buy * 0.4));
}

function rentSong(songId) {
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
    if (isSongRented(songId)) {
        showNotification('THUÊ:', 'VẪN CÒN HẠN THUÊ', '#4ade80', 'clock');
        return false;
    }
    const price = getRentPrice(song);
    const coins = loadCoins();
    if (coins < price) {
        showNotification('THIẾU XU:', `THUÊ CẦN ${price} XK — ĐANG CÓ ${coins} XK`, '#ff9800', 'coins');
        return false;
    }
    const expiry = Date.now() + 24 * 60 * 60 * 1000;
    updateCurrentAccount(acc => {
        acc.coins = (acc.coins | 0) - price;
        if (!acc.rentals) acc.rentals = {};
        acc.rentals[String(songId)] = expiry;
    });
    showNotification('THUÊ 24H:', String(songId), '#4ade80', 'clock');
    renderShopList();
    if (typeof renderShopThumbs === 'function') renderShopThumbs();
    updateShopBalanceUI();
    // Thuê bài đang demo / đang nghe → full từ mốc 1 phút (giống mua)
    const isCurrentOrDemo = (songs[index] && String(songs[index].id) === String(songId))
        || (demoLockedSongId != null && String(demoLockedSongId) === String(songId));
    if (isCurrentOrDemo) {
        const songIdx = songs.findIndex(s => String(s.id) === String(songId));
        if (songIdx !== -1) index = songIdx;
        demoLockedSongId = null;
        const fullUrl = getPlayableAudio(songs[index]);
        if (fullUrl) {
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
        }
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
    // Flash sale toàn site
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

function doDailyCheckin() {
    if (!getCurrentUsername()) {
        showNotification('LỖI:', 'CHƯA ĐĂNG NHẬP USERNAME', '#ff4444', 'user');
        return false;
    }
    if (hasCheckedInToday()) {
        showNotification('ĐIỂM DANH:', 'HÔM NAY ĐÃ ĐIỂM DANH RỒI', '#ff9800', 'calendar-check');
        return false;
    }
    const reward = getAdminSettings().checkinReward;
    let streakMsg = '';
    updateCurrentAccount(acc => {
        const today = getTodayKey();
        const y = new Date(); y.setDate(y.getDate() - 1);
        const yKey = y.getFullYear() + '-' + String(y.getMonth()+1).padStart(2,'0') + '-' + String(y.getDate()).padStart(2,'0');
        let streak = Number(acc.streak) || 0;
        if (acc.lastCheckin === yKey) streak += 1;
        else if (acc.lastCheckin === today) { /* no-op */ }
        else if ((Number(acc.streakFreeze) || 0) > 0 && acc.lastCheckin !== today) {
            acc.streakFreeze = (Number(acc.streakFreeze) || 0) - 1;
            streak = Math.max(1, streak); // giữ streak nhờ freeze
            streakMsg = ' (dùng 1 Streak Freeze)';
        } else {
            streak = 1;
        }
        acc.streak = streak;
        acc.coins = (acc.coins | 0) + reward + Math.min(10, Math.floor(streak / 7) * 5);
        acc.lastCheckin = today;
        acc.xp = (Number(acc.xp) || 0) + 10;
        acc.seasonXp = (Number(acc.seasonXp) || 0) + 10;
        acc.level = Math.max(1, Math.floor((Number(acc.xp) || 0) / 100) + 1);
    });
    const st = (getCurrentAccount() || {}).streak || 1;
    showNotification('ĐIỂM DANH:', `+${reward} XU · Streak ${st}${streakMsg}`, '#4ade80', 'coins');
    updateCheckinButtonUI();
    updateShopBalanceUI();
    updateUsernameBadge();
    renderShopList();
    return true;
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
        showNotification('THIẾU XU:', `CẦN ${price} XK — ĐANG CÓ ${coins} XK`, '#ff9800', 'coins');
        return false;
    }
    updateCurrentAccount(acc => {
        acc.coins = (acc.coins | 0) - price;
        if (!Array.isArray(acc.owned)) acc.owned = [];
        acc.owned.push(String(songId));
        acc.owned = [...new Set(acc.owned)];
    });
    showNotification('MUA THÀNH CÔNG:', String(songId), '#4ade80', 'shopping-bag');
    renderShopList();
    if (typeof renderShopThumbs === 'function') renderShopThumbs();
    updateShopBalanceUI();
    updateUsernameBadge();
    
    // Mua đúng bài vừa hết demo (hoặc đang nghe) → phát full từ mốc 1 phút
    const isCurrentOrDemo = (songs[index] && String(songs[index].id) === String(songId))
        || (demoLockedSongId != null && String(demoLockedSongId) === String(songId));
    
    if (isCurrentOrDemo) {
        // Đảm bảo đang đứng đúng bài vừa mua
        const songIdx = songs.findIndex(s => String(s.id) === String(songId));
        if (songIdx !== -1) index = songIdx;
        
        demoLockedSongId = null;
        const fullUrl = getPlayableAudio(songs[index]);
        if (fullUrl) {
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
            // Fallback nếu metadata đã có sẵn
            if (audio.readyState >= 1) {
                try {
                    const seekTo = Math.min(DEMO_SECONDS, (audio.duration || DEMO_SECONDS) - 0.5);
                    audio.currentTime = Math.max(0, seekTo);
                } catch (e) {}
                audio.play().catch(() => {});
            }
        }
    }
    return true;
}

function updateShopBalanceUI() {
    const el = document.getElementById('shop-coin-count');
    if (el) el.textContent = String(loadCoins());
    updateShopUserProfile();
}

/** Rank: member | vip | super_vip | admin */
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
    // Username đã chuyển vào cửa hàng
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
        const rentP = getRentPrice(s);
        let action = '';
        if (owned && loadOwnedSongs().includes(id)) {
            action = `<span class="shop-owned-badge">ĐÃ MUA</span>`;
        } else if (rented) {
            action = `<span class="shop-owned-badge shop-rent-countdown" data-rent-exp="${getRentExpiry(id)}">THUÊ …</span>
                <button type="button" class="shop-buy-btn" data-buy-id="${id}">MUA ${price} XK</button>`;
        } else {
            action = `<button type="button" class="shop-buy-btn" data-buy-id="${id}">MUA ${price} XK</button>
                <button type="button" class="shop-buy-btn shop-rent-btn" data-rent-id="${id}">THUÊ 24H ${rentP} XK</button>`;
        }
        const priceLabel = (owned && loadOwnedSongs().includes(id)) ? '' : `<div class="shop-item-price">Mua ${price} XK · Thuê ${rentP} XK/24h</div>`;
        return `<div class="shop-item ${owned ? 'owned' : ''} ${isFocus ? 'highlight-buy' : ''}" data-song-id="${id}">
            <div class="shop-item-info">
                <div class="shop-item-name">${name}${owned ? '' : ' <span class="demo-badge">DEMO 1P</span>'}</div>
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
            rentSong(btn.getAttribute('data-rent-id'));
        };
    });

    if (window._shopRentTimer) clearInterval(window._shopRentTimer);
    const tickRent = () => {
        list.querySelectorAll('.shop-rent-countdown[data-rent-exp]').forEach(el => {
            const exp = Number(el.getAttribute('data-rent-exp')) || 0;
            let left = Math.max(0, exp - Date.now());
            if (left <= 0) {
                el.textContent = 'HẾT HẠN THUÊ';
                return;
            }
            const h = Math.floor(left / 3600000);
            const mi = Math.floor((left % 3600000) / 60000);
            const s = Math.floor((left % 60000) / 1000);
            el.textContent = 'THUÊ ' + String(h).padStart(2,'0') + ':' + String(mi).padStart(2,'0') + ':' + String(s).padStart(2,'0');
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


async function fetchProgressThumbs() {
    try {
        const db = getDb();
        if (!db) return [];
        const snap = await db.ref('settings/progressThumbs').once('value');
        const v = snap.val();
        if (Array.isArray(v)) return v.filter(x => x && (x.id || x.url));
        if (v && typeof v === 'object') return Object.values(v).filter(x => x && (x.id || x.url));
    } catch (e) {
        console.warn('fetchProgressThumbs', e);
    }
    return [];
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
    list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-secondary);font-size:0.75rem;">Đang tải...</div>';
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
            btn = '<span class="shop-owned-badge">ĐANG DÙNG</span>' +
                '<button type="button" class="shop-buy-btn shop-rent-btn" data-clear-thumb="1">HỦY DÙNG</button>';
        } else if (has) {
            btn = '<button type="button" class="shop-buy-btn" data-use-thumb="' + id.replace(/"/g, '') + '">DÙNG</button>';
        } else {
            btn = '<button type="button" class="shop-buy-btn" data-buy-thumb="' + id.replace(/"/g, '') + '">MUA ' + (Number(th.price) || 0) + ' XK</button>';
        }
        const name = (typeof escapeHtml === 'function' ? escapeHtml(th.name || id) : (th.name || id));
        const url = th.url ? String(th.url).replace(/"/g, '&quot;') : '';
        return '<div class="shop-thumb-item" data-thumb-id="' + id.replace(/"/g, '') + '">' +
            (url ? '<img src="' + url + '" alt="" loading="lazy">' : '<div style="width:40px;height:40px;border-radius:8px;background:var(--progress-bg);"></div>') +
            '<div class="info"><div class="name">' + name + '</div>' +
            '<div class="price">' + (has ? 'Đã sở hữu' : ((Number(th.price) || 0) + ' xu')) + '</div></div>' +
            btn + '</div>';
    }).join('');
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
            renderShopThumbs();
            if (typeof showNotification === 'function') showNotification('THUMB:', 'Đã áp dụng', '#4ade80', 'check');
        };
    });
    list.querySelectorAll('[data-clear-thumb]').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            updateCurrentAccount(acc => { acc.activeThumb = ''; });
            applyActiveProgressThumb();
            renderShopThumbs();
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
        showNotification('THIẾU XU:', 'Cần ' + price + ' XK', '#ff9800', 'coins');
        return;
    }
    updateCurrentAccount(acc => {
        acc.coins = (acc.coins | 0) - price;
        if (!Array.isArray(acc.ownedThumbs)) acc.ownedThumbs = [];
        if (!acc.ownedThumbs.includes(String(thumbId))) acc.ownedThumbs.push(String(thumbId));
        // Không auto bật — hiện nút DÙNG để user chọn
    });
    renderShopThumbs();
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


/** PIN 6 số — UI ô giống upload.xuanken.name.vn */
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

/** Máy này đã nhập đúng PIN cho username trong vòng 7 ngày? */
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

function setPinSectionVisible(show) {
    const boxes = document.getElementById('pin-boxes');
    const hint = document.getElementById('pin-hint');
    const label = document.querySelector('label.username-label[for="pin-hidden"], label.username-label');
    // label "MÃ PIN" — tìm label gần pin-boxes
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
    const pin = String(rawPin || '').trim();
    const settings = getAdminSettings();
    const requirePin = settings.requirePin !== false;
    const allowRegister = settings.allowRegister !== false;

    if (!name || name.length < 2) {
        return { ok: false, message: 'Username tối thiểu 2 ký tự' };
    }
    if (name.length > 20) {
        return { ok: false, message: 'Username tối đa 20 ký tự' };
    }
    if (!/^[\w\u00C0-\u024F\u1E00-\u1EFF .-]+$/i.test(name)) {
        return { ok: false, message: 'Username không hợp lệ' };
    }
    // Đã xác nhận PIN trên máy này (< 7 ngày) → bỏ qua nhập PIN
    const pinTrusted = isPinTrusted(name);
    if (requirePin && !pinTrusted) {
        if (!/^[0-9]{6}$/.test(pin)) {
            return { ok: false, message: 'PIN phải đúng 6 chữ số' };
        }
    }

    // Chỉ đọc user — không tự tạo trong bước kiểm tra
    const key = sanitizeUsernameKey(name);
    let remote = null;
    let dbOk = false;
    try {
        const db = getDb();
        if (db) {
            const snap = await db.ref(dataPath('users') + '/' + key).once('value');
            remote = snap.val();
            dbOk = true;
        }
    } catch (e) {
        console.warn('Kiểm tra user Firebase lỗi:', e);
    }

    if (remote) {
        if (remote.banned) {
            return { ok: false, message: 'Tài khoản đã bị khóa' + (remote.banReason ? (': ' + remote.banReason) : '') };
        }
        const savedPin = remote.pin != null ? String(remote.pin) : '';
        if (!pinTrusted) {
            if (savedPin) {
                if (pin !== savedPin) {
                    return { ok: false, message: 'Sai mã PIN' };
                }
            } else if (requirePin) {
                // User cũ chưa có PIN → lần này đặt PIN mới
                if (!/^[0-9]{6}$/.test(pin)) {
                    return { ok: false, message: 'Tài khoản chưa có PIN — hãy đặt PIN 6 số mới' };
                }
            }
        }
        // Đồng bộ local + cập nhật PIN nếu trước đó trống
        await fetchUserFromSheet(name);
        const acc = ensureUserAccount(name);
        if (requirePin && pin && (!acc.pin || acc.pin === '')) {
            acc.pin = pin;
            const accounts = getAllAccounts();
            if (accounts[name]) accounts[name].pin = pin;
            saveAllAccounts(accounts);
            await pushUserToSheet(name, accounts[name] || acc);
        }
    } else {
        // User chưa tồn tại
        if (!allowRegister) {
            return { ok: false, message: 'Username chưa được đăng ký — liên hệ admin' };
        }
        if (requirePin && !/^[0-9]{6}$/.test(pin)) {
            return { ok: false, message: 'Đăng ký mới cần đặt PIN đúng 6 số' };
        }
        // Tạo user mới (fetchUserFromFirebase sẽ create)
        await fetchUserFromSheet(name);
        const acc = ensureUserAccount(name);
        if (pin) {
            acc.pin = pin;
            const accounts = getAllAccounts();
            if (accounts[name]) accounts[name].pin = pin;
            saveAllAccounts(accounts);
            await pushUserToSheet(name, accounts[name] || acc);
        } else {
            await pushUserToSheet(name, acc);
        }
    }

    setCurrentUsername(name);
    // Nhớ máy này đã xác nhận PIN (7 ngày) — thiết bị khác vẫn phải nhập
    if (requirePin) {
        if (pinTrusted || /^[0-9]{6}$/.test(pin)) {
            markPinTrusted(name);
        }
    }
    updateUsernameBadge();
    updateShopBalanceUI();
    updateCheckinButtonUI();
    startPlaybackSyncListener();
    return { ok: true, username: name };
}

function setupUsernameGate() {
    const form = document.getElementById('username-form');
    const input = document.getElementById('username-input');
    const err = document.getElementById('username-error');
    const startBtn = document.getElementById('username-start-btn');
    const existing = getCurrentUsername();
    initPinBoxes();

    function refreshPinVisibility() {
        const settings = getAdminSettings();
        const requirePin = settings.requirePin !== false;
        const name = (input && input.value || '').trim();
        if (!requirePin) {
            setPinSectionVisible(false);
            return;
        }
        // Cùng máy + đúng user + còn trong 7 ngày → ẩn PIN
        const trusted = name && isPinTrusted(name);
        setPinSectionVisible(!trusted);
        const hint = document.getElementById('pin-hint');
        if (hint && !trusted) {
            hint.textContent = 'Nhập đúng 6 chữ số · User mới = đặt PIN mới';
        }
    }
    
    if (existing && input) {
        input.value = existing;
        fetchUserFromSheet(existing).then(() => {
            updateUsernameBadge();
            updateShopBalanceUI();
            updateCheckinButtonUI();
            startPlaybackSyncListener();
        });
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
            const needPin = getAdminSettings().requirePin !== false && !isPinTrusted(String(name || '').trim());
            const result = await loginWithUsername(name, needPin ? getPinValue() : '');
            if (!result.ok) {
                if (err) {
                    err.textContent = result.message;
                    err.style.display = 'block';
                }
                if (/PIN|pin|mã/i.test(result.message || '')) shakePinBoxes();
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
            // Hết hạn 7 ngày / máy lạ → bắt nhập PIN lại
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

// Gắn sự kiện cửa hàng

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

// Settings / prices / songs được load ở cuối file (sau khi define đủ hàm)


// ===== PRELOAD bài kế tiếp (shuffle / tuần tự) =====
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

// ===== LƯU / TIẾP TỤC vị trí nghe theo username (mọi thiết bị) =====
// Máy A nghe đến phút X → dừng/thoát → lưu.
// Máy A/B/C vào lại (cùng username) → mở đúng bài + đúng phút đó.
const DEVICE_ID = (() => {
    let id = localStorage.getItem(storageKey(STORAGE_DEVICE_ID));
    if (!id) {
        // fallback key cũ (không prefix) → chuyển sang key mới nếu có
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
let playbackRestored = false;

function getLocalPlaybackKey() {
    const name = getCurrentUsername();
    if (!name) return null;
    return storageKey('xuanken_playback_' + sanitizeUsernameKey(name));
}

function savePlaybackLocal(data) {
    const k = getLocalPlaybackKey();
    if (!k || !data) return;
    try { localStorage.setItem(k, JSON.stringify(data)); } catch (e) {}
}

function loadPlaybackLocal() {
    const k = getLocalPlaybackKey();
    if (!k) return null;
    try {
        const raw = localStorage.getItem(k);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

/** Lưu vị trí đang nghe (local + Firebase) — gọi khi pause / thoát / định kỳ */
function pushPlaybackSync(force) {
    const name = getCurrentUsername();
    if (!name || !songs[index] || syncApplying) return;
    const now = Date.now();
    if (!force && now - lastSyncPush < 2000) return;
    lastSyncPush = now;
    const data = {
        songId: String(songs[index].id),
        position: Math.floor(audio.currentTime || 0),
        isPlaying: !audio.paused,
        deviceId: DEVICE_ID,
        updatedAt: now
    };
    savePlaybackLocal(data);
    const db = getDb();
    if (!db) return;
    const key = sanitizeUsernameKey(name);
    try {
        db.ref(dataPath('users') + '/' + key + '/playback').set(data);
    } catch (e) {}
}

async function fetchPlaybackFromFirebase() {
    const name = getCurrentUsername();
    const db = getDb();
    if (!name || !db) return loadPlaybackLocal();
    try {
        const snap = await db.ref(dataPath('users') + '/' + sanitizeUsernameKey(name) + '/playback').once('value');
        const data = snap.val();
        if (data && data.songId) {
            savePlaybackLocal(data);
            return data;
        }
    } catch (e) {}
    return loadPlaybackLocal();
}

/**
 * Khôi phục bài + phút đã lưu.
 * opts.autoplay = true: phát luôn (gọi khi user bấm "Bắt đầu" — đã có gesture).
 * opts.force = true: cho phép restore lại dù đã restore trước đó.
 * Trả về true nếu đã restore được bài đã lưu.
 */
async function restorePlaybackState(opts = {}) {
    const autoplay = !!opts.autoplay;
    const force = !!opts.force;
    if (playbackRestored && !force && !autoplay) return false;
    if (!songs.length || !getCurrentUsername()) return false;

    const data = await fetchPlaybackFromFirebase();
    if (!data || !data.songId) {
        playbackRestored = true;
        return false;
    }
    const songIdx = songs.findIndex(s => String(s.id) === String(data.songId));
    if (songIdx < 0) {
        playbackRestored = true;
        return false;
    }
    const pos = Math.max(0, Number(data.position) || 0);
    syncApplying = true;
    playbackRestored = true;
    try {
        // Đang phát đúng bài rồi → không loadSong lại (tránh giật)
        const alreadyThis = songIdx === index && audio.src &&
            isSameAudioSrc(audio.src, getPlayableAudio(songs[songIdx]));
        if (!alreadyThis) {
            await loadSong(songIdx);
        }
        const applySeek = () => {
            try {
                if (audio.duration && pos >= audio.duration - 1) {
                    audio.currentTime = 0;
                } else {
                    audio.currentTime = Math.min(pos, Math.max(0, (audio.duration || pos) - 0.25));
                }
            } catch (e) {}
        };
        if (audio.readyState >= 1) applySeek();
        else {
            await new Promise(resolve => {
                const onMeta = () => { applySeek(); resolve(); };
                audio.addEventListener('loadedmetadata', onMeta, { once: true });
                // fallback nếu metadata chậm
                setTimeout(() => { applySeek(); resolve(); }, 1500);
            });
        }

        console.log('RESUME:', data.songId, 'tại', pos, 's', autoplay ? '(autoplay)' : '');
        if (autoplay) {
            // User vừa bấm "Bắt đầu" → đây là user gesture, được phép play
            try {
                await audio.play();
            } catch (e) {
                console.log('RESUME play:', e);
                // Thử lại sau seek
                setTimeout(() => audio.play().catch(() => {}), 200);
            }
        } else {
            audio.pause();
        }
        return true;
    } finally {
        setTimeout(() => { syncApplying = false; }, 600);
    }
}

function startPlaybackSyncListener() {
    // Chỉ preload vị trí (không auto-play) khi đã có username + danh sách bài
    playbackRestored = false;
    const tryRestore = () => {
        if (songs.length) restorePlaybackState({ autoplay: false });
        else setTimeout(tryRestore, 800);
    };
    tryRestore();
}

// Lưu định kỳ khi đang phát
setInterval(() => {
    if (!audio.paused && hasUserInteracted && !syncApplying) pushPlaybackSync(false);
}, 5000);

// Lưu ngay khi pause / đổi bài xong
audio.addEventListener('pause', () => { if (!syncApplying) pushPlaybackSync(true); });
audio.addEventListener('play', () => {
    if (!syncApplying) pushPlaybackSync(true);
    preloadNextSong();
});
audio.addEventListener('ended', () => { if (!syncApplying) pushPlaybackSync(true); });

// Thoát tab / tắt màn hình / đóng app → lưu vị trí
function savePlaybackOnLeave() {
    if (!syncApplying && songs[index] && hasUserInteracted) pushPlaybackSync(true);
}
window.addEventListener('pagehide', savePlaybackOnLeave);
window.addEventListener('beforeunload', savePlaybackOnLeave);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') savePlaybackOnLeave();
});

// My playlist button
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
window.fetchProgressThumbs = fetchProgressThumbs;
window.getCurrentUsername = getCurrentUsername;
// Expose for extras.js
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
})();




