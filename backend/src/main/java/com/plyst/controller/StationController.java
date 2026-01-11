package com.plyst.controller;

import com.plyst.dto.StationDto.*;
import com.plyst.service.StationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/stations")
@RequiredArgsConstructor
public class StationController {

    private final StationService stationService;
    private final StationStompController stationStompController;

    @GetMapping
    public ResponseEntity<List<StationListItemResponse>> getActiveStations() {
        return ResponseEntity.ok(stationService.getActiveStations());
    }

    @GetMapping("/{stationId}")
    public ResponseEntity<StationDetailResponse> getStationDetail(@PathVariable Integer stationId) {
        return ResponseEntity.ok(stationService.getStationDetail(stationId));
    }

    @PostMapping
    public ResponseEntity<CreateStationResponse> createStation(
            @RequestParam Integer userId,
            @RequestBody CreateStationRequest request) {
        return ResponseEntity.ok(stationService.createStation(userId, request));
    }

    @PostMapping("/join")
    public ResponseEntity<StationDetailResponse> joinStation(
            @RequestParam Integer userId,
            @RequestParam String inviteCode) {
        return ResponseEntity.ok(stationService.joinStation(userId, inviteCode));
    }

    @PostMapping("/{stationId}/leave")
    public ResponseEntity<Map<String, Object>> leaveStation(
            @PathVariable Integer stationId,
            @RequestParam Integer userId) {
        Integer newHostId = stationService.leaveStation(stationId, userId);
        if (newHostId != null) {
            stationStompController.broadcastHostChanged(stationId, newHostId);
            return ResponseEntity.ok(Map.of("newHostId", newHostId));
        }
        return ResponseEntity.ok(Map.of());
    }

    @PostMapping("/{stationId}/transfer-host")
    public ResponseEntity<Map<String, Object>> transferHost(
            @PathVariable Integer stationId,
            @RequestParam Integer userId,
            @RequestParam Integer newHostId) {
        Integer result = stationService.transferHost(stationId, userId, newHostId);
        stationStompController.broadcastHostChanged(stationId, newHostId);
        return ResponseEntity.ok(Map.of("success", true, "newHostId", result));
    }

    @PostMapping("/{stationId}/ban")
    public ResponseEntity<Map<String, Boolean>> banUser(
            @PathVariable Integer stationId,
            @RequestParam Integer userId,
            @RequestParam Integer targetUserId) {
        stationService.banUser(stationId, userId, targetUserId);
        stationStompController.notifyUserKicked(stationId, targetUserId, "banned");
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/{stationId}/unban")
    public ResponseEntity<Map<String, Boolean>> unbanUser(
            @PathVariable Integer stationId,
            @RequestParam Integer userId,
            @RequestParam Integer targetUserId) {
        stationService.unbanUser(stationId, userId, targetUserId);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @DeleteMapping("/{stationId}")
    public ResponseEntity<Void> deleteStation(
            @PathVariable Integer stationId,
            @RequestParam Integer userId) {
        stationStompController.notifyStationClosed(stationId);
        stationService.deleteStation(stationId, userId);
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/{stationId}/title")
    public ResponseEntity<Map<String, Object>> updateTitle(
            @PathVariable Integer stationId,
            @RequestParam Integer userId,
            @RequestBody Map<String, String> body) {
        String newTitle = body.get("title");
        if (newTitle == null || newTitle.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Title is required"));
        }
        String updatedTitle = stationService.updateTitle(stationId, userId, newTitle);
        stationStompController.broadcastTitleChanged(stationId, updatedTitle);
        return ResponseEntity.ok(Map.of("success", true, "title", updatedTitle));
    }
}
