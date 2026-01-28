import Head from 'next/head';

export default function Home() {
  return (
    <>
      <Head>
        <title>Audio Karaoke Separation</title>
        <meta name="description" content="AI-powered audio separation and karaoke app" />
      </Head>
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
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

          {/* Upload Section Placeholder */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
              <h2 className="text-2xl font-semibold mb-4">Upload Audio File</h2>
              <div className="border-2 border-dashed border-purple-400 rounded-xl p-12 text-center hover:border-purple-300 transition-colors cursor-pointer">
                <svg
                  className="mx-auto h-16 w-16 text-purple-400 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="text-lg text-gray-300 mb-2">
                  Drop your audio file here or click to browse
                </p>
                <p className="text-sm text-gray-400">
                  Supports MP3, WAV, OGG • Max 500MB
                </p>
              </div>
            </div>

            {/* Features */}
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10">
                <div className="text-3xl mb-3">🎤</div>
                <h3 className="font-semibold mb-2">Vocal Separation</h3>
                <p className="text-sm text-gray-400">
                  Extract clean vocals from any song
                </p>
              </div>
              <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10">
                <div className="text-3xl mb-3">🎹</div>
                <h3 className="font-semibold mb-2">Instrumental Track</h3>
                <p className="text-sm text-gray-400">
                  Get the instrumental backing track
                </p>
              </div>
              <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10">
                <div className="text-3xl mb-3">⚡</div>
                <h3 className="font-semibold mb-2">100% Local</h3>
                <p className="text-sm text-gray-400">
                  All processing happens in-browser
                </p>
              </div>
            </div>

            {/* Status */}
            <div className="mt-8 text-center text-sm text-gray-400">
              Phase 1: Foundation & Setup Complete ✅
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
