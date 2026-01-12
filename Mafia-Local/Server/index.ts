const io = require('socket.io')(3000, {
    cors: {
        origin: "5500",
    }
})

io.on("connection", (socket: { id: any }) => {
    console.log("New client connected:", socket.id)
})