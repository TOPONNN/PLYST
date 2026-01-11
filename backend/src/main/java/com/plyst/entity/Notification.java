package com.plyst.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "notifications")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Notification {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private Long userId;  // 알림 받는 사용자
    
    @Column(nullable = false)
    private String type;  // like, comment, follow, playlist, ai
    
    @Column(nullable = false)
    private String title;
    
    @Column(nullable = false, length = 500)
    private String message;
    
    @Column(columnDefinition = "LONGTEXT")
    private String avatar;
    
    @Column(name = "is_read", nullable = false)
    private boolean isRead;
    
    private Long relatedId;  // 관련 플레이리스트/댓글 ID 등
    
    @Column(nullable = false)
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        isRead = false;
    }
}
