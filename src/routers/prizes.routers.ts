import { FastifyInstance } from "fastify";
import { z } from "zod";
import prisma  from "../lib/prisma";
import { AppError } from "../erros/app.error";
import { requireAdmin } from "../middleware/require-admin";

const createPrizeSchema = z.object({
    name: z.string().min(2),
    description: z.string().optional(),
    imageUrl: z.string().url().optional(),
    position: z.number().int().positive().default(1),
});

export async function prizesRoutes(server: FastifyInstance) {

    server.post("/raffles/:raffleId/prizes", { preHandler: requireAdmin }, async (request, reply) => {
        const paramsSchema = z.object({
            raffleId: z.string().uuid(),
        });

        const { raffleId } = paramsSchema.parse(request.params);
        const data = createPrizeSchema.parse(request.body);

        const raffle = await prisma.raffle.findUnique({
            where: {
                id: raffleId,
            },
        });

        if (!raffle) {
            throw new AppError("Rifa não encontrada.", 404);
        }

        const prize = await prisma.prize.create({
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
        const paramsSchema = z.object({
            raffleId: z.string().uuid(),
        });

        const { raffleId } = paramsSchema.parse(request.params);

        const prizes = await prisma.prize.findMany({
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

    server.patch("/prizes/:prizeId", { preHandler: requireAdmin }, async (request, reply) => {
        const paramsSchema = z.object({
            prizeId: z.string().uuid(),
        });

        const bodySchema = z.object({
            name: z.string().min(2).optional(),
            description: z.string().optional(),
            imageUrl: z.string().url().optional(),
            position: z.number().int().positive().optional(),
        })

        const { prizeId } = paramsSchema.parse(request.params);
        const data = bodySchema.parse(request.body);

        const isPrize = await prisma.prize.findUnique({
            where: {
                id: prizeId,
            },
        });

        if (!isPrize) {
            throw new AppError("Prêmio não encontrado.", 404);
        }

        const prize = await prisma.prize.update({
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

    server.delete("/prizes/:prizeId", { preHandler: requireAdmin }, async (request, reply) => {
        const paramsSchema = z.object({
            prizeId: z.string().uuid(),
        });

        const { prizeId } = paramsSchema.parse(request.params);

        const prize = await prisma.prize.findUnique({
            where: {
                id: prizeId,
            },
        });

        if (!prize) {
            throw new AppError("Prêmio não encontrado.", 404);
        }

        await prisma.prize.delete({
            where: {
                id: prizeId,
            },
        });

        return reply.send({
            message: "Prêmio deletado com sucesso.",
        });
    });
}