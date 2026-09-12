"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentsRoutes = paymentsRoutes;
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../lib/prisma"));
const app_error_1 = require("../erros/app.error");
const require_admin_1 = require("../middleware/require-admin");
const createPaymentSchema = zod_1.z.object({
    raffleId: zod_1.z.string().uuid(),
    buyer: zod_1.z.object({
        name: zod_1.z.string().min(3),
        whatsapp: zod_1.z.string().min(8),
        email: zod_1.z.string().email().optional(),
    }),
    numbers: zod_1.z.array(zod_1.z.number().int().positive()).min(1),
    receiptUrl: zod_1.z.string().url().optional(),
});
async function paymentsRoutes(server) {
    server.post("/payments", { preHandler: require_admin_1.requireAdmin }, async (request, reply) => {
        const data = createPaymentSchema.parse(request.body);
        const raffle = await prisma_1.default.raffle.findUnique({
            where: {
                id: data.raffleId,
            },
        });
        if (!raffle) {
            throw new app_error_1.AppError("Rifa não encontrada.", 404);
        }
        const uniqueNumbers = Array.from(new Set(data.numbers));
        const raffleNumbers = await prisma_1.default.raffleNumber.findMany({
            where: {
                raffleId: data.raffleId,
                number: {
                    in: uniqueNumbers,
                },
            },
        });
        if (raffleNumbers.length !== uniqueNumbers.length) {
            throw new app_error_1.AppError("Um ou mais números não existem nesta rifa.", 400);
        }
        const unavailableNumbers = raffleNumbers.filter((item) => item.status !== "AVAILABLE");
        if (unavailableNumbers.length > 0) {
            throw new app_error_1.AppError(`Os números ${unavailableNumbers.map((item) => item.number).join(", ")} não estão disponíveis.`, 400);
        }
        const payment = await prisma_1.default.$transaction(async (tx) => {
            const buyer = await tx.buyer.create({
                data: data.buyer,
            });
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
            for (const raffleNumber of raffleNumbers) {
                await tx.raffleNumber.update({
                    where: {
                        id: raffleNumber.id,
                    },
                    data: {
                        status: "RESERVED",
                        buyerId: buyer.id,
                        reservedAt: new Date(),
                    },
                });
                await tx.paymentNumber.create({
                    data: {
                        paymentId: createdPayment.id,
                        raffleNumberId: raffleNumber.id,
                    },
                });
            }
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
        });
        return reply.status(201).send({
            message: "Pagamento pendente criado com sucesso.",
            payment,
        });
    });
    server.patch("/payments/:paymentId/confirm", { preHandler: require_admin_1.requireAdmin }, async (request, reply) => {
        const paramsSchema = zod_1.z.object({
            paymentId: zod_1.z.string().uuid(),
        });
        const { paymentId } = paramsSchema.parse(request.params);
        const payment = await prisma_1.default.payment.findUnique({
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
            throw new app_error_1.AppError("Pagamento não encontrado.", 404);
        }
        if (payment.status !== "PENDING") {
            throw new app_error_1.AppError("Este pagamento não está pendente.", 400);
        }
        const confirmedPayment = await prisma_1.default.$transaction(async (tx) => {
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
    server.get("/payments", { preHandler: require_admin_1.requireAdmin }, async (request, reply) => {
        const querySchema = zod_1.z.object({
            status: zod_1.z.enum(["PENDING", "CONFIRMED", "REJECTED"]).optional(),
        });
        const { status } = querySchema.parse(request.query);
        const payment = await prisma_1.default.payment.findMany({
            where: status ? { status } : {},
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
        const payments = await prisma_1.default.payment.findMany({
            where: {
                status,
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
    server.patch("/payments/:paymentId/reject", { preHandler: require_admin_1.requireAdmin }, async (request, reply) => {
        const paramsSchema = zod_1.z.object({
            paymentId: zod_1.z.string().uuid(),
        });
        const { paymentId } = paramsSchema.parse(request.params);
        const payment = await prisma_1.default.payment.findUnique({
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
            throw new app_error_1.AppError("Pagamento não encontrado.", 404);
        }
        if (payment.status !== "PENDING") {
            throw new app_error_1.AppError("Apenas pagamentos pendentes podem ser rejeitados.", 400);
        }
        const rejectedPayment = await prisma_1.default.$transaction(async (tx) => {
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
}
//# sourceMappingURL=payments.routers.js.map