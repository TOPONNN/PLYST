package com.plyst.repository;

import com.plyst.entity.EmailVerification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface EmailVerificationRepository extends JpaRepository<EmailVerification, Integer> {
    
    @Query("SELECT ev FROM EmailVerification ev WHERE ev.email = :email AND ev.code = :code AND ev.expiresAt > :now AND ev.verifiedAt IS NULL")
    Optional<EmailVerification> findValidVerification(
            @Param("email") String email, 
            @Param("code") String code, 
            @Param("now") LocalDateTime now);
    
    Optional<EmailVerification> findTopByEmailOrderByIdDesc(String email);
    
    @Modifying
    @Query("DELETE FROM EmailVerification ev WHERE ev.expiresAt < :now")
    void deleteExpiredVerifications(@Param("now") LocalDateTime now);
    
    @Modifying
    @Query("DELETE FROM EmailVerification ev WHERE ev.email = :email AND ev.verifiedAt IS NULL")
    void deleteUnverifiedByEmail(@Param("email") String email);
}
