package com.plyst.repository;

import com.plyst.entity.AIPlaylistTrack;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AIPlaylistTrackRepository extends JpaRepository<AIPlaylistTrack, Long> {
    
    // 플레이리스트 ID로 트랙 조회 (순서대로)
    List<AIPlaylistTrack> findByAiPlaylistIdOrderByTrackOrder(Long aiPlaylistId);
    
    // 플레이리스트의 모든 트랙 삭제
    void deleteByAiPlaylistId(Long aiPlaylistId);
}
