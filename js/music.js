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

const GOOGLE_SHEET_API = 'https://script.google.com/macros/s/AKfycbyl8Vx5ZWhhJJlXILIy0wJMpyboPTZ8vj5BncpR6SC5sgUnD_LzhpWjpAQ-Nn0yNLeeOA/exec';

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
    return JSON.stringify(data.map(s => ({ id: s.id, listenCount: s.listenCount })));
}

async function checkForUpdates() {
    if (isRefreshing || !songs.length) return;
    
    try {
        isRefreshing = true;
        const response = await fetch(`${GOOGLE_SHEET_API}?action=getSongs&t=${Date.now()}`);
        
        if (!response.ok) throw new Error('Fetch failed');
        
        const data = await response.json();
        if (!data || !data.songs || !data.songs.length) return;
        
        const newSongs = data.songs;
        const newHash = generateDataHash(newSongs);
        
        if (lastDataHash !== null && lastDataHash !== newHash) {
            console.log("PHÁT HIỆN THAY ĐỔI DỮ LIỆU, ĐANG CẬP NHẬT...");
            
            const oldSongIds = new Set(songs.map(s => s.id));
            const addedSongs = newSongs.filter(s => !oldSongIds.has(s.id));
            
            const wasPlaying = !audio.paused;
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
                if (song.listenCount !== undefined) {
                    listenData[song.id] = song.listenCount;
                }
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
                    showNotification('BÀI HÁT MỚI THÊM:', `<i class="fa-regular fa-star"></i> ${song.id} <i class="fa-regular fa-star"></i>`, '#4ade80', 'fa-plus-circle');
                });
            }
            
            if (wasPlaying && currentSongId && newIndex !== -1 && !audio.paused) {
                if (newIndex !== oldShuffleHistory[oldShuffleHistory.length - 1]) {
                    audio.currentTime = currentTime;
                }
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
        const response = await fetch(`${GOOGLE_SHEET_API}?action=get&t=${Date.now()}`);
        if (response.ok) {
            const data = await response.json();
            let hasChange = false;
            
            for (const song of songs) {
                const newCount = data[song.id] || 0;
                if (song.listenCount !== newCount) {
                    song.listenCount = newCount;
                    listenData[song.id] = newCount;
                    hasChange = true;
                }
            }
            
            if (hasChange) {
                updateListenStatsModal();
                localStorage.setItem('xuanken_listens', JSON.stringify(listenData));
            }
            return listenData;
        }
    } catch (error) {
        console.log('API error, using local data');
        const saved = localStorage.getItem('xuanken_listens');
        if (saved) {
            listenData = JSON.parse(saved);
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

async function loadSongsFromSheet() {
    try {
        const response = await fetch(`${GOOGLE_SHEET_API}?action=getSongs&t=${Date.now()}`);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        if (data && data.songs && data.songs.length > 0) {
            songs = data.songs;
            lastDataHash = generateDataHash(songs);
            
            listenData = {};
            songs.forEach(song => {
                if (song.id && song.listenCount !== undefined) {
                    listenData[song.id] = song.listenCount;
                }
            });
            
            console.log(`ĐÃ TẢI ${songs.length} BÀI HÁT TỪ GOOGLE SHEET`);
            initPlayerAfterLoad();
            updateListenStatsModal();
            
            startAutoRefresh(60);
            
            if (pendingPlayAfterLoad) {
                pendingPlayAfterLoad = false;
                startPlayback();
            }
        } else {
            throw new Error("DỮ LIỆU KHÔNG ĐÚNG ĐỊNH DẠNG");
        }
        
    } catch (error) {
        console.error("LỖI TẢI DỮ LIỆU:", error);
        showToastMsg("KHÔNG THỂ TẢI DỮ LIỆU!", false);
        songs = [];
        isLoadingSongs = false;
        hidePlayerLoading();
    }
}

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
        lyrics = lyricData;
        if (lyrics.length === 0) {
            adjustLyricFontSize("BÀI HÁT TẠM CHƯA CÓ LYRIC NHA HIHI");
        } else {
            adjustLyricFontSize("NHẤN PLAY ĐỂ NGHE NHẠC");
        }
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
    
    let targetElement = noti.querySelector('.notification-message span');
    if (!targetElement) {
        targetElement = noti.querySelector('.notification-message');
    }
    if (!targetElement) return;
    
    targetElement.style.transform = 'none';
    targetElement.style.whiteSpace = 'nowrap';
    targetElement.style.display = 'inline-block';
    
    const container = noti.querySelector('.notification-content');
    if (!container) return;
    
    let containerWidth = container.clientWidth;
    let textWidth = targetElement.scrollWidth;
    
    const isMobile = window.innerWidth <= 768;
    const isSmallMobile = window.innerWidth <= 480;
    
    let paddingReduce = 15;
    if (isSmallMobile) paddingReduce = 25;
    else if (isMobile) paddingReduce = 20;
    
    if (textWidth > containerWidth - paddingReduce) {
        let scale = (containerWidth - paddingReduce) / textWidth;
        let minScale = isSmallMobile ? 0.75 : (isMobile ? 0.7 : 0.5);
        scale = scale * 0.95;
        const finalScale = Math.max(scale, minScale);
        targetElement.style.transform = `scale(${finalScale})`;
        targetElement.style.transformOrigin = 'left center';
    } else {
        targetElement.style.transform = 'none';
    }
}

function forceScaleNotification() {
    autoScaleNotificationMessage();
    setTimeout(() => autoScaleNotificationMessage(), 30);
    setTimeout(() => autoScaleNotificationMessage(), 80);
    setTimeout(() => autoScaleNotificationMessage(), 150);
}

function showNotification(title, message, color = "#4ade80", icon = "fa-headphones") {
    const noti = document.getElementById('custom-notification');
    if (!noti) return;
    
    if (notificationTimeout) clearTimeout(notificationTimeout);
    
    noti.style.borderBottomColor = color;
    const iconElem = noti.querySelector('.notification-icon i');
    if (iconElem) {
        iconElem.className = `fal ${icon}`;
        iconElem.style.color = color;
    }
    
    let formattedMessage = message;
    if (typeof message === 'string' && !message.includes('<span')) {
        const gradient = getGradientByTheme();
        formattedMessage = `<span style="font-weight: 700; background: ${gradient}; -webkit-background-clip: text; background-clip: text; color: transparent; letter-spacing: 0.5px; font-size: inherit; display: inline-block; white-space: nowrap;">${message}</span>`;
    }
    
    noti.querySelector('.notification-title').innerHTML = title;
    noti.querySelector('.notification-message').innerHTML = formattedMessage;
    
    noti.classList.remove('show');
    void noti.offsetHeight;
    noti.classList.add('show');
    
    forceScaleNotification();
    
    notificationTimeout = setTimeout(() => {
        noti.classList.remove('show');
    }, 10000);
}

function showToastMsg(msg, isListen = false) {
    if (isListen) {
        const match = msg.match(/\+1 LISTEN: "(.+)" \((.+)\)/);
        if (match) {
            showNotification('+1 LISTEN:', match[1], '#4ade80', 'fa-headphones');
        } else {
            showNotification('THÔNG BÁO:', msg, '#4ade80', 'fa-circle-info');
        }
    } else {
        showNotification('THÔNG BÁO:', msg, 'var(--accent-color)', 'fa-circle-info');
    }
}

async function fetchListenData() {
    return fetchListenDataSilent();
}

async function incrementListenCount(songId, songName, source = 'normal') {
    if (!songId || isUpdatingListen) return false;
    
    isUpdatingListen = true;
    try {
        const response = await fetch(`${GOOGLE_SHEET_API}?action=increment&id=${encodeURIComponent(songId)}&name=${encodeURIComponent(songName)}&t=${Date.now()}`);
        const result = await response.json();
        
        if (result.success) {
            listenData[songId] = result.count;
            
            const songIndex = songs.findIndex(s => s.id === songId);
            if (songIndex !== -1) {
                songs[songIndex].listenCount = result.count;
            }
            
            updateListenStatsModal();
            localStorage.setItem('xuanken_listens', JSON.stringify(listenData));
            console.log(`GHI NHẬN: ${songName} (${songId}) - ${result.count}`);
            
            showNotification('+1 LISTEN:', `<i class="fa-regular fa-star"></i> ${songId} <i class="fa-regular fa-star"></i>`, '#4ade80', 'fa-headphones');
        }
    } catch (error) {
        console.error('LỖI TĂNG LƯỢT NGHE:', error);
        if (!listenData[songId]) listenData[songId] = 0;
        listenData[songId]++;
        
        const songIndex = songs.findIndex(s => s.id === songId);
        if (songIndex !== -1) {
            songs[songIndex].listenCount = listenData[songId];
        }
        
        localStorage.setItem('xuanken_listens', JSON.stringify(listenData));
        updateListenStatsModal();
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
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
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
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'listen-stats-modal';
        modal.className = 'listen-modal';
        modal.innerHTML = `<div class="listen-modal-header"><div class="close-listen" id="close-listen-modal"><i class="fas fa-times"></i></div><div class="listen-title"><i class="fal fa-headphones"></i> THỐNG KÊ LƯỢT NGHE</div><div style="width:40px"></div></div><div class="listen-stats" id="listen-stats-content"><div style="text-align:center;padding:40px">ĐANG TẢI...</div></div><div class="listen-total" id="listen-total-stats"></div>`;
        const playerContainer = document.querySelector('.player-container');
        if (playerContainer) playerContainer.appendChild(modal);
        else document.body.appendChild(modal);
        const closeBtn = document.getElementById('close-listen-modal');
        if (closeBtn) closeBtn.onclick = () => modal.classList.remove('show');
    }
    updateListenStatsModal();
    modal.classList.add('show');
    setTimeout(() => scrollToCurrentListenSong(), 300);
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
    const lines = text.split('\n');
    const result = [];
    const timeReg = /\[(\d+):(\d+\.\d+)\]/;
    lines.forEach(line => {
        const match = timeReg.exec(line);
        if (match) result.push({ time: parseInt(match[1]) * 60 + parseFloat(match[2]), text: line.replace(timeReg, '').trim() });
    });
    return result.sort((a, b) => a.time - b.time);
}

async function fetchLyricWithFallback(lrc1, lrc2) {
    const urls = [lrc1, lrc2].filter(url => url && url.trim() !== "");
    for (let i = 0; i < urls.length; i++) {
        try {
            const res = await fetch(urls[i]);
            if (res.ok) return parseLRC(await res.text());
        } catch (e) { console.error("LỖI FETCH LYRIC:", e); }
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
    audio.src = song.audio;
    audio.load();
    
    lyrics = [];
    lastLyric = "";
    adjustLyricFontSize("ĐANG TẢI LỜI BÀI HÁT...");
    
    lyrics = await fetchLyricWithFallback(song.lrc1, song.lrc2);
    if (lyrics.length === 0) adjustLyricFontSize("BÀI HÁT TẠM CHƯA CÓ LYRIC NHA HIHI");
    
    renderPlaylist();
    updateMediaSession();
    if (playlistOverlay.classList.contains('active')) setTimeout(scrollToActiveTop, 100);
    
    hasRecordedCurrentSong = false;
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
        if (!audio.src || audio.src !== songs[index].audio) {
            loadSong(index);
            setTimeout(() => {
                audio.play().catch(e => console.log("LỖI PHÁT:", e));
            }, 100);
        } else {
            setTimeout(() => {
                audio.play().catch(e => console.log("LỖI PHÁT:", e));
            }, 100);
        }
    }
}

let isHidingHint = false;

function togglePlay() {
    const hintEl = document.getElementById('interaction-hint');
    
    if (!hasUserInteracted) {
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
            if (songs[index] && (!audio.src || audio.src !== songs[index].audio)) {
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
    showNotification('LỖI:', 'KHÔNG THỂ PHÁT BÀI HÁT!', '#ff4444', 'fa-circle-exclamation');
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

audio.ontimeupdate = () => {
    const cur = audio.currentTime;
    const dur = audio.duration;
    if (dur) {
        const timeCurrent = document.getElementById('time-current');
        const timeTotal = document.getElementById('time-total');
        if (timeCurrent) timeCurrent.innerText = formatTime(cur);
        if (timeTotal) timeTotal.innerText = formatTime(dur);
    }
    if (lyrics.length > 0) {
        const active = lyrics.findLast(l => cur >= l.time);
        if (active && lastLyric !== active.text) {
            lastLyric = active.text;
            adjustLyricFontSize(active.text);
        }
    }
    
    if (cur >= 5 && !hasRecordedCurrentSong && !isUpdatingListen && !isChanging && dur && dur > 5 && songs[index] && hasUserInteracted) {
        hasRecordedCurrentSong = true;
        incrementListenCount(songs[index].id, songs[index].name, currentSource);
    }
    
    if (isRepeatOne && dur && (dur - cur) <= 0.1 && !isLoopingHandled && dur > 0) {
        isLoopingHandled = true;
        if (hasRecordedCurrentSong) {
            hasRecordedCurrentSong = false;
            currentSource = 'loop';
        }
        audio.currentTime = 0;
        setTimeout(() => audio.play().catch(e => setTimeout(() => audio.play(), 20)), 10);
    }
    
    if (cur > 0 && dur && (dur - cur) > 0.2) isLoopingHandled = false;
    updateProgressUI();
};

audio.onended = () => {
    if (isRepeatOne) {
        if (!isLoopingHandled) {
            isLoopingHandled = true;
            if (hasRecordedCurrentSong) {
                hasRecordedCurrentSong = false;
                currentSource = 'loop';
            }
            audio.currentTime = 0;
            setTimeout(() => audio.play().catch(e => { audio.load(); setTimeout(() => audio.play(), 50); }), 10);
        }
    } else {
        handleNextAction();
    }
};

audio.onplay = () => {
    isPlaying = true;
    if (playIcon) playIcon.className = 'fas fa-pause';
    if (art) art.style.animationPlayState = 'running';
    requestWakeLock();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing";
    hidePlayerLoading();
};

audio.onpause = () => {
    isPlaying = false;
    if (playIcon) playIcon.className = 'fas fa-play';
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
                <div class="text-xs text-gray-500"><i class="fa-regular fa-microphone"></i> ${escapeHtml(artistName)}</div>
            </div>
            ${i === index ? '<i class="fa-sharp fa-light fa-face-grin-tongue-squint"></i>' : ''}
        </div>`;
    }).join('');
}

const playerContainer = document.getElementById('player-container');
if (playerContainer) playerContainer.style.display = 'none';

if (hint) {
    const newHint = hint.cloneNode(true);
    hint.parentNode.replaceChild(newHint, hint);
    newHint.onclick = function(e) {
        e.stopPropagation();
        togglePlay();
    };
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
            showNotification('XÁO TRỘN:', 'BẬT XÁO TRỘN THÔNG MINH', 'var(--accent-color)', 'fa-random');
        } else {
            showNotification('TUẦN TỰ:', 'TẮT XÁO TRỘN, PHÁT TUẦN TỰ', 'var(--accent-color)', 'fa-list');
        }
    };
}

if (repeatBtn) {
    repeatBtn.onclick = function() {
        isRepeatOne = !isRepeatOne;
        this.classList.toggle('active', isRepeatOne);
        isLoopingHandled = false;
        if (isRepeatOne) {
            showNotification('LẶP LẠI:', 'LẶP LẠI 1 BÀI', 'var(--accent-color)', 'fa-arrow-rotate-left');
        } else {
            showNotification('TẮT LẶP:', 'ĐÃ TẮT LẶP', 'var(--accent-color)', 'fa-arrow-rotate-left');
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
    showNotification('HỦY HẸN GIỜ:', 'ĐÃ HỦY HẸN GIỜ', '#ff9800', 'fa-trash-alt');
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
            showNotification('HẾT GIỜ:', 'ĐÃ TẮT NHẠC!', '#ff9800', 'fa-bell');
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
        showNotification('LỖI:', 'NHẬP SỐ PHÚT HỢP LỆ!', '#ff4444', 'fa-circle-exclamation');
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
        showNotification('HẾT GIỜ:', 'ĐÃ TẮT NHẠC THEO HẸN GIỜ!', '#ff9800', 'fa-bell');
        if (timerStatus) timerStatus.innerHTML = 'ĐÃ TẮT NHẠC';
        if (openTimerBtn) openTimerBtn.classList.remove('active');
        remainSeconds = 0;
    }, seconds * 1000);
    startCountdown(seconds);
    toggleTimerModal();
    showNotification('HẸN GIỜ:', `TẮT SAU ${minutes} PHÚT`, '#4ade80', 'fa-stopwatch');
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
        else showNotification('LỖI:', 'NHẬP SỐ PHÚT HỢP LỆ!', '#ff4444', 'fa-circle-exclamation');
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
const themeIcon = themeToggle ? themeToggle.querySelector('i') : null;

function loadTheme() {
    const savedTheme = localStorage.getItem('xuanken_theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
        document.body.classList.add('dark');
        if (themeIcon) themeIcon.className = 'fal fa-moon';
    } else {
        document.body.classList.remove('dark');
        if (themeIcon) themeIcon.className = 'fal fa-sun';
    }
    applyGradientToSongTitle();
    applyGradientToArtistName();
}

function toggleTheme() {
    if (document.body.classList.contains('dark')) {
        document.body.classList.remove('dark');
        localStorage.setItem('xuanken_theme', 'light');
        if (themeIcon) themeIcon.className = 'fal fa-sun';
        showNotification('LIGHT MODE:', 'ĐÃ CHUYỂN LIGHT', '#ff9800', 'fa-sun');
    } else {
        document.body.classList.add('dark');
        localStorage.setItem('xuanken_theme', 'dark');
        if (themeIcon) themeIcon.className = 'fal fa-moon';
        showNotification('DARK MODE:', 'ĐÃ CHUYỂN DARK', '#bb86fc', 'fa-moon');
    }
    applyGradientToSongTitle();
    applyGradientToArtistName();
}

if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
loadTheme();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const savedTheme = localStorage.getItem('xuanken_theme');
    if (!savedTheme) {
        if (e.matches) {
            document.body.classList.add('dark');
            if (themeIcon) themeIcon.className = 'fal fa-moon';
        } else {
            document.body.classList.remove('dark');
            if (themeIcon) themeIcon.className = 'fal fa-sun';
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

loadSongsFromSheet();