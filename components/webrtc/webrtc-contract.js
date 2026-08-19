
var rtcConnection = null;

function init() {
    console.log('initializing RTCPeerConnection...');
    var rtcConnection = new RTCPeerConnection({ iceServers: [] });
    rtcConnection.onicecandidate = function rtcIceCandidate(event) {
        console.log(JSON.stringify(rtcConnection.localDescription));
    }
    return rtcConnection;
}

function getInstance() {
    if (!rtcConnection) {
        rtcConnection = init();
    }
    return rtcConnection;
}

function messageReceived(event) {
    console.log(`Message received: ${event.data}`);
};

function dataChannelClosed(event) {
    console.log("Closing rtcConnection...")
    rtcConnection.close();
}

export function initializeWithOffer() {
    const instance = getInstance();
    const dataChannel = instance.createDataChannel("rtcChannel");
    dataChannel.onopen = function dataChannelOpened(event) {
        console.log("Data channel opened.");
    }
    dataChannel.onmessage = messageReceived;
    dataChannel.onclose = dataChannelClosed;
    instance.dataChannel = dataChannel;
    instance.createOffer()
        .then((offer) => instance.setLocalDescription(offer))
        .then((e) => console.log("Offer created."));
}

export function initializeWithAnswer(sdp) {
    const instance = getInstance();
    instance.ondatachannel = function dataChannelOffered(event) {
        instance.dataChannel = event.channel;
        instance.dataChannel.onopen = function dataChannelOpened(event) {
            console.log("Remote connection opened.");
        }
        instance.dataChannel.onmessage = messageReceived;
        instance.dataChannel.onclose = dataChannelClosed;
    }
    console.log("initializin answer...", sdp)
    setSDP(sdp);
}

export function setSDP(sdp) {
    const instance = getInstance();
    // const sdp = JSON.parse($("#app").value);
    switch (sdp.type) {
        case "offer":
            instance.setRemoteDescription(sdp)
                .then((a) => console.log("Offer set."));
            instance.createAnswer()
                .then((answer) => instance.setLocalDescription(answer))
                .then((answer) => console.log("Answer created."));
            break;
        case "answer":
            instance.setRemoteDescription(sdp)
                .then((answer) => console.log("Answer set."));
            break;
        default:
            console.log("Unhandled message: ", sdp);
    }
}

export function sendToRemote(json) {
    const instance = getInstance();
    console.log("sending to remote")
    try {
        // const json = JSON.parse($("#app").value);
        // TODO: further verification
        instance.dataChannel.send(JSON.stringify(json));
    } catch (e) {
        console.error(e)
    }
}

export function close() {
    const instance = getInstance();
    instance.dataChannel.close();
}
