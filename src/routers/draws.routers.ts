import { FastifyInstance } from "fastify";
import { z } from "zod";
import prisma from "../lib/prisma";
import { AppError } from "../erros/app.error";
import { requireAdmin } from "../middleware/require-admin";

export async function drawsRoutes(server: FastifyInstance) {

    server.post("/raffles/:raffleId/draw", { preHandler: requireAdmin }, async (request, reply) => {
        const paramsSchema = z.object({
            raffleId: z.string().uuid(),
        });

        const { raffleId } = paramsSchema.parse(request.params);

        const raffle = await prisma.raffle.findUnique({
            where: {
                id: raffleId,
            },
            include: {
                draws: true,
            },
        });

        if (!raffle) {
            throw new AppError("Rifa não encontrada.", 404);
        }

        if (raffle.draws.length > 0) {
            throw new AppError("Esta rifa já possui um sorteio.", 400);
        }

        const soldNumbers = await prisma.raffleNumber.findMany({
            where: {
                raffleId,
                status: "SOLD",
            },
            include: {
                buyer: true,
            },
        });

        if (soldNumbers.length === 0) {
            throw new AppError("Não há números vendidos para sortear.", 400);
        }

        const randomIndex = Math.floor(Math.random() * soldNumbers.length);
        const winningNumber = soldNumbers[randomIndex];

        const draw = await prisma.$transaction(async (tx) => {
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
        const paramsSchema = z.object({
            raffleId: z.string().uuid(),
        });

        const { raffleId } = paramsSchema.parse(request.params);

        const draw = await prisma.draw.findUnique({
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
            throw new AppError("Resultado ainda não disponível.", 404);
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