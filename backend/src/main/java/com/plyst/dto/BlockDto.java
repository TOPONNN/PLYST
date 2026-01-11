package com.plyst.dto;

import lombok.*;

public class BlockDto {
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BlockedUserResponse {
        private Integer id;
        private String nickname;
        private String avatar;
        private String reason;
        private String blockedAt;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BlockStatusResponse {
        private boolean isBlocked;
        private boolean isBlockedByTarget;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BlockRequest {
        private String reason;
    }
}
