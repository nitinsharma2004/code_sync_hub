import  { useEffect, useRef, useState } from "react";
import { useAppContext } from "@/context/AppContext";
import { useSocket } from "@/context/SocketContext";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import { toast } from "react-hot-toast";

interface RemoteStream {
  userId: string;
  username: string;
  stream: MediaStream;
}

const VideocallView = () => {
  const { setisinvideocall } = useAppContext();
  const { socket } = useSocket();

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const localStream = useRef<MediaStream | null>(null);

  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const pendingCandidates = useRef<Record<string, RTCIceCandidate[]>>({});

  useEffect(() => {
    const startStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStream.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true; // only local muted
        }
        socket.emit("join-video-call");
      } catch (error) {
        console.error("Error accessing media devices:", error);
      }
    };
    startStream();
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    socket.on("existing-users", async ({ users, socketId }) => {
      console.log("Existing users:", users);
      for (const user of users) {
        if (user.socketId === socketId) continue;
        const pc = createPeerConnection(user.socketId, user.username);
        localStream.current?.getTracks().forEach(track =>
          pc.addTrack(track, localStream.current!)
        );
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", { to: user.socketId, offer: pc.localDescription });
      }
    });

    socket.on("user-joined", async ({ userId, username }) => {
            toast.dismiss();
            toast.success(`${username} joined the video call`);
      const pc = createPeerConnection(userId, username);
      localStream.current?.getTracks().forEach(track =>
        pc.addTrack(track, localStream.current!)
      );
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", { to: userId, offer: pc.localDescription });
    });

    socket.on("offer", async ({ from, offer, username }) => {
      console.log("Offer from:", username);
      const pc = createPeerConnection(from, username);
      localStream.current?.getTracks().forEach(track =>
        pc.addTrack(track, localStream.current!)
      );
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { to: from, answer: pc.localDescription });
      await applyPendingCandidates(from);
    });

    socket.on("answer", async ({ from, answer }) => {
      console.log("Answer from:", from);
      if (peersRef.current[from]) {
        await peersRef.current[from].setRemoteDescription(
          new RTCSessionDescription(answer)
        );
        await applyPendingCandidates(from);
      }
    });

    socket.on("ice-candidate", ({ from, candidate }) => {
      const ice = new RTCIceCandidate(candidate);
      if (peersRef.current[from]?.remoteDescription) {
        peersRef.current[from].addIceCandidate(ice);
      } else {
        if (!pendingCandidates.current[from]) pendingCandidates.current[from] = [];
        pendingCandidates.current[from].push(ice);
      }
    });

    socket.on("user-left", ({ userId }) => {
      console.log("User left:", userId);
      if (peersRef.current[userId]) {
        peersRef.current[userId].close();
        delete peersRef.current[userId];
      }
      setRemoteStreams(prev => prev.filter(s => s.userId !== userId));
    });

    return () => {
      socket.off("existing-users");
      socket.off("user-joined");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("user-left");
    };
  }, [socket]);

  const applyPendingCandidates = async (userId: string) => {
    if (pendingCandidates.current[userId]) {
      for (const c of pendingCandidates.current[userId]) {
        await peersRef.current[userId].addIceCandidate(c);
      }
      delete pendingCandidates.current[userId];
    }
  };

  const createPeerConnection = (userId: string, username: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", { to: userId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      console.log("Remote track from:", username);
      setRemoteStreams(prev => {
        if (prev.find(s => s.userId === userId)) return prev;
        return [...prev, { userId, username, stream: event.streams[0] }];
      });
    };

    peersRef.current[userId] = pc;
    return pc;
  };

  const toggleMic = () => {
    if (!localStream.current) return;
    localStream.current.getAudioTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
    setMicOn(prev => !prev);
  };

  const toggleCam = () => {
    if (!localStream.current) return;
    localStream.current.getVideoTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
    setCamOn(prev => !prev);
  };

  const leaveCall = () => {
    socket.emit("leave-video-call");
    localStream.current?.getTracks().forEach(track => track.stop());
    Object.values(peersRef.current).forEach(pc => pc.close());
    peersRef.current = {};
    setRemoteStreams([]);
    setisinvideocall(false);
  };

  return (
    <div className="flex flex-col items-center w-full h-screen bg-gray-900 text-white">
      <div className="grid grid-cols-2 gap-4 flex-grow p-4">
        <div className="relative rounded-lg overflow-hidden bg-black">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <span className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded">
            You
          </span>
        </div>

        {remoteStreams.map(({ userId, username, stream }) => (
          <div key={userId} className="relative rounded-lg overflow-hidden bg-black">
            <video
              autoPlay
              playsInline
              ref={(el) => {
                if (el) el.srcObject = stream;
              }}
              className="w-full h-full object-cover"
            />
            <span className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded">
              {username}
            </span>
          </div>
        ))}
      </div>

      <div className="flex space-x-4 p-4 bg-gray-800 w-full justify-center">
        <button onClick={toggleMic} className="p-3 rounded-full bg-gray-700 hover:bg-gray-600">
          {micOn ? <Mic /> : <MicOff />}
        </button>
        <button onClick={toggleCam} className="p-3 rounded-full bg-gray-700 hover:bg-gray-600">
          {camOn ? <Video /> : <VideoOff />}
        </button>
        <button onClick={leaveCall} className="p-3 rounded-full bg-red-600 hover:bg-red-500">
          <PhoneOff />
        </button>
      </div>
    </div>
  );
};

export default VideocallView;
