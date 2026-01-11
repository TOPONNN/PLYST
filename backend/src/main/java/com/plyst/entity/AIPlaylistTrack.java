package com.plyst.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "ai_playlist_tracks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AIPlaylistTrack {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String artist;

    @Column
    private String duration;

    @Column(name = "album_image")
    private String albumImage;

    @Column(name = "track_order")
    private int trackOrder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ai_playlist_id", nullable = false)
    private AIPlaylist aiPlaylist;
}
