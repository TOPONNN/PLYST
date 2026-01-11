package com.plyst.repository;

import com.plyst.entity.AIPlaylist;
import com.plyst.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AIPlaylistRepository extends JpaRepository<AIPlaylist, Long> {
    
    // 사용자별 AI 플레이리스트 조회
    List<AIPlaylist> findByUserOrderByCreatedAtDesc(User user);
    
    // 사용자 ID로 AI 플레이리스트 조회
    List<AIPlaylist> findByUserIdOrderByCreatedAtDesc(Integer userId);
}
