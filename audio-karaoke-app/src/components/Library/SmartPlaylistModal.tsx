import React, { useState, useEffect } from 'react';
import { Playlist, SmartPlaylistRule, SmartPlaylistRuleField, SmartPlaylistRuleOperator } from '@/types/storage';
import { playlistStorage } from '@/utils/storage/playlistStorage';

interface SmartPlaylistModalProps {
    onClose: () => void;
    onSave: () => void;
    existingPlaylist?: Playlist;
}

const FIELDS: { label: string; value: SmartPlaylistRuleField }[] = [
    { label: 'Title', value: 'title' },
    { label: 'Artist', value: 'artist' },
    { label: 'Album', value: 'album' },
    { label: 'Genre', value: 'genre' },
    { label: 'Year', value: 'year' },
    { label: 'Duration (sec)', value: 'duration' },
];

const OPERATORS: { label: string; value: SmartPlaylistRuleOperator }[] = [
    { label: 'Contains', value: 'contains' },
    { label: 'Does not contain', value: 'not_contains' },
    { label: 'Equals', value: 'equals' },
    { label: 'Is not', value: 'is_not' },
    { label: 'Starts with', value: 'starts_with' },
    { label: 'Does not start with', value: 'not_starts_with' },
    { label: 'Ends with', value: 'ends_with' },
    { label: 'Does not end with', value: 'not_ends_with' },
    { label: 'Greater than', value: 'greater_than' },
    { label: 'Less than', value: 'less_than' },
];

export const SmartPlaylistModal: React.FC<SmartPlaylistModalProps> = ({ onClose, onSave, existingPlaylist }) => {
    const isEditing = !!existingPlaylist;
    const [name, setName] = useState('');
    const [rules, setRules] = useState<SmartPlaylistRule[]>([
        { id: '1', field: 'title', operator: 'contains', value: '' }
    ]);

    useEffect(() => {
        if (existingPlaylist) {
            setName(existingPlaylist.name);
            if (existingPlaylist.rules && existingPlaylist.rules.length > 0) {
                setRules(existingPlaylist.rules);
            }
        }
    }, [existingPlaylist]);

    const handleAddRule = () => {
        setRules([
            ...rules,
            { id: Date.now().toString(), field: 'title', operator: 'contains', value: '' }
        ]);
    };

    const handleRemoveRule = (id: string) => {
        setRules(rules.filter(r => r.id !== id));
    };

    const handleRuleChange = (id: string, field: keyof SmartPlaylistRule, value: any) => {
        setRules(rules.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        
        try {
            if (isEditing && existingPlaylist?.id) {
                await playlistStorage.updatePlaylist(existingPlaylist.id, {
                    name: name.trim(),
                    rules
                });
            } else {
                await playlistStorage.createSmartPlaylist(name.trim(), rules);
            }
            onSave();
            onClose();
        } catch (error) {
            console.error('Failed to save smart playlist:', error);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-2xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">
                        {isEditing ? 'Edit Smart Playlist' : 'Create Smart Playlist'}
                    </h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-white">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">Playlist Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., 80s Rock Anthems"
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                            autoFocus
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-medium text-muted-foreground">Rules (Match ALL)</label>
                            <button
                                onClick={handleAddRule}
                                className="text-sm text-primary hover:text-primary/80 font-medium"
                            >
                                + Add Rule
                            </button>
                        </div>
                        
                        <div className="space-y-3">
                            {rules.map((rule) => (
                                <div key={rule.id} className="flex gap-3 items-center">
                                    <select
                                        value={rule.field}
                                        onChange={(e) => handleRuleChange(rule.id, 'field', e.target.value)}
                                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    >
                                        {FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                    </select>
                                    
                                    <select
                                        value={rule.operator}
                                        onChange={(e) => handleRuleChange(rule.id, 'operator', e.target.value)}
                                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    >
                                        {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                                    </select>

                                    <input
                                        type="text"
                                        value={rule.value}
                                        onChange={(e) => handleRuleChange(rule.id, 'value', e.target.value)}
                                        placeholder="Value..."
                                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    />
                                    
                                    <button
                                        onClick={() => handleRemoveRule(rule.id)}
                                        className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                                        disabled={rules.length === 1}
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!name.trim()}
                        className="px-6 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isEditing ? 'Save Changes' : 'Create Playlist'}
                    </button>
                </div>
            </div>
        </div>
    );
};
