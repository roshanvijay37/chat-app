# Chat App — Project Context

## Overview
Real-time chat application. Repo: `github.com/roshanvijay37/chat-app`. Deployed on Railway.

**Stack**: React 19 + Vite 7 (client), Node.js + Express 5 + Socket.IO 4 (server), Supabase (PostgreSQL + Auth + Storage), Resend API (email OTP).

## Project Structure
```
Chat/
├── client/                        # React SPA (Vite) — Web frontend
│   └── src/
│       ├── components/
│       │   ├── ChatWindow.jsx      # Messages, file/image, edit/delete, typing, reactions, SVG read receipts, call buttons (📞📹)
│       │   ├── CallOverlay.jsx     # Full-screen call UI — incoming/outgoing/connected states, voice + video
│       │   ├── Sidebar.jsx         # Conversation list, avatars, unread badges, new chat form, context menu, theme toggle
│       │   ├── ProfileModal.jsx    # Edit own profile (avatar, display name with cooldown, bio)
│       │   └── ViewProfileModal.jsx # Read-only profile view (avatar, name, bio) for other users
│       ├── pages/
│       │   ├── Chat.jsx            # Main page — conversations state, socket listeners, call state + WebRTC orchestration
│       │   ├── Login.jsx           # Login with identifier (email or username)
│       │   └── Signup.jsx          # Signup with OTP verification flow
│       ├── services/
│       │   ├── api.js              # All REST API calls (including getProfile)
│       │   ├── socket.js           # Socket.IO client singleton
│       │   └── webrtc.js           # Browser WebRTC service — native RTCPeerConnection, getUserMedia, ICE handling
│       ├── context/
│       │   ├── AuthContext.jsx      # Auth state — login, signup, verifyOtp, logout, refreshProfile
│       │   └── ThemeContext.jsx     # Light/dark theme toggle, persisted in localStorage
│       ├── App.jsx                 # Routes: /login, /signup, / (protected). Wrapped in ThemeProvider + AuthProvider
│       └── App.css                 # WhatsApp-style theme with CSS variables, light/dark mode, call overlay styles
├── server/
│   └── src/
│       ├── index.js                # Express setup, CORS (GET/POST/PUT/DELETE), static serving, Socket.IO
│       ├── socket.js               # All socket handlers (message CRUD, delivery/read, typing, online, reactions, call signaling)
│       ├── routes/
│       │   ├── auth.js             # signup (OTP), verify-otp, login (email/username), /me, logout, PUT /profile
│       │   └── chat.js             # conversations CRUD, groups CRUD, messages (with reactions), file upload, find-user, profile/:userId, delete conv
│       ├── config/
│       │   └── supabase.js         # Two clients: anon (supabase) + service key (supabaseAdmin)
│       └── middleware/
│           └── auth.js             # JWT auth via supabase.auth.getUser
├── mobile/                         # React Native + Expo mobile app
│   ├── App.js                      # Navigation: AuthStack (Login/Signup) + AppStack (all screens). Providers: SafeArea, Theme, Auth, Call
│   ├── app.json                    # Expo config: softwareKeyboardLayoutMode resize, camera/mic/audio permissions, expo-sqlite plugin
│   ├── eas.json                    # EAS build profiles: development (dev client APK), preview (standalone APK), production
│   └── src/
│       ├── screens/
│       │   ├── LoginScreen.js      # Login with password visibility toggle
│       │   ├── SignupScreen.js     # Signup with OTP flow
│       │   ├── ConversationsScreen.js # Cache-first loading, handles camelCase + snake_case fields
│       │   ├── ChatScreen.js       # Cache-first messages, reactions (long-press), call buttons (📞📹), safe area insets
│       │   ├── NewChatScreen.js    # Find user + start conversation
│       │   ├── ProfileScreen.js    # Edit own profile
│       │   ├── ViewProfileScreen.js # View other user's profile
│       │   └── CallScreen.js       # Incoming/outgoing/connected states, RTCView (lazy-loaded), voice + video
│       ├── services/
│       │   ├── api.js              # REST client pointing to Railway URL
│       │   ├── socket.js           # Socket.IO client singleton
│       │   ├── webrtc.js           # WebRTC service with lazy-loaded react-native-webrtc imports
│       │   └── db.js               # SQLite cache layer (lazy-load for web compat). Tables: cached_user, conversations, messages
│       └── context/
│           ├── AuthContext.js       # Cache-first auth with SQLite. Shows cached user instantly, verifies token in background
│           ├── ThemeContext.js      # Light/dark themes matching web CSS variables, AsyncStorage persistence
│           └── CallContext.js       # Global call state. Refs for stale closure fix. Polls for socket connection
├── .github/
│   └── workflows/
│       └── build-android.yml       # GitHub Actions: manual trigger, EAS local build on ubuntu, uploads APK artifact
└── package.json                    # Root scripts: build, start, dev
```

## Database Schema (Supabase PostgreSQL)

**profiles**: `id` (uuid, PK, = auth.users.id), `email`, `display_name`, `avatar_url`, `bio`, `display_name_changed_at`

**conversations**: `id` (uuid, PK), `type` ('direct' | 'group'), `name` (for groups), `created_by` (for groups), `created_at`

**conversation_members**: `conversation_id` (FK), `user_id` (FK) — composite PK

**messages**: `id` (uuid, PK), `conversation_id` (FK), `sender_id` (FK), `content` (text, NOT NULL — use empty string not null), `type` ('text' | 'image' | 'file'), `created_at`, `delivered_at`, `read_at`, `edited_at`, `deleted_at`

**message_reactions**: `id` (uuid, PK), `message_id` (FK, CASCADE), `user_id` (FK, CASCADE), `emoji` (text), `created_at`. UNIQUE(message_id, user_id, emoji). Index on message_id.

**RPC**: `find_direct_conversation(user_a, user_b)` — returns existing direct conversation between two users.

**Storage Buckets** (both public): `chat-files` (shared files/images), `avatars` (profile pictures).

## Implemented Features
1. **Real-time messaging** — Socket.IO, conversation rooms
2. **Read receipts** — WhatsApp-style SVG checkmarks: single grey ✓ sent, double grey ✓✓ delivered, double sky-blue (#53bdeb) ✓✓ read. Auto-deliver on connect, bulk mark on reconnect
3. **Unread count** — Badge pills in sidebar, scoped to conversationId
4. **Message editing & deletion** — Right-click context menu on own messages, inline edit bar, "This message was deleted"
5. **Group chats** — Direct/Group tabs, multi-user search, purple avatar, sender names, user-specific rooms (`user:${userId}`)
6. **File/image sharing** — Multer upload to Supabase Storage, inline images, download cards, max 10MB
7. **User profiles** — Avatar upload, display name (7-day cooldown), bio (150 chars). Edit own via sidebar click. View others via chat header click.
8. **Delete chat / Leave group** — Right-click context menu, removes from conversation_members, cleans orphans
9. **Login with username** — `identifier` field resolves username via profiles lookup
10. **Mobile responsive** — SVG icons (not Unicode), flex layout fixes, text-overflow ellipsis
11. **Message reactions** — 6 emoji reactions (👍❤️😂😮😢🔥), toggle on/off, reaction pills below messages, real-time broadcast via socket
12. **Light/Dark theme** — WhatsApp-style color palette. Light default. Toggle button (sun/moon SVG) in sidebar. Persisted in localStorage. CSS custom properties throughout.
13. **View user profiles** — Click chat header in direct conversations to see other user's avatar + bio. Backend verifies shared conversation membership for privacy.
14. **Voice/Video calls (mobile)** — 1-on-1 WebRTC calls via react-native-webrtc. Server relays signaling (call:initiate/accept/reject/end/ice-candidate/busy). CallContext for global state, CallScreen with incoming/outgoing/connected states. Call buttons in ChatScreen header.
15. **Voice/Video calls (web)** — Browser-native WebRTC (no extra libraries). CallOverlay component with full-screen UI. Call state managed in Chat.jsx with refs to avoid stale closures. ICE candidate buffering. Same server signaling events as mobile — web ↔ mobile calls work cross-platform.
16. **SQLite local caching (mobile)** — Cache-first strategy using expo-sqlite. Tables: cached_user, conversations, messages (keyed by user_id). Shows cached data instantly, syncs from server in background. Cache cleared on logout or different user login.
17. **React Native mobile app** — Expo project in `mobile/`. All screens: Login, Signup, Conversations, Chat, NewChat, Profile, ViewProfile, Call. SafeAreaView on all screens. Password visibility toggle. Keyboard resize mode.
18. **GitHub Actions CI/CD** — Manual trigger workflow for building Android APK using `eas build --local` on GitHub's Linux runner. Profile choice (preview/development). Uses EXPO_TOKEN secret. Uploads APK as artifact.

## Theme Colors (WhatsApp-style)
| Variable | Light | Dark |
|---|---|---|
| --bg-primary | #ffffff | #0b141a |
| --bg-secondary | #f5f5f5 | #111b21 |
| --bg-tertiary | #e8e8e8 | #202c33 |
| --msg-mine | #d9fdd3 | #005c4b |
| --msg-theirs | #ffffff | #202c33 |
| --accent | #00a884 | #00a884 |
| --read-blue | #53bdeb | #53bdeb |
| --tick-default | #667781 | #8696a0 |

## Key Patterns & Gotchas
- **Stale closures**: Socket listeners in Chat.jsx use `useRef` (`activeConvRef`) to avoid stale state reads.
- **CORS**: Must include ALL HTTP methods: `["GET", "POST", "PUT", "DELETE"]`.
- **Supabase NOT NULL**: `messages.content` — use `""` not `null` when clearing.
- **Event propagation**: Context menus / reaction pickers inside clickable parents need `e.stopPropagation()`.
- **Unicode on mobile**: Don't render — use inline SVGs instead.
- **Socket rooms**: Users join `user:${userId}` (personal) + all conversation rooms on connect.
- **File messages**: `content` stores JSON string `{url, fileName, fileSize, mimeType}`, `type` is 'image' or 'file'.
- **CSS specificity**: Scope button styles with attribute selectors like `button[type="submit"]`.

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
| `reaction:toggle` | Client→Server | Toggle emoji reaction `{ messageId, emoji, conversationId }` |
| `reaction:updated` | Server→Client | Broadcast updated reactions `{ messageId, reactions: [{ emoji, users }] }` |
| `call:initiate` | Client→Server | Start call `{ to, callType, offer }` → relayed as `call:incoming` |
| `call:incoming` | Server→Client | Incoming call notification `{ from, callType, offer }` |
| `call:accept` | Client→Server | Accept call `{ to, answer }` → relayed as `call:accepted` |
| `call:accepted` | Server→Client | Call accepted `{ from, answer }` |
| `call:reject` | Client→Server | Reject call `{ to }` → relayed as `call:rejected` |
| `call:rejected` | Server→Client | Call rejected `{ from }` |
| `call:end` | Client→Server | End call `{ to }` → relayed as `call:ended` |
| `call:ended` | Server→Client | Call ended `{ from }` |
| `call:ice-candidate` | Bidirectional | ICE candidate exchange `{ to/from, candidate }` |
| `call:busy` | Bidirectional | User busy on another call `{ to/from }` |

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
| GET | /chat/messages/:convId | Yes | Get messages with reactions (paginated, newest first) |
| POST | /chat/messages | Yes | Send message (REST, rarely used — socket preferred) |
| POST | /chat/upload | Yes | Upload file (multipart) |
| GET | /chat/find-user?q= | Yes | Find user by email or username |
| GET | /chat/profile/:userId | Yes | Get user's public profile (verifies shared conversation) |

## Dependencies
**Server**: express@5, socket.io@4, @supabase/supabase-js@2, cors, dotenv, multer@2, resend@6
**Client**: react@19, react-dom@19, react-router-dom@7, socket.io-client@4, vite@7
**Mobile**: expo, react-native, @react-navigation/native, @react-navigation/native-stack, socket.io-client, expo-sqlite, @react-native-async-storage/async-storage, react-native-webrtc, expo-dev-client, react-native-safe-area-context

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

## Deployment & Build Info
- **Railway URL**: `https://chat-app-production-6766.up.railway.app`
- **Expo Account**: `r_o_shh` on expo.dev
- **GitHub Repo**: `github.com/roshanvijay37/chat-app`
- **Mobile Package**: `com.r_o_shh.mobile`
- **EAS Project ID**: `412affcf-3b0f-4b76-8fb3-b2b353eb50d1`
- **GitHub Actions**: Manual trigger workflow builds APK via `eas build --local` on ubuntu-latest. Uses `EXPO_TOKEN` secret.
- **Local builds**: Not possible on Windows (`eas build --local` requires macOS/Linux). Use EAS cloud or GitHub Actions.
- **Dev client**: Requires phone-to-PC LAN connection which doesn't work (firewall/network isolation).

## Git State
Latest commit: `3b478ce` — "feat: add voice/video calls to web client using browser WebRTC"
All features committed and pushed to origin/main.

## Key Technical Notes
- **Web ↔ Mobile calls**: Both use standard WebRTC + same server signaling events. Cross-platform calls work.
- **ICE candidate buffering**: Both web and mobile buffer ICE candidates until remote description is set.
- **Stale closure prevention**: Web uses refs (callPeerRef, callStateRef, activeConvRef). Mobile CallContext uses refs for socket handlers.
- **Server camelCase vs mobile snake_case**: GET /conversations returns `lastMessage`/`unreadCount` (camelCase). Mobile handles both formats with fallbacks.
- **Native module lazy-loading**: react-native-webrtc and expo-sqlite use `Platform.OS !== 'web'` checks to prevent crashes in web mode.
- **Samsung S24 Ultra**: SafeAreaView + useSafeAreaInsets for punch-hole camera + gesture navigation.

## Pending Feature: Message Search (approved, not yet implemented)
- Search icon in sidebar header opens search input
- Backend `GET /chat/search?q=` searches across user's conversations using `ilike`
- Results: message snippet, sender name, conversation name/participant, timestamp
- Click result → opens that conversation
- No new dependencies or DB changes

## Architecture Review Notes (from senior review)
**Critical issues identified:**
- `GET /chat/conversations` has N+1 query problem (4 DB calls per conversation)
- In-memory state (`onlineUsers`, `otpStore`) — single-process only, no Redis
- No rate limiting on any endpoint
- No message pagination on frontend (backend supports `before` cursor but client doesn't use it)
- Socket.IO default in-memory adapter — can't scale horizontally
- OTP store holds plaintext passwords in memory
- No structured logging, no error tracking
