const WebSocket = require('ws');

const WS_PORT = 8002;
const devices = {};

const wss = new WebSocket.Server({ port: WS_PORT }, () => {
  console.log(`WebSocket server running on ws://localhost:${WS_PORT}`);
});

wss.on('connection', (ws) => {
  ws.send(JSON.stringify(devices));
  ws.on('error', (error) => console.error('WebSocket error:', error));
  ws.on('close', () => console.log('WebSocket client disconnected'));
});

module.exports = { wss, devices };
