import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env, isAllowedOrigin } from './config/env.js';
import errorHandler from './core/middlewares/errorHandler.js';
import Response from './core/response/Response.js';
import { authRoutes } from './modules/authModule.js';
import { movieRoutes } from './modules/movieModule.js';
import { libraryRoutes } from './modules/libraryModule.js';
import { profileRoutes } from './modules/profileModule.js';
import { recommendationRoutes } from './modules/recommendationModule.js';

const app = express();

// Production Nginx runs on the same host; trust only local reverse proxies.
app.set('trust proxy', 'loopback');
app.use(cors({
  origin(origin, callback) {
    // Non-browser clients omit Origin; browser origins must pass the same policy
    // as the auth endpoints' trusted-origin check.
    callback(null, origin === undefined || isAllowedOrigin(origin));
  },
  credentials: true,
}));
app.use(express.json({ limit: '16kb' }));
app.use(cookieParser());

app.get('/health', (_req, res) => {
  return res.status(200).json(
    Response.success({ status: 'ok' }, { message: 'Service is healthy' }),
  );
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/movies', movieRoutes);
app.use('/api/v1/library', libraryRoutes);
app.use('/api/v1/profiles', profileRoutes);
app.use('/api/v1/recommendations', recommendationRoutes);

// Mount application routes before the final error handler.
app.use(errorHandler);

export default app;
