package com.plyst.controller;

import com.plyst.dto.AIRecommendDto.*;
import com.plyst.service.AIPlaylistService;
import com.plyst.service.ChatGPTService;
import com.plyst.service.ImageSearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/ai")
public class AIController {

    private final ChatGPTService chatGPTService;
    private final AIPlaylistService aiPlaylistService;
    private final ImageSearchService imageSearchService;

    /**
     * AI 플레이리스트 추천 받기
     */
    @PostMapping("/recommend")
    public AIPlaylistResponse recommendPlaylist(@RequestBody AIRecommendRequest request) {
        return chatGPTService.recommendPlaylist(request.getTags());
    }

    /**
     * AI 추천 플레이리스트 저장
     */
    @PostMapping("/playlists")
    public ResponseEntity<?> savePlaylist(
            @RequestParam(required = false) Long userId,
            @RequestBody RecommendedPlaylist playlist) {
        try {
            var savedPlaylist = aiPlaylistService.savePlaylist(userId, playlist);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "플레이리스트가 저장되었습니다.",
                "playlistId", savedPlaylist.getId()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", "저장 실패: " + e.getMessage()
            ));
        }
    }

    /**
     * 사용자의 AI 추천 플레이리스트 목록 조회
     */
    @GetMapping("/playlists")
    public ResponseEntity<List<RecommendedPlaylist>> getUserPlaylists(
            @RequestParam(required = false) Long userId) {
        List<RecommendedPlaylist> playlists;
        if (userId != null) {
            playlists = aiPlaylistService.getUserPlaylists(userId);
        } else {
            playlists = aiPlaylistService.getAllPlaylists();
        }
        return ResponseEntity.ok(playlists);
    }

    /**
     * 특정 AI 플레이리스트 조회
     */
    @GetMapping("/playlists/{id}")
    public ResponseEntity<?> getPlaylist(@PathVariable Long id) {
        RecommendedPlaylist playlist = aiPlaylistService.getPlaylist(id);
        if (playlist != null) {
            return ResponseEntity.ok(playlist);
        }
        return ResponseEntity.notFound().build();
    }

    /**
     * AI 플레이리스트 삭제
     */
    @DeleteMapping("/playlists/{id}")
    public ResponseEntity<?> deletePlaylist(
            @PathVariable Long id,
            @RequestParam(required = false) Long userId) {
        boolean deleted = aiPlaylistService.deletePlaylist(id, userId);
        if (deleted) {
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "플레이리스트가 삭제되었습니다."
            ));
        }
        return ResponseEntity.badRequest().body(Map.of(
            "success", false,
            "message", "삭제할 수 없습니다."
        ));
    }

    /**
     * 키워드로 이미지 검색 (Google Custom Search)
     */
    @GetMapping("/images/search")
    public ResponseEntity<?> searchImages(
            @RequestParam String keyword,
            @RequestParam(defaultValue = "5") int count) {
        try {
            Map<String, Object> result = imageSearchService.searchImagesByKeyword(keyword, count);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", "이미지 검색 실패: " + e.getMessage()
            ));
        }
    }
}
