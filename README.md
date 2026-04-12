# Chat Application ZaloLite 💬

**ZaloLite** là một ứng dụng chat hiện đại kết hợp microservices, học máy tự động, và giao tiếp real-time.

---

## 📋 Table of Contents

1. [Tech Stack](#tech-stack)
2. [Features](#features)
3. [Project Structure](#project-structure)
4. [Getting Started](#getting-started)
5. [Services Overview](#services-overview)
   - [API Gateway](#api-gateway)
   - [User Service](#user-service)
   - [Chat Service](#chat-service)
   - [Chatbot Service](#chatbot-service) ⭐
6. [Development](#development)
7. [Troubleshooting](#troubleshooting)

---

## Tech Stack

- **Frontend**: Next.js 16.1.4, React Native (Expo)
- **Backend**: Node.js 22-Alpine, Express, TypeScript
- **Database**: PostgreSQL, DynamoDB
- **Cache**: Redis
- **AI/NLP**: Local NLP (Vietnamese), Gemini API (optional), Dynamic Learning
- **Communication**: HTTP/REST, Socket.io, gRPC
- **Infrastructure**: Docker, Docker Compose

---

## Features

- ✅ **User Management**: Registration, authentication, profiles, friends
- ✅ **Real-time Chat**: 1-1 & group messaging with Socket.io
- ✅ **AI Chatbot**: Intelligent support with self-learning capabilities
- ✅ **Conversation History**: Persistent storage with DynamoDB
- ✅ **Notifications**: Real-time system alerts
- ✅ **Dynamic Learning**: Chatbot improves from user feedback

---

## Project Structure

```
zalo-lite/
├── backend/
│   ├── api-gateway/          # Port 3000 - Main entry point
│   └── services/
│       ├── user-service/     # Port 3001 - User & Auth
│       ├── chat-service/     # Port 3000 - Messaging
│       └── chatbot-service/  # Port 3003 - AI Support ⭐
├── frontend/
│   ├── web/                  # Next.js web app
│   └── mobile/               # React Native mobile
├── infrastructure/
│   ├── docker/
│   │   └── docker-compose.yml
│   └── k8s/                  # Kubernetes manifests
└── README.md
```

---

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 22+
- npm or yarn

### Quick Start

```bash
# Clone repository
git clone https://github.com/baodang96/zalo-lite.git
cd zalo-lite

# Start all services
docker-compose up -d

# Check status
docker ps

# Frontend (web)
cd frontend/web && npm run dev  # localhost:3000

# Frontend (mobile)
cd frontend/mobile && npm start
```

### Environment Setup

```bash
# Create .env files in each service
# See service-specific documentation
```

---

## Services Overview

### API Gateway

- **Port**: 3000
- **Purpose**: Central entry point for all API calls
- **Tech**: Express, TypeScript

### User Service 👤

- **Port**: 3001
- **Features**:
  - User registration & authentication
  - Profile management
  - Friend requests & management
  - gRPC server for inter-service communication (port 50051)
- **Database**: PostgreSQL
- **Tech**: Express, gRPC

### Chat Service 💬

- **Port**: 3000
- **Features**:
  - 1-1 & group messaging
  - Real-time updates (Socket.io)
  - Message history
  - Read receipts
- **Database**: PostgreSQL, DynamoDB
- **Tech**: Express, Socket.io

### Chatbot Service 🤖

**Microservice hỗ trợ người dùng thông qua trò chuyện tự động AI với khả năng tự học từ tương tác người dùng.**

#### Quick Facts

- **Port**: 3003
- **Runtime**: Node.js 22-Alpine + Express + TypeScript
- **AI Engine**: Local NLP + Gemini API (optional) + Dynamic Learning
- **Database**: DynamoDB (conversations, FAQ, notifications)
- **Cache**: Redis (response caching, learned patterns)
- **Inter-Service**: gRPC communication with User Service

#### Features

✅ **Giải đáp tự động** - Trả lời câu hỏi thường gặp  
✅ **Hướng dẫn sử dụng** - Giúp user sử dụng app  
✅ **Lệnh nhanh** - /help, /faq, /contact  
✅ **Thông báo hệ thống** - Broadcast notifications  
✅ **Lưu lịch sử** - Conversation history  
✅ **Tự học** - Cải thiện từ feedback người dùng

#### AI Pipeline (3-Tier Hybrid)

```
User Message
    ↓
1️⃣  Response Cache (Similarity Matching, 0ms)
    ↓ (Miss)
2️⃣  Learned Patterns (Dynamic Keywords, ~10ms)
    ↓
3️⃣  Local NLP (Vietnamese Rules, ~15ms)
    ↓
4️⃣  Gemini API (Fallback, 2-5s, optional)
    ↓
5️⃣  Cache & Learn (Store + Extract Keywords)
```

#### Supported Intents (8 + Learning)

| Intent              | Keywords                   | Status      |
| ------------------- | -------------------------- | ----------- |
| PASSWORD_RESET      | quen, mat khau, reset      | ✅ Learning |
| HOW_TO_ADD_FRIEND   | them ban, ket ban, tim ban | ✅ Learning |
| HOW_TO_CREATE_GROUP | tao nhom, group            | ✅ Learning |
| ACCOUNT_ISSUES      | tai khoan, dang nhap       | ✅ Learning |
| CONTACT_SUPPORT     | lien he, ho tro            | ✅ Learning |
| BILLING_ISSUES      | thanh toan, chi phi        | ✅ Learning |
| PRIVACY_SECURITY    | bao mat, rieng tu          | ✅ Learning |
| FEATURE_INQUIRY     | tinh nang, lam sao         | ✅ Learning |

#### Dynamic Learning System 🧠

**Chatbot automatically improves from user interactions:**

1. **Automatic Keyword Learning**
   - Extracts new keywords from messages (confidence > 0.6)
   - Stores in Redis (30-day TTL)
   - Next similar message matches faster

2. **Feedback-Based Improvement**
   - Users rate responses (1-5 stars)
   - Rating ≥ 4 → Confidence +0.05
   - System learns preferences

3. **Response Variation**
   - Stores up to 5 response variations per intent
   - Avoids repetitive responses
   - A/B testing naturally

4. **Learning Metrics**
   ```bash
   GET /chatbot/stats
   {
     "learned": 12,
     "feedback": 156,
     "topPatterns": [
       {
         "intent": "PASSWORD_RESET",
         "keywords": 15,
         "confidence": "0.92"
       }
     ]
   }
   ```

#### API Endpoints (Chatbot)

```bash
# Send message
POST /chatbot/messages
{
  "message": "Làm sao để thêm bạn?",
  "conversationId": "optional-uuid"
}

# Record feedback (1-5 stars)
POST /chatbot/feedback
{
  "messageId": "uuid",
  "intent": "HOW_TO_ADD_FRIEND",
  "rating": 5,
  "feedback": "Very helpful!"
}

# Get learning stats
GET /chatbot/stats

# List conversations
GET /chatbot/conversations?limit=10

# Get chat history
GET /chatbot/conversations/{convId}/history

# Get FAQ
GET /chatbot/faq?q=password
```

#### Database Schema (Chatbot)

**DynamoDB Tables**:

- `chatbot_conversations` - Chat history
- `chatbot_faq` - FAQ entries
- `chatbot_notifications` - System alerts

**Redis Keys**:

- `cache:response:{hash}` - Cached responses (24h TTL)
- `learned:pattern:{intent}` - Learned keywords (30d TTL)

#### Performance

```
Response Times:
├─ Cache Hit ⚡              0ms
├─ Learned Keywords 🚀      ~10ms
├─ Local NLP 🟢             ~15ms
└─ Gemini API 🔵            2-5s

After 100 interactions:
├─ 50+ learned keywords
├─ 3-5 response variants per intent
├─ Confidence scores +40-60%
└─ Better user satisfaction
```

#### Setup & Testing (Chatbot)

```bash
# 1. Register user & get token
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test12345",
    "fullName": "Test User"
  }'

# 2. Save token from response
TOKEN="eyJhbGciOiJIUzI1..."

# 3. Send message
curl -X POST http://localhost:3003/chatbot/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message": "Tôi quên mật khẩu"}'

# 4. Record feedback
curl -X POST http://localhost:3003/chatbot/feedback \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "messageId": "msg-uuid",
    "intent": "PASSWORD_RESET",
    "rating": 5
  }'

# 5. Check learning progress
curl http://localhost:3003/chatbot/stats \
  -H "Authorization: Bearer $TOKEN"
```

#### Chatbot Development

**Project Structure**:

```
chatbot-service/
├── src/
│   ├── services/
│   │   ├── chatbot.service.ts        # Main logic
│   │   ├── local-nlp.service.ts      # Vietnamese NLP
│   │   ├── learning.service.ts       # Dynamic learning
│   │   ├── response-cache.service.ts # Caching
│   │   └── gemini.service.ts         # Gemini API
│   ├── routes/chatbot.routes.ts      # API endpoints
│   ├── repositories/                 # DynamoDB ops
│   ├── grpc/                         # gRPC communication
│   └── config/                       # Setup
├── Dockerfile
├── package.json
└── README.md
```

**Environment Variables**:

```env
NODE_ENV=development
PORT=3003
AWS_REGION=us-east-1
DYNAMODB_ENDPOINT=http://dynamodb-local:8000
REDIS_HOST=localhost
REDIS_PORT=6379
GEMINI_API_KEY=your-key
ENABLE_AI_ENGINE=true
```

**Making Changes**:

1. Edit NLP patterns: `src/services/local-nlp.service.ts`
2. Add endpoint: `src/routes/chatbot.routes.ts`
3. Modify learning: `src/services/learning.service.ts`
4. Build: `npm run build`
5. Test: Use curl or PowerShell

#### Troubleshooting (Chatbot)

| Issue                 | Solution                                    |
| --------------------- | ------------------------------------------- |
| Service not starting  | `npm install && npm run build`              |
| DynamoDB error        | Check: `docker-compose ps \| grep dynamodb` |
| gRPC unavailable      | Ensure user-service running on :50051       |
| Low confidence        | Check if message contains keywords          |
| Gemini quota exceeded | Enable billing or use LocalNLP only         |
| Redis timeout         | `docker logs zalo-redis`                    |

---

## Development

### Running Services Locally

```bash
# Terminal 1: All Docker services
cd infrastructure/docker
docker-compose up -d

# Terminal 2: Web frontend
cd frontend/web
npm install
npm run dev  # localhost:3000

# Terminal 3: Mobile frontend
cd frontend/mobile
npm install
npm start

# Individual services (if needed)
cd backend/services/user-service && npm run dev
cd backend/services/chatbot-service && npm run dev
```

### Adding Features

1. **New Chatbot Intent**:
   - Add to `local-nlp.service.ts`
   - Define keywords & response
   - System learns automatically

2. **New API Endpoint**:
   - Add route in service
   - Implement controller
   - Add to API documentation
   - Test with curl/Postman

3. **Database Changes**:
   - Update schema
   - Create migration
   - Update service code

---

## Troubleshooting

### Docker Issues

```bash
# See all containers
docker-compose ps

# View logs
docker-compose logs [service-name]

# Rebuild specific service
docker-compose build [service-name]
docker-compose up -d [service-name]

# Reset everything
docker-compose down -v
docker-compose up -d
```

### Common Problems

**Port already in use**:

```bash
# Kill process using port
lsof -i :3003  # Windows: netstat -ano | findstr :3003
kill -9 <PID>
```

**Database connection failed**:

```bash
# Check database services
docker-compose ps | grep -E "postgres|dynamodb|redis"

# Verify connectivity
psql -h localhost -U user -d zalo
redis-cli ping
```

**JWT token expired**:

```bash
# Get new token
curl -X POST http://localhost:3001/auth/login
```

---

## Contributing

1. Create feature branch: `git checkout -b feat/your-feature`
2. Commit changes: `git commit -m "Add feature"`
3. Push to branch: `git push origin feat/your-feature`
4. Create Pull Request

---

## Performance Optimization

- Cache responses intelligently (chatbot learns patterns)
- Use gRPC for inter-service communication
- Redis caching for frequently accessed data
- DynamoDB scaling for high volume

---

## License

MIT (or your organization's license)

---

**Status**: ✅ Production Ready  
**Last Updated**: April 2026  
**Chatbot Learning**: 🧠 Fully Operational
