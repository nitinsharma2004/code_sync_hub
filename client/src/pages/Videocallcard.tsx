import { useAppContext } from "@/context/AppContext";
import { useSocket } from "@/context/SocketContext"; 
import { useEffect } from "react";
const Videocallcard = () => {
  const { showCard, setShowCard,socket, currentuserinvideocall } = useSocket();
  const {setisinvideocall,videoCallState,setCheckVideoCallEnd} = useAppContext();
  const joinusertovideocall = () => {
        socket.emit("join-video-call");
        setShowCard(false);
        setisinvideocall(true);
        setCheckVideoCallEnd(false);
  };

  useEffect(() => {
    socket.emit("check-current-user-in-video-call");
  }, [currentuserinvideocall]);

  if (!showCard || currentuserinvideocall) return null;

  return (
    <div className="flex justify-center items-center">
      <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
         {videoCallState?"Do you want to RE-JOIN the video call?":"Do you want to JOIN the video call?"}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {videoCallState?"Click RE-JOIN to connect instantly or cancel to ignore.":"Click JOIN to connect instantly or cancel to ignore."}
        </p>

        <div className="flex justify-end space-x-3">
          <button
            onClick={() => setShowCard(false)}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={
              joinusertovideocall
            }
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            {videoCallState ? "Rejoin" : "Join"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Videocallcard;
