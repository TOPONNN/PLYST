package com.plyst.dto;

import lombok.*;

public class SpotifyDto {

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class PlaylistResponse {
        private String id;
        private String name;
        private String image;
        private String owner;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class TrackResponse {
        private String title;
        private AlbumInfo album;
        private String artists;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class AlbumInfo {
        private String title;
        private String image;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class TrackInfoResponse {
        private String title;
        private String artist;
        private String album;
        private String albumImage;
        private Long duration;
    }
}
