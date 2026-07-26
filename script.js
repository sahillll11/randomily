let localStream;
let peerConnection;
let socket = io();

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const nextBtn = document.getElementById('nextBtn');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');

const rtcConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// 1. Camera Access
async function startCamera() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
  } catch (err) {
    console.error("Camera access error:", err);
    alert("Camera & Mic permission required!");
  }
}

// 2. Skip Button Handler (Fixed)
if (nextBtn) {
  nextBtn.addEventListener('click', handleSkip);
}

function handleSkip() {
  // Anti-spam lock
  nextBtn.disabled = true;
  nextBtn.style.opacity = '0.5';

  closePeerConnection();

  if (remoteVideo) remoteVideo.srcObject = null;

  // Signal server for next user
  socket.emit('skip_and_find_next');

  setTimeout(() => {
    nextBtn.disabled = false;
    nextBtn.style.opacity = '1';
  }, 1200);
}

function closePeerConnection() {
  if (peerConnection) {
    peerConnection.onicecandidate = null;
    peerConnection.ontrack = null;
    peerConnection.close();
    peerConnection = null;
  }
}

// Controls logic
startBtn.addEventListener('click', () => {
  if (!localStream) startCamera();
  handleSkip();
});

stopBtn.addEventListener('click', () => {
  closePeerConnection();
  if (remoteVideo) remoteVideo.srcObject = null;
});

// Socket Signaling Events
socket.on('partner_left', () => {
  closePeerConnection();
  if (remoteVideo) remoteVideo.srcObject = null;
  socket.emit('skip_and_find_next');
});

socket.on('match_found', async ({ roomId, isInitiator }) => {
  closePeerConnection();
  peerConnection = new RTCPeerConnection(rtcConfig);

  if (localStream) {
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  }

  peerConnection.ontrack = (event) => {
    if (remoteVideo && event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
    }
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice_candidate', { roomId, candidate: event.candidate });
    }
  };

  if (isInitiator) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('send_offer', { roomId, offer });
  }
});

socket.on('receive_offer', async ({ offer, roomId }) => {
  if (!peerConnection) return;
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('send_answer', { roomId, answer });
});

socket.on('receive_answer', async ({ answer }) => {
  if (peerConnection) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }
});

socket.on('receive_candidate', async ({ candidate }) => {
  if (peerConnection && candidate) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }
});

startCamera();