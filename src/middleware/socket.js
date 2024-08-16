const socketIo = require("socket.io");

let io;

const initializeSocket = (server) => {
  io = socketIo(server);

  io.on("connection", (socket) => {
    socket.on("join", (userId) => {
      socket.join(userId);
    });

    socket.on("disconnect", () => {});
  });

  return io;
};

const getIo = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};

module.exports = { initializeSocket, getIo };
