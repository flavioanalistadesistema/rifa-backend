import { FastifyRequest, FastifyReply, FastifyError } from "fastify";
import { ZodError } from "zod";
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

    request.log.error(error);

    return reply.status(500).send({
        message: "Erro interno do servidor.",
    });
}