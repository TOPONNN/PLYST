package com.plyst.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

public class AIRecommendDto {
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AIRecommendRequest {
        private List<String> tags;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AIPlaylistResponse {
        private boolean success;
        private String message;
        private List<RecommendedPlaylist> playlists;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecommendedPlaylist {
        private String id;
        private String title;
        private String description;
        private String coverGradient;
        private String coverImage; // DALL-E generated image URL
        private int trackCount;
        private List<String> tags;
        private List<TrackInfo> tracks;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TrackInfo {
        private String title;
        private String artist;
        private String duration;
        private String albumImage; // 앨범 커버 이미지 URL
    }
}
