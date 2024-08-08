const socketIo = require('socket.io');

let io;

const initializeSocket = (server) => {
  io = socketIo(server);

  io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('join', (userId) => {
      socket.join(userId);
      console.log(`User ${userId} joined their room`);
    });

    socket.on('disconnect', () => {
      console.log('A user disconnected');
    });
  });

  return io;
};

const getIo = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

module.exports = { initializeSocket, getIo };
