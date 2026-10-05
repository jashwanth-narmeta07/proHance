import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// These are read by server/src/config/env.js - must be set before any
// module that imports env.js is loaded, which is why this file is wired in
// via jest.config.js's setupFilesAfterEnv rather than imported from a test.
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.NODE_ENV = 'test';

let mongod;

beforeAll(async () => {
  // NOTE: this downloads a real mongod binary on first run. In network-
  // restricted environments (e.g. a sandboxed CI runner with an egress
  // allowlist that doesn't include MongoDB's binary host) this download
  // will fail - that is an environment limitation, not a test bug. Run
  // these tests somewhere with normal internet access, or pre-seed
  // mongodb-memory-server's binary cache.
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});
