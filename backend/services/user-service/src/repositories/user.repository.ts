import { PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";
import { db } from "../config/db.js";

export type UserProfile = {
  id: string;
  account_id: string;
  full_name: string | null;
  birth_date: string | null;
  gender: string | null;
  avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
  phone: string;
};

type CreateUserInput = {
  account_id: string;
  full_name: string;
  birth_date: string | null;
  gender: string | null;
  avatar_url: string | null;
};

export class UserRepository {
  async create(input: CreateUserInput, client?: PoolClient) {
    const executor = client ?? db;
    const result = await executor.query(
      `
      INSERT INTO users (
        id, account_id, full_name, birth_date, gender, avatar_url, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
      `,
      [
        uuidv4(),
        input.account_id,
        input.full_name,
        input.birth_date,
        input.gender,
        input.avatar_url,
      ],
    );

    return result.rows[0];
  }

  async findByAccountId(accountId: string) {
    const result = await db.query(
      `
      SELECT * FROM users
      WHERE account_id = $1
      LIMIT 1
      `,
      [accountId],
    );

    return result.rows[0] ?? null;
  }

  async findById(userId: string): Promise<UserProfile | null> {
    const result = await db.query<UserProfile>(
      `
      SELECT
        u.id,
        u.account_id,
        u.full_name,
        u.birth_date::text,
        u.gender,
        u.avatar_url,
        u.created_at,
        u.updated_at,
        a.phone
      FROM users u
      INNER JOIN accounts a ON a.id = u.account_id
      WHERE u.id = $1
      LIMIT 1
      `,
      [userId],
    );

    return result.rows[0] ?? null;
  }

  async searchByPhone(phoneKeyword: string): Promise<UserProfile[]> {
    const result = await db.query<UserProfile>(
      `
      SELECT
        u.id,
        u.account_id,
        u.full_name,
        u.birth_date::text,
        u.gender,
        u.avatar_url,
        u.created_at,
        u.updated_at,
        a.phone
      FROM users u
      INNER JOIN accounts a ON a.id = u.account_id
      WHERE a.phone ILIKE $1
      ORDER BY u.created_at DESC
      LIMIT 20
      `,
      [`%${phoneKeyword}%`],
    );

    return result.rows;
  }
}
