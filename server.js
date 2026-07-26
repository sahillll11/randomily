const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public')); // serves your HTML/CSS/JS

let waitingQueue = [];

io.on('connection', (socket) => {
  socket.on('skip_and_find_next', () => {
    handleDisconnectOrSkip(socket);
    findMatch(socket);
  });

  socket.on('disconnect', () => {
    handleDisconnectOrSkip(socket);
  });

  socket.on('send_offer', ({ roomId, offer }) => {
    socket.to(roomId).emit('receive_offer', { offer, roomId });
  });

  socket.on('send_answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('receive_answer', { answer });
  });

  socket.on('ice_candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('receive_candidate', { candidate });
  });
});

function handleDisconnectOrSkip(socket) {
  waitingQueue = waitingQueue.filter(id => id !== socket.id);
  if (socket.currentRoom) {
    socket.to(socket.currentRoom).emit('partner_left');
    socket.leave(socket.currentRoom);
    socket.currentRoom = null;
  }
}

function findMatch(socket) {
  if (waitingQueue.length > 0) {
    const partnerId = waitingQueue.shift();
    const partnerSocket = io.sockets.sockets.get(partnerId);

    if (partnerSocket) {
      const roomId = `room_${socket.id}_${partnerId}`;
      socket.join(roomId);
      partnerSocket.join(roomId);

      socket.currentRoom = roomId;
      partnerSocket.currentRoom = roomId;

      socket.emit('match_found', { roomId, isInitiator: true });
      partnerSocket.emit('match_found', { roomId, isInitiator: false });
      return;
    }
  }
  waitingQueue.push(socket.id);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server live on port ${PORT}`));