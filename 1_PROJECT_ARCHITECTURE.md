# Audio Karaoke Separation App - Projektna Arhitektura

## 1. Pregled projekta

Ova aplikacija omogućuje lokalnu separaciju audio izvora (vokali/instrumentali) i karaoke rendiranje bez slanja podataka na eksterne servere.

### Ključne prednosti
- ✅ Potpuna privatnost (sve lokalno)
- ✅ Bez potrebe za serverskom infrastrukturom
- ✅ Direktna obrada u pregledniku
- ✅ Offline rada (osim pri prvoj preuzimanju modela)

---

## 2. Tehnološki slog (Tech Stack)

```
┌─────────────────────────────────────────────────────┐
│             FRONTEND SLOJ                           │
│  React 18 + Next.js 14 + TypeScript + Tailwind CSS  │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│          AI/ML INTEGRACIJSKA SLOJ                   │
│  ONNX Runtime Web + WebGPU + Web Workers            │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│          AUDIO PROCESIRANJE SLOJ                    │
│  Web Audio API + AudioWorklets + SoundTouchJS       │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│        LOKALNA POHRANA I OPTIMIZACIJA               │
│  IndexedDB (Dexie.js) + Cache API                   │
└─────────────────────────────────────────────────────┘
```

---

## 3. Ključne tehnologije po sloju

### Frontend
- **React 18**: Komponentna struktura i state management
- **Next.js 14**: Server-side rendering, API route-ovi (ako trebaju), optimizacija
- **TypeScript**: Type safety za kompleksne algoritme
- **Tailwind CSS**: Brz UI razvoj
- **Zustand ili Jotai**: Globalni state management

### AI Runtime
- **ONNX Runtime Web**: Izvođenje AI modela u pregledniku
- **WebGPU**: Hardversko ubrzanje (AMD, NVIDIA, Intel GPU)
- **Web Workers**: Off-main-thread obrada

### Audio Processing
- **Web Audio API**: Osnovna audio obrada
- **AudioWorklet**: Niskolatencijska obrada
- **SoundTouchJS**: Pitch shifting i time-stretching

### Modeli
- **MDX-Net**: Optimalna kvaliteta za separaciju vokali/instrumentali
- **Demucs v4**: Alternativa s boljim faznim informacijama
- **BS-RoFormer**: Najviša kvaliteta (ako hardver dozvoli)

### Pohrana
- **IndexedDB (Dexie.js)**: Cachiranje modela (80-300 MB) i rezultata
- **File API**: Lokaliteta obrade datoteka

---

## 4. Arhitektura komponenti

```
src/
├── components/
│   ├── AudioUpload/
│   ├── SeparationEngine/
│   ├── Karaoke/
│   ├── PlayerControls/
│   └── ModelManager/
├── workers/
│   ├── audioSeparationWorker.ts
│   └── modelLoaderWorker.ts
├── utils/
│   ├── audioProcessing.ts
│   ├── modelManager.ts
│   ├── indexedDBStorage.ts
│   └── dsp.ts
├── hooks/
│   ├── useAudioContext.ts
│   ├── useSeparation.ts
│   └── useKaraoke.ts
├── types/
│   └── audio.ts
└── pages/
    └── index.tsx
```

---

## 5. Tok podataka

```
1. UČITAVANJE DATOTEKE
   Korisnik učita MP3/WAV
            ↓
2. PROVJERA CACHE-A
   Postoji li već obrađena datoteka u IndexedDB?
            ↓
   DA: Preskočite na 5.  NE: Nastavi na 3.
            ↓
3. SEGMENTACIJA
   Audio → chunkiraj u 30-sekundne segmente
            ↓
4. SEPARACIJA (u Web Workeru)
   Svaki segment → ONNX Model → Vocals + Instrumentals
            ↓
5. SPAJANJE SEGMENATA
   Crossfading između segmenata
            ↓
6. POHRANA U CACHE
   Spremi rezultate u IndexedDB
            ↓
7. KARAOKE RENDERING
   Instrumentalni + CD+G grafika
            ↓
8. PLAYBACK
   Web Audio API → Korisničke kontrole
```

---

## 6. Tokovi stanja (State Management)

### Globalno stanje (Zustand)
```typescript
- audioFile: File
- separationProgress: number (0-100)
- vocals: AudioBuffer | null
- instrumentals: AudioBuffer | null
- karaokeLyrics: LyricLine[]
- isProcessing: boolean
- modelDownloadProgress: number
```

### Lokalno stanje (komponenta)
```typescript
- playbackTime: number
- isPlaying: boolean
- volume: number (0-1)
- pitch: number (-12 do +12)
- tempo: number (0.5 do 2.0)
```

---

## 7. Hardverski zahtjevi

### Minimalni (radi ali sporije)
- RAM: 4 GB
- Browser s WebGL 2.0 ili WASM+SIMD
- CPU: Intel i5 / AMD Ryzen 5

### Preporučeni (optimalna iskustva)
- RAM: 8+ GB
- WebGPU podrška (Chrome 113+, Edge 113+)
- GPU: NVIDIA GTX 1050 / AMD RX 5500
- SSD za brže cachiranje

---

## 8. Brzina obrade (očekivane vrijednosti)

| Model | Kvaliteta SDR | Brzina (2min audio) | VRAM |
|-------|---------------|-------------------|------|
| MDX-Net | ~8-9 dB | 30-60 sekundi | 4-6 GB |
| Demucs v4 | ~7-8 dB | 45-90 sekundi | 6-8 GB |
| BS-RoFormer | 12+ dB | 2-4 minuta | 8-12 GB |

---

## 9. Sigurnost i privatnost

- ✅ Nema slanja audio datoteka na server
- ✅ Nema klapanja slike (image tracking)
- ✅ Nema telemetrije
- ✅ Modeli su lociran u IndexedDB
- ✅ Svi izračuni u pregledniku (off-server)

---

## 10. Zavisnosti (Dependency List)

```json
{
  "react": "^18.2.0",
  "next": "^14.0.0",
  "typescript": "^5.2.0",
  "zustand": "^4.4.0",
  "dexie": "^3.2.4",
  "onnxruntime-web": "^1.16.0",
  "soundtouchjs": "^0.1.x",
  "ffmpeg.wasm": "^0.12.0",
  "jszip": "^3.10.0",
  "tailwindcss": "^3.3.0"
}
```

---

## Napomena

Sve komponente su namijenjene za lokalnu izvedbu bez zavisnosti od vanjskih API-ja.
