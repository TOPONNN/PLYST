package com.plyst.dto;

import lombok.*;
import java.util.List;

public class PlaylistDto {

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PlaylistResponse {
        private Integer id;
        private String title;
        private String description;
        private String coverImageUrl;
        private Boolean isPublic;
        private Integer viewCount;
        private Long likeCount;
        private Integer shareCount;
        private OwnerInfo owner;
        private Integer trackCount;
        private List<String> tags;
        private String createdAt;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PlaylistDetailResponse {
        private Integer id;
        private String title;
        private String description;
        private String coverImageUrl;
        private Boolean isPublic;
        private Integer viewCount;
        private Long likeCount;
        private Integer shareCount;
        private Boolean isLiked;
        private OwnerInfo owner;
        private List<TrackInfo> tracks;
        private List<String> tags;
        private String createdAt;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CreatePlaylistRequest {
        private String title;
        private String description;
        private String coverImageUrl;
        private Boolean isPublic;
        private List<String> tags;
        private List<CreateTrackRequest> tracks;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class UpdatePlaylistRequest {
        private String title;
        private String description;
        private String coverImageUrl;
        private Boolean isPublic;
        private List<String> tags;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CreateTrackRequest {
        private String title;
        private String artist;
        private String albumName;
        private String albumImage;
        private Integer durationSec;
    }

    @Data @AllArgsConstructor @NoArgsConstructor
    public static class OwnerInfo {
        private Integer id;
        private String nickname;
    }

    @Data @AllArgsConstructor @NoArgsConstructor
    public static class TrackInfo {
        private Integer id;
        private String title;
        private String artist;
        private String albumImage;
        private Integer durationSec;
    }
    
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PlaylistSummary {
        private Integer id;
        private String title;
        private String description;
        private String coverImageUrl;
        private Integer trackCount;
        private Long likeCount;
        private String createdAt;
        private Boolean isPublic;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class UpdateTrackRequest {
        private String title;
        private String artist;
        private String albumName;
        private String albumImage;
        private Integer durationSec;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class AddTrackRequest {
        private String title;
        private String artist;
        private String albumName;
        private String albumImage;
        private Integer durationSec;
        private Integer orderNo; // 선택적, 없으면 마지막에 추가
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ReorderTracksRequest {
        private List<Integer> trackIds; // 새로운 순서의 트랙 ID 목록
    }
}
