import { PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";
import { db } from "../config/db.js";

export type Account = {
  id: string;
  phone: string;
  password_hash: string;
  account_type: string;
  status: string;
  email: string | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type CreateAccountInput = {
  phone: string;
  password_hash: string;
  account_type: string;
  status: string;
  email: string | null;
};

export class AccountRepository {
  async findByPhone(phone: string): Promise<Account | null> {
    const result = await db.query<Account>(
      `
      SELECT *
      FROM accounts
      WHERE phone = $1
      LIMIT 1
      `,
      [phone],
    );
    return result.rows[0] ?? null;
  }

  async create(input: CreateAccountInput, client?: PoolClient): Promise<Account> {
    const executor = client ?? db;
    const result = await executor.query<Account>(
      `
      INSERT INTO accounts (
        id, phone, password_hash, account_type, status, email, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
      `,
      [
        uuidv4(),
        input.phone,
        input.password_hash,
        input.account_type,
        input.status,
        input.email,
      ],
    );
    return result.rows[0];
  }

  async updateLastLoginAt(accountId: string): Promise<void> {
    await db.query(
      `
      UPDATE accounts
      SET last_login_at = NOW(), updated_at = NOW()
      WHERE id = $1
      `,
      [accountId],
    );
  }
}
