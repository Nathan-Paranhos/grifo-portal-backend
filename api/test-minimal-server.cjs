const express = require('express');
const app = express();
const PORT = 3002;

console.log('🔄 Starting minimal test server...');

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Minimal server working', timestamp: new Date().toISOString() });
});

app.get('/test', (req, res) => {
  res.json({ message: 'Test endpoint working', timestamp: new Date().toISOString() });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Minimal test server running on port ${PORT}`);
  console.log('✅ Server started successfully!');
}).on('error', (err) => {
  console.error('❌ Server failed to start:', err);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});