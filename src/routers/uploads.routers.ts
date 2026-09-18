import { randomUUID } from "node:crypto";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../erros/app.error";
import { supabase } from "../lib/supabase";
import { requireAdmin } from "../middleware/require-admin";

const uploadQuerySchema = z.object({
    type: z.enum(["prize", "receipt"]),
});

const maxFileSizeInBytes = 5 * 1024 * 1024;

const allowedMimeTypesByUploadType = {
    prize: ["image/jpeg", "image/png", "image/webp"],
    receipt: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
};

const extensionsByMimeType: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
};

export async function uploadsRoutes(server: FastifyInstance) {
    server.post("/uploads", async (request, reply) => {
        const { type } = uploadQuerySchema.parse(request.query);

        if (type === "prize") {
            await requireAdmin(request, reply);
        }

        const file = await request.file();

        if (!file) {
            throw new AppError("Arquivo não enviado.", 400);
        }

        const allowedMimeTypes = allowedMimeTypesByUploadType[type];

        if (!allowedMimeTypes.includes(file.mimetype)) {
            throw new AppError(
                type === "prize"
                    ? "Envie uma imagem JPG, PNG ou WEBP para o prêmio."
                    : "Envie um comprovante em JPG, PNG, WEBP ou PDF.",
                400
            );
        }

        const fileBuffer = await file.toBuffer();

        if (fileBuffer.length > maxFileSizeInBytes) {
            throw new AppError("O arquivo deve ter no máximo 5 MB.", 400);
        }

        const extension = extensionsByMimeType[file.mimetype];

        if (!extension) {
            throw new AppError("Formato de arquivo não permitido.", 400);
        }

        const bucket = process.env.SUPABASE_BUCKET;

        if (!bucket) {
            throw new AppError("SUPABASE_BUCKET não configurado.", 500);
        }

        const fileName = `${type}/${randomUUID()}${extension}`;

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