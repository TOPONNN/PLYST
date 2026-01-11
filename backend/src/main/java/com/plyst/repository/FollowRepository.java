package com.plyst.repository;

import com.plyst.entity.Follow;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FollowRepository extends JpaRepository<Follow, Integer> {
    List<Follow> findByFollowerId(Integer followerId);
    List<Follow> findByFollowingId(Integer followingId);
    Optional<Follow> findByFollowerIdAndFollowingId(Integer followerId, Integer followingId);
    boolean existsByFollowerIdAndFollowingId(Integer followerId, Integer followingId);
    long countByFollowerId(Integer followerId);
    long countByFollowingId(Integer followingId);
    
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM Follow f WHERE f.follower.id = :followerId")
    void deleteByFollowerId(@Param("followerId") Integer followerId);
    
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM Follow f WHERE f.following.id = :followingId")
    void deleteByFollowingId(@Param("followingId") Integer followingId);
}
