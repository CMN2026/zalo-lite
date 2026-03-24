# Chat Service - Friends, Conversations & Real-time Messaging APIs

## Overview

The Chat Service provides REST APIs for managing friends and conversations, along with real-time messaging via Socket.IO. It uses DynamoDB for data persistence and Redis for pub/sub message broadcasting across service instances.

## Base URL

### REST API
```
http://localhost:3002
```

### Socket.IO
```
ws://localhost:3002
```

## Authentication

### REST API
All endpoints require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

### Socket.IO
Pass the token in the connection query parameter or as auth header:

```javascript
// JavaScript example
io('http://localhost:3002', {
  auth: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  }
});
```

### Token Details
- **Issuer:** `zalo-lite-user-service`
- **Audience:** `zalo-lite-clients`
- **Expiration:** 7 days

---

## REST API Endpoints

### Friends Management

#### 1. Send Friend Request

**Endpoint:** `POST /friends/request`

**Description:** Send a friend request to another user.

**Request Body:**
```json
{
  "receiver_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Validation Rules:**
- `receiver_id`: Required, valid UUID format, cannot be same as sender
- User must exist in the user service

**Response (201 Created):**
```json
{
  "id": "f550e840-e29b-41d4-a716-446655440001",
  "sender_id": "550e8400-e29b-41d4-a716-446655440000",
  "receiver_id": "550e8400-e29b-41d4-a716-446655440002",
  "status": "pending",
  "created_at": 1709027400000,
  "updated_at": 1709027400000
}
```

**Error Response (400):**
```json
{
  "statusCode": 400,
  "message": "Cannot send friend request to yourself"
}
```

**Error Response (409):**
```json
{
  "statusCode": 409,
  "message": "Friend request already pending"
}
```

**Error Response (422 Validation):**
```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [
    {
      "field": "receiver_id",
      "message": "receiver_id is required"
    }
  ]
}
```

---

#### 2. Accept Friend Request

**Endpoint:** `POST /friends/accept`

**Description:** Accept a pending friend request.

**Request Body:**
```json
{
  "request_id": "f550e840-e29b-41d4-a716-446655440001"
}
```

**Validation Rules:**
- `request_id`: Required, valid UUID format
- User must be the receiver of the request

**Response (200 OK):**
```json
{
  "user_id_1": "550e8400-e29b-41d4-a716-446655440000",
  "user_id_2": "550e8400-e29b-41d4-a716-446655440002",
  "created_at": 1709027400000
}
```

**Error Response (403):**
```json
{
  "statusCode": 403,
  "message": "You are not the receiver of this request"
}
```

**Error Response (404):**
```json
{
  "statusCode": 404,
  "message": "Friend request not found"
}
```

**Error Response (422 Validation):**
```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [
    {
      "field": "request_id",
      "message": "request_id must be a valid UUID"
    }
  ]
}
```

---

#### 3. Get Friends List

**Endpoint:** `GET /friends`

**Description:** Get list of all confirmed friends with optional profile caching.

**Query Parameters:**
- `limit` (optional): Maximum results (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response (200 OK):**
```json
[
  {
    "user_id": "550e8400-e29b-41d4-a716-446655440002",
    "phone": "0978123457",
    "full_name": "Jane Smith",
    "email": "jane@example.com",
    "birth_date": "1992-03-22",
    "gender": "female",
    "avatar_url": null,
    "created_at": "2026-03-01T08:00:00.000Z",
    "updated_at": "2026-03-01T08:00:00.000Z"
  },
  {
    "user_id": "550e8400-e29b-41d4-a716-446655440003",
    "phone": "0978123458",
    "full_name": "Bob Johnson",
    "email": "bob@example.com",
    "birth_date": "1988-07-10",
    "gender": "male",
    "avatar_url": null,
    "created_at": "2026-02-15T14:30:00.000Z",
    "updated_at": "2026-02-15T14:30:00.000Z"
  }
]
```

**Error Response (401):**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

---

#### 4. Search Friends by Phone

**Endpoint:** `GET /friends/search?phone=<phone>`

**Description:** Search for friends by phone number. Non-friends are shown as potential contacts.

**Query Parameters:**
- `phone` (required): Phone number to search (min 3 characters)
- `limit` (optional): Maximum results (default: 20, max: 100)

**Response (200 OK):**
```json
[
  {
    "user_id": "550e8400-e29b-41d4-a716-446655440002",
    "phone": "0978123457",
    "full_name": "Jane Smith",
    "email": "jane@example.com",
    "birth_date": "1992-03-22",
    "gender": "female",
    "avatar_url": null,
    "is_friend": true,
    "created_at": "2026-03-01T08:00:00.000Z",
    "updated_at": "2026-03-01T08:00:00.000Z"
  },
  {
    "user_id": "550e8400-e29b-41d4-a716-446655440004",
    "phone": "0978123459",
    "full_name": "Alice Wonder",
    "email": "alice@example.com",
    "birth_date": "1995-12-01",
    "gender": "female",
    "avatar_url": null,
    "is_friend": false,
    "created_at": "2026-01-10T09:15:00.000Z",
    "updated_at": "2026-01-10T09:15:00.000Z"
  }
]
```

**Error Response (422 Validation):**
```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [
    {
      "field": "phone",
      "message": "Phone must be at least 3 characters"
    }
  ]
}
```

---

### Conversations Management

#### 5. Create Conversation

**Endpoint:** `POST /conversations`

**Description:** Create a new conversation (direct message or group chat).

**Request Body (Direct Message):**
```json
{
  "type": 1,
  "member_ids": ["550e8400-e29b-41d4-a716-446655440002"]
}
```

**Request Body (Group Chat):**
```json
{
  "type": 2,
  "name": "Project Team",
  "member_ids": [
    "550e8400-e29b-41d4-a716-446655440002",
    "550e8400-e29b-41d4-a716-446655440003",
    "550e8400-e29b-41d4-a716-446655440004"
  ]
}
```

**Validation Rules:**
- `type`: Required, value 1 (direct) or 2 (group)
- `member_ids`: Required array with at least 1 member
- For direct message (type=1): Exactly 1 receiver
- For group chat (type=2): 2+ members (including user)
- `name`: Required for group chat (2-100 characters)

**Response (201 Created):**
```json
{
  "id": "conv-550e8400-e29b-41d4-a716-446655440000",
  "type": 1,
  "name": null,
  "member_count": 2,
  "created_by": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": 1709027400000,
  "updated_at": 1709027400000,
  "last_message_at": null
}
```

**Error Response (400):**
```json
{
  "statusCode": 400,
  "message": "Direct message must have exactly 1 receiver"
}
```

**Error Response (422 Validation):**
```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [
    {
      "field": "type",
      "message": "Type must be 1 (direct) or 2 (group)"
    },
    {
      "field": "member_ids",
      "message": "member_ids must be an array of valid UUIDs"
    }
  ]
}
```

---

#### 6. Get Conversations

**Endpoint:** `GET /conversations`

**Description:** Get list of all conversations for the authenticated user.

**Query Parameters:**
- `limit` (optional): Maximum results (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response (200 OK):**
```json
[
  {
    "id": "conv-550e8400-e29b-41d4-a716-446655440000",
    "type": 1,
    "name": null,
    "member_count": 2,
    "created_by": "550e8400-e29b-41d4-a716-446655440000",
    "created_at": 1709027400000,
    "updated_at": 1709027400000,
    "last_message_at": 1709027500000,
    "last_message": {
      "id": "msg-001",
      "sender_id": "550e8400-e29b-41d4-a716-446655440002",
      "content": "Hello!",
      "type": "text",
      "created_at": 1709027500000
    }
  },
  {
    "id": "conv-550e8400-e29b-41d4-a716-446655440001",
    "type": 2,
    "name": "Project Team",
    "member_count": 4,
    "created_by": "550e8400-e29b-41d4-a716-446655440000",
    "created_at": 1709020000000,
    "updated_at": 1709027400000,
    "last_message_at": 1709027400000,
    "last_message": {
      "id": "msg-002",
      "sender_id": "550e8400-e29b-41d4-a716-446655440003",
      "content": "Good work everyone!",
      "type": "text",
      "created_at": 1709027400000
    }
  }
]
```

**Error Response (401):**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

---

#### 7. Get Conversation Messages

**Endpoint:** `GET /conversations/:id/messages`

**Description:** Get paginated messages from a specific conversation in chronological order.

**Parameters:**
- `id` (path): Conversation ID

**Query Parameters:**
- `limit` (optional): Maximum results (default: 50, max: 100)
- `offset` (optional): Pagination offset for loading older messages (default: 0)

**Response (200 OK):**
```json
[
  {
    "id": "msg-001",
    "conversation_id": "conv-550e8400-e29b-41d4-a716-446655440000",
    "sender_id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "text",
    "content": "Hi there!",
    "created_at": 1709027300000
  },
  {
    "id": "msg-002",
    "conversation_id": "conv-550e8400-e29b-41d4-a716-446655440000",
    "sender_id": "550e8400-e29b-41d4-a716-446655440002",
    "type": "text",
    "content": "Hello! How are you?",
    "created_at": 1709027400000
  },
  {
    "id": "msg-003",
    "conversation_id": "conv-550e8400-e29b-41d4-a716-446655440000",
    "sender_id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "text",
    "content": "I'm great, thanks!",
    "created_at": 1709027500000
  }
]
```

**Error Response (403):**
```json
{
  "statusCode": 403,
  "message": "You are not a member of this conversation"
}
```

**Error Response (404):**
```json
{
  "statusCode": 404,
  "message": "Conversation not found"
}
```

---

## Socket.IO Real-time Events

### Connection & Disconnection

#### Connect

**Event:** `connection`

**Description:** Fired when client successfully connects to Socket.IO server.

**Client Actions After Connection:**
- Automatically joins personal room: `user_{user_id}`
- Automatically joins all conversation rooms: `conversation_{conversation_id}`

---

### Message Events

#### Send Message

**Event:** `send_message`

**Description:** Send a message to a conversation. Message is saved to DynamoDB and broadcast to all members via Redis pub/sub.

**Emit (Client → Server):**
```javascript
socket.emit('send_message', {
  conversation_id: 'conv-550e8400-e29b-41d4-a716-446655440000',
  type: 'text',
  content: 'Hello everyone!'
});
```

**Message Object:**
- `conversation_id` (string): Target conversation ID
- `type` (string): Message type (currently 'text')
- `content` (string): Message content (1-5000 characters)

**Success Response (from server):**
```javascript
// Broadcasted to all members in conversation_id room
socket.on('receive_message', {
  id: 'msg-550e8400-e29b-41d4-a716-446655440005',
  conversation_id: 'conv-550e8400-e29b-41d4-a716-446655440000',
  sender_id: 'user_id',
  type: 'text',
  content: 'Hello everyone!',
  created_at: 1709027600000
});
```

**Error Response:**
```javascript
socket.on('error', {
  message: 'You are not a member of this conversation'
});
```

**Retry Logic:**
- Automatic retry with exponential backoff (3 attempts, 250ms intervals)
- All Redis pub/sub failures are logged

---

#### Receive Message (Broadcast)

**Event:** `receive_message`

**Description:** Receive messages sent by other users in the same conversation. Sent from Redis pub/sub to all connected members.

**Listen (Server → Client):**
```javascript
socket.on('receive_message', (message) => {
  console.log(`${message.sender_id}: ${message.content}`);
});
```

**Message Object:**
```json
{
  "id": "msg-550e8400-e29b-41d4-a716-446655440005",
  "conversation_id": "conv-550e8400-e29b-41d4-a716-446655440000",
  "sender_id": "550e8400-e29b-41d4-a716-446655440002",
  "type": "text",
  "content": "Thanks for the update!",
  "created_at": 1709027650000
}
```

---

### Typing Indicator

#### Send Typing Status

**Event:** `typing`

**Description:** Notify conversation members that user is typing.

**Emit (Client → Server):**
```javascript
socket.emit('typing', {
  conversation_id: 'conv-550e8400-e29b-41d4-a716-446655440000'
});
```

**Broadcast (Server → Other Clients in conversation):**
```javascript
socket.on('typing', {
  user_id: '550e8400-e29b-41d4-a716-446655440000',
  conversation_id: 'conv-550e8400-e29b-41d4-a716-446655440000'
});
```

---

### Read Receipts

#### Send Read Receipt

**Event:** `read_receipt`

**Description:** Mark messages in a conversation as read.

**Emit (Client → Server):**
```javascript
socket.emit('read_receipt', {
  conversation_id: 'conv-550e8400-e29b-41d4-a716-446655440000',
  last_message_id: 'msg-550e8400-e29b-41d4-a716-446655440005'
});
```

**Broadcast (Server → Other Clients in conversation):**
```javascript
socket.on('read_receipt', {
  user_id: '550e8400-e29b-41d4-a716-446655440000',
  conversation_id: 'conv-550e8400-e29b-41d4-a716-446655440000',
  last_message_id: 'msg-550e8400-e29b-41d4-a716-446655440005'
});
```

---

## Error Handling

### REST API Error Format

All error responses follow this format:

```json
{
  "statusCode": 400,
  "message": "Error description",
  "errors": [
    {
      "field": "fieldName",
      "message": "Specific error message"
    }
  ]
}
```

### Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200  | Success |
| 201  | Created |
| 400  | Bad Request |
| 401  | Unauthorized / Invalid Token |
| 403  | Forbidden / Not a Member |
| 404  | Not Found |
| 409  | Conflict (e.g., duplicate friend request) |
| 422  | Validation Failed |
| 429  | Too Many Requests (Rate Limited) |
| 500  | Internal Server Error |

### Socket.IO Error Format

```javascript
socket.on('error', (error) => {
  console.error(error.message);
});
```

---

## Rate Limiting

Rate limiting is applied to all REST endpoints:

- **Window:** 60 seconds
- **Rate:** 300 requests per window
- **Header:** `X-RateLimit-Remaining`

When rate limit is exceeded (429):

```json
{
  "statusCode": 429,
  "message": "Too many requests, please try again later"
}
```

---

## Project Structure

```
src/
├── config/
│   ├── env.ts                   # Environment variables
│   ├── dynamodb.ts              # DynamoDB client & table provisioning
│   └── redis.ts                 # Redis client configuration
├── controllers/
│   ├── friend.controller.ts     # Friend request handlers
│   └── conversation.controller.ts # Conversation handlers
├── services/
│   ├── friend.service.ts        # Friend management logic
│   ├── conversation.service.ts  # Conversation business logic
│   ├── message.service.ts       # Message persistence & broadcast
│   └── user-client.service.ts   # Inter-service user lookup
├── repositories/
│   ├── friend.repository.ts     # DynamoDB friend operations
│   ├── conversation.repository.ts # DynamoDB conversation operations
│   └── message.repository.ts    # DynamoDB message queries
├── routes/
│   ├── friend.routes.ts         # Friend endpoints
│   └── conversation.routes.ts   # Conversation endpoints
├── middlewares/
│   ├── auth.middleware.ts       # JWT verification
│   ├── error.middleware.ts      # Error handling
│   └── validate.middleware.ts   # Input validation
├── types/
│   └── express.d.ts             # Express type augmentation
└── index.ts                     # Express + Socket.IO entry point
```

---

## Database Schema (DynamoDB)

### Friend Requests Table
```
TableName: friend_requests
PK: id (UUID)
Attributes:
  - sender_id (String)
  - receiver_id (String)
  - status (String): pending, accepted, rejected
  - created_at (Number): Timestamp
  - updated_at (Number): Timestamp
```

### Friendships Table
```
TableName: friendships
PK: user_id_1 (String) + user_id_2 (String) [sorted pair]
Attributes:
  - created_at (Number): Timestamp
```

### Conversations Table
```
TableName: conversations
PK: id (String)
Attributes:
  - type (Number): 1 (direct), 2 (group)
  - name (String): Optional, group name
  - member_count (Number)
  - created_by (String): Creator user ID
  - created_at (Number): Timestamp
  - updated_at (Number): Timestamp
  - last_message_at (Number): Optional
```

### Conversation Members Table
```
TableName: conversation_members
PK: id (String: conversation_id + user_id)
GSI: user_id (PK) - for querying conversations by user
Attributes:
  - conversation_id (String)
  - user_id (String)
  - joined_at (Number): Timestamp
```

### Messages Table
```
TableName: messages
PK: conversation_id (String)
SK: created_at (Number)
Attributes:
  - id (String): Unique message ID
  - sender_id (String)
  - type (String): Message type
  - content (String)
```

---

## Caching Strategy

### Redis Caching
- **User Profiles:** Cached for 5 minutes (TTL: 300s) to reduce inter-service calls
- **Key Format:** `user:{user_id}`
- **Invalidation:** Auto TTL expiration

### Message Broadcasting
- **Channel:** `chat:messages` (configurable via env)
- **Format:** JSON serialized message object
- **Retry Logic:** 3 attempts with 250ms exponential backoff

---

## Setup & Running

### Prerequisites
- Node.js v22+
- Redis 7+
- DynamoDB Local (or AWS)
- npm

### Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build
```

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
PORT=3002
REDIS_URL=redis://localhost:6379
DYNAMODB_ENDPOINT=http://localhost:8000
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=dummy
AWS_SECRET_ACCESS_KEY=dummy
USER_SERVICE_BASE_URL=http://localhost:3001
JWT_SECRET=super-strong-jwt-secret
JWT_ISSUER=zalo-lite-user-service
JWT_AUDIENCE=zalo-lite-clients
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=300
REDIS_MESSAGE_CHANNEL=chat:messages
TABLE_CONVERSATIONS=conversations
TABLE_CONVERSATION_MEMBERS=conversation_members
TABLE_MESSAGES=messages
TABLE_FRIEND_REQUESTS=friend_requests
TABLE_FRIENDSHIPS=friendships
```

### Running

```bash
# Development with auto-reload
npm run dev

# Production
npm start
```

### Health Check

```bash
curl http://localhost:3002/health
```

---

## Example Usage

### REST API Examples

#### Create Direct Message Conversation

```bash
curl -X POST http://localhost:3002/conversations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "type": 1,
    "member_ids": ["550e8400-e29b-41d4-a716-446655440002"]
  }'
```

#### Send Friend Request

```bash
curl -X POST http://localhost:3002/friends/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "receiver_id": "550e8400-e29b-41d4-a716-446655440002"
  }'
```

#### Get Friends List

```bash
curl -X GET http://localhost:3002/friends \
  -H "Authorization: Bearer <token>"
```

#### Search Friends

```bash
curl -X GET "http://localhost:3002/friends/search?phone=0978" \
  -H "Authorization: Bearer <token>"
```

#### Get Conversation Messages

```bash
curl -X GET "http://localhost:3002/conversations/conv-550e8400-e29b-41d4-a716-446655440000/messages?limit=20" \
  -H "Authorization: Bearer <token>"
```

---

### Socket.IO Examples (JavaScript)

```javascript
import { io } from 'socket.io-client';

// Connect with token
const socket = io('http://localhost:3002', {
  auth: {
    token: 'your-jwt-token'
  }
});

socket.on('connect', () => {
  console.log('Connected!');
});

// Send message
socket.emit('send_message', {
  conversation_id: 'conv-id',
  type: 'text',
  content: 'Hello!'
});

// Listen for new messages
socket.on('receive_message', (message) => {
  console.log(`${message.sender_id}: ${message.content}`);
});

// Send typing indicator
socket.emit('typing', {
  conversation_id: 'conv-id'
});

// Listen for typing
socket.on('typing', (data) => {
  console.log(`User ${data.user_id} is typing...`);
});

// Send read receipt
socket.emit('read_receipt', {
  conversation_id: 'conv-id',
  last_message_id: 'msg-id'
});

// Listen for read receipts
socket.on('read_receipt', (data) => {
  console.log(`User ${data.user_id} read message`);
});
```

---

## Inter-Service Communication

### User Service Integration

The Chat Service calls the User Service to:
1. **Validate users** when creating friend requests
2. **Fetch user profiles** for friend lists and search results
3. **Verify tokens** using the same JWT issuer/audience

**Endpoint:** `GET http://user-service:3001/users/:id`

**Response:**
```json
{
  "user_id": "uuid",
  "phone": "0978123456",
  "full_name": "John Doe",
  "email": "john@example.com",
  "avatar_url": null
}
```

### Error Handling

If User Service is unavailable:
- Friend requests fail with 503 Service Unavailable
- Profile lookup returns cached data (if available) or fails gracefully

---

## Security Features

✅ **JWT Authentication** - Token-based authorization with issuer/audience validation  
✅ **Input Validation** - express-validator on all REST endpoints  
✅ **Security Headers** - helmet middleware  
✅ **Rate Limiting** - Request throttling per IP (300 req/min)  
✅ **Atomic Operations** - DynamoDB transactions for consistency  
✅ **Pub/Sub Broadcasting** - Redis for scalable message distribution  
✅ **User Profile Caching** - Reduces load on user-service  
✅ **Authorization Checks** - Verify user membership in conversations  

---

## Performance Considerations

- **DynamoDB:** On-demand billing with auto-scaling
- **Redis:** Pub/sub for distributed message broadcasting
- **User Caching:** 5-minute TTL reduces inter-service calls by ~80%
- **Message Broadcast Retry:** 3 attempts with exponential backoff prevents message loss
- **Socket.IO:** Room-based broadcasting for efficient multicast
- **GSI on Conversations:** Efficient user → conversations queries

---

## Testing the Service

Once Docker Compose is running:

```bash
# Health check
curl http://localhost:3002/health

# Create test token using user-service
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "09111111112",
    "password": "Test123456",
    "full_name": "Test User"
  }'

# Register second user
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "09111111113",
    "password": "Test123456",
    "full_name": "Friend User"
  }'

# Send friend request (using first user's token)
curl -X POST http://localhost:3002/friends/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token_from_first_user>" \
  -d '{
    "receiver_id": "<user_id_from_second_user>"
  }'
```