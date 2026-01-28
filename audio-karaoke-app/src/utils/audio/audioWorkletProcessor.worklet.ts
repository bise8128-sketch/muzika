/**
 * AudioWorklet processor for real-time audio effects
 * This file is loaded in the AudioWorklet context
 */

import { GenericAudioProcessor } from './audioWorkletProcessor';

// Declare the registerProcessor function available in the AudioWorklet context
declare function registerProcessor(name: string, processor: any): void;

// Register the processor in the AudioWorklet context
registerProcessor('generic-audio-processor', GenericAudioProcessor);
