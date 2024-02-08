const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// MongoDB connection
const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://rootadmin:N6Ejfd8aEbiryQjk@cluster0.etztr7w.mongodb.net/W2024_comp3133?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});


const express_server = app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}/`);
})

const ioServer = require('socket.io')(express_server);


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
})

app.get('/group_chat', (req, res) => {
    res.sendFile(__dirname + '/group_chat.html');
})

app.get('/register', (req, res) => {
    res.sendFile(__dirname + '/register.html');
})

// Express route for handling login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
  
    try {
      // Check if the user exists in the database
      const user = await db.collection('users').findOne({ username, password });
  
      if (user) {
        // User exists, login successful
        res.json({ success: true });
      } else {
        // User not found or invalid credentials
        res.json({ success: false });
      }
    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

// Express route for handling registration
app.post('/register', async (req, res) => {
    const { username, firstname, lastname, password, createon } = req.body;
  
    try {
      // Check if the user exists in the database
      const user = await db.collection('users').findOne({ username });
  
      if (user) {
        // User already exists
        res.json({ success: false, message: 'User already exists' });
      } else {
        // Create a new user
        await db.collection('users').insertOne({ username, firstname, lastname, password, createon });
        res.json({ success: true });
      }
    } catch (error) {
      console.error('Error during registration:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

// Endpoint to get chat history for a specific group
// Example: /getChatHistory?group=covid19
app.get('/getChatHistory', async (req, res) => {
    const { group } = req.query;
    console.log(group);
  
    try {
      // Get chat history for the group
      const chatHistory = await db.collection('groupmessages').find({ room:group }).toArray();
      res.json({ success: true, chatHistory });
      console.log(chatHistory);
    } catch (error) {
      console.error('Error getting chat history:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

ioServer.on('connection', (socket) => {
    console.log(`New user connected: ${socket.id}`);
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });

    socket.on('say_hello', (msg) => {
        console.log(msg);
        //ioServer.emit('welcome', msg)//broadcast to all
        socket.emit('welcome', msg)
    })

    socket.on('chat_message', async (msg) => {
    const username = msg.username;
    const group = msg.group;
    const message = msg.message;

      if (username && group && message) {
            ioServer.emit('chat_message', msg); // Emit the message as it is

            // Insert the message into MongoDB's groupmessages collection
            try {
                const room = group;
                const from_user = username;
                const date_sent = new Date();

                // Insert the message into the collection
                await db.collection('groupmessages').insertOne({
                    from_user,
                    room,
                    message,
                    date_sent,
                });

                console.log('Message inserted into groupmessages collection:', msg);
            } catch (error) {
                console.error('Error inserting message into groupmessages collection:', error);
            }
        } else {
            console.warn('Username not found in the chat message:', msg);
        }
    });

    //Join a room
    socket.on('join_group', (room) => {
        console.log(`User ${socket.id} joined room ${room}`)
        socket.join(room);
    })

    //Send message to a room
    socket.on('group_message', (data) => {
        console.log(`User ${socket.id} sent message to room ${data.group}`)
        ioServer.to(data.group).emit('group_message_client', data.message)
    });

    //Leave a room
    socket.on('leave_group', (group) => {
        console.log(`User ${socket.id} left room`)
        socket.leave(group);
    });

    // User is typing event
    socket.on('user_typing', function(data) {
      // Broadcast the typing event to other users in the same group
      ioServer.to(data.group).emit('user_typing', { username: data.username });
    });

})


