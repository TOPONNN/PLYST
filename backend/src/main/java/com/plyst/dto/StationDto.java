package com.plyst.dto;

import lombok.*;
import java.util.List;

public class StationDto {

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CreateStationRequest {
        private String title;
        private Integer maxParticipants;
        private Boolean isPrivate;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CreateStationResponse {
        private Integer id;
        private String inviteCode;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class JoinStationRequest {
        private String inviteCode;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class KickUserRequest {
        private Integer targetUserId;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class UserInfo {
        private Integer id;
        private String nickname;
        private String avatar;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ParticipantInfo {
        private Integer id;
        private String nickname;
        private String avatar;
        private String role;
        private String joinedAt;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class BannedUserInfo {
        private Integer id;
        private String nickname;
        private String avatar;
        private String bannedAt;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PlaybackInfo {
        private Integer trackId;
        private String title;
        private String artist;
        private String albumImage;
        private Integer durationSec;
        private Integer positionMs;
        private Boolean isPlaying;
        private String updatedAt;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class StationListItemResponse {
        private Integer id;
        private String title;
        private String inviteCode;
        private String hostNickname;
        private Integer participantCount;
        private Integer maxParticipants;
        private Boolean isLive;
        private Boolean isPrivate;
        private UserInfo host;
        private String createdAt;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class StationDetailResponse {
        private Integer id;
        private String title;
        private String inviteCode;
        private Integer maxParticipants;
        private String status;
        private UserInfo host;
        private List<ParticipantInfo> participants;
        private List<BannedUserInfo> bannedUsers;
        private PlaybackInfo playback;
        private String createdAt;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class StationMessage {
        private String type;
        private Object payload;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ChatMessage {
        private Integer userId;
        private String nickname;
        private String message;
        private String timestamp;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PlaybackUpdateMessage {
        private Integer trackId;
        private String title;
        private String artist;
        private String albumImage;
        private Integer durationSec;
        private Integer positionMs;
        private Boolean isPlaying;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ParticipantsUpdateMessage {
        private List<ParticipantInfo> participants;
        private String action;
        private Integer affectedUserId;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class KickedMessage {
        private String reason;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SyncRequestMessage {
        private Integer userId;
    }
}
