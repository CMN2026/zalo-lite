import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceNotFoundException,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { env } from "./env.js";

export const dynamoClient = new DynamoDBClient({
  region: env.AWS_REGION,
  endpoint: env.DYNAMODB_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "dummy",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "dummy",
  },
});

export const dynamo = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: { removeUndefinedValues: true },
});

async function tableExists(tableName: string): Promise<boolean> {
  try {
    await dynamoClient.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (error) {
    if (error instanceof ResourceNotFoundException) {
      return false;
    }
    throw error;
  }
}

export async function ensureTables(): Promise<void> {
  const tableCommands = [
    new CreateTableCommand({
      TableName: env.TABLE_CONVERSATIONS,
      AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST",
    }),
    new CreateTableCommand({
      TableName: env.TABLE_CONVERSATION_MEMBERS,
      AttributeDefinitions: [
        { AttributeName: "conversation_id", AttributeType: "S" },
        { AttributeName: "user_id", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "conversation_id", KeyType: "HASH" },
        { AttributeName: "user_id", KeyType: "RANGE" },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "user_id-index",
          KeySchema: [{ AttributeName: "user_id", KeyType: "HASH" }],
          Projection: { ProjectionType: "ALL" },
        },
      ],
      BillingMode: "PAY_PER_REQUEST",
    }),
    new CreateTableCommand({
      TableName: env.TABLE_MESSAGES,
      AttributeDefinitions: [
        { AttributeName: "conversation_id", AttributeType: "S" },
        { AttributeName: "created_at", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "conversation_id", KeyType: "HASH" },
        { AttributeName: "created_at", KeyType: "RANGE" },
      ],
      BillingMode: "PAY_PER_REQUEST",
    }),
    new CreateTableCommand({
      TableName: env.TABLE_FRIEND_REQUESTS,
      AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST",
    }),
    new CreateTableCommand({
      TableName: env.TABLE_FRIENDSHIPS,
      AttributeDefinitions: [
        { AttributeName: "user_id", AttributeType: "S" },
        { AttributeName: "friend_id", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "user_id", KeyType: "HASH" },
        { AttributeName: "friend_id", KeyType: "RANGE" },
      ],
      BillingMode: "PAY_PER_REQUEST",
    }),
  ];

  for (const command of tableCommands) {
    const tableName = command.input.TableName ?? "";
    if (!tableName) {
      continue;
    }
    const exists = await tableExists(tableName);
    if (!exists) {
      await dynamoClient.send(command);
    }
  }
}
