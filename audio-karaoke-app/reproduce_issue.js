// eslint-disable-next-line @typescript-eslint/no-require-imports
const ytdl = require('@distube/ytdl-core');

const url = 'https://www.youtube.com/watch?v=0LRJ8AeKfNQ&list=RD3lkJ8HRXTMw&index=4';

console.log('Testing ytdl-core with URL:', url);

async function test() {
    try {
        console.log('Fetching info...');
        const info = await ytdl.getInfo(url);
        console.log('Success! Title:', info.videoDetails.title);
    } catch (error) {
        console.error('Error fetching info:', error);
    }
}

test();
