package com.plyst.repository;

import com.plyst.entity.StationBan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface StationBanRepository extends JpaRepository<StationBan, Integer> {
    
    List<StationBan> findByStationId(Integer stationId);
    
    Optional<StationBan> findByStationIdAndUserId(Integer stationId, Integer userId);
    
    boolean existsByStationIdAndUserId(Integer stationId, Integer userId);
    
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM StationBan sb WHERE sb.station.id = :stationId AND sb.user.id = :userId")
    void deleteByStationIdAndUserId(@Param("stationId") Integer stationId, @Param("userId") Integer userId);
    
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM StationBan sb WHERE sb.station.id = :stationId")
    void deleteByStationId(@Param("stationId") Integer stationId);
    
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM StationBan sb WHERE sb.user.id = :userId")
    void deleteByUserId(@Param("userId") Integer userId);
}
