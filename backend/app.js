const express = require('express');
const multer = require('multer');
const session = require('express-session');
const cors = require('cors');
const registry = require('./routes/register_routes.js');
const http = require('http');
const { Server } = require("socket.io"); 
const cron = require('node-cron');
const { startConsumer } = require('./twitter/kafka-consumer.js');
const { fstartConsumer } = require('./federated_posts/federated-posts-consumer.js');

const app = express();
const port = process.env.PORT || 8080;

// Create an HTTP server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
      origin: "http://localhost:4567",
      methods: ["GET", "POST", "DELETE"],
      credentials: true
  }
});
app.io = io;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
      cb(null, 'uploads/');  
  },
  filename: function(req, file, cb) {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      cb(null, `${file.fieldname}-${uniqueSuffix}`);
  }
});

const upload = multer({ storage: storage });

// CORS configuration to allow requests from the frontend
app.use(cors({
  origin: 'http://localhost:4567',
  methods: ['POST', 'GET', 'DELETE'],
  credentials: true
}));

// Built-in middleware for parsing JSON bodies
app.use(express.json());

// Session middleware configuration
const sessionMiddleware = session({
  secret: 'nets2120_insecure', 
  saveUninitialized: false, 
  cookie: { 
    httpOnly: true,
    secure: false,
    // maxAge: 1000 * 60 * 60 * 24 // 1 day
    maxAge: 1000 * 60 * 10 // 10 minutes for testing
    // maxAge: 10000 // 10 seconds for testing
  }, 
  resave: true
})

app.use(sessionMiddleware);

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// Register routes
registry.register_routes(app, upload);

// Setup socket.io connection
io.on('connection', (socket) => {
  socket.on('setup', (data) => {
    console.log(`user ${data.username} is attempting setup`);
    getUserIdByUsername(data.username).then((results) => {
      const {user_id} = results[0]
      socket.join(user_id);
    }).catch((err) => {
      console.error(err);
    })
  })

  socket.on('join user specific room', (data) => {
    socket.join(data.chat_id);
    console.log(`User joined room: ${data.chat_id}`);
  })

  socket.on('new message', (data) => {
    console.log("recieved alert of new message from frontend sender")
    const { chat_id } = data
    getAllUsersIdsInChatByChatId(chat_id).then((results) => {
      results.forEach(user => {
        const {user_id} = user
        console.log(`emitting alert of new message to frontend reciever with user id ${user_id}`)
        socket.in(user_id).emit('new message', data);
      });
    }).catch((err) => {
      console.error(err);
    })
  })

  socket.on('leave-chat', (data) => {
    const { chatId } = data
    console.log(`User left the chat`);

    // getUserIdByUsername(data.username).then((results) => {
    //   const {user_id} = results[0]
    // }).catch((err) => {
    //   console.error(err);
    // })

    getAllUsersIdsInChatByChatId(chatId).then((results) => {
      results.forEach(user => {
        const {user_id} = user
        socket.in(user_id).emit('user left', {chatId: chatId, username: data.username });
      });
    }).catch((err) => {
      console.error(err);
    })
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });

  socket.on('error', (error) => {
    console.log('Socket Error:', error);
  });
});

// Start the server
server.listen(port, () => {
  console.log(`Main app listening on port ${port}`)

  console.log('Running Twitter Kafka consumer for the first time...');
  startConsumer().catch(console.error);

  cron.schedule('0 0 * * *', () => {
    console.log('Running Twitter Kafka consumer...');
    startConsumer().catch(console.error);
  });

  console.log('Running Federated Post Kafka consumer for the first time...');
  fstartConsumer().catch(console.error);

  cron.schedule('0 0 * * *', () => {
    console.log('Running Federated Post Kafka consumer...');
    fstartConsumer().catch(console.error);
  });
})

// HELPER FUNCTIONS TO QUERY RDS DATABASE SINCE I WANTED SSoT FOR SOCKET IO.

var getAllUsersIdsInChatByChatId = async function(chat_id) {
  try {
      const query = `
          SELECT user_id
          FROM chat_participants
          WHERE chat_id = '${chat_id}';
      `;
      const dbsingleton = require('./models/db_access.js');
      const results = await dbsingleton.send_sql(query);
      return results;
  } catch(err) {
      console.error('Error querying database.');
  }
}

var getUserIdByUsername = async function(username) {
  try {
      const query = `
          SELECT user_id
          FROM users
          WHERE username = '${username}';
      `;
      const dbsingleton = require('./models/db_access.js');
      const results = await dbsingleton.send_sql(query);
      return results;
  } catch(err) {
      console.error('Error querying database.');
  }
}