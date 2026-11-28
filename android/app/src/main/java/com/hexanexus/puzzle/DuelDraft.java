package com.hexanexus.puzzle;
import org.java_websocket.drafts.Draft_6455;
import org.java_websocket.protocols.Protocol;
import java.util.Collections;
final class DuelDraft {
    static Draft_6455 create(){return new Draft_6455(Collections.emptyList(),Collections.singletonList(new Protocol("")),8192);}
}
