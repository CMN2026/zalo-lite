declare namespace Express {
  interface Request {
    auth?: {
      user_id: string;
    };
  }
}
