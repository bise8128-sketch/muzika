"use client";

import React, { useState, useEffect } from "react";
import { playlistStorage } from "@/utils/storage/playlistStorage";
import { songsStorage } from "@/utils/storage/songsStorage";
import type { Playlist, SongEntry } from "@/types/storage";
import { SmartPlaylistModal } from "./SmartPlaylistModal";

interface PlaylistManagerProps {
  onAddToQueue?: (songIds: number[]) => void;
}

export const PlaylistManager: React.FC<PlaylistManagerProps> = ({
  onAddToQueue,
}) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(
    null,
  );
  const [playlistSongs, setPlaylistSongs] = useState<SongEntry[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingSmart, setIsCreatingSmart] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);

  useEffect(() => {
    loadPlaylists();
  }, []);

  const loadPlaylists = async () => {
    setIsLoading(true);
    try {
      const allPlaylists = await playlistStorage.getAllPlaylists();
      setPlaylists(allPlaylists);

      // Re-sync selected playlist if it exists
      if (selectedPlaylist) {
        const updatedSelected = allPlaylists.find(
          (p) => p.id === selectedPlaylist.id,
        );
        if (updatedSelected) {
          setSelectedPlaylist(updatedSelected);
          await loadPlaylistSongs(updatedSelected);
        }
      }
    } catch (error) {
      console.error("Failed to load playlists:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPlaylistSongs = async (playlist: Playlist) => {
    setSelectedPlaylist(playlist);

    let songIds: number[] = [];
    try {
      if (playlist.type === "smart") {
        songIds = await playlistStorage.getPlaylistSongs(playlist.id!);
      } else {
        songIds = playlist.songIds;
      }

      const songs: SongEntry[] = [];
      for (const songId of songIds) {
        const song = await songsStorage.getSong(songId);
        if (song) {
          songs.push(song);
        }
      }
      setPlaylistSongs(songs);
    } catch (error) {
      console.error("Failed to load playlist songs:", error);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;

    try {
      await playlistStorage.createPlaylist(newPlaylistName.trim());
      setNewPlaylistName("");
      setIsCreating(false);
      await loadPlaylists();
    } catch (error) {
      console.error("Failed to create playlist:", error);
    }
  };

  const handleDeletePlaylist = async (id: number) => {
    if (!confirm("Are you sure you want to delete this playlist?")) return;

    try {
      await playlistStorage.deletePlaylist(id);
      if (selectedPlaylist?.id === id) {
        setSelectedPlaylist(null);
        setPlaylistSongs([]);
      }
      await loadPlaylists();
    } catch (error) {
      console.error("Failed to delete playlist:", error);
    }
  };

  const handleEditSmartPlaylist = (playlist: Playlist) => {
    setEditingPlaylist(playlist);
    setIsCreatingSmart(true);
  };

  const handleRemoveSongFromPlaylist = async (songId: number) => {
    if (!selectedPlaylist?.id) return;

    try {
      await playlistStorage.removeSongFromPlaylist(selectedPlaylist.id, songId);
      await loadPlaylistSongs(selectedPlaylist);
      await loadPlaylists();
    } catch (error) {
      console.error("Failed to remove song from playlist:", error);
    }
  };

  const handlePlayPlaylist = () => {
    if (selectedPlaylist && onAddToQueue) {
      onAddToQueue(selectedPlaylist.songIds);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold">Playlists</h3>
          <p className="text-sm text-muted-foreground">
            {playlists.length} playlist{playlists.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingPlaylist(null);
              setIsCreatingSmart(true);
            }}
            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            title="Create Smart Playlist"
          >
            <span className="text-lg">✨</span>
          </button>
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Playlist
          </button>
        </div>
      </div>

      {isCreatingSmart && (
        <SmartPlaylistModal
          onClose={() => {
            setIsCreatingSmart(false);
            setEditingPlaylist(null);
          }}
          onSave={loadPlaylists}
          existingPlaylist={editingPlaylist || undefined}
        />
      )}

      {/* Create Playlist Form */}
      {isCreating && (
        <div className="mb-4 p-4 bg-white/5 rounded-xl border border-white/10">
          <input
            type="text"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreatePlaylist()}
            placeholder="Playlist name..."
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 mb-2"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreatePlaylist}
              className="flex-1 px-3 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewPlaylistName("");
              }}
              className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Playlist List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-2">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading playlists...
          </div>
        ) : playlists.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 bg-white/5 rounded-2xl border border-white/10 text-center">
            <div className="w-12 h-12 mb-3 rounded-full bg-white/10 flex items-center justify-center text-2xl">
              📋
            </div>
            <h3 className="text-lg font-semibold mb-1">No playlists yet</h3>
            <p className="text-sm text-muted-foreground">
              Create a playlist to organize your songs
            </p>
          </div>
        ) : (
          playlists.map((playlist) => (
            <div
              key={playlist.id}
              onClick={() => loadPlaylistSongs(playlist)}
              className={`
                                group relative p-4 rounded-xl border transition-all cursor-pointer
                                ${
                                  selectedPlaylist?.id === playlist.id
                                    ? "bg-primary/20 border-primary/50"
                                    : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                                }
                            `}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4
                    className={`
                                        font-semibold truncate flex items-center gap-2
                                        ${selectedPlaylist?.id === playlist.id ? "text-primary" : "text-white"}
                                    `}
                  >
                    {playlist.type === "smart" && (
                      <span title="Smart Playlist">✨</span>
                    )}
                    {playlist.name}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {playlist.type === "smart"
                      ? "Dynamic"
                      : `${playlist.songIds.length} song${playlist.songIds.length !== 1 ? "s" : ""}`}
                  </p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {playlist.type === "smart" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditSmartPlaylist(playlist);
                      }}
                      className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                      aria-label="Edit smart playlist"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePlaylist(playlist.id!);
                    }}
                    className="p-2 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Delete playlist"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Selected Playlist Songs */}
              {selectedPlaylist?.id === playlist.id &&
                playlistSongs.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        Songs
                      </span>
                      {onAddToQueue && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayPlaylist();
                          }}
                          className="px-3 py-1 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors flex items-center gap-1"
                        >
                          <svg
                            className="w-3 h-3"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-1.5a1 1 0 000-1.664l-3-1.5z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Play All
                        </button>
                      )}
                    </div>
                    {playlistSongs.map((song) => (
                      <div
                        key={song.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {song.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {song.artist || "Unknown Artist"}
                          </p>
                        </div>
                        {selectedPlaylist?.type !== "smart" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveSongFromPlaylist(song.id!);
                            }}
                            className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                            aria-label="Remove song"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
