import SplitterComponent from "@/components/SplitterComponent"
import ConnectionStatusPage from "@/components/connection/ConnectionStatusPage"
import Sidebar from "@/components/sidebar/Sidebar"
import WorkSpace from "@/components/workspace"
import { useAppContext } from "@/context/AppContext"
import { useSocket } from "@/context/SocketContext"
import useFullScreen from "@/hooks/useFullScreen"
import useUserActivity from "@/hooks/useUserActivity"
import { SocketEvent } from "@/types/socket"
import { USER_STATUS, User } from "@/types/user"
import { useEffect } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import Videocallcard from "./Videocallcard"
function EditorPage() {
    // Listen user online/offline status
    useUserActivity()
    // Enable fullscreen mode
    useFullScreen()
    const navigate = useNavigate()
    const { roomId } = useParams()
    const { status, setCurrentUser, currentUser } = useAppContext()
    const { socket } = useSocket()
    const location = useLocation()

    const {showCard} = useSocket();
    useEffect(() => {
        if (currentUser.username.length > 0) return
        const username = location.state?.username
        if (username === undefined) {
            navigate("/", {
                state: { roomId },
            })
        } else if (roomId) {
            const user: User = { username, roomId }
            setCurrentUser(user)
            socket.emit(SocketEvent.JOIN_REQUEST, user)
        }
    }, [
        currentUser.username,
        location.state?.username,
        navigate,
        roomId,
        setCurrentUser,
        socket,
    ])

    if (status === USER_STATUS.CONNECTION_FAILED) {
        return <ConnectionStatusPage />
    }
    return (
        <div className="relative w-full h-full">
            
            {showCard &&  (
                <div className="absolute inset-0 flex justify-center items-center bg-black/20 z-50">
                    <Videocallcard />
                </div>
            )}

            <SplitterComponent>
                <Sidebar />
                <WorkSpace />
            </SplitterComponent>
        </div>
    )
}

export default EditorPage
