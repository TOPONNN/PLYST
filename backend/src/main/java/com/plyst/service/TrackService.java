package com.plyst.service;

import com.plyst.dto.TrackDto.LikedTrackResponse;
import com.plyst.dto.TrackDto.TrackLikeResponse;
import com.plyst.entity.Track;
import com.plyst.entity.TrackLike;
import com.plyst.entity.User;
import com.plyst.repository.TrackLikeRepository;
import com.plyst.repository.TrackRepository;
import com.plyst.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
@SuppressWarnings("null")
public class TrackService {

    private final TrackRepository trackRepository;
    private final TrackLikeRepository trackLikeRepository;
    private final UserRepository userRepository;

    // 트랙 좋아요 토글
    public boolean toggleTrackLike(Integer userId, Integer trackId) {
        if (trackLikeRepository.existsByUserIdAndTrackId(userId, trackId)) {
            trackLikeRepository.deleteByUserIdAndTrackId(userId, trackId);
            return false;
        } else {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));
            Track track = trackRepository.findById(trackId)
                    .orElseThrow(() -> new RuntimeException("Track not found"));
            
            TrackLike like = TrackLike.builder()
                    .user(user)
                    .track(track)
                    .build();
            trackLikeRepository.save(like);
            return true;
        }
    }

    // 트랙 좋아요 by title & artist (트랙이 없으면 생성)
    public TrackLikeResponse toggleTrackLikeByInfo(Integer userId, String title, String artist, String albumImage) {
        Track track = trackRepository.findByTitleAndArtist(title, artist)
                .orElseGet(() -> trackRepository.save(Track.builder()
                        .title(title)
                        .artist(artist)
                        .albumImage(albumImage)
                        .durationSec(0)
                        .build()));
        
        boolean isLiked = toggleTrackLike(userId, track.getId());
        long likeCount = trackLikeRepository.countByTrackId(track.getId());
        
        return TrackLikeResponse.builder()
                .trackId(track.getId())
                .isLiked(isLiked)
                .likeCount(likeCount)
                .build();
    }

    // 사용자의 좋아요한 트랙 목록
    @Transactional(readOnly = true)
    public List<LikedTrackResponse> getUserLikedTracks(Integer userId) {
        return trackLikeRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(like -> LikedTrackResponse.builder()
                        .id(like.getTrack().getId())
                        .title(like.getTrack().getTitle())
                        .artist(like.getTrack().getArtist())
                        .albumImage(like.getTrack().getAlbumImage())
                        .durationSec(like.getTrack().getDurationSec())
                        .likedAt(like.getCreatedAt().toString())
                        .build())
                .toList();
    }

    // 트랙 좋아요 상태 확인
    @Transactional(readOnly = true)
    public boolean isTrackLiked(Integer userId, Integer trackId) {
        return trackLikeRepository.existsByUserIdAndTrackId(userId, trackId);
    }

    // title과 artist로 좋아요 상태 확인
    @Transactional(readOnly = true)
    public boolean isTrackLikedByInfo(Integer userId, String title, String artist) {
        return trackRepository.findByTitleAndArtist(title, artist)
                .map(track -> trackLikeRepository.existsByUserIdAndTrackId(userId, track.getId()))
                .orElse(false);
    }
}
