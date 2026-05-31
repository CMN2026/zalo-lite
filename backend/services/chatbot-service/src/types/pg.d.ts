declare module "pg" {
  export class PoolClient {
    query<T = any>(
      queryText: string,
      values?: unknown[],
    ): Promise<{ rows: T[] }>;
    release(): void;
  }

  export class Pool {
    constructor(config?: { connectionString?: string; max?: number });
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
  }
}
