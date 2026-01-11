package com.plyst.repository;

import com.plyst.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Integer> {
    Optional<User> findByEmail(String email);
    Optional<User> findByNickname(String nickname);
    Optional<User> findByUserId(String userId);
    boolean existsByEmail(String email);
    boolean existsByNickname(String nickname);
    boolean existsByUserId(String userId);
}
