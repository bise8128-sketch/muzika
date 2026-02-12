'use client';

/**
 * RoomView — In-room UI showing participants, chat, and sync status.
 */

import React, { useState, useEffect, useRef } from 'react';
import type { Room, RoomParticipant, ChatMessage } from '@/types/room';

interface RoomViewProps {
    room: Room;
    participants: RoomParticipant[];
    messages: ChatMessage[];
    currentUser: RoomParticipant | null;
    isHost: boolean;
    onLeave: () => void;
    onSendMessage: (text: string) => void;
}

export function RoomView({ 
    room, 
    participants, 
    messages, 
    currentUser, 
    isHost, 
    onLeave, 
    onSendMessage 
}: RoomViewProps) {
    const [newMessage, setNewMessage] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newMessage.trim()) return;
        onSendMessage(newMessage);
        setNewMessage('');
    };

    return (
        <div className="room-view">
            <div className="room-header">
                <div className="room-info">
                    <h4>Room: {room.id}</h4>
                    <span className="status-badge">Connected</span>
                </div>
                <button onClick={onLeave} className="leave-btn">Leave</button>
            </div>

            <div className="room-content">
                <div className="participants-list">
                    <h5>Participants ({participants.length})</h5>
                    <ul>
                        {participants.map(p => (
                            <li key={p.id} className={p.id === currentUser?.id ? 'me' : ''}>
                                <span className="avatar">{p.displayName[0]}</span>
                                <span className="name">{p.displayName}</span>
                                {p.isHost && <span className="host-badge">👑</span>}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="chat-area">
                    <div className="messages">
                        {messages.map((msg, i) => (
                            <div key={i} className={`message ${msg.senderId === 'system' ? 'system' : ''}`}>
                                {msg.senderId !== 'system' && (
                                    <span className="author">
                                        {participants.find(p => p.id === msg.senderId)?.displayName || 'Unknown'}:
                                    </span>
                                )}
                                <span className="text">{msg.payload.text || 'Joined/Left'}</span>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                    <form onSubmit={handleSend} className="chat-input">
                        <input 
                            type="text" 
                            value={newMessage} 
                            onChange={e => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                        />
                        <button type="submit">Send</button>
                    </form>
                </div>
            </div>

            <style>{`
                .room-view {
                    position: absolute;
                    top: 80px;
                    right: 20px;
                    width: 320px;
                    height: 500px;
                    background: rgba(20, 20, 30, 0.95);
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    display: flex;
                    flex-direction: column;
                    backdrop-filter: blur(10px);
                    color: white;
                    overflow: hidden;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    z-index: 100;
                }
                .room-header {
                    padding: 1rem;
                    background: rgba(255, 255, 255, 0.05);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .room-info h4 { margin: 0; font-size: 0.9rem; }
                .status-badge { font-size: 0.7rem; color: #4ade80; }
                .leave-btn {
                    padding: 0.25rem 0.5rem;
                    background: rgba(239, 68, 68, 0.2);
                    color: #fca5a5;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.75rem;
                    transition: background 0.2s;
                }
                .leave-btn:hover { background: rgba(239, 68, 68, 0.3); }
                .room-content {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .participants-list {
                    padding: 0.75rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    max-height: 120px;
                    overflow-y: auto;
                }
                .participants-list h5 { margin: 0 0 0.5rem; opacity: 0.7; font-size: 0.8rem; }
                .participants-list ul { list-style: none; padding: 0; margin: 0; }
                .participants-list li {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.25rem 0;
                    font-size: 0.85rem;
                }
                .participants-list li.me { color: #a78bfa; font-weight: 500; }
                .avatar {
                    width: 24px;
                    height: 24px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.7rem;
                }
                .host-badge { font-size: 0.8rem; }
                .chat-area {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .messages {
                    flex: 1;
                    padding: 0.75rem;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .message { font-size: 0.85rem; word-break: break-word; line-height: 1.4; }
                .message.system { 
                    color: rgba(255, 255, 255, 0.4); 
                    font-style: italic; 
                    font-size: 0.75rem;
                    text-align: center;
                    margin: 0.25rem 0;
                }
                .author { 
                    font-weight: 600; 
                    margin-right: 0.5rem; 
                    color: #818cf8;
                }
                .text { opacity: 0.9; }
                .chat-input {
                    padding: 0.75rem;
                    display: flex;
                    gap: 0.5rem;
                    background: rgba(0, 0, 0, 0.3);
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                }
                .chat-input input {
                    flex: 1;
                    padding: 0.5rem 0.75rem;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 6px;
                    color: white;
                    font-size: 0.85rem;
                    outline: none;
                    transition: border-color 0.2s;
                }
                .chat-input input:focus { border-color: #8b5cf6; }
                .chat-input button {
                    padding: 0.5rem 1rem;
                    background: #8b5cf6;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.85rem;
                    font-weight: 500;
                    transition: background 0.2s;
                }
                .chat-input button:hover { background: #7c3aed; }
            `}</style>
        </div>
    );
}
