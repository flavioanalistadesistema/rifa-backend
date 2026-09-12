"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const raffles_routers_1 = require("./routers/raffles.routers");
const payments_routers_1 = require("./routers/payments.routers");
const draws_routers_1 = require("./routers/draws.routers");
const error_handler_1 = require("./erros/error-handler");
const prizes_routers_1 = require("./routers/prizes.routers");
const server = (0, fastify_1.default)({
    logger: true,
});
server.get("/", async (request, reply) => {
    return { hello: "world" };
});
server.register(raffles_routers_1.rafflesRoutes);
server.register(payments_routers_1.paymentsRoutes);
server.register(draws_routers_1.drawsRoutes);
server.register(prizes_routers_1.prizesRoutes);
server.setErrorHandler(error_handler_1.errorHandler);
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
//# sourceMappingURL=server.js.map