import prisma from "../lib/prisma";
import { z } from "zod";
import { AppError } from "../erros/app.error";
import { requireAdmin } from "../middleware/require-admin";

const createRaffleSchema = z.object({
    title: z.string().min(3),
    description: z.string().optional(),
    ticketPrice: z.number().positive(),
    pixKey: z.string().min(3),
    totalNumbers: z.number().int().positive().default(100),
});

import { FastifyInstance } from "fastify";

export async function rafflesRoutes(server: FastifyInstance) {

    server.post("/raffles", { preHandler: requireAdmin }, async (request, reply) => {
        const data = createRaffleSchema.parse(request.body);

        const raffle = await prisma.raffle.create({
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

    server.get("/raffles", { preHandler: requireAdmin }, async (request, reply) => {

        const raffles = await prisma.raffle.findMany({
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

    server.post("/raffles/:raffleId/numbers/generate", { preHandler: requireAdmin }, async (request, reply) => {
        const paramsSchema = z.object({
            raffleId: z.string().uuid(),
        });

        const { raffleId } = paramsSchema.parse(request.params);

        let raffle: Awaited<ReturnType<typeof prisma.raffle.findUnique>>;

        try {
            raffle = await prisma.raffle.findUnique({
                where: {
                    id: raffleId,
                },
            });

            if (!raffle) {
                throw new AppError("Rifa não encontrada.", 404);
            }
        } catch (error) {
            throw new AppError("Erro ao buscar a rifa.", 500);
        }

        try {
            const existingNumbers = await prisma.raffleNumber.count({
                where: {
                    raffleId,
                },
            });

            if (existingNumbers > 0) {
                throw new AppError("Esta rifa já possui números gerados.", 400);
            }

            const numbers = Array.from({ length: raffle!.totalNumbers }, (_, index) => ({
                raffleId,
                number: index + 1,
            }));

            await prisma.raffleNumber.createMany({
                data: numbers,
            });

            return reply.status(201).send({
                message: "Números gerados com sucesso.",
                total: numbers.length,
            });

        } catch (error) {
            throw new AppError("Erro ao gerar os números da rifa.", 500);
        }

    });

    server.get("/raffles/:raffleId/numbers", async (request, reply) => {
        const paramsSchema = z.object({
            raffleId: z.string().uuid(),
        });

        const { raffleId } = paramsSchema.parse(request.params);

        const raffle = await prisma.raffle.findUnique({
            where: {
                id: raffleId,
            },
        });

        if (!raffle) {
            throw new AppError("Rifa não encontrada.", 404);
        }

        const numbers = await prisma.raffleNumber.findMany({
            where: {
                raffleId,
            },
        });

        return reply.status(200).send(numbers);
    });

    server.post("/raffles/:raffleId/numbers/:number/reserve", { preHandler: requireAdmin }, async (request, reply) => {
        const paramsSchema = z.object({
            raffleId: z.string().uuid(),
            number: z.coerce.number().int().positive(),
        });

        const bodySchema = z.object({
            name: z.string().min(3),
            whatsapp: z.string().min(8),
            email: z.string().email().optional(),
        });

        const { raffleId, number } = paramsSchema.parse(request.params);
        const buyerData = bodySchema.parse(request.body);

        const raffleNumber = await prisma.raffleNumber.findUnique({
            where: {
                raffleId_number: {
                    raffleId,
                    number,
                },
            },
        });

        if (!raffleNumber) {
            throw new AppError("Número não encontrado nesta rifa.", 404);
        }

        if (raffleNumber.status !== "AVAILABLE") {
            throw new AppError("Este número não está disponível.", 400);
        }

        const result = await prisma.$transaction(async (tx) => {
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

    server.get("/raffles/:raffleId", { preHandler: requireAdmin }, async (request, reply) => {

        const paramsSchema = z.object({
            raffleId: z.string().uuid(),
        });

        const { raffleId } = paramsSchema.parse(request.params);

        const raffle = await prisma.raffle.findUnique({
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
            throw new AppError("Rifa não encontrada.", 404);
        }

        const soldCount = raffle.numbers.filter(
            (number) => number.status === "SOLD"
        ).length;

        const reservedCount = raffle.numbers.filter(
            (number) => number.status === "RESERVED"
        ).length;

        const availableCount = raffle.numbers.filter(
            (number) => number.status === "AVAILABLE"
        ).length;

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

    server.patch(
        "/raffles/:raffleId",
        { preHandler: requireAdmin },
        async (request, reply) => {
            const paramsSchema = z.object({
                raffleId: z.string().uuid(),
            });

            const bodySchema = z.object({
                title: z.string().min(3).optional(),
                description: z.string().optional(),
                ticketPrice: z.number().positive().optional(),
                pixKey: z.string().min(3).optional(),
                status: z.enum(["DRAFT", "ACTIVE", "FINISHED", "CANCELLED"]).optional(),
            });

            const { raffleId } = paramsSchema.parse(request.params);
            const data = bodySchema.parse(request.body);

            const raffle = await prisma.raffle.findUnique({
                where: {
                    id: raffleId,
                },
            });

            if (!raffle) {
                throw new AppError("Rifa não encontrada.", 404);
            }

            const updatedRaffle = await prisma.raffle.update({
                where: {
                    id: raffleId,
                },
                data,
            });

            return reply.send({
                message: "Rifa atualizada com sucesso.",
                raffle: updatedRaffle,
            });
        }
    );
}

