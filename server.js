const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// HTML/CSS/JS static files serve karne ke liye
app.use(express.static(__dirname));

let waitingUser = null; // Partner wait queue

io.on('connection', (socket) => {
  console.log('User Connected:', socket.id);

  // 1. Random Matching Logic
  socket.on('find-partner', () => {
    // Prevent matching with self or if user is already waiting
    if (waitingUser && waitingUser.id === socket.id) return;

    if (waitingUser) {
      // Room ID banao dono ke liye
      const roomId = `room-${waitingUser.id}-${socket.id}`;

      socket.join(roomId);
      waitingUser.join(roomId);

      // WebRTC connection initiate karne ke liye batayein
      // (Pehle user ko initiator banate hain)
      waitingUser.emit('matched', { roomId, isInitiator: true });
      socket.emit('matched', { roomId, isInitiator: false });

      console.log(`Matched ${socket.id} with ${waitingUser.id} in ${roomId}`);
      waitingUser = null; // Waiting queue reset
    } else {
      waitingUser = socket;
      socket.emit('waiting', 'Searching for a stranger...');
    }
  });

  // 2. WebRTC Signaling (Video stream peer-to-peer connect karne ke liye)
  socket.on('signal', ({ roomId, signalData }) => {
    socket.to(roomId).emit('signal', signalData);
  });

  // 3. Real-time Chat Messages Forward Karna
  socket.on('send-message', ({ roomId, message }) => {
    socket.to(roomId).emit('receive-message', message);
  });

  // 4. Leave / Skip Partner Logic
  socket.on('leave-room', ({ roomId }) => {
    socket.to(roomId).emit('partner-disconnected');
    socket.leave(roomId);
  });

  // 5. Disconnect logic
  socket.on('disconnect', () => {
    console.log('User Disconnected:', socket.id);
    
    // Agar waiting user disconnect ho jaye
    if (waitingUser && waitingUser.id === socket.id) {
      waitingUser = null;
    }

    // Inform rooms about disconnect
    socket.broadcast.emit('partner-disconnected');
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});