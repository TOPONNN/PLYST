package com.plyst.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "ai_playlists")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AIPlaylist {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "cover_image")
    private String coverImage;

    @Column(name = "cover_gradient")
    private String coverGradient;

    @Column(name = "track_count")
    private int trackCount;

    // 태그들 (쉼표로 구분하여 저장)
    @Column(columnDefinition = "TEXT")
    private String tags;

    // 플레이리스트를 생성한 사용자
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    // 플레이리스트의 트랙들
    @OneToMany(mappedBy = "aiPlaylist", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<AIPlaylistTrack> tracks = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    // 태그 문자열을 리스트로 변환
    public List<String> getTagList() {
        if (tags == null || tags.isEmpty()) {
            return new ArrayList<>();
        }
        return List.of(tags.split(","));
    }

    // 리스트를 태그 문자열로 변환
    public void setTagList(List<String> tagList) {
        this.tags = String.join(",", tagList);
    }
}
