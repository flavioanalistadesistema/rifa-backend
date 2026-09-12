import { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { AppError } from "../erros/app.error";

type AdminTokenPayload = {
    role: string;
    email: string;
};

export async function requireAdmin(
    request: FastifyRequest,
    reply: FastifyReply
) {
    const authorization = request.headers.authorization;

    if (!authorization) {
        throw new AppError("Token administrativo não informado.", 401);
    }

    const [type, token] = authorization.split(" ");

    if (type !== "Bearer" || !token) {
        throw new AppError("Token administrativo inválido.", 401);
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
        throw new AppError("JWT_SECRET não configurado.", 500);
    }

    try {
        const payload = jwt.verify(token, jwtSecret) as AdminTokenPayload;

        if (payload.role !== "admin") {
            throw new AppError("Acesso não autorizado.", 403);
        }

        request.admin = {
            email: payload.email,
            role: payload.role,
        };

    } catch {
        throw new AppError("Token administrativo inválido ou expirado.", 401);
    }
}