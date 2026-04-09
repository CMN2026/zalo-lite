# User Service API Documentation

## 1. Overview

User Service supports:
- Local system account register/login (email or phone + password)
- Google auth (Gmail)
- JWT authentication
- User profile and avatar update
- Discover users by phone
- Friend request flow
- Role and plan management

Enums in system:
- Roles: `USER`, `ADMIN`
- Plans: `FREE`, `PREMIUM`
- Friendship status: `PENDING`, `ACCEPTED`, `REJECTED`, `BLOCKED`

## 2. Base URL

Direct service:

```txt
http://localhost:3001
```

Via gateway:

```txt
http://localhost:3000/api
```

Gateway mapping:
- `/api/auth/*` -> user-service `/auth/*`
- `/api/users/*` -> user-service `/users/*`
- `/api/admin/users` -> user-service `/users/admin/list`

## 3. JWT

Header:

```txt
Authorization: Bearer <token>
```

Payload:

```json
{
  "userId": "uuid",
  "role": "USER | ADMIN",
  "plan": "FREE | PREMIUM",
  "iat": 1710000000,
  "exp": 1710600000
}
```

## 4. Environment Variables

```env
PORT=3001
DATABASE_URL=postgres://postgres:postgres@localhost:5432/zalo_user
GOOGLE_CLIENT_ID=<google-oauth-client-id>
ADMIN_EMAILS=admin1@gmail.com,admin2@gmail.com
JWT_SECRET=super-secret
JWT_EXPIRES_IN=7d
JWT_ISSUER=zalo-lite-user-service
JWT_AUDIENCE=zalo-lite-clients
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=200
CORS_ORIGINS=http://localhost:3000,http://localhost:3002
```

## 5. Auth APIs

### 5.1 Register Local Account

`POST /auth/register`

Request:

```json
{
  "email": "user01@gmail.com",
  "password": "Password@123",
  "fullName": "Nguyen Van A",
  "phone": "0911222333",
  "avatarUrl": "https://cdn.example.com/a.jpg"
}
```

Response `201`:

```json
{
  "message": "register_success",
  "data": {
    "token": "jwt-token",
    "user": {
      "id": "uuid",
      "email": "user01@gmail.com",
      "fullName": "Nguyen Van A",
      "phone": "0911222333",
      "avatarUrl": "https://cdn.example.com/a.jpg",
      "role": "USER",
      "plan": "FREE"
    }
  }
}
```

### 5.2 Login Local Account

`POST /auth/login`

Request (login with email):

```json
{
  "identifier": "user01@gmail.com",
  "password": "Password@123"
}
```

Request (login with phone):

```json
{
  "identifier": "0911222333",
  "password": "Password@123"
}
```

Response `200`:

```json
{
  "message": "login_success",
  "data": {
    "token": "jwt-token",
    "user": {
      "id": "uuid",
      "email": "user01@gmail.com",
      "fullName": "Nguyen Van A",
      "phone": "0911222333",
      "avatarUrl": "https://cdn.example.com/a.jpg",
      "role": "USER",
      "plan": "FREE"
    }
  }
}
```

### 5.3 Google Auth

`POST /auth/google`

Request:

```json
{
  "idToken": "google-id-token",
  "phone": "0987654321",
  "fullName": "Nguyen Van A",
  "avatarUrl": "https://cdn.example.com/avatars/a.jpg"
}
```

Response `200`:

```json
{
  "message": "auth_success",
  "data": {
    "token": "jwt-token",
    "user": {
      "id": "uuid",
      "email": "abc@gmail.com",
      "fullName": "Nguyen Van A",
      "phone": "0987654321",
      "avatarUrl": "https://cdn.example.com/avatars/a.jpg",
      "role": "USER",
      "plan": "FREE"
    }
  }
}
```

## 6. User APIs (Require JWT)

### 6.1 Get My Profile

`GET /users/me`

Response `200`:

```json
{
  "data": {
    "id": "uuid",
    "email": "abc@gmail.com",
    "phone": "0987654321",
    "fullName": "Nguyen Van A",
    "avatarUrl": "https://cdn.example.com/avatars/a.jpg",
    "bio": "hello",
    "role": "USER",
    "plan": "FREE",
    "isActive": true,
    "createdAt": "2026-04-01T10:00:00.000Z",
    "updatedAt": "2026-04-01T10:05:00.000Z"
  }
}
```

### 6.2 Update Profile

`PATCH /users/me`

Request:

```json
{
  "fullName": "Nguyen Van A Updated",
  "phone": "0911222333",
  "bio": "Loves building chat apps"
}
```

### 6.3 Update Avatar

`PATCH /users/me/avatar`

Request:

```json
{
  "avatarUrl": "https://cdn.example.com/avatars/new-avatar.jpg"
}
```

### 6.4 Discover User by Phone

`GET /users/discover?phone=0911`

### 6.5 Send Friend Request

`POST /users/friend-requests`

Request:

```json
{
  "phone": "0911222333",
  "message": "Kết bạn nhé"
}
```

### 6.6 List Incoming Friend Requests

`GET /users/friend-requests/incoming`

### 6.7 Respond Friend Request

`POST /users/friend-requests/:requestId/respond`

Request:

```json
{
  "action": "accept"
}
```

or

```json
{
  "action": "reject"
}
```

### 6.8 List Friends

`GET /users/friends`

### 6.9 Admin - List Users

`GET /users/admin/list?page=1&limit=20`

Required role: `ADMIN`

## 7. Common Errors

```json
{
  "message": "error_code"
}
```

Common codes:
- `400`: validation_error, cannot_add_yourself
- `401`: unauthorized, invalid_credentials, invalid_google_token, invalid_or_expired_token
- `403`: forbidden, account_inactive, google_email_not_verified
- `404`: user_not_found, target_user_not_found, friend_request_not_found
- `409`: email_already_registered, phone_already_used, already_friends, friend_request_already_pending
- `429`: too many requests
- `500`: internal_server_error

## 8. Quick Test Flow (Postman)

1. `POST /auth/register` create local account and get token.
2. `POST /auth/login` with same account and get token.
3. Use token to call `GET /users/me`.
4. Call `PATCH /users/me` and `PATCH /users/me/avatar`.
5. Use another account to test friend request APIs.
