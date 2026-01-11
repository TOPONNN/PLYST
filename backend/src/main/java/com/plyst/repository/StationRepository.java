package com.plyst.repository;

import com.plyst.entity.Station;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StationRepository extends JpaRepository<Station, Integer> {
    Optional<Station> findByInviteCode(String inviteCode);
    List<Station> findByStatus(String status);
    List<Station> findByStatusOrderByCreatedAtDesc(String status);
}
