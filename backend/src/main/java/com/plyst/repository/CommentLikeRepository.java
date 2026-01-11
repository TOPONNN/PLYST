package com.plyst.repository;

import com.plyst.entity.CommentLike;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CommentLikeRepository extends JpaRepository<CommentLike, Integer> {
    Optional<CommentLike> findByUserIdAndCommentId(Integer userId, Integer commentId);
    boolean existsByUserIdAndCommentId(Integer userId, Integer commentId);
    void deleteByUserIdAndCommentId(Integer userId, Integer commentId);
    long countByCommentId(Integer commentId);
    List<CommentLike> findByUserId(Integer userId);
    
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM CommentLike cl WHERE cl.comment.id = :commentId")
    void deleteByCommentId(@Param("commentId") Integer commentId);
    
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM CommentLike cl WHERE cl.user.id = :userId")
    void deleteByUserId(@Param("userId") Integer userId);
}
