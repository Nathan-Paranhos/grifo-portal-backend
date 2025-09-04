import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { logger } from './src/config/logger.js';

const app = express();
const PORT = process.env.PORT || 1000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Minimal server working' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  logger.info(`🚀 Minimal server running on port ${PORT}`);
});

export default app;