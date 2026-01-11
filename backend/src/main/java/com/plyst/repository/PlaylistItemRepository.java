package com.plyst.repository;

import com.plyst.entity.PlaylistItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PlaylistItemRepository extends JpaRepository<PlaylistItem, Integer> {
    List<PlaylistItem> findByPlaylistIdOrderByOrderNoAsc(Integer playlistId);
    Optional<PlaylistItem> findByPlaylistIdAndTrackId(Integer playlistId, Integer trackId);
    void deleteByPlaylistIdAndId(Integer playlistId, Integer itemId);
    int countByPlaylistId(Integer playlistId);
}
