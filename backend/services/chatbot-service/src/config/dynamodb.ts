import {
  DynamoDBClient,
  CreateTableCommand,
  ListTablesCommand,
  DescribeTableCommand,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { env } from "./env.js";

const client = new DynamoDBClient({
  region: env.AWS_REGION,
  endpoint: env.DYNAMODB_ENDPOINT,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export const dynamoDB = DynamoDBDocumentClient.from(client);

export async function initDynamoDB(): Promise<void> {
  try {
    // Ensure tables exist
    await ensureTablesExist();
    console.log("DynamoDB initialized successfully");
  } catch (error) {
    console.error("Failed to initialize DynamoDB:", error);
    throw error;
  }
}

async function ensureTablesExist(): Promise<void> {
  const tables = [
    env.TABLE_CONVERSATIONS,
    env.TABLE_FAQ,
    env.TABLE_NOTIFICATIONS,
    env.TABLE_ANALYTICS,
  ];

  for (const tableName of tables) {
    try {
      await client.send(new DescribeTableCommand({ TableName: tableName }));
      console.log(`Table ${tableName} exists`);
    } catch (error: any) {
      if (error.name === "ResourceNotFoundException") {
        console.log(`Creating table ${tableName}...`);
        await createTable(tableName);
      } else {
        throw error;
      }
    }
  }
}

async function createTable(tableName: string): Promise<void> {
  let params: any;

  switch (tableName) {
    case env.TABLE_CONVERSATIONS:
      params = {
        TableName: tableName,
        KeySchema: [
          { AttributeName: "conversationId", KeyType: "HASH" },
          { AttributeName: "createdAt", KeyType: "RANGE" },
        ],
        AttributeDefinitions: [
          { AttributeName: "conversationId", AttributeType: "S" },
          { AttributeName: "createdAt", AttributeType: "N" },
          { AttributeName: "userId", AttributeType: "S" },
          { AttributeName: "lastMessageAt", AttributeType: "N" },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: "userId-lastMessageAt-index",
            KeySchema: [
              { AttributeName: "userId", KeyType: "HASH" },
              { AttributeName: "lastMessageAt", KeyType: "RANGE" },
            ],
            Projection: { ProjectionType: "ALL" },
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5,
            },
          },
        ],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      };
      break;

    case env.TABLE_FAQ:
      params = {
        TableName: tableName,
        KeySchema: [{ AttributeName: "questionId", KeyType: "HASH" }],
        AttributeDefinitions: [
          { AttributeName: "questionId", AttributeType: "S" },
          { AttributeName: "category", AttributeType: "S" },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: "category-index",
            KeySchema: [{ AttributeName: "category", KeyType: "HASH" }],
            Projection: { ProjectionType: "ALL" },
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5,
            },
          },
        ],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      };
      break;

    case env.TABLE_NOTIFICATIONS:
      params = {
        TableName: tableName,
        KeySchema: [
          { AttributeName: "notificationId", KeyType: "HASH" },
          { AttributeName: "sentAt", KeyType: "RANGE" },
        ],
        AttributeDefinitions: [
          { AttributeName: "notificationId", AttributeType: "S" },
          { AttributeName: "sentAt", AttributeType: "N" },
          { AttributeName: "type", AttributeType: "S" },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: "type-sentAt-index",
            KeySchema: [
              { AttributeName: "type", KeyType: "HASH" },
              { AttributeName: "sentAt", KeyType: "RANGE" },
            ],
            Projection: { ProjectionType: "ALL" },
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5,
            },
          },
        ],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
        TimeToLiveSpecification: {
          AttributeName: "ttl",
          Enabled: true,
        },
      };
      break;

    case env.TABLE_ANALYTICS:
      params = {
        TableName: tableName,
        KeySchema: [
          { AttributeName: "date", KeyType: "HASH" },
          { AttributeName: "hour", KeyType: "RANGE" },
        ],
        AttributeDefinitions: [
          { AttributeName: "date", AttributeType: "S" },
          { AttributeName: "hour", AttributeType: "N" },
        ],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      };
      break;

    default:
      throw new Error(`Unknown table: ${tableName}`);
  }

  await client.send(new CreateTableCommand(params));
  console.log(`Table ${tableName} created`);
}

export { dynamoDB as db };
