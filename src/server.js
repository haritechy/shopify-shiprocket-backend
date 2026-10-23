const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { env, validateRuntimeEnv } = require('./config/env');
const shippingRouter = require('./routes/shipping');
const { logInfo, logError } = require('./utils/logger');

try {
  validateRuntimeEnv();
} catch (error) {
  logError('Environment validation failed', error);
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '256kb' }));

const limiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
app.use('/api/shipping', limiter);

app.get('/', (req, res) => {
  res.json({
    service: 'Shopify Shiprocket Dynamic Shipping',
    status: 'ok',
    version: '1.0.0',
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/shipping', shippingRouter);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use((error, req, res, next) => {
  logError('Unhandled server error', error);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(env.port, '0.0.0.0', () => {
  logInfo('Server started', { port: env.port, nodeEnv: env.nodeEnv });
});

function shutdown(signal) {
  logInfo('Shutdown requested', { signal });
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
