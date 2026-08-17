export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthorized = (message = "Não autorizado") =>
  new AppError(401, "UNAUTHORIZED", message);

export const forbidden = (message = "Acesso negado") =>
  new AppError(403, "FORBIDDEN", message);

export const conflict = (message: string) =>
  new AppError(409, "CONFLICT", message);
