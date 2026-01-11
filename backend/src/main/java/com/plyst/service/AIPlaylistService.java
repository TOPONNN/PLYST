package com.plyst.service;

import com.plyst.dto.AIRecommendDto.*;
import com.plyst.entity.AIPlaylist;
import com.plyst.entity.AIPlaylistTrack;
import com.plyst.entity.User;
import com.plyst.repository.AIPlaylistRepository;
import com.plyst.repository.AIPlaylistTrackRepository;
import com.plyst.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class AIPlaylistService {

    private final AIPlaylistRepository aiPlaylistRepository;
    private final AIPlaylistTrackRepository aiPlaylistTrackRepository;
    private final UserRepository userRepository;

    /**
     * AI 추천 플레이리스트를 DB에 저장
     */
    @Transactional
    public AIPlaylist savePlaylist(Long userId, RecommendedPlaylist playlist) {
        User user = null;
        if (userId != null) {
            user = userRepository.findById(userId.intValue()).orElse(null);
        }

        // 플레이리스트 생성
        AIPlaylist aiPlaylist = AIPlaylist.builder()
                .title(playlist.getTitle())
                .description(playlist.getDescription())
                .coverImage(playlist.getCoverImage())
                .coverGradient(playlist.getCoverGradient())
                .trackCount(playlist.getTracks().size())
                .user(user)
                .build();
        
        // 태그 설정
        if (playlist.getTags() != null && !playlist.getTags().isEmpty()) {
            aiPlaylist.setTagList(playlist.getTags());
        }

        AIPlaylist savedPlaylist = aiPlaylistRepository.save(aiPlaylist);

        // 트랙들 저장
        List<AIPlaylistTrack> tracks = new ArrayList<>();
        int order = 0;
        for (TrackInfo trackInfo : playlist.getTracks()) {
            AIPlaylistTrack track = AIPlaylistTrack.builder()
                    .title(trackInfo.getTitle())
                    .artist(trackInfo.getArtist())
                    .duration(trackInfo.getDuration())
                    .albumImage(trackInfo.getAlbumImage())
                    .trackOrder(order++)
                    .aiPlaylist(savedPlaylist)
                    .build();
            tracks.add(track);
        }
        aiPlaylistTrackRepository.saveAll(tracks);
        savedPlaylist.setTracks(tracks);

        log.info("AI 플레이리스트 저장 완료: {} (ID: {})", savedPlaylist.getTitle(), savedPlaylist.getId());
        return savedPlaylist;
    }

    /**
     * 사용자의 AI 추천 플레이리스트 목록 조회
     */
    @Transactional(readOnly = true)
    public List<RecommendedPlaylist> getUserPlaylists(Long userId) {
        List<AIPlaylist> playlists = aiPlaylistRepository.findByUserIdOrderByCreatedAtDesc(userId.intValue());
        return playlists.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    /**
     * 모든 AI 추천 플레이리스트 조회 (최신순)
     */
    @Transactional(readOnly = true)
    public List<RecommendedPlaylist> getAllPlaylists() {
        List<AIPlaylist> playlists = aiPlaylistRepository.findAll();
        playlists.sort((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()));
        return playlists.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    /**
     * 특정 AI 플레이리스트 조회
     */
    @Transactional(readOnly = true)
    public RecommendedPlaylist getPlaylist(Long playlistId) {
        return aiPlaylistRepository.findById(playlistId)
                .map(this::convertToDto)
                .orElse(null);
    }

    /**
     * AI 플레이리스트 삭제
     */
    @Transactional
    public boolean deletePlaylist(Long playlistId, Long userId) {
        return aiPlaylistRepository.findById(playlistId)
                .map(playlist -> {
                    // 소유자 확인 (userId가 null이면 확인 생략)
                    if (userId != null && playlist.getUser() != null 
                            && !playlist.getUser().getId().equals(userId.intValue())) {
                        return false;
                    }
                    aiPlaylistRepository.delete(playlist);
                    log.info("AI 플레이리스트 삭제 완료: ID {}", playlistId);
                    return true;
                })
                .orElse(false);
    }

    /**
     * Entity를 DTO로 변환
     */
    private RecommendedPlaylist convertToDto(AIPlaylist entity) {
        List<TrackInfo> tracks = entity.getTracks().stream()
                .sorted((a, b) -> Integer.compare(a.getTrackOrder(), b.getTrackOrder()))
                .map(track -> TrackInfo.builder()
                        .title(track.getTitle())
                        .artist(track.getArtist())
                        .duration(track.getDuration())
                        .albumImage(track.getAlbumImage())
                        .build())
                .collect(Collectors.toList());

        return RecommendedPlaylist.builder()
                .id(entity.getId().toString())
                .title(entity.getTitle())
                .description(entity.getDescription())
                .coverImage(entity.getCoverImage())
                .coverGradient(entity.getCoverGradient())
                .trackCount(entity.getTrackCount())
                .tags(entity.getTagList())
                .tracks(tracks)
                .build();
    }
}
