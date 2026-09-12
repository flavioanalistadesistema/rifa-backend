import "fastify";

declare module "fastify" {
    interface FastifyRequest {
        admin?: {
            email: string;
            role: string;
        };
    }
}
