
var peerConnection = null;
var dataChannel = null;
var iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
];
var statsInterval = null;

export function setIceServers(serverList) {
    iceServers = serverList;
    log('Updated STUN/TURN servers configuration:', iceServers);
}

function _updateUIOutput(data) {
    console.log({ data })
    const textarea = shadowDocument.getElementById('app');
    if (textarea) {
        textarea.value = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    }
}

function _createPeerConnection() {
    console.log('Creating RTCPeerConnection with STUN servers:', iceServers);
    peerConnection = new RTCPeerConnection({ iceServers: iceServers });

    peerConnection.oniceconnectionstatechange = () => {
        const state = peerConnection.iceConnectionState;
        console.log(`ICE Connection State: ${state}`);
        _updateConnectionBadge(state);

        if (state === 'connected' || state === 'completed') {
            _startStatsMonitoring();
        } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
            _stopStatsMonitoring();
        }
    };

    peerConnection.onicecandidateerror = (event) => {
        console.error(`STUN/ICE Candidate Error on ${event.url}:`, event.errorText || event.errorCode);
    };

    peerConnection.ondatachannel = (event) => {
        console.log('Received remote Data Channel');
        dataChannel = event.channel;
        _setupDataChannelEvents();
    };
}

function _updateConnectionBadge(state) {
    const badge = document.getElementById('connStateBadge');
    if (badge) {
        badge.textContent = state.toUpperCase();
        badge.className = `status-badge status-${state}`;
    }
}

function _setupDataChannelEvents() {
    if (!dataChannel) return;

    dataChannel.onopen = () => log('Data Channel OPENED.');
    dataChannel.onclose = () => log('Data Channel CLOSED.');
    dataChannel.onerror = (err) => error('Data Channel Error:', err);
    dataChannel.onmessage = (event) => {
        log('Received message from Remote Peer:', event.data);
        alert(`[Remote Message Received]:\n${event.data}`);
    };
}

function _waitForIceGathering() {
    return new Promise((resolve) => {
        if (peerConnection.iceGatheringState === 'complete') {
            resolve();
        } else {
            const checkState = () => {
                if (peerConnection.iceGatheringState === 'complete') {
                    peerConnection.removeEventListener('icegatheringstatechange', checkState);
                    resolve();
                }
            };
            peerConnection.addEventListener('icegatheringstatechange', checkState);
        }
    });
}

function _startStatsMonitoring() {
    _stopStatsMonitoring();
    statsInterval = setInterval(async () => {
        if (!peerConnection) return;
        const stats = await peerConnection.getStats();
        let selectedPair = null;

        stats.forEach((report) => {
            if (report.type === 'transport') {
                const pair = stats.get(report.selectedCandidatePairId);
                if (pair) selectedPair = pair;
            }
        });

        if (selectedPair) {
            const localCandidate = stats.get(selectedPair.localCandidateId);
            const remoteCandidate = stats.get(selectedPair.remoteCandidateId);
            const statsEl = document.getElementById('connectionStats');
            if (statsEl && localCandidate && remoteCandidate) {
                statsEl.innerHTML = `
            <div><strong>Local:</strong> ${localCandidate.candidateType} (${localCandidate.ip}:${localCandidate.port}/${localCandidate.protocol})</div>
            <div><strong>Remote:</strong> ${remoteCandidate.candidateType} (${remoteCandidate.ip}:${remoteCandidate.port}/${remoteCandidate.protocol})</div>
            <div><strong>Round Trip Time:</strong> ${selectedPair.currentRoundTripTime ? (selectedPair.currentRoundTripTime * 1000).toFixed(1) + ' ms' : 'N/A'}</div>
          `;
            }
        }
    }, 2000);
}

function _stopStatsMonitoring() {
    if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
    }
}

export async function initializeWithOffer() {
    try {
        log('Initializing Peer A with Offer...');
        _createPeerConnection();

        dataChannel = peerConnection.createDataChannel('chat');
        _setupDataChannelEvents();

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        log('Gathering STUN/ICE candidates...');
        await _waitForIceGathering();

        console.log(peerConnection.localDescription);
    } catch (err) {
        error('Failed to create Offer:', err);
    }
}

export async function initializeWithAnswer(offerSDP) {
    try {
        log('Initializing Peer B with Answer...');
        _createPeerConnection();

        await peerConnection.setRemoteDescription(new RTCSessionDescription(offerSDP));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        log('Gathering STUN/ICE candidates...');
        await _waitForIceGathering();

        console.log(peerConnection.localDescription);
    } catch (err) {
        error('Failed to create Answer:', err);
    }
}

export async function setSDP(answerSDP) {
    try {
        log('Setting Remote Answer...');
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answerSDP));
    } catch (err) {
        error('Failed to set Remote SDP:', err);
    }
}

export function sendToRemote(message) {
    try {
        if (!dataChannel || dataChannel.readyState !== 'open') {
            throw new Error('Data Channel is not open.');
        }
        const payload = typeof message === 'string' ? message : JSON.stringify(message);
        dataChannel.send(payload);
        log('Sent message:', payload);
    } catch (err) {
        error('Failed to send message:', err);
    }
}

