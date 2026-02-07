import ytdl from '@distube/ytdl-core';

const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Never Gonna Give You Up

console.log('Testing ytdl-core with URL:', url);

try {
    const info = await ytdl.getInfo(url);
    console.log('Success! Title:', info.videoDetails.title);
} catch (error) {
    console.error('Error fetching video info:', error);
}
