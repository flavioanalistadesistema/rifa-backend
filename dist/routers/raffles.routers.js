"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rafflesRoutes = rafflesRoutes;
const prisma_1 = __importDefault(require("../lib/prisma"));
const zod_1 = require("zod");
const app_error_1 = require("../erros/app.error");
const require_admin_1 = require("../middleware/require-admin");
const createRaffleSchema = zod_1.z.object({
    title: zod_1.z.string().min(3),
    description: zod_1.z.string().optional(),
    ticketPrice: zod_1.z.number().positive(),
    pixKey: zod_1.z.string().min(3),
    totalNumbers: zod_1.z.number().int().positive().default(100),
});
async function rafflesRoutes(server) {
    server.post("/raffles", { preHandler: require_admin_1.requireAdmin }, async (request, reply) => {
        const data = createRaffleSchema.parse(request.body);
        const raffle = await prisma_1.default.raffle.create({
            data: {
                title: data.title,
                description: data.description,
                ticketPrice: data.ticketPrice,
                pixKey: data.pixKey,
                totalNumbers: data.totalNumbers,
            },
        });
        return reply.status(201).send(raffle);
    });
    server.get("/raffles", { preHandler: require_admin_1.requireAdmin }, async (request, reply) => {
        const raffles = await prisma_1.default.raffle.findMany({
            orderBy: {
                createdAt: "desc",
            },
            include: {
                prizes: {
                    orderBy: {
                        position: "asc",
                    },
                },
                _count: {
                    select: {
                        numbers: true,
                        payments: true,
                        draws: true,
                    },
                },
            },
        });
        return reply.status(200).send(raffles);
    });
    server.post("/raffles/:raffleId/numbers/generate", { preHandler: require_admin_1.requireAdmin }, async (request, reply) => {
        const paramsSchema = zod_1.z.object({
            raffleId: zod_1.z.string().uuid(),
        });
        const { raffleId } = paramsSchema.parse(request.params);
        let raffle;
        try {
            raffle = await prisma_1.default.raffle.findUnique({
                where: {
                    id: raffleId,
                },
            });
            if (!raffle) {
                throw new app_error_1.AppError("Rifa não encontrada.", 404);
            }
        }
        catch (error) {
            throw new app_error_1.AppError("Erro ao buscar a rifa.", 500);
        }
        try {
            const existingNumbers = await prisma_1.default.raffleNumber.count({
                where: {
                    raffleId,
                },
            });
            if (existingNumbers > 0) {
                throw new app_error_1.AppError("Esta rifa já possui números gerados.", 400);
            }
            const numbers = Array.from({ length: raffle.totalNumbers }, (_, index) => ({
                raffleId,
                number: index + 1,
            }));
            await prisma_1.default.raffleNumber.createMany({
                data: numbers,
            });
            return reply.status(201).send({
                message: "Números gerados com sucesso.",
                total: numbers.length,
            });
        }
        catch (error) {
            throw new app_error_1.AppError("Erro ao gerar os números da rifa.", 500);
        }
    });
    server.get("/raffles/:raffleId/numbers", async (request, reply) => {
        const paramsSchema = zod_1.z.object({
            raffleId: zod_1.z.string().uuid(),
        });
        const { raffleId } = paramsSchema.parse(request.params);
        const raffle = await prisma_1.default.raffle.findUnique({
            where: {
                id: raffleId,
            },
        });
        if (!raffle) {
            throw new app_error_1.AppError("Rifa não encontrada.", 404);
        }
        const numbers = await prisma_1.default.raffleNumber.findMany({
            where: {
                raffleId,
            },
        });
        return reply.status(200).send(numbers);
    });
    server.post("/raffles/:raffleId/numbers/:number/reserve", { preHandler: require_admin_1.requireAdmin }, async (request, reply) => {
        const paramsSchema = zod_1.z.object({
            raffleId: zod_1.z.string().uuid(),
            number: zod_1.z.coerce.number().int().positive(),
        });
        const bodySchema = zod_1.z.object({
            name: zod_1.z.string().min(3),
            whatsapp: zod_1.z.string().min(8),
            email: zod_1.z.string().email().optional(),
        });
        const { raffleId, number } = paramsSchema.parse(request.params);
        const buyerData = bodySchema.parse(request.body);
        const raffleNumber = await prisma_1.default.raffleNumber.findUnique({
            where: {
                raffleId_number: {
                    raffleId,
                    number,
                },
            },
        });
        if (!raffleNumber) {
            throw new app_error_1.AppError("Número não encontrado nesta rifa.", 404);
        }
        if (raffleNumber.status !== "AVAILABLE") {
            throw new app_error_1.AppError("Este número não está disponível.", 400);
        }
        const result = await prisma_1.default.$transaction(async (tx) => {
            const buyer = await tx.buyer.create({
                data: {
                    name: buyerData.name,
                    whatsapp: buyerData.whatsapp,
                    email: buyerData.email,
                },
            });
            const updatedNumber = await tx.raffleNumber.update({
                where: {
                    id: raffleNumber.id,
                },
                data: {
                    status: "RESERVED",
                    buyerId: buyer.id,
                    reservedAt: new Date(),
                },
                include: {
                    buyer: true,
                },
            });
            return updatedNumber;
        });
        return reply.status(201).send({
            message: "Número reservado com sucesso.",
            number: result,
        });
    });
    server.get("/raffles/:raffleId", { preHandler: require_admin_1.requireAdmin }, async (request, reply) => {
        const paramsSchema = zod_1.z.object({
            raffleId: zod_1.z.string().uuid(),
        });
        const { raffleId } = paramsSchema.parse(request.params);
        const raffle = await prisma_1.default.raffle.findUnique({
            where: {
                id: raffleId,
            },
            include: {
                prizes: {
                    orderBy: {
                        position: "asc",
                    },
                },
                numbers: {
                    orderBy: {
                        number: "asc",
                    },
                    include: {
                        buyer: true,
                    },
                },
                draws: {
                    include: {
                        winningNumber: {
                            include: {
                                buyer: true,
                            },
                        },
                    },
                },
            },
        });
        if (!raffle) {
            throw new app_error_1.AppError("Rifa não encontrada.", 404);
        }
        const soldCount = raffle.numbers.filter((number) => number.status === "SOLD").length;
        const reservedCount = raffle.numbers.filter((number) => number.status === "RESERVED").length;
        const availableCount = raffle.numbers.filter((number) => number.status === "AVAILABLE").length;
        return reply.send({
            raffle,
            summary: {
                total: raffle.numbers.length,
                sold: soldCount,
                reserved: reservedCount,
                available: availableCount,
            },
            result: raffle.draws[0] ?? null,
        });
    });
    server.patch("/raffles/:raffleId", { preHandler: require_admin_1.requireAdmin }, async (request, reply) => {
        const paramsSchema = zod_1.z.object({
            raffleId: zod_1.z.string().uuid(),
        });
        const bodySchema = zod_1.z.object({
            title: zod_1.z.string().min(3).optional(),
            description: zod_1.z.string().optional(),
            ticketPrice: zod_1.z.number().positive().optional(),
            pixKey: zod_1.z.string().min(3).optional(),
            status: zod_1.z.enum(["DRAFT", "ACTIVE", "FINISHED", "CANCELLED"]).optional(),
        });
        const { raffleId } = paramsSchema.parse(request.params);
        const data = bodySchema.parse(request.body);
        const raffle = await prisma_1.default.raffle.findUnique({
            where: {
                id: raffleId,
            },
        });
        if (!raffle) {
            throw new app_error_1.AppError("Rifa não encontrada.", 404);
        }
        const updatedRaffle = await prisma_1.default.raffle.update({
            where: {
                id: raffleId,
            },
            data,
        });
        return reply.send({
            message: "Rifa atualizada com sucesso.",
            raffle: updatedRaffle,
        });
    });
}
//# sourceMappingURL=raffles.routers.js.map