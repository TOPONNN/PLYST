package com.plyst.repository;

import com.plyst.entity.StationParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface StationParticipantRepository extends JpaRepository<StationParticipant, Integer> {
    
    List<StationParticipant> findByStationId(Integer stationId);
    
    Optional<StationParticipant> findByStationIdAndUserId(Integer stationId, Integer userId);
    
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM StationParticipant sp WHERE sp.station.id = :stationId AND sp.user.id = :userId")
    void deleteByStationIdAndUserId(@Param("stationId") Integer stationId, @Param("userId") Integer userId);
    
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM StationParticipant sp WHERE sp.station.id = :stationId")
    void deleteByStationId(@Param("stationId") Integer stationId);
    
    long countByStationId(Integer stationId);
    
    boolean existsByStationIdAndUserId(Integer stationId, Integer userId);
    
    Optional<StationParticipant> findByStationIdAndRole(Integer stationId, String role);
    
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM StationParticipant sp WHERE sp.user.id = :userId")
    void deleteByUserId(@Param("userId") Integer userId);
}
