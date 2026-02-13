# Plan Optimizacije Performansi: Audio Karaoke Separation Aplikacija

Ovaj dokument predstavlja sveobuhvatan plan za optimizaciju performansi aplikacije za separaciju vokala i instrumentala (Audio Karaoke Separation). Plan se temelji na analizi postojeće arhitekture i implementaciji najnovijih standarda za web-baziranu obradu zvuka i AI inferenciju.

---

## 1. Optimizacija AI Modela
Fokus ove faze je smanjenje resursa koje model zahtijeva uz minimalan gubitak točnosti.

| Tehnika | Opis | Očekivani Benefit |
| :--- | :--- | :--- |
| **Kvantizacija** | Pretvaranje FP32 u INT8 ili FP16 formate. | Smanjenje veličine modela do 3x, brže učitavanje i manja potrošnja memorije. |
| **Pruning (Rezanje)** | Uklanjanje manje važnih težina iz neuronske mreže. | Smanjenje broja izračuna i veća efikasnost. |
| **Distilacija** | Treniranje manjeg "student" modela koji imitira veći "učitelj" model. | Značajno brži model s minimalnim gubitkom kvalitete. |
| **ONNX Konverzija** | Korištenje optimalne `opset_version` za kompatibilnost. | Osigurava stabilan rad unutar ONNX Runtime Web okruženja. |

---

## 2. Napredna Uprava Memorijom
Cilj je minimizirati zauzeće memorije i spriječiti curenje resursa (memory leaks).

*   **Transferable Objekti:** Korištenje `ArrayBuffer` transfera pri komunikaciji s Web Workerima kako bi se izbjeglo skupo kopiranje podataka.
*   **Rolling Buffer (Klizni međuspremnik):** Obrada audio podataka u manjim segmentima (chunks) umjesto učitavanja cijele datoteke.
*   **Proaktivno Čišćenje:**
    *   Eksplicitno oslobađanje ONNX tensora nakon upotrebe.
    *   Postavljanje referenci na velike objekte na `null` radi lakšeg Garbage Collection-a.
*   **WeakMap & WeakSet:** Korištenje slabih referenci za keširanje kako bi se omogućilo automatsko oslobađanje memorije kada objekti više nisu u upotrebi.

---

## 3. Paralelno Procesiranje i Hardversko Ubrzanje
Maksimalno iskorištenje CPU i GPU resursa korisničkog uređaja.

### WebGPU Optimizacije
1.  **IO Binding:** Zadržavanje tensora na GPU memoriji kroz više koraka kako bi se smanjio prijenos podataka između CPU-a i GPU-a.
2.  **Graph Capture:** "Hvatanje" grafova izvođenja za statične oblike ulaza radi smanjenja overhead-a.
3.  **Free Dimension Override:** Fiksiranje dimenzija ulaznog tenzora za optimalnu alokaciju memorije.

### Fallback Strategije
*   **WASM Multi-threading:** Omogućavanje `ort.env.wasm.numThreads` za uređaje bez WebGPU podrške (zahtijeva `crossOriginIsolated` mod).
*   **Pipelining:** Istovremeno dekodiranje sljedećeg segmenta na CPU-u dok se trenutni obrađuje na GPU-u.

---

## 4. Streaming i Čunkiranje (Chunking)
Postizanje niske latencije i "Time To First Audio" (TTFA).

*   **Optimalna Veličina Segmenta:** Eksperimentalno utvrditi balans (npr. 5s, 10s, 15s) između overhead-a i latencije.
*   **Overlap-Add Tehnika:** Korištenje preklapanja (npr. 1s) za spajanje segmenata bez čujnih artefakata.
*   **Prioritizacija:** Prekidanje trenutnih procesa ako korisnik promijeni pjesmu ili premota audio.

---

## 5. Strategije Keširanja
Smanjenje vremena učitavanja i omogućavanje offline rada.

> **IndexedDB (Dexie.js):** Pohrana ONNX modela i rezultata separacije na klijentskoj strani.

| Resurs | Strategija Keširanja | Invalidation Policy |
| :--- | :--- | :--- |
| **AI Modeli** | IndexedDB | Provjera verzije/hash-a pri svakom pokretanju. |
| **Rezultati (Vokali/Instr.)** | IndexedDB (LRU algoritam) | Brisanje najstarijih zapisa kada se dosegne limit. |
| **Statički Resursi** | Service Workers (Stale-while-revalidate) | Ažuriranje u pozadini pri novoj verziji aplikacije. |

---

## 6. Adaptacija Hardveru i Preglednicima
Osiguravanje pristupačnosti na svim uređajima.

*   **Detekcija Značajki:** Provjera podrške za `navigator.gpu`, `WebGL` i `AudioWorklet`.
*   **Mobilne Optimizacije:**
    *   Automatsko korištenje manjih, kvantiziranih modela.
    *   Smanjenje veličine chunkova radi uštede RAM-a.
    *   Monitoring potrošnje baterije i toplinskog opterećenja.

---

## 7. Monitoring i Profiliranje
Kontinuirano praćenje i dijagnostika performansi.

### Ključne Metrike (KPIs)
*   **Vrijeme učitavanja modela** (Network vs. Cache).
*   **Latencija inferencije po segmentu.**
*   **Time To First Audio (TTFA).**
*   **Cache Hit Ratio.**

### Alati za Dijagnostiku
*   **ONNX Runtime Profiling:** `enableProfiling` za CPU i `ort.env.webgpu.profiling` za GPU.
*   **Browser DevTools:** Analiza memorije i GPU opterećenja.
*   **Verbose Logging:** Postavljanje `ort.env.logLevel = 'verbose'` za detaljnu analizu grešaka.

---

## Zaključak
Implementacija ovog plana osigurat će da **Audio Karaoke Separation** aplikacija bude brza, responzivna i stabilna na širokom spektru uređaja. Fokus na WebGPU ubrzanje, pametno upravljanje memorijom i efikasno keširanje ključan je za postizanje vrhunskog korisničkog iskustva u 2025. godini i kasnije.
