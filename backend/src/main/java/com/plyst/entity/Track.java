package com.plyst.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "tracks")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Track {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    
    @Column(nullable = false)
    private String title;
    
    @Column(nullable = false)
    private String artist;
    
    @Column(name = "duration_sec")
    private Integer durationSec;
    
    @Column(name = "album_name")
    private String albumName;
    
    @Column(name = "album_image", length = 500)
    private String albumImage;
    
    @Column(name = "spotify_id", length = 100)
    private String spotifyId;
}
