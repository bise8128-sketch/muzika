
declare module 'soundtouchjs' {
    export class PitchShifter {
        constructor(sampleRate: number, length: number, channels: number);
        pitch: number;
        tempo: number;
        process(input: any): any;
        flush(): any;
        on(event: string, callback: (data: any) => void): void;
        connect(node: AudioNode): void;
        disconnect(): void;
    }
}
