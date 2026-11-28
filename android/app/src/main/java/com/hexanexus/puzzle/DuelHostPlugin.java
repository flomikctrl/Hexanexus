package com.hexanexus.puzzle;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;
import java.net.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.nio.ByteBuffer;

/** Native transport only. All room/solution logic stays in the shared TS engine. */
@CapacitorPlugin(name="DuelHost")
public class DuelHostPlugin extends Plugin {
    private WebSocketServer server;
    private final Map<String,WebSocket> peers=new ConcurrentHashMap<>();
    private NsdManager.RegistrationListener registration;
    private NsdManager.DiscoveryListener discovery;
    private PluginCall search;
    private final android.os.Handler handler=new android.os.Handler(android.os.Looper.getMainLooper());
    private NsdManager nsd(){return (NsdManager)getContext().getSystemService(Context.NSD_SERVICE);}
    private static boolean local(String ip){return ip!=null&&(ip.startsWith("192.168.")||ip.startsWith("10.")||ip.matches("172\\.(1[6-9]|2[0-9]|3[01])\\..*"));}
    private String address() throws Exception {
        for(NetworkInterface n:Collections.list(NetworkInterface.getNetworkInterfaces()))if(n.getName().startsWith("wlan"))for(InetAddress a:Collections.list(n.getInetAddresses()))if(a instanceof Inet4Address&&local(a.getHostAddress()))return a.getHostAddress();
        throw new Exception("Подключите телефон к Wi-Fi");
    }
    private void event(String type,String id,String raw){JSObject o=new JSObject();o.put("type",type);o.put("id",id);o.put("raw",raw);notifyListeners("transport",o);}
    @PluginMethod public void start(PluginCall call){
        if(server!=null){call.reject("Хост уже запущен");return;}
        try{String ip=address();
            server=new WebSocketServer(new InetSocketAddress(ip,0),1,Collections.singletonList(DuelDraft.create())){
                public void onOpen(WebSocket s,ClientHandshake h){if(!"/duels".equals(h.getResourceDescriptor())||!local(s.getRemoteSocketAddress().getAddress().getHostAddress())||peers.size()>=4){s.close(1008);return;}String origin=h.getFieldValue("Origin");if(!origin.isEmpty()&&!origin.equals("https://localhost")&&!origin.matches("http://(192\\.168\\..*|10\\..*|172\\..*|127\\.0\\.0\\.1.*)")){s.close(1008);return;}String id=UUID.randomUUID().toString();s.setAttachment(id);peers.put(id,s);}
                public void onMessage(WebSocket s,String raw){String id=s.getAttachment();if(id==null)return;long[] rate=rates.computeIfAbsent(id,k->new long[]{System.currentTimeMillis(),0});if(System.currentTimeMillis()-rate[0]>1000){rate[0]=System.currentTimeMillis();rate[1]=0;}if(raw.length()>8192||++rate[1]>40){s.close(1008);return;}event("message",id,raw);}
                public void onMessage(WebSocket s,ByteBuffer b){s.close(1003);}
                private final Map<String,long[]> rates=new ConcurrentHashMap<>();
                public void onClose(WebSocket s,int code,String reason,boolean remote){String id=s.getAttachment();if(id!=null){peers.remove(id);rates.remove(id);event("disconnect",id,"");}}
                public void onError(WebSocket s,Exception ex){if(s==null){server=null;call.reject("Не удалось запустить хост: "+ex.getMessage());}}
                public void onStart(){setConnectionLostTimeout(5);JSObject result=new JSObject();result.put("address",ip+":"+getPort());call.resolve(result);}
            };server.setReuseAddr(true);server.start();
        }catch(Exception e){server=null;call.reject(e.getMessage());}
    }
    @PluginMethod public void send(PluginCall call){WebSocket s=peers.get(call.getString("id",""));String raw=call.getString("raw","");if(s!=null&&s.isOpen()&&raw.length()<=32768)s.send(raw);call.resolve();}
    @PluginMethod public void closePeer(PluginCall call){WebSocket s=peers.get(call.getString("id",""));if(s!=null)s.close();call.resolve();}
    @PluginMethod public void advertise(PluginCall call){
        if(server==null||!call.getString("code","").matches("[0-9]{4}")){call.reject("Нет комнаты");return;}
        if(registration!=null){call.resolve();return;}
        NsdServiceInfo info=new NsdServiceInfo();info.setServiceName("Hexanexus-"+call.getString("code"));info.setServiceType("_hexanexus._tcp.");info.setPort(server.getPort());
        registration=new NsdManager.RegistrationListener(){public void onServiceRegistered(NsdServiceInfo i){}public void onRegistrationFailed(NsdServiceInfo i,int c){}public void onServiceUnregistered(NsdServiceInfo i){}public void onUnregistrationFailed(NsdServiceInfo i,int c){}};
        nsd().registerService(info,NsdManager.PROTOCOL_DNS_SD,registration);call.resolve();
    }
    private void endSearch(){if(discovery!=null)try{nsd().stopServiceDiscovery(discovery);}catch(Exception ignored){}discovery=null;}
    @PluginMethod public void discover(PluginCall call){
        if(search!=null){call.reject("Поиск уже идёт");return;}String code=call.getString("code","");if(!code.matches("[0-9]{4}")){call.reject("Введите код комнаты");return;}search=call;
        discovery=new NsdManager.DiscoveryListener(){
            private boolean resolving=false;
            public void onDiscoveryStarted(String t){}public void onDiscoveryStopped(String t){}
            public void onStartDiscoveryFailed(String t,int c){finishSearch(null);}
            public void onStopDiscoveryFailed(String t,int c){}
            public void onServiceLost(NsdServiceInfo i){}
            public void onServiceFound(NsdServiceInfo i){if(!resolving&&i.getServiceName().equals("Hexanexus-"+code)){resolving=true;nsd().resolveService(i,new NsdManager.ResolveListener(){public void onResolveFailed(NsdServiceInfo s,int e){resolving=false;}public void onServiceResolved(NsdServiceInfo s){String ip=s.getHost().getHostAddress();if(local(ip))finishSearch(ip+":"+s.getPort());}});}}
        };nsd().discoverServices("_hexanexus._tcp.",NsdManager.PROTOCOL_DNS_SD,discovery);handler.postDelayed(()->{if(search==call)finishSearch(null);},10000);
    }
    private synchronized void finishSearch(String address){PluginCall call=search;if(call==null)return;search=null;endSearch();if(address==null)call.reject("Комната не найдена. Проверьте Wi-Fi или укажите адрес в настройках подключения.");else{JSObject o=new JSObject();o.put("address",address);call.resolve(o);}}
    private void shutdown(){finishSearch(null);if(registration!=null){try{nsd().unregisterService(registration);}catch(Exception ignored){}registration=null;}WebSocketServer previous=server;server=null;if(previous!=null){for(WebSocket s:peers.values())s.close(1001,"Host stopped");peers.clear();new Thread(()->{try{previous.stop(1000);}catch(Exception ignored){}},"duel-host-stop").start();event("stopped","","");}}
    @PluginMethod public void stop(PluginCall call){shutdown();call.resolve();}
    @Override protected void handleOnStop(){shutdown();}
    @Override protected void handleOnDestroy(){shutdown();}
}
