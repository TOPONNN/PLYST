package com.plyst.repository;

import com.plyst.entity.PlaylistLike;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PlaylistLikeRepository extends JpaRepository<PlaylistLike, Integer> {
    Optional<PlaylistLike> findByUserIdAndPlaylistId(Integer userId, Integer playlistId);
    boolean existsByUserIdAndPlaylistId(Integer userId, Integer playlistId);
    void deleteByUserIdAndPlaylistId(Integer userId, Integer playlistId);
    long countByPlaylistId(Integer playlistId);
    void deleteByPlaylistId(Integer playlistId);
    long countByUserId(Integer userId);
    List<PlaylistLike> findByUserId(Integer userId);
    List<PlaylistLike> findByUserIdOrderByCreatedAtDesc(Integer userId);
    
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM PlaylistLike pl WHERE pl.user.id = :userId")
    void deleteByUserId(@Param("userId") Integer userId);
}
