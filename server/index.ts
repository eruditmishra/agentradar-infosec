import app from "./src/app";
import { logger } from "./src/shared/logger";
import { registerProcessErrorHandlers } from "./src/shared/middleware/processErrorHandler";
import { startScheduler } from "./src/modules/scheduler/scheduler.service";

registerProcessErrorHandlers();

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  logger.info(`AgentRadar listening on port ${PORT}`);
  startScheduler();
});
