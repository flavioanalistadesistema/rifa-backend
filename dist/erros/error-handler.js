"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const zod_1 = require("zod");
const app_error_1 = require("./app.error");
function errorHandler(error, request, reply) {
    if (error instanceof zod_1.ZodError) {
        return reply.status(400).send({
            message: "dados inválidos.",
            errors: error.issues.map(issue => ({
                path: issue.path.join("."),
                message: issue.message,
            })),
        });
    }
    if (error instanceof app_error_1.AppError) {
        return reply.status(error.status).send({
            message: error.message,
        });
    }
    request.log.error(error);
    return reply.status(500).send({
        message: "Erro interno do servidor.",
    });
}
//# sourceMappingURL=error-handler.js.map