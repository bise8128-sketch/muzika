/**
 * PlaybackCore — Main playback engine.
 *
 * Composes EffectsChain + EventManager. Owns playback state, buffer source
 * lifecycle, seek, volume, and the deprecated ScriptProcessor fallback path.
 */

import { getAudioContext } from "../audioContext";
import { EffectsChain } from "./EffectsChain";
import { EventManager, EventType, EventCallback } from "./EventManager";
import type {
  ReverbSettings,
  EchoSettings,
  PitchCorrectionSettings,
  StemSettings,
  StemPreset,
  StemType,
  PitchAnalysisResult,
  PerformanceScore,
  PitchTarget,
} from "../../../types/audio";
import type { KeyInfo } from "../keyDetection";
import type { ReverbProcessor } from "../reverbProcessor";
import type { EchoProcessor } from "../echoProcessor";
import type { PitchCorrector } from "../pitchCorrection";
import { getMicrophoneStream, createPitchDetectorNode } from "../audioContext";
import { analyzeDetectedPitch, getPerformanceScore, generatePitchTargets } from "../pitchAnalysis";

const BUFFER_SIZE = 4096;

export class PlaybackController {
  private audioContext: AudioContext;
  private effects: EffectsChain;
  private events: EventManager;

  // Sources
  private bufferSources: AudioBufferSourceNode[] = [];
  private gainNodes: GainNode[] = [];
  private pannerNodes: StereoPannerNode[] = [];
  private reverbSendNodes: GainNode[] = [];
  private echoSendNodes: GainNode[] = [];
  private stemAnalysers: AnalyserNode[] = [];

  // Track state
  private audioBuffers: AudioBuffer[] = [];
  private voiceBuffer: AudioBuffer | null = null;
  private trackVolumes: number[] = [];
  private voiceVolume: number = 1.0;

  // Stem isolation state
  private stemStates: StemSettings[] = [];
  private stemMutedVolumes: number[] = []; // remembered volumes for mute restore

  // Playback state
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private playHead: number = 0;
  private startTime: number = 0;
  private _songId: string | null = null; // Track current song hash or id
  private _originalFile: File | null = null; // Track original file for separation

  // Leftover samples for SoundTouch processing (deprecated)
  private leftoverLeft: Float32Array | null = null;
  private leftoverRight: Float32Array | null = null;
  private leftoverIndex: number = 0;

  // Vocal Performance Analysis
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private pitchDetector: AudioWorkletNode | null = null;
  private pitchScoringWorker: Worker | null = null;
  private currentKey: KeyInfo | null = null;
  private isAnalyzing: boolean = false;
  private isAdaptiveAssistEnabled: boolean = false;

  constructor() {
    this.audioContext = getAudioContext();
    this.effects = new EffectsChain();
    this.events = new EventManager();

    // Wire time source for time-update loop
    this.events.setTimeSource(() => ({
      currentTime: this.getCurrentTime(),
      duration: this.getDuration(),
    }));

    // Init audio worklet
    this.effects.initializeAudioWorklet();
  }

  // ─── Buffer Management ─────────────────────────────────────────

  setAudioBuffers(buffers: AudioBuffer[]): void {
    this.stop();
    this.audioBuffers = buffers;
    this.trackVolumes = buffers.map(() => 1.0);
  }

  getAudioBuffers(): AudioBuffer[] {
    return this.audioBuffers;
  }

  setSongId(id: string | null): void {
    this._songId = id;
  }

  getSongId(): string | null {
    return this._songId;
  }

  setOriginalFile(file: File | null): void {
    this._originalFile = file;
  }

  getOriginalFile(): File | null {
    return this._originalFile;
  }

  setVoiceBuffer(buffer: AudioBuffer | null): void {
    this.voiceBuffer = buffer;
  }

  setVoiceVolume(volume: number): void {
    this.voiceVolume = Math.max(0, Math.min(1, volume));
  }

  // ─── Volume ────────────────────────────────────────────────────

  setVolume(volume: number, trackIndex?: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    if (trackIndex !== undefined) {
      this.trackVolumes[trackIndex] = clamped;
    } else {
      this.trackVolumes = this.trackVolumes.map(() => clamped);
    }
  }

  getVolume(trackIndex: number = 0): number {
    return this.trackVolumes[trackIndex] || 0;
  }

  getGainNodes(): GainNode[] {
    return [];
  }

  // ─── Transport ─────────────────────────────────────────────────

  play(): void {
    if (this.audioBuffers.length === 0) {
      console.warn("No audio buffers set for playback");
      return;
    }

    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }

    if (!this.isPlaying) {
      this.isPlaying = true;
      this.isPaused = false;
      this.stopAllSources();

      const currentTime = this.getCurrentTime();
      const destination = this.effects.getDestination();

      this.audioBuffers.forEach((buffer, index) => {
        const stem = this.stemStates[index];
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;

        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = this.trackVolumes[index] || 1.0;

        const pannerNode = this.audioContext.createStereoPanner();
        pannerNode.pan.value = stem?.panning || 0;

        const analyser = this.audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;

        // Effect Sends
        const reverbSend = this.audioContext.createGain();
        reverbSend.gain.value = stem?.reverbSend || 0;
        const echoSend = this.audioContext.createGain();
        echoSend.gain.value = stem?.echoSend || 0;

        // Wiring
        source.connect(gainNode);
        gainNode.connect(pannerNode);
        pannerNode.connect(analyser);
        analyser.connect(destination);

        // Connect sends
        const globalReverb = this.effects.getReverbInput();
        const globalEcho = this.effects.getEchoInput();
        if (globalReverb) {
            analyser.connect(reverbSend);
            reverbSend.connect(globalReverb);
        }
        if (globalEcho) {
            analyser.connect(echoSend);
            echoSend.connect(globalEcho);
        }

        this.effects.connectSourceToEffects(analyser);

        source.start(0, currentTime);
        source.onended = () => {
          if (this.isPlaying) {
            this.stop();
            this.events.emit("ended");
          }
        };

        this.bufferSources.push(source);
        this.gainNodes[index] = gainNode;
        this.pannerNodes[index] = pannerNode;
        this.reverbSendNodes[index] = reverbSend;
        this.echoSendNodes[index] = echoSend;
        this.stemAnalysers[index] = analyser;
      });

      // Voice buffer
      if (this.voiceBuffer && this.voiceVolume > 0) {
        const voiceSource = this.audioContext.createBufferSource();
        voiceSource.buffer = this.voiceBuffer;

        const voiceGain = this.audioContext.createGain();
        voiceGain.gain.value = this.voiceVolume;

        voiceSource.connect(voiceGain);
        voiceGain.connect(destination);
        this.effects.connectSourceToEffects(voiceGain);

        voiceSource.start(0, currentTime);
        this.bufferSources.push(voiceSource);
      }

      this.startTime = this.audioContext.currentTime - currentTime;
      this.events.startTimeUpdateLoop();
      this.events.emit("play");
    }
  }

  pause(): void {
    if (!this.isPlaying) return;
    this.playHead = Math.floor(
      this.getCurrentTime() * this.audioContext.sampleRate,
    );
    this.stopAllSources();
    this.isPlaying = false;
    this.isPaused = true;
    this.events.stopTimeUpdateLoop();
    this.events.emit("pause");
  }

  stop(): void {
    this.stopAllSources();
    this.isPlaying = false;
    this.isPaused = false;
    this.playHead = 0;
    this.effects.resetProcessor();
    this.events.stopTimeUpdateLoop();
    this.events.emit("stop");
  }

  private stopAllSources(): void {
    this.bufferSources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {
        /* may already be stopped */
      }
    });
    this.pannerNodes.forEach(p => { try { p.disconnect(); } catch{} });
    this.reverbSendNodes.forEach(g => { try { g.disconnect(); } catch{} });
    this.echoSendNodes.forEach(g => { try { g.disconnect(); } catch{} });
    this.stemAnalysers.forEach((analyser) => {
      try {
        analyser.disconnect();
      } catch {
        /* ignore */
      }
    });
    this.bufferSources = [];
    this.pannerNodes = [];
    this.reverbSendNodes = [];
    this.echoSendNodes = [];
    this.stemAnalysers = [];
  }

  // ─── Seek / Time ───────────────────────────────────────────────

  setCurrentTime(seconds: number): void {
    const duration = this.getDuration();
    const clamped = Math.max(0, Math.min(seconds, duration));
    this.playHead = Math.floor(clamped * this.audioContext.sampleRate);
    this.effects.resetProcessor();
    this.events.emit("timeupdate", { currentTime: clamped, duration });
    this.events.emit("seeked", { currentTime: clamped });
  }

  getCurrentTime(): number {
    if (this.isPlaying && this.startTime > 0) {
      return this.audioContext.currentTime - this.startTime;
    } else if (this.audioBuffers.length > 0) {
      return this.playHead / this.audioContext.sampleRate;
    }
    return 0;
  }

  getDuration(): number {
    return this.audioBuffers[0]?.duration || 0;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  // ─── Vocal Performance Analysis ─────────────────────────
  /**
   * Start microphone analysis
   */
  async startMicAnalysis(keyInfo?: KeyInfo | null): Promise<void> {
    if (this.isAnalyzing) return;
    this.currentKey = keyInfo || null;

    try {
      this.micStream = await getMicrophoneStream();
      this.micSource = this.audioContext.createMediaStreamSource(this.micStream);
      this.pitchDetector = await createPitchDetectorNode(this.audioContext);

      // Connect mic to detector
      this.micSource.connect(this.pitchDetector);
      
      // Initialize scoring worker
      this.pitchScoringWorker = new Worker(new URL('../pitchScoring.worker', import.meta.url));
      this.pitchScoringWorker.postMessage({ type: 'INIT' });

      // Handle updates from worker
      this.pitchScoringWorker.onmessage = (event) => {
        if (event.data.type === 'SCORE_UPDATE') {
           const payload = event.data.payload;
           this.events.emit("pitch-analysis-update", payload);

           // Handle Adaptive Assist
           if (this.isAdaptiveAssistEnabled) {
              const { result } = payload;
              // If accuracy is low, increase correction amount. 
              // If accuracy is high, decrease it to avoid "robotic" sound when singing well.
              // Threshold: if score < 70, start assisting.
              // Formula: 1.0 - (score/100) but capped.
              let targetCorrection = 0.8;
              if (result.accuracy >= 90) targetCorrection = 0.2;
              else if (result.accuracy >= 70) targetCorrection = 0.5;
              else targetCorrection = 0.95;

              this.effectsChain.setPitchCorrectionAmount(targetCorrection);
           }
        }
      };

      this.isAnalyzing = true;

      // Forward raw pitch data to the scoring worker
      this.pitchDetector.port.onmessage = (event) => {
        if (event.data.type === 'pitch_data' && this.isPlaying && this.pitchScoringWorker) {
          const { frequency, confidence } = event.data;
          const currentTime = this.getCurrentTime();
          
          // Get reference pitch at current time from vocal buffer
          const refVocals = this.getVocalsAtTime(currentTime);
          
          this.pitchScoringWorker.postMessage({
             type: 'ADD_FRAME',
             payload: {
               frequency,
               confidence,
               currentTime,
               refVocals,
               keyInfo: this.currentKey
             }
          });
        }
      };

      this.events.emit("mic-started");
    } catch (err) {
      console.error("[PlaybackCore] Failed to start microphone analysis", err);
      this.isAnalyzing = false;
      throw err;
    }
  }

  stopMicAnalysis(): void {
    if (!this.isAnalyzing) return;

    if (this.pitchDetector) {
      this.pitchDetector.disconnect();
      this.pitchDetector = null;
    }

    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
    
    // We intentionally don't terminate the worker here, so the hook can fetch the final state.
    // The consumer (usePitchAnalysis) will call getFinalPerformance() which will then 
    // terminate the worker once the promise resolves.

    this.isAnalyzing = false;
    this.events.emit("mic-stopped");
  }

  async getFinalPerformance(): Promise<{ overallScore: PerformanceScore; history: PitchAnalysisResult[] } | null> {
      // ... same implementation ...
  }

  setAdaptiveAssist(enabled: boolean): void {
      this.isAdaptiveAssistEnabled = enabled;
      this.effectsChain.setPitchCorrectionAdaptiveMode(enabled);
      
      // If we're disabling it, reset to the default correction amount
      if (!enabled) {
          this.effectsChain.setPitchCorrectionAmount(0.8);
      }
  }

  isAdaptiveAssistActive(): boolean {
      return this.isAdaptiveAssistEnabled;
  }

  /**
   * Helper to get the detected pitch of the vocal stem at a specific time.
   * This is used as the target for scoring.
   */
  private getVocalsAtTime(time: number): { pitch: number; midi: number } | null {
    // Find vocal buffer
    const vocalBuffer = this.audioBuffers.find((_, i) => this.stemStates[i]?.type === 'vocals');
    if (!vocalBuffer) return null;

    // Use a utility to sample pitch from the reference buffer
    // For real-time scoring, we should probably pre-calculate this or keep a small cache
    // For now, call the analyzer (it will slice a small window)
    try {
        const { getReferencePitchAtTime } = require("../pitchAnalysis");
        return getReferencePitchAtTime(vocalBuffer, time);
    } catch (err) {
        return null; // pitchAnalysis might not be fully available or throw
    }
  }

  async getPitchTargets(count: number = 8): Promise<PitchTarget[]> {
    const vocalBuffer = this.audioBuffers.find((_, i) => this.stemStates[i]?.type === 'vocals');
    // Note: This requires LRC data which isn't directly held here. 
    // This method might need to be orchestrated by a hook or KaraokePlayer.
    return []; 
  }

  // ─── Events (delegated) ────────────────────────────────────────

  on(event: EventType, callback: EventCallback): void {
    this.events.on(event, callback);
  }
  off(event: EventType, callback: EventCallback): void {
    this.events.off(event, callback);
  }

  // ─── Effects (delegated) ───────────────────────────────────────

  setPitch(semitones: number): void {
    this.effects.setPitch(semitones);
  }
  setTempo(multiplier: number): void {
    this.effects.setTempo(multiplier);
  }
  setReverbLevel(level: number): void {
    this.effects.setReverbLevel(level);
  }
  setEchoLevel(level: number): void {
    this.effects.setEchoLevel(level);
  }
  setMasterGain(gain: number): void {
    this.effects.setMasterGain(gain);
  }
  setBassGain(gain: number): void {
    this.effects.setBassGain(gain);
  }
  setMidGain(gain: number): void {
    this.effects.setMidGain(gain);
  }
  setTrebleGain(gain: number): void {
    this.effects.setTrebleGain(gain);
  }
  setEQ(bass: number, mid: number, treble: number): void {
    this.effects.setEQ(bass, mid, treble);
  }

  setReverbSettings(settings: Partial<ReverbSettings>): void {
    this.effects.setReverbSettings(settings);
  }
  getReverbSettings(): ReverbSettings {
    return this.effects.getReverbSettings();
  }
  setReverbEnabled(enabled: boolean): void {
    this.effects.setReverbEnabled(enabled);
  }
  applyReverbPreset(
    preset: "hall" | "room" | "plate" | "chamber" | "spring",
  ): void {
    this.effects.applyReverbPreset(preset);
  }

  setEchoSettings(settings: Partial<EchoSettings>): void {
    this.effects.setEchoSettings(settings);
  }
  getEchoSettings(): EchoSettings {
    return this.effects.getEchoSettings();
  }
  setEchoEnabled(enabled: boolean): void {
    this.effects.setEchoEnabled(enabled);
  }
  setStereoDelayEnabled(enabled: boolean): void {
    this.effects.setStereoDelayEnabled(enabled);
  }

  async setPitchCorrectionSettings(
    settings: Partial<PitchCorrectionSettings>,
  ): Promise<void> {
    return this.effects.setPitchCorrectionSettings(settings);
  }
  getPitchCorrectionSettings(): PitchCorrectionSettings {
    return this.effects.getPitchCorrectionSettings();
  }
  async setPitchCorrectionEnabled(enabled: boolean): Promise<void> {
    return this.effects.setPitchCorrectionEnabled(enabled);
  }
  async setPitchCorrectionScale(
    scale:
      | "chromatic"
      | "major"
      | "minor"
      | "pentatonic-major"
      | "pentatonic-minor",
  ): Promise<void> {
    return this.effects.setPitchCorrectionScale(scale);
  }
  async setPitchCorrectionReferenceKey(referenceKey: number): Promise<void> {
    return this.effects.setPitchCorrectionReferenceKey(referenceKey);
  }
  async setPitchCorrectionRetuneSpeed(retuneSpeed: number): Promise<void> {
    return this.effects.setPitchCorrectionRetuneSpeed(retuneSpeed);
  }
  async setPitchCorrectionAmount(correctionAmount: number): Promise<void> {
    return this.effects.setPitchCorrectionAmount(correctionAmount);
  }

  getReverbProcessor(): ReverbProcessor {
    return this.effects.getReverbProcessor();
  }
  getEchoProcessor(): EchoProcessor {
    return this.effects.getEchoProcessor();
  }
  getPitchCorrector(): PitchCorrector {
    return this.effects.getPitchCorrector();
  }

  // ─── Stem Isolation ────────────────────────────────────────────

  private static readonly DEFAULT_STEM_LABELS: Record<
    StemType,
    { label: string; icon: string }
  > = {
    vocals: { label: "Vocals", icon: "🎤" },
    drums: { label: "Drums", icon: "🥁" },
    bass: { label: "Bass", icon: "🎸" },
    other: { label: "Other", icon: "🎹" },
    instrumental: { label: "Instrumental", icon: "🎵" },
  };

  /**
   * Initialise stem states from the current audioBuffers.
   * Called automatically when buffers are set, or manually to reset labels.
   */
  initStemStates(stemTypes?: StemType[]): void {
    const count = this.audioBuffers.length;
    const defaultOrder: StemType[] = [
      "vocals",
      "instrumental",
      "drums",
      "bass",
      "other",
    ];
    const types = stemTypes || defaultOrder.slice(0, count);

    this.stemStates = types.map((type, i) => {
      const meta = PlaybackController.DEFAULT_STEM_LABELS[type] || {
        label: type,
        icon: "🎵",
      };
      return {
        type,
        label: meta.label,
        volume: this.trackVolumes[i] ?? 1.0,
        muted: false,
        solo: false,
        icon: meta.icon,
        panning: 0,
        reverbSend: 0,
        echoSend: 0,
      };
    });
    this.stemMutedVolumes = this.stemStates.map((s) => s.volume);
  }

  getStemStates(): StemSettings[] {
    // Lazy init
    if (this.stemStates.length === 0 && this.audioBuffers.length > 0) {
      this.initStemStates();
    }
    return [...this.stemStates];
  }

  setStemVolume(stemIndex: number, volume: number): void {
    if (stemIndex < 0 || stemIndex >= this.stemStates.length) return;
    const clamped = Math.max(0, Math.min(1, volume));
    this.stemStates[stemIndex].volume = clamped;
    this.stemMutedVolumes[stemIndex] = clamped;

    if (!this.stemStates[stemIndex].muted) {
      this._applyStemGain(stemIndex, clamped);
    }
  }

  toggleStemMute(stemIndex: number): void {
    if (stemIndex < 0 || stemIndex >= this.stemStates.length) return;
    const stem = this.stemStates[stemIndex];
    stem.muted = !stem.muted;

    if (stem.muted) {
      this._applyStemGain(stemIndex, 0);
    } else {
      this._applyStemGain(stemIndex, stem.volume);
    }
    this._enforceSoloState();
  }

  toggleStemSolo(stemIndex: number): void {
    if (stemIndex < 0 || stemIndex >= this.stemStates.length) return;
    this.stemStates[stemIndex].solo = !this.stemStates[stemIndex].solo;
    this._enforceSoloState();
  }

  setStemPanning(stemIndex: number, pan: number): void {
    if (stemIndex < 0 || stemIndex >= this.stemStates.length) return;
    const clamped = Math.max(-1, Math.min(1, pan));
    this.stemStates[stemIndex].panning = clamped;
    if (this.pannerNodes[stemIndex]) {
      this.pannerNodes[stemIndex].pan.setValueAtTime(clamped, this.audioContext.currentTime);
    }
  }

  setStemReverbSend(stemIndex: number, amount: number): void {
    if (stemIndex < 0 || stemIndex >= this.stemStates.length) return;
    const clamped = Math.max(0, Math.min(1, amount));
    this.stemStates[stemIndex].reverbSend = clamped;
    if (this.reverbSendNodes[stemIndex]) {
      this.reverbSendNodes[stemIndex].gain.setValueAtTime(clamped, this.audioContext.currentTime);
    }
  }

  setStemEchoSend(stemIndex: number, amount: number): void {
    if (stemIndex < 0 || stemIndex >= this.stemStates.length) return;
    const clamped = Math.max(0, Math.min(1, amount));
    this.stemStates[stemIndex].echoSend = clamped;
    if (this.echoSendNodes[stemIndex]) {
      this.echoSendNodes[stemIndex].gain.setValueAtTime(clamped, this.audioContext.currentTime);
    }
  }

  resetStems(): void {
    this.stemStates.forEach((stem, i) => {
      stem.volume = 1.0;
      stem.muted = false;
      stem.solo = false;
      this.stemMutedVolumes[i] = 1.0;
      this._applyStemGain(i, 1.0);
    });
  }

  applyStemPreset(preset: StemPreset): void {
    // Start by resetting
    this.resetStems();

    switch (preset) {
      case "karaoke": {
        const vocIdx = this.stemStates.findIndex((s) => s.type === "vocals");
        if (vocIdx !== -1) {
          this.stemStates[vocIdx].muted = true;
          this._applyStemGain(vocIdx, 0);
        }
        break;
      }
      case "a-capella": {
        const vocIdx = this.stemStates.findIndex((s) => s.type === "vocals");
        if (vocIdx !== -1) {
          this.stemStates[vocIdx].solo = true;
          this._enforceSoloState();
        }
        break;
      }
      case "drums-only": {
        const dIdx = this.stemStates.findIndex((s) => s.type === "drums");
        if (dIdx !== -1) {
          this.stemStates[dIdx].solo = true;
          this._enforceSoloState();
        }
        break;
      }
      case "bass-only": {
        const bIdx = this.stemStates.findIndex((s) => s.type === "bass");
        if (bIdx !== -1) {
          this.stemStates[bIdx].solo = true;
          this._enforceSoloState();
        }
        break;
      }
      case "full-mix":
      default:
        break;
    }
  }

  /** Apply the effective gain to a track, respecting solo state */
  private _applyStemGain(index: number, value: number): void {
    this.trackVolumes[index] = value;
    if (this.gainNodes[index]) {
      this.gainNodes[index].gain.setValueAtTime(
        value,
        this.audioContext.currentTime,
      );
    }
  }

  /** When any stem has solo enabled, mute all non-solo and non-muted stems */
  private _enforceSoloState(): void {
    const anySolo = this.stemStates.some((s) => s.solo);
    this.stemStates.forEach((stem, i) => {
      if (anySolo) {
        if (stem.solo && !stem.muted) {
          this._applyStemGain(i, stem.volume);
        } else {
          this._applyStemGain(i, 0);
        }
      } else {
        // No solo active → respect mute state
        this._applyStemGain(i, stem.muted ? 0 : stem.volume);
      }
    });
  }

  /** Returns current RMS / Peak levels for each stem (0.0 to 1.0) */
  getStemLevels(): number[] {
    if (!this.isPlaying) return this.trackVolumes.map(() => 0);

    return this.stemAnalysers.map((analyser) => {
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(dataArray);

      // Calculate peak level from time domain data
      let max = 128;
      for (let i = 0; i < dataArray.length; i++) {
        const val = Math.abs(dataArray[i] - 128);
        if (val > max - 128) max = val + 128;
      }
      return (max - 128) / 128;
    });
  }

  // ─── Deprecated ScriptProcessor path ───────────────────────────

  private handleAudioProcess(_e: AudioProcessingEvent): void {
    if (!this.isPlaying) return;

    const outputL = _e.outputBuffer.getChannelData(0);
    const outputR = _e.outputBuffer.getChannelData(1);

    const generatedL = new Float32Array(BUFFER_SIZE);
    const generatedR = new Float32Array(BUFFER_SIZE);
    let generatedCount = 0;

    let loopCount = 0;
    const maxLoops = 20;

    // Consume leftover samples
    if (
      this.leftoverLeft &&
      this.leftoverRight &&
      this.leftoverIndex < this.leftoverLeft.length
    ) {
      const leftoverAvailable = this.leftoverLeft.length - this.leftoverIndex;
      const toCopy = Math.min(leftoverAvailable, BUFFER_SIZE);

      for (let k = 0; k < toCopy; k++) {
        generatedL[k] = this.leftoverLeft[this.leftoverIndex + k];
        generatedR[k] = this.leftoverRight[this.leftoverIndex + k];
      }
      generatedCount += toCopy;
      this.leftoverIndex += toCopy;

      if (this.leftoverIndex >= this.leftoverLeft.length) {
        this.leftoverLeft = null;
        this.leftoverRight = null;
        this.leftoverIndex = 0;
      }
    }

    while (generatedCount < BUFFER_SIZE && loopCount < maxLoops) {
      loopCount++;
      const feedSize = BUFFER_SIZE;
      const tempo = this.effects.getTempo();
      const effectiveDuration = this.getDuration() / tempo;

      if (this.playHead >= effectiveDuration * this.audioContext.sampleRate)
        break;

      const inputL = new Float32Array(feedSize);
      const inputR = new Float32Array(feedSize);
      let activeTracks = 0;

      for (let i = 0; i < this.audioBuffers.length; i++) {
        const buffer = this.audioBuffers[i];
        const vol = this.trackVolumes[i];
        if (vol > 0 && buffer && this.playHead < buffer.length) {
          activeTracks++;
          const chL = buffer.getChannelData(0);
          const chR =
            buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : chL;
          for (let s = 0; s < feedSize; s++) {
            const idx = this.playHead + s;
            if (idx < buffer.length) {
              inputL[s] += chL[idx] * vol;
              inputR[s] += chR[idx] * vol;
            }
          }
        }
      }

      // Voice track
      if (
        this.voiceBuffer &&
        this.voiceVolume > 0 &&
        this.playHead < this.voiceBuffer.length
      ) {
        activeTracks++;
        const chL = this.voiceBuffer.getChannelData(0);
        const chR =
          this.voiceBuffer.numberOfChannels > 1
            ? this.voiceBuffer.getChannelData(1)
            : chL;
        for (let s = 0; s < feedSize; s++) {
          const idx = this.playHead + s;
          if (idx < this.voiceBuffer.length) {
            inputL[s] += chL[idx] * this.voiceVolume;
            inputR[s] += chR[idx] * this.voiceVolume;
          }
        }
      }

      this.playHead += Math.floor(feedSize / tempo);

      const processed = this.effects.processor.process(inputL, inputR);

      if (processed) {
        const available = processed.left.length;
        const needed = BUFFER_SIZE - generatedCount;
        const toCopy = Math.min(available, needed);

        for (let k = 0; k < toCopy; k++) {
          generatedL[generatedCount + k] = processed.left[k];
          generatedR[generatedCount + k] = processed.right[k];
        }
        generatedCount += toCopy;

        if (available > needed) {
          const excessCount = available - needed;
          this.leftoverLeft = new Float32Array(excessCount);
          this.leftoverRight = new Float32Array(excessCount);
          this.leftoverIndex = 0;
          for (let k = 0; k < excessCount; k++) {
            this.leftoverLeft[k] = processed.left[needed + k];
            this.leftoverRight[k] = processed.right[needed + k];
          }
        }
      }

      if (activeTracks === 0 && generatedCount < BUFFER_SIZE) {
        if (!this.leftoverLeft && !this.leftoverRight) {
          this.stop();
          this.events.emit("ended");
          break;
        }
      }
    }

    outputL.set(generatedL);
    outputR.set(generatedR);
  }

  // ─── Dispose ───────────────────────────────────────────────────

  dispose(): void {
    this.stop();
    this.events.dispose();
    this.effects.dispose();
    this.audioBuffers = [];
  }
}
