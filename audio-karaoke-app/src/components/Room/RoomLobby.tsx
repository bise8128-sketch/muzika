'use client';

/**
 * RoomLobby — UI for creating or joining collaborative karaoke rooms.
 */

import React, { useState } from 'react';

interface RoomLobbyProps {
    onJoin: (roomId: string, displayName: string) => void;
    onCancel: () => void;
}

export function RoomLobby({ onJoin, onCancel }: RoomLobbyProps) {
    const [displayName, setDisplayName] = useState('');
    const [roomId, setRoomId] = useState('');
    const [mode, setMode] = useState<'create' | 'join'>('create');

    const handleCreate = () => {
        if (!displayName) return;
        // Generate random room ID
        const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        onJoin(newRoomId, displayName);
    };

    const handleJoin = () => {
        if (!displayName || !roomId) return;
        onJoin(roomId.toUpperCase(), displayName);
    };

    return (
        <div className="room-lobby">
            <h3>🎤 Collaborative Room</h3>
            
            <div className="room-lobby__form">
                <label>
                    Your Name
                    <input 
                        type="text" 
                        value={displayName} 
                        onChange={e => setDisplayName(e.target.value)}
                        placeholder="Enter your name"
                        className="room-input"
                    />
                </label>

                <div className="room-lobby__tabs">
                    <button 
                        className={mode === 'create' ? 'active' : ''} 
                        onClick={() => setMode('create')}
                    >
                        Create Room
                    </button>
                    <button 
                        className={mode === 'join' ? 'active' : ''} 
                        onClick={() => setMode('join')}
                    >
                        Join Room
                    </button>
                </div>

                {mode === 'create' ? (
                    <div className="room-lobby__action">
                        <p>Create a new room and invite your friends!</p>
                        <button 
                            onClick={handleCreate}
                            disabled={!displayName}
                            className="primary-btn"
                        >
                            Create Room
                        </button>
                    </div>
                ) : (
                    <div className="room-lobby__action">
                        <label>
                            Room Code
                            <input 
                                type="text" 
                                value={roomId} 
                                onChange={e => setRoomId(e.target.value)}
                                placeholder="e.g. ABC123"
                                className="room-input"
                            />
                        </label>
                        <button 
                            onClick={handleJoin}
                            disabled={!displayName || !roomId}
                            className="primary-btn"
                        >
                            Join Room
                        </button>
                    </div>
                )}
                
                <button onClick={onCancel} className="cancel-btn">
                    Cancel
                </button>
            </div>

            <style>{`
                .room-lobby {
                    background: rgba(20, 20, 30, 0.95);
                    padding: 2rem;
                    border-radius: 16px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    width: 100%;
                    max-width: 400px;
                    color: white;
                    backdrop-filter: blur(10px);
                }
                .room-lobby h3 { margin-top: 0; text-align: center; }
                .room-lobby__form { display: flex; flex-direction: column; gap: 1rem; }
                .room-input {
                    width: 100%;
                    padding: 0.75rem;
                    border-radius: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    background: rgba(0, 0, 0, 0.3);
                    color: white;
                    margin-top: 0.25rem;
                }
                .room-lobby__tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
                .room-lobby__tabs button {
                    flex: 1;
                    padding: 0.5rem;
                    background: transparent;
                    border: none;
                    color: rgba(255, 255, 255, 0.5);
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                }
                .room-lobby__tabs button.active {
                    color: white;
                    border-bottom-color: #8b5cf6;
                }
                .primary-btn {
                    width: 100%;
                    padding: 0.75rem;
                    background: #8b5cf6;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-weight: bold;
                    cursor: pointer;
                }
                .cancel-btn {
                    width: 100%;
                    padding: 0.5rem;
                    background: transparent;
                    color: rgba(255, 255, 255, 0.6);
                    border: none;
                    cursor: pointer;
                }
            `}</style>
        </div>
    );
}
