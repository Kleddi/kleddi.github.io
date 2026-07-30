/* ---------------------------------------------------------------
   DOM references
   ----------------------------------------------------------------- */
const lyricsViewport = document.getElementById("lyricsViewport");
const lyricsTrack = document.getElementById("lyricsTrack");
const syncEarlier = document.getElementById("syncEarlier");
const syncLater = document.getElementById("syncLater");
const syncOffsetEl = document.getElementById("syncOffset");
const songTitleEl = document.getElementById("songTitle");
const songArtistEl = document.getElementById("songArtist");

const youtubeForm = document.getElementById("youtubeForm");
const youtubeUrlInput = document.getElementById("youtubeUrl");
const youtubeHint = document.getElementById("youtubeHint");

const suggestionList = document.getElementById("suggestionList");
const artistPicker = document.getElementById("artistPicker");

const playerBar = document.getElementById("playerBar");
const playPauseBtn = document.getElementById("playPauseBtn");
const playIcon = document.getElementById("playIcon");
const pauseIcon = document.getElementById("pauseIcon");
const progressFill = document.getElementById("progressFill");
const progressTrack = document.getElementById("progressTrack");
const timeLabel = document.getElementById("timeLabel");
const volumeBtn = document.getElementById("volumeBtn");
const volumePath = document.getElementById("volumePath");
const volumeSlider = document.getElementById("volumeSlider");

/* ---------------------------------------------------------------
   Shared lyric-rendering engine
   -----------------------------------------------------------------
   Recomputes which line should be showing from the actual playback
   time on every poll tick (rather than a running timer), so it's
   always correct — including immediately after a seek.
   ----------------------------------------------------------------- */
let currentLyrics = [];
let lastRenderedIndex = null;
let lyricsOffset = 0; // seconds — positive shifts lyrics later, negative earlier

function findLineIndex(currentTime) {
    for (let i = currentLyrics.length - 1; i >= 0; i--) {
        if (currentTime >= currentLyrics[i].time) return i;
    }
    return -1;
}

// Rebuilds the scrolling track with one row per lyric line. Call this
// whenever `currentLyrics` changes (new song, lyrics found/not found).
function buildLyricsTrack() {
    lastRenderedIndex = null;
    lyricsTrack.style.transition = "none";
    lyricsTrack.style.transform = "translateY(0)";
    lyricsTrack.innerHTML = "";

    currentLyrics.forEach((line) => {
        const row = document.createElement("div");
        row.className = "lyrics-line";
        row.textContent = line.text;
        lyricsTrack.appendChild(row);
    });

    // Re-enable the slide transition on the next frame so this reset
    // itself doesn't animate.
    requestAnimationFrame(() => {
        lyricsTrack.style.transition = "";
    });
}

function resetLyrics() {
    lastRenderedIndex = null;
    Array.from(lyricsTrack.children).forEach((row) => {
        row.classList.remove("is-current", "is-prev", "is-next");
    });
    lyricsTrack.style.transform = "translateY(0)";
}

// Slides the track so the line at `idx` sits centered in the 3-row
// viewport — the escalator motion.
function positionTrackOn(idx) {
    const row = lyricsTrack.children[idx];
    if (!row) return;
    const lineHeight = row.getBoundingClientRect().height;
    const viewportHeight = lyricsViewport.getBoundingClientRect().height;
    const offset = (viewportHeight / 2) - (lineHeight / 2) - (idx * lineHeight);
    lyricsTrack.style.transform = `translateY(${offset}px)`;
}

// Renders whichever lyric line should be showing at `currentTime`.
// Safe to call on every poll tick, and after a seek — it always
// derives the display purely from the given time. `lyricsOffset` lets
// the person nudge sync manually (e.g. when a video has a few extra
// seconds of intro before the song's audio actually starts).
function renderLyricsAtTime(currentTime) {

    const idx = findLineIndex(currentTime - lyricsOffset);

    if (idx === -1) {
        if (lastRenderedIndex !== null) resetLyrics();
        return;
    }

    if (idx === lastRenderedIndex) return;
    lastRenderedIndex = idx;

    Array.from(lyricsTrack.children).forEach((row, i) => {
        row.classList.remove("is-current", "is-prev", "is-next");
        if (i === idx) row.classList.add("is-current");
        else if (i === idx - 1) row.classList.add("is-prev");
        else if (i === idx + 1) row.classList.add("is-next");
    });

    positionTrackOn(idx);

}

function setLyricsOffset(value) {
    lyricsOffset = Math.max(-10, Math.min(10, value));
    syncOffsetEl.textContent = `${lyricsOffset > 0 ? "+" : ""}${lyricsOffset.toFixed(1)}s`;
    // Force the currently-shown line to be re-evaluated against the
    // new offset right away, rather than waiting for the next poll
    // tick to notice a change.
    lastRenderedIndex = null;
}

syncEarlier.addEventListener("click", () => setLyricsOffset(lyricsOffset - 0.5));
syncLater.addEventListener("click", () => setLyricsOffset(lyricsOffset + 0.5));

/* ---------------------------------------------------------------
   YouTube playback
   -----------------------------------------------------------------
   YouTube is what actually produces the sound — there's no key-free,
   ToS-respecting way to pull just an audio stream client-side — so a
   small embed still lives in the page, but native YouTube controls
   are switched off and replaced with a compact play/pause + progress
   bar so it reads as an audio player rather than a video screen.
   ----------------------------------------------------------------- */
let ytPlayer = null;
let ytReady = false;
let ytPendingId = null;
let ytPollInterval = null;

function extractYoutubeId(url) {
    try {
        const u = new URL(url.trim());
        if (u.hostname.includes("youtu.be")) {
            return u.pathname.slice(1) || null;
        }
        if (u.hostname.includes("youtube.com")) {
            if (u.pathname === "/watch") return u.searchParams.get("v");
            if (u.pathname.startsWith("/embed/")) return u.pathname.split("/embed/")[1];
            if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/shorts/")[1];
        }
    } catch (err) {
        return null;
    }
    return null;
}

// Called automatically by the YouTube IFrame API script once it's loaded
window.onYouTubeIframeAPIReady = function () {
    ytReady = true;
    if (ytPendingId) {
        loadYoutubeVideo(ytPendingId);
        ytPendingId = null;
    }
};

function loadYoutubeVideo(videoId) {

    if (!ytReady) {
        ytPendingId = videoId;
        return;
    }

    if (!ytPlayer) {
        ytPlayer = new YT.Player("youtubePlayer", {
            videoId,
            playerVars: {
                rel: 0,
                controls: 0,
                disablekb: 1,
                modestbranding: 1,
                origin: window.location.origin
            },
            events: {
                onReady: onYoutubeReady,
                onStateChange: onYoutubeStateChange,
                onError: onYoutubeError
            }
        });
    } else {
        ytPlayer.loadVideoById(videoId);
    }

}

function onYoutubeReady() {
    playerBar.hidden = false;
    ytPlayer.setVolume(Number(volumeSlider.value));
    if (Number(volumeSlider.value) === 0) {
        ytPlayer.mute();
    }
}

function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) seconds = 0;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

function pollProgress() {

    if (!ytPlayer || typeof ytPlayer.getCurrentTime !== "function") return;

    const current = ytPlayer.getCurrentTime();
    const duration = ytPlayer.getDuration() || 0;

    progressFill.style.width = duration ? `${(current / duration) * 100}%` : "0%";
    timeLabel.textContent = `${formatTime(current)} / ${formatTime(duration)}`;

    renderLyricsAtTime(current);

}

function onYoutubeStateChange(event) {

    const isPlaying = event.data === YT.PlayerState.PLAYING;

    playIcon.hidden = isPlaying;
    pauseIcon.hidden = !isPlaying;
    playPauseBtn.setAttribute("aria-label", isPlaying ? "Pause" : "Play");

    if (isPlaying) {
        if (ytPollInterval) clearInterval(ytPollInterval);
        ytPollInterval = setInterval(pollProgress, 120);
    } else if (ytPollInterval) {
        clearInterval(ytPollInterval);
        ytPollInterval = null;
    }

}

function onYoutubeError(event) {

    const messages = {
        2: "That YouTube link looks invalid.",
        5: "This video can't be played in an embedded player.",
        100: "That video was not found — it may be private or removed.",
        101: "The video's owner has disabled embedding on other sites.",
        150: "The video's owner has disabled embedding on other sites."
    };

    youtubeHint.textContent = messages[event.data] ||
        "This video couldn't be played. If you opened this page as a local " +
        "file (a file:// address), serve it over http:// instead.";
    youtubeHint.classList.add("is-error");

}

playPauseBtn.addEventListener("click", () => {

    if (!ytPlayer || typeof ytPlayer.getPlayerState !== "function") return;

    if (ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) {
        ytPlayer.pauseVideo();
    } else {
        ytPlayer.playVideo();
    }

});

/* ---------------------------------------------------------------
   Volume
   ----------------------------------------------------------------- */
let volumeBeforeMute = Number(volumeSlider.value) || 100;

const VOLUME_ICON_PATH = "M3 10v4h4l5 5V5L7 10H3zm13.5 2A4.5 4.5 0 0 0 14 7.97v8.05A4.5 4.5 0 0 0 16.5 12z";
const MUTED_ICON_PATH = "M3 10v4h4l5 5V5L7 10H3zm13.59 2 2.7-2.71-1.41-1.41L15.17 10l-2.7-2.71-1.41 1.41L13.76 11l-2.7 2.71 1.41 1.41 2.7-2.71 2.7 2.71 1.41-1.41z";

function updateVolumeIcon(isMuted) {
    volumePath.setAttribute("d", isMuted ? MUTED_ICON_PATH : VOLUME_ICON_PATH);
    volumeBtn.setAttribute("aria-label", isMuted ? "Unmute" : "Mute");
}

volumeSlider.addEventListener("input", () => {

    const value = Number(volumeSlider.value);

    if (ytPlayer && typeof ytPlayer.setVolume === "function") {
        ytPlayer.setVolume(value);
        if (value === 0) {
            ytPlayer.mute();
        } else {
            ytPlayer.unMute();
            volumeBeforeMute = value;
        }
    }

    updateVolumeIcon(value === 0);

});

volumeBtn.addEventListener("click", () => {

    if (!ytPlayer || typeof ytPlayer.isMuted !== "function") return;

    if (ytPlayer.isMuted() || Number(volumeSlider.value) === 0) {
        const restore = volumeBeforeMute || 100;
        ytPlayer.unMute();
        ytPlayer.setVolume(restore);
        volumeSlider.value = restore;
        updateVolumeIcon(false);
    } else {
        volumeBeforeMute = Number(volumeSlider.value) || 100;
        ytPlayer.mute();
        volumeSlider.value = 0;
        updateVolumeIcon(true);
    }

});

/* ---------------------------------------------------------------
   Seeking — click or drag the progress bar to jump around the song.
   Uses Pointer Events so it works the same with mouse or touch.
   ----------------------------------------------------------------- */
let isSeeking = false;
let seekTargetTime = null;

function timeFromPointer(e) {
    if (!ytPlayer || typeof ytPlayer.getDuration !== "function") return null;
    const duration = ytPlayer.getDuration() || 0;
    if (!duration) return null;
    const rect = progressTrack.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
    const fraction = rect.width ? x / rect.width : 0;
    return { time: fraction * duration, fraction, duration };
}

function previewSeek(e) {
    const result = timeFromPointer(e);
    if (!result) return;
    seekTargetTime = result.time;
    progressFill.style.width = `${result.fraction * 100}%`;
    timeLabel.textContent = `${formatTime(result.time)} / ${formatTime(result.duration)}`;
    renderLyricsAtTime(result.time);
}

progressTrack.addEventListener("pointerdown", (e) => {
    if (!ytPlayer) return;
    isSeeking = true;
    progressTrack.classList.add("is-seeking");
    progressTrack.setPointerCapture(e.pointerId);
    previewSeek(e);
});

progressTrack.addEventListener("pointermove", (e) => {
    if (!isSeeking) return;
    previewSeek(e);
});

function commitSeek(e) {
    if (!isSeeking) return;
    isSeeking = false;
    progressTrack.classList.remove("is-seeking");
    if (progressTrack.hasPointerCapture(e.pointerId)) {
        progressTrack.releasePointerCapture(e.pointerId);
    }
    if (ytPlayer && typeof ytPlayer.seekTo === "function" && seekTargetTime !== null) {
        ytPlayer.seekTo(seekTargetTime, true);
    }
    seekTargetTime = null;
}

progressTrack.addEventListener("pointerup", commitSeek);
progressTrack.addEventListener("pointercancel", commitSeek);

/* ---------------------------------------------------------------
   Title lookup (YouTube oEmbed — no API key required)
   ----------------------------------------------------------------- */
async function fetchYoutubeTitle(videoId) {
    try {
        const res = await fetch(
            `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
        );
        if (!res.ok) throw new Error("oEmbed request failed");
        const data = await res.json();
        return { title: data.title, author: data.author_name || "" };
    } catch (err) {
        return { title: "", author: "" };
    }
}

// YouTube titles are messy ("Artist - Track (Official Video)"). This
// pulls a best-guess { artist, track } pair out of one, which is what
// the lyrics lookup below needs.
function stripQuotes(str) {
    return str.replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, "");
}

function parseYoutubeTitle(rawTitle, channelName) {

    let title = rawTitle
        .replace(/[\(\[][^\)\]]*(official|video|audio|lyric|mv|hd|4k|visualizer|remaster)[^\)\]]*[\)\]]/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();

    const separators = [" - ", " – ", " — ", " | "];
    for (const sep of separators) {
        if (title.includes(sep)) {
            const [first, ...rest] = title.split(sep);
            return { artist: stripQuotes(first), track: stripQuotes(rest.join(sep)) };
        }
    }

    // No clear "Artist - Track" pattern — fall back to the channel name
    return { artist: channelName.replace(/\s*-\s*Topic$/i, "").trim(), track: stripQuotes(title) };

}

/* ---------------------------------------------------------------
   Synced lyrics (lrclib.net — free, no API key required)
   ----------------------------------------------------------------- */
function tagToSeconds(minutes, seconds, fractionStr) {
    const fraction = fractionStr ? parseInt(fractionStr.padEnd(3, "0"), 10) / 1000 : 0;
    return parseInt(minutes, 10) * 60 + parseInt(seconds, 10) + fraction;
}

function parseLrc(lrcText) {

    const lines = lrcText.split("\n");
    const result = [];
    const lineTimeTag = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
    // "Enhanced" LRC embeds a timestamp before each word, e.g.
    // <00:12.340>word — used for true word-level sync when a source has it
    const wordTimeTag = /<(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?>/g;

    for (const rawLine of lines) {

        const lineTags = [...rawLine.matchAll(lineTimeTag)];
        if (!lineTags.length) continue;

        const remainder = rawLine.replace(lineTimeTag, "");
        const hasWordTags = wordTimeTag.test(remainder);
        wordTimeTag.lastIndex = 0;

        let text = remainder.replace(wordTimeTag, "").trim();
        if (!text) continue;

        let words = null;

        if (hasWordTags) {
            words = [];
            let match;
            while ((match = wordTimeTag.exec(remainder)) !== null) {
                const time = tagToSeconds(match[1], match[2], match[3]);
                const after = remainder.slice(match.index + match[0].length);
                const wordText = (after.match(/^\s*([^<]+)/) || [, ""])[1].trim();
                if (wordText) words.push({ time, text: wordText });
            }
            if (!words.length) words = null;
        }

        for (const tag of lineTags) {
            const time = tagToSeconds(tag[1], tag[2], tag[3]);
            result.push({ time, text, words });
        }

    }

    result.sort((a, b) => a.time - b.time);
    return result;

}

async function fetchSyncedLyrics(artist, track) {

    try {

        const res = await fetch(
            `https://lrclib.net/api/search?track_name=${encodeURIComponent(track)}&artist_name=${encodeURIComponent(artist)}`
        );
        if (!res.ok) throw new Error("lrclib request failed");

        const results = await res.json();
        let match = results.find(r => r.syncedLyrics) || results[0];

        // Strict artist_name + track_name search came up empty (common
        // for short/generic titles, or when lrclib's stored artist name
        // doesn't exactly match) — fall back to a plain free-text search.
        if (!match || !match.syncedLyrics) {
            const fallbackRes = await fetch(
                `https://lrclib.net/api/search?q=${encodeURIComponent(`${artist} ${track}`)}`
            );
            if (fallbackRes.ok) {
                const fallbackResults = await fallbackRes.json();
                match = fallbackResults.find(r => r.syncedLyrics) || match;
            }
        }

        if (match && match.syncedLyrics) {
            return { status: "found", lyrics: parseLrc(match.syncedLyrics) };
        }

        return { status: "not_found", lyrics: [] };

    } catch (err) {
        return { status: "error", lyrics: [] };
    }

}

/* ---------------------------------------------------------------
   Wire it all together
   ----------------------------------------------------------------- */

// Loads and plays a YouTube URL — used by both the paste-a-link form
// and clicking a suggestion in the sidebar. If `knownMeta` is given
// (artist/track we already know for sure, e.g. from the suggestions
// list) it's used directly instead of guessing from the video's
// YouTube title — that guesswork is what was throwing off lyrics
// matching for tracks like "Into It".
async function playFromUrl(raw, knownMeta) {

    const videoId = extractYoutubeId(raw);

    youtubeHint.classList.remove("is-error");

    if (!videoId) {
        youtubeHint.textContent = "That doesn't look like a valid YouTube link.";
        youtubeHint.classList.add("is-error");
        return;
    }

    resetLyrics();
    currentLyrics = [];
    buildLyricsTrack();
    setLyricsOffset(0);
    progressFill.style.width = "0%";
    timeLabel.textContent = "0:00 / 0:00";
    songTitleEl.textContent = "Loading…";
    songArtistEl.textContent = "\u00A0";
    youtubeHint.textContent = "Looking up the track…";

    loadYoutubeVideo(videoId);
    markPlayingSuggestion(videoId);

    let artist, track;

    if (knownMeta) {
        artist = knownMeta.artist;
        track = knownMeta.track;
    } else {
        const meta = await fetchYoutubeTitle(videoId);

        if (!meta.title) {
            songTitleEl.textContent = "Now playing";
            songArtistEl.textContent = "\u00A0";
            youtubeHint.textContent = "Couldn't look up this video's title, so lyrics can't be matched automatically.";
            return;
        }

        const parsed = parseYoutubeTitle(meta.title, meta.author);
        artist = parsed.artist || meta.author;
        track = parsed.track || meta.title;
    }

    songTitleEl.textContent = track;
    songArtistEl.textContent = artist || "\u00A0";

    youtubeHint.textContent = "";
    const result = await fetchSyncedLyrics(artist, track);

    if (result.status === "found") {
        currentLyrics = result.lyrics;
        youtubeHint.textContent = "";
    } else if (result.status === "error") {
        currentLyrics = [];
        youtubeHint.textContent = "Couldn't load lyrics right now — check your connection and try again.";
        youtubeHint.classList.add("is-error");
    } else {
        currentLyrics = [];
        youtubeHint.textContent = "No synced lyrics found for this track.";
        youtubeHint.classList.add("is-error");
    }

    buildLyricsTrack();

}

youtubeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    playFromUrl(youtubeUrlInput.value.trim());
});

/* ---------------------------------------------------------------
   Song suggestions — a curated list from artists in the "Far Away"
   wheelhouse. An artist chip filters which songs show below it;
   clicking a song plays it the same way pasting its link and hitting
   Play would.
   ----------------------------------------------------------------- */
const SONG_SUGGESTIONS = [
    { artist: "Daniel Caesar", byline: "Daniel Caesar ft. H.E.R.", track: "Best Part", videoId: "vBy7FaapGRo" },
    { artist: "Daniel Caesar", byline: "Daniel Caesar ft. Kali Uchis", track: "Get You", videoId: "uQFVqltOXRg" },
    { artist: "Daniel Caesar", byline: "Daniel Caesar", track: "Superpowers", videoId: "rScwLoES2bM" },
    { artist: "Daniel Caesar", byline: "Daniel Caesar", track: "Japanese Denim", videoId: "4MXruqqZb8Q" },
    { artist: "Daniel Caesar", byline: "Daniel Caesar", track: "Cyanide", videoId: "Jnm3ukzmJe4" },

    { artist: "Chase Atlantic", byline: "Chase Atlantic", track: "Swim", videoId: "mC9v5FaLt84" },
    { artist: "Chase Atlantic", byline: "Chase Atlantic", track: "Friends", videoId: "qFdoMMR-7fc" },
    { artist: "Chase Atlantic", byline: "Chase Atlantic", track: "Into It", videoId: "lZp96uELegI" },
    { artist: "Chase Atlantic", byline: "Chase Atlantic", track: "Church", videoId: "vmM7h2fKdAY" },
    { artist: "Chase Atlantic", byline: "Chase Atlantic", track: "Okay", videoId: "IIVm_2Ep1dk" },

    { artist: "Taylor Swift", byline: "Taylor Swift", track: "Cruel Summer", videoId: "WKWAePTTOs0" },
    { artist: "Taylor Swift", byline: "Taylor Swift", track: "Lover", videoId: "-BjZmE2gtdo" },
    { artist: "Taylor Swift", byline: "Taylor Swift", track: "Anti-Hero", videoId: "b1kbLwvqugk" },
    { artist: "Taylor Swift", byline: "Taylor Swift", track: "Blank Space", videoId: "e-ORhEE9VVg" },
    { artist: "Taylor Swift", byline: "Taylor Swift", track: "You Belong With Me", videoId: "VuNIsY6JdUw" },

    { artist: "Mac Miller", byline: "Mac Miller", track: "Good News", videoId: "aIHF7u9Wwiw" },
    { artist: "Mac Miller", byline: "Mac Miller", track: "Circles", videoId: "V4BFGSZ_1ls" },
    { artist: "Mac Miller", byline: "Mac Miller", track: "Self Care", videoId: "SsKT0s5J8ko" },
    { artist: "Mac Miller", byline: "Mac Miller", track: "Blue World", videoId: "_GC2wFTCAGY" },
    { artist: "Mac Miller", byline: "Mac Miller ft. Anderson .Paak", track: "Dang!", videoId: "LR3GQfryp9M" },

    { artist: "Ariana Grande", byline: "Ariana Grande", track: "thank u, next", videoId: "gl1aHhXnN1k" },
    { artist: "Ariana Grande", byline: "Ariana Grande", track: "positions", videoId: "tcYodQoapMg" },
    { artist: "Ariana Grande", byline: "Ariana Grande ft. Nicki Minaj", track: "7 rings", videoId: "QYh6mYIJG2Y" },
    { artist: "Ariana Grande", byline: "Ariana Grande", track: "no tears left to cry", videoId: "ffxKSjUwKdU" },
    { artist: "Ariana Grande", byline: "Ariana Grande ft. Nicki Minaj", track: "Side to Side", videoId: "SXiSVQZLje8" }
];

const ARTISTS = [...new Set(SONG_SUGGESTIONS.map((s) => s.artist))];
let selectedArtist = ARTISTS[0];
let lastPlayedVideoId = null;

function markPlayingSuggestion(videoId) {
    lastPlayedVideoId = videoId;
    Array.from(suggestionList.children).forEach((item) => {
        item.classList.toggle("is-playing", item.dataset.videoId === videoId);
    });
}

function renderSuggestionList() {
    suggestionList.innerHTML = "";

    SONG_SUGGESTIONS
        .filter((song) => song.artist === selectedArtist)
        .forEach((song) => {

            const item = document.createElement("li");
            item.className = "suggestion-item";
            item.dataset.videoId = song.videoId;
            item.setAttribute("role", "button");
            item.setAttribute("tabindex", "0");
            item.setAttribute("aria-label", `Play ${song.track} by ${song.byline}`);
            if (song.videoId === lastPlayedVideoId) item.classList.add("is-playing");

            const trackEl = document.createElement("span");
            trackEl.className = "suggestion-track";
            trackEl.textContent = song.track;

            const artistEl = document.createElement("span");
            artistEl.className = "suggestion-artist";
            artistEl.textContent = song.byline;

            item.appendChild(trackEl);
            item.appendChild(artistEl);

            const play = () => {
                const url = `https://www.youtube.com/watch?v=${song.videoId}`;
                youtubeUrlInput.value = url;
                playFromUrl(url, { artist: song.artist, track: song.track });
            };

            item.addEventListener("click", play);
            item.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    play();
                }
            });

            suggestionList.appendChild(item);
        });
}

function buildArtistPicker() {
    ARTISTS.forEach((artist) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "artist-chip";
        chip.textContent = artist;
        chip.setAttribute("role", "tab");
        chip.setAttribute("aria-selected", artist === selectedArtist ? "true" : "false");
        if (artist === selectedArtist) chip.classList.add("is-selected");

        chip.addEventListener("click", () => {
            if (artist === selectedArtist) return;
            selectedArtist = artist;
            Array.from(artistPicker.children).forEach((c) => {
                const isSelected = c.textContent === artist;
                c.classList.toggle("is-selected", isSelected);
                c.setAttribute("aria-selected", isSelected ? "true" : "false");
            });
            renderSuggestionList();
        });

        artistPicker.appendChild(chip);
    });
}

buildArtistPicker();
renderSuggestionList();
