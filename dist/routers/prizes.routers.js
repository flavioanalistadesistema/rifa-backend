"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prizesRoutes = prizesRoutes;
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../lib/prisma"));
const app_error_1 = require("../erros/app.error");
const require_admin_1 = require("../middleware/require-admin");
const createPrizeSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    description: zod_1.z.string().optional(),
    imageUrl: zod_1.z.string().url().optional(),
    position: zod_1.z.number().int().positive().default(1),
});
async function prizesRoutes(server) {
    server.post("/raffles/:raffleId/prizes", { preHandler: require_admin_1.requireAdmin }, async (request, reply) => {
        const paramsSchema = zod_1.z.object({
            raffleId: zod_1.z.string().uuid(),
        });
        const { raffleId } = paramsSchema.parse(request.params);
        const data = createPrizeSchema.parse(request.body);
        const raffle = await prisma_1.default.raffle.findUnique({
            where: {
                id: raffleId,
            },
        });
        if (!raffle) {
            throw new app_error_1.AppError("Rifa não encontrada.", 404);
        }
        const prize = await prisma_1.default.prize.create({
            data: {
                raffleId,
                name: data.name,
                description: data.description,
                imageUrl: data.imageUrl,
                position: data.position,
            },
        });
        return reply.status(201).send({
            message: "Prêmio cadastrado com sucesso.",
            prize,
        });
    });
    server.get("/raffles/:raffleId/prizes", async (request, reply) => {
        const paramsSchema = zod_1.z.object({
            raffleId: zod_1.z.string().uuid(),
        });
        const { raffleId } = paramsSchema.parse(request.params);
        const prizes = await prisma_1.default.prize.findMany({
            where: {
                raffleId,
            },
            orderBy: {
                position: "asc",
            },
        });
        return reply.send({
            prizes,
        });
    });
    server.patch("/prizes/:prizeId", { preHandler: require_admin_1.requireAdmin }, async (request, reply) => {
        const paramsSchema = zod_1.z.object({
            prizeId: zod_1.z.string().uuid(),
        });
        const bodySchema = zod_1.z.object({
            name: zod_1.z.string().min(2).optional(),
            description: zod_1.z.string().optional(),
            imageUrl: zod_1.z.string().url().optional(),
            position: zod_1.z.number().int().positive().optional(),
        });
        const { prizeId } = paramsSchema.parse(request.params);
        const data = bodySchema.parse(request.body);
        const prize = await prisma_1.default.prize.update({
            where: {
                id: prizeId,
            },
            data,
        });
        return reply.send({
            message: "Prêmio atualizado com sucesso.",
            prize,
        });
    });
    server.delete("/prizes/:prizeId", { preHandler: require_admin_1.requireAdmin }, async (request, reply) => {
        const paramsSchema = zod_1.z.object({
            prizeId: zod_1.z.string().uuid(),
        });
        const { prizeId } = paramsSchema.parse(request.params);
        const prize = await prisma_1.default.prize.findUnique({
            where: {
                id: prizeId,
            },
        });
        if (!prize) {
            throw new app_error_1.AppError("Prêmio não encontrado.", 404);
        }
        await prisma_1.default.prize.delete({
            where: {
                id: prizeId,
            },
        });
        return reply.send({
            message: "Prêmio deletado com sucesso.",
        });
    });
}
//# sourceMappingURL=prizes.routers.js.map