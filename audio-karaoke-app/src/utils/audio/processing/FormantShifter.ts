import * as Tone from 'tone';

export class FormantShifter {
    private shifter: Tone.PitchShift;
    private filter: Tone.Filter;
    private gain: Tone.Gain;
    private bypass: boolean = false;

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
