import "dotenv/config";

import cors from "@fastify/cors";
import Multipart from "@fastify/multipart";
import Fastify from "fastify";

import { errorHandler } from "./erros/error-handler";
import { authRoutes } from "./routers/auth.routers";
import { drawsRoutes } from "./routers/draws.routers";
import { paymentsRoutes } from "./routers/payments.routers";
import { prizesRoutes } from "./routers/prizes.routers";
import { rafflesRoutes } from "./routers/raffles.routers";
import { uploadsRoutes } from "./routers/uploads.routers";

const server = Fastify({
  logger: true,
});

const allowedOrigins = [
  "http://localhost:5173", 
  "https://rifa-frontend-murex.vercel.app",
  "https://rifa-frontend-git-main-flavioanalistadesistema-1388s-projects.vercel.app",
  "https://rifa-frontend-b8qdslaxa-flavioanalistadesistema-1388s-projects.vercel.app",
  process.env.FRONTEND_URL,
]
  .filter((origin): origin is string => Boolean(origin))
  .map((origin) => origin.replace(/\/$/, ""));

server.register(cors, {
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
});

server.register(Multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

server.setErrorHandler(errorHandler);

server.get("/", async () => {
  return {
    message: "Rifa API",
  };
});

server.get("/health", async () => {
  return {
    ok: true,
    service: "rifa-backend",
  };
});

server.register(authRoutes);
server.register(rafflesRoutes);
server.register(paymentsRoutes);
server.register(prizesRoutes);
server.register(drawsRoutes);
server.register(uploadsRoutes);

const port = Number(process.env.PORT ?? 3333);

server.listen(
  {
    port,
    host: "::",
  },
  (error, address) => {
    if (error) {
      server.log.error(error);
      process.exit(1);
    }

    server.log.info(`Server listening at ${address}`);
  }
);