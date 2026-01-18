// server.js - Servidor de Sinalização WebSocket (CORRIGIDO)
const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server, clientTracking: true });

// Armazena salas: { roomCode: Set{ws1, ws2} }
const rooms = new Map();

wss.on('connection', (ws, req) => {
    console.log('🔌 Novo cliente conectado. URL:', req.url);

    // Extrai o parâmetro 'room' da URL (ex: ws://localhost:8080?room=sos)
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const roomCode = urlParams.searchParams.get('room') || 'sala-padrao';
    const clientId = `user_${Date.now()}`;

    console.log(`   -> Cliente ${clientId} entrou na sala: "${roomCode}"`);

    // 1. Adiciona o cliente à sala
    if (!rooms.has(roomCode)) {
        rooms.set(roomCode, new Set());
    }
    const room = rooms.get(roomCode);
    room.add(ws);
    ws.roomCode = roomCode;

    // 2. Envia confirmação de entrada APENAS para o novo cliente
    ws.send(JSON.stringify({
        type: 'welcome',
        yourId: clientId,
        room: roomCode,
        userCount: room.size
    }));

    // 3. Informa a TODOS na sala (incluindo o novo) a nova contagem
    broadcastToRoom(roomCode, {
        type: 'user-count',
        count: room.size
    });

    // 4. Escuta mensagens deste cliente
    ws.on('message', (message) => {
        try {
            const signal = JSON.parse(message);
            console.log(`📩 [${roomCode}] Sinal recebido: ${signal.type}`);

            // Repassa o sinal para TODOS OS OUTROS na mesma sala
            broadcastToRoom(roomCode, signal, ws); // 'ws' é o remetente original

        } catch (err) {
            console.error('Erro ao processar mensagem:', err);
        }
    });

    // 5. Lida com a desconexão
    ws.on('close', () => {
        console.log(`❌ Cliente ${clientId} desconectado da sala "${roomCode}"`);
        if (rooms.has(roomCode)) {
            const room = rooms.get(roomCode);
            room.delete(ws);
            if (room.size === 0) {
                console.log(`   -> Sala "${roomCode}" está vazia, removendo.`);
                rooms.delete(roomCode);
            } else {
                // Atualiza a contagem para os que ficaram
                broadcastToRoom(roomCode, {
                    type: 'user-count',
                    count: room.size
                });
            }
        }
    });

    ws.on('error', (err) => {
        console.error(`Erro no WebSocket (${clientId}):`, err);
    });
});

function broadcastToRoom(roomCode, message, excludeWs = null) {
    if (!rooms.has(roomCode)) return;
    const room = rooms.get(roomCode);
    const messageStr = JSON.stringify(message);
    room.forEach(client => {
        // Envia para todos, exceto para quem deve ser excluído (o remetente original)
        if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    });
}

server.listen(8080, '0.0.0.0', () => {
    console.log('=== 🚀 SERVIDOR DE SINALIZAÇÃO INICIADO ===');
    console.log('📡 Ouvindo em:');
    console.log('   - Local:  ws://localhost:8080');
    console.log('   - Rede:   ws://SEU_IP_LOCAL:8080');
    console.log('\n📋 INSTRUÇÕES PARA O HOST:');
    console.log('1. Descubra seu IP local (no terminal: ipconfig / ifconfig)');
    console.log('2. Compartilhe esse IP e a porta 8080 com os outros');
    console.log('3. Os outros acessam seu IP no navegador (HTTP, não HTTPS!)');
    console.log('============================================\n');
});
