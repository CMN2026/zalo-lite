# Messaging Feature - Complete Implementation

## REST API Endpoints

### Send Text Message

**POST /messages**

```json
{
  "conversationId": "uuid",
  "content": "Hello everyone!",
  "type": "text"
}
```

Response: `201 Created`

```json
{
  "data": {
    "id": "uuid",
    "conversation_id": "uuid",
    "sender_id": "uuid",
    "type": "text",
    "content": "Hello everyone!",
    "created_at": "2026-04-11T10:00:00Z",
    "read_by": ["sender_id"]
  }
}
```

### Upload File Message

**POST /messages/:conversationId/upload**

- Multipart form data
- Field name: `file`
- Supported: Images (jpg, png, gif, webp), Documents (pdf, doc, docx, xlsx), Text
- Max size: 50MB

Request:

```
Form-data:
  file: <binary file>
  content: "Check this out!" (optional)
```

Response: `201 Created`

```json
{
  "data": {
    "id": "uuid",
    "conversation_id": "uuid",
    "sender_id": "uuid",
    "type": "file",
    "content": "{\"text\": \"Check this out!\", \"file\": {\"filename\": \"xxx.jpg\", \"originalName\": \"photo.jpg\", \"mimetype\": \"image/jpeg\", \"size\": 2048000, \"path\": \"/uploads/conv-id/xxx.jpg\"}}",
    "created_at": "2026-04-11T10:00:00Z"
  }
}
```

### Get Messages

**GET /messages/:conversationId?limit=50**

Response: `200 OK`

```json
{
  "data": [
    { message objects... }
  ]
}
```

### Mark as Read

**PUT /messages/:conversationId/read**

Response: `200 OK`

```json
{
  "message": "Messages marked as read"
}
```

### Delete Message

**DELETE /messages/:messageId**

Response: `200 OK`

```json
{
  "message": "Message deleted"
}
```

### Search Messages

**GET /messages/:conversationId/search?q=search+term**

Response: `200 OK`

```json
{
  "data": [ matching messages ]
}
```

---

## Socket.io Events

### Connection

```javascript
import io from "socket.io-client";

const socket = io("http://localhost:3002", {
  auth: {
    token: "jwt-token",
  },
});
```

### Send Message (Real-time)

**Client → Server:**

```javascript
socket.emit("message:send", {
  conversation_id: "uuid",
  type: "text", // or 'file'
  content: "Hello!",
});
```

**Server Response (ACK):**

```javascript
socket.on("message:send_ack", (ack) => {
  console.log(ack); // { ok: true, message_id: 'uuid' }
});
```

**Receive Message (Broadcast):**

```javascript
socket.on("message:receive", (message) => {
  console.log(message); // Full message object
});
```

### Typing Indicator

**Client → Server:**

```javascript
socket.emit("message:typing", {
  conversation_id: "uuid",
});
```

**Other Users:**

```javascript
socket.on("message:typing", (data) => {
  console.log(`${data.user_id} is typing...`);
});
```

### Read Receipt

**Client → Server:**

```javascript
socket.emit("message:read", {
  conversation_id: "uuid",
});
```

**Other Users:**

```javascript
socket.on("message:read_receipt", (data) => {
  console.log(data);
  // { conversation_id, user_id, timestamp }
});
```

### Delete Message

**Client → Server:**

```javascript
socket.emit("message:delete", {
  conversation_id: "uuid",
  message_id: "uuid",
});
```

**Other Users:**

```javascript
socket.on("message:deleted", (data) => {
  console.log(data);
  // { message_id, conversation_id, timestamp }
});
```

### Online Status

**User comes online:**

```javascript
socket.on("user:online", (data) => {
  console.log(data); // { user_id, online: true }
});
```

**User goes offline:**

```javascript
socket.on("user:online", (data) => {
  console.log(data); // { user_id, online: false }
});
```

### Notifications

**New message notification (to other users in conversation):**

```javascript
socket.on("notification:new_message", (notification) => {
  console.log(notification);
  // { conversation_id, sender_id, message_id, type }
});
```

---

## File Storage

- **Path:** `/uploads/{conversationId}/{filename}`
- **Served via:** `GET /uploads/:conversationId/:filename`
- **Authentication:** Required (JWT)
- **Security:** Only conversation members can access files

---

## Error Handling

All errors return appropriate HTTP status codes:

- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `422` - Validation Failed
- `500` - Internal Server Error

---

## Usage Example (Frontend)

```javascript
import io from "socket.io-client";

const socket = io("http://localhost:3002", {
  auth: { token: localStorage.getItem("token") },
});

// Send text message
function sendMessage(conversationId, content) {
  socket.emit("message:send", {
    conversation_id: conversationId,
    type: "text",
    content,
  });
}

// Send file
async function sendFile(conversationId, file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("content", "My file");

  const response = await fetch(
    `http://localhost:3002/messages/${conversationId}/upload`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    },
  );

  const result = await response.json();
  console.log(result.data);
}

// Listen for messages
socket.on("message:receive", (message) => {
  addMessageToUI(message);
});

// Mark as read
function markAsRead(conversationId) {
  socket.emit("message:read", { conversation_id: conversationId });
}

// Handle typing
function onTyping(conversationId) {
  socket.emit("message:typing", { conversation_id: conversationId });
}

// Delete message
function deleteMessage(conversationId, messageId) {
  socket.emit("message:delete", {
    conversation_id: conversationId,
    message_id: messageId,
  });
}
```
