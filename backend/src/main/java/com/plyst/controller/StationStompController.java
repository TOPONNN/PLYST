package com.plyst.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.plyst.dto.StationDto.*;
import com.plyst.dto.SubtitleDto.*;
import com.plyst.service.StationService;
import com.plyst.service.SubtitleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.annotation.SubscribeMapping;
import org.springframework.stereotype.Controller;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Controller
@RequiredArgsConstructor
public class StationStompController {

    private final SimpMessagingTemplate messagingTemplate;
    private final StationService stationService;
    private final SubtitleService subtitleService;
    private final ObjectMapper objectMapper;

    private final Map<Integer, String> stationVideoIds = new ConcurrentHashMap<>();
    private final Map<Integer, JsonNode> stationQueues = new ConcurrentHashMap<>();
    private final Map<Integer, Integer> stationVolumes = new ConcurrentHashMap<>();

    @SubscribeMapping("/station/{stationId}")
    public ObjectNode handleSubscribe(@DestinationVariable Integer stationId, SimpMessageHeaderAccessor headerAccessor) {
        Integer userId = getUserIdFromHeader(headerAccessor);
        if (userId == null) {
            return createErrorResponse("userId is required");
        }

        log.info("Station STOMP subscribed - stationId: {}, userId: {}", stationId, userId);
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

        broadcastParticipantsUpdate(stationId, "join", userId);
        return response;
    }

    @MessageMapping("/station/{stationId}/playback")
    public void handlePlaybackUpdate(
            @DestinationVariable Integer stationId,
            @Payload JsonNode payload,
            SimpMessageHeaderAccessor headerAccessor) {
        
        Integer userId = getUserIdFromHeader(headerAccessor);
        if (userId == null || !stationService.isHost(stationId, userId)) {
            log.warn("Non-host tried to update playback - stationId: {}, userId: {}", stationId, userId);
            return;
        }

        try {
            JsonNode payloadNode = payload.get("payload");
            if (payloadNode == null) return;

            PlaybackUpdateMessage playbackUpdate = objectMapper.treeToValue(payloadNode, PlaybackUpdateMessage.class);
            stationService.updatePlayback(stationId, playbackUpdate);

            String videoId = payload.has("videoId") ? payload.get("videoId").asText() : null;
            String previousVideoId = stationVideoIds.get(stationId);
            if (videoId != null) {
                stationVideoIds.put(stationId, videoId);

                if (!videoId.equals(previousVideoId)) {
                    subtitleService.enableSubtitles(stationId, videoId, (subtitleResponse) -> {
                        ObjectNode subtitleReadyResponse = objectMapper.createObjectNode();
                        subtitleReadyResponse.put("type", "subtitle_ready");
                        subtitleReadyResponse.put("videoId", subtitleResponse.getVideoId());
                        subtitleReadyResponse.put("available", subtitleResponse.isAvailable());
                        subtitleReadyResponse.put("processing", subtitleResponse.isProcessing());
                        subtitleReadyResponse.put("originalLanguage", subtitleResponse.getOriginalLanguage());
                        subtitleReadyResponse.set("segments", objectMapper.valueToTree(subtitleResponse.getSegments()));
                        broadcastToStation(stationId, subtitleReadyResponse);
                    });

                    ObjectNode enabledResponse = objectMapper.createObjectNode();
                    enabledResponse.put("type", "subtitle_enabled");
                    enabledResponse.put("videoId", videoId);
                    broadcastToStation(stationId, enabledResponse);
                }
            }

            ObjectNode response = objectMapper.createObjectNode();
            response.put("type", "playback_update");
            response.set("payload", payloadNode);
            if (videoId != null) {
                response.put("videoId", videoId);
            }
            response.put("serverTime", System.currentTimeMillis());
            response.put("senderId", userId);

            broadcastToStation(stationId, response);
        } catch (Exception e) {
            log.error("Failed to process playback update", e);
        }
    }

    @MessageMapping("/station/{stationId}/chat")
    public void handleChat(
            @DestinationVariable Integer stationId,
            @Payload JsonNode payload,
            SimpMessageHeaderAccessor headerAccessor) {
        
        Integer userId = getUserIdFromHeader(headerAccessor);
        if (userId == null) return;

        try {
            String messageText = payload.has("message") ? payload.get("message").asText() : null;
            if (messageText == null || messageText.isBlank()) return;

            List<ParticipantInfo> participants = stationService.getParticipants(stationId);
            ParticipantInfo sender = participants.stream()
                    .filter(p -> p.getId().equals(userId))
                    .findFirst()
                    .orElse(null);

            ObjectNode userNode = objectMapper.createObjectNode();
            userNode.put("id", userId);
            userNode.put("nickname", sender != null ? sender.getNickname() : "Unknown");
            if (sender != null && sender.getAvatar() != null) {
                userNode.put("avatar", sender.getAvatar());
            }

            ObjectNode response = objectMapper.createObjectNode();
            response.put("type", "chat");
            response.set("user", userNode);
            response.put("message", messageText);
            response.put("sentAt", LocalDateTime.now().toString());

            broadcastToStation(stationId, response);
        } catch (Exception e) {
            log.error("Failed to process chat message", e);
        }
    }

    @MessageMapping("/station/{stationId}/sync")
    public void handleSyncRequest(
            @DestinationVariable Integer stationId,
            SimpMessageHeaderAccessor headerAccessor) {
        
        Integer userId = getUserIdFromHeader(headerAccessor);
        if (userId == null) return;

        try {
            StationDetailResponse stationDetail = stationService.getStationDetail(stationId);
            String videoId = stationVideoIds.get(stationId);

            ObjectNode response = objectMapper.createObjectNode();
            response.put("type", "station_detail");
            response.set("station", objectMapper.valueToTree(stationDetail));
            if (videoId != null) {
                response.put("videoId", videoId);
            }
            response.put("serverTime", System.currentTimeMillis());

            String sessionId = headerAccessor.getSessionId();
            messagingTemplate.convertAndSendToUser(sessionId, "/queue/station/" + stationId, response);
        } catch (Exception e) {
            log.error("Failed to process sync request", e);
        }
    }

    @MessageMapping("/station/{stationId}/volume")
    public void handleVolumeUpdate(
            @DestinationVariable Integer stationId,
            @Payload JsonNode payload,
            SimpMessageHeaderAccessor headerAccessor) {
        
        Integer userId = getUserIdFromHeader(headerAccessor);
        if (userId == null || !stationService.isHost(stationId, userId)) return;

        try {
            int volume = payload.has("volume") ? payload.get("volume").asInt() : 100;
            stationVolumes.put(stationId, volume);

            ObjectNode response = objectMapper.createObjectNode();
            response.put("type", "volume_update");
            response.put("volume", volume);

            broadcastToStation(stationId, response);
        } catch (Exception e) {
            log.error("Failed to process volume update", e);
        }
    }

    @MessageMapping("/station/{stationId}/queue/update")
    public void handleQueueUpdate(
            @DestinationVariable Integer stationId,
            @Payload JsonNode payload,
            SimpMessageHeaderAccessor headerAccessor) {
        
        Integer userId = getUserIdFromHeader(headerAccessor);
        if (userId == null || !stationService.isHost(stationId, userId)) return;

        try {
            JsonNode queueNode = payload.get("queue");
            stationQueues.put(stationId, queueNode);

            ObjectNode response = objectMapper.createObjectNode();
            response.put("type", "queue_update");
            response.set("queue", queueNode);

            broadcastToStation(stationId, response);
        } catch (Exception e) {
            log.error("Failed to process queue update", e);
        }
    }

    @MessageMapping("/station/{stationId}/queue/add")
    public void handleQueueAdd(
            @DestinationVariable Integer stationId,
            @Payload JsonNode payload,
            SimpMessageHeaderAccessor headerAccessor) {
        
        Integer userId = getUserIdFromHeader(headerAccessor);
        if (userId == null) return;

        try {
            JsonNode itemNode = payload.get("item");

            JsonNode currentQueue = stationQueues.get(stationId);
            com.fasterxml.jackson.databind.node.ArrayNode newQueue;
            if (currentQueue != null && currentQueue.isArray()) {
                newQueue = (com.fasterxml.jackson.databind.node.ArrayNode) currentQueue.deepCopy();
            } else {
                newQueue = objectMapper.createArrayNode();
            }
            newQueue.add(itemNode);
            stationQueues.put(stationId, newQueue);

            ObjectNode response = objectMapper.createObjectNode();
            response.put("type", "queue_add");
            response.set("item", itemNode);

            broadcastToStation(stationId, response);
        } catch (Exception e) {
            log.error("Failed to process queue add", e);
        }
    }

    @MessageMapping("/station/{stationId}/subtitle/enable")
    public void handleSubtitleEnable(
            @DestinationVariable Integer stationId,
            @Payload JsonNode payload,
            SimpMessageHeaderAccessor headerAccessor) {
        
        Integer userId = getUserIdFromHeader(headerAccessor);
        if (userId == null || !stationService.isHost(stationId, userId)) return;

        try {
            String videoId = payload.has("videoId") ? payload.get("videoId").asText() : stationVideoIds.get(stationId);
            if (videoId == null) return;

            subtitleService.enableSubtitles(stationId, videoId, (subtitleResponse) -> {
                ObjectNode response = objectMapper.createObjectNode();
                response.put("type", "subtitle_ready");
                response.put("videoId", subtitleResponse.getVideoId());
                response.put("available", subtitleResponse.isAvailable());
                response.put("processing", subtitleResponse.isProcessing());
                response.put("originalLanguage", subtitleResponse.getOriginalLanguage());
                response.set("segments", objectMapper.valueToTree(subtitleResponse.getSegments()));
                broadcastToStation(stationId, response);
            });

            ObjectNode enabledResponse = objectMapper.createObjectNode();
            enabledResponse.put("type", "subtitle_enabled");
            enabledResponse.put("videoId", videoId);
            broadcastToStation(stationId, enabledResponse);

            log.info("Subtitle enabled: stationId={}, videoId={}", stationId, videoId);
        } catch (Exception e) {
            log.error("Failed to enable subtitles", e);
        }
    }

    @MessageMapping("/station/{stationId}/subtitle/disable")
    public void handleSubtitleDisable(
            @DestinationVariable Integer stationId,
            SimpMessageHeaderAccessor headerAccessor) {
        
        Integer userId = getUserIdFromHeader(headerAccessor);
        if (userId == null || !stationService.isHost(stationId, userId)) return;

        try {
            subtitleService.disableSubtitles(stationId);

            ObjectNode response = objectMapper.createObjectNode();
            response.put("type", "subtitle_disabled");
            broadcastToStation(stationId, response);

            log.info("Subtitle disabled: stationId={}", stationId);
        } catch (Exception e) {
            log.error("Failed to disable subtitles", e);
        }
    }

    @MessageMapping("/station/{stationId}/subtitle/status")
    public void handleSubtitleStatus(
            @DestinationVariable Integer stationId,
            @Payload JsonNode payload,
            SimpMessageHeaderAccessor headerAccessor) {
        
        Integer userId = getUserIdFromHeader(headerAccessor);
        if (userId == null) return;

        try {
            String videoId = payload.has("videoId") ? payload.get("videoId").asText() : stationVideoIds.get(stationId);
            if (videoId == null) return;

            SubtitleResponse status = subtitleService.getSubtitleStatus(videoId);

            ObjectNode response = objectMapper.createObjectNode();
            response.put("type", "subtitle_status");
            response.put("videoId", status.getVideoId());
            response.put("available", status.isAvailable());
            response.put("processing", status.isProcessing());
            response.put("enabled", subtitleService.isSubtitleEnabled(stationId));
            if (status.isAvailable()) {
                response.put("originalLanguage", status.getOriginalLanguage());
                response.set("segments", objectMapper.valueToTree(status.getSegments()));
            }

            String sessionId = headerAccessor.getSessionId();
            messagingTemplate.convertAndSendToUser(sessionId, "/queue/station/" + stationId, response);
        } catch (Exception e) {
            log.error("Failed to get subtitle status", e);
        }
    }

    public void notifyUserKicked(Integer stationId, Integer userId, String reason) {
        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "kicked");
        if (reason != null) {
            response.put("reason", reason);
        }
        messagingTemplate.convertAndSendToUser(
                String.valueOf(userId),
                "/queue/station/" + stationId,
                response
        );
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
        stationVideoIds.remove(stationId);
        stationQueues.remove(stationId);
        stationVolumes.remove(stationId);
        subtitleService.cleanup(stationId);

        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "station_closed");
        broadcastToStation(stationId, response);
    }

    private void broadcastParticipantsUpdate(Integer stationId, String action, Integer affectedUserId) {
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

    private void broadcastToStation(Integer stationId, Object message) {
        messagingTemplate.convertAndSend("/topic/station/" + stationId, message);
    }

    private Integer getUserIdFromHeader(SimpMessageHeaderAccessor headerAccessor) {
        Map<String, Object> sessionAttributes = headerAccessor.getSessionAttributes();
        if (sessionAttributes != null && sessionAttributes.containsKey("userId")) {
            Object userIdObj = sessionAttributes.get("userId");
            if (userIdObj instanceof Integer) {
                return (Integer) userIdObj;
            } else if (userIdObj instanceof String) {
                try {
                    return Integer.parseInt((String) userIdObj);
                } catch (NumberFormatException e) {
                    return null;
                }
            }
        }
        return null;
    }

    private ObjectNode createErrorResponse(String message) {
        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "error");
        response.put("message", message);
        return response;
    }
}
