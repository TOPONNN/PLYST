package com.plyst.service;

import com.plyst.entity.Comment;
import com.plyst.entity.CommentLike;
import com.plyst.entity.Playlist;
import com.plyst.entity.PlaylistLike;
import com.plyst.entity.Track;
import com.plyst.entity.TrackLike;
import com.plyst.entity.User;
import com.plyst.repository.CommentLikeRepository;
import com.plyst.repository.CommentRepository;
import com.plyst.repository.PlaylistLikeRepository;
import com.plyst.repository.PlaylistRepository;
import com.plyst.repository.TrackLikeRepository;
import com.plyst.repository.TrackRepository;
import com.plyst.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Transactional
@SuppressWarnings("null")
public class LikeService {

    private final PlaylistLikeRepository playlistLikeRepository;
    private final CommentLikeRepository commentLikeRepository;
    private final TrackLikeRepository trackLikeRepository;
    private final PlaylistRepository playlistRepository;
    private final CommentRepository commentRepository;
    private final TrackRepository trackRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    
    private static final Set<String> sentLikeNotifications = ConcurrentHashMap.newKeySet();

    // ===== 플레이리스트 좋아요 =====
    
    public boolean togglePlaylistLike(Integer userId, Integer playlistId) {
        Optional<PlaylistLike> existingLike = playlistLikeRepository.findByUserIdAndPlaylistId(userId, playlistId);
        
        if (existingLike.isPresent()) {
            playlistLikeRepository.delete(existingLike.get());
            playlistLikeRepository.flush();
            return false;
        }
        
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Playlist playlist = playlistRepository.findById(playlistId)
                .orElseThrow(() -> new RuntimeException("Playlist not found"));
        
        PlaylistLike like = PlaylistLike.builder()
                .user(user)
                .playlist(playlist)
                .build();
        
        try {
            playlistLikeRepository.saveAndFlush(like);
        } catch (Exception e) {
            return playlistLikeRepository.existsByUserIdAndPlaylistId(userId, playlistId);
        }
        
        if (!playlist.getOwner().getId().equals(userId)) {
            String notifKey = userId + ":" + playlistId;
            if (sentLikeNotifications.add(notifKey)) {
                notificationService.sendLikeNotification(
                        playlist.getOwner().getId().longValue(),
                        user.getNickname(),
                        playlist.getTitle(),
                        playlist.getId().longValue()
                );
            }
        }
        
        return true;
    }
    
    public boolean isPlaylistLiked(Integer userId, Integer playlistId) {
        return playlistLikeRepository.existsByUserIdAndPlaylistId(userId, playlistId);
    }
    
    public long getPlaylistLikeCount(Integer playlistId) {
        return playlistLikeRepository.countByPlaylistId(playlistId);
    }
    
    public List<PlaylistLike> getUserLikedPlaylists(Integer userId) {
        return playlistLikeRepository.findByUserId(userId);
    }
    
    public List<Map<String, Object>> getUserLikedPlaylistsInfo(Integer userId) {
        return playlistLikeRepository.findByUserId(userId).stream()
                .map(like -> {
                    Map<String, Object> map = new HashMap<>();
                    Playlist p = like.getPlaylist();
                    map.put("id", p.getId());
                    map.put("title", p.getTitle());
                    map.put("owner", p.getOwner().getNickname());
                    map.put("trackCount", p.getItems() != null ? p.getItems().size() : 0);
                    map.put("coverGradient", "from-purple-500 to-pink-500");
                    map.put("likedAt", like.getCreatedAt().toString());
                    return map;
                })
                .toList();
    }

    // ===== 댓글 좋아요 =====
    
    public boolean toggleCommentLike(Integer userId, Integer commentId) {
        if (commentLikeRepository.existsByUserIdAndCommentId(userId, commentId)) {
            commentLikeRepository.deleteByUserIdAndCommentId(userId, commentId);
            return false; // 좋아요 취소됨
        } else {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));
            Comment comment = commentRepository.findById(commentId)
                    .orElseThrow(() -> new RuntimeException("Comment not found"));
            
            CommentLike like = CommentLike.builder()
                    .user(user)
                    .comment(comment)
                    .build();
            commentLikeRepository.save(like);
            return true; // 좋아요됨
        }
    }
    
    public boolean isCommentLiked(Integer userId, Integer commentId) {
        return commentLikeRepository.existsByUserIdAndCommentId(userId, commentId);
    }
    
    public long getCommentLikeCount(Integer commentId) {
        return commentLikeRepository.countByCommentId(commentId);
    }
    
    public List<Map<String, Object>> getUserLikedCommentsInfo(Integer userId) {
        return commentLikeRepository.findByUserId(userId).stream()
                .map(like -> {
                    Map<String, Object> map = new HashMap<>();
                    Comment c = like.getComment();
                    map.put("id", c.getId());
                    map.put("content", c.getContent());
                    map.put("author", c.getUser().getNickname());
                    map.put("playlistTitle", c.getPlaylist().getTitle());
                    map.put("likedAt", like.getCreatedAt().toString());
                    return map;
                })
                .toList();
    }

    // ===== 트랙 좋아요 =====
    
    public boolean toggleTrackLike(Integer userId, String title, String artist) {
        Track track = trackRepository.findByTitleAndArtist(title, artist)
                .orElseGet(() -> {
                    Track newTrack = Track.builder()
                            .title(title)
                            .artist(artist)
                            .build();
                    return trackRepository.save(newTrack);
                });
        
        if (trackLikeRepository.existsByUserIdAndTrackId(userId, track.getId())) {
            trackLikeRepository.deleteByUserIdAndTrackId(userId, track.getId());
            return false; // 좋아요 취소됨
        } else {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));
            
            TrackLike like = TrackLike.builder()
                    .user(user)
                    .track(track)
                    .build();
            trackLikeRepository.save(like);
            return true; // 좋아요됨
        }
    }
    
    public boolean isTrackLiked(Integer userId, String title, String artist) {
        return trackRepository.findByTitleAndArtist(title, artist)
                .map(track -> trackLikeRepository.existsByUserIdAndTrackId(userId, track.getId()))
                .orElse(false);
    }
    
    public List<Map<String, Object>> getUserLikedTracksInfo(Integer userId) {
        return trackLikeRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(like -> {
                    Map<String, Object> map = new HashMap<>();
                    Track t = like.getTrack();
                    map.put("title", t.getTitle());
                    map.put("artist", t.getArtist());
                    map.put("albumImage", t.getAlbumImage());
                    map.put("duration", t.getDurationSec() != null ? 
                        String.format("%d:%02d", t.getDurationSec() / 60, t.getDurationSec() % 60) : "");
                    map.put("likedAt", like.getCreatedAt().toString());
                    return map;
                })
                .toList();
    }
}
