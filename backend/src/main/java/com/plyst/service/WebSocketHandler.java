package com.plyst.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@SuppressWarnings("null")
public class WebSocketHandler extends TextWebSocketHandler {
    
    private final Map<Long, WebSocketSession> userSessions = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;
    
    public WebSocketHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }
    
    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String query = session.getUri().getQuery();
        Long userId = parseUserId(query);
        
        if (userId != null) {
            WebSocketSession existingSession = userSessions.get(userId);
            if (existingSession != null && existingSession.isOpen()) {
                try {
                    existingSession.close(CloseStatus.GOING_AWAY);
                } catch (IOException e) {
                    log.debug("기존 세션 닫기 실패 - userId: {}", userId);
                }
            }
            
            userSessions.put(userId, session);
            log.info("WebSocket 연결됨 - userId: {}, sessionId: {}", userId, session.getId());
            
            if (session.isOpen()) {
                sendToSession(session, Map.of("type", "connected", "message", "WebSocket 연결됨"));
            }
        } else {
            log.warn("userId 없이 WebSocket 연결 시도 - sessionId: {}", session.getId());
            if (session.isOpen()) {
                session.close(CloseStatus.BAD_DATA);
            }
        }
    }
    
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        userSessions.entrySet().removeIf(entry -> 
            entry.getValue().getId().equals(session.getId()));
        log.info("WebSocket 연결 종료 - sessionId: {}, status: {}", session.getId(), status);
    }
    
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        if ("ping".equals(payload)) {
            sendToSession(session, Map.of("type", "pong"));
        }
        log.debug("메시지 수신: {}", payload);
    }
    
    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        if (exception instanceof IOException) {
            log.debug("WebSocket 연결 끊김 - sessionId: {}", session.getId());
        } else {
            log.error("WebSocket 에러 - sessionId: {}", session.getId(), exception);
        }
        userSessions.entrySet().removeIf(entry -> 
            entry.getValue().getId().equals(session.getId()));
    }
    
    public void sendNotificationToUser(Long userId, Object notification) {
        WebSocketSession session = userSessions.get(userId);
        if (session != null && session.isOpen()) {
            sendToSession(session, notification);
        }
    }
    
    public void broadcastNotification(Object notification) {
        userSessions.values().forEach(session -> {
            if (session.isOpen()) {
                sendToSession(session, notification);
            }
        });
    }
    
    public void broadcastExcept(Long excludeUserId, Object notification) {
        userSessions.forEach((userId, session) -> {
            if (!userId.equals(excludeUserId) && session.isOpen()) {
                sendToSession(session, notification);
            }
        });
    }
    
    private synchronized void sendToSession(WebSocketSession session, Object data) {
        if (session == null || !session.isOpen()) {
            return;
        }
        try {
            String json = objectMapper.writeValueAsString(data);
            session.sendMessage(new TextMessage(json));
        } catch (IOException e) {
            log.debug("메시지 전송 실패 (연결 끊김) - sessionId: {}", session.getId());
        } catch (Exception e) {
            log.error("메시지 전송 실패 - sessionId: {}", session.getId(), e);
        }
    }
    
    private Long parseUserId(String query) {
        if (query == null) return null;
        
        for (String param : query.split("&")) {
            String[] keyValue = param.split("=");
            if (keyValue.length == 2 && "userId".equals(keyValue[0])) {
                try {
                    return Long.parseLong(keyValue[1]);
                } catch (NumberFormatException e) {
                    return null;
                }
            }
        }
        return null;
    }
    
    public int getConnectedUserCount() {
        return userSessions.size();
    }
    
    public boolean isUserConnected(Long userId) {
        WebSocketSession session = userSessions.get(userId);
        return session != null && session.isOpen();
    }
}
