package com.plyst.repository;

import com.plyst.entity.Track;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TrackRepository extends JpaRepository<Track, Integer> {
    Optional<Track> findBySpotifyId(String spotifyId);
    Optional<Track> findByTitleAndArtist(String title, String artist);
}
