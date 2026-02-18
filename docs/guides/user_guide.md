# Muzika — User Guide

> **Last Updated**: February 2026

Welcome to Muzika! This guide covers everything you need to know to use the app.

---

## What is Muzika?

Muzika is a **karaoke and audio separation app** that runs entirely in your browser. You upload a song (or paste a YouTube link), and the AI separates the vocals from the music. You can then:
- Practice singing along with just the instrumental
- Listen to isolated vocals
- Download the separated stems as audio files
- View synchronized lyrics while singing

**Your music stays private** — everything is processed locally on your device (or via a backend server you control). Nothing is sent to third-party servers.

---

## System Requirements

| Browser | Version |
|---------|---------|
| Chrome | 113+ |
| Edge | 113+ |

> Firefox and Safari have limited WebGPU/WASM support and are not recommended.

**For best performance**: 8GB+ RAM, a dedicated GPU (WebGPU-enabled).

---

## Uploading a Song

### Method 1: File Upload
1. On the home page, click the **upload area** or drag-and-drop an audio file
2. Supported formats: **MP3, WAV, OGG, FLAC, M4A**
3. Maximum file size: **500 MB**
4. The app will begin analyzing the file immediately

### Method 2: YouTube URL
1. Click the **YouTube** tab on the upload panel
2. Paste a full YouTube URL (e.g. `https://www.youtube.com/watch?v=...`)
3. Click **Download & Process**
4. The backend will fetch the audio and run separation automatically

---

## The Processing Screen

After uploading, you'll see a progress screen showing:

| Stage | What's Happening |
|-------|-----------------|
| 🔍 Analyzing | Reading the audio file, checking cache |
| ⬇️ Loading Model | Downloading/loading the AI model (first time only ~150MB) |
| ✂️ Separating | AI is splitting stems (this is the longest stage) |
| ✅ Done | Results are ready |

**Estimated times** (depends on hardware):
- Short clip (< 1 min): 10–30 seconds
- Full song (3–5 min): 1–3 minutes
- Long track (> 10 min): 5+ minutes

---

## The Results Screen

Once separation is complete, you'll see three audio tracks:

| Track | What You Hear |
|-------|--------------|
| **Original** | The untouched source audio |
| **Vocals** | Isolated vocal stem |
| **Instrumental** | Music without vocals (for karaoke) |

Each track has its own **play/pause button** and **volume slider**.

### Downloading Stems
Click the **Download** button under any stem to save it:
- Chose **WAV** (lossless, larger file) or **MP3** (compressed, smaller)

---

## The Karaoke Player

Click **Open in Karaoke** from the results screen to enter the karaoke player.

### Controls

| Control | What it Does |
|---------|-------------|
| ▶️ Play / ⏸ Pause | Start or pause playback |
| ⏮ ⏭ | Seek backward/forward 5 seconds |
| 🔊 Volume | Adjust master volume (0–100%) |
| 🎤 Vocal Volume | Adjust vocal stem volume (0 = practice mode) |
| 🎸 Instrumental Volume | Adjust instrumental volume |
| Pitch ±12 | Shift pitch up or down in semitones |
| Tempo × | Speed up or slow down without changing pitch (0.5×–2.0×) |

### Lyrics

If a `.lrc` lyrics file is associated with your song, lyrics will auto-scroll and highlight the current line.

**Loading lyrics manually**:
1. Click the **📄 Lyrics** button in the player header
2. Drag-and-drop an `.lrc` file, or paste LRC content

**LRC format** example:
```
[00:15.20]First line of lyrics
[00:18.50]Second line of lyrics
```

---

## Song Library

The **Library** tab shows all songs you've processed. Songs are stored locally in your browser using IndexedDB — they stay available even after you close the tab.

### Library Features
- **Search** by song title or artist
- **Click** any song to jump directly to the karaoke player
- **Delete** songs to free up browser storage (click the trash icon)

### Storage Usage
Your browser shows how much storage Muzika is using:
1. Open browser DevTools (F12)
2. Go to **Application → Storage**
3. Look for **IndexedDB → MuzikaDB**

To clear all cached audio, use the **Settings → Clear Cache** option in the app.

---

## Batch Processing

You can queue multiple songs for sequential processing:
1. Go to **Batch** tab
2. Drag multiple files into the upload area
3. Click **Process All**
4. Songs are processed one at a time in the background

---

## Settings

Access settings via the ⚙️ gear icon in the top navigation.

| Setting | Description |
|---------|-------------|
| **AI Model** | Choose between speed-optimized and quality-optimized models |
| **GPU Acceleration** | Enable/disable WebGPU (default: auto-detect) |
| **Stem Format** | Default download format (WAV or MP3) |
| **Language** | App UI language |
| **Clear Cache** | Delete all cached audio from IndexedDB |

---

## Frequently Asked Questions

**Q: My audio sounds tinny/garbled after separation. Why?**  
A: Vocal separation is AI-based and isn't perfect. Results depend on the complexity of the mix. Try the "Quality" model instead of the "Fast" model in Settings.

**Q: The model download is stuck. What do I do?**  
A: Refresh the page and try again. If it persists, check your browser's DevTools → Network tab for errors, or check if you have a stable internet connection.

**Q: Can I use Muzika offline?**  
A: Once the AI model is downloaded and cached, separation happens locally and works offline. YouTube download requires an internet connection.

**Q: My browser says "WebGPU not available".**  
A: Use Chrome 113+ or Edge 113+. The app will fall back to a slower CPU mode automatically.

**Q: How much storage does Muzika use?**  
A: The AI model is ~150MB. Each separated song is ~30–100MB depending on length. Use **Settings → Clear Cache** to free space.

**Q: Is my music uploaded anywhere?**  
A: No. All audio processing happens in your browser or on the local Python backend. No audio data leaves your machine.

**Q: Can I use Muzika on mobile?**  
A: Muzika is designed for desktop browsers. Mobile may work for playback and smaller files, but separation performance will be limited by available memory.
