import { FastifyInstance } from "fastify";
import { z } from "zod";
import prisma from "../lib/prisma";
import { AppError } from "../erros/app.error";
import { requireAdmin } from "../middleware/require-admin";

const createPaymentSchema = z.object({
    raffleId: z.string().uuid(),
    buyer: z.object({
        name: z.string().min(3),
        whatsapp: z.string().min(8),
        email: z.string().email().optional(),
    }),
    numbers: z.array(z.number().int().positive()).min(1),
    receiptUrl: z.string().url().optional(),
});

export async function paymentsRoutes(server: FastifyInstance) {

    server.post("/payments", async (request, reply) => {
        const data = createPaymentSchema.parse(request.body);

        const raffle = await prisma.raffle.findUnique({
            where: {
                id: data.raffleId,
            },
        });

        if (!raffle) {
            throw new AppError("Rifa não encontrada.", 404);
        }

        const uniqueNumbers = Array.from(new Set(data.numbers));

        const raffleNumbers = await prisma.raffleNumber.findMany({
            where: {
                raffleId: data.raffleId,
                number: {
                    in: uniqueNumbers,
                },
            },
        });

        if (raffleNumbers.length !== uniqueNumbers.length) {
            throw new AppError("Um ou mais números não existem nesta rifa.", 400);
        }

        const unavailableNumbers = raffleNumbers.filter(
            (item) => item.status !== "AVAILABLE"
        );

        if (unavailableNumbers.length > 0) {
            throw new AppError(
                `Os números ${unavailableNumbers.map((item) => item.number).join(", ")} não estão disponíveis.`,
                400
            );
        }

        const payment = await prisma.$transaction(async (tx) => {
            const buyer = await tx.buyer.create({
                data: data.buyer,
            });

            if (!buyer) {
                throw new AppError("Erro ao criar comprador.", 500);
            }

            const createdPayment = await tx.payment.create({
                data: {
                    raffleId: data.raffleId,
                    buyerId: buyer.id,
                    amount: Number(raffle.ticketPrice) * uniqueNumbers.length,
                    pixKey: raffle.pixKey,
                    receiptUrl: data.receiptUrl,
                    status: "PENDING",
                },
            });

            await tx.raffleNumber.updateMany({
                where: {
                    id: {
                        in: raffleNumbers.map((raffleNumber) => raffleNumber.id),
                    },
                },
                data: {
                    status: "RESERVED",
                    buyerId: buyer.id,
                    reservedAt: new Date(),
                },
            });

            await tx.paymentNumber.createMany({
                data: raffleNumbers.map((raffleNumber) => ({
                    paymentId: createdPayment.id,
                    raffleNumberId: raffleNumber.id,
                })),
            });

            return tx.payment.findUnique({
                where: {
                    id: createdPayment.id,
                },
                include: {
                    buyer: true,
                    paymentNumbers: {
                        include: {
                            raffleNumber: true,
                        },
                    },
                },
            });
        }, {
            maxWait: 10000,
            timeout: 30000,
        });

        return reply.status(201).send({
            message: "Pagamento pendente criado com sucesso.",
            payment,
        });
    });

    server.patch("/payments/:paymentId/confirm", { preHandler: requireAdmin }, async (request, reply) => {
        const paramsSchema = z.object({
            paymentId: z.string().uuid(),
        });

        const { paymentId } = paramsSchema.parse(request.params);

        const payment = await prisma.payment.findUnique({
            where: {
                id: paymentId,
            },
            include: {
                paymentNumbers: {
                    include: {
                        raffleNumber: true,
                    },
                },
            },
        });

        if (!payment) {
            throw new AppError("Pagamento não encontrado.", 404);
        }

        if (payment.status !== "PENDING") {
            throw new AppError("Este pagamento não está pendente.", 400);
        }

        const confirmedPayment = await prisma.$transaction(async (tx) => {
            await tx.payment.update({
                where: {
                    id: paymentId,
                },
                data: {
                    status: "CONFIRMED",
                    confirmedAt: new Date(),
                },
            });

            for (const paymentNumber of payment.paymentNumbers) {
                await tx.raffleNumber.update({
                    where: {
                        id: paymentNumber.raffleNumber.id,
                    },
                    data: {
                        status: "SOLD",
                        soldAt: new Date(),
                    },
                });
            }

            return tx.payment.findUnique({
                where: {
                    id: paymentId,
                },
                include: {
                    buyer: true,
                    paymentNumbers: {
                        include: {
                            raffleNumber: true,
                        },
                    },
                },
            });
        });

        return reply.send({
            message: "Pagamento confirmado com sucesso.",
            payment: confirmedPayment,
        });
    });

    server.get("/payments", { preHandler: requireAdmin }, async (request, reply) => {
        
        const querySchema = z.object({
            status: z.enum(["PENDING", "CONFIRMED", "REJECTED"]).optional(),
            raffleId: z.string().uuid().optional(),
        });

        const { status, raffleId } = querySchema.parse(request.query);

        const payment = await prisma.payment.findMany({
            where: {
                status,
                raffleId,
            },
            orderBy: {
                createdAt: "desc",
            },
            include: {
                buyer: true,
                raffle: true,
                paymentNumbers: {
                    include: {
                        raffleNumber: true,
                    },
                },
            },
        });

        if (!payment) {
            return reply.status(404).send({
                message: "Nenhum pagamento encontrado.",
            });
        }

        const payments = await prisma.payment.findMany({
            where: {
                status,
                raffleId,
            },
            orderBy: {
                createdAt: "desc",
            },
            include: {
                buyer: true,
                raffle: true,
                paymentNumbers: {
                    include: {
                        raffleNumber: true,
                    },
                },
            },
        });

        return reply.send({
            payments,
        });
    });

    server.patch("/payments/:paymentId/reject", { preHandler: requireAdmin }, async (request, reply) => {
        const paramsSchema = z.object({
            paymentId: z.string().uuid(),
        });

        const { paymentId } = paramsSchema.parse(request.params);

        const payment = await prisma.payment.findUnique({
            where: {
                id: paymentId,
            },
            include: {
                paymentNumbers: {
                    include: {
                        raffleNumber: true,
                    },
                },
            },
        });

        if (!payment) {
            throw new AppError("Pagamento não encontrado.", 404);
        }

        if (payment.status !== "PENDING") {
            throw new AppError("Apenas pagamentos pendentes podem ser rejeitados.", 400);
        }

        const rejectedPayment = await prisma.$transaction(async (tx) => {
            await tx.payment.update({
                where: {
                    id: paymentId,
                },
                data: {
                    status: "REJECTED",
                },
            });

            for (const paymentNumber of payment.paymentNumbers) {
                await tx.raffleNumber.update({
                    where: {
                        id: paymentNumber.raffleNumber.id,
                    },
                    data: {
                        status: "AVAILABLE",
                        buyerId: null,
                        reservedAt: null,
                    },
                });
            }

            return tx.payment.findUnique({
                where: {
                    id: paymentId,
                },
                include: {
                    buyer: true,
                    paymentNumbers: {
                        include: {
                            raffleNumber: true,
                        },
                    },
                },
            });
        });

        return reply.send({
            message: "Pagamento rejeitado e números liberados.",
            payment: rejectedPayment,
        });
    });

    server.get("/payments/:paymentId", { preHandler: requireAdmin }, async (request, reply) => {
        const paramsSchema = z.object({
            paymentId: z.string().uuid(),
        });

        const { paymentId } = paramsSchema.parse(request.params);

        const payment = await prisma.payment.findUnique({
            where: {
                id: paymentId,
            },
            include: {
                buyer: true,
                raffle: true,
                paymentNumbers: {
                    include: {
                        raffleNumber: true,
                    },
                },
            },
        });

        if (!payment) {
            throw new AppError("Pagamento não encontrado.", 404);
        }

        return reply.send({
            payment,
        });
    }
    );

    server.patch("/payments/:paymentId/receipt", async (request, reply) => {

        const paramsSchema = z.object({
            paymentId: z.string().uuid(),
        });

        const bodySchema = z.object({
            receiptUrl: z.string().url(),
        });

        const { paymentId } = paramsSchema.parse(request.params);
        const { receiptUrl } = bodySchema.parse(request.body);

        const payment = await prisma.payment.findUnique({
            where: {
                id: paymentId,
            },
        });

        if (!payment) {
            throw new AppError("Pagamento não encontrado.", 404);
        }

        if (payment.status !== "PENDING") {
            throw new AppError(
                "Só é possível alterar comprovante de pagamento pendente.",
                400
            );
        }

        const updatedPayment = await prisma.payment.update({
            where: {
                id: paymentId,
            },
            data: {
                receiptUrl,
            },
        });

        return reply.send({
            message: "Comprovante atualizado com sucesso.",
            payment: updatedPayment,
        });
    });
}