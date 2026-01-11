package com.plyst.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "oauth_accounts")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OAuthAccount {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    
    @Column(nullable = false, length = 30)
    private String provider;
    
    @Column(name = "provider_user_id", nullable = false)
    private String providerUserId;
    
    @Column(name = "linked_at", nullable = false)
    private LocalDateTime linkedAt;
}
