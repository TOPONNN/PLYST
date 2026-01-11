package com.plyst.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "station_playbacks")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class StationPlayback {
    @Id
    @Column(name = "station_id")
    private Integer stationId;
    
    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "station_id")
    private Station station;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "track_id", nullable = false)
    private Track track;
    
    @Column(name = "position_ms", nullable = false)
    private Integer positionMs;
    
    @Column(name = "is_playing", nullable = false)
    private Boolean isPlaying;
    
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
    
    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
