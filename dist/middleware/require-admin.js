"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = requireAdmin;
const app_error_1 = require("../erros/app.error");
async function requireAdmin(request) {
    const authorization = request.headers.authorization;
    if (!authorization) {
        throw new app_error_1.AppError("Acesso negado. Token de administrador inválido.", 403);
    }
    const [scheme, token] = authorization.split(" ");
    const adminToken = process.env.ADMIN_TOKEN;
    if (scheme !== "Bearer" || token !== adminToken) {
        throw new app_error_1.AppError("Acesso negado. Token de administrador inválido.", 403);
    }
}
//# sourceMappingURL=require-admin.js.map