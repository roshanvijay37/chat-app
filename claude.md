# Chat App — Project Context

## Overview
Real-time chat application. Repo: `github.com/roshanvijay37/chat-app`. Deployed on Railway.

**Stack**: React 19 + Vite 7 (client), Node.js + Express 5 + Socket.IO 4 (server), Supabase (PostgreSQL + Auth + Storage), Resend API (email OTP).

## Project Structure
```
Chat/
├── client/                    # React SPA (Vite)
│   └── src/
│       ├── components/
│       │   ├── ChatWindow.jsx  # Messages, file/image rendering, edit/delete, typing indicators
│       │   ├── Sidebar.jsx     # Conversation list, avatars, unread badges, new chat form, context menu
│       │   └── ProfileModal.jsx # Edit profile (avatar, display name with cooldown, bio)
│       ├── pages/
│       │   ├── Chat.jsx        # Main page — conversations state, socket listeners, activeConv with useRef
│       │   ├── Login.jsx       # Login with identifier (email or username)
│       │   └── Signup.jsx      # Signup with OTP verification flow
│       ├── services/
│       │   ├── api.js          # All REST API calls
│       │   └── socket.js       # Socket.IO client singleton
│       ├── context/
│       │   └── AuthContext.jsx  # Auth state — login, signup, verifyOtp, logout, refreshProfile
│       ├── App.jsx             # Routes: /login, /signup, / (protected)
│       └── App.css             # Full dark theme, responsive
├── server/
│   └── src/
│       ├── index.js            # Express setup, CORS (GET/POST/PUT/DELETE), static serving, Socket.IO
│       ├── socket.js           # All socket handlers (message CRUD, delivery/read, typing, online tracking)
│       ├── routes/
│       │   ├── auth.js         # signup (OTP), verify-otp, login (email/username), /me, logout, PUT /profile
│       │   └── chat.js         # conversations CRUD, groups CRUD, messages, file upload (multer), find-user, delete conv
│       ├── config/
│       │   └── supabase.js     # Two clients: anon (supabase) + service key (supabaseAdmin)
│       └── middleware/
│           └── auth.js         # JWT auth via supabase.auth.getUser
└── package.json               # Root scripts: build, start, dev
```

## Database Schema (Supabase PostgreSQL)

**profiles**: `id` (uuid, PK, = auth.users.id), `email`, `display_name`, `avatar_url`, `bio`, `display_name_changed_at`

**conversations**: `id` (uuid, PK), `type` ('direct' | 'group'), `name` (for groups), `created_by` (for groups), `created_at`

**conversation_members**: `conversation_id` (FK), `user_id` (FK) — composite PK

**messages**: `id` (uuid, PK), `conversation_id` (FK), `sender_id` (FK), `content` (text, possibly NOT NULL — use empty string not null), `type` ('text' | 'image' | 'file'), `created_at`, `delivered_at`, `read_at`, `edited_at`, `deleted_at`

**RPC**: `find_direct_conversation(user_a, user_b)` — returns existing direct conversation between two users.

**Storage Buckets** (both public): `chat-files` (shared files/images), `avatars` (profile pictures).

## Implemented Features
1. **Real-time messaging** — Socket.IO, conversation rooms
2. **Read receipts** — ✓ sent, ✓✓ delivered, ✓✓ teal read. Auto-deliver on connect, bulk mark on reconnect
3. **Unread count** — Teal badge pills in sidebar, scoped to conversationId
4. **Message editing & deletion** — Right-click context menu on own messages, inline edit bar, "This message was deleted"
5. **Group chats** — Direct/Group tabs, multi-user search, purple avatar, sender names, user-specific rooms (`user:${userId}`)
6. **File/image sharing** — Multer upload to Supabase Storage, inline images, download cards, max 10MB
7. **User profiles** — Avatar upload, display name (7-day cooldown), bio (150 chars)
8. **Delete chat / Leave group** — Right-click context menu, removes from conversation_members, cleans orphans
9. **Login with username** — `identifier` field resolves username via profiles lookup
10. **Mobile responsive** — SVG icons (not Unicode), flex layout fixes, text-overflow ellipsis
11. **Message reactions** — 6 emoji reactions (👍❤️😂😮😢🔥), toggle on/off, reaction pills below messages, real-time broadcast. DB: `message_reactions` table (message_id, user_id, emoji, unique constraint). Socket: `reaction:toggle` / `reaction:updated`

## Key Patterns & Gotchas

- **Stale closures**: Socket listeners in Chat.jsx capture state at registration time. `activeConv` uses `useRef` (`activeConvRef`) to avoid stale reads.
- **CORS**: Must include ALL HTTP methods used: `["GET", "POST", "PUT", "DELETE"]` in both Express CORS and Socket.IO CORS.
- **CSS specificity**: `.message-input button` overrides specific classes — scope with `button[type="submit"]`.
- **Supabase NOT NULL**: `messages.content` may have NOT NULL constraint — use `""` not `null` when clearing.
- **Event propagation**: Context menus inside clickable parents need `e.stopPropagation()`.
- **Unicode on mobile**: Symbols like `⏻` don't render — use inline SVGs.
- **Socket rooms**: Users join `user:${userId}` (personal notifications) + all conversation rooms on connect.
- **File messages**: `content` stores JSON string `{url, fileName, fileSize, mimeType}`, `type` is 'image' or 'file'.

## Socket Events
| Event | Direction | Purpose |
|---|---|---|
| `message:send` | Client→Server | Send text message (callback with message) |
| `message:new` | Server→Client | Broadcast new message to conversation room |
| `message:edit` | Client→Server | Edit own message (validates ownership) |
| `message:delete` | Client→Server | Soft-delete own message (validates ownership) |
| `message:updated` | Server→Client | Broadcast edited message |
| `message:deleted` | Server→Client | Broadcast deleted message |
| `message:delivered` | Client→Server | Acknowledge delivery |
| `message:read` | Client→Server | Mark conversation messages as read |
| `message:status` | Server→Client | Status update (delivered/read) with conversationId + messageIds |
| `conversation:join` | Client→Server | Join a conversation room |
| `typing:start/stop` | Bidirectional | Typing indicators |
| `user:online/offline` | Server→Client | Presence |
| `users:online` | Client→Server | Query online status (callback) |
| `group:created` | Server→Client | New group notification (to `user:${uid}` rooms) |
| `group:added` | Server→Client | Added to existing group |
| `reaction:toggle` | Client→Server | Toggle emoji reaction on message |
| `reaction:updated` | Server→Client | Broadcast updated reactions for a message |

## REST API Endpoints
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | /auth/signup | No | Send OTP email |
| POST | /auth/verify-otp | No | Verify OTP, create account |
| POST | /auth/login | No | Login with email/username + password |
| GET | /auth/me | Yes | Get current user profile |
| POST | /auth/logout | Yes | Logout |
| PUT | /auth/profile | Yes | Update profile (multipart: avatar, displayName, bio) |
| GET | /chat/conversations | Yes | List user's conversations |
| POST | /chat/conversations | Yes | Create direct conversation |
| DELETE | /chat/conversations/:id | Yes | Leave/delete conversation |
| POST | /chat/groups | Yes | Create group |
| POST | /chat/groups/:id/members | Yes | Add members to group |
| GET | /chat/groups/:id/members | Yes | Get group members |
| GET | /chat/messages/:convId | Yes | Get messages (paginated, newest first) |
| POST | /chat/messages | Yes | Send message (REST, rarely used — socket preferred) |
| POST | /chat/upload | Yes | Upload file (multipart) |
| GET | /chat/find-user?q= | Yes | Find user by email or username |

## Dependencies
**Server**: express@5, socket.io@4, @supabase/supabase-js@2, cors, dotenv, multer@2, resend@6
**Client**: react@19, react-dom@19, react-router-dom@7, socket.io-client@4, vite@7

## Environment Variables
**Server** (.env): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CLIENT_URL`, `PORT`
**Client** (.env.production): `VITE_API_URL`

## Scripts
- `npm run dev` (root) → runs server with nodemon
- `npm run build` (root) → builds client
- `npm start` (root) → runs server in production

## Process Rules
- Features implemented one at a time: **proposal → user approval → implementation**
- Wait for confirmation before coding
- Production-quality, scalable code expected
- Git: descriptive commit messages, push to `origin/main`

## Git State
Latest commit: `e8cfefa` — "fix: message delete not working"
Pending: Message Reactions feature (implemented, not yet committed)

## Pending Feature: Message Search (approved, not yet implemented)
- Search icon in sidebar header opens search input
- Backend `GET /chat/search?q=` searches across user's conversations using `ilike`
- Results: message snippet, sender name, conversation name/participant, timestamp
- Click result → opens that conversation
- No new dependencies or DB changes
- Files to modify: `server/src/routes/chat.js`, `client/src/components/Sidebar.jsx`, `client/src/services/api.js`, `client/src/App.css`
