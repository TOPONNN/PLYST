package com.plyst.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

public class NotificationDto {
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Response {
        private Long id;
        private String type;
        private String title;
        private String message;
        private String avatar;
        @JsonProperty("isRead")
        private boolean isRead;
        private Long relatedId;
        private String time;  // 상대적 시간 (방금 전, 5분 전 등)
        private String createdAt;  // 절대 시간
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WebSocketMessage {
        private String type;  // new_notification, connected, etc.
        private Response notification;
        private String message;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateRequest {
        private Long userId;
        private String type;
        private String title;
        private String message;
        private String avatar;
        private Long relatedId;
    }
}
