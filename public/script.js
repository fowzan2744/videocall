console.log('User:', NAME);

const socket = io('/');
const videoGrid = document.getElementById('video-grid');
const nameContainer = document.getElementById('nameesss');

// Initialize PeerJS
const isLocalhost = window.location.hostname === 'localhost';

const myPeer = isLocalhost
  ? new Peer(undefined, {
      host: '/',
      port: '3001',
      path: '/peerjs'
    })
  : new Peer(); // PeerJS Cloud (https://0.peerjs.com)

// Create video element for current user
const myVideo = document.createElement('video');
myVideo.muted = true;

// Store peer connections
const peers = {};

// Control elements
const muteButton = document.getElementById('muteButton');
const pauseButton = document.getElementById('pauseButton');
const screenShareButton = document.getElementById('screenShareButton');

// Control states
let isMuted = false;
let isVideoOff = false;
let isScreenSharing = false;
let myStream = null;
let participantCount = 1;

// Get user media and initialize video call
navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then(stream => {
  myStream = stream;
  addVideoStream(myVideo, stream, NAME + ' (You)');
  
  // Handle incoming calls
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

  // Handle new user connections
  socket.on('user-connected', (userId, userName) => {
    console.log('User connected:', userName, userId);
    connectToNewUser(userId, stream, userName);
    updateParticipantCount(++participantCount);
  });

}).catch(err => {
  console.error('Error accessing media devices:', err);
  showError('Unable to access camera/microphone. Please check your permissions.');
});

// Handle user disconnection
socket.on('user-disconnected', userId => {
  console.log('User disconnected:', userId);
  if (peers[userId]) {
    peers[userId].close();
    updateParticipantCount(--participantCount);
  }
});

// When peer connection is established
myPeer.on('open', id => {
  console.log('My peer ID:', id);
  socket.emit('join-room', ROOM_ID, id, NAME);
});

// Connect to new user
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

// Add video stream to grid
function addVideoStream(video, stream, userName) {
  video.srcObject = stream;
  video.addEventListener('loadedmetadata', () => {
    video.play();
  });

  // Create video container with styling
  const videoContainer = document.createElement('div');
  videoContainer.className = 'video-container relative bg-gray-900 rounded-2xl overflow-hidden shadow-2xl aspect-video';
  
  // Add video element styling
  video.className = 'w-full h-full object-cover';
  
  // Create user label
  const userLabel = document.createElement('div');
  userLabel.className = 'user-label';
  userLabel.textContent = userName;
  
  // Assemble container
  videoContainer.appendChild(video);
  videoContainer.appendChild(userLabel);
  
  videoGrid.appendChild(videoContainer);
}

// Mute/unmute audio
muteButton.addEventListener('click', () => {
  if (myStream) {
    isMuted = !isMuted;
    myStream.getAudioTracks()[0].enabled = !isMuted;
    
    // Update button appearance
    muteButton.className = isMuted 
      ? 'w-12 h-12 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-110 shadow-lg'
      : 'w-12 h-12 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-110 shadow-lg';
    
    // Update icon
    const muteIcon = document.getElementById('mute-icon');
    muteIcon.innerHTML = isMuted 
      ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clip-rule="evenodd"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/>'
      : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>';
  }
});

// Toggle video on/off
pauseButton.addEventListener('click', () => {
  if (myStream) {
    isVideoOff = !isVideoOff;
    myStream.getVideoTracks()[0].enabled = !isVideoOff;
    
    // Update button appearance
    pauseButton.className = isVideoOff 
      ? 'w-12 h-12 bg-gray-600 hover:bg-gray-700 text-white rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-110 shadow-lg'
      : 'w-12 h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-110 shadow-lg';
    
    // Update icon
    const videoIcon = document.getElementById('video-icon');
    videoIcon.innerHTML = isVideoOff 
      ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728"/>'
      : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>';
  }
});

// Screen share functionality
screenShareButton.addEventListener('click', async () => {
  if (!isScreenSharing) {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      // Replace video track in all peer connections
      const videoTrack = screenStream.getVideoTracks()[0];
      
      Object.values(peers).forEach(call => {
        const sender = call.peerConnection.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });
      
      // Update local video
      myVideo.srcObject = screenStream;
      isScreenSharing = true;
      
      // Update button appearance
      screenShareButton.className = 'w-12 h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-110 shadow-lg';
      
      // Handle screen share end
      videoTrack.onended = () => {
        stopScreenShare();
      };
      
    } catch (err) {
      console.error('Error sharing screen:', err);
      showError('Unable to share screen');
    }
  } else {
    stopScreenShare();
  }
});

// Stop screen sharing
function stopScreenShare() {
  if (myStream) {
    const videoTrack = myStream.getVideoTracks()[0];
    
    // Replace screen share track with camera track
    Object.values(peers).forEach(call => {
      const sender = call.peerConnection.getSenders().find(s => 
        s.track && s.track.kind === 'video'
      );
      if (sender) {
        sender.replaceTrack(videoTrack);
      }
    });
    
    // Update local video
    myVideo.srcObject = myStream;
    isScreenSharing = false;
    
    // Reset button appearance
    screenShareButton.className = 'w-12 h-12 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-110 shadow-lg';
  }
}

// Update participant count
function updateParticipantCount(count) {
  participantCount = count;
  const countElement = document.getElementById('participant-count');
  if (countElement) {
    countElement.textContent = count;
  }
}

// Show error message
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'fixed top-6 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  
  setTimeout(() => {
    errorDiv.remove();
  }, 5000);
}

// Handle connection errors
myPeer.on('error', (err) => {
  console.error('Peer connection error:', err);
  showError('Connection error occurred');
});

// Handle page unload
window.addEventListener('beforeunload', () => {
  if (myStream) {
    myStream.getTracks().forEach(track => track.stop());
  }
  myPeer.destroy();
});

// Auto-hide loading overlay
setTimeout(() => {
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
}, 3000);