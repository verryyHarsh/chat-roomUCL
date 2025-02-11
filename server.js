const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// Enable CORS for frontend (Netlify)
app.use(cors({ origin: "*" }));

const io = socketIo(server, {
    cors: {
        origin: "*", // Replace * with Netlify frontend URL if needed
        methods: ["GET", "POST"]
    }
});

app.use(express.static(path.join(__dirname, "public")));

// Default route to serve index.html
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

const rooms = {}; // Store room messages and users

io.on("connection", (socket) => {
    console.log("A user connected");

    socket.on("createRoom", ({ room, username }) => {
        if (!rooms[room]) rooms[room] = { users: [], messages: [] };
        rooms[room].users.push(username);
        socket.join(room);
        console.log(`${username} created and joined room: ${room}`);
        socket.emit("roomCreated", room);
    });

    socket.on("checkRoom", ({ room }) => {
        if (rooms[room]) {
            socket.emit("roomExists");
        } else {
            socket.emit("roomNotFound");
        }
    });

    socket.on("joinRoom", ({ room, username }) => {
        if (!rooms[room]) {
            socket.emit("roomNotFound");
            return;
        }
        rooms[room].users.push(username);
        socket.join(room);
        console.log(`${username} joined room: ${room}`);
        socket.emit("loadMessages", rooms[room].messages);
    });

    socket.on("sendMessage", ({ room, message, username }) => {
        if (!rooms[room]) return;

        const fullMessage = { username, message };
        rooms[room].messages.push(fullMessage);

        // Keep only the last 10 messages
        if (rooms[room].messages.length > 10) {
            rooms[room].messages.shift();
        }

        // Broadcast to all users in the room
        io.to(room).emit("newMessage", fullMessage);
    });

    socket.on("disconnect", () => {
        console.log("User disconnected");

        // Find the room where this user was present
        for (const room in rooms) {
            rooms[room].users = rooms[room].users.filter(user => user !== socket.username);

            // If no users left, delete the room
            if (rooms[room].users.length === 0) {
                delete rooms[room];
                console.log(`Room ${room} deleted as all users left.`);
            }
        }
    });

});

// Use process.env.PORT for deployment
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
