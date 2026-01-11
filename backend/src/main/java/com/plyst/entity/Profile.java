package com.plyst.entity;

import jakarta.persistence.*;
import lombok.*;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "profiles")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Profile {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;
    
    @Column(name = "image_url", columnDefinition = "LONGTEXT")
    private String imageUrl;
    
    @Column(columnDefinition = "TEXT")
    private String intro;
    
    @ElementCollection
    @CollectionTable(name = "profile_taste_tags", joinColumns = @JoinColumn(name = "profile_id"))
    @Column(name = "tag", length = 50)
    @Builder.Default
    private Set<String> tasteTags = new HashSet<>();
}
