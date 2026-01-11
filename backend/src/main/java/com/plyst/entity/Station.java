package com.plyst.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "stations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Station {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    
    @Column(nullable = false)
    private String title;
    
    @Column(name = "invite_code", nullable = false, unique = true, length = 20)
    private String inviteCode;
    
    @Column(name = "max_participants", nullable = false)
    private Integer maxParticipants;
    
    @Column(nullable = false, length = 30)
    private String status;
    
    @Column(name = "is_private", nullable = false)
    @Builder.Default
    private Boolean isPrivate = false;
    
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
