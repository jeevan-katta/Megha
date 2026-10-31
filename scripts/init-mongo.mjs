import { MongoClient } from 'mongodb';
const c = new MongoClient('mongodb://127.0.0.1:27018/?directConnection=true');
await c.connect();
try {
  await c
    .db('admin')
    .command({ replSetInitiate: { _id: 'megha', members: [{ _id: 0, host: '127.0.0.1:27018' }] } });
  console.log('Local replica set initialized');
} catch (e) {
  if (e.codeName !== 'AlreadyInitialized') throw e;
} finally {
  await c.close();
}
