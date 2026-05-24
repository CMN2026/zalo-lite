import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceNotFoundException,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { env } from "./env.js";

// Build config dynamically
const clientConfig: any = {
  region: env.AWS_REGION,
};

if (env.DYNAMODB_ENDPOINT && env.DYNAMODB_ENDPOINT.trim() !== "") {
  clientConfig.endpoint = env.DYNAMODB_ENDPOINT;
}

const accessKeyId = process.env.AWS_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY;

if (accessKeyId && secretAccessKey && accessKeyId !== "dummy") {
  clientConfig.credentials = { accessKeyId, secretAccessKey };
} else if (clientConfig.endpoint) {
  // If local, provide dummy credentials so DynamoDB local client doesn't complain
  clientConfig.credentials = {
    accessKeyId: "dummy",
    secretAccessKey: "dummy",
  };
}

export const dynamoClient = new DynamoDBClient(clientConfig);

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
    // Posts table: PK = id, GSI on user_id + created_at for user's posts
    new CreateTableCommand({
      TableName: env.TABLE_POSTS,
      AttributeDefinitions: [
        { AttributeName: "id", AttributeType: "S" },
        { AttributeName: "user_id", AttributeType: "S" },
        { AttributeName: "created_at", AttributeType: "S" },
      ],
      KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
      GlobalSecondaryIndexes: [
        {
          IndexName: "user_id-index",
          KeySchema: [
            { AttributeName: "user_id", KeyType: "HASH" },
            { AttributeName: "created_at", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        },
      ],
      BillingMode: "PAY_PER_REQUEST",
    }),
    // Post comments table: PK = post_id, SK = created_at
    new CreateTableCommand({
      TableName: env.TABLE_POST_COMMENTS,
      AttributeDefinitions: [
        { AttributeName: "post_id", AttributeType: "S" },
        { AttributeName: "created_at", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "post_id", KeyType: "HASH" },
        { AttributeName: "created_at", KeyType: "RANGE" },
      ],
      BillingMode: "PAY_PER_REQUEST",
    }),
    // Post reactions table: PK = post_id, SK = user_id (ensures 1 reaction per user per post)
    new CreateTableCommand({
      TableName: env.TABLE_POST_REACTIONS,
      AttributeDefinitions: [
        { AttributeName: "post_id", AttributeType: "S" },
        { AttributeName: "user_id", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "post_id", KeyType: "HASH" },
        { AttributeName: "user_id", KeyType: "RANGE" },
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
      console.log(`✅ Created DynamoDB table: ${tableName}`);
    } else {
      console.log(`ℹ️  DynamoDB table already exists: ${tableName}`);
    }
  }
}
