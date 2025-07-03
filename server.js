const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const { v4: uuidV4 } = require('uuid');
const path = require('path');

// Middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve the landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle room joining from form
app.post('/join', (req, res) => {
  const { n1: name, pass: roomId } = req.body;
  
  if (!name || !roomId) {
    return res.status(400).send('Name and Room ID are required');
  }
  
  // Sanitize inputs
  const sanitizedName = name.trim().slice(0, 50);
  const sanitizedRoomId = roomId.trim().slice(0, 50);
  
  console.log(`User ${sanitizedName} joining room ${sanitizedRoomId}`);
  res.redirect(`/${sanitizedRoomId}&${sanitizedName}`);
});

// Legacy route for backward compatibility
app.post('/adm', (req, res) => {
  const { n1: name, pass: roomId } = req.body;
  
  if (!name || !roomId) {
    return res.status(400).send('Name and Room ID are required');
  }
  
  const sanitizedName = name.trim().slice(0, 50);
  const sanitizedRoomId = roomId.trim().slice(0, 50);
  
  console.log(`User ${sanitizedName} joining room ${sanitizedRoomId}`);
  res.redirect(`/${sanitizedRoomId}&${sanitizedName}`);
});

// Handle room access with name parameter
app.get('/:room&:name', (req, res) => {
  const { room, name } = req.params;
  
  // Validate room and name
  if (!room || !name) {
    return res.redirect('/');
  }
  
  // Sanitize inputs
  const sanitizedRoom = room.trim().slice(0, 50);
  const sanitizedName = name.trim().slice(0, 50);
  
  console.log(`Rendering room ${sanitizedRoom} for user ${sanitizedName}`);
  
  res.render('room', { 
    room: sanitizedRoom, 
    na: sanitizedName,
    pageTitle: `VidConnect - ${sanitizedRoom}`
  });
});

// Handle room access without name (legacy)
app.get('/:room', (req, res) => {
  const { room } = req.params;
  
  // Check if this is a room ID or a static file request
  if (room.includes('.')) {
    return res.status(404).send('File not found');
  }
  
  const sanitizedRoom = room.trim().slice(0, 50);
  const defaultName = 'Guest';
  
  console.log(`Rendering room ${sanitizedRoom} for guest user`);
  
  res.render('room', { 
    room: sanitizedRoom, 
    na: defaultName,
    pageTitle: `VidConnect - ${sanitizedRoom}`
  });
});

// Socket.IO connection handling
io.on('connection', socket => {
  console.log('New socket connection:', socket.id);
  
  socket.on('join-room', (roomId, userId, userName) => {
    // Validate inputs
    if (!roomId || !userId || !userName) {
      console.error('Invalid join-room data:', { roomId, userId, userName });
      return;
    }
    
    console.log(`User ${userName} (${userId}) joining room ${roomId}`);
    
    // Join the room
    socket.join(roomId);
    
    // Store user info in socket
    socket.roomId = roomId;
    socket.userId = userId;
    socket.userName = userName;
    
    // Notify other users in the room
    socket.to(roomId).emit('user-connected', userId, userName);
    
    // Send current room info to the new user
    const roomSockets = io.sockets.adapter.rooms.get(roomId);
    const participantCount = roomSockets ? roomSockets.size : 1;
    
    socket.emit('room-info', {
      participantCount,
      roomId,
      userName
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User ${userName} (${userId}) disconnected from room ${roomId}`);
      socket.to(roomId).emit('user-disconnected', userId, userName);
    });
    
    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });
  
  // Handle general chat messages (if needed for future features)
  socket.on('message', (data) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('message', {
        userId: socket.userId,
        userName: socket.userName,
        message: data.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).send('Internal Server Error');
});

// 404 handler
app.use((req, res) => {
  res.status(404).send('Page not found');
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 VidConnect server running on port ${PORT}`);
  console.log(`📱 Landing page: http://localhost:${PORT}`);
  console.log(`🎥 Direct room access: http://localhost:${PORT}/ROOM_ID&USER_NAME`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});