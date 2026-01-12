const io = require('socket.io')(3000)

io.on("connection", (socket: { id: any }) => {
    console.log("New client connected:", socket.id)
})