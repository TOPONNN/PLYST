package com.plyst.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "station_bans")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class StationBan {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "station_id", nullable = false)
    private Station station;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    
    @Column(name = "banned_at", nullable = false)
    private LocalDateTime bannedAt;
    
    @PrePersist
    protected void onCreate() {
        bannedAt = LocalDateTime.now();
    }
}
