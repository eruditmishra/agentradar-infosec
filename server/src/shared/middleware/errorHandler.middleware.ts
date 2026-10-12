import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import jwt from "jsonwebtoken";
import { AppError } from "../errors";
import { logger } from "../logger";
import { config } from "../config";

/**
 * Catches any error not otherwise handled by a specific route. Must be
 * registered LAST, after all routes, per Express error-middleware rules
 * (four-arg signature is what makes Express treat this as an error handler).
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
) {
  // 1. Known, expected application errors
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error({ err, path: req.path }, "Non-operational AppError");
    } else {
      logger.warn(
        { code: err.code, path: req.path, details: err.details },
        err.message,
      );
    }
    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // 2. Zod validation errors thrown directly (e.g. schema.parse() without try/catch elsewhere)
  if (err instanceof ZodError) {
    logger.warn({ path: req.path, issues: err.issues }, "Validation error");
    return res.status(422).json({
      error: "VALIDATION_ERROR",
      message: "Request validation failed",
      details: err.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
  }

  // 3. JWT errors that slipped past auth middleware (e.g. thrown in a service, not caught locally)
  if (
    err instanceof jwt.JsonWebTokenError ||
    err instanceof jwt.TokenExpiredError
  ) {
    logger.warn({ path: req.path }, "JWT error reached global handler");
    return res.status(401).json({ error: "INVALID_OR_EXPIRED_TOKEN" });
  }

  // 4. Postgres errors — surface constraint violations as 409s instead of 500s
  if (isPgError(err)) {
    if (err.code === "23505") {
      logger.warn(
        { path: req.path, detail: err.detail },
        "Unique constraint violation",
      );
      return res
        .status(409)
        .json({ error: "CONFLICT", message: "Resource already exists" });
    }
    if (err.code === "23503") {
      logger.warn(
        { path: req.path, detail: err.detail },
        "Foreign key violation",
      );
      return res
        .status(400)
        .json({
          error: "INVALID_REFERENCE",
          message: "Referenced resource does not exist",
        });
    }
    // fall through to generic 500 for other pg error codes
  }

  // 5. Truly unexpected errors — log full detail server-side, never leak internals to the client
  logger.error({ err, path: req.path, method: req.method }, "Unhandled error");

  return res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: "Something went wrong",
    ...(config.env !== "production" && err instanceof Error
      ? { stack: err.stack, originalMessage: err.message }
      : {}),
  });
}

function isPgError(err: unknown): err is { code: string; detail?: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as any).code === "string"
  );
}

/**
 * Catches requests to routes that don't exist. Register right before
 * errorHandler, after all real routes.
 */
export function notFoundHandler(req: Request, res: Response) {
  res
    .status(404)
    .json({
      error: "NOT_FOUND",
      message: `No route for ${req.method} ${req.path}`,
    });
}
