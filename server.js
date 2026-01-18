// server.js - Servidor de Sinalização WebSocket
const WebSocket = require('ws');
const http = require('http');
const url = require('url');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Armazena salas de chat: { roomCode: [clients...] }
const rooms = new Map();


wss.on('connection', (ws, req) => {
    const parameters = url.parse(req.url, true).query;
    const roomCode = parameters.room || 'default-room';
    const clientId = Date.now() + Math.random().toString(36).substr(2, 9);
    
    console.log(`Novo cliente ${clientId} conectado à sala: ${roomCode}`);
    
    // Adiciona cliente à sala
    if (!rooms.has(roomCode)) rooms.set(roomCode, new Set());
    rooms.get(roomCode).add(ws);
    
    // Atualiza contagem de usuários para todos na sala
    broadcastToRoom(roomCode, { type: 'user-count', count: rooms.get(roomCode).size }, ws);
    
    ws.on('message', (message) => {
        try {
            const signal = JSON.parse(message);
            signal.senderId = clientId;
            
            // Retransmite o sinal para todos os outros na mesma sala
            broadcastToRoom(roomCode, signal, ws);
        } catch (err) {
            console.error('Erro ao processar mensagem:', err);
        }
    });
    
    ws.on('close', () => {
        // Remove cliente da sala
        if (rooms.has(roomCode)) {
            rooms.get(roomCode).delete(ws);
            if (rooms.get(roomCode).size === 0) {
                rooms.delete(roomCode);
            } else {
                broadcastToRoom(roomCode, { type: 'user-count', count: rooms.get(roomCode).size }, ws);
            }
        }
        console.log(`Cliente ${clientId} desconectado da sala: ${roomCode}`);
    });
});

function broadcastToRoom(roomCode, message, excludeWs = null) {
    if (!rooms.has(roomCode)) return;
    
    const messageStr = JSON.stringify(message);
    for (const client of rooms.get(roomCode)) {
        if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    }
}

// Instruções para o Host
console.log(`
=== SERVIDOR DE SINALIZAÇÃO PARA REDE SOS ===
1. Este servidor ajuda dispositivos na mesma rede a se conectarem.
2. Para ser um HOST:
   a. Compartilhe seu Wi-Fi ou crie um hotspot no seu celular/PC.
   b. Todos devem conectar-se na MESMA rede Wi-Fi.
   c. Anote o IP do HOST (seu IP nesta rede). No Windows: ipconfig, no Mac/Linux: ifconfig.
   d. Os "convidados" usarão esse IP no aplicativo web.

3. Inicie o servidor com: node server.js
4. O servidor rodará em: http://SEU_IP_LOCAL:8080
`);

server.listen(8080, '0.0.0.0', () => {
    console.log('Servidor de sinalização rodando na porta 8080');
    console.log('Acesse o aplicativo web em outro dispositivo usando: http://SEU_IP_LOCAL:8080');
});