import { spawn, spawnSync } from 'node:child_process';
import { connect, createServer } from 'node:net';
import { readFile } from 'node:fs/promises';
import dotenv from 'dotenv';
import console from 'node:console';
import { setTimeout } from 'node:timers';
const children = [];
const preview = process.argv.includes('--preview');
// A server left running from an earlier dev/preview session would keep answering with old code
// while the new one silently fails to bind, so refuse to start until both ports are free.
const portFree = (port) =>
  new Promise((resolve) => {
    const probe = createServer()
      .once('error', () => resolve(false))
      .once('listening', () => probe.close(() => resolve(true)))
      .listen(port, '127.0.0.1');
  });
const busy = [];
for (const port of [5000, 3000]) if (!(await portFree(port))) busy.push(port);
if (busy.length) {
  console.error(
    `Port ${busy.join(' and ')} already in use, probably by an earlier npm run dev or preview. ` +
      'Stop it (Ctrl+C in its terminal) and run this again.',
  );
  process.exit(1);
}
// Auto-start only this workspace's local database. Atlas does not need a local mongod process.
const apiEnv = dotenv.parse(
  await readFile('apps/api/.env', 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return '';
    throw error;
  }),
);
const mongoUri =
  process.env.MONGODB_URI || apiEnv.MONGODB_URI || 'mongodb://127.0.0.1:27017/megha_laundry';
const workspaceMongo = /^mongodb:\/\/(?:127\.0\.0\.1|localhost):27018(?:\/|\?|$)/.test(mongoUri);
const MONGO_PORT = 27018;
const mongoUp = () =>
  new Promise((resolve) => {
    const socket = connect(MONGO_PORT, '127.0.0.1')
      .once('connect', () => (socket.destroy(), resolve(true)))
      .once('error', () => resolve(false));
  });
if (workspaceMongo && !(await mongoUp())) {
  if (process.platform !== 'win32') {
    console.error(
      `MongoDB is not running on 127.0.0.1:${MONGO_PORT}. Start it and run this again.`,
    );
    process.exit(1);
  }
  console.log(`Starting MongoDB on 127.0.0.1:${MONGO_PORT}...`);
  const started = spawnSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/start-mongo.ps1'],
    { stdio: 'inherit', windowsHide: true },
  );
  if (started.status !== 0) {
    console.error('MongoDB could not be started. See the message above and .local/mongo.log.');
    process.exit(1);
  }
  const deadline = Date.now() + 30000;
  while (!(await mongoUp())) {
    if (Date.now() > deadline) {
      console.error('MongoDB did not start within 30 seconds. Check .local/mongo.log.');
      process.exit(1);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
const apps = [
  [
    'API',
    ['../../node_modules/tsx/dist/cli.mjs', ...(preview ? [] : ['watch']), 'src/server.ts'],
    'apps/api',
  ],
  [
    'Frontend',
    [
      '../../node_modules/next/dist/bin/next',
      ...(preview ? ['start'] : ['dev', '--turbopack']),
      '--hostname',
      '127.0.0.1',
      '--port',
      '3000',
    ],
    'apps/frontend',
  ],
];
for (const [name, args, cwd] of apps) {
  const child = spawn(process.execPath, args, { cwd, stdio: 'inherit', windowsHide: true });
  children.push(child);
  child.on('error', (error) => {
    console.error(`${name}: ${error.message}`);
    process.exitCode = 1;
  });
  child.on('exit', (code) => {
    if (code) console.error(`${name} exited with code ${code}`);
  });
}
function shutdown() {
  for (const child of children) {
    if (!child.pid) continue;
    if (process.platform === 'win32')
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    else child.kill('SIGTERM');
  }
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
