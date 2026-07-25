// Server se connect karo
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
let currentRoom = null;

// 1. Webcam Setup
async function initWebcam() {
  try {
    if (!localVideo) {
      console.error("Error: HTML mein 'local-video' ID waala element nahi mila!");
      return;
    }

    localStream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: { ideal: 1280 }, height: { ideal: 720 } }, 
      audio: true 
    });
    
    // Set video source
    localVideo.srcObject = localStream;

    // Browser autoplay policy fix: Stream ko mute karke play karein
    localVideo.muted = true;
    
    // Video play promise handle karein
    await localVideo.play();
    console.log("Webcam feeds active!");

  } catch (err) {
    console.error("Webcam error:", err);
    alert("Camera block hai ya koi aur app use kar raha hai!");
  }
}

// Sirf EK BAAR call karein
initWebcam();

// 2. Start / Find Partner Button Click
startBtn.addEventListener('click', () => {
  startBtn.disabled = true;
  nextBtn.disabled = false;
  socket.emit('find-partner');
});

// 3. Socket Events
socket.on('waiting', (msg) => {
  addMessage(msg, 'system-msg');
});

socket.on('matched', ({ roomId }) => {
  currentRoom = roomId;
  addMessage("Connected with a Stranger! Say hi 👋", 'system-msg');
  msgInput.disabled = false;
  sendBtn.disabled = false;
});

// 4. Send Message Functionality
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