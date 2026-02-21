'use client';

/**
 * useKaraokeRoom — Hook for managing collaborative karaoke sessions.
 *
 * Connects to the WebSocket server via SyncClient.
 * Synchronizes local PlaybackController with room state.
 * Manages participant list and chat messages.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { SyncClient } from '@/utils/collab/SyncProtocol';
import type { PlaybackController } from '@/utils/audio/playback/PlaybackCore';
import type { Room, RoomParticipant, ChatMessage, SyncMessage } from '@/types/room';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

interface UseKaraokeRoomReturn {
    // State
    isConnected: boolean;
    room: Room | null;
    participants: RoomParticipant[];
    messages: ChatMessage[];
    isHost: boolean;
    currentUser: RoomParticipant | null;
    
    // Actions
    joinRoom: (roomId: string, displayName: string) => void;
    leaveRoom: () => void;
    sendChat: (text: string) => void;
    
    // Playback Sync (called by UI/Controller events)
    syncPlayback: (state: { isPlaying: boolean; currentTime: number; songId?: string }) => void;
}

export function useKaraokeRoom(controller: PlaybackController | null): UseKaraokeRoomReturn {
    const [isConnected, setIsConnected] = useState(false);
    const [room, setRoom] = useState<Room | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [participants, setParticipants] = useState<RoomParticipant[]>([]);
    const [currentUser, setCurrentUser] = useState<RoomParticipant | null>(null);

    const clientRef = useRef<SyncClient | null>(null);
    const userIdRef = useRef<string>(`user-${Math.random().toString(36).substr(2, 9)}`);

    // Sync incoming playback updates to local controller
    const handlePlaybackUpdate = useCallback((payload: any) => {
        if (!controller) return;

        // Only apply if we are NOT the host (host is the source of truth)
        // Or if the update comes from the host
        const isHost = room?.hostId === userIdRef.current;
        if (isHost) return; 

        const currentSongId = controller.getSongId();
        if (payload.songId && payload.songId !== currentSongId) {
            // Song change logic would go here (requires loading new song)
            // For now, we assume same song is loaded or ignore
            console.warn('Room song mismatch. Expected:', currentSongId, 'Got:', payload.songId);
        }

        if (typeof payload.isPlaying === 'boolean') {
            if (payload.isPlaying && !controller.getIsPlaying()) {
                controller.play();
            } else if (!payload.isPlaying && controller.getIsPlaying()) {
                controller.pause();
            }
        }

        if (typeof payload.currentTime === 'number') {
            const drift = Math.abs(controller.getCurrentTime() - payload.currentTime);
            // Only seek if drift is significant (> 0.5s) to avoid jitter
            if (drift > 0.5) {
                controller.setCurrentTime(payload.currentTime);
            }
        }
        
        if (typeof payload.tempo === 'number') {
            controller.setTempo(payload.tempo);
        }
    }, [controller, room]);

    const handleMessage = useCallback((msg: SyncMessage) => {
        switch (msg.type) {
            case 'room-state':
                setRoom(msg.payload.room);
                setParticipants(msg.payload.room.participants);
                // Determine if we are host
                if (msg.payload.room.hostId === userIdRef.current) {
                    // We are host
                }
                break;
            case 'join':
                setParticipants(prev => {
                    if (prev.find(p => p.id === msg.payload.participant.id)) return prev;
                    return [...prev, msg.payload.participant];
                });
                setMessages(prev => [...prev, {
                    type: 'chat',
                    senderId: 'system',
                    timestamp: msg.timestamp,
                    payload: { text: `${msg.payload.participant.displayName} joined the room`, system: true }
                } as ChatMessage]);
                break;
            case 'leave':
                setParticipants(prev => prev.filter(p => p.id !== msg.payload.participantId));
                setMessages(prev => [...prev, {
                    type: 'chat',
                    senderId: 'system',
                    timestamp: msg.timestamp,
                    payload: { text: `User left the room`, system: true }
                } as ChatMessage]);
                break;
            case 'chat':
                setMessages(prev => [...prev, msg]);
                break;
            case 'playback-update':
                handlePlaybackUpdate(msg.payload);
                break;
        }
    }, [handlePlaybackUpdate]);

    const joinRoom = useCallback((roomId: string, displayName: string) => {
        if (clientRef.current) {
            clientRef.current.disconnect();
        }

        const client = new SyncClient({
            url: WS_URL,
            roomId,
            participantId: userIdRef.current,
            displayName,
            onConnect: () => setIsConnected(true),
            onDisconnect: () => setIsConnected(false),
            onMessage: handleMessage
        });

        client.connect();
        clientRef.current = client;
        setCurrentUser({
            id: userIdRef.current,
            displayName,
            isHost: false, // will be updated by room-state
            joinedAt: Date.now(),
            score: 0
        });
    }, [handleMessage]);

    const leaveRoom = useCallback(() => {
        if (clientRef.current) {
            clientRef.current.disconnect();
            clientRef.current = null;
        }
        setIsConnected(false);
        setRoom(null);
        setParticipants([]);
        setMessages([]);
    }, []);

    const sendChat = useCallback((text: string) => {
        clientRef.current?.sendChat(text);
    }, []);

    const syncPlayback = useCallback((state: any) => {
        // Only send updates if we are the host?
        // Or if we want to allow anyone to control?
        // Let's allow anyone for now, or check isHost
        clientRef.current?.sendPlaybackUpdate(state);
    }, []);

    // Listen to local controller events and broadcast if we are host
    useEffect(() => {
        if (!controller || !isConnected || !room) return;

        const isHost = room.hostId === userIdRef.current;
        if (!isHost) return;

        const onPlay = () => syncPlayback({ isPlaying: true, currentTime: controller.getCurrentTime() });
        const onPause = () => syncPlayback({ isPlaying: false, currentTime: controller.getCurrentTime() });
        const onSeek = () => syncPlayback({ isPlaying: controller.getIsPlaying(), currentTime: controller.getCurrentTime() });

        // Throttle time updates?
        // We probably don't want to send timeupdate every frame over WS
        // Maybe just rely on play/pause/seek + periodic sync

        controller.on('play', onPlay);
        controller.on('pause', onPause);
        // controller.on('seek', onSeek); // If PlaybackController had a seek event

        return () => {
            controller.off('play', onPlay);
            controller.off('pause', onPause);
        };
    }, [controller, isConnected, room, syncPlayback]);

    return {
        isConnected,
        room,
        participants,
        messages,
        isHost: room?.hostId === userIdRef.current,
        currentUser,
        joinRoom,
        leaveRoom,
        sendChat,
        syncPlayback
    };
}
