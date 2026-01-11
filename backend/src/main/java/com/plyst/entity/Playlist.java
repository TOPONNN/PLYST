package com.plyst.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "playlists")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Playlist {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;
    
    @Column(nullable = false)
    private String title;
    
    @Column(columnDefinition = "TEXT")
    private String description;
    
    @Column(name = "cover_image_url", columnDefinition = "LONGTEXT")
    private String coverImageUrl;
    
    @Column(name = "is_public", nullable = false)
    private Boolean isPublic;
    
    @Column(name = "is_draft", nullable = false)
    private Boolean isDraft;
    
    @Column(name = "external_link", length = 2048)
    private String externalLink;
    
    @Column(name = "external_provider", length = 30)
    private String externalProvider;
    
    @Column(name = "view_count", nullable = false)
    @Builder.Default
    private Integer viewCount = 0;
    
    @Column(name = "share_count", nullable = false)
    @Builder.Default
    private Integer shareCount = 0;
    
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
    
    @OneToMany(mappedBy = "playlist", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderNo ASC")
    @Builder.Default
    private List<PlaylistItem> items = new ArrayList<>();
    
    @ManyToMany
    @JoinTable(name = "playlist_tags",
            joinColumns = @JoinColumn(name = "playlist_id"),
            inverseJoinColumns = @JoinColumn(name = "tag_id"))
    @Builder.Default
    private List<Tag> tags = new ArrayList<>();
    
    @PrePersist
    protected void onCreate() {
        createdAt = updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
