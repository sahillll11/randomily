const socket = io(window.location.origin);

// DOM Elements
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const startBtn = document.getElementById('start-btn');
const nextBtn = document.getElementById('next-btn');
const chatForm = document.getElementById('chat-form');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');

let localStream = null;
let peerConnection = null;
let currentRoom = null;

// STUN Server (Internet par devices ko aapas me connect karne ke liye compulsory hai)
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// 1. Local Camera Setup
async function initWebcam() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    localVideo.muted = true;
    await localVideo.play();
  } catch (err) {
    console.error("Camera error:", err);
  }
}
initWebcam();

// 2. WebRTC Peer Connection Setup
function createPeerConnection() {
  peerConnection = new RTCPeerConnection(rtcConfig);

  // Local tracks (Camera + Mic) ko connection me add karo
  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }

  // Remote Stream Receive hone par Stranger Video Element me daalo
  peerConnection.ontrack = (event) => {
    if (remoteVideo) {
      remoteVideo.srcObject = event.streams[0];
    }
  };

  // ICE Candidates exchange karna (Network path dhoondhne ke liye)
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && currentRoom) {
      socket.emit('signal', {
        roomId: currentRoom,
        signalData: { candidate: event.candidate }
      });
    }
  };
}

// 3. Matching & WebRTC Handshake
startBtn.addEventListener('click', () => {
  startBtn.disabled = true;
  nextBtn.disabled = false;
  socket.emit('find-partner');
});

socket.on('matched', async ({ roomId, isInitiator }) => {
  currentRoom = roomId;
  addMessage("Connected with a Stranger! Say hi 👋", 'system-msg');
  msgInput.disabled = false;
  sendBtn.disabled = false;

  createPeerConnection();

  // Agar aap initiator ho, toh WebRTC Offer bhejo
  if (isInitiator) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('signal', { roomId, signalData: { offer } });
  }
});

// 4. Signaling Data Process karna (Offer / Answer / Candidate)
socket.on('signal', async (signalData) => {
  if (!peerConnection) return;

  if (signalData.offer) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(signalData.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('signal', { roomId: currentRoom, signalData: { answer } });
  } else if (signalData.answer) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(signalData.answer));
  } else if (signalData.candidate) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(signalData.candidate));
  }
});

// 5. Chat Messaging
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = msgInput.value.trim();
  if (text && currentRoom) {
    addMessage(`You: ${text}`, 'my-msg');
    socket.emit('send-message', { roomId: currentRoom, message: text });
    msgInput.value = '';
  }
});

socket.on('receive-message', (text) => {
  addMessage(`Stranger: ${text}`, 'stranger-msg');
});

function addMessage(text, className) {
  const p = document.createElement('p');
  p.className = className;
  p.innerText = text;
  chatMessages.appendChild(p);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}