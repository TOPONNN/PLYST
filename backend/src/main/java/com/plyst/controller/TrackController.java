package com.plyst.controller;

import com.plyst.dto.TrackDto.*;
import com.plyst.service.TrackService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tracks")
@RequiredArgsConstructor
public class TrackController {

    private final TrackService trackService;

    // 트랙 좋아요 토글 (title, artist로)
    @PostMapping("/like")
    public ResponseEntity<TrackLikeResponse> toggleTrackLike(
            @RequestParam Integer userId,
            @RequestBody TrackLikeRequest request) {
        return ResponseEntity.ok(trackService.toggleTrackLikeByInfo(
                userId, request.getTitle(), request.getArtist(), request.getAlbumImage()));
    }

    // 사용자의 좋아요한 트랙 목록
    @GetMapping("/liked")
    public ResponseEntity<List<LikedTrackResponse>> getUserLikedTracks(@RequestParam Integer userId) {
        return ResponseEntity.ok(trackService.getUserLikedTracks(userId));
    }

    // 트랙 좋아요 상태 확인 (title, artist로)
    @GetMapping("/like/status")
    public ResponseEntity<Map<String, Boolean>> isTrackLiked(
            @RequestParam Integer userId,
            @RequestParam String title,
            @RequestParam String artist) {
        boolean isLiked = trackService.isTrackLikedByInfo(userId, title, artist);
        return ResponseEntity.ok(Map.of("isLiked", isLiked));
    }
}
