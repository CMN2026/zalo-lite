declare namespace Express {
  interface Request {
    auth?: {
      user_id: string;
      iat?: number;
      exp?: number;
      iss?: string;
      aud?: string;
    };
  }
}
