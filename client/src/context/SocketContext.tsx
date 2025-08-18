import { DrawingData } from "@/types/app"
import {
    SocketContext as SocketContextType,
    SocketEvent,
    SocketId,
} from "@/types/socket"
import { RemoteUser, USER_STATUS, User } from "@/types/user"
import {
    ReactNode,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
} from "react"
import { toast } from "react-hot-toast"
import { Socket, io } from "socket.io-client"
import { useAppContext } from "./AppContext"
import { useState } from "react"
const SocketContext = createContext<SocketContextType | null>(null)

export const useSocket = (): SocketContextType => {
    const context = useContext(SocketContext)
    if (!context) {
        throw new Error("useSocket must be used within a SocketProvider")
    }
    return context
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000"

const SocketProvider = ({ children }: { children: ReactNode }) => {
    const {
        users,
        setUsers,
        setStatus,
        setCurrentUser,
        drawingData,
        setDrawingData,
        setVideoCallState
    } = useAppContext()
    const [showCard, setShowCard] = useState(false);
    const [currentVideoUser, setCurrentVideoUser] = useState<RemoteUser | null>(null);
    const [currentuserinvideocall, setCurrentUserInVideoCall] = useState(false);
    const socket: Socket = useMemo(
        () =>
            io(BACKEND_URL, {
                reconnectionAttempts: 2,
            }),
        [],
    )

    const handleError = useCallback(
        (err: any) => {
            console.log("socket error", err)
            setStatus(USER_STATUS.CONNECTION_FAILED)
            toast.dismiss()
            toast.error("Failed to connect to the server")
        },
        [setStatus],
    )

    const handleUsernameExist = useCallback(() => {
        toast.dismiss()
        setStatus(USER_STATUS.INITIAL)
        toast.error(
            "The username you chose already exists in the room. Please choose a different username.",
        )
    }, [setStatus])

    const handleJoiningAccept = useCallback(
        ({ user, users }: { user: User; users: RemoteUser[] }) => {
            setCurrentUser(user)
            setUsers(users)
            toast.dismiss()
            setStatus(USER_STATUS.JOINED)

            if (users.length > 1) {
                toast.loading("Syncing data, please wait...")
            }
        },
        [setCurrentUser, setStatus, setUsers],
    )

    const handleUserLeft = useCallback(
        ({ user }: { user: User }) => {
            toast.success(`${user.username} left the room`)
            setUsers(users.filter((u: User) => u.username !== user.username))
        },
        [setUsers, users],
    )

    const handleRequestDrawing = useCallback(
        ({ socketId }: { socketId: SocketId }) => {
            socket.emit(SocketEvent.SYNC_DRAWING, { socketId, drawingData })
        },
        [drawingData, socket],
    )

    const handleDrawingSync = useCallback(
        ({ drawingData }: { drawingData: DrawingData }) => {
            setDrawingData(drawingData)
        },
        [setDrawingData],
    )

    const handleShowcard = useCallback(({ showcard }: { showcard: boolean }) => {
        if (showcard) {
            setShowCard(showcard);
        }
    }, [setShowCard])

    const checkvideocallstate = useCallback(({ happening }: { happening: boolean }) => {
        setVideoCallState(happening);
    }, [setVideoCallState])

    const checkcurrentuserinvideocall = useCallback(({ inCall }: { inCall: boolean }) => {
        setCurrentUserInVideoCall(inCall);
    }, [setCurrentUserInVideoCall])


    const checkvideocallend = useCallback(()=>{
        setVideoCallState(false);
    }, [setVideoCallState])

    useEffect(() => {
        socket.on("connect_error", handleError)
        socket.on("connect_failed", handleError)
        socket.on(SocketEvent.USERNAME_EXISTS, handleUsernameExist)
        socket.on(SocketEvent.JOIN_ACCEPTED, handleJoiningAccept)
        socket.on(SocketEvent.USER_DISCONNECTED, handleUserLeft)
        socket.on(SocketEvent.REQUEST_DRAWING, handleRequestDrawing)
        socket.on(SocketEvent.SYNC_DRAWING, handleDrawingSync)
        socket.on("make-video-call", handleShowcard)
        socket.on("video-call-ended", checkvideocallend);
        socket.on("check-video-call", checkvideocallstate);
        socket.on("current-user-in-video-call", checkcurrentuserinvideocall);
        socket.on("user-joined-success", ({ username }) => {
            toast.dismiss();
            toast.success(`${username} joined the video call`);
        });

        return () => {
            socket.off("connect_error")
            socket.off("connect_failed")
            socket.off(SocketEvent.USERNAME_EXISTS)
            socket.off(SocketEvent.JOIN_ACCEPTED)
            socket.off(SocketEvent.USER_DISCONNECTED)
            socket.off(SocketEvent.REQUEST_DRAWING)
            socket.off(SocketEvent.SYNC_DRAWING)
            socket.off("make-video-call")
            socket.off("joined-video-call")
            socket.off("check-video-call")
            socket.off("current-user-in-video-call")
        }
    }, [
        handleDrawingSync,
        handleError,
        handleJoiningAccept,
        handleRequestDrawing,
        handleUserLeft,
        handleUsernameExist,
        checkvideocallstate,
        checkcurrentuserinvideocall,
        checkvideocallend,
        handleShowcard,
        setUsers,
        socket,
    ])

    return (
        <SocketContext.Provider
            value={{
                socket,
                showCard,
                setShowCard,
                currentVideoUser,
                setCurrentVideoUser,
                currentuserinvideocall,
                setCurrentUserInVideoCall,
            }}
        >
            {children}
        </SocketContext.Provider>
    )
}

export { SocketProvider }
export default SocketContext
