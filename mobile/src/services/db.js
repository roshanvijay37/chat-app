import * as SQLite from 'expo-sqlite';

let db = null;

export async function initDB() {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('cache.db');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS cached_user (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, user_id);
  `);
  return db;
}

// --- User cache ---

export async function getCachedUser() {
  const d = await initDB();
  const row = await d.getFirstAsync('SELECT data FROM cached_user LIMIT 1');
  return row ? JSON.parse(row.data) : null;
}

export async function setCachedUser(user) {
  const d = await initDB();
  await d.runAsync(
    'INSERT OR REPLACE INTO cached_user (id, data, updated_at) VALUES (?, ?, ?)',
    [user.id, JSON.stringify(user), Date.now()]
  );
}

export async function clearCachedUser() {
  const d = await initDB();
  await d.runAsync('DELETE FROM cached_user');
}

// --- Conversations cache ---

export async function getCachedConversations(userId) {
  const d = await initDB();
  const rows = await d.getAllAsync(
    'SELECT data FROM conversations WHERE user_id = ? ORDER BY updated_at DESC',
    [userId]
  );
  return rows.map((r) => JSON.parse(r.data));
}

export async function setCachedConversations(userId, conversations) {
  const d = await initDB();
  await d.runAsync('DELETE FROM conversations WHERE user_id = ?', [userId]);
  for (const c of conversations) {
    await d.runAsync(
      'INSERT OR REPLACE INTO conversations (id, user_id, data, updated_at) VALUES (?, ?, ?, ?)',
      [c.id, userId, JSON.stringify(c), Date.now()]
    );
  }
}

// --- Messages cache ---

export async function getCachedMessages(conversationId, userId) {
  const d = await initDB();
  const rows = await d.getAllAsync(
    'SELECT data FROM messages WHERE conversation_id = ? AND user_id = ? ORDER BY created_at ASC',
    [conversationId, userId]
  );
  return rows.map((r) => JSON.parse(r.data));
}

export async function setCachedMessages(conversationId, userId, messages) {
  const d = await initDB();
  await d.runAsync(
    'DELETE FROM messages WHERE conversation_id = ? AND user_id = ?',
    [conversationId, userId]
  );
  for (const m of messages) {
    const ts = new Date(m.created_at).getTime() || Date.now();
    await d.runAsync(
      'INSERT OR REPLACE INTO messages (id, conversation_id, user_id, data, created_at) VALUES (?, ?, ?, ?, ?)',
      [m.id, conversationId, userId, JSON.stringify(m), ts]
    );
  }
}

export async function appendCachedMessage(conversationId, userId, msg) {
  const d = await initDB();
  const ts = new Date(msg.created_at).getTime() || Date.now();
  await d.runAsync(
    'INSERT OR REPLACE INTO messages (id, conversation_id, user_id, data, created_at) VALUES (?, ?, ?, ?, ?)',
    [msg.id, conversationId, userId, JSON.stringify(msg), ts]
  );
}

export async function updateCachedMessage(msgId, updatedMsg) {
  const d = await initDB();
  const row = await d.getFirstAsync('SELECT data, conversation_id, user_id FROM messages WHERE id = ?', [msgId]);
  if (!row) return;
  const existing = JSON.parse(row.data);
  const merged = { ...existing, ...updatedMsg };
  await d.runAsync(
    'UPDATE messages SET data = ? WHERE id = ?',
    [JSON.stringify(merged), msgId]
  );
}

// --- Clear all cache for a user ---

export async function clearUserCache(userId) {
  const d = await initDB();
  await d.runAsync('DELETE FROM conversations WHERE user_id = ?', [userId]);
  await d.runAsync('DELETE FROM messages WHERE user_id = ?', [userId]);
}

// --- Clear everything (logout / different user) ---

export async function clearAllCache() {
  const d = await initDB();
  await d.execAsync('DELETE FROM cached_user; DELETE FROM conversations; DELETE FROM messages;');
}
