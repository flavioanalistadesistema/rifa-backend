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

const server = Fastify({
    logger: true,
});

server.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
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

server.listen({ port: 3333 }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});