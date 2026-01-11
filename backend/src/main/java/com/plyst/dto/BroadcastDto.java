package com.plyst.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

public class BroadcastDto {
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PlaylistEvent {
        private String type;
        private PlaylistData playlist;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PlaylistData {
        private Integer id;
        private String title;
        private String description;
        private String coverImageUrl;
        private Boolean isPublic;
        private Integer viewCount;
        private Long likeCount;
        private OwnerData owner;
        private Integer trackCount;
        private List<String> tags;
        private String createdAt;
        private List<TrackData> tracks;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OwnerData {
        private Integer id;
        private String nickname;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TrackData {
        private Integer id;
        private String title;
        private String artist;
        private String albumImage;
        private Integer durationSec;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CommentEvent {
        private String type;
        private Integer playlistId;
        private CommentData comment;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CommentData {
        private Integer id;
        private String content;
        private AuthorData author;
        private Long likeCount;
        private Boolean isLiked;
        private String createdAt;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AuthorData {
        private Integer id;
        private String nickname;
        private String avatar;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DeleteEvent {
        private String type;
        private Integer id;
        private Integer playlistId;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LikeEvent {
        private String type;
        private Integer playlistId;
        private Integer commentId;
        private Long likeCount;
        private Integer userId;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ShareEvent {
        private String type;
        private Integer playlistId;
        private Integer shareCount;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VisibilityEvent {
        private String type;
        private Integer playlistId;
        private Boolean isPublic;
        private PlaylistData playlist;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PlaylistUpdateEvent {
        private String type;
        private PlaylistData playlist;
    }
}
