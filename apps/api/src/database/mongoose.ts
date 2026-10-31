import mongoose from 'mongoose';
import { config } from '../config';

let connection: Promise<typeof mongoose> | undefined;
export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose;
  connection ??= mongoose
    .connect(config.mongo, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 10000,
    })
    .catch((error) => {
      connection = undefined;
      throw error;
    });
  return connection;
}
