import * as Tone from 'tone';
import { HarmonyVoice } from '@/types/audio';

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
                const gain = new Tone.Gain(setting.gain);
                const panner = new Tone.Panner(0); // Center by default

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
                nodes.gain.gain.value = setting.gain;
            }
        });
    }

    private getVoiceId(setting: HarmonyVoice): string {
        return `${setting.interval}_${setting.gain}`; // Simple ID
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
