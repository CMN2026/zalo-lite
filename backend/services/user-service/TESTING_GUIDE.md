# User Service - Testing Guide

## Test Results ✅

All authentication endpoints have been tested and are working correctly:

### ✅ Registration Test
**Endpoint:** `POST /api/auth/register`
```
Request: { "phone": "0978123456", "password": "Password123" }
Response: 201 Created
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "accountId": "246f7043-f318-48d5-b777-3ec7866bb688",
    "userId": "27a4c01a-aeca-48b8-ba49-3b7e31d677d2",
    "phone": "0978123456",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### ✅ Login Test
**Endpoint:** `POST /api/auth/login`
```
Request: { "phone": "0978123456", "password": "Password123" }
Response: 200 OK
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accountId": "246f7043-f318-48d5-b777-3ec7866bb688",
    "userId": "27a4c01a-aeca-48b8-ba49-3b7e31d677d2",
    "phone": "0978123456",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### ✅ Profile Test (Protected)
**Endpoint:** `GET /api/auth/profile`
**Headers:** `Authorization: Bearer <token>`
```
Response: 200 OK
{
  "success": true,
  "data": {
    "accountId": "246f7043-f318-48d5-b777-3ec7866bb688",
    "userId": "27a4c01a-aeca-48b8-ba49-3b7e31d677d2",
    "phone": "0978123456",
    "status": "active",
    "createdAt": "2026-02-28T05:29:10.978Z"
  }
}
```

### ✅ Logout Test (Protected)
**Endpoint:** `POST /api/auth/logout`
**Headers:** `Authorization: Bearer <token>`
```
Response: 200 OK
{
  "success": true,
  "message": "Logout successful"
}
```

### ✅ Error Handling Test
**Accessing protected endpoint without token:**
```
Request: GET /api/auth/profile (no Authorization header)
Response: 401 Unauthorized
{
  "success": false,
  "message": "No token provided"
}
```

## Running Manual Tests

### PowerShell Test Script

```powershell
# Test Register
$registerBody = @{ phone = "0978123456"; password = "Password123" } | ConvertTo-Json
$register = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/register" `
  -Method Post `
  -Headers @{"Content-Type"="application/json"} `
  -Body $registerBody `
  -UseBasicParsing
$registerData = $register.Content | ConvertFrom-Json

# Extract token
$token = $registerData.data.token

# Test Login
$loginBody = @{ phone = "0978123456"; password = "Password123" } | ConvertTo-Json
Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" `
  -Method Post `
  -Headers @{"Content-Type"="application/json"} `
  -Body $loginBody `
  -UseBasicParsing

# Test Profile with token
Invoke-WebRequest -Uri "http://localhost:3000/api/auth/profile" `
  -Method Get `
  -Headers @{"Authorization"="Bearer $token"} `
  -UseBasicParsing

# Test Logout
Invoke-WebRequest -Uri "http://localhost:3000/api/auth/logout" `
  -Method Post `
  -Headers @{"Authorization"="Bearer $token"} `
  -UseBasicParsing
```

### cURL Test Commands

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phone":"0978123456","password":"Password123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"0978123456","password":"Password123"}'

# Profile (Protected)
curl -X GET http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Logout (Protected)
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Test without token (error)
curl -X GET http://localhost:3000/api/auth/profile
```

## Database Schema

The following tables are created via Prisma migrations:

- **Account** - Stores user credentials and account info
- **User** - Stores user profile information
- **Friendship** - Stores friend relationships
- **Conversation** - Stores conversation/group data
- **ConversationMember** - Stores conversation membership

## Service Architecture

```
┌─────────────────┐
│  API Routes     │
└────────┬────────┘
         │
┌────────▼──────────┐
│   Controllers     │ (Request handling)
└────────┬──────────┘
         │
┌────────▼──────────┐
│   Services        │ (Business logic)
└────────┬──────────┘
         │
┌────────▼──────────┐
│  Repositories     │ (Data access)
└────────┬──────────┘
         │
┌────────▼──────────┐
│  Prisma Client    │
└────────┬──────────┘
         │
┌────────▼──────────┐
│  PostgreSQL DB    │
└───────────────────┘
```

## Middleware

- **authMiddleware** - Validates JWT tokens on protected routes
- **Error Handler** - Catches and responds to server errors

## Utilities

- **jwt.ts** - JWT token generation and verification
- **password.ts** - Password hashing and comparison using bcrypt

## Security Features

✅ JWT token-based authentication
✅ Password hashing with bcrypt (10 salt rounds)
✅ 7-day token expiration
✅ Phone validation (minimum 10 digits)
✅ Password strength validation (minimum 6 characters)
✅ Protected routes require valid token
✅ Account status verification on login

## Next Steps

- Integrate with frontend application
- Add refresh token functionality
- Implement token blacklist for logout
- Add password reset functionality
- Add user profile update endpoints
- Add rate limiting
- Add email verification
