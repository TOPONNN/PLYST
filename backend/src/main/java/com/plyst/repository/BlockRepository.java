package com.plyst.repository;

import com.plyst.entity.Block;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface BlockRepository extends JpaRepository<Block, Integer> {
    List<Block> findByBlockerId(Integer blockerId);
    List<Block> findByBlockedId(Integer blockedId);
    Optional<Block> findByBlockerIdAndBlockedId(Integer blockerId, Integer blockedId);
    boolean existsByBlockerIdAndBlockedId(Integer blockerId, Integer blockedId);
    long countByBlockerId(Integer blockerId);
    long countByBlockedId(Integer blockedId);
    void deleteByBlockerIdAndBlockedId(Integer blockerId, Integer blockedId);
    
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM Block b WHERE b.blocker.id = :blockerId")
    void deleteByBlockerId(@Param("blockerId") Integer blockerId);
    
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM Block b WHERE b.blocked.id = :blockedId")
    void deleteByBlockedId(@Param("blockedId") Integer blockedId);
}
