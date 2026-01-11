package com.plyst.repository;

import com.plyst.entity.Comment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CommentRepository extends JpaRepository<Comment, Integer> {
    List<Comment> findByPlaylistIdAndParentIsNullOrderByCreatedAtDesc(Integer playlistId);
    List<Comment> findByPlaylistIdAndParentIsNullAndStatusOrderByCreatedAtDesc(Integer playlistId, String status);
    List<Comment> findByParentIdOrderByCreatedAtAsc(Integer parentId);
    List<Comment> findByParentIdAndStatusOrderByCreatedAtAsc(Integer parentId, String status);
    long countByPlaylistId(Integer playlistId);
    long countByPlaylistIdAndStatus(Integer playlistId, String status);
    
    List<Comment> findByUserIdAndStatusOrderByCreatedAtDesc(Integer userId, String status);
    long countByUserIdAndStatus(Integer userId, String status);
    
    List<Comment> findByPlaylistId(Integer playlistId);
    
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM Comment c WHERE c.playlist.id = :playlistId")
    void deleteByPlaylistId(@Param("playlistId") Integer playlistId);
    
    List<Comment> findByUserId(Integer userId);
    
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM Comment c WHERE c.user.id = :userId")
    void deleteByUserId(@Param("userId") Integer userId);
}
