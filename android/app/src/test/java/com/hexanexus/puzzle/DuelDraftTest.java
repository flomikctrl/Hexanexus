package com.hexanexus.puzzle;
import org.junit.Test;
import static org.junit.Assert.*;
import org.java_websocket.handshake.HandshakeImpl1Client;
import org.java_websocket.enums.HandshakeState;
public class DuelDraftTest {
    @Test public void ordinaryWebSocketHandshakeAccepted() throws Exception {
        HandshakeImpl1Client request=new HandshakeImpl1Client();
        request.setResourceDescriptor("/duels");request.put("Upgrade","websocket");request.put("Connection","Upgrade");request.put("Sec-WebSocket-Version","13");request.put("Sec-WebSocket-Key","dGhlIHNhbXBsZSBub25jZQ==");
        assertEquals(HandshakeState.MATCHED,DuelDraft.create().acceptHandshakeAsServer(request));
    }
    @Test public void unsupportedVersionRejected() throws Exception {
        HandshakeImpl1Client request=new HandshakeImpl1Client();request.put("Sec-WebSocket-Version","8");
        assertEquals(HandshakeState.NOT_MATCHED,DuelDraft.create().acceptHandshakeAsServer(request));
        assertEquals(8192,DuelDraft.create().getMaxFrameSize());
    }
}
