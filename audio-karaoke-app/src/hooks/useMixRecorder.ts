'use client';

import { useState, useRef, useCallback } from 'react';
import { getAudioContext } from '@/utils/audio/audioContext';

export const useMixRecorder = () => {
    const [isRecordingMix, setIsRecordingMix] = useState(false);
    const [recordedMixBlob, setRecordedMixBlob] = useState<Blob | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const mixDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

    const getMixDestination = useCallback(() => {
        if (!mixDestinationRef.current) {
            const ctx = getAudioContext();
            mixDestinationRef.current = ctx.createMediaStreamDestination();
        }
        return mixDestinationRef.current;
    }, []);

    const startRecordingMix = useCallback(async () => {
        try {
            const destination = getMixDestination();
            const mediaRecorder = new MediaRecorder(destination.stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setRecordedMixBlob(audioBlob);
            };

            mediaRecorder.start();
            setIsRecordingMix(true);
            setRecordedMixBlob(null); // Clear previous
        } catch (error) {
            console.error('Error starting mix recording:', error);
        }
    }, [getMixDestination]);

    const stopRecordingMix = useCallback(() => {
        if (mediaRecorderRef.current && isRecordingMix) {
            mediaRecorderRef.current.stop();
            setIsRecordingMix(false);
        }
    }, [isRecordingMix]);

    const clearMixRecording = useCallback(() => {
        setRecordedMixBlob(null);
    }, []);

    return {
        isRecordingMix,
        recordedMixBlob,
        getMixDestination,
        startRecordingMix,
        stopRecordingMix,
        clearMixRecording
    };
};
