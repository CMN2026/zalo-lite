import { Router } from "express";
import { body, query } from "express-validator";
import { FriendController } from "../controllers/friend.controller.js";
import { validateRequest } from "../middlewares/validate.middleware.js";

export const friendRoutes = Router();

friendRoutes.post(
  "/request",
  [body("receiver_id").isUUID(), validateRequest],
  FriendController.request,
);

friendRoutes.post(
  "/accept",
  [body("request_id").isUUID(), validateRequest],
  FriendController.accept,
);

friendRoutes.get("/", FriendController.getFriends);

friendRoutes.get(
  "/search",
  [query("phone").isLength({ min: 1, max: 20 }), validateRequest],
  FriendController.search,
);
