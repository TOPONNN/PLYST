package com.plyst.dto;

import lombok.*;

public class TrackDto {

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class TrackLikeRequest {
        private String title;
        private String artist;
        private String albumImage;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class TrackLikeResponse {
        private Integer trackId;
        private Boolean isLiked;
        private Long likeCount;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class LikedTrackResponse {
        private Integer id;
        private String title;
        private String artist;
        private String albumImage;
        private Integer durationSec;
        private String likedAt;
    }
}
