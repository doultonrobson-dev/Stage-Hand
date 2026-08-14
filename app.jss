// --- GOOGLE DRIVE API CONFIGURATION ---
// Replace these two values with your generated Google Cloud credentials:
const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const API_KEY = 'YOUR_GOOGLE_API_KEY';

let songs = JSON.parse(localStorage.getItem('stage_songs')) || [];
let setlists = JSON.parse(localStorage.getItem('stage_setlists')) || [];
let activeSetlist = null;
let activeSetlistIndex = -1;
let currentSongId = null;
let scrollInterval = null;
let fontSize = 22;
let tokenClient = null;

// Save locally
function saveLocal() {
    localStorage.setItem('stage_songs', JSON.stringify(songs));
    localStorage.setItem('stage_setlists', JSON.stringify(setlists));
    autoCloudSync();
}

// Navigation
function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(`screen-${screen}`).classList.remove('hidden');
    stopAutoScroll();
    if (screen === 'library') renderLibrary();
    if (screen === 'setlists') renderSetlists();
}

// Song Rendering & Chord Detection
function renderLibrary() {
    const list = document.getElementById('song-list');
    list.innerHTML = '';
    songs.sort((a,b) => a.title.localeCompare(b.title)).forEach(s => {
        const li = document.createElement('li');
        li.innerHTML = `<div class="title">${s.title}</div><div class="sub">${s.artist}</div>`;
        li.onclick = () => openViewer(s.id);
        list.appendChild(li);
    });
}

function isChordLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return false;
    // Regex checking for notes, sharp/flats, minor, major, numbers, sus, dim, slash chords
    const chordPattern = /^([A-G][b#]?(m|maj|min|dim|aug|sus|add)?\d*(\/[A-G][b#]?)?\s*)+$/i;
    return chordPattern.test(trimmed);
}

function openViewer(songId, setlistCtx = null, index = -1) {
    currentSongId = songId;
    activeSetlist = setlistCtx;
    activeSetlistIndex = index;

    const song = songs.find(s => s.id === songId);
    if (!song) return;

    document.getElementById('view-title').innerText = song.title;
    document.getElementById('view-artist').innerText = song.artist;
    
    const body = document.getElementById('view-body');
    body.style.fontSize = `${fontSize}px`;
    body.innerHTML = '';

    const lines = song.lyrics.split('\n');
    lines.forEach(line => {
        const div = document.createElement('div');
        div.innerText = line || ' ';
        if (isChordLine(line)) {
            div.className = 'line-chord';
        } else {
            div.className = 'line-lyric';
        }
        body.appendChild(div);
    });

    const hasSetlist = activeSetlist !== null;
    document.getElementById('btn-prev-song').style.display = hasSetlist ? 'inline-block' : 'none';
    document.getElementById('btn-next-song').style.display = hasSetlist ? 'inline-block' : 'none';
    document.querySelector('.viewer-bottom-nav').style.display = hasSetlist ? 'flex' : 'none';

    showScreen('viewer');
    window.scrollTo(0,0);
}

function navigateSetlist(direction) {
    if (!activeSetlist) return;
    const newIndex = activeSetlistIndex + direction;
    if (newIndex >= 0 && newIndex < activeSetlist.songIds.length) {
        openViewer(activeSetlist.songIds[newIndex], activeSetlist, newIndex);
    }
}

function exitViewer() {
    activeSetlist ? showScreen('setlists') : showScreen('library');
}

// Stage Controls
function adjustFontSize(delta) {
    fontSize += delta;
    document.getElementById('view-body').style.fontSize = `${fontSize}px`;
}

function toggleAutoScroll() {
    scrollInterval ? stopAutoScroll() : startAutoScroll();
}

function startAutoScroll() {
    const btn = document.getElementById('scroll-toggle');
    btn.innerText = 'Pause';
    btn.style.background = '#00ffcc';
    btn.style.color = '#000';
    scrollInterval = setInterval(() => {
        const speed = parseInt(document.getElementById('scroll-speed').value);
        window.scrollBy(0, speed);
    }, 50);
}

function stopAutoScroll() {
    if (scrollInterval) clearInterval(scrollInterval);
    scrollInterval = null;
    const btn = document.getElementById('scroll-toggle');
    if (btn) { btn.innerText = 'Scroll'; btn.style.background = '#222'; btn.style.color = '#fff'; }
}

// Song Editor Functions
function openSongEditor(id = null) {
    currentSongId = id;
    if (id) {
        const s = songs.find(x => x.id === id);
        document.getElementById('edit-id').value = s.id;
        document.getElementById('edit-title').value = s.title;
        document.getElementById('edit-artist').value = s.artist;
        document.getElementById('edit-lyrics').value = s.lyrics;
    } else {
        document.getElementById('edit-id').value = '';
        document.getElementById('edit-title').value = '';
        document.getElementById('edit-artist').value = '';
        document.getElementById('edit-lyrics').value = '';
    }
    showScreen('editor');
}

function saveSong() {
    const id = document.getElementById('edit-id').value || Date.now().toString();
    const title = document.getElementById('edit-title').value.trim() || 'Untitled';
    const artist = document.getElementById('edit-artist').value.trim() || '';
    const lyrics = document.getElementById('edit-lyrics').value;

    const idx = songs.findIndex(s => s.id === id);
    if (idx > -1) songs[idx] = { id, title, artist, lyrics };
    else songs.push({ id, title, artist, lyrics });

    saveLocal();
    openViewer(id);
}

function deleteCurrentSong() {
    if (!currentSongId || !confirm('Delete song?')) return;
    songs = songs.filter(s => s.id !== currentSongId);
    setlists.forEach(set => set.songIds = set.songIds.filter(sid => sid !== currentSongId));
    saveLocal();
    showScreen('library');
}

// Setlist Management
function renderSetlists() {
    const container = document.getElementById('setlist-container');
    container.innerHTML = '';
    setlists.forEach(set => {
        const li = document.createElement('li');
        li.innerHTML = `<div class="title">${set.title}</div><div class="sub">${set.songIds.length} Songs</div>`;
        li.onclick = () => openSetlistInViewer(set.id);
        container.appendChild(li);
    });
}

function openSetlistEditor() {
    const picker = document.getElementById('setlist-song-picker');
    picker.innerHTML = '';
    songs.forEach(s => {
        picker.innerHTML += `
            <div class="setlist-checkbox">
                <input type="checkbox" value="${s.id}" id="chk_${s.id}">
                <label for="chk_${s.id}">${s.title} (${s.artist})</label>
            </div>`;
    });
    showScreen('setlist-editor');
}

function saveSetlist() {
    const title = document.getElementById('setlist-title').value.trim() || 'Untitled Setlist';
    const checked = Array.from(document.querySelectorAll('#setlist-song-picker input:checked')).map(i => i.value);
    setlists.push({ id: Date.now().toString(), title, songIds: checked });
    saveLocal();
    showScreen('setlists');
}

function openSetlistInViewer(setId) {
    const set = setlists.find(s => s.id === setId);
    if (set && set.songIds.length > 0) {
        openViewer(set.songIds[0], set, 0);
    }
}

// Google Drive Cloud Sync
function handleAuthClick() {
    if (!window.google) return alert('Google API loading...');
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.appdata',
        callback: (resp) => {
            if (resp.access_token) uploadToDrive(resp.access_token);
        }
    });
    tokenClient.requestAccessToken();
}

function autoCloudSync() {
    if (navigator.onLine && localStorage.getItem('gdrive_token')) {
        uploadToDrive(localStorage.getItem('gdrive_token'));
    }
}

function uploadToDrive(token) {
    localStorage.setItem('gdrive_token', token);
    const data = JSON.stringify({ songs, setlists });
    const blob = new Blob([data], { type: 'application/json' });
    const metadata = { name: 'stage_lyrics_backup.json', parents: ['appDataFolder'] };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: new Authorization(`Bearer ${token}`),
        body: form
    }).then(() => {
        document.getElementById('sync-btn').innerText = 'Synced ✓';
        document.getElementById('sync-btn').style.color = '#00ffcc';
    }).catch(() => {});
}

// Initialize
renderLibrary();
 
