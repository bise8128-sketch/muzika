# Development Roadmap & Project Timeline

## Faza 1: Foundation (Tjedni 1-2)

### Cilj
Osnovna infrastruktura i setup

### Tasks

```
Week 1:
├─ [ ] Project initialization
│   ├─ [ ] Create Next.js project
│   ├─ [ ] Configure TypeScript
│   ├─ [ ] Setup ESLint + Prettier
│   └─ [ ] Initialize Git repo
├─ [ ] Database setup
│   ├─ [ ] Setup Dexie.js
│   ├─ [ ] Create audio schema
│   └─ [ ] Implement model caching
└─ [ ] Dev environment
    ├─ [ ] Configure WASM paths
    ├─ [ ] Setup development server
    └─ [ ] Create development docs

Week 2:
├─ [ ] Audio utilities
│   ├─ [ ] Audio decoding (Web Audio API)
│   ├─ [ ] Audio buffer management
│   └─ [ ] Segment audio function
├─ [ ] React components skeleton
│   ├─ [ ] Main layout
│   ├─ [ ] Navigation
│   └─ [ ] Settings panel
└─ [ ] Testing infrastructure
    ├─ [ ] Setup Jest
    ├─ [ ] Setup Cypress
    └─ [ ] First unit tests
```

### Acceptance Criteria
- ✅ Dev server pokrenut bez greške
- ✅ IndexedDB radi
- ✅ Audio datoteka može biti učitana
- ✅ Basic UI framework postoji

### Estimated Hours: 40-50h
---

## Faza 2: Core ML Integration (Tjedni 3-4)

### Cilj
ONNX Runtime integracija i AI model loading

### Tasks

```
Week 3:
├─ [ ] ONNX Runtime setup
│   ├─ [ ] Install onnxruntime-web
│   ├─ [ ] Configure GPU providers (WebGPU)
│   ├─ [ ] Setup model loading
│   └─ [ ] Test inference
├─ [ ] Model preparation
│   ├─ [ ] Download MDX-Net model
│   ├─ [ ] Quantize to INT8 (optional)
│   ├─ [ ] Convert to ONNX format
│   └─ [ ] Test model locally
└─ [ ] Web Worker setup
    ├─ [ ] Create audio separation worker
    ├─ [ ] Setup message passing
    └─ [ ] Error handling in workers

Week 4:
├─ [ ] Inference engine
│   ├─ [ ] Basic inference function
│   ├─ [ ] Audio tensor preparation
│   ├─ [ ] Memory management
│   └─ [ ] Performance monitoring
├─ [ ] Model caching
│   ├─ [ ] Store models in IndexedDB
│   ├─ [ ] Intelligent model loading
│   └─ [ ] Cache invalidation
└─ [ ] Testing & debugging
    ├─ [ ] Unit tests for inference
    ├─ [ ] Performance benchmarks
    └─ [ ] GPU/CPU compatibility tests
```

### Acceptance Criteria
- ✅ Model učitan i dostupan lokalno
- ✅ Inference radi u Web Workeru
- ✅ GPU acceleration detektovan i korišten (ako dostupno)
- ✅ Memory management implementiran

### Estimated Hours: 50-60h
---

## Faza 3: Audio Separation Engine (Tjedni 5-6)

### Cilj
Kompletan pipeline za separaciju audio izvora

### Tasks

```
Week 5:
├─ [ ] Chunking strategy
│   ├─ [ ] Segment audio (30s chunks)
│   ├─ [ ] Handle buffer boundaries
│   └─ [ ] Crossfading implementation
├─ [ ] Separation pipeline
│   ├─ [ ] Process each chunk
│   ├─ [ ] Merge results
│   ├─ [ ] Progress tracking
│   └─ [ ] Error recovery
└─ [ ] Audio export
    ├─ [ ] WAV encoding
    ├─ [ ] MP3 encoding (FFmpeg.wasm)
    └─ [ ] File download

Week 6:
├─ [ ] Advanced audio processing
│   ├─ [ ] Pitch shifting (SoundTouchJS)
│   ├─ [ ] Time stretching
│   └─ [ ] Audio normalization
├─ [ ] Performance optimization
│   ├─ [ ] Reduce memory footprint
│   ├─ [ ] Optimize tensor operations
│   └─ [ ] Parallel processing
└─ [ ] Integration testing
    ├─ [ ] End-to-end separation test
    ├─ [ ] Memory leak testing
    └─ [ ] Performance profiling
```

### Acceptance Criteria
- ✅ Audio razmoguće separirati na vocals + instrumentals
- ✅ Rezultati se mogu downloadati kao WAV/MP3
- ✅ Separation traje < 2x audio duration
- ✅ Memory usage stabilan (bez leak-a)

### Estimated Hours: 60-70h
---

## Faza 4: Karaoke Features (Tjedni 7-8)

### Cilj
Karaoke playback i rendering

### Tasks

```
Week 7:
├─ [ ] Playback engine
│   ├─ [ ] Audio playback controls
│   ├─ [ ] Volume control
│   ├─ [ ] Seek functionality
│   └─ [ ] Time display
├─ [ ] Lyric management
│   ├─ [ ] LRC file parsing
│   ├─ [ ] Lyric synchronization
│   ├─ [ ] Lyric editing UI
│   └─ [ ] Save/load lyrics
└─ [ ] Visualization
    ├─ [ ] Waveform display
    ├─ [ ] Frequency visualization
    └─ [ ] Lyrics highlighting

Week 8:
├─ [ ] Karaoke rendering
│   ├─ [ ] CD+G graphics
│   ├─ [ ] Text color/styling
│   ├─ [ ] Multiple color schemes
│   └─ [ ] Export as video
├─ [ ] Advanced features
│   ├─ [ ] Pitch adjustment for karaoke
│   ├─ [ ] Tempo adjustment
│   ├─ [ ] Echo/reverb effects
│   └─ [ ] Recording functionality
└─ [ ] Testing
    ├─ [ ] Playback sync tests
    ├─ [ ] Rendering quality tests
    └─ [ ] User experience testing
```

### Acceptance Criteria
- ✅ Karaoke player radi s lyrics
- ✅ Playback je synchronizovan s lyrics
- ✅ Mogućnost exporta video s CD+G grafikom
- ✅ UI je intuitivna i responsive

### Estimated Hours: 50-60h
---

## Faza 5: UI/UX & Polish (Tjedni 9-10)

### Cilj
Profesionalan korisni sučelje

### Tasks

```
Week 9:
├─ [ ] Main application UI
│   ├─ [ ] Responsive design (mobile/tablet/desktop)
│   ├─ [ ] Dark/light mode
│   ├─ [ ] Settings panel
│   └─ [ ] Help/tutorial
├─ [ ] Upload interface
│   ├─ [ ] Drag & drop
│   ├─ [ ] File validation
│   ├─ [ ] Progress indicator
│   └─ [ ] Error messages
├─ [ ] Results display
│   ├─ [ ] Audio comparison
│   ├─ [ ] Download buttons
│   ├─ [ ] Cache management UI
│   └─ [ ] History

Week 10:
├─ [ ] Animations & transitions
│   ├─ [ ] Smooth loading states
│   ├─ [ ] Progress animations
│   ├─ [ ] Fade transitions
│   └─ [ ] Hover effects
├─ [ ] Accessibility
│   ├─ [ ] ARIA labels
│   ├─ [ ] Keyboard navigation
│   ├─ [ ] Screen reader support
│   └─ [ ] Color contrast compliance
└─ [ ] Branding
    ├─ [ ] Logo & favicon
    ├─ [ ] Color scheme
    ├─ [ ] Typography
    └─ [ ] Consistent styling
```

### Acceptance Criteria
- ✅ UI je responzivna na svim veličinama
- ✅ Aplikacija je dostupna (WCAG AA)
- ✅ Loading states su jasni
- ✅ Error messages su korisni

### Estimated Hours: 40-50h
---

## Faza 6: Testing & Optimization (Tjedni 11-12)

### Cilj
Kvaliteta i performanse

### Tasks

```
Week 11:
├─ [ ] Unit testing
│   ├─ [ ] Core utilities >80% coverage
│   ├─ [ ] Audio processing functions
│   ├─ [ ] Storage functions
│   └─ [ ] Utility helpers
├─ [ ] Integration testing
│   ├─ [ ] Audio separation flow
│   ├─ [ ] Cache management
│   ├─ [ ] Playback functionality
│   └─ [ ] File export
├─ [ ] E2E testing (Cypress)
│   ├─ [ ] Complete separation flow
│   ├─ [ ] Cache hit/miss scenarios
│   ├─ [ ] Error scenarios
│   └─ [ ] Performance regression tests

Week 12:
├─ [ ] Performance optimization
│   ├─ [ ] Code splitting
│   ├─ [ ] Asset optimization
│   ├─ [ ] Bundle size analysis
│   └─ [ ] Runtime performance tuning
├─ [ ] Security audit
│   ├─ [ ] Input validation
│   ├─ [ ] XSS prevention
│   ├─ [ ] Data sanitization
│   └─ [ ] CORS configuration
└─ [ ] Final testing
    ├─ [ ] Cross-browser testing
    ├─ [ ] Network throttling tests
    ├─ [ ] Memory profiling
    └─ [ ] Battery usage (mobile)
```

### Acceptance Criteria
- ✅ >80% test coverage
- ✅ Bundle size < 500KB (main bundle)
- ✅ First Contentful Paint < 2s
- ✅ Lighthouse score >85

### Estimated Hours: 50-60h
---

## Faza 7: Deployment & Documentation (Tjedni 13-14)

### Cilj
Production launch

### Tasks

```
Week 13:
├─ [ ] Deployment setup
│   ├─ [ ] Setup CI/CD (GitHub Actions)
│   ├─ [ ] Vercel/Docker configuration
│   ├─ [ ] Environment variables
│   ├─ [ ] Analytics setup
│   └─ [ ] Error tracking (Sentry)
├─ [ ] Documentation
│   ├─ [ ] README setup
│   ├─ [ ] API documentation
│   ├─ [ ] User guide
│   ├─ [ ] Developer guide
│   └─ [ ] Architecture diagram

Week 14:
├─ [ ] Pre-launch
│   ├─ [ ] Final testing
│   ├─ [ ] Security review
│   ├─ [ ] Privacy policy setup
│   ├─ [ ] ToS setup
│   └─ [ ] Backup strategy
├─ [ ] Launch
│   ├─ [ ] Deploy to production
│   ├─ [ ] Smoke testing
│   ├─ [ ] Monitor error rates
│   └─ [ ] Performance monitoring
└─ [ ] Post-launch
    ├─ [ ] User feedback collection
    ├─ [ ] Bug fixes
    ├─ [ ] Performance tuning
    └─ [ ] Feature requests log
```

### Acceptance Criteria
- ✅ App je dostupna na http://your-domain.com
- ✅ SSL certificate postavljen
- ✅ Uptime monitoring aktivan
- ✅ Error tracking radi
- ✅ Analytics prikupljaju podatke

### Estimated Hours: 30-40h
---

## Faza 8: Post-Launch Improvements (Ongoing)

### Priority
1. **High** - Bug fixes, critical features
2. **Medium** - Performance improvements, nice-to-have features
3. **Low** - Polish, minor enhancements

### Backlog Features

```
High Priority:
├─ [ ] Support za više modela (Demucs, BS-RoFormer)
├─ [ ] Batch processing više datoteka
├─ [ ] Advanced karaoke effects
├─ [ ] Recording own vocals
└─ [ ] Sharing feature

Medium Priority:
├─ [ ] MusicXML import
├─ [ ] MIDI export
├─ [ ] Real-time processing (michrophone)
├─ [ ] Plugin system
└─ [ ] Collaboration features

Low Priority:
├─ [ ] Mobile app (React Native)
├─ [ ] Browser extension
├─ [ ] Social features
├─ [ ] Marketplace for effects
└─ [ ] Premium features / Monetization
```

---

## Vremenska Procjena

| Faza | Tjedni | Sati | Kumulativno |
|------|--------|------|-----------|
| 1. Foundation | 2 | 45 | 45h |
| 2. ML Integration | 2 | 55 | 100h |
| 3. Separation Engine | 2 | 65 | 165h |
| 4. Karaoke Features | 2 | 55 | 220h |
| 5. UI/UX Polish | 2 | 45 | 265h |
| 6. Testing/Optimization | 2 | 55 | 320h |
| 7. Deployment/Docs | 2 | 35 | 355h |

**Ukupno: ~355 sati razvoja (9 tjedana za 1 dev-a)**

---

## Resourcing

### Minimalna postavka (1 dev)
- **Timeline**: 14 tjedana (3-4 mjeseca)
- **Resursi**: 1 full-stack dev
- **Budget**: Hosting + domains

### Optimalna postavka (2-3 dev-a)
- **Timeline**: 7-8 tjedana (1.5-2 mjeseca)
- **Resursi**: 
  - 1 Backend/ML dev
  - 1 Frontend dev
  - 0.5 QA/DevOps
- **Budget**: Veće hosting, monitoring tools

---

## Risk Management

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Model inference spora | Medium | High | Early GPU testing, optimize batch size |
| Memory leaks | Medium | High | Aggressive memory profiling, WeakMap usage |
| Browser compatibility | Low | Medium | Test on Chrome, Edge, Firefox early |
| CORS issues | Low | Medium | Proper server configuration |
| Audio sync issues | Medium | Medium | Extensive playback testing |

---

## Success Metrics

- **Performance**: Separation < 2x audio duration
- **Quality**: SDR > 8dB on vocals
- **Reliability**: >99% uptime
- **User satisfaction**: >4.5/5 stars (if applicable)
- **Performance score**: Lighthouse >85

---

## Iterative Improvements

### Post-launch monitoring
```
Week 1-2: Daily monitoring
Week 3-4: Weekly reviews
Month 2+: Bi-weekly reviews

Metrics to track:
- Error rates
- User feedback
- Performance metrics
- Feature usage
```

