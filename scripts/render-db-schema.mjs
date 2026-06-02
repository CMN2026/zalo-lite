import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const userSchemaPath = path.join(
  rootDir,
  "backend",
  "services",
  "user-service",
  "prisma",
  "schema.prisma",
);
const outputDir = path.join(rootDir, "docs");
const outputPath = path.join(outputDir, "database-schemas.puml");

const chatTables = [
  {
    name: "conversations",
    fields: [
      { name: "id", type: "string", tags: ["PK"] },
      { name: "type", type: "direct | group" },
      { name: "name", type: "string?" },
      { name: "created_by", type: "string", ref: "users.id" },
      { name: "last_message_at", type: "datetime?" },
      { name: "created_at", type: "datetime" },
    ],
    notes: ["Primary key: id"],
  },
  {
    name: "conversation_members",
    fields: [
      { name: "conversation_id", type: "string", tags: ["PK", "FK"], ref: "conversations.id" },
      { name: "user_id", type: "string", tags: ["SK", "FK"], ref: "users.id" },
      { name: "role", type: "owner | member" },
      { name: "joined_at", type: "datetime" },
      { name: "hidden_at", type: "datetime?" },
      { name: "cleared_at", type: "datetime?" },
      { name: "last_read_at", type: "datetime?" },
      { name: "unread_count", type: "number" },
    ],
    notes: ["GSI: user_id-index (HASH user_id)"],
  },
  {
    name: "messages",
    fields: [
      { name: "conversation_id", type: "string", tags: ["PK", "FK"], ref: "conversations.id" },
      { name: "created_at", type: "datetime", tags: ["SK"] },
      { name: "id", type: "string", tags: ["ALT"] },
      { name: "sender_id", type: "string", tags: ["FK"], ref: "users.id" },
      { name: "type", type: "string" },
      { name: "content", type: "string" },
      { name: "read_by", type: "string[]" },
      { name: "reply_to_message_id", type: "string?" },
      { name: "reactions", type: "MessageReaction[]" },
      { name: "deleted_for_user_ids", type: "string[]" },
      { name: "deleted_at", type: "datetime?" },
      { name: "recalled_at", type: "datetime?" },
      { name: "recalled_by", type: "string?" },
    ],
    notes: ["Primary access: query by conversation_id + created_at", "Lookup by id currently uses Scan"],
  },
  {
    name: "friend_requests",
    fields: [
      { name: "id", type: "string", tags: ["PK"] },
      { name: "sender_id", type: "string", tags: ["FK"], ref: "users.id" },
      { name: "receiver_id", type: "string", tags: ["FK"], ref: "users.id" },
      { name: "status", type: "pending | accepted | rejected" },
      { name: "created_at", type: "datetime" },
    ],
    notes: ["Primary key: id"],
  },
  {
    name: "friendships",
    fields: [
      { name: "user_id", type: "string", tags: ["PK", "FK"], ref: "users.id" },
      { name: "friend_id", type: "string", tags: ["SK", "FK"], ref: "users.id" },
      { name: "nickname", type: "string?" },
      { name: "is_favorite", type: "boolean?" },
      { name: "created_at", type: "datetime" },
    ],
    notes: ["Composite key: user_id + friend_id"],
  },
  {
    name: "call_sessions",
    fields: [
      { name: "id", type: "string", tags: ["PK"] },
      { name: "conversation_id", type: "string", tags: ["FK"], ref: "conversations.id" },
      { name: "call_type", type: "direct | group" },
      { name: "initiator_id", type: "string", tags: ["FK"], ref: "users.id" },
      { name: "participants", type: "CallSessionParticipant[]" },
      { name: "participant_user_ids", type: "string[]" },
      { name: "status", type: "active | ended" },
      { name: "started_at", type: "datetime" },
      { name: "ended_at", type: "datetime?" },
      { name: "duration_seconds", type: "number?" },
      { name: "end_reason", type: "string?" },
    ],
    notes: ["Lookup active calls by scan on status/participants or conversation_id"],
  },
  {
    name: "call_history",
    fields: [
      { name: "user_id", type: "string", tags: ["PK", "FK"], ref: "users.id" },
      { name: "created_at_call_id", type: "string", tags: ["SK"] },
      { name: "call_id", type: "string", tags: ["FK"], ref: "call_sessions.id" },
      { name: "conversation_id", type: "string", tags: ["FK"], ref: "conversations.id" },
      { name: "call_type", type: "direct | group" },
      { name: "initiator_id", type: "string", tags: ["FK"], ref: "users.id" },
      { name: "status", type: "answered | declined | missed" },
      { name: "started_at", type: "datetime" },
      { name: "ended_at", type: "datetime?" },
      { name: "duration_seconds", type: "number?" },
      { name: "end_reason", type: "string?" },
      { name: "participant_user_ids", type: "string[]" },
    ],
    notes: ["Composite key: user_id + created_at_call_id"],
  },
];

const postTables = [
  {
    name: "posts",
    fields: [
      { name: "id", type: "string", tags: ["PK"] },
      { name: "user_id", type: "string", tags: ["FK"], ref: "users.id" },
      { name: "content", type: "string" },
      { name: "images", type: "string[]" },
      { name: "visibility", type: "friends | public" },
      { name: "reaction_summary", type: "ReactionSummary" },
      { name: "comment_count", type: "number" },
      { name: "created_at", type: "datetime" },
      { name: "updated_at", type: "datetime" },
      { name: "deleted_at", type: "datetime?" },
    ],
    notes: ["GSI: user_id-index (HASH user_id, RANGE created_at)"],
  },
  {
    name: "post_comments",
    fields: [
      { name: "post_id", type: "string", tags: ["PK", "FK"], ref: "posts.id" },
      { name: "created_at", type: "datetime", tags: ["SK"] },
      { name: "id", type: "string", tags: ["ALT"] },
      { name: "user_id", type: "string", tags: ["FK"], ref: "users.id" },
      { name: "content", type: "string" },
      { name: "deleted_at", type: "datetime?" },
    ],
    notes: ["Primary access: query by post_id + created_at", "Lookup by id currently uses Scan"],
  },
  {
    name: "post_reactions",
    fields: [
      { name: "post_id", type: "string", tags: ["PK", "FK"], ref: "posts.id" },
      { name: "user_id", type: "string", tags: ["SK", "FK"], ref: "users.id" },
      { name: "reaction", type: "like | love | haha | sad | angry" },
      { name: "created_at", type: "datetime" },
    ],
    notes: ["Composite key guarantees one reaction per user per post"],
  },
];

async function main() {
  const prismaSchema = await fs.readFile(userSchemaPath, "utf8");
  const prismaModels = withEntityIds(parsePrismaModels(prismaSchema), "user");
  const chatModels = withEntityIds(chatTables, "chat");
  const postModels = withEntityIds(postTables, "post");
  const uml = buildPlantUml(prismaModels, chatModels, postModels);

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, uml, "utf8");

  console.log(`Rendered database schema to ${path.relative(rootDir, outputPath)}`);
}

function parsePrismaModels(schemaText) {
  const models = [];
  const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;

  for (const match of schemaText.matchAll(modelRegex)) {
    const [, modelName, body] = match;
    const fields = [];

    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("//") || line.startsWith("@@")) {
        continue;
      }

      const parts = line.split(/\s+/);
      if (parts.length < 2) {
        continue;
      }

      const [fieldName, fieldType, ...attrs] = parts;
      if (isRelationOnlyField(fieldType)) {
        continue;
      }

      const tags = [];
      let ref = null;

      if (attrs.some((attr) => attr.startsWith("@id"))) {
        tags.push("PK");
      }
      if (attrs.some((attr) => attr.startsWith("@unique"))) {
        tags.push("UQ");
      }
      const relationAttr = attrs.find((attr) => attr.startsWith("@relation"));
      if (relationAttr) {
        tags.push("FK");
        const referencesMatch = relationAttr.match(/references:\s*\[([^\]]+)\]/);
        if (referencesMatch) {
          ref = referencesMatch[1].trim();
        }
      }

      fields.push({
        name: extractMappedName(fieldName, attrs),
        type: normalizePrismaType(fieldType),
        tags,
        ref,
      });
    }

    const mappedNameMatch = body.match(/@@map\("([^"]+)"\)/);
    models.push({
      modelName,
      tableName: mappedNameMatch?.[1] ?? modelName,
      fields,
    });
  }

  return models;
}

function isRelationOnlyField(fieldType) {
  const scalarTypes = new Set([
    "String",
    "Int",
    "Boolean",
    "DateTime",
    "Float",
    "Decimal",
    "Json",
    "Bytes",
    "BigInt",
  ]);

  const normalized = fieldType.replace("?", "").replace("[]", "");
  if (scalarTypes.has(normalized)) {
    return false;
  }

  return true;
}

function extractMappedName(fieldName, attrs) {
  const mapped = attrs.find((attr) => attr.startsWith("@map("));
  if (!mapped) {
    return fieldName;
  }

  const match = mapped.match(/@map\("([^"]+)"\)/);
  return match?.[1] ?? fieldName;
}

function normalizePrismaType(fieldType) {
  const optional = fieldType.endsWith("?");
  const array = fieldType.endsWith("[]");
  const base = fieldType.replace("?", "").replace("[]", "");

  const normalizedBase =
    {
      String: "string",
      Int: "int",
      Boolean: "boolean",
      DateTime: "datetime",
      Float: "float",
      Decimal: "decimal",
      Json: "json",
      Bytes: "bytes",
      BigInt: "bigint",
    }[base] ?? base;

  return `${normalizedBase}${array ? "[]" : ""}${optional ? "?" : ""}`;
}

function withEntityIds(tables, prefix) {
  return tables.map((table) => ({
    ...table,
    entityId: `${prefix}_${sanitizeId(table.tableName ?? table.name)}`,
  }));
}

function buildPlantUml(prismaModels, chat, post) {
  const lines = [
    "@startuml DatabaseSchemas",
    "hide circle",
    "hide methods",
    "skinparam linetype ortho",
    "skinparam packageStyle rectangle",
    "skinparam shadowing false",
    "skinparam class {",
    "  BackgroundColor White",
    "  BorderColor #4B5563",
    "  ArrowColor #6B7280",
    "}",
    "",
    'title Zalo Lite Database Schema',
    "",
    'package "user-service (PostgreSQL)" {',
    ...prismaModels.flatMap(renderEntity),
    "}",
    "",
    'package "chat-service (DynamoDB)" {',
    ...chat.flatMap(renderEntity),
    "}",
    "",
    'package "post-service (DynamoDB)" {',
    ...post.flatMap(renderEntity),
    "}",
    "",
    ...buildRelationships(prismaModels, chat, post),
    "",
    "@enduml",
    "",
  ];

  return lines.join("\n");
}

function renderEntity(table) {
  const entityName = table.entityId;
  const displayName = table.tableName ?? table.name;
  const fields = table.fields.map((field) => {
    const tags = field.tags?.length ? ` <<${field.tags.join(", ")}>>` : "";
    return `  ${field.name} : ${field.type}${tags}`;
  });

  const lines = [`entity "${displayName}" as ${entityName} {`, ...fields, "}"];

  for (const note of table.notes ?? []) {
    lines.push(`note right of ${entityName}`);
    lines.push(`  ${note}`);
    lines.push("end note");
  }

  lines.push("");
  return lines;
}

function buildRelationships(prismaModels, chat, post) {
  const allTables = [...prismaModels, ...chat, ...post];
  const tableNames = new Set(allTables.map((table) => table.tableName ?? table.name));
  const tablesByName = new Map(
    allTables.map((table) => [table.tableName ?? table.name, table]),
  );
  const seen = new Set();
  const relationships = [];

  for (const table of allTables) {
    const sourceName = table.tableName ?? table.name;

    for (const field of table.fields) {
      const targetTable = inferTargetTable(field, tableNames);
      if (!targetTable) {
        continue;
      }

      const key = `${sourceName}:${field.name}->${targetTable}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      const targetTableMeta = tablesByName.get(targetTable);
      if (!targetTableMeta) {
        continue;
      }

      relationships.push(
        `${table.entityId} }o--|| ${targetTableMeta.entityId} : ${field.name}`,
      );
    }
  }

  return relationships.sort();
}

function inferTargetTable(field, tableNames) {
  if (field.ref) {
    const explicit = field.ref.split(".")[0];
    if (tableNames.has(explicit)) {
      return explicit;
    }
  }

  if (!field.name.endsWith("_id")) {
    return null;
  }

  const singular = field.name.replace(/_id$/, "");
  const candidates = [
    singular,
    `${singular}s`,
    singular === "user" ? "users" : null,
    singular === "friend" ? "users" : null,
    singular === "sender" ? "users" : null,
    singular === "receiver" ? "users" : null,
    singular === "requester" ? "users" : null,
    singular === "addressee" ? "users" : null,
    singular === "initiator" ? "users" : null,
    singular === "created_by" ? "users" : null,
  ].filter(Boolean);

  return candidates.find((candidate) => tableNames.has(candidate)) ?? null;
}

function sanitizeId(value) {
  return value.replace(/[^A-Za-z0-9_]/g, "_");
}

await main();
