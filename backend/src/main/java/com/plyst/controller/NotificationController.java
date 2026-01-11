package com.plyst.controller;

import com.plyst.dto.NotificationDto;
import com.plyst.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {
    
    private final NotificationService notificationService;
    
    /**
     * 사용자의 모든 알림 조회
     */
    @GetMapping("/{userId}")
    public ResponseEntity<List<NotificationDto.Response>> getNotifications(@PathVariable Long userId) {
        return ResponseEntity.ok(notificationService.getUserNotifications(userId));
    }
    
    /**
     * 읽지 않은 알림 개수 조회
     */
    @GetMapping("/{userId}/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(@PathVariable Long userId) {
        long count = notificationService.getUnreadCount(userId);
        return ResponseEntity.ok(Map.of("count", count));
    }
    
    /**
     * 알림 읽음 처리
     */
    @PatchMapping("/{notificationId}/read")
    public ResponseEntity<Void> markAsRead(@PathVariable Long notificationId) {
        notificationService.markAsRead(notificationId);
        return ResponseEntity.ok().build();
    }
    
    /**
     * 모든 알림 읽음 처리
     */
    @PatchMapping("/{userId}/read-all")
    public ResponseEntity<Void> markAllAsRead(@PathVariable Long userId) {
        notificationService.markAllAsRead(userId);
        return ResponseEntity.ok().build();
    }
    
    /**
     * 알림 삭제
     */
    @DeleteMapping("/{notificationId}")
    public ResponseEntity<Void> deleteNotification(@PathVariable Long notificationId) {
        notificationService.deleteNotification(notificationId);
        return ResponseEntity.ok().build();
    }
    
    /**
     * 모든 알림 삭제
     */
    @DeleteMapping("/user/{userId}")
    public ResponseEntity<Void> deleteAllNotifications(@PathVariable Long userId) {
        notificationService.deleteAllNotifications(userId);
        return ResponseEntity.ok().build();
    }
    
    /**
     * 테스트용: 알림 생성
     */
    @PostMapping("/test")
    public ResponseEntity<NotificationDto.Response> createTestNotification(@RequestBody NotificationDto.CreateRequest request) {
        NotificationDto.Response response = notificationService.createAndSendNotification(
                request.getUserId(),
                request.getType(),
                request.getTitle(),
                request.getMessage(),
                request.getAvatar(),
                request.getRelatedId()
        );
        return ResponseEntity.ok(response);
    }
}
