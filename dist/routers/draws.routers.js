"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.drawsRoutes = drawsRoutes;
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../lib/prisma"));
const app_error_1 = require("../erros/app.error");
const require_admin_1 = require("../middleware/require-admin");
async function drawsRoutes(server) {
    server.post("/raffles/:raffleId/draw", { preHandler: require_admin_1.requireAdmin }, async (request, reply) => {
        const paramsSchema = zod_1.z.object({
            raffleId: zod_1.z.string().uuid(),
        });
        const { raffleId } = paramsSchema.parse(request.params);
        const raffle = await prisma_1.default.raffle.findUnique({
            where: {
                id: raffleId,
            },
            include: {
                draws: true,
            },
        });
        if (!raffle) {
            throw new app_error_1.AppError("Rifa não encontrada.", 404);
        }
        if (raffle.draws.length > 0) {
            throw new app_error_1.AppError("Esta rifa já possui um sorteio.", 400);
        }
        const soldNumbers = await prisma_1.default.raffleNumber.findMany({
            where: {
                raffleId,
                status: "SOLD",
            },
            include: {
                buyer: true,
            },
        });
        if (soldNumbers.length === 0) {
            throw new app_error_1.AppError("Não há números vendidos para sortear.", 400);
        }
        const randomIndex = Math.floor(Math.random() * soldNumbers.length);
        const winningNumber = soldNumbers[randomIndex];
        const draw = await prisma_1.default.$transaction(async (tx) => {
            const createdDraw = await tx.draw.create({
                data: {
                    raffleId,
                    winningNumberId: winningNumber.id,
                },
                include: {
                    winningNumber: {
                        include: {
                            buyer: true,
                        },
                    },
                },
            });
            await tx.raffle.update({
                where: {
                    id: raffleId,
                },
                data: {
                    status: "FINISHED",
                },
            });
            return createdDraw;
        });
        return reply.status(201).send({
            message: "Sorteio realizado com sucesso.",
            draw,
        });
    });
    server.get("/raffles/:raffleId/result", async (request, reply) => {
        const paramsSchema = zod_1.z.object({
            raffleId: zod_1.z.string().uuid(),
        });
        const { raffleId } = paramsSchema.parse(request.params);
        const draw = await prisma_1.default.draw.findUnique({
            where: {
                raffleId,
            },
            include: {
                raffle: true,
                winningNumber: {
                    include: {
                        buyer: true,
                    },
                },
            },
        });
        if (!draw) {
            throw new app_error_1.AppError("Resultado ainda não disponível.", 404);
        }
        return reply.send({
            raffle: {
                id: draw.raffle.id,
                title: draw.raffle.title,
                status: draw.raffle.status,
            },
            result: {
                number: draw.winningNumber.number,
                buyer: draw.winningNumber.buyer,
                drawnAt: draw.drawnAt,
            },
        });
    });
}
//# sourceMappingURL=draws.routers.js.map