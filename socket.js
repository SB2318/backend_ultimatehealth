const jwt = require('jsonwebtoken');
const BlacklistedToken = require('./models/blackListedToken');
const { Server } = require('socket.io');

// This part checking is extra, but it's good practice to check if the token is blacklisted or invalid.
// next level protection layer

const socketIO = (server)=>{

    const io = new Server(server);

    // Middleware to authenticate websocket connection

    io.use(async (socket, next)=>{

    const token = socket.handshake.query.token || socket.handshake.headers['authorization']?.split(' ')[1];

    if(!token){
        return next();  // continue with public routing
    }

    const blacklistedToken = await BlacklistedToken.findOne({ token });
    if (blacklistedToken) {
      return next(new Error('Token is blacklisted'));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
          console.error('Token verification error:', err.message);
          //return res.status(403).json({ error: 'Invalid token' });
          return next(new Error('Invalid token'));
        }
    
      //console.log("USER izzz", user)
        socket.user = user;
        next();
      });

    })

    io.on('connection', (socket) => {
        console.log('New client connected, socket ID:', socket.id);
    
        socket.emit('welcome-message', 'Welcome to UltimateHealth!');
    
        socket.on('disconnecting',()=>{
        console.log('Client disconnecting, socket ID:', socket.id);
        socket.emit('good bye!', 'good bye! have a great day'); 
        })
        socket.on('disconnect', () => {
          console.log('Client disconnected');
        });
      });

      // Attach the io instance to the app for use in controllers
      server.io = io; 
}

module.exports = socketIO;