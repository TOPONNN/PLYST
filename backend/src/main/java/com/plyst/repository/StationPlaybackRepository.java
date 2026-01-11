package com.plyst.repository;

import com.plyst.entity.StationPlayback;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface StationPlaybackRepository extends JpaRepository<StationPlayback, Integer> {
    
    Optional<StationPlayback> findByStationId(Integer stationId);
    
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM StationPlayback sp WHERE sp.station.id = :stationId")
    void deleteByStationId(@Param("stationId") Integer stationId);
}
