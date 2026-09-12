import { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppError } from "../erros/app.error";
import { requireAdmin } from "../middleware/require-admin";

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

export async function authRoutes(server: FastifyInstance) {

    server.post("/auth/login", async (request, reply) => {

        const { email, password } = loginSchema.parse(request.body);

        if (email !== process.env.ADMIN_EMAIL) {
            throw new AppError("Credenciais inválidas.", 401);
        }

        const passwordHash = process.env.ADMIN_PASSWORD_HASH;
        const jwtSecret = process.env.JWT_SECRET;

        if (!passwordHash || !jwtSecret) {
            throw new AppError("Autenticação não configurada.", 500);
        }

        const passwordMatches = await bcrypt.compare(password, passwordHash);

        if (!passwordMatches) {
            throw new AppError("Credenciais inválidas.", 401);
        }

        const token = jwt.sign(
            {
                role: "admin",
                email,
            },
            jwtSecret,
            {
                expiresIn: "8h",
            }
        );

        return reply.send({
            token,
        });
    });

    server.get("/auth/me", { preHandler: requireAdmin }, async (request, reply) => {
        return reply.send({
            admin: request.admin,
        });
    });
}