package com.plyst.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    
    @Column(name = "user_id", nullable = false, unique = true, length = 50)
    private String userId;
    
    @Column(nullable = false, unique = true)
    private String email;
    
    private String password;
    
    @Column(nullable = false, length = 100)
    private String name;
    
    @Column(nullable = false, unique = true, length = 50)
    private String nickname;
    
    @Column(length = 30)
    private String phone;
    
    @Column(nullable = false, length = 30)
    private String status;
    
    @Column(nullable = false, length = 30)
    private String role;
    
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
    
    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;
    
    @Column(name = "dormant_at")
    private LocalDateTime dormantAt;
    
    @OneToOne(mappedBy = "user", fetch = FetchType.LAZY)
    private Profile profile;
    
    @PrePersist
    protected void onCreate() {
        createdAt = updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
