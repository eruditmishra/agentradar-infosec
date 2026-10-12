import { logger } from "../logger";

/**
 * Catches errors Express's error middleware never sees — uncaught exceptions
 * and unhandled promise rejections outside the request/response cycle (e.g.
 * inside the scheduler/cron jobs). Without this, these crash the process
 * silently or with an unhelpful stack trace.
 */
export function registerProcessErrorHandlers() {
  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "Uncaught exception — shutting down");
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logger.fatal(
      { err: reason },
      "Unhandled promise rejection — shutting down",
    );
    process.exit(1);
  });
}
