import { useAppContext } from "@/context/AppContext";
import { useSocket } from "@/context/SocketContext"; 
const Creatvideocard = () => {
  const { socket } = useSocket();
    const { setCheckVideoCallEnd } = useAppContext();  
  const joinusertovideocall = () => {
         socket.emit("make-video-call");
  };
  return (
    <div className="flex justify-center items-center">
      <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
         Do you want to Start a video call?
        </h2>
        <p className="text-sm text-gray-500 mb-4">
         if you want to make a video call, click on the start Video Call button otherwise cancel.
        </p>

        <div className="flex justify-end space-x-3">
          <button
            onClick={() => setCheckVideoCallEnd(false)}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition bg-red-500"
          >
            Cancel
          </button>
          <button
            onClick={
              joinusertovideocall
            }
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            Start Video call
          </button>
        </div>
      </div>
    </div>
  );
};

export default Creatvideocard;
