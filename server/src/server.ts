import express, { Response, Request } from "express"
import dotenv from "dotenv"
import http from "http"
import cors from "cors"
import { SocketEvent, SocketId } from "./types/socket"
import { USER_CONNECTION_STATUS, User } from "./types/user"
import { Server } from "socket.io"
import path from "path"

dotenv.config()

const app = express()

app.use(express.json())
console.log("FRONTEND_URL:", process.env.FRONTEND_URL);
app.use(cors({
	origin: process.env.FRONTEND_URL,
	credentials: true,
}));


app.use(express.static(path.join(__dirname, "public"))) // Serve static files

const server = http.createServer(app)
const io = new Server(server, {
	cors: {
		origin: process.env.FRONTEND_URL,
		methods: ["GET", "POST"],
		credentials: true
	},
	maxHttpBufferSize: 1e8,
	pingTimeout: 60000,
})

let userSocketMap: User[] = []
let roomVideoUsers: { [roomId: string]: User[] } = {}

// Function to get all users in a room
function getUsersInRoom(roomId: string): User[] {
	return userSocketMap.filter((user) => user.roomId == roomId)
}


// Function to get room id by socket id
function getRoomId(socketId: SocketId): string | null {
	const roomId = userSocketMap.find(
		(user) => user.socketId === socketId
	)?.roomId

	if (!roomId) {
		console.error("Room ID is undefined for socket ID:", socketId)
		return null
	}
	return roomId
}

function getUserBySocketId(socketId: SocketId): User | null {
	const user = userSocketMap.find((user) => user.socketId === socketId)
	if (!user) {
		console.error("User not found for socket ID:", socketId)
		return null
	}
	return user
}

io.on("connection", (socket) => {
	// Handle user actions
	socket.on(SocketEvent.JOIN_REQUEST, ({ roomId, username }) => {
		// Check is username exist in the room
		const isUsernameExist = getUsersInRoom(roomId).filter(
			(u) => u.username === username
		)
		if (isUsernameExist.length > 0) {
			io.to(socket.id).emit(SocketEvent.USERNAME_EXISTS)
			return
		}

		const user = {
			username,
			roomId,
			status: USER_CONNECTION_STATUS.ONLINE,
			cursorPosition: 0,
			typing: false,
			socketId: socket.id,
			currentFile: null,
		}
		userSocketMap.push(user)
		socket.join(roomId)
		socket.broadcast.to(roomId).emit(SocketEvent.USER_JOINED, { user })
		const users = getUsersInRoom(roomId)
		io.to(socket.id).emit(SocketEvent.JOIN_ACCEPTED, { user, users })
	})

	socket.on("disconnecting", () => {
		const user = getUserBySocketId(socket.id)
		if (!user) return
		const roomId = user.roomId
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.USER_DISCONNECTED, { user })
		userSocketMap = userSocketMap.filter((u) => u.socketId !== socket.id)
		if (roomVideoUsers[roomId]) {
			roomVideoUsers[roomId] = roomVideoUsers[roomId].filter(
				u => u.socketId !== socket.id
			);
		}
		socket.leave(roomId)
	})

	// Handle file actions
	socket.on(
		SocketEvent.SYNC_FILE_STRUCTURE,
		({ fileStructure, openFiles, activeFile, socketId }) => {
			io.to(socketId).emit(SocketEvent.SYNC_FILE_STRUCTURE, {
				fileStructure,
				openFiles,
				activeFile,
			})
		}
	)

	socket.on(
		SocketEvent.DIRECTORY_CREATED,
		({ parentDirId, newDirectory }) => {
			const roomId = getRoomId(socket.id)
			if (!roomId) return
			socket.broadcast.to(roomId).emit(SocketEvent.DIRECTORY_CREATED, {
				parentDirId,
				newDirectory,
			})
		}
	)

	socket.on(SocketEvent.DIRECTORY_UPDATED, ({ dirId, children }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.DIRECTORY_UPDATED, {
			dirId,
			children,
		})
	})

	socket.on(SocketEvent.DIRECTORY_RENAMED, ({ dirId, newName }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.DIRECTORY_RENAMED, {
			dirId,
			newName,
		})
	})

	socket.on(SocketEvent.DIRECTORY_DELETED, ({ dirId }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.DIRECTORY_DELETED, { dirId })
	})

	socket.on(SocketEvent.FILE_CREATED, ({ parentDirId, newFile }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.FILE_CREATED, { parentDirId, newFile })
	})

	socket.on(SocketEvent.FILE_UPDATED, ({ fileId, newContent }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.FILE_UPDATED, {
			fileId,
			newContent,
		})
	})

	socket.on(SocketEvent.FILE_RENAMED, ({ fileId, newName }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.FILE_RENAMED, {
			fileId,
			newName,
		})
	})

	socket.on(SocketEvent.FILE_DELETED, ({ fileId }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.FILE_DELETED, { fileId })
	})

	// Handle user status
	socket.on(SocketEvent.USER_OFFLINE, ({ socketId }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socketId) {
				return { ...user, status: USER_CONNECTION_STATUS.OFFLINE }
			}
			return user
		})
		const roomId = getRoomId(socketId)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.USER_OFFLINE, { socketId })
	})

	socket.on(SocketEvent.USER_ONLINE, ({ socketId }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socketId) {
				return { ...user, status: USER_CONNECTION_STATUS.ONLINE }
			}
			return user
		})
		const roomId = getRoomId(socketId)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.USER_ONLINE, { socketId })
	})

	// Handle chat actions
	socket.on(SocketEvent.SEND_MESSAGE, ({ message }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.RECEIVE_MESSAGE, { message })
	})

	// Handle cursor position
	socket.on(SocketEvent.TYPING_START, ({ cursorPosition }) => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socket.id) {
				return { ...user, typing: true, cursorPosition }
			}
			return user
		})
		const user = getUserBySocketId(socket.id)
		if (!user) return
		const roomId = user.roomId
		socket.broadcast.to(roomId).emit(SocketEvent.TYPING_START, { user })
	})

	socket.on(SocketEvent.TYPING_PAUSE, () => {
		userSocketMap = userSocketMap.map((user) => {
			if (user.socketId === socket.id) {
				return { ...user, typing: false }
			}
			return user
		})
		const user = getUserBySocketId(socket.id)
		if (!user) return
		const roomId = user.roomId
		socket.broadcast.to(roomId).emit(SocketEvent.TYPING_PAUSE, { user })
	})

	socket.on(SocketEvent.REQUEST_DRAWING, () => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast
			.to(roomId)
			.emit(SocketEvent.REQUEST_DRAWING, { socketId: socket.id })
	})

	socket.on(SocketEvent.SYNC_DRAWING, ({ drawingData, socketId }) => {
		socket.broadcast
			.to(socketId)
			.emit(SocketEvent.SYNC_DRAWING, { drawingData })
	})

	socket.on(SocketEvent.DRAWING_UPDATE, ({ snapshot }) => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		socket.broadcast.to(roomId).emit(SocketEvent.DRAWING_UPDATE, {
			snapshot,
		})
	})

	socket.on("make-video-call", () => {
		const roomId = getRoomId(socket.id)
		if (!roomId) return
		io.to(roomId).emit("make-video-call", { showcard: true })

	})

	// Handle when a user joins the video call
	socket.on("join-video-call", () => {
		const roomId = getRoomId(socket.id);
		if (!roomId) return;

		const user = userSocketMap.find(u => u.socketId === socket.id);
		if (!user) return;

		if (!roomVideoUsers[roomId]) roomVideoUsers[roomId] = [];

		// Send existing users in the room to the new user
		const existingUsers = roomVideoUsers[roomId].map(u => ({
			socketId: u.socketId,
			username: u.username,
		}));

		io.to(socket.id).emit("existing-users", {
			users: existingUsers,
			socketId: socket.id,
		});

		// Remove old entry (if any) for this user
		roomVideoUsers[roomId] = roomVideoUsers[roomId].filter(
			u => u.socketId !== user.socketId
		);

		// Add the fresh one
		roomVideoUsers[roomId].push(user);


		// Notify others in the room that a new user joined
		socket.broadcast.to(roomId).emit("user-joined-success", {
			userId: socket.id,
			username: user.username,
		});
	});

	// Forward WebRTC offer to target user
	socket.on("offer", ({ to, offer }) => {
		const fromUser = userSocketMap.find(u => u.socketId === socket.id);
		if (!fromUser) return;

		io.to(to).emit("offer", {
			from: socket.id,
			offer,
			username: fromUser.username, // ✅ send caller’s username
		});
	});

	// Forward WebRTC answer to target user
	socket.on("answer", ({ to, answer }) => {
		io.to(to).emit("answer", { from: socket.id, answer });
	});

	// Forward ICE candidates to target user
	socket.on("ice-candidate", ({ to, candidate }) => {
		io.to(to).emit("ice-candidate", { from: socket.id, candidate });
	});

	// Handle user leaving video call
	socket.on("leave-video-call", () => {
		const roomId = getRoomId(socket.id);
		if (!roomId) return;

		const user = userSocketMap.find(u => u.socketId === socket.id);
		if (!user) return;

		if (roomVideoUsers[roomId]) {
			roomVideoUsers[roomId] = roomVideoUsers[roomId].filter(
				u => u.socketId !== socket.id
			);
		}

		// Notify others in the room
		socket.broadcast.to(roomId).emit("user-left", { userId: socket.id });

		// If no users left, end the video call for the room
		if (roomVideoUsers[roomId] && roomVideoUsers[roomId].length === 0) {

			io.to(roomId).emit("video-call-ended");
		}
	});

	socket.on("check-video-call", () => {
		const roomId = getRoomId(socket.id);
		if (!roomId) return;

		const checkvideocallhappning = roomVideoUsers[roomId] && roomVideoUsers[roomId].length > 0;

		io.to(socket.id).emit("check-video-call", { happening: checkvideocallhappning });
	});

	socket.on("check-current-user-in-video-call", () => {
		const roomId = getRoomId(socket.id);
		if (!roomId) return;

		const isInVideoCall = roomVideoUsers[roomId]?.some(u => u.socketId === socket.id);
		io.to(socket.id).emit("current-user-in-video-call", { inCall: isInVideoCall });
	});

});

const PORT = process.env.PORT || 3000

app.get("/", (req: Request, res: Response) => {
	// Send the index.html file
	res.sendFile(path.join(__dirname, "..", "public", "index.html"))
})

server.listen(PORT, () => {
	console.log(`Listening on port ${PORT}`)
})
