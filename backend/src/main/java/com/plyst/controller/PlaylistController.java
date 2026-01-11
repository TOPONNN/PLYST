package com.plyst.controller;

import com.plyst.dto.PlaylistDto.*;
import com.plyst.service.PlaylistService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/playlists")
@RequiredArgsConstructor
public class PlaylistController {

    private final PlaylistService playlistService;

    @GetMapping
    public ResponseEntity<List<PlaylistResponse>> getPublicPlaylists(
            @RequestParam(required = false) Integer userId) {
        return ResponseEntity.ok(playlistService.getPublicPlaylists(userId));
    }

    // 사용자의 플레이리스트 목록 조회
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<PlaylistResponse>> getUserPlaylists(@PathVariable Integer userId) {
        return ResponseEntity.ok(playlistService.getUserPlaylists(userId));
    }

    // 플레이리스트 상세 조회
    @GetMapping("/{playlistId}")
    public ResponseEntity<PlaylistDetailResponse> getPlaylistDetail(
            @PathVariable Integer playlistId,
            @RequestParam(required = false) Integer userId,
            @RequestParam(required = false, defaultValue = "true") Boolean incrementView) {
        return ResponseEntity.ok(playlistService.getPlaylistDetail(playlistId, userId, incrementView));
    }

    // 플레이리스트 생성
    @PostMapping
    public ResponseEntity<PlaylistResponse> createPlaylist(
            @RequestParam Integer userId,
            @RequestBody CreatePlaylistRequest request) {
        return ResponseEntity.ok(playlistService.createPlaylist(userId, request));
    }

    // 플레이리스트 수정
    @PutMapping("/{playlistId}")
    public ResponseEntity<PlaylistResponse> updatePlaylist(
            @PathVariable Integer playlistId,
            @RequestParam Integer userId,
            @RequestBody UpdatePlaylistRequest request) {
        return ResponseEntity.ok(playlistService.updatePlaylist(playlistId, userId, request));
    }

    // 플레이리스트 삭제
    @DeleteMapping("/{playlistId}")
    public ResponseEntity<Void> deletePlaylist(
            @PathVariable Integer playlistId,
            @RequestParam Integer userId) {
        playlistService.deletePlaylist(playlistId, userId);
        return ResponseEntity.ok().build();
    }

    // 플레이리스트에 트랙 추가
    @PostMapping("/{playlistId}/tracks")
    public ResponseEntity<TrackInfo> addTrack(
            @PathVariable Integer playlistId,
            @RequestParam Integer userId,
            @RequestBody AddTrackRequest request) {
        return ResponseEntity.ok(playlistService.addTrack(playlistId, userId, request));
    }

    // 플레이리스트에서 트랙 삭제
    @DeleteMapping("/{playlistId}/tracks/{trackId}")
    public ResponseEntity<Void> removeTrack(
            @PathVariable Integer playlistId,
            @PathVariable Integer trackId,
            @RequestParam Integer userId) {
        playlistService.removeTrack(playlistId, trackId, userId);
        return ResponseEntity.ok().build();
    }

    // 플레이리스트 트랙 정보 수정
    @PutMapping("/{playlistId}/tracks/{trackId}")
    public ResponseEntity<TrackInfo> updateTrack(
            @PathVariable Integer playlistId,
            @PathVariable Integer trackId,
            @RequestParam Integer userId,
            @RequestBody UpdateTrackRequest request) {
        return ResponseEntity.ok(playlistService.updateTrack(playlistId, trackId, userId, request));
    }

    // 플레이리스트 트랙 순서 변경
    @PutMapping("/{playlistId}/tracks/reorder")
    public ResponseEntity<Void> reorderTracks(
            @PathVariable Integer playlistId,
            @RequestParam Integer userId,
            @RequestBody ReorderTracksRequest request) {
        playlistService.reorderTracks(playlistId, userId, request.getTrackIds());
        return ResponseEntity.ok().build();
    }

    // 플레이리스트 공개/비공개 토글
    @PutMapping("/{playlistId}/visibility")
    public ResponseEntity<PlaylistResponse> toggleVisibility(
            @PathVariable Integer playlistId,
            @RequestParam Integer userId) {
        return ResponseEntity.ok(playlistService.toggleVisibility(playlistId, userId));
    }

    // 플레이리스트 복제
    @PostMapping("/{playlistId}/duplicate")
    public ResponseEntity<PlaylistResponse> duplicatePlaylist(
            @PathVariable Integer playlistId,
            @RequestParam Integer userId) {
        return ResponseEntity.ok(playlistService.duplicatePlaylist(playlistId, userId));
    }

    @PostMapping("/{playlistId}/share")
    public ResponseEntity<Integer> sharePlaylist(@PathVariable Integer playlistId) {
        return ResponseEntity.ok(playlistService.incrementShareCount(playlistId));
    }
}
