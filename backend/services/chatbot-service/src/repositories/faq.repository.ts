import { v4 as uuidv4 } from "uuid";
import { dynamoDB } from "../config/dynamodb.js";
import { env } from "../config/env.js";
import { PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

export interface IFAQ {
  questionId: string;
  question: string;
  answer: string;
  category: string;
  keywords: string[];
  views: number;
  createdBy: string;
  updatedAt: number;
}

export class FAQRepository {
  async create(
    question: string,
    answer: string,
    category: string,
    keywords: string[],
    createdBy: string,
  ): Promise<IFAQ> {
    const questionId = uuidv4();
    const now = Date.now();

    const faq: IFAQ = {
      questionId,
      question,
      answer,
      category,
      keywords,
      views: 0,
      createdBy,
      updatedAt: now,
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: env.TABLE_FAQ,
        Item: faq,
      }),
    );

    return faq;
  }

  async findByCategory(category: string): Promise<IFAQ[]> {
    const result = await dynamoDB.send(
      new QueryCommand({
        TableName: env.TABLE_FAQ,
        IndexName: "category-index",
        KeyConditionExpression: "category = :category",
        ExpressionAttributeValues: {
          ":category": category,
        },
      }),
    );

    return (result.Items as IFAQ[]) || [];
  }

  async getAll(): Promise<IFAQ[]> {
    const result = await dynamoDB.send(
      new ScanCommand({
        TableName: env.TABLE_FAQ,
      }),
    );

    return (result.Items as IFAQ[]) || [];
  }

  async search(keywords: string[]): Promise<IFAQ[]> {
    // Simple search - get all and filter
    const allFaqs = await this.getAll();
    return allFaqs.filter((faq) =>
      keywords.some(
        (kw) =>
          faq.question.toLowerCase().includes(kw.toLowerCase()) ||
          faq.answer.toLowerCase().includes(kw.toLowerCase()) ||
          faq.keywords.some((k) => k.toLowerCase().includes(kw.toLowerCase())),
      ),
    );
  }
}

export const faqRepository = new FAQRepository();
