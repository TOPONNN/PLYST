package com.plyst.controller;

import com.plyst.dto.CommentDto.*;
import com.plyst.service.CommentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/comments")
@RequiredArgsConstructor
public class CommentController {

    private final CommentService commentService;

    // 플레이리스트의 댓글 목록 조회
    @GetMapping("/playlist/{playlistId}")
    public ResponseEntity<List<CommentResponse>> getCommentsByPlaylist(
            @PathVariable Integer playlistId,
            @RequestParam(required = false) Integer userId) {
        return ResponseEntity.ok(commentService.getCommentsByPlaylist(playlistId, userId));
    }

    // 사용자가 작성한 댓글 목록 조회
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<CommentResponse>> getCommentsByUser(@PathVariable Integer userId) {
        return ResponseEntity.ok(commentService.getCommentsByUser(userId));
    }

    // 사용자가 작성한 댓글 수 조회
    @GetMapping("/user/{userId}/count")
    public ResponseEntity<Map<String, Long>> countUserComments(@PathVariable Integer userId) {
        return ResponseEntity.ok(Map.of("count", commentService.countUserComments(userId)));
    }

    // 댓글 작성
    @PostMapping
    public ResponseEntity<CommentResponse> createComment(
            @RequestParam Integer userId,
            @RequestBody CreateCommentRequest request) {
        return ResponseEntity.ok(commentService.createComment(userId, request));
    }

    // 댓글 수정
    @PutMapping("/{commentId}")
    public ResponseEntity<CommentResponse> updateComment(
            @PathVariable Integer commentId,
            @RequestParam Integer userId,
            @RequestBody UpdateCommentRequest request) {
        return ResponseEntity.ok(commentService.updateComment(commentId, userId, request));
    }

    // 댓글 삭제
    @DeleteMapping("/{commentId}")
    public ResponseEntity<Void> deleteComment(
            @PathVariable Integer commentId,
            @RequestParam Integer userId) {
        commentService.deleteComment(commentId, userId);
        return ResponseEntity.ok().build();
    }
}
