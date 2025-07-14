import express from 'express';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

// Setup Express application
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
// Serve static UI
app.use(express.static(__dirname));
app.use(cors());
// Parse JSON bodies
app.use(express.json({ limit: '50mb' }));

// Simple file serving endpoints can be added here if needed

// Start the server, allowing a dynamic port when PORT=0 or unset
const desiredPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 0;
const server = app.listen(desiredPort, () => {
  const actualPort = server.address().port;
  console.log(`Server listening on http://localhost:${actualPort}`);
});