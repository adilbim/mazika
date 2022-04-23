const Innertube = require("youtubei.js");
const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const { getUsersInRoom, addUser, getUser, removeUser } = require("./users");

let youtube;
async function start() {
  youtube = await new Innertube({ gl: 'US' });
}
start();

app.get("/", (req, res) => {
  res.send(`
    <h1>hello world</h1>
  `)
});

app.get("/search", async (req, res) => {
  const {query} = req.query;

  try {
    const search = await youtube.search(query);
    console.log(search);
    res.send({ data: search});
  } catch (error) {
    console.log(error);  
    res.send({error})
  }
})

io.on("connection", (socket) => {
  console.log("a user connected", socket.id);
});

io.on("connection", (socket) => {
  socket.on("chat message", (msg) => {
    io.emit("chat message", msg);
  });
});

io.on("connection", (socket) => {
  socket.on("join", (payload, callback) => {
    let numberOfUsersInRoom = getUsersInRoom(payload.room).length;

    const { error, newUser } = addUser({
      id: socket.id,
      name: numberOfUsersInRoom === 0 ? "Player 1" : "Player 2",
      room: payload.room,
    });
    console.log("newUser", newUser);

    if (error) return callback(error);

    socket.join(newUser.room);

    io.to(newUser.room).emit("roomData", {
      room: newUser.room,
      users: getUsersInRoom(newUser.room),
    });

    socket.emit("currentUserData", { name: newUser.name });
  });

  socket.on("initGameState", (gameState) => {
    const user = getUser(socket.id);
    if (user) io.to(user.room).emit("initGameState", gameState);
  });

  socket.on("updateGameState", (gameState) => {
    const user = getUser(socket.id);
    if (user) io.to(user.room).emit("updateGameState", gameState);
  });

  socket.on("sendMessage", (payload, callback) => {
    const user = getUser(socket.id);
    io.to(user.room).emit("message", {
      user: user.name,
      text: payload.message,
    });
    callback();
  });

  socket.on("disconnect", () => {
    console.log("user Disconnected!", socket.id);
    const user = removeUser(socket.id);
    if (user)
      io.to(user.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
  });
});

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
