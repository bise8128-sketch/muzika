'use client';

import { useState, useRef, useCallback } from 'react';
import { getAudioContext } from '@/utils/audio/audioContext';

export const useVoiceRecorder = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordedBuffer, setRecordedBuffer] = useState<AudioBuffer | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                const arrayBuffer = await audioBlob.arrayBuffer();
                const audioContext = getAudioContext();
                const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
                setRecordedBuffer(decodedBuffer);

                // Stop original stream
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (error) {
            console.error('Error starting recording:', error);
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    }, [isRecording]);

    const clearRecording = useCallback(() => {
        setRecordedBuffer(null);
    }, []);

    return {
        isRecording,
        recordedBuffer,
        startRecording,
        stopRecording,
        clearRecording
    };
};
