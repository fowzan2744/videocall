console.log('User:', NAME);

const socket = io('/');
const videoGrid = document.getElementById('video-grid');

// Initialize PeerJS (localhost vs cloud fallback)
const isLocalhost = window.location.hostname === 'localhost';
const myPeer = isLocalhost
  ? new Peer(undefined, { host: '/', port: '3001', path: '/peerjs' })
  : new Peer(); // Uses PeerJS cloud (0.peerjs.com)

const myVideo = document.createElement('video');
myVideo.muted = true;

const peers = {};
let myStream = null;
let isMuted = false;
let isVideoOff = false;
let isScreenSharing = false;
let participantCount = 1;

// Buttons
const muteButton = document.getElementById('muteButton');
const pauseButton = document.getElementById('pauseButton');
const screenShareButton = document.getElementById('screenShareButton');

// === Get User Media and Start Connection ===
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    myStream = stream;
    addVideoStream(myVideo, stream, `${NAME} (You)`);

    // Answer incoming call
    myPeer.on('call', call => {
      call.answer(stream);
      const video = document.createElement('video');
      call.on('stream', userVideoStream => {
        addVideoStream(video, userVideoStream, 'Participant');
      });
      call.on('close', () => {
        video.parentElement.remove();
        updateParticipantCount(--participantCount);
      });
    });

    // New user joined
    socket.on('user-connected', (userId, userName) => {
      console.log('User connected:', userName);
      connectToNewUser(userId, stream, userName);
      updateParticipantCount(++participantCount);
    });
  })
  .catch(err => {
    console.error('Media access error:', err);
    showError('Cannot access camera/microphone.');
  });

// === Socket Events ===
socket.on('user-disconnected', userId => {
  if (peers[userId]) {
    peers[userId].close();
    updateParticipantCount(--participantCount);
  }
});

myPeer.on('open', id => {
  console.log('My peer ID:', id);
  socket.emit('join-room', ROOM_ID, id, NAME);
});

myPeer.on('error', err => {
  console.error('Peer error:', err);
  showError('Connection error occurred.');
});

// === Utility Functions ===
function connectToNewUser(userId, stream, userName) {
  const call = myPeer.call(userId, stream);
  const video = document.createElement('video');
  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream, userName);
  });
  call.on('close', () => {
    video.parentElement.remove();
  });
  peers[userId] = call;
}

function addVideoStream(video, stream, userName) {
  video.srcObject = stream;
  video.addEventListener('loadedmetadata', () => video.play());

  const container = document.createElement('div');
  container.className = 'video-container relative bg-gray-900 rounded-2xl overflow-hidden shadow-2xl aspect-video';

  const label = document.createElement('div');
  label.className = 'user-label';
  label.textContent = userName;

  video.className = 'w-full h-full object-cover';
  container.appendChild(video);
  container.appendChild(label);
  videoGrid.appendChild(container);
}

// === Button Handlers ===
muteButton.addEventListener('click', () => {
  if (myStream) {
    isMuted = !isMuted;
    myStream.getAudioTracks()[0].enabled = !isMuted;
    toggleButtonClass(muteButton, isMuted, 'red');
    document.getElementById('mute-icon').innerHTML = isMuted
      ? `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/>`
      : `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />`;
  }
});

pauseButton.addEventListener('click', () => {
  if (myStream) {
    isVideoOff = !isVideoOff;
    myStream.getVideoTracks()[0].enabled = !isVideoOff;
    toggleButtonClass(pauseButton, isVideoOff, 'gray', 'blue');
    document.getElementById('video-icon').innerHTML = isVideoOff
      ? `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636M5.636 18.364l12.728-12.728" />`
      : `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />`;
  }
});

screenShareButton.addEventListener('click', async () => {
  if (!isScreenSharing) {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      replaceVideoTrack(screenStream.getVideoTracks()[0]);
      myVideo.srcObject = screenStream;
      isScreenSharing = true;
      toggleButtonClass(screenShareButton, true, 'orange');

      screenStream.getVideoTracks()[0].onended = () => stopScreenShare();
    } catch (e) {
      console.error('Screen share error:', e);
      showError('Screen sharing not allowed.');
    }
  } else {
    stopScreenShare();
  }
});

function stopScreenShare() {
  if (myStream) {
    replaceVideoTrack(myStream.getVideoTracks()[0]);
    myVideo.srcObject = myStream;
    isScreenSharing = false;
    toggleButtonClass(screenShareButton, false, 'green');
  }
}

function replaceVideoTrack(newTrack) {
  Object.values(peers).forEach(call => {
    const sender = call.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
    if (sender) sender.replaceTrack(newTrack);
  });
}

function toggleButtonClass(button, isActive, activeColor, defaultColor = activeColor) {
  button.className = `w-12 h-12 bg-${isActive ? activeColor + '-600' : defaultColor + '-500'} hover:bg-${isActive ? activeColor + '-700' : defaultColor + '-600'} text-white rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-110 shadow-lg`;
}

function updateParticipantCount(count) {
  participantCount = count;
  const el = document.getElementById('participant-count');
  if (el) el.textContent = count;
}

function showError(message) {
  const div = document.createElement('div');
  div.className = 'fixed top-6 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 4000);
}

// === Cleanup on leave ===
window.addEventListener('beforeunload', () => {
  if (myStream) myStream.getTracks().forEach(track => track.stop());
  myPeer.destroy();
});

// === Loading overlay hide ===
setTimeout(() => {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.style.display = 'none';
}, 2500);
// === Socket.io Connection ===