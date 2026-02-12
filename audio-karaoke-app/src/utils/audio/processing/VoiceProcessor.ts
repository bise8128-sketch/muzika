import * as Tone from 'tone';
import { VoiceTransformSettings, HarmonyVoice } from '@/types/audio';

export class FormantShifter {
    private shifter: Tone.PitchShift;
    private filter: Tone.Filter;
    private gain: Tone.Gain;
    public bypass: boolean = false;

    constructor() {
        this.shifter = new Tone.PitchShift({
            pitch: 0,
            windowSize: 0.1,
            delayTime: 0,
            feedback: 0
        });

        // Formant filter attempt - using a peaking filter to emphasize/de-emphasize certain frequencies
        // True formant shifting requires more complex DSP (e.g. LPC), but for MVP we use EQ + Pitch Shift
        this.filter = new Tone.Filter({
            type: "peaking",
            frequency: 1000,
            Q: 1,
            gain: 0
        });

        this.gain = new Tone.Gain(1);

        // Chain: Input -> Shifter -> Filter -> Gain -> Output
        this.shifter.connect(this.filter);
        this.filter.connect(this.gain);
    }

    // Connect to an audio node
    connect(destination: Tone.InputNode) {
        this.gain.connect(destination);
    }

    // Input node to connect sources to
    get input(): Tone.InputNode {
        return this.shifter;
    }

    setShift(semitones: number) {
        this.shifter.pitch = semitones;
    }

    setFormantFactor(factor: number) {
        // factor 1.0 = normal
        // factor > 1.0 = brighter/child-like (shift formants up)
        // factor < 1.0 = darker/deeper (shift formants down)
        
        // Simple simulation:
        // Use pitch shifting to change fundamental frequency
        // Then try to "correct" formants or apply EQ to simulate
        
        // For distinct "Robot" or "Alien" effects, we might use RingModulator or other effects
        // But here we focus on simple "formant-like" timbral changes via EQ
        
        if (factor > 1.0) {
            // Emphasize highs, cut lows
            this.filter.frequency.value = 2500;
            this.filter.gain.value = (factor - 1) * 10; 
        } else {
             // Emphasize lows, cut highs
            this.filter.frequency.value = 400;
            this.filter.gain.value = (1 - factor) * 10;
        }
    }
    
    setBypass(bypass: boolean) {
        this.bypass = bypass;
        if (bypass) {
            this.shifter.disconnect();
            this.gain.disconnect(); 
            // This logic is tricky with Tone.js connections. 
            // Better to use a CrossFade or gain automation.
            // For MVP, we'll just set gain to 0 or 1.
            this.gain.gain.value = 0;
        } else {
             this.gain.gain.value = 1;
        }
    }

    dispose() {
        this.shifter.dispose();
        this.filter.dispose();
        this.gain.dispose();
    }
}

export class HarmonyGenerator {
    private voices: Map<string, { shifter: Tone.PitchShift, gain: Tone.Gain, panner: Tone.Panner }> = new Map();
    private output: Tone.Gain;
    private input: Tone.Gain;

    constructor() {
        this.input = new Tone.Gain(1);
        this.output = new Tone.Gain(1);
    }

    updateHarmonies(harmonySettings: HarmonyVoice[]) {
        // Remove unused voices
        const activeIds = new Set(harmonySettings.map(h => this.getVoiceId(h)));
        for (const [id, nodes] of this.voices) {
            if (!activeIds.has(id)) {
                nodes.shifter.dispose();
                nodes.gain.dispose();
                nodes.panner.dispose();
                this.voices.delete(id);
            }
        }

        // Add or update voices
        harmonySettings.forEach(setting => {
            const id = this.getVoiceId(setting);
            let nodes = this.voices.get(id);

            if (!nodes) {
                const shifter = new Tone.PitchShift({
                    pitch: setting.interval,
                    windowSize: 0.1,
                    delayTime: 0,
                    feedback: 0
                });
                const gain = new Tone.Gain(setting.volume);
                const panner = new Tone.Panner(setting.pan); // Use setting.pan

                // Chain: Input -> Shifter -> Gain -> Panner -> Output
                this.input.connect(shifter);
                shifter.connect(gain);
                gain.connect(panner);
                panner.connect(this.output);

                nodes = { shifter, gain, panner };
                this.voices.set(id, nodes);
            } else {
                // Update implementation
                nodes.shifter.pitch = setting.interval;
                nodes.gain.gain.value = setting.volume;
                nodes.panner.pan.value = setting.pan;
            }
        });
    }

    private getVoiceId(setting: HarmonyVoice): string {
        return `${setting.interval}_${setting.volume}`; // ID based on interval and volume
    }
    
    connect(destination: Tone.InputNode) {
        this.output.connect(destination);
    }
    
    getInput(): Tone.InputNode {
        return this.input;
    }

    dispose() {
        this.voices.forEach(nodes => {
            nodes.shifter.dispose();
            nodes.gain.dispose();
            nodes.panner.dispose();
        });
        this.voices.clear();
        this.input.dispose();
        this.output.dispose();
    }
}

export class VoiceProcessor {
    private input: Tone.UserMedia;
    private output: Tone.Gain; // To speakers (monitoring)
    private recordingDest: MediaStreamAudioDestinationNode; // To recorder
    
    // Effects
    private formantShifter: FormantShifter;
    private harmonyGenerator: HarmonyGenerator;
    private reverb: Tone.Reverb;
    private delay: Tone.FeedbackDelay;
    private compressor: Tone.Compressor;
    
    // Internal routing
    private dryGain: Tone.Gain;
    private wetGain: Tone.Gain;
    
    private isInitialized: boolean = false;

    constructor() {
        this.input = new Tone.UserMedia();
        this.output = new Tone.Gain(1);
        
        // Create recording destination from raw context
        const context = Tone.getContext().rawContext as AudioContext;
        this.recordingDest = context.createMediaStreamDestination();

        // Initialize effects
        this.formantShifter = new FormantShifter();
        this.harmonyGenerator = new HarmonyGenerator();
        
        this.reverb = new Tone.Reverb({
            decay: 1.5,
            preDelay: 0.01,
            wet: 0 // Controlled by settings
        });
        
        this.delay = new Tone.FeedbackDelay({
            delayTime: 0.25,
            feedback: 0.3,
            wet: 0 // Controlled by settings
        });

        this.compressor = new Tone.Compressor({
            threshold: -20,
            ratio: 4,
            attack: 0.005,
            release: 0.1
        });

        this.dryGain = new Tone.Gain(1);
        this.wetGain = new Tone.Gain(1);

        // Routing Graph
        // Input -> Compressor -> [Dry/Wet Split]
        
        // Dry Path: Input -> DryGain -> Output/Rec
        
        // Wet Path: Input -> FormantShifter -> HarmonyGenerator -> Delay -> Reverb -> WetGain -> Output/Rec
        
        // Connect Input to Compressor
        this.input.connect(this.compressor);

        // Connect Compressor to Dry/Wet split
        this.compressor.connect(this.dryGain);
        this.compressor.connect(this.formantShifter.input);
        
        // Effects Chain
        this.formantShifter.connect(this.harmonyGenerator.getInput());
        this.harmonyGenerator.connect(this.delay);
        this.delay.connect(this.reverb);
        this.reverb.connect(this.wetGain);

        // Connect both paths to Output (Monitoring) and Recording Dest
        this.dryGain.connect(this.output);
        this.wetGain.connect(this.output);
        
        // We need to connect Tone nodes to the explicit MediaStreamDestination
        // Tone.connect(node, destination)
        this.dryGain.connect(this.recordingDest);
        this.wetGain.connect(this.recordingDest);
        
        // Output to Master (Monitoring) - muted by default to prevent feedback if not desired
        this.output.toDestination();
        this.output.gain.value = 0; // Default mute monitoring
    }

    async openMicrophone(): Promise<void> {
        if (this.input.state === 'started') return;
        await this.input.open();
        this.isInitialized = true;
    }

    closeMicrophone() {
        if (this.input.state === 'started') {
            this.input.close();
        }
    }

    getProcessedStream(): MediaStream {
        return this.recordingDest.stream;
    }

    applySettings(settings: VoiceTransformSettings) {
        // Preset loading handled by caller or we can do it here.
        // Assuming settings are fully populated with derived values.
        
        // 1. Pitch & Formant
        this.formantShifter.setShift(settings.pitchShift);
        this.formantShifter.setFormantFactor(settings.formantShift);
        
        // 2. Harmonies
        this.harmonyGenerator.updateHarmonies(settings.harmonies);
        
        // 3. Spatial Effects
        this.reverb.wet.value = settings.reverbMix;
        this.reverb.decay = 1.5 + (settings.reverbMix * 2); // Dynamic decay based on mix
        
        // 4. Robot Effect (using short delay/feedback or RingMod if available, currently just pitch fix)
        // If robot mode, we might want to set pitch shift to 0 feedback? 
        // For MVP, "Robot" is just a hard-tuned formant shift usually.
        
        // 5. Dry/Wet Mix
        // If we want fully wet (voice transform), dry should be low.
        // Usually transforms retain some dry, but for "Robot", maybe 0 dry.
        
        if (settings.preset === 'original') {
            this.dryGain.gain.rampTo(1, 0.1);
            this.wetGain.gain.rampTo(0, 0.1);
        } else {
            // For effects, mix logic
            this.dryGain.gain.rampTo(0.2, 0.1); // Keep a bit of dry for definition? Or 0 for total transform
            this.wetGain.gain.rampTo(1, 0.1);
        }
        
        // Handle specific presets if needed logic beyond params
        if (settings.preset === 'robot') {
            this.dryGain.gain.rampTo(0, 0.1);
        }
    }

    setMonitoring(enabled: boolean) {
        this.output.gain.rampTo(enabled ? 1 : 0, 0.1);
    }
    
    setPreampGain(_value: number) {
        // Input gain not directly on UserMedia, but we can add a pre-gain node if needed.
        // For now, assume hardware gain / normalization.
    }

    dispose() {
        this.input.dispose();
        this.output.dispose();
        this.formantShifter.dispose();
        this.harmonyGenerator.dispose();
        this.reverb.dispose();
        this.delay.dispose();
        this.compressor.dispose();
        this.dryGain.dispose();
        this.wetGain.dispose();
    }
}
