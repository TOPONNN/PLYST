package com.plyst.dto;

import lombok.*;
import java.util.List;

public class ProfileDto {
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ProfileResponse {
        private Integer userId;
        private String nickname;
        private String bio;
        private String avatar;
        private List<String> musicTags;
        private int playlists;
        private int likedPlaylists;
        private int followers;
        private int following;
        private int comments;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UpdateProfileRequest {
        private String nickname;
        private String bio;
        private String avatar;
        private List<String> musicTags;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UpdateProfileResponse {
        private boolean success;
        private String message;
        private ProfileResponse profile;
    }
}
