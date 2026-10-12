import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async route handler so any rejected promise / thrown error is
 * forwarded to next(), instead of crashing the process or hanging the
 * request. Express does not catch async errors automatically — this is
 * the standard workaround short of using a framework that does.
 */
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
