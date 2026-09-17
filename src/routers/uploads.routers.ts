import { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { supabase } from "../lib/supabase";
import { AppError } from "../erros/app.error";
import { requireAdmin } from "../middleware/require-admin";

const uploadQuerySchema = z.object({
    type: z.enum(["prize", "receipt"]),
});

export async function uploadsRoutes(server: FastifyInstance) {

    server.post("/uploads", async (request, reply) => {
        const { type } = uploadQuerySchema.parse(request.query);

        if(type === "prize"){
            await requireAdmin(request, reply);
        }

        const file = await request.file();

        if (!file) {
            throw new AppError("Arquivo não enviado.", 400);
        }

        const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

        if (!allowedMimeTypes.includes(file.mimetype)) {
            throw new AppError("Formato de arquivo não permitido.", 400);
        }

        const fileBuffer = await file.toBuffer();

        // const extension = extname(file.filename);
        // const fileName = `${type}/${randomUUID()}${extension}`;
        const extensionsByMimeType: Record<string, string> = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
        };

        const extension = extensionsByMimeType[file.mimetype];

        if (!extension) {
            throw new AppError("Formato de arquivo não permitido.", 400);
        }

        const fileName = `${type}/${randomUUID()}${extension}`;
        const bucket = process.env.SUPABASE_BUCKET;

        if (!bucket) {
            throw new AppError("SUPABASE_BUCKET não configurado.", 500);
        }

        const { error } = await supabase.storage
            .from(bucket)
            .upload(fileName, fileBuffer, {
                contentType: file.mimetype,
                upsert: false,
            });

        if (error) {
            throw new AppError(`Erro ao enviar arquivo: ${error.message}`, 500);
        }

        const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);

        return reply.status(201).send({
            message: "Arquivo enviado com sucesso.",
            path: fileName,
            url: data.publicUrl,
        });
    });
}