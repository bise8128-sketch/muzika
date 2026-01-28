
declare module 'soundtouchjs' {
    export class PitchShifter {
        constructor(context: AudioContext, buffer: AudioBuffer, bufferSize: number);
        pitch: number;
        tempo: number;
        on(event: string, callback: (data: any) => void): void;
        connect(node: AudioNode): void;
        disconnect(): void;
    }
}
