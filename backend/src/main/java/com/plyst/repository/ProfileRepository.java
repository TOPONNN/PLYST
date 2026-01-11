package com.plyst.repository;

import com.plyst.entity.Profile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ProfileRepository extends JpaRepository<Profile, Integer> {
    Optional<Profile> findByUserId(Integer userId);
    
    @Modifying
    @Query("DELETE FROM Profile p WHERE p.user.id = :userId")
    void deleteByUserId(@Param("userId") Integer userId);
}
