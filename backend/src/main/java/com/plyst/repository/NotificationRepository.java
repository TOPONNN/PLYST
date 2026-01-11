package com.plyst.repository;

import com.plyst.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    
    List<Notification> findByUserIdOrderByCreatedAtDesc(Long userId);
    
    List<Notification> findByUserIdAndIsReadFalseOrderByCreatedAtDesc(Long userId);
    
    long countByUserIdAndIsReadFalse(Long userId);
    
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM Notification n WHERE n.userId = :userId")
    void deleteByUserId(@Param("userId") Long userId);
}
