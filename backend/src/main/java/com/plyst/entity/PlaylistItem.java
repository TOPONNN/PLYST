package com.plyst.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "playlist_items")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PlaylistItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "playlist_id", nullable = false)
    private Playlist playlist;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "track_id", nullable = false)
    private Track track;
    
    @Column(name = "order_no", nullable = false)
    private Integer orderNo;
}
