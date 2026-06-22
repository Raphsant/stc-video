import mongoose from "mongoose";

let connectionPromise: Promise<typeof mongoose> | null = null;

export async function ensureMongo() {
    if (mongoose.connection.readyState === 1) return mongoose;
    if (mongoose.connection.readyState === 2 && connectionPromise) return connectionPromise;

    const uri = useRuntimeConfig().mongoose?.uri;
    if (!uri) throw createError({ statusCode: 500, statusMessage: "MONGODB_URI missing" });

    connectionPromise = mongoose
        .connect(uri, {
            bufferCommands: false,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 10000,
            maxPoolSize: 5,
            minPoolSize: 0,
            heartbeatFrequencyMS: 10000,
        })
        .catch((err) => {
            connectionPromise = null;
            throw err;
        });

    return connectionPromise;
}
