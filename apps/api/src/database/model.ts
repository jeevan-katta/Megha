import mongoose, { type InferSchemaType, type Model, type Schema } from 'mongoose';
/** Avoid model recompilation during local reloads and warm serverless invocations. */
export function defineModel<T extends Schema>(name: string, schema: T): Model<InferSchemaType<T>> {
  return (
    (mongoose.models[name] as Model<InferSchemaType<T>> | undefined) ??
    mongoose.model<InferSchemaType<T>>(name, schema)
  );
}
