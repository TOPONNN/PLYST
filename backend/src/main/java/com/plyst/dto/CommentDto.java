package com.plyst.dto;

import lombok.*;

public class CommentDto {

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CommentResponse {
        private Integer id;
        private String content;
        private AuthorInfo author;
        private Long likeCount;
        private Boolean isLiked;
        private String createdAt;
        // 사용자 댓글 조회 시 플레이리스트 정보
        private Integer playlistId;
        private String playlistTitle;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CreateCommentRequest {
        private Integer playlistId;
        private Integer parentId;
        private String content;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class UpdateCommentRequest {
        private String content;
    }

    @Data @AllArgsConstructor @NoArgsConstructor
    public static class AuthorInfo {
        private Integer id;
        private String nickname;
        private String avatar;
    }
}
