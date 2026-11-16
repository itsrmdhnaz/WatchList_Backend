import app from './app.js';
import { env } from './config/env.js';
import { logger } from './core/utils/logger.js';

const host = env.nodeEnv === 'production' ? 'localhost' : '0.0.0.0';

app.listen(env.port, host, () => {
  logger.info(`Movie Platform API listening on ${host}:${env.port}`);
});
