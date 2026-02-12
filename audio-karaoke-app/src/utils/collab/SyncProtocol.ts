/**
 * SyncProtocol — WebSocket client for Collaborative Karaoke Rooms.
 *
 * Handles connection, message serialization/deserialization,
 * heartbeat, and state synchronization.
 */

import {
    SyncMessage,
    SyncMessageType,
    Room,
    RoomParticipant,
    RoomPlaybackState
} from '@/types/room';

export interface SyncClientConfig {
    url: string;
    roomId: string;
    participantId: string;
    displayName: string;
    onMessage: (message: SyncMessage) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
}

export class SyncClient {
    private ws: WebSocket | null = null;
    private config: SyncClientConfig;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private reconnectAttempts = 0;
    private isExplicitlyClosed = false;

    constructor(config: SyncClientConfig) {
        this.config = config;
    }

    connect() {
        this.isExplicitlyClosed = false;
        try {
            // Construct WS URL
            // Ensure we use the correct protocol (ws:// or wss://)
            const wsUrl = new URL(this.config.url);
            wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
            
            // Append path params
            const fullUrl = `${wsUrl.toString()}/ws/rooms/${this.config.roomId}/${this.config.participantId}?name=${encodeURIComponent(this.config.displayName)}`;
            
            this.ws = new WebSocket(fullUrl);

            this.ws.onopen = () => {
                console.log('[SyncClient] Connected');
                this.reconnectAttempts = 0;
                this.startHeartbeat();
                this.config.onConnect?.();
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data) as SyncMessage;
                    this.config.onMessage(message);
                } catch (err) {
                    console.error('[SyncClient] Failed to parse message:', err);
                }
            };

            this.ws.onclose = () => {
                console.log('[SyncClient] Disconnected');
                this.stopHeartbeat();
                this.config.onDisconnect?.();
                
                if (!this.isExplicitlyClosed) {
                    this.attemptReconnect();
                }
            };

            this.ws.onerror = (err) => {
                console.error('[SyncClient] Error:', err);
            };

        } catch (err) {
            console.error('[SyncClient] Connection error:', err);
            this.attemptReconnect();
        }
    }

    private attemptReconnect() {
        if (this.reconnectAttempts > 5) {
            console.error('[SyncClient] Max reconnect attempts reached');
            return;
        }

        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
        console.log(`[SyncClient] Reconnecting in ${delay}ms...`);
        
        setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
        }, delay);
    }

    private startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatInterval = setInterval(() => {
            this.send({
                type: 'heartbeat',
                senderId: this.config.participantId,
                timestamp: Date.now()
            });
        }, 5000); // 5s heartbeat
    }

    private stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    send(message: Omit<SyncMessage, 'timestamp'>) { // Timestamp added here or server? Added here for now
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const fullMessage = {
                ...message,
                timestamp: Date.now()
            };
            this.ws.send(JSON.stringify(fullMessage));
        }
    }

    sendPlaybackUpdate(payload: Partial<RoomPlaybackState>) {
        this.send({
            type: 'playback-update',
            senderId: this.config.participantId,
            timestamp: Date.now(), // Typescript helper
            payload
        } as any);
    }

    sendChat(text: string) {
        this.send({
            type: 'chat',
            senderId: this.config.participantId,
            timestamp: Date.now(),
            payload: { text }
        } as any);
    }

    disconnect() {
        this.isExplicitlyClosed = true;
        this.stopHeartbeat();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
