package com.plyst.controller;

import com.plyst.dto.BlockDto;
import com.plyst.service.BlockService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/block")
@RequiredArgsConstructor
public class BlockController {

    private final BlockService blockService;

    @PostMapping("/{targetUserId}")
    public ResponseEntity<Map<String, Object>> toggleBlock(
            @PathVariable Integer targetUserId,
            @RequestParam Integer userId,
            @RequestParam(required = false) String reason) {
        boolean isBlocked = blockService.toggleBlock(userId, targetUserId, reason);
        long blockedCount = blockService.getBlockedCount(userId);
        
        return ResponseEntity.ok(Map.of(
                "isBlocked", isBlocked,
                "blockedCount", blockedCount
        ));
    }

    @PostMapping("/{targetUserId}/block")
    public ResponseEntity<Map<String, Object>> blockUser(
            @PathVariable Integer targetUserId,
            @RequestParam Integer userId,
            @RequestParam(required = false) String reason) {
        boolean success = blockService.blockUser(userId, targetUserId, reason);
        
        return ResponseEntity.ok(Map.of(
                "success", success,
                "isBlocked", true,
                "message", success ? "사용자를 차단했습니다." : "이미 차단된 사용자입니다."
        ));
    }

    @DeleteMapping("/{targetUserId}")
    public ResponseEntity<Map<String, Object>> unblockUser(
            @PathVariable Integer targetUserId,
            @RequestParam Integer userId) {
        boolean success = blockService.unblockUser(userId, targetUserId);
        
        return ResponseEntity.ok(Map.of(
                "success", success,
                "isBlocked", false,
                "message", success ? "차단을 해제했습니다." : "차단되어 있지 않은 사용자입니다."
        ));
    }

    @GetMapping("/{targetUserId}/status")
    public ResponseEntity<Map<String, Object>> getBlockStatus(
            @PathVariable Integer targetUserId,
            @RequestParam Integer userId) {
        boolean isBlocked = blockService.isBlocked(userId, targetUserId);
        boolean isBlockedByTarget = blockService.isBlocked(targetUserId, userId);
        
        return ResponseEntity.ok(Map.of(
                "isBlocked", isBlocked,
                "isBlockedByTarget", isBlockedByTarget
        ));
    }

    @GetMapping("/list")
    public ResponseEntity<List<BlockDto.BlockedUserResponse>> getBlockedUsers(
            @RequestParam Integer userId) {
        return ResponseEntity.ok(blockService.getBlockedUsersWithDetails(userId));
    }

    @GetMapping("/count")
    public ResponseEntity<Long> getBlockedCount(@RequestParam Integer userId) {
        return ResponseEntity.ok(blockService.getBlockedCount(userId));
    }
}
