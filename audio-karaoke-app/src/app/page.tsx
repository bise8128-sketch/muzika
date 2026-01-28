'use client';

import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { KaraokePlayer } from '@/components/Karaoke/KaraokePlayer';
import { PlaybackController } from '@/utils/audio/playbackController';

export default function Home() {
  const [controller, setController] = useState<PlaybackController | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Initialize controller on mount
    const newController = new PlaybackController();
    setController(newController);

    return () => {
      newController.dispose();
    };
  }, []);

  // Mock function to "load" audio for demonstration
  const handleMockLoad = async () => {
    if (!controller) return;

    // In a real app, this would come from the separation engine
    // For now, we'll just show the UI components
    setIsReady(true);
  };

  return (
    <>
      <Head>
        <title>Audio Karaoke Separation</title>
        <meta name="description" content="AI-powered audio separation and karaoke app" />
      </Head>
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white pb-20">
        <div className="container mx-auto px-4 py-12">
          {/* Header */}
          <header className="text-center mb-16">
            <h1 className="text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
              🎵 Audio Karaoke Separation
            </h1>
            <p className="text-xl text-gray-300">
              AI-powered audio separation running entirely in-browser
            </p>
          </header>

          {!isReady ? (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-2xl">
                <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                  <span className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </span>
                  Upload Audio File
                </h2>
                <div
                  onClick={handleMockLoad}
                  className="group border-2 border-dashed border-purple-400/30 rounded-2xl p-16 text-center hover:border-purple-400 hover:bg-purple-400/5 transition-all cursor-pointer relative overflow-hidden"
                >
                  <div className="relative z-10">
                    <svg
                      className="mx-auto h-20 w-20 text-purple-400 mb-6 group-hover:scale-110 transition-transform"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                      />
                    </svg>
                    <p className="text-xl text-gray-200 mb-2 font-medium">
                      Drop your song here
                    </p>
                    <p className="text-gray-400 max-w-xs mx-auto">
                      All processing happens locally. Your files never leave your device.
                    </p>
                  </div>
                  {/* Decorative element */}
                  <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full"></div>
                  <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-32 h-32 bg-pink-500/10 blur-3xl rounded-full"></div>
                </div>
              </div>

              {/* Status */}
              <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 hover:bg-white/10 transition-colors">
                  <div className="text-3xl mb-4 p-3 bg-purple-500/10 rounded-xl w-fit">🎤</div>
                  <h3 className="font-semibold mb-2">Phase 4 Ready</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Karaoke features including LRC lyrics and visualizer are now integrated.
                  </p>
                </div>
                <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 hover:bg-white/10 transition-colors">
                  <div className="text-3xl mb-4 p-3 bg-pink-500/10 rounded-xl w-fit">⚡</div>
                  <h3 className="font-semibold mb-2">Local GPU</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Powered by ONNX Runtime Web for blazing fast local separation.
                  </p>
                </div>
                <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 hover:bg-white/10 transition-colors">
                  <div className="text-3xl mb-4 p-3 bg-blue-500/10 rounded-xl w-fit">💾</div>
                  <h3 className="font-semibold mb-2">Auto-Caching</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Results are saved to IndexedDB for instant subseqent loads.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto animate-in fade-in duration-700">
              <button
                onClick={() => setIsReady(false)}
                className="mb-8 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Upload
              </button>

              {controller && <KaraokePlayer controller={controller} />}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
