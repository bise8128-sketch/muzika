import { VoiceTransformSettings, HarmonyVoice } from '@/types/audio';

// Helper to load Tone.js dynamically
async function loadTone() {
    return await import('tone');
}

export class FormantShifter {
    private shifter: any;
    private filter: any;
    private gain: any;
    public bypass: boolean = false;
    private Tone: any;

    constructor() {
        // Initialization moved to init()
    }

    async init(Tone: any) {
        this.Tone = Tone;
        this.shifter = new Tone.PitchShift({
            pitch: 0,
            windowSize: 0.1,
            delayTime: 0,
            feedback: 0
        });

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
    connect(destination: any) {
        if (this.gain) this.gain.connect(destination);
    }

    // Input node to connect sources to
    get input(): any {
        return this.shifter;
    }

    setShift(semitones: number) {
        if (this.shifter) this.shifter.pitch = semitones;
    }

    setFormantFactor(factor: number) {
        if (!this.filter) return;
        
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
        if (!this.gain || !this.shifter) return;

        if (bypass) {
            this.shifter.disconnect();
            this.gain.disconnect(); 
            this.gain.gain.value = 0;
        } else {
             this.gain.gain.value = 1;
        }
    }

    dispose() {
        if (this.shifter) this.shifter.dispose();
        if (this.filter) this.filter.dispose();
        if (this.gain) this.gain.dispose();
    }
}

export class HarmonyGenerator {
    private voices: Map<string, { shifter: any, gain: any, panner: any }> = new Map();
    private output: any;
    private input: any;
    private Tone: any;

    constructor() {
    }

    async init(Tone: any) {
        this.Tone = Tone;
        this.input = new Tone.Gain(1);
        this.output = new Tone.Gain(1);
    }

    updateHarmonies(harmonySettings: HarmonyVoice[]) {
        if (!this.Tone || !this.input) return;
        const Tone = this.Tone;

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
                const panner = new Tone.Panner(setting.pan); 

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
        return `${setting.interval}_${setting.volume}`; 
    }
    
    connect(destination: any) {
        if (this.output) this.output.connect(destination);
    }
    
    getInput(): any {
        return this.input;
    }

    dispose() {
        this.voices.forEach(nodes => {
            nodes.shifter.dispose();
            nodes.gain.dispose();
            nodes.panner.dispose();
        });
        this.voices.clear();
        if (this.input) this.input.dispose();
        if (this.output) this.output.dispose();
    }
}

export class VoiceProcessor {
    private input: any; // Tone.UserMedia
    private output: any; // Tone.Gain
    private recordingDest: MediaStreamAudioDestinationNode | null = null; 
    
    // Effects
    private formantShifter: FormantShifter;
    private harmonyGenerator: HarmonyGenerator;
    private reverb: any;
    private delay: any;
    private compressor: any;
    
    // Internal routing
    private dryGain: any;
    private wetGain: any;
    
    private isInitialized: boolean = false;
    private Tone: any;

    constructor() {
        this.formantShifter = new FormantShifter();
        this.harmonyGenerator = new HarmonyGenerator();
    }

    async init() {
        if (this.isInitialized) return;
        
        const Tone = await loadTone();
        this.Tone = Tone;

        this.input = new Tone.UserMedia();
        this.output = new Tone.Gain(1);
        
        // Create recording destination from raw context
        const context = Tone.getContext().rawContext as AudioContext;
        this.recordingDest = context.createMediaStreamDestination();

        // Initialize effects
        await this.formantShifter.init(Tone);
        await this.harmonyGenerator.init(Tone);
        
        this.reverb = new Tone.Reverb({
            decay: 1.5,
            preDelay: 0.01,
            wet: 0 
        });
        
        this.delay = new Tone.FeedbackDelay({
            delayTime: 0.25,
            feedback: 0.3,
            wet: 0 
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
        this.input.connect(this.compressor);
        this.compressor.connect(this.dryGain);
        this.compressor.connect(this.formantShifter.input);
        
        this.formantShifter.connect(this.harmonyGenerator.getInput());
        this.harmonyGenerator.connect(this.delay);
        this.delay.connect(this.reverb);
        this.reverb.connect(this.wetGain);

        this.dryGain.connect(this.output);
        this.wetGain.connect(this.output);
        
        this.dryGain.connect(this.recordingDest);
        this.wetGain.connect(this.recordingDest);
        
        this.output.toDestination();
        this.output.gain.value = 0; 

        this.isInitialized = true;
    }

    async openMicrophone(): Promise<void> {
        if (!this.isInitialized) {
            await this.init();
        }
        
        if (this.input && this.input.state !== 'started') {
            await this.input.open();
        }
    }

    closeMicrophone() {
        if (this.input && this.input.state === 'started') {
            this.input.close();
        }
    }

    getProcessedStream(): MediaStream | null {
        return this.recordingDest ? this.recordingDest.stream : null;
    }

    applySettings(settings: VoiceTransformSettings) {
        if (!this.isInitialized) return;

        this.formantShifter.setShift(settings.pitchShift);
        this.formantShifter.setFormantFactor(settings.formantShift);
        this.harmonyGenerator.updateHarmonies(settings.harmonies);
        
        if (this.reverb) {
            this.reverb.wet.value = settings.reverbMix;
            this.reverb.decay = 1.5 + (settings.reverbMix * 2);
        }
        
        if (settings.preset === 'original') {
            this.dryGain.gain.rampTo(1, 0.1);
            this.wetGain.gain.rampTo(0, 0.1);
        } else {
            this.dryGain.gain.rampTo(0.2, 0.1); 
            this.wetGain.gain.rampTo(1, 0.1);
        }
        
        if (settings.preset === 'robot') {
            this.dryGain.gain.rampTo(0, 0.1);
        }
    }

    setMonitoring(enabled: boolean) {
        if (this.output) {
            this.output.gain.rampTo(enabled ? 1 : 0, 0.1);
        }
    }
    
    setPreampGain(value: number) {
        if (this.compressor) {
            // Use compressor make-up gain for preamp effect
            // Mapping value (0-1) to reasonable makeup gain (0-20dB)
            this.compressor.makeup.rampTo(value * 20, 0.1);
        }
    }

    dispose() {
        if (this.input) this.input.dispose();
        if (this.output) this.output.dispose();
        this.formantShifter.dispose();
        this.harmonyGenerator.dispose();
        if (this.reverb) this.reverb.dispose();
        if (this.delay) this.delay.dispose();
        if (this.compressor) this.compressor.dispose();
        if (this.dryGain) this.dryGain.dispose();
        if (this.wetGain) this.wetGain.dispose();
    }
}
