let shuffleHistory = [];
let remainingQueue = [];
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
        name: s.name || '',
        artist: s.artist || ''
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
            albumArt: s.albumArt || '',
            listenCount: Number(s.listenCount) || 0,
            lrc1: s.lrc1 || '',
            lrc2: s.lrc2 || '',
            price: s.price != null ? Number(s.price) : null
        };
    }).filter(s => s.audio);
    // Sắp xếp theo bảng chữ cái (tên bài)
    list.sort((a, b) => {
        const na = String(a.name || '').localeCompare(String(b.name || ''), 'vi', { sensitivity: 'base' });
        if (na !== 0) return na;
        return String(a.id || '').localeCompare(String(b.id || ''), 'vi', { sensitivity: 'base' });
    });
    return list;
}

/** Link phát: đã mua → audioFull (nếu có), chưa mua → audio (demo) */
function getPlayableAudio(song) {
    if (!song) return '';
    if (isSongOwned(song.id) && song.audioFull) return song.audioFull;
    return song.audio || '';
}

async function fetchSongsFromFirebase() {
    const db = getDb();
    if (!db) throw new Error('Firebase chưa sẵn sàng');
    const snap = await db.ref('songs').once('value');
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
            
            const oldSongIds = new Set(songs.map(s => s.id));
            const addedSongs = newSongs.filter(s => !oldSongIds.has(s.id));
            
            const currentTime = audio.currentTime;
            const currentSongId = songs[index]?.id;
            
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
            
            const newIndex = songs.findIndex(s => s.id === currentSongId);
            if (newIndex !== -1 && newIndex !== index) {
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
            }
            
            if (oldIsShuffle && songs.length === newSongs.length) {
                shuffleHistory = oldShuffleHistory.filter(i => i < songs.length);
                remainingQueue = oldRemainingQueue.filter(i => i < songs.length);
                currentShuffleCycle = oldCurrentShuffleCycle.filter(i => i < songs.length);
            } else if (isShuffle) {
                resetShuffleState(index);
            }
            
            renderPlaylist();
            updateListenStatsModal();
            
            if (addedSongs.length > 0) {
                addedSongs.forEach(song => {
                    showNotification('BÀI HÁT MỚI THÊM:', `<i class="fa-regular fa-star"></i> ${song.id} <i class="fa-regular fa-star"></i>`, '#4ade80', 'plus-circle');
                });
            }
            
            // Không gán audio.currentTime khi đang phát — seek giữa chừng gây giật 1 phát
            // Chỉ cần cập nhật index/UI; audio tiếp tục stream bình thường
            void currentTime;
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
            localStorage.setItem('xuanken_listens', JSON.stringify(listenData));
        }
        return listenData;
    } catch (error) {
        console.log('Firebase listen error, using local data');
        const saved = localStorage.getItem('xuanken_listens');
        if (saved) {
            try { listenData = JSON.parse(saved); } catch (e) {}
            updateListenStatsModal();
        }
    }
    return listenData;
}

function startAutoRefresh(intervalSeconds = 60) {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    setTimeout(() => checkForUpdates(), 5000);
    autoRefreshInterval = setInterval(checkForUpdates, intervalSeconds * 1000);
    console.log(`ĐÃ BẬT TỰ ĐỘNG CẬP NHẬT ${intervalSeconds} GIÂY`);
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
            
            listenData = {};
            songs.forEach(song => {
                listenData[song.id] = song.listenCount || 0;
            });
            
            console.log(`ĐÃ TẢI ${songs.length} BÀI HÁT TỪ FIREBASE`);
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

async function incrementListenCount(songId, songName, source = 'normal') {
    if (!songId || isUpdatingListen) return false;
    
    isUpdatingListen = true;
    
    // 1. Cộng local + hiện toast NGAY (không chờ Firebase) — tránh phải pause mới hiện
    if (!listenData[songId]) listenData[songId] = 0;
    listenData[songId]++;
    
    const songIndex = songs.findIndex(s => s.id === songId);
    if (songIndex !== -1) {
        songs[songIndex].listenCount = listenData[songId];
    }
    
    localStorage.setItem('xuanken_listens', JSON.stringify(listenData));
    updateListenStatsModal();
    console.log(`GHI NHẬN: ${songName} (${songId}) - ${listenData[songId]}`);
    showNotification('+1 LISTEN:', `<i class="fa-regular fa-star"></i> ${songId} <i class="fa-regular fa-star"></i>`, '#4ade80', 'headphones');
    
    // 2. Đồng bộ Firebase ở background (không block UI)
    try {
        const db = getDb();
        if (db) {
            const ref = db.ref('songs/' + songId + '/listenCount');
            const result = await ref.transaction(current => (Number(current) || 0) + 1);
            const serverCount = result.snapshot.val() || listenData[songId];
            
            // Cập nhật lại cho khớp server (nếu có người khác cũng đang nghe)
            listenData[songId] = serverCount;
            if (songIndex !== -1) {
                songs[songIndex].listenCount = serverCount;
            }
            localStorage.setItem('xuanken_listens', JSON.stringify(listenData));
            updateListenStatsModal();
        }
    } catch (error) {
        console.error('LỖI TĂNG LƯỢT NGHE (Firebase):', error);
        // Local đã cộng rồi, không cần làm gì thêm
    } finally {
        isUpdatingListen = false;
    }
    return true;
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
    
    audio.pause();
    audio.src = getPlayableAudio(song);
    audio.load();
    
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
    changeSong(i, 'select');
}

function handleNextAction() {
    let next, source = 'next';
    if (isShuffle) {
        next = getNextShuffleIndex(index);
        source = 'shuffle';
    } else {
        next = (index + 1) % songs.length;
    }
    changeSong(next, source);
}

function prevSong() {
    let prev, source = 'prev';
    if (isShuffle) {
        prev = getPrevShuffleIndex(index);
        source = 'shuffle';
    } else {
        prev = (index - 1 + songs.length) % songs.length;
    }
    changeSong(prev, source);
}

function startPlayback() {
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
    
    // Đánh dấu đã tương tác — lần đầu vào web nghe cũng được cộng lượt
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
    
    if (songs.length > 0 && songs[index]) {
        // Chờ loadSong xong rồi mới play — tránh race isChanging / audio.load
        const needLoad = !audio.src || audio.src !== getPlayableAudio(songs[index]);
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
            if (songs[index] && (!audio.src || audio.src !== getPlayableAudio(songs[index]))) {
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
    showNotification('LỖI:', 'KHÔNG THỂ PHÁT BÀI HÁT!', '#ff4444', 'alert-circle');
    hidePlayerLoading();
};

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
        return `<div class="song-item ${i === index ? 'active' : ''}" onclick="window.selectSongFromList(${i})">
            <div class="flex-1">
                <div class="item-title text-sm uppercase font-bold break-words pr-2">${escapeHtml(s.name)}</div>
                <div class="song-artist-line text-xs text-gray-500"><i data-lucide="mic"></i><span>${escapeHtml(artistName)}</span></div>
            </div>
            ${i === index ? '<i data-lucide="smile"></i>' : ''}
        </div>`;
    }).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: Array.from(list.querySelectorAll('[data-lucide]')) });
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
        if (playlistOverlay) playlistOverlay.classList.add('active');
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
    const savedTheme = localStorage.getItem('xuanken_theme');
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
        localStorage.setItem('xuanken_theme', 'light');
        setThemeIcon(false);
        showNotification('LIGHT MODE:', 'ĐÃ CHUYỂN LIGHT', '#ff9800', 'sun');
    } else {
        document.body.classList.add('dark');
        localStorage.setItem('xuanken_theme', 'dark');
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
    const savedTheme = localStorage.getItem('xuanken_theme');
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
const STORAGE_ACCOUNTS = 'xuanken_accounts';
const STORAGE_CURRENT_USER = 'xuanken_current_user';
const STORAGE_ADMIN_SETTINGS = 'xuanken_admin_settings';
const STORAGE_SONG_PRICES = 'xuanken_song_prices';

const DEFAULT_ADMIN_SETTINGS = {
    adminPassword: 'xuanken2024',
    songPrice: 10,
    checkinReward: 15,
    starterCoins: 20
};

let sheetPricesCache = {};

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

async function syncSettingsFromFirebase() {
    try {
        const db = getDb();
        if (!db) return;
        const snap = await db.ref('settings').once('value');
        const val = snap.val();
        if (val && typeof val === 'object') {
            saveAdminSettings({ ...getAdminSettings(), ...val });
        }
    } catch (e) {
        console.warn('Không đồng bộ Settings Firebase:', e);
    }
}

function getSongPriceOverrides() {
    try {
        const raw = localStorage.getItem(STORAGE_SONG_PRICES);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

function saveSongPriceOverrides(map) {
    localStorage.setItem(STORAGE_SONG_PRICES, JSON.stringify(map || {}));
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
        const snap = await db.ref('prices').once('value');
        const prices = snap.val() || {};
        Object.keys(prices).forEach(id => {
            map[id] = Number(prices[id]) || 0;
        });
        sheetPricesCache = map;
        localStorage.setItem(STORAGE_SONG_PRICES, JSON.stringify(map));
    } catch (e) {
        console.warn('Không đồng bộ Prices Firebase:', e);
        sheetPricesCache = getSongPriceOverrides();
    }
}

function getAllAccounts() {
    try {
        const raw = localStorage.getItem(STORAGE_ACCOUNTS);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

function saveAllAccounts(accounts) {
    localStorage.setItem(STORAGE_ACCOUNTS, JSON.stringify(accounts || {}));
}

function getCurrentUsername() {
    return (localStorage.getItem(STORAGE_CURRENT_USER) || '').trim();
}

function setCurrentUsername(name) {
    localStorage.setItem(STORAGE_CURRENT_USER, String(name || '').trim());
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
            lastCheckin: '',
            createdAt: Date.now()
        };
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
        const snap = await db.ref('users/' + key).once('value');
        const data = snap.val();
        const accounts = getAllAccounts();
        if (data) {
            accounts[name] = {
                coins: data.coins | 0,
                owned: Array.isArray(data.owned) ? data.owned.map(String) : (data.owned ? String(data.owned).split(',').filter(Boolean) : []),
                lastCheckin: data.lastCheckin || '',
                createdAt: data.createdAt || Date.now()
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
            lastCheckin: '',
            createdAt: Date.now()
        };
        await db.ref('users/' + key).set(neu);
        accounts[name] = { coins: neu.coins, owned: [], lastCheckin: '', createdAt: neu.createdAt };
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
        await db.ref('users/' + key).set({
            username: name,
            coins: account.coins | 0,
            owned: account.owned || [],
            lastCheckin: account.lastCheckin || '',
            createdAt: account.createdAt || Date.now()
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
    return loadOwnedSongs().includes(String(songId));
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
    return settings.songPrice;
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
    updateCurrentAccount(acc => {
        acc.coins = (acc.coins | 0) + reward;
        acc.lastCheckin = getTodayKey();
    });
    showNotification('ĐIỂM DANH:', `+${reward} XU XK`, '#4ade80', 'coins');
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
}

function updateUsernameBadge() {
    const badge = document.getElementById('user-badge');
    const nameEl = document.getElementById('user-badge-name');
    const name = getCurrentUsername();
    if (badge) badge.style.display = name ? 'flex' : 'none';
    if (nameEl) nameEl.textContent = name || '';
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
        const action = owned
            ? `<span class="shop-owned-badge">ĐÃ MUA</span>`
            : `<button type="button" class="shop-buy-btn" data-buy-id="${id}">MUA ${price} XK</button>`;
        const priceLabel = owned ? '' : `<div class="shop-item-price">${price} XK</div>`;
        return `<div class="shop-item ${owned ? 'owned' : ''} ${isFocus ? 'highlight-buy' : ''}" data-song-id="${id}">
            <div class="shop-item-info">
                <div class="shop-item-name">${name}${owned ? '' : ' <span class="demo-badge">DEMO 1P</span>'}</div>
                <div class="shop-item-artist">${artist}</div>
                ${priceLabel}
            </div>
            ${action}
        </div>`;
    }).join('');
    
    list.querySelectorAll('.shop-buy-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            buySong(btn.getAttribute('data-buy-id'));
        };
    });

    if (focusId) {
        const el = list.querySelector(`.shop-item[data-song-id="${CSS.escape ? CSS.escape(focusId) : focusId}"]`);
        if (el) {
            setTimeout(() => {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 120);
        }
    }
}

function openShopModal(highlightSongId) {
    const modal = document.getElementById('shop-modal');
    if (!modal) return;
    updateShopBalanceUI();
    updateCheckinButtonUI();
    renderShopList(highlightSongId);
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

async function loginWithUsername(rawName) {
    const name = String(rawName || '').trim().replace(/\s+/g, ' ');
    if (!name || name.length < 2) {
        return { ok: false, message: 'Username tối thiểu 2 ký tự' };
    }
    if (name.length > 20) {
        return { ok: false, message: 'Username tối đa 20 ký tự' };
    }
    if (!/^[\w\u00C0-\u024F\u1E00-\u1EFF .-]+$/i.test(name)) {
        return { ok: false, message: 'Username không hợp lệ' };
    }
    setCurrentUsername(name);
    // Ưu tiên lấy từ Google Sheet, fallback local
    await fetchUserFromSheet(name);
    const acc = ensureUserAccount(name);
    // Bảo đảm user tồn tại trên Sheet
    await pushUserToSheet(name, acc);
    updateUsernameBadge();
    updateShopBalanceUI();
    updateCheckinButtonUI();
    return { ok: true, username: name };
}

function setupUsernameGate() {
    const form = document.getElementById('username-form');
    const input = document.getElementById('username-input');
    const err = document.getElementById('username-error');
    const startBtn = document.getElementById('username-start-btn');
    const existing = getCurrentUsername();
    
    if (existing && input) {
        input.value = existing;
        fetchUserFromSheet(existing).then(() => {
            updateUsernameBadge();
            updateShopBalanceUI();
            updateCheckinButtonUI();
        });
        updateUsernameBadge();
    }
    
    const submit = async () => {
        if (!input) return;
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.style.opacity = '0.7';
        }
        try {
            const result = await loginWithUsername(input.value);
            if (!result.ok) {
                if (err) {
                    err.textContent = result.message;
                    err.style.display = 'block';
                }
                return;
            }
            if (err) err.style.display = 'none';
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
            if (!e.target.closest('input') && !e.target.closest('button')) {
                startPlayback();
            }
        };
    }
}

// Gắn sự kiện cửa hàng
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

// Đồng bộ giá + settings từ Firebase (không chặn load nhạc)
syncPricesFromFirebase();
syncSettingsFromFirebase();

window.buySong = buySong;
window.isSongOwned = isSongOwned;
window.openShopModal = openShopModal;
window.getCurrentUsername = getCurrentUsername;
window.getAllAccounts = getAllAccounts;
window.getAdminSettings = getAdminSettings;
window.pushUserToFirebase = pushUserToFirebase;
window.fetchUserFromFirebase = fetchUserFromFirebase;
window.syncPricesFromFirebase = syncPricesFromFirebase;
window.getDb = getDb;

loadSongsFromFirebase();




