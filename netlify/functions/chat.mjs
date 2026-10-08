import handler from "../../api/chat.js";
import { adapt } from "../adapter.mjs";

export default (request, context) => adapt(handler, request, context);
export const config = { path: "/api/chat" };
