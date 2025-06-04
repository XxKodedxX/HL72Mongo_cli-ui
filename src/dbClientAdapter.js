// dbClientAdapter.js - CommonJS adapter for MongoDB operations
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config();

let client;

async function connect() {
  // Read connection settings at runtime
  const url = process.env.MONGO_URL || 'mongodb://localhost:27017';
  const dbName = process.env.MONGO_DB || 'hl7';
  
  if (!client) {
    client = new MongoClient(url);
  }
  
  // Ensure connection is open (idempotent)
  try {
    await client.connect();
    return client.db(dbName);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

async function ensureIndexes() {
  const db = await connect();
  const collection = db.collection('messages');
  
  try {
    // Create indexes for efficient querying
    await collection.createIndex({ 'patient.id': 1, timestamp: -1 });
    await collection.createIndex({ raw: 'text' });
    await collection.createIndex({ processedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }); // 30 days TTL
  } catch (error) {
    console.error('Error creating indexes:', error);
    throw error;
  }
}

async function insertDocument(collectionName, document) {
  const db = await connect();
  return await db.collection(collectionName).insertOne(document);
}

module.exports = {
  connect,
  ensureIndexes,
  insertDocument
};
