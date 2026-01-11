package com.plyst.controller;

import com.plyst.service.FollowService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/follow")
@RequiredArgsConstructor
public class FollowController {

    private final FollowService followService;

    // 팔로우/언팔로우 토글
    @PostMapping("/{targetUserId}")
    public ResponseEntity<Map<String, Object>> toggleFollow(
            @PathVariable Integer targetUserId,
            @RequestParam Integer userId) {
        boolean isFollowing = followService.toggleFollow(userId, targetUserId);
        long followerCount = followService.getFollowerCount(targetUserId);
        
        return ResponseEntity.ok(Map.of(
                "isFollowing", isFollowing,
                "followerCount", followerCount
        ));
    }

    // 팔로우 상태 조회
    @GetMapping("/{targetUserId}/status")
    public ResponseEntity<Map<String, Object>> getFollowStatus(
            @PathVariable Integer targetUserId,
            @RequestParam Integer userId) {
        boolean isFollowing = followService.isFollowing(userId, targetUserId);
        long followerCount = followService.getFollowerCount(targetUserId);
        
        return ResponseEntity.ok(Map.of(
                "isFollowing", isFollowing,
                "followerCount", followerCount
        ));
    }

    // 팔로워 수 조회
    @GetMapping("/{userId}/followers/count")
    public ResponseEntity<Long> getFollowerCount(@PathVariable Integer userId) {
        return ResponseEntity.ok(followService.getFollowerCount(userId));
    }

    // 팔로잉 수 조회
    @GetMapping("/{userId}/following/count")
    public ResponseEntity<Long> getFollowingCount(@PathVariable Integer userId) {
        return ResponseEntity.ok(followService.getFollowingCount(userId));
    }
}
