/**
 * Types for Collaborative Karaoke Rooms
 */

export interface RoomParticipant {
    id: string;
    displayName: string;
    isHost: boolean;
    joinedAt: number;
    score: number;
    avatar?: string;
}

export interface RoomPlaybackState {
    isPlaying: boolean;
    currentTime: number;
    songId: string | null;
    tempo: number;
    pitch: number;
    updatedAt: number; // timestamp of last update for drift calculation
}

export interface Room {
    id: string;
    name: string;
    hostId: string; // matches RoomParticipant.id
    participants: RoomParticipant[];
    playbackState: RoomPlaybackState;
    createdAt: number;
}

// ─── Sync Protocol Messages ─────────────────────────────────────────

export type SyncMessageType =
    | 'join'
    | 'leave'
    | 'chat'
    | 'playback-update' // play, pause, seek, tempo, pitch
    | 'room-state'     // initial state sync
    | 'heartbeat';

export interface BaseSyncMessage {
    type: SyncMessageType;
    senderId: string;
    timestamp: number;
}

export interface JoinMessage extends BaseSyncMessage {
    type: 'join';
    payload: {
        participant: RoomParticipant;
    };
}

export interface LeaveMessage extends BaseSyncMessage {
    type: 'leave';
    payload: {
        participantId: string;
    };
}

export interface ChatMessage extends BaseSyncMessage {
    type: 'chat';
    payload: {
        text: string;
        system?: boolean; // system notification vs user message
    };
}

export interface PlaybackUpdateMessage extends BaseSyncMessage {
    type: 'playback-update';
    payload: Partial<RoomPlaybackState>;
}

export interface RoomStateMessage extends BaseSyncMessage {
    type: 'room-state';
    payload: {
        room: Room;
    };
}

export interface HeartbeatMessage extends BaseSyncMessage {
    type: 'heartbeat';
}

export type SyncMessage =
    | JoinMessage
    | LeaveMessage
    | ChatMessage
    | PlaybackUpdateMessage
    | RoomStateMessage
    | HeartbeatMessage;
