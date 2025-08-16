enum USER_CONNECTION_STATUS {
	OFFLINE = "offline",
	ONLINE = "online",
}

interface User {
	username: string
	roomId: string
	status: USER_CONNECTION_STATUS
	cursorPosition: number
	typing: boolean
	currentFile: string | null
	socketId: string
}
interface VideoUser {
  socketId: string;      // Unique socket connection ID
  username: string;      // Display name of the user
}

export { USER_CONNECTION_STATUS, User, VideoUser }
