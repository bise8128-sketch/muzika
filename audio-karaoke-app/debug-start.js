const cp = require('child_process');
const path = require('path');

const startServerPath = path.resolve(__dirname, 'node_modules/next/dist/server/lib/start-server.js');

const child = cp.fork(startServerPath, {
    stdio: 'inherit',
    env: {
        ...process.env,
        NEXT_PRIVATE_WORKER: '1',
    }
});

child.on('message', (msg) => {
    console.log('PARENT GOT MESSAGE:', msg);
    if (msg.nextWorkerReady) {
        child.send({
            nextWorkerOptions: {
                dir: __dirname,
                port: 3040,
                allowRetry: false,
                isDev: true,
                hostname: 'localhost'
            }
        });
    }
});

child.on('exit', (code, signal) => {
    console.log(`CHILD EXITED with code ${code} and signal ${signal}`);
});

child.on('error', (err) => {
    console.error('CHILD ERROR:', err);
});
