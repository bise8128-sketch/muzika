# Glossary & FAQ - Tehnološki Pojmovi

## A - C

### **AJAX (Asynchronous JavaScript and XML)**
Tehnologija za slanje podataka bez osvježavanja stranice. U našoj aplikaciji koristimo za učitavanje modela u pozadini.

### **AudioBuffer**
JavaScript objekt koji sadrži audio podatke u memoriji. Sadrži multiple kanale (stereo = 2 kanala) sa PCM audio uzorcima.

```typescript
interface AudioBuffer {
  channelData: Float32Array[];
  sampleRate: number; // 44100 ili 48000 Hz
  duration: number;
  numberOfChannels: number;
}
```

### **AudioWorklet**
Moderna Web Audio API koja omogućava niskolatencijsku obradu zvuka na zasebnoj niti bez blokiranja UI-ja.

### **Base64**
Tehnologija kodiranja koja pretvara binarne podatke u ASCII string. Koristimo za slanje AI modela kao stringova.

### **Bitrate**
Količina podataka po sekundi audio datoteke. MP3 @128kbps vs @320kbps (viši = bolji kvalitet).

### **Blob**
JavaScript objekt koji predstavlja raw audio ili video podatke. Koristimo za download audio datoteka.

### **Browser Storage (Web Storage)**
- **localStorage**: 5-10MB, persistent
- **sessionStorage**: 5-10MB, briše se pri zatvaranju
- **IndexedDB**: 50GB+, strukturirani podaci ✅ Koristimo za modele
- **Cache API**: 50GB+, za HTTP cache

### **Codec**
Software koji kodira/dekodira audio format (MP3, WAV, OGG).

### **CPU (Central Processing Unit)**
Procesor koji izvršava JavaScript kod. Sporiji za AI modele, trebamo GPU.

### **CORS (Cross-Origin Resource Sharing)**
Sigurnosni mehanizam koji dozvoljava prekogranične zahtjeve između različitih domena.

---

## D - F

### **DAW (Digital Audio Workstation)**
Softver za audio produkciju (Ableton, FL Studio, Audacity). Mi kreiramo mini DAW za karaoke.

### **Dexie.js**
Jednostavniji wrapper oko IndexedDB koji čini rad s bazom lakšim.

### **DSP (Digital Signal Processing)**
Obrada audio signala matematičkim algoritmima (filtering, equalization, pitch shifting).

### **Execute/Inference**
Pokretanje AI modela na input podacima. U našem slučaju: audio → Model → Vocals + Instrumentals.

### **FFmpeg (FFmpeg WASM)**
Alat za konverziju audio/video formata koji radi u pregledniku kao WASM.

### **Frequency Domain**
Reprezentacija zvuka kao skupa frekvencija (koristi se STFT - Short Time Fourier Transform). Alternativa: Time Domain (raw waveform).

### **Float32Array**
JavaScript TypedArray za spremanje 32-bit floating point brojeva. Koristi se za audio uzorke.

---

## G - M

### **GHz (Gigahertz)**
Jedinica frekvencije procesora (2.4 GHz = 2.4 milijarde ciklusa po sekundi).

### **GPU (Graphics Processing Unit)**
Specijaliziran procesor za paralelne kalkulacije. 50-100x brži od CPU-a za AI modele!

### **Headless**
Pokretanje bez korisničkog sučelja (npr. Node.js server bez preglednika).

### **Hz (Hertz)**
Jedinica frekvencije. 44100 Hz = 44,100 uzoraka po sekundi.

### **Inference**
Vidi **Execute/Inference**.

### **IndexedDB**
Pregljednikova baza podataka za large amounts of data (idealna za cachiranje AI modela).

### **JSON (JavaScript Object Notation)**
Format za razmjenu podataka. Koristi se za config files, API responses.

### **Latency**
Kašnjenje u milisekundama. AudioWorklet ima ~10ms latenciju, regularni Web Audio API ~100-200ms.

### **LRC (Lyrics Recognition)**
Format tekstualne datoteke za karaoke. Primjer:
```
[00:12.00]First line of lyrics
[00:17.20]Second line of lyrics
```

### **MB/GB**
Jedinice veličine memorije. 1 GB = 1024 MB.

### **Modem/Bandwidth**
Brzina interneta (Mbps - megabits per second). Trebam za preuzimanje modela.

### **MPEG**
Format audio kompresije (MP3 je dio MPEG-1).

---

## N - P

### **ONNX (Open Neural Network Exchange)**
Standard format za AI modele omogućavajući pokretanje na različitim platformama i frameworkima.

```
PyTorch → ONNX → ONNX Runtime Web → Browser
```

### **OOM (Out of Memory)**
Greška kada aplikacija potrošи svu dostupnu RAM memoriju. Trebamo chunking za izbjegavanje.

### **PCM (Pulse Code Modulation)**
Standard za digitalizaciju zvuka (broj bitova * sample rate = bitrate).

### **Polyfill**
JavaScript kod koji emulira moderne API na starijim browserima.

### **Precision (FP32, FP16, INT8)**
- **FP32**: 32-bit floating point - high quality but large
- **FP16**: 16-bit floating point - balanced
- **INT8**: 8-bit integer - small but lower quality

Trebamo za quantizaciju modela.

---

## R - S

### **RAM (Random Access Memory)**
Brz privremeni memorija koja se briše pri gašenju. Trebam 4-8GB za audio separation.

### **Resolution (Frequency Bins)**
Broj frekvencija u spektrogramu. 128 freq bins je standard za audio modele.

### **Sample Rate**
Broj uzoraka po sekundi (44100 Hz = audio CD quality).

### **SDR (Signal-to-Distortion Ratio)**
Mjera kvalitete separacije. Viši = bolji (>8dB je dobar).

### **SoundTouchJS**
JavaScript biblioteka za pitch shifting i time stretching bez promjene drugog parametra.

### **SIMD (Single Instruction Multiple Data)**
CPU tehnika koja procesira multiple podatke odjednom (brže!)

### **Spectrogram**
Vizuelizacija frekvencija kroz vrijeme (x-osa = vrijeme, y-osa = frekvencija).

### **STFT (Short-Time Fourier Transform)**
Algoritam koji pretvara audio iz time domain u frequency domain.

### **Streaming**
Slanje podataka u dijelovima umjesto cijele datoteke odjednom.

---

## T - W

### **Tensor**
N-dimenzionalni niz brojeva. Audio je 1D tensor, spectrogram je 2D tensor, batch je 3D.

### **Threshold**
Granična vrijednost ispod/iznad koje se nešto dešava (npr. volume threshold = min audibility).

### **TypeScript**
JavaScript s type system-om. Sprječava greške zbog pogrešnih tipova.

### **VRAM (Video RAM)**
GPU memorija. Trebam 4-8GB za pokretanje AI modela na GPU.

### **WAV**
Audio format bez kompresije (PCM). Veći fajlovi ali higher quality.

### **Web Worker**
JavaScript thread koji radi off-main-thread. Trebam za AI inference da se ne zamrzne UI.

### **WebAssembly (WASM)**
Binary format koji se brže izvršava u pregledniku od JavaScripta (~2-10x brže).

### **WebGL**
API za GPU pristupa iz JavaScripta (starija verzija WebGPU-a).

### **WebGPU**
Nova API za GPU pristupa (brža i fleksibilnija od WebGL-a).

---

## Često Postavljena Pitanja (FAQ)

### Q: Koliko vremena traje separacija audio datoteke?
**A:** Ovisi o:
- Dužini datoteke (2min → ~30-60 sekundi)
- Hardveru (GPU 2x brža od CPU)
- Izabranom modelu (MDX-Net najbrža)

### Q: Trebam li internetu za korištenje aplikacije?
**A:** Samo za prvi put (preuzimanje AI modela ~150MB). Zatim je offline.

### Q: Mogu li koristiti svoje AI modele?
**A:** Da! Sve dok su u ONNX formatu. Trebate konvertirati iz PyTorch/TensorFlow.

### Q: Koliko memorije trebam?
**A:** Minimalno 4GB RAM. Preporučeno 8GB+ za brze separation.

### Q: Je li moja glazba sigurna?
**A:** Potpuno! Sve se procesira lokalno - nikad ne izlaze iz vašeg računala.

### Q: Mogu li je koristiti na mobitelu?
**A:** Mobitel trebao bi manju datoteku. Desktop je preporučen za većine datoteka.

### Q: Koje audio formate podržavate?
**A:** MP3, WAV, OGG, FLAC (preko FFmpeg WASM).

### Q: Kakva je kvaliteta separacije?
**A:** MDX-Net daje ~8-9dB SDR (vokal je čist, malo instrumentala ostaje). Sluša se jako dobro.

### Q: Mogu li koristiti rezultate komercijalno?
**A:** Trebate licence za originalnu glazbu. Aplikacija samo alat za separaciju.

### Q: Što se dešava ako nema mjesta na disku?
**A:** Cache se automatski briše (LRU policy). Uvijek ostaje mjesta za nove obrade.

### Q: Mogu li eksportirati kao MIDI?
**A:** Ne (API zahtijeva). Trebate koristiti dodatne alate za konverziju WAV → MIDI.

### Q: Trebam li GPU za pokretanje?
**A:** CPU radi (WASM), ali GPU je 2-10x brža. WebGPU je idealna (ako dostupna).

### Q: Koliko dugo se model učitava?
**A:** Prvi put: ~30-60 sekundi (download + parse)
Sljedeći put: ~5 sekundi (iz cache-a)

### Q: Mogu li procesirati više datoteka odjednom?
**A:** Trenutno jedna po jedna. Batch processing je future feature.

### Q: Trebam li VPN?
**A:** Samo ako trebate preuzeti modele sa limitiranim pristupom. Inače ne.

### Q: Je li aplikacija dostupna na mobilnom?
**A:** Trebala bi biti responsive, ali desktop je preporučen (manja VRAM na mobilima).

---

## Skraćenice

| Skraćenica | Pojam |
|-----------|-------|
| API | Application Programming Interface |
| AI | Artificial Intelligence |
| DNN | Deep Neural Network |
| GPU | Graphics Processing Unit |
| HTTP/HTTPS | Hypertext Transfer Protocol (Secure) |
| JSON | JavaScript Object Notation |
| MB/GB | Megabyte/Gigabyte |
| ML | Machine Learning |
| ONNX | Open Neural Network Exchange |
| RAM | Random Access Memory |
| REST | Representational State Transfer |
| UI/UX | User Interface/Experience |
| VRAM | Video RAM |
| WAV | Waveform Audio Format |
| XML | Extensible Markup Language |

---

## Dodatne Resurse

### Učenje
- [MDN Web Docs - Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [ONNX Runtime Documentation](https://onnxruntime.ai/)
- [Next.js Documentation](https://nextjs.org/docs)

### Alati
- [Audacity](https://www.audacityteam.org/) - Audio editing
- [ffmpeg](https://ffmpeg.org/) - Audio conversion
- [ONNX Model Zoo](https://github.com/onnx/models) - Pretrained models

### Community
- Stack Overflow - [web-audio-api](https://stackoverflow.com/questions/tagged/web-audio-api)
- GitHub Discussions - [onnxruntime-web](https://github.com/microsoft/onnxruntime/discussions)
- r/MachineLearning - AI discussions

