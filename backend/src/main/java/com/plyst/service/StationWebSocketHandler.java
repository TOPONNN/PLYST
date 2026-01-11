package com.plyst.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.plyst.dto.StationDto.*;
import com.plyst.dto.SubtitleDto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
@SuppressWarnings("null")
public class StationWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper;
    private final StationService stationService;
    private final SubtitleService subtitleService;

    private final Map<Integer, Set<WebSocketSession>> stationSessions = new ConcurrentHashMap<>();
    private final Map<String, SessionInfo> sessionInfoMap = new ConcurrentHashMap<>();
    private final Map<Integer, String> stationVideoIds = new ConcurrentHashMap<>();
    private final Map<Integer, JsonNode> stationQueues = new ConcurrentHashMap<>();
    private final Map<Integer, Integer> stationVolumes = new ConcurrentHashMap<>();

    private static class SessionInfo {
        Integer stationId;
        Integer userId;
        String nickname;

        SessionInfo(Integer stationId, Integer userId, String nickname) {
            this.stationId = stationId;
            this.userId = userId;
            this.nickname = nickname;
        }
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String query = session.getUri().getQuery();
        Integer stationId = parseIntParam(query, "stationId");
        Integer userId = parseIntParam(query, "userId");

        if (stationId == null || userId == null) {
            log.warn("Station WebSocket connection without stationId or userId - sessionId: {}", session.getId());
            if (session.isOpen()) {
                session.close(CloseStatus.BAD_DATA);
            }
            return;
        }

        stationSessions.computeIfAbsent(stationId, k -> ConcurrentHashMap.newKeySet()).add(session);
        
        List<ParticipantInfo> participants = stationService.getParticipants(stationId);
        String nickname = participants.stream()
                .filter(p -> p.getId().equals(userId))
                .findFirst()
                .map(ParticipantInfo::getNickname)
                .orElse("Unknown");
        
        sessionInfoMap.put(session.getId(), new SessionInfo(stationId, userId, nickname));

        log.info("Station WebSocket connected - stationId: {}, userId: {}, sessionId: {}", stationId, userId, session.getId());

        stationService.updateParticipantActivity(stationId, userId);

        StationDetailResponse stationDetail = stationService.getStationDetail(stationId);
        String videoId = stationVideoIds.get(stationId);
        JsonNode queue = stationQueues.get(stationId);
        Integer volume = stationVolumes.get(stationId);
        
        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "station_detail");
        response.set("station", objectMapper.valueToTree(stationDetail));
        if (videoId != null) {
            response.put("videoId", videoId);
        }
        if (queue != null) {
            response.set("queue", queue);
        }
        if (volume != null) {
            response.put("volume", volume);
        }
        response.put("serverTime", System.currentTimeMillis());
        
        if (videoId != null && subtitleService.isSubtitleEnabled(stationId)) {
            response.put("subtitleEnabled", true);
            SubtitleResponse subtitleStatus = subtitleService.getSubtitleStatus(videoId);
            if (subtitleStatus.isAvailable()) {
                response.set("subtitleSegments", objectMapper.valueToTree(subtitleStatus.getSegments()));
                response.put("subtitleLanguage", subtitleStatus.getOriginalLanguage());
            }
        }
        
        sendToSession(session, response);

        broadcastParticipantsUpdate(stationId, "join", userId);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        SessionInfo info = sessionInfoMap.remove(session.getId());
        if (info != null) {
            Set<WebSocketSession> sessions = stationSessions.get(info.stationId);
            if (sessions != null) {
                sessions.remove(session);
                if (sessions.isEmpty()) {
                    stationSessions.remove(info.stationId);
                    stationVideoIds.remove(info.stationId);
                }
            }
            log.info("Station WebSocket disconnected - stationId: {}, userId: {}, sessionId: {}", 
                    info.stationId, info.userId, session.getId());

            broadcastParticipantsUpdate(info.stationId, "leave", info.userId);
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        SessionInfo info = sessionInfoMap.get(session.getId());

        if (info == null) {
            return;
        }

        if ("ping".equals(payload)) {
            sendToSession(session, Map.of("type", "pong"));
            return;
        }

        try {
            JsonNode json = objectMapper.readTree(payload);
            String type = json.has("type") ? json.get("type").asText() : null;

            if (type == null) {
                return;
            }

            switch (type) {
                case "playback_update" -> handlePlaybackUpdate(info, json);
                case "chat" -> handleChat(info, json);
                case "sync_request" -> handleSyncRequest(info, session);
                case "volume_update" -> handleVolumeUpdate(info, json);
                case "queue_update" -> handleQueueUpdate(info, json);
                case "queue_add" -> handleQueueAdd(info, json);
                case "subtitle_enable" -> handleSubtitleEnable(info, json);
                case "subtitle_disable" -> handleSubtitleDisable(info);
                case "subtitle_status" -> handleSubtitleStatus(info, json, session);
                default -> log.debug("Unknown message type: {}", type);
            }
        } catch (JsonProcessingException e) {
            log.error("Failed to parse WebSocket message: {}", payload, e);
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        if (exception instanceof IOException) {
            log.debug("Station WebSocket connection lost - sessionId: {}", session.getId());
        } else {
            log.error("Station WebSocket error - sessionId: {}", session.getId(), exception);
        }

        SessionInfo info = sessionInfoMap.remove(session.getId());
        if (info != null) {
            Set<WebSocketSession> sessions = stationSessions.get(info.stationId);
            if (sessions != null) {
                sessions.remove(session);
            }
        }
    }

    private void handlePlaybackUpdate(SessionInfo info, JsonNode json) {
        if (!stationService.isHost(info.stationId, info.userId)) {
            log.warn("Non-host tried to update playback - stationId: {}, userId: {}", info.stationId, info.userId);
            return;
        }

        try {
            JsonNode payloadNode = json.get("payload");
            if (payloadNode == null) {
                return;
            }

            PlaybackUpdateMessage playbackUpdate = objectMapper.treeToValue(payloadNode, PlaybackUpdateMessage.class);
            stationService.updatePlayback(info.stationId, playbackUpdate);

            String videoId = json.has("videoId") ? json.get("videoId").asText() : null;
            String previousVideoId = stationVideoIds.get(info.stationId);
            if (videoId != null) {
                stationVideoIds.put(info.stationId, videoId);
                
                if (!videoId.equals(previousVideoId)) {
                    subtitleService.enableSubtitles(info.stationId, videoId, (subtitleResponse) -> {
                        ObjectNode subtitleReadyResponse = objectMapper.createObjectNode();
                        subtitleReadyResponse.put("type", "subtitle_ready");
                        subtitleReadyResponse.put("videoId", subtitleResponse.getVideoId());
                        subtitleReadyResponse.put("available", subtitleResponse.isAvailable());
                        subtitleReadyResponse.put("processing", subtitleResponse.isProcessing());
                        subtitleReadyResponse.put("originalLanguage", subtitleResponse.getOriginalLanguage());
                        subtitleReadyResponse.set("segments", objectMapper.valueToTree(subtitleResponse.getSegments()));
                        broadcastToStation(info.stationId, subtitleReadyResponse);
                    });
                    
                    ObjectNode enabledResponse = objectMapper.createObjectNode();
                    enabledResponse.put("type", "subtitle_enabled");
                    enabledResponse.put("videoId", videoId);
                    broadcastToStation(info.stationId, enabledResponse);
                    
                    log.info("새 영상 자막 자동 활성화: stationId={}, videoId={}", info.stationId, videoId);
                }
            }

            ObjectNode response = objectMapper.createObjectNode();
            response.put("type", "playback_update");
            response.set("payload", payloadNode);
            if (videoId != null) {
                response.put("videoId", videoId);
            }
            response.put("serverTime", System.currentTimeMillis());
            response.put("senderId", info.userId);

            broadcastToStation(info.stationId, response);

        } catch (Exception e) {
            log.error("Failed to process playback update", e);
        }
    }

    private void handleChat(SessionInfo info, JsonNode json) {
        try {
            String messageText = json.has("message") ? json.get("message").asText() : null;
            if (messageText == null || messageText.isBlank()) {
                return;
            }

            List<ParticipantInfo> participants = stationService.getParticipants(info.stationId);
            ParticipantInfo sender = participants.stream()
                    .filter(p -> p.getId().equals(info.userId))
                    .findFirst()
                    .orElse(null);

            ObjectNode userNode = objectMapper.createObjectNode();
            userNode.put("id", info.userId);
            userNode.put("nickname", sender != null ? sender.getNickname() : info.nickname);
            if (sender != null && sender.getAvatar() != null) {
                userNode.put("avatar", sender.getAvatar());
            }

            ObjectNode response = objectMapper.createObjectNode();
            response.put("type", "chat");
            response.set("user", userNode);
            response.put("message", messageText);
            response.put("sentAt", LocalDateTime.now().toString());

            broadcastToStation(info.stationId, response);

        } catch (Exception e) {
            log.error("Failed to process chat message", e);
        }
    }

    private void handleSyncRequest(SessionInfo info, WebSocketSession session) {
        try {
            StationDetailResponse stationDetail = stationService.getStationDetail(info.stationId);
            String videoId = stationVideoIds.get(info.stationId);
            
            ObjectNode response = objectMapper.createObjectNode();
            response.put("type", "station_detail");
            response.set("station", objectMapper.valueToTree(stationDetail));
            if (videoId != null) {
                response.put("videoId", videoId);
            }
            response.put("serverTime", System.currentTimeMillis());
            
            sendToSession(session, response);
        } catch (Exception e) {
            log.error("Failed to process sync request", e);
        }
    }

    private void handleVolumeUpdate(SessionInfo info, JsonNode json) {
        if (!stationService.isHost(info.stationId, info.userId)) {
            return;
        }
        try {
            int volume = json.has("volume") ? json.get("volume").asInt() : 100;
            stationVolumes.put(info.stationId, volume);
            
            ObjectNode response = objectMapper.createObjectNode();
            response.put("type", "volume_update");
            response.put("volume", volume);
            
            broadcastToStation(info.stationId, response);
        } catch (Exception e) {
            log.error("Failed to process volume update", e);
        }
    }

    private void handleQueueUpdate(SessionInfo info, JsonNode json) {
        if (!stationService.isHost(info.stationId, info.userId)) {
            return;
        }
        try {
            JsonNode queueNode = json.get("queue");
            stationQueues.put(info.stationId, queueNode);
            
            ObjectNode response = objectMapper.createObjectNode();
            response.put("type", "queue_update");
            response.set("queue", queueNode);
            
            broadcastToStation(info.stationId, response);
        } catch (Exception e) {
            log.error("Failed to process queue update", e);
        }
    }

    private void handleQueueAdd(SessionInfo info, JsonNode json) {
        try {
            JsonNode itemNode = json.get("item");
            
            JsonNode currentQueue = stationQueues.get(info.stationId);
            com.fasterxml.jackson.databind.node.ArrayNode newQueue;
            if (currentQueue != null && currentQueue.isArray()) {
                newQueue = (com.fasterxml.jackson.databind.node.ArrayNode) currentQueue.deepCopy();
            } else {
                newQueue = objectMapper.createArrayNode();
            }
            newQueue.add(itemNode);
            stationQueues.put(info.stationId, newQueue);
            
            ObjectNode response = objectMapper.createObjectNode();
            response.put("type", "queue_add");
            response.set("item", itemNode);
            
            broadcastToStation(info.stationId, response);
        } catch (Exception e) {
            log.error("Failed to process queue add", e);
        }
    }

    private void handleSubtitleEnable(SessionInfo info, JsonNode json) {
        if (!stationService.isHost(info.stationId, info.userId)) {
            return;
        }
        try {
            String videoId = json.has("videoId") ? json.get("videoId").asText() : stationVideoIds.get(info.stationId);
            if (videoId == null) {
                return;
            }
            
            subtitleService.enableSubtitles(info.stationId, videoId, (subtitleResponse) -> {
                ObjectNode response = objectMapper.createObjectNode();
                response.put("type", "subtitle_ready");
                response.put("videoId", subtitleResponse.getVideoId());
                response.put("available", subtitleResponse.isAvailable());
                response.put("processing", subtitleResponse.isProcessing());
                response.put("originalLanguage", subtitleResponse.getOriginalLanguage());
                response.set("segments", objectMapper.valueToTree(subtitleResponse.getSegments()));
                broadcastToStation(info.stationId, response);
            });
            
            ObjectNode enabledResponse = objectMapper.createObjectNode();
            enabledResponse.put("type", "subtitle_enabled");
            enabledResponse.put("videoId", videoId);
            broadcastToStation(info.stationId, enabledResponse);
            
            log.info("자막 활성화: stationId={}, videoId={}", info.stationId, videoId);
        } catch (Exception e) {
            log.error("Failed to enable subtitles", e);
        }
    }

    private void handleSubtitleDisable(SessionInfo info) {
        if (!stationService.isHost(info.stationId, info.userId)) {
            return;
        }
        try {
            subtitleService.disableSubtitles(info.stationId);
            
            ObjectNode response = objectMapper.createObjectNode();
            response.put("type", "subtitle_disabled");
            broadcastToStation(info.stationId, response);
            
            log.info("자막 비활성화: stationId={}", info.stationId);
        } catch (Exception e) {
            log.error("Failed to disable subtitles", e);
        }
    }

    private void handleSubtitleStatus(SessionInfo info, JsonNode json, WebSocketSession session) {
        try {
            String videoId = json.has("videoId") ? json.get("videoId").asText() : stationVideoIds.get(info.stationId);
            if (videoId == null) {
                return;
            }
            
            SubtitleResponse status = subtitleService.getSubtitleStatus(videoId);
            
            ObjectNode response = objectMapper.createObjectNode();
            response.put("type", "subtitle_status");
            response.put("videoId", status.getVideoId());
            response.put("available", status.isAvailable());
            response.put("processing", status.isProcessing());
            response.put("enabled", subtitleService.isSubtitleEnabled(info.stationId));
            if (status.isAvailable()) {
                response.put("originalLanguage", status.getOriginalLanguage());
                response.set("segments", objectMapper.valueToTree(status.getSegments()));
            }
            
            sendToSession(session, response);
        } catch (Exception e) {
            log.error("Failed to get subtitle status", e);
        }
    }

    private void broadcastParticipantsUpdate(Integer stationId, String action, Integer affectedUserId) {
        Set<WebSocketSession> sessions = stationSessions.get(stationId);
        if (sessions == null || sessions.isEmpty()) {
            log.debug("No active sessions for station {} - skipping broadcast", stationId);
            return;
        }

        try {
            List<ParticipantInfo> participants = stationService.getParticipants(stationId);
            StationDetailResponse stationDetail = stationService.getStationDetail(stationId);

            ObjectNode response = objectMapper.createObjectNode();
            response.put("type", "participants_update");
            response.set("participants", objectMapper.valueToTree(participants));
            if (stationDetail != null) {
                response.set("host", objectMapper.valueToTree(stationDetail.getHost()));
                response.put("status", stationDetail.getStatus());
            }
            response.put("action", action);
            response.put("affectedUserId", affectedUserId);

            broadcastToStation(stationId, response);
        } catch (RuntimeException e) {
            if (e.getMessage() != null && e.getMessage().contains("not found")) {
                log.debug("Station {} no longer exists - skipping broadcast", stationId);
            } else {
                log.error("Failed to broadcast participants update", e);
            }
        } catch (Exception e) {
            log.error("Failed to broadcast participants update", e);
        }
    }

    public void notifyUserKicked(Integer stationId, Integer userId, String reason) {
        Set<WebSocketSession> sessions = stationSessions.get(stationId);
        if (sessions == null) {
            return;
        }

        for (WebSocketSession session : sessions) {
            SessionInfo info = sessionInfoMap.get(session.getId());
            if (info != null && info.userId.equals(userId)) {
                try {
                    ObjectNode response = objectMapper.createObjectNode();
                    response.put("type", "kicked");
                    if (reason != null) {
                        response.put("reason", reason);
                    }
                    sendToSession(session, response);
                    session.close(CloseStatus.NORMAL);
                } catch (Exception e) {
                    log.error("Failed to notify kicked user", e);
                }
                break;
            }
        }

        broadcastParticipantsUpdate(stationId, "kick", userId);
    }

    public void broadcastHostChanged(Integer stationId, Integer newHostId) {
        try {
            List<ParticipantInfo> participants = stationService.getParticipants(stationId);
            StationDetailResponse stationDetail = stationService.getStationDetail(stationId);

            ObjectNode response = objectMapper.createObjectNode();
            response.put("type", "host_changed");
            response.put("newHostId", newHostId);
            response.set("participants", objectMapper.valueToTree(participants));
            if (stationDetail != null && stationDetail.getHost() != null) {
                response.set("host", objectMapper.valueToTree(stationDetail.getHost()));
            }

            broadcastToStation(stationId, response);
        } catch (Exception e) {
            log.error("Failed to broadcast host changed", e);
        }
    }

    public void broadcastTitleChanged(Integer stationId, String newTitle) {
        try {
            ObjectNode response = objectMapper.createObjectNode();
            response.put("type", "title_changed");
            response.put("title", newTitle);
            broadcastToStation(stationId, response);
        } catch (Exception e) {
            log.error("Failed to broadcast title changed", e);
        }
    }

    public void notifyStationClosed(Integer stationId) {
        Set<WebSocketSession> sessions = stationSessions.remove(stationId);
        if (sessions == null) {
            return;
        }

        stationVideoIds.remove(stationId);
        stationQueues.remove(stationId);
        stationVolumes.remove(stationId);
        subtitleService.cleanup(stationId);

        for (WebSocketSession session : sessions) {
            try {
                ObjectNode response = objectMapper.createObjectNode();
                response.put("type", "station_closed");
                sendToSession(session, response);
                session.close(CloseStatus.NORMAL);
                sessionInfoMap.remove(session.getId());
            } catch (Exception e) {
                log.debug("Failed to notify station closed", e);
            }
        }
    }

    private void broadcastToStation(Integer stationId, Object message) {
        Set<WebSocketSession> sessions = stationSessions.get(stationId);
        if (sessions == null) {
            return;
        }

        for (WebSocketSession session : sessions) {
            if (session.isOpen()) {
                sendToSession(session, message);
            }
        }
    }

    private synchronized void sendToSession(WebSocketSession session, Object data) {
        if (session == null || !session.isOpen()) {
            return;
        }
        try {
            String json = objectMapper.writeValueAsString(data);
            session.sendMessage(new TextMessage(json));
        } catch (IOException e) {
            log.debug("Failed to send message (connection closed) - sessionId: {}", session.getId());
        } catch (Exception e) {
            log.error("Failed to send message - sessionId: {}", session.getId(), e);
        }
    }

    private Integer parseIntParam(String query, String paramName) {
        if (query == null) return null;

        for (String param : query.split("&")) {
            String[] keyValue = param.split("=");
            if (keyValue.length == 2 && paramName.equals(keyValue[0])) {
                try {
                    return Integer.parseInt(keyValue[1]);
                } catch (NumberFormatException e) {
                    return null;
                }
            }
        }
        return null;
    }

    public int getStationConnectionCount(Integer stationId) {
        Set<WebSocketSession> sessions = stationSessions.get(stationId);
        return sessions != null ? sessions.size() : 0;
    }
}
