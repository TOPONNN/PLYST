package com.plyst.controller;

import com.plyst.service.LikeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/likes")
@RequiredArgsConstructor
public class LikeController {

    private final LikeService likeService;

    // ===== 플레이리스트 좋아요 =====
    
    @PostMapping("/playlist/{playlistId}")
    public ResponseEntity<Map<String, Object>> togglePlaylistLike(
            @PathVariable Integer playlistId,
            @RequestParam Integer userId) {
        boolean isLiked = likeService.togglePlaylistLike(userId, playlistId);
        long likeCount = likeService.getPlaylistLikeCount(playlistId);
        
        return ResponseEntity.ok(Map.of(
                "isLiked", isLiked,
                "likeCount", likeCount
        ));
    }
    
    @GetMapping("/playlist/{playlistId}")
    public ResponseEntity<Map<String, Object>> getPlaylistLikeStatus(
            @PathVariable Integer playlistId,
            @RequestParam Integer userId) {
        boolean isLiked = likeService.isPlaylistLiked(userId, playlistId);
        long likeCount = likeService.getPlaylistLikeCount(playlistId);
        
        return ResponseEntity.ok(Map.of(
                "isLiked", isLiked,
                "likeCount", likeCount
        ));
    }
    
    @GetMapping("/playlist/{playlistId}/count")
    public ResponseEntity<Long> getPlaylistLikeCount(@PathVariable Integer playlistId) {
        return ResponseEntity.ok(likeService.getPlaylistLikeCount(playlistId));
    }
    
    @GetMapping("/playlists/user/{userId}")
    public ResponseEntity<List<Map<String, Object>>> getUserLikedPlaylists(@PathVariable Integer userId) {
        return ResponseEntity.ok(likeService.getUserLikedPlaylistsInfo(userId));
    }

    // ===== 댓글 좋아요 =====
    
    @PostMapping("/comment/{commentId}")
    public ResponseEntity<Map<String, Object>> toggleCommentLike(
            @PathVariable Integer commentId,
            @RequestParam Integer userId) {
        boolean isLiked = likeService.toggleCommentLike(userId, commentId);
        long likeCount = likeService.getCommentLikeCount(commentId);
        
        return ResponseEntity.ok(Map.of(
                "isLiked", isLiked,
                "likeCount", likeCount
        ));
    }
    
    @GetMapping("/comment/{commentId}")
    public ResponseEntity<Map<String, Object>> getCommentLikeStatus(
            @PathVariable Integer commentId,
            @RequestParam Integer userId) {
        boolean isLiked = likeService.isCommentLiked(userId, commentId);
        long likeCount = likeService.getCommentLikeCount(commentId);
        
        return ResponseEntity.ok(Map.of(
                "isLiked", isLiked,
                "likeCount", likeCount
        ));
    }
    
    @GetMapping("/comment/{commentId}/count")
    public ResponseEntity<Long> getCommentLikeCount(@PathVariable Integer commentId) {
        return ResponseEntity.ok(likeService.getCommentLikeCount(commentId));
    }
    
    @GetMapping("/comments/user/{userId}")
    public ResponseEntity<List<Map<String, Object>>> getUserLikedComments(@PathVariable Integer userId) {
        return ResponseEntity.ok(likeService.getUserLikedCommentsInfo(userId));
    }

    // ===== 트랙 좋아요 =====
    
    @PostMapping("/track")
    public ResponseEntity<Map<String, Object>> toggleTrackLike(
            @RequestParam String title,
            @RequestParam String artist,
            @RequestParam Integer userId) {
        boolean isLiked = likeService.toggleTrackLike(userId, title, artist);
        
        return ResponseEntity.ok(Map.of(
                "isLiked", isLiked
        ));
    }
    
    @GetMapping("/tracks/user/{userId}")
    public ResponseEntity<List<Map<String, Object>>> getUserLikedTracks(@PathVariable Integer userId) {
        return ResponseEntity.ok(likeService.getUserLikedTracksInfo(userId));
    }
}
