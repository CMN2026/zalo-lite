import "dotenv/config";
import http from "node:http";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import { env } from "./config/env.js";
import { ensureTables } from "./config/dynamodb.js";
import { connectRedis, redisSubscriber } from "./config/redis.js";
import { authMiddleware } from "./middlewares/auth.middleware.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { friendRoutes } from "./routes/friend.routes.js";
import { conversationRoutes } from "./routes/conversation.routes.js";
import { verifyToken } from "./utils/jwt.js";
import { MessageService } from "./services/message.service.js";
import { ConversationRepository } from "./repositories/conversation.repository.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: "*",
	},
});

const messageService = new MessageService();
const conversationRepository = new ConversationRepository();

app.disable("x-powered-by");
app.use(helmet());
app.use(
	rateLimit({
		windowMs: env.RATE_LIMIT_WINDOW_MS,
		max: env.RATE_LIMIT_MAX,
		standardHeaders: true,
		legacyHeaders: false,
	}),
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
	res.status(200).json({ service: "chat-service", status: "ok" });
});

app.use(authMiddleware);
app.use("/friends", friendRoutes);
app.use("/conversations", conversationRoutes);
app.use(errorHandler);

io.use((socket, next) => {
	const headerToken = socket.handshake.headers.authorization;
	const authToken = socket.handshake.auth.token;
	const bearer =
		typeof headerToken === "string" && headerToken.startsWith("Bearer ")
			? headerToken.slice(7)
			: undefined;
	const token = bearer ?? authToken;

	if (!token || typeof token !== "string") {
		return next(new Error("unauthorized"));
	}

	try {
		socket.data.auth = verifyToken(token);
		return next();
	} catch {
		return next(new Error("unauthorized"));
	}
});

io.on("connection", async (socket) => {
	const userId = socket.data.auth.user_id as string;
	socket.join(`user_${userId}`);

	const conversations = await conversationRepository.listByUserId(userId);
	conversations.forEach((conversation) => {
		socket.join(`conversation_${conversation.id}`);
	});

	socket.on("send_message", async (payload) => {
		try {
			const message = await messageService.sendMessage({
				conversation_id: payload.conversation_id,
				sender_id: userId,
				type: payload.type ?? "text",
				content: payload.content,
			});

			socket.emit("send_message_ack", { ok: true, message_id: message.id });
		} catch {
			socket.emit("send_message_ack", { ok: false });
		}
	});

	socket.on("typing", (payload) => {
		socket
			.to(`conversation_${payload.conversation_id}`)
			.emit("typing", { conversation_id: payload.conversation_id, user_id: userId });
	});

	socket.on("read_receipt", (payload) => {
		socket
			.to(`conversation_${payload.conversation_id}`)
			.emit("read_receipt", {
				conversation_id: payload.conversation_id,
				user_id: userId,
				message_id: payload.message_id,
			});
	});
});

async function bootstrap() {
	await ensureTables();
	await connectRedis();

	await redisSubscriber.subscribe(env.REDIS_MESSAGE_CHANNEL, (messageText) => {
		const message = JSON.parse(messageText) as { conversation_id: string };
		io.to(`conversation_${message.conversation_id}`).emit("receive_message", message);
	});

	server.listen(env.PORT, () => {
		console.log(`chat-service listening on ${env.PORT}`);
	});
}

bootstrap().catch((error) => {
	console.error("Failed to start chat-service", error);
	process.exit(1);
});
