# User Service - Authentication & User Profile APIs

## Overview

The User Service provides JWT-based authentication and user profile management APIs. It manages user account registration, login, and profile queries using PostgreSQL with atomic transaction support.

## Base URL

```
http://localhost:3001
```

## Authentication

All protected endpoints require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

### Token Details
- **Expiration:** 7 days
- **Issuer:** `zalo-lite-user-service`
- **Audience:** `zalo-lite-clients`
- **Payload:**
  ```json
  {
    "user_id": "uuid"
  }
  ```

---

## API Endpoints

### 1. User Registration

**Endpoint:** `POST /auth/register`

**Description:** Create a new user account with phone, password, and profile information.

**Request Body:**
```json
{
  "phone": "0978123456",
  "password": "SecurePassword123",
  "full_name": "John Doe",
  "email": "john@example.com",
  "birth_date": "1990-05-15",
  "gender": "male"
}
```

**Validation Rules:**
- `phone`: Required, 8-20 characters
- `password`: Required, 8-72 characters
- `full_name`: Required, 2-100 characters
- `email`: Optional, valid email format
- `birth_date`: Optional, ISO 8601 format (YYYY-MM-DD)
- `gender`: Optional, one of: male, female, other

**Response (201 Created):**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "account_id": "550e8400-e29b-41d4-a716-446655440001",
  "phone": "0978123456",
  "full_name": "John Doe",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNTUwZTg0MDAi..."
}
```

**Error Response (400):**
```json
{
  "statusCode": 400,
  "message": "Phone already exists",
  "errors": [
    {
      "field": "phone",
      "message": "This phone number is already registered"
    }
  ]
}
```

**Error Response (422 Validation):**
```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [
    {
      "field": "phone",
      "message": "Phone must be between 8 and 20 characters"
    },
    {
      "field": "password",
      "message": "Password must be at least 8 characters"
    }
  ]
}
```

---

### 2. User Login

**Endpoint:** `POST /auth/login`

**Description:** Authenticate user with phone and password, return JWT token.

**Request Body:**
```json
{
  "phone": "0978123456",
  "password": "SecurePassword123"
}
```

**Response (200 OK):**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "account_id": "550e8400-e29b-41d4-a716-446655440001",
  "phone": "0978123456",
  "full_name": "John Doe",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNTUwZTg0MDAi..."
}
```

**Error Response (401):**
```json
{
  "statusCode": 401,
  "message": "Invalid phone or password"
}
```

**Error Response (422 Validation):**
```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [
    {
      "field": "phone",
      "message": "Phone is required"
    }
  ]
}
```

---

### 3. Get Current User Profile (Protected)

**Endpoint:** `GET /users/me`

**Description:** Retrieve the authenticated user's profile information.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "account_id": "550e8400-e29b-41d4-a716-446655440001",
  "phone": "0978123456",
  "full_name": "John Doe",
  "email": "john@example.com",
  "birth_date": "1990-05-15",
  "gender": "male",
  "avatar_url": null,
  "created_at": "2026-02-28T12:00:00.000Z",
  "updated_at": "2026-02-28T12:00:00.000Z"
}
```

**Error Response (401):**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

---

### 4. Get User by ID

**Endpoint:** `GET /users/:id`

**Description:** Retrieve a specific user's profile by their user ID.

**Parameters:**
- `id` (path): User ID (UUID format)

**Response (200 OK):**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "account_id": "550e8400-e29b-41d4-a716-446655440001",
  "phone": "0978123456",
  "full_name": "John Doe",
  "email": "john@example.com",
  "birth_date": "1990-05-15",
  "gender": "male",
  "avatar_url": null,
  "created_at": "2026-02-28T12:00:00.000Z",
  "updated_at": "2026-02-28T12:00:00.000Z"
}
```

**Error Response (404):**
```json
{
  "statusCode": 404,
  "message": "User not found"
}
```

**Error Response (400):**
```json
{
  "statusCode": 400,
  "message": "Invalid user ID format"
}
```

---

### 5. Search Users by Phone

**Endpoint:** `GET /users/search?phone=<phone>`

**Description:** Search for users by phone number (case-insensitive partial match). Supports pagination.

**Query Parameters:**
- `phone` (required): Phone number to search for (min 3 characters)
- `limit` (optional): Maximum number of results (default: 20, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response (200 OK):**
```json
[
  {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "account_id": "550e8400-e29b-41d4-a716-446655440001",
    "phone": "0978123456",
    "full_name": "John Doe",
    "email": "john@example.com",
    "birth_date": "1990-05-15",
    "gender": "male",
    "avatar_url": null,
    "created_at": "2026-02-28T12:00:00.000Z",
    "updated_at": "2026-02-28T12:00:00.000Z"
  },
  {
    "user_id": "550e8400-e29b-41d4-a716-446655440002",
    "account_id": "550e8400-e29b-41d4-a716-446655440003",
    "phone": "0978123457",
    "full_name": "Jane Smith",
    "email": "jane@example.com",
    "birth_date": "1992-03-22",
    "gender": "female",
    "avatar_url": null,
    "created_at": "2026-03-01T08:00:00.000Z",
    "updated_at": "2026-03-01T08:00:00.000Z"
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

## Error Handling

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
| 400  | Bad Request / Duplicate Entry |
| 401  | Unauthorized / Invalid Token |
| 404  | Not Found |
| 422  | Validation Failed |
| 429  | Too Many Requests (Rate Limited) |
| 500  | Internal Server Error |

---

## Rate Limiting

Rate limiting is applied to all endpoints:

- **Window:** 60 seconds
- **Rate:** 200 requests per window
- **Header:** `X-RateLimit-Remaining`

When rate limit is exceeded:

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
│   ├── db.ts                    # PostgreSQL pool configuration
│   └── http-error.ts            # Custom error class
├── controllers/
│   ├── auth.controller.ts       # Authentication handlers
│   └── user.controller.ts       # User profile handlers
├── services/
│   ├── auth.service.ts          # Authentication logic
│   └── user.service.ts          # User profile logic
├── repositories/
│   ├── account.repository.ts    # Account database queries
│   └── user.repository.ts       # User database queries
├── routes/
│   ├── auth.routes.ts           # Authentication routes
│   └── user.routes.ts           # User profile routes
├── middlewares/
│   ├── auth.middleware.ts       # JWT verification
│   ├── error.middleware.ts      # Error handling
│   └── validate.middleware.ts   # Input validation
├── utils/
│   ├── jwt.ts                   # JWT signing/verification
│   └── password.ts              # Password hashing/comparison
├── types/
│   └── express.d.ts             # Express type augmentation
└── index.ts                     # Express app entry point
```

---

## Database Schema

### Accounts Table
```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY,
  phone VARCHAR(20) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  account_type VARCHAR(50) DEFAULT 'individual',
  status VARCHAR(20) DEFAULT 'active',
  email VARCHAR(255),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_accounts_phone ON accounts(phone);
```

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL UNIQUE REFERENCES accounts(id),
  full_name VARCHAR(100) NOT NULL,
  birth_date DATE,
  gender VARCHAR(20),
  avatar_url VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_account_id ON users(account_id);
```

---

## Setup & Running

### Prerequisites
- Node.js v22+
- PostgreSQL 16+
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
PORT=3001
DATABASE_URL=postgres://zalo:zalo@localhost:5432/zalo_user
JWT_SECRET=super-strong-jwt-secret
JWT_EXPIRES_IN=7d
JWT_ISSUER=zalo-lite-user-service
JWT_AUDIENCE=zalo-lite-clients
BCRYPT_ROUNDS=10
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=200
```

### Running

```bash
# Development with auto-reload
npm run dev

# Production
npm start
```

---

## Example Usage

### Register a New User

```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "0978123456",
    "password": "SecurePassword123",
    "full_name": "John Doe",
    "email": "john@example.com",
    "birth_date": "1990-05-15",
    "gender": "male"
  }'
```

### Login

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "0978123456",
    "password": "SecurePassword123"
  }'
```

### Get Current User Profile

```bash
curl -X GET http://localhost:3001/users/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Get User by ID

```bash
curl -X GET http://localhost:3001/users/550e8400-e29b-41d4-a716-446655440000
```

### Search Users by Phone

```bash
curl -X GET "http://localhost:3001/users/search?phone=0978&limit=10"
```

---

## Security Features

✅ **Password Hashing** - Bcrypt with 10 salt rounds  
✅ **JWT Authentication** - Token-based authorization with issuer/audience validation  
✅ **Input Validation** - express-validator on all endpoints  
✅ **Security Headers** - helmet middleware  
✅ **Rate Limiting** - Request throttling per IP  
✅ **Atomic Transactions** - PostgreSQL transactions for data consistency  
✅ **CORS Ready** - Configurable for frontend integration  

---

## Performance Considerations

- Connection pooling: Max 20 concurrent connections to PostgreSQL
- Search queries use ILIKE with LIMIT 20 by default
- Indexes on `phone` and `account_id` for fast lookups
- Transaction support for atomic account + user creation

---

## Testing the Service

Once Docker Compose is running, test with:

```bash
# Health check
curl http://localhost:3001/health

# Register test user
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "09111111111",
    "password": "Test123456",
    "full_name": "Test User"
  }'

# Login test user  
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "09111111111",
    "password": "Test123456"
  }'
```
