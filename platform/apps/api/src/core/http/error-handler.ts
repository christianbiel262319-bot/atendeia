import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "../../config/logger.js";
import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../errors/app-error.js";

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({
    error: { code: "NOT_FOUND", message: "Rota não encontrada" },
  });
};

export const errorHandler: ErrorRequestHandler = (error, request, response, next) => {
  void next;
  if (error instanceof ZodError) {
    response.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Dados inválidos",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      response.status(409).json({ error: { code: "CONFLICT", message: "Já existe um registro com estes dados" } });
      return;
    }
    if (error.code === "P2025") {
      response.status(404).json({ error: { code: "NOT_FOUND", message: "Registro não encontrado" } });
      return;
    }
  }

  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({ error: { code: "INVALID_JSON", message: "Corpo JSON inválido" } });
    return;
  }

  logger.error(
    { error, requestId: request.id, path: request.path },
    "Unhandled request error",
  );
  response.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" },
  });
};
