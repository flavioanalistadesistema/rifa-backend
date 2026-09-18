import Fastify from "fastify";
import { rafflesRoutes } from "./routers/raffles.routers";
import { paymentsRoutes } from "./routers/payments.routers";
import { drawsRoutes } from "./routers/draws.routers";
import { errorHandler } from "./erros/error-handler";
import { prizesRoutes } from "./routers/prizes.routers";
import { uploadsRoutes } from "./routers/uploads.routers";
import Multipart  from "@fastify/multipart";
import { authRoutes } from "./routers/auth.routers";
import cors from "@fastify/cors";

const port = Number(process.env.PORT ?? 3333);
const host = process.env.HOST ?? "0.0.0.0";

const server = Fastify({
    logger: true,
});

server.register(cors, {
    origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
});

server.register(Multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

server.get("/", async (request, reply) => {
  return { hello: "world" };
});

server.register(rafflesRoutes);
server.register(paymentsRoutes);
server.register(drawsRoutes);
server.register(prizesRoutes);
server.setErrorHandler(errorHandler);
server.register(uploadsRoutes);
server.register(authRoutes);


server.get("/health", async () => {
  return {
    ok: true,
    service: "rifa-backend",
  };
});

server.listen({ port, host }, (error, address) => {
  if (error) {
    server.log.error(error);
    process.exit(1);
  }

  server.log.info(`Server listening at ${address}`);
});