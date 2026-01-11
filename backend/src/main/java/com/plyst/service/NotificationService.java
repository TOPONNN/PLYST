package com.plyst.service;

import com.plyst.dto.NotificationDto;
import com.plyst.entity.Notification;
import com.plyst.repository.NotificationRepository;
import com.plyst.repository.ProfileRepository;
import com.plyst.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class NotificationService {
    
    private final NotificationRepository notificationRepository;
    private final WebSocketHandler webSocketHandler;
    private final ProfileRepository profileRepository;
    private final UserRepository userRepository;
    
    /**
     * 알림 생성 및 실시간 전송
     */
    @Transactional
    public NotificationDto.Response createAndSendNotification(Long userId, String type, String title, String message, String avatar, Long relatedId) {
        Notification notification = Notification.builder()
                .userId(userId)
                .type(type)
                .title(title)
                .message(message)
                .avatar(avatar)
                .relatedId(relatedId)
                .isRead(false)
                .createdAt(LocalDateTime.now())
                .build();
        
        notification = notificationRepository.save(notification);
        NotificationDto.Response response = toResponse(notification);
        
        // 실시간으로 WebSocket 전송
        webSocketHandler.sendNotificationToUser(userId, NotificationDto.WebSocketMessage.builder()
                .type("new_notification")
                .notification(response)
                .build());
        
        log.info("알림 생성 및 전송 - userId: {}, type: {}", userId, type);
        return response;
    }
    
    /**
     * 사용자의 모든 알림 조회
     */
    @Transactional(readOnly = true)
    public List<NotificationDto.Response> getUserNotifications(Long userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }
    
    /**
     * 읽지 않은 알림 개수
     */
    @Transactional(readOnly = true)
    public long getUnreadCount(Long userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }
    
    /**
     * 알림 읽음 처리
     */
    @Transactional
    public void markAsRead(Long notificationId) {
        notificationRepository.findById(notificationId).ifPresent(notification -> {
            notification.setRead(true);
            notificationRepository.save(notification);
        });
    }
    
    /**
     * 모든 알림 읽음 처리
     */
    @Transactional
    public void markAllAsRead(Long userId) {
        List<Notification> unreadNotifications = notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId);
        unreadNotifications.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(unreadNotifications);
    }
    
    /**
     * 알림 삭제
     */
    @Transactional
    public void deleteNotification(Long notificationId) {
        notificationRepository.deleteById(notificationId);
    }
    
    /**
     * 모든 알림 삭제
     */
    @Transactional
    public void deleteAllNotifications(Long userId) {
        List<Notification> notifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
        notificationRepository.deleteAll(notifications);
    }
    
    // ========== 알림 생성 헬퍼 메서드 ==========
    
    /**
     * 좋아요 알림
     */
    public void sendLikeNotification(Long targetUserId, String likerName, String playlistName, Long playlistId) {
        // 좋아요 누른 사용자의 프로필 이미지 조회
        String avatarUrl = getAvatarByNickname(likerName);
        createAndSendNotification(
                targetUserId,
                "like",
                likerName,
                "님이 '" + playlistName + "' 플레이리스트를 좋아합니다.",
                avatarUrl != null ? avatarUrl : "❤️",
                playlistId
        );
    }
    
    /**
     * 댓글 알림
     */
    public void sendCommentNotification(Long targetUserId, String commenterName, String commentPreview, Long playlistId) {
        String preview = commentPreview.length() > 30 ? commentPreview.substring(0, 30) + "..." : commentPreview;
        // 댓글 작성자의 프로필 이미지 조회
        String avatarUrl = getAvatarByNickname(commenterName);
        createAndSendNotification(
                targetUserId,
                "comment",
                commenterName,
                "님이 댓글을 남겼습니다: \"" + preview + "\"",
                avatarUrl != null ? avatarUrl : "💬",
                playlistId
        );
    }
    
    /**
     * 팔로우 알림
     */
    public void sendFollowNotification(Long targetUserId, String followerName) {
        // 팔로워의 프로필 이미지 조회
        String avatarUrl = getAvatarByNickname(followerName);
        createAndSendNotification(
                targetUserId,
                "follow",
                followerName,
                "님이 회원님을 팔로우하기 시작했습니다.",
                avatarUrl != null ? avatarUrl : "👤",
                null
        );
    }
    
    /**
     * 새 플레이리스트 알림 (팔로워들에게)
     */
    public void sendNewPlaylistNotification(Long targetUserId, String creatorName, String playlistName, Long playlistId) {
        // 플레이리스트 작성자의 프로필 이미지 조회
        String avatarUrl = getAvatarByNickname(creatorName);
        createAndSendNotification(
                targetUserId,
                "playlist",
                creatorName,
                "님이 새 플레이리스트 '" + playlistName + "'을 공유했습니다.",
                avatarUrl != null ? avatarUrl : "🎵",
                playlistId
        );
    }
    
    /**
     * AI 추천 알림
     */
    public void sendAIRecommendNotification(Long userId) {
        createAndSendNotification(
                userId,
                "ai",
                "AI 추천",
                "새로운 추천 플레이리스트가 준비되었습니다!",
                "✨",
                null
        );
    }
    
    private NotificationDto.Response toResponse(Notification notification) {
        return NotificationDto.Response.builder()
                .id(notification.getId())
                .type(notification.getType())
                .title(notification.getTitle())
                .message(notification.getMessage())
                .avatar(notification.getAvatar())
                .isRead(notification.isRead())
                .relatedId(notification.getRelatedId())
                .time(formatRelativeTime(notification.getCreatedAt()))
                .createdAt(notification.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")))
                .build();
    }
    
    private String formatRelativeTime(LocalDateTime dateTime) {
        LocalDateTime now = LocalDateTime.now();
        long minutes = ChronoUnit.MINUTES.between(dateTime, now);
        
        if (minutes < 1) return "방금 전";
        if (minutes < 60) return minutes + "분 전";
        
        long hours = ChronoUnit.HOURS.between(dateTime, now);
        if (hours < 24) return hours + "시간 전";
        
        long days = ChronoUnit.DAYS.between(dateTime, now);
        if (days < 7) return days + "일 전";
        
        return dateTime.format(DateTimeFormatter.ofPattern("MM월 dd일"));
    }
    
    /**
     * 닉네임으로 프로필 이미지 URL 조회
     */
    private String getAvatarByNickname(String nickname) {
        return userRepository.findByNickname(nickname)
                .flatMap(user -> profileRepository.findByUserId(user.getId()))
                .map(profile -> profile.getImageUrl())
                .orElse(null);
    }
}
