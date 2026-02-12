import * as Tone from 'tone';
import { VoiceTransformSettings } from '@/types/audio';
import { FormantShifter } from './FormantShifter';
import { HarmonyGenerator } from './HarmonyGenerator';

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
