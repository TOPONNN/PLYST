package com.plyst.repository;

import com.plyst.entity.Playlist;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PlaylistRepository extends JpaRepository<Playlist, Integer> {
    List<Playlist> findByOwnerId(Integer ownerId);
    
    long countByOwnerId(Integer ownerId);
    
    List<Playlist> findByOwnerIdOrderByCreatedAtDesc(Integer ownerId);
    
    List<Playlist> findByIsPublicTrueOrderByCreatedAtDesc();
    
    Page<Playlist> findByIsPublicTrueAndIsDraftFalse(Pageable pageable);
    
    @Query("SELECT p FROM Playlist p WHERE p.isPublic = true AND p.isDraft = false AND " +
           "(LOWER(p.title) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(p.description) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<Playlist> searchByKeyword(@Param("keyword") String keyword, Pageable pageable);
    
    @Query("SELECT p FROM Playlist p JOIN p.tags t WHERE t.name = :tagName AND p.isPublic = true AND p.isDraft = false")
    List<Playlist> findByTagName(@Param("tagName") String tagName);
}
