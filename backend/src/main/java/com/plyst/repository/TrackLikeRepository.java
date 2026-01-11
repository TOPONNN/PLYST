package com.plyst.repository;

import com.plyst.entity.TrackLike;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TrackLikeRepository extends JpaRepository<TrackLike, Integer> {
    Optional<TrackLike> findByUserIdAndTrackId(Integer userId, Integer trackId);
    boolean existsByUserIdAndTrackId(Integer userId, Integer trackId);
    void deleteByUserIdAndTrackId(Integer userId, Integer trackId);
    long countByTrackId(Integer trackId);
    List<TrackLike> findByUserIdOrderByCreatedAtDesc(Integer userId);
    
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM TrackLike tl WHERE tl.user.id = :userId")
    void deleteByUserId(@Param("userId") Integer userId);
}
