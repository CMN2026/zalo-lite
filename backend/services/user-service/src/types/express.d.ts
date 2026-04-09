declare namespace Express {
  interface Request {
    auth?: {
      userId: string;
      role: "USER" | "ADMIN";
      plan: "FREE" | "PREMIUM";
      iat?: number;
      exp?: number;
      iss?: string;
      aud?: string;
    };
  }
}
