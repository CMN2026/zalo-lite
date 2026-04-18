# 🤖 Chatbot Service

Dịch vụ chatbot thông minh với AI hybrid, NLP địa phương, hệ thống học tập động và các tính năng nâng cao cho ứng dụng ZaloLite.

## 📋 Mục Lục

1. [Kiến Trúc](#kiến-trúc)
2. [Tính Năng](#tính-năng)
3. [Công Nghệ](#công-nghệ)
4. [Thiết Lập](#thiết-lập)
5. [API Documentation](#api-documentation)
6. [Database Schema](#database-schema)
7. [Phát Triển](#phát-triển)
8. [Testing](#testing)
9. [gRPC Communication](#grpc-communication)
10. [Xử Lý Sự Cố](#xử-lý-sự-cố)

## 🏗️ Kiến Trúc

### Hybrid AI Pipeline

```
User Message
    ↓
[Authentication] (JWT Verification)
    ↓
[Request Handler] (Socket.IO / REST)
    ↓
[Chatbot Service]
    ├─→ [Cache Check]
    │   └─→ [Response Cache Service] (Redis)
    │       └─→ Return cached response if exists
    ├─→ [Local NLP Engine]
    │   ├─→ Extract keywords (Vietnamese)
    │   ├─→ Classify intent (8 categories)
    │   ├─→ Confidence scoring (0.0-1.0)
    │   └─→ Fetch learned patterns (Redis)
    ├─→ [Learning System]
    │   ├─→ Learn from successful classifications
    │   ├─→ Record user feedback (1-5 stars)
    │   └─→ Improve response quality over time
    └─→ [Gemini AI Fallback]
        ├─→ Generate intelligent response
        └─→ Graceful fallback to LocalNLP
    ↓
[Response Formatter]
    ├─→ Intent classification
    ├─→ Confidence score
    ├─→ Generated response
    └─→ Engine source (LocalNLP / Gemini)
    ↓
[Response Caching] (30 min TTL)
    ↓
Response to User
```

## ✨ Tính Năng

### Hỗ Trợ Intents (8 loại)

| Intent           | Mô Tả              | Ví Dụ                                | Confidence Threshold |
| ---------------- | ------------------ | ------------------------------------ | -------------------- |
| PASSWORD_RESET   | Đặt lại mật khẩu   | "Tôi quên mật khẩu"                  | 0.65                 |
| USER_PROFILE     | Cập nhật hồ sơ     | "Sửa thông tin cá nhân"              | 0.70                 |
| ADD_FRIEND       | Thêm bạn           | "Làm sao thêm bạn bè?"               | 0.75                 |
| CREATE_GROUP     | Tạo nhóm           | "Tạo nhóm chat"                      | 0.72                 |
| REPORT_BUG       | Báo cáo lỗi        | "Ứng dụng bị lỗi"                    | 0.60                 |
| FEATURE_REQUEST  | Yêu cầu tính năng  | "Bạn có thể thêm tính năng X không?" | 0.68                 |
| GENERAL_HELP     | Trợ giúp chung     | "Làm sao để..."                      | 0.50                 |
| LANGUAGE_SUPPORT | Hỗ trợ đa ngôn ngữ | "Bạn có hỗ trợ tiếng Anh không?"     | 0.80                 |

### Hệ Thống Học Tập Động

- **Pattern Learning**: Trích xuất từ khóa từ tin nhắn khi classification thành công
- **Feedback System**: Người dùng đánh giá 1-5 sao cho mỗi phản hồi
- **Confidence Boosting**: +0.05 confidence khi rating ≥ 4 sao
- **Auto-Learn**: Tự động học khi confidence > 0.6
- **Pattern Storage**: Redis với TTL 30 ngày
- **Stats Tracking**: Theo dõi metrics học tập

### Caching & Optimization

- **Response Cache**: Redis 30 phút TTL
- **Pattern Cache**: 30 ngày TTL
- **Fast Response**: < 100ms cho cached queries
- **Memory Efficient**: LRU eviction policy

## 🛠️ Công Nghệ

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **AI**: Google Gemini API (fallback)
- **NLP**: Local Vietnamese NLP Engine
- **Database**: DynamoDB (AWS)
- **Cache**: Redis
- **Communication**: Socket.IO, REST API
- **gRPC**: User Service, Auth Service integration

## 📦 Thiết Lập

### Prerequisites

```bash
- Node.js 18+
- npm hoặc yarn
- Redis instance
- AWS DynamoDB access
- Google Gemini API key (optional)
```

### Installation

```bash
# Cài đặt dependencies
npm install

# Setup environment variables (.env)
GEMINI_API_KEY=your_gemini_key
REDIS_URL=redis://localhost:6379
AWS_REGION=ap-southeast-1
DYNAMODB_TABLE_CONVERSATION=zalo_conversations
DYNAMODB_TABLE_FAQ=zalo_faq
DYNAMODB_TABLE_NOTIFICATION=zalo_notifications
PORT=3003
```

### Environment Variables

```env
# Server
PORT=3003
NODE_ENV=development

# Databases
REDIS_URL=redis://localhost:6379
REDIS_LEARNING_TTL=2592000  # 30 days in seconds
AWS_REGION=ap-southeast-1
DYNAMODB_TABLE_CONVERSATION=zalo_conversations
DYNAMODB_TABLE_FAQ=zalo_faq
DYNAMODB_TABLE_NOTIFICATION=zalo_notifications

# AI Services
GEMINI_API_KEY=your_api_key
GEMINI_TIMEOUT=10000

# Auth
JWT_SECRET=your_jwt_secret
AUTH_SERVICE_URL=http://localhost:3001

# gRPC
GRPC_USER_SERVICE_URL=localhost:50051
GRPC_AUTH_SERVICE_URL=localhost:50052
```

### Running

```bash
# Development
npm run dev

# Production
npm run build
npm start

# Docker
docker build -t chatbot-service .
docker run -p 3003:3003 chatbot-service
```

## 📡 API Documentation

### Base URL

```
http://localhost:3003
```

### Socket.IO Endpoints

#### Send Message

```typescript
socket.emit("send_message", {
  message: "Tôi quên mật khẩu",
  conversationId: "conv_123",
});

// Response
socket.on("message_response", {
  messageId: "msg_456",
  intent: "PASSWORD_RESET",
  confidence: 0.87,
  content: "Vui lòng nhấn 'Quên mật khẩu' để đặt lại...",
  engine: "LocalNLP",
});
```

#### Get Conversation History

```typescript
socket.emit("get_history", { conversationId: "conv_123" });

socket.on("history_response", {
  messages: [
    {
      id: "msg_1",
      role: "user",
      content: "Xin chào",
      timestamp: "2024-04-12T10:30:00Z",
    },
    {
      id: "msg_2",
      role: "bot",
      content: "Xin chào! Có gì tôi có thể giúp bạn?",
      timestamp: "2024-04-12T10:30:05Z",
    },
  ],
});
```

### REST API Endpoints

#### POST `/chatbot/messages`

Gửi tin nhắn đến chatbot

**Request:**

```json
{
  "message": "Tôi quên mật khẩu",
  "conversationId": "conv_123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": {
      "id": "msg_456",
      "intent": "PASSWORD_RESET",
      "confidence": 0.87,
      "content": "Vui lòng nhấn 'Quên mật khẩu'...",
      "timestamp": "2024-04-12T10:30:00Z"
    },
    "engine": "LocalNLP"
  }
}
```

#### GET `/chatbot/history/:conversationId`

Lấy lịch sử hội thoại

**Response:**

```json
{
  "success": true,
  "data": {
    "conversationId": "conv_123",
    "messages": [...]
  }
}
```

#### POST `/chatbot/feedback`

Ghi lại phản hồi người dùng

**Request:**

```json
{
  "messageId": "msg_456",
  "intent": "PASSWORD_RESET",
  "rating": 5,
  "feedback": "Lời khuyên rất hữu ích!"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "feedback": {
      "messageId": "msg_456",
      "rating": 5,
      "recordedAt": "2024-04-12T10:35:00Z"
    }
  }
}
```

#### GET `/chatbot/stats`

Lấy thống kê học tập

**Response:**

```json
{
  "success": true,
  "data": {
    "totalInteractions": 1250,
    "averageConfidence": 0.78,
    "learnedPatterns": 23,
    "popularIntents": {
      "PASSWORD_RESET": 340,
      "ADD_FRIEND": 280,
      "CREATE_GROUP": 210
    },
    "averageRating": 4.2
  }
}
```

#### GET `/chatbot/patterns`

Lấy tất cả learned patterns (Admin only)

**Response:**

```json
{
  "success": true,
  "data": {
    "patterns": [
      {
        "intent": "PASSWORD_RESET",
        "keywords": ["quên", "mật khẩu", "đặt lại"],
        "confidence": 0.87,
        "frequency": 45,
        "learnedAt": "2024-04-10T14:20:00Z"
      }
    ],
    "totalPatterns": 23
  }
}
```

## 📊 Database Schema

### DynamoDB Tables

#### 1. zalo_conversations

```
PK: conversationId (String)
SK: messageId (String)
- userId (String)
- content (String)
- intent (String)
- confidence (Number)
- engine (String: "LocalNLP" | "Gemini")
- isLearned (Boolean)
- createdAt (Number: Unix timestamp)
- updatedAt (Number: Unix timestamp)

TTL: 90 days
```

#### 2. zalo_faq

```
PK: category (String)
SK: question (String)
- answer (String)
- intent (String)
- keywords (StringSet)
- confidence (Number)
- popularity (Number)
- createdAt (Number)
- updatedAt (Number)
```

#### 3. zalo_notifications

```
PK: userId (String)
SK: notificationId (String)
- type (String)
- title (String)
- content (String)
- isRead (Boolean)
- createdAt (Number)
- expiresAt (Number)

TTL: 30 days
```

### Redis Schema

#### Learned Patterns

```
Key: learned:pattern:{intent}
Type: Hash
Fields:
  - keywords: JSON string array
  - confidence: Float
  - frequency: Integer
  - learnedAt: Timestamp
  - updatedAt: Timestamp

TTL: 2,592,000 seconds (30 days)

Example:
learned:pattern:PASSWORD_RESET
  keywords: ["quên", "mật khẩu", "đặt lại", "reset password"]
  confidence: 0.87
  frequency: 45
  learnedAt: 1712857200000
```

#### Response Cache

```
Key: cache:response:{intent}:{messageHash}
Type: String
Value: JSON response
TTL: 1800 seconds (30 minutes)
```

#### User Feedback

```
Key: feedback:{messageId}
Type: Hash
Fields:
  - rating: Integer (1-5)
  - feedback: String
  - recordedAt: Timestamp

TTL: 90 days
```

## 👨‍💻 Phát Triển

### Folder Structure

```
src/
├── index.ts                 # Entry point
├── config/
│   ├── env.ts              # Environment variables
│   ├── redis.ts            # Redis configuration
│   └── dynamodb.ts         # DynamoDB configuration
├── services/
│   ├── chatbot.service.ts      # Core business logic
│   ├── local-nlp.service.ts    # Vietnamese NLP
│   ├── gemini.service.ts       # AI fallback
│   ├── learning.service.ts     # Dynamic learning
│   ├── response-cache.service.ts
│   └── notification.service.ts
├── routes/
│   ├── chatbot.routes.ts
│   └── notification.routes.ts
├── controllers/
│   └── chatbot.controller.ts
├── middlewares/
│   ├── auth.middleware.ts
│   └── error.middleware.ts
├── handlers/
│   └── chatbot.io.handler.ts  # Socket.IO handlers
├── repositories/
│   ├── conversation.repository.ts
│   ├── faq.repository.ts
│   └── notification.repository.ts
├── types/
│   └── index.ts             # TypeScript interfaces
├── utils/
│   ├── intent-classifier.ts
│   └── http-error.ts
└── grpc/
    ├── auth.proto
    └── auth-client.ts
```

### Adding New Intent

1. **Update Intent Classifier** (`utils/intent-classifier.ts`)

```typescript
const INTENTS = {
  NEW_INTENT: {
    keywords: ["keyword1", "keyword2"],
    confidence: 0.7,
  },
};
```

2. **Add Response Handler** (`services/chatbot.service.ts`)

```typescript
case Intent.NEW_INTENT:
  return this.handleNewIntent(message);
```

3. **Write Test** (`__tests__/chatbot.test.ts`)

```typescript
test("should classify NEW_INTENT", () => {
  const result = service.classifyIntent("test message");
  expect(result.intent).toBe(Intent.NEW_INTENT);
});
```

### Code Style

- **Language**: TypeScript
- **Formatting**: Prettier (2 spaces)
- **Linting**: ESLint
- **Naming**: camelCase for variables, PascalCase for classes
- **Comments**: JSDoc for public methods

```bash
# Format code
npm run format

# Lint code
npm run lint

# Both
npm run format:lint
```

## 🧪 Testing

### Run Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Test Examples

#### Testing Intent Classification

```typescript
describe("ChatbotService", () => {
  it("should classify PASSWORD_RESET intent", async () => {
    const message = "Tôi quên mật khẩu";
    const result = await chatbotService.handleMessage(message);

    expect(result.intent).toBe("PASSWORD_RESET");
    expect(result.confidence).toBeGreaterThan(0.65);
    expect(result.content).toContain("mật khẩu");
  });

  it("should learn from successful classifications", async () => {
    const message = "reset password please";

    // First request
    const result1 = await chatbotService.handleMessage(message);

    // Record feedback
    await chatbotService.recordFeedback(result1.id, "PASSWORD_RESET", 5);

    // Second request with same query
    const result2 = await chatbotService.handleMessage(message);

    // Should have higher confidence due to learning
    expect(result2.confidence).toBeGreaterThanOrEqual(result1.confidence);
  });
});
```

### Testing Learning System

```bash
# Test learning pattern extraction
npm run test -- learning.test.ts

# Test Redis integration
npm run test -- redis.test.ts

# Test feedback recording
npm run test -- feedback.test.ts
```

## 🔌 gRPC Communication

### Auth Service Integration

```typescript
// Verify user token via gRPC
const authClient = new AuthClient(process.env.GRPC_AUTH_SERVICE_URL);

const response = await authClient.VerifyToken({
  token: userToken,
});
```

### User Service Integration

```typescript
// Get user details via gRPC
const userClient = new UserClient(process.env.GRPC_USER_SERVICE_URL);

const user = await userClient.GetUser({
  userId: userId,
});
```

### Proto Definitions

```protobuf
// auth.proto
service AuthService {
  rpc VerifyToken(VerifyTokenRequest) returns (VerifyTokenResponse);
}

message VerifyTokenRequest {
  string token = 1;
}

message VerifyTokenResponse {
  bool valid = 1;
  string userId = 2;
  int64 expiresAt = 3;
}
```

## 🐛 Xử Lý Sự Cố

### Common Issues & Solutions

| Issue                      | Nguyên Nhân                     | Giải Pháp                               |
| -------------------------- | ------------------------------- | --------------------------------------- |
| Redis connection refused   | Redis service not running       | Start redis: `redis-server`             |
| DynamoDB timeout           | Network/credential issue        | Check AWS credentials in `.env`         |
| Gemini API error           | Invalid API key                 | Verify `GEMINI_API_KEY`                 |
| Low confidence scores      | Insufficient keywords           | Add more keywords to intent classifier  |
| Learning not working       | Redis TTL expired               | Check Redis TTL configuration (30 days) |
| Socket.IO connection fails | Port 3003 already in use        | Change PORT in `.env`                   |
| Memory leak                | Pattern cache too large         | Implement pattern cleanup job           |
| Slow response time         | Cache miss + Gemini unavailable | Check Redis and network                 |

### Debugging

```bash
# Enable debug logs
DEBUG=chatbot:* npm run dev

# Check Redis connection
redis-cli ping

# Monitor Redis keys
redis-cli KEYS "*"

# View DynamoDB items
aws dynamodb scan --table-name zalo_conversations

# Check memory usage
top -p $(pidof node)
```

### Performance Monitoring

```typescript
// Monitor response time
const startTime = Date.now();
const response = await chatbotService.handleMessage(message);
const responseTime = Date.now() - startTime;

console.log(`Response time: ${responseTime}ms`);
if (responseTime > 100) {
  console.warn("⚠️ Slow response detected!");
}
```

## 📈 Performance Metrics

### Benchmarks (Average)

- **Cache Hit**: < 10ms
- **LocalNLP Processing**: 20-50ms
- **Gemini API Call**: 500-2000ms
- **Learning Pattern Lookup**: 5-15ms
- **Total Response**: 50-500ms (depends on engine)

### Optimization Tips

1. **Use Response Caching**: Reduces API calls by 60%
2. **Batch Learning Updates**: Periodic sync to Redis
3. **Connection Pooling**: Reuse Redis connections
4. **Lazy Loading**: Load patterns on-demand
5. **Compression**: Compress large responses

## 🚀 Deployment

### Docker Deployment

```bash
# Build image
docker build -t chatbot-service:latest .

# Run container
docker run -d \
  -p 3003:3003 \
  -e GEMINI_API_KEY=your_key \
  -e REDIS_URL=redis://redis:6379 \
  --name chatbot-service \
  chatbot-service:latest
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chatbot-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: chatbot-service
  template:
    metadata:
      labels:
        app: chatbot-service
    spec:
      containers:
        - name: chatbot-service
          image: chatbot-service:latest
          ports:
            - containerPort: 3003
          env:
            - name: GEMINI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: chatbot-secrets
                  key: gemini-key
            - name: REDIS_URL
              value: redis://redis-service:6379
```

## 📝 License

MIT License - ZaloLite Project
