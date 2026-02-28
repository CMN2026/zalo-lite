# User Service - Authentication APIs

## Overview
This user service provides JWT-based authentication APIs for registration, login, and logout functionality.

## API Endpoints

### 1. Register
**Endpoint:** `POST /api/auth/register`

**Description:** Create a new user account

**Request Body:**
```json
{
  "phone": "0123456789",
  "password": "securePassword123"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "accountId": "uuid",
    "userId": "uuid",
    "phone": "0123456789",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Account already exists" | "Password must be at least 6 characters" | "Invalid phone number format"
}
```

---

### 2. Login
**Endpoint:** `POST /api/auth/login`

**Description:** Authenticate user and return JWT token

**Request Body:**
```json
{
  "phone": "0123456789",
  "password": "securePassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accountId": "uuid",
    "userId": "uuid",
    "phone": "0123456789",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "message": "Invalid phone or password" | "Account is not active"
}
```

---

### 3. Logout
**Endpoint:** `POST /api/auth/logout`

**Description:** Logout user (requires authentication)

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

**Error Response (401):**
```json
{
  "success": false,
  "message": "No token provided" | "Invalid or expired token"
}
```

---

### 4. Get Profile
**Endpoint:** `GET /api/auth/profile`

**Description:** Get current user profile (requires authentication)

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accountId": "uuid",
    "userId": "uuid",
    "phone": "0123456789",
    "status": "active",
    "createdAt": "2026-02-28T12:00:00.000Z"
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

**Error Response (404):**
```json
{
  "success": false,
  "message": "Account not found"
}
```

---

## Authentication

All protected endpoints require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

### Token Details
- **Expiration:** 7 days
- **Payload:**
  ```json
  {
    "accountId": "uuid",
    "userId": "uuid",
    "phone": "0123456789"
  }
  ```

## Project Structure

```
src/
├── controllers/
│   └── auth.controller.ts       # API request handlers
├── services/
│   └── auth.service.ts          # Business logic
├── repositories/
│   └── account.repository.ts    # Database operations
├── routes/
│   └── auth.routes.ts           # API routes
├── middlewares/
│   └── auth.middleware.ts       # JWT verification
├── utils/
│   ├── jwt.ts                   # JWT functions
│   └── password.ts              # Password hashing
├── lib/
│   └── prisma.ts                # Prisma client
└── index.ts                     # Express app entry point
```

## Setup & Running

### Prerequisites
- Node.js (v18+)
- PostgreSQL
- Environment variables configured in `.env`

### Installation
```bash
npm install
```

### Database Setup
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy
```

### Development
```bash
npm run dev
```

### Build & Production
```bash
npm run build
npm start
```

## Environment Variables
```env
DATABASE_URL="postgresql://user:password@localhost:5432/zalo_lite?schema=public"
JWT_SECRET="your_secret_key"
PORT=3000
```

## Key Features

✅ **User Registration** - Create new accounts with phone and password
✅ **User Login** - Authenticate and receive JWT token
✅ **JWT Authentication** - Secure token-based authentication
✅ **Password Hashing** - Bcrypt for secure password storage
✅ **Profile Management** - Retrieve user profile information
✅ **Logout** - Logout functionality (token-based invalidation)
✅ **Input Validation** - Phone format and password strength validation
✅ **Error Handling** - Comprehensive error responses

## Example Usage

### Register New User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "0978123456",
    "password": "Password123"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "0978123456",
    "password": "Password123"
  }'
```

### Get Profile (Protected)
```bash
curl -X GET http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Logout (Protected)
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Notes

- Passwords are hashed using bcrypt with 10 salt rounds
- JWT tokens expire after 7 days
- All phone numbers must be at least 10 digits
- Passwords must be at least 6 characters long
- Account status is automatically set to "active" on registration
