import { FastifyRequest, FastifyReply, FastifyError } from "fastify";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "./app.error";

export function errorHandler(
    error: FastifyError,
    request: FastifyRequest, 
    reply: FastifyReply) 
    {
    if (error instanceof ZodError) {
        return reply.status(400).send({
            message: "dados inválidos.",
            errors: error.issues.map(issue => ({
                path: issue.path.join("."),
                message: issue.message,
            })),
        });
    }

    if (error instanceof AppError) {
        return reply.status(error.status).send({
            message: error.message,
        });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        request.log.error({ code: error.code, meta: error.meta }, "Erro conhecido do Prisma");

        if (error.code === "P2002") {
            return reply.status(409).send({
                message: "Um ou mais números selecionados já foram reservados.",
            });
        }
    }

    if (error.code === "FST_REQ_FILE_TOO_LARGE" || error.statusCode === 413) {
        return reply.status(413).send({
            message: "O arquivo excede o limite de 5 MB.",
        });
    }

    request.log.error(error);

    return reply.status(500).send({
        message: "Erro interno do servidor.",
    });
}