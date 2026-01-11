package com.plyst.service;

import com.plyst.dto.PlaylistDto.AddTrackRequest;
import com.plyst.dto.PlaylistDto.CreatePlaylistRequest;
import com.plyst.dto.PlaylistDto.CreateTrackRequest;
import com.plyst.dto.PlaylistDto.OwnerInfo;
import com.plyst.dto.PlaylistDto.PlaylistDetailResponse;
import com.plyst.dto.PlaylistDto.PlaylistResponse;
import com.plyst.dto.PlaylistDto.TrackInfo;
import com.plyst.dto.PlaylistDto.UpdatePlaylistRequest;
import com.plyst.dto.PlaylistDto.UpdateTrackRequest;
import com.plyst.entity.Playlist;
import com.plyst.entity.PlaylistItem;
import com.plyst.entity.Tag;
import com.plyst.entity.Track;
import com.plyst.entity.User;
import com.plyst.repository.CommentLikeRepository;
import com.plyst.repository.CommentRepository;
import com.plyst.repository.PlaylistItemRepository;
import com.plyst.repository.PlaylistLikeRepository;
import com.plyst.repository.PlaylistRepository;
import com.plyst.repository.ShortUrlRepository;
import com.plyst.repository.TagRepository;
import com.plyst.repository.TrackRepository;
import com.plyst.repository.UserRepository;
import com.plyst.repository.FollowRepository;
import com.plyst.repository.BlockRepository;
import com.plyst.dto.BroadcastDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
@SuppressWarnings("null")
public class PlaylistService {

    private final PlaylistRepository playlistRepository;
    private final PlaylistLikeRepository playlistLikeRepository;
    private final PlaylistItemRepository playlistItemRepository;
    private final CommentRepository commentRepository;
    private final CommentLikeRepository commentLikeRepository;
    private final ShortUrlRepository shortUrlRepository;
    private final UserRepository userRepository;
    private final TrackRepository trackRepository;
    private final TagRepository tagRepository;
    private final FollowRepository followRepository;
    private final NotificationService notificationService;
    private final BlockRepository blockRepository;
    private final WebSocketHandler webSocketHandler;

    private boolean isBlockedEitherWay(Integer userId1, Integer userId2) {
        if (userId1 == null || userId2 == null) return false;
        return blockRepository.existsByBlockerIdAndBlockedId(userId1, userId2) ||
               blockRepository.existsByBlockerIdAndBlockedId(userId2, userId1);
    }

    @Transactional(readOnly = true)
    public List<PlaylistResponse> getPublicPlaylists(Integer currentUserId) {
        List<Playlist> publicPlaylists = playlistRepository.findByIsPublicTrueOrderByCreatedAtDesc()
                .stream()
                .filter(playlist -> !isBlockedEitherWay(currentUserId, playlist.getOwner().getId()))
                .toList();
        
        List<Playlist> myPrivatePlaylists = currentUserId != null 
            ? playlistRepository.findByOwnerIdOrderByCreatedAtDesc(currentUserId)
                .stream()
                .filter(playlist -> !playlist.getIsPublic())
                .toList()
            : List.of();
        
        java.util.Set<Integer> publicIds = publicPlaylists.stream()
                .map(Playlist::getId)
                .collect(java.util.stream.Collectors.toSet());
        
        List<Playlist> combined = new java.util.ArrayList<>(publicPlaylists);
        myPrivatePlaylists.stream()
                .filter(p -> !publicIds.contains(p.getId()))
                .forEach(combined::add);
        
        combined.sort((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()));
        
        return combined.stream()
                .map(this::toPlaylistResponse)
                .toList();
    }

    // 사용자의 플레이리스트 목록 조회
    @Transactional(readOnly = true)
    public List<PlaylistResponse> getUserPlaylists(Integer userId) {
        return playlistRepository.findByOwnerIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(this::toPlaylistResponse)
                .toList();
    }

    // 플레이리스트 상세 조회
    @Transactional
    public PlaylistDetailResponse getPlaylistDetail(Integer playlistId, Integer userId, Boolean incrementView) {
        Playlist playlist = playlistRepository.findById(playlistId)
                .orElseThrow(() -> new RuntimeException("Playlist not found"));
        
        // 조회수 증가 (incrementView가 true일 때만)
        if (Boolean.TRUE.equals(incrementView)) {
            playlist.setViewCount(playlist.getViewCount() + 1);
            playlistRepository.save(playlist);
        }
        
        boolean isLiked = userId != null && playlistLikeRepository.existsByUserIdAndPlaylistId(userId, playlistId);
        long likeCount = playlistLikeRepository.countByPlaylistId(playlistId);
        
        return PlaylistDetailResponse.builder()
                .id(playlist.getId())
                .title(playlist.getTitle())
                .description(playlist.getDescription())
                .coverImageUrl(playlist.getCoverImageUrl())
                .isPublic(playlist.getIsPublic())
                .viewCount(playlist.getViewCount())
                .likeCount(likeCount)
                .shareCount(playlist.getShareCount())
                .isLiked(isLiked)
                .owner(new OwnerInfo(playlist.getOwner().getId(), playlist.getOwner().getNickname()))
                .tracks(playlist.getItems().stream()
                        .map(item -> new TrackInfo(
                                item.getTrack().getId(),
                                item.getTrack().getTitle(),
                                item.getTrack().getArtist(),
                                item.getTrack().getAlbumImage(),
                                item.getTrack().getDurationSec()
                        ))
                        .toList())
                .tags(playlist.getTags().stream().map(Tag::getName).toList())
                .createdAt(playlist.getCreatedAt().toString())
                .build();
    }

    // 플레이리스트 생성
    public PlaylistResponse createPlaylist(Integer userId, CreatePlaylistRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        Playlist playlist = Playlist.builder()
                .owner(user)
                .title(request.getTitle())
                .description(request.getDescription())
                .coverImageUrl(request.getCoverImageUrl())
                .isPublic(request.getIsPublic())
                .isDraft(false)
                .build();
        
        // 태그 추가
        if (request.getTags() != null) {
            for (String tagName : request.getTags()) {
                Tag tag = tagRepository.findByName(tagName)
                        .orElseGet(() -> tagRepository.save(Tag.builder().name(tagName).build()));
                playlist.getTags().add(tag);
            }
        }
        
        playlist = playlistRepository.save(playlist);
        
        // 트랙 추가
        if (request.getTracks() != null) {
            int orderNo = 1;
            for (CreateTrackRequest trackReq : request.getTracks()) {
                Track track = trackRepository.findByTitleAndArtist(trackReq.getTitle(), trackReq.getArtist())
                        .orElseGet(() -> trackRepository.save(Track.builder()
                                .title(trackReq.getTitle())
                                .artist(trackReq.getArtist())
                                .albumName(trackReq.getAlbumName())
                                .albumImage(trackReq.getAlbumImage())
                                .durationSec(trackReq.getDurationSec() != null ? trackReq.getDurationSec() : 0)
                                .build()));
                
                PlaylistItem item = PlaylistItem.builder()
                        .playlist(playlist)
                        .track(track)
                        .orderNo(orderNo++)
                        .build();
                playlist.getItems().add(item);
            }
            playlist = playlistRepository.save(playlist);
        }
        
        // 공개 플레이리스트인 경우 팔로워들에게 알림 전송 + 모든 사용자에게 브로드캐스트
        if (Boolean.TRUE.equals(request.getIsPublic())) {
            final Playlist finalPlaylist = playlist;
            followRepository.findByFollowingId(userId).forEach(follow -> {
                notificationService.sendNewPlaylistNotification(
                        follow.getFollower().getId().longValue(),
                        user.getNickname(),
                        finalPlaylist.getTitle(),
                        finalPlaylist.getId().longValue()
                );
            });
            
            BroadcastDto.PlaylistEvent event = BroadcastDto.PlaylistEvent.builder()
                    .type("playlist_created")
                    .playlist(BroadcastDto.PlaylistData.builder()
                            .id(finalPlaylist.getId())
                            .title(finalPlaylist.getTitle())
                            .description(finalPlaylist.getDescription())
                            .coverImageUrl(finalPlaylist.getCoverImageUrl())
                            .isPublic(finalPlaylist.getIsPublic())
                            .viewCount(finalPlaylist.getViewCount())
                            .likeCount(0L)
                            .owner(BroadcastDto.OwnerData.builder()
                                    .id(user.getId())
                                    .nickname(user.getNickname())
                                    .build())
                            .trackCount(finalPlaylist.getItems().size())
                            .tags(finalPlaylist.getTags().stream().map(Tag::getName).toList())
                            .createdAt(finalPlaylist.getCreatedAt().toString())
                            .tracks(finalPlaylist.getItems().stream()
                                    .map(item -> BroadcastDto.TrackData.builder()
                                            .id(item.getTrack().getId())
                                            .title(item.getTrack().getTitle())
                                            .artist(item.getTrack().getArtist())
                                            .albumImage(item.getTrack().getAlbumImage())
                                            .durationSec(item.getTrack().getDurationSec())
                                            .build())
                                    .toList())
                            .build())
                    .build();
            webSocketHandler.broadcastExcept(userId.longValue(), event);
        }
        
        return toPlaylistResponse(playlist);
    }

    // 플레이리스트 수정
    public PlaylistResponse updatePlaylist(Integer playlistId, Integer userId, UpdatePlaylistRequest request) {
        Playlist playlist = playlistRepository.findById(playlistId)
                .orElseThrow(() -> new RuntimeException("Playlist not found"));
        
        if (!playlist.getOwner().getId().equals(userId)) {
            throw new RuntimeException("Not authorized to update this playlist");
        }
        
        // 필드 업데이트
        if (request.getTitle() != null) {
            playlist.setTitle(request.getTitle());
        }
        if (request.getDescription() != null) {
            playlist.setDescription(request.getDescription());
        }
        if (request.getCoverImageUrl() != null) {
            playlist.setCoverImageUrl(request.getCoverImageUrl());
        }
        if (request.getIsPublic() != null) {
            playlist.setIsPublic(request.getIsPublic());
        }
        
        // 태그 업데이트
        if (request.getTags() != null) {
            playlist.getTags().clear();
            for (String tagName : request.getTags()) {
                Tag tag = tagRepository.findByName(tagName)
                        .orElseGet(() -> tagRepository.save(Tag.builder().name(tagName).build()));
                playlist.getTags().add(tag);
            }
        }
        
        playlist = playlistRepository.save(playlist);
        
        // 공개 플레이리스트인 경우 모든 사용자에게 업데이트 브로드캐스트
        if (Boolean.TRUE.equals(playlist.getIsPublic())) {
            final Playlist finalPlaylist = playlist;
            User owner = playlist.getOwner();
            BroadcastDto.PlaylistUpdateEvent event = BroadcastDto.PlaylistUpdateEvent.builder()
                    .type("playlist_updated")
                    .playlist(BroadcastDto.PlaylistData.builder()
                            .id(finalPlaylist.getId())
                            .title(finalPlaylist.getTitle())
                            .description(finalPlaylist.getDescription())
                            .coverImageUrl(finalPlaylist.getCoverImageUrl())
                            .isPublic(finalPlaylist.getIsPublic())
                            .viewCount(finalPlaylist.getViewCount())
                            .likeCount(playlistLikeRepository.countByPlaylistId(finalPlaylist.getId()))
                            .owner(BroadcastDto.OwnerData.builder()
                                    .id(owner.getId())
                                    .nickname(owner.getNickname())
                                    .build())
                            .trackCount(finalPlaylist.getItems().size())
                            .tags(finalPlaylist.getTags().stream().map(Tag::getName).toList())
                            .createdAt(finalPlaylist.getCreatedAt().toString())
                            .tracks(finalPlaylist.getItems().stream()
                                    .map(item -> BroadcastDto.TrackData.builder()
                                            .id(item.getTrack().getId())
                                            .title(item.getTrack().getTitle())
                                            .artist(item.getTrack().getArtist())
                                            .albumImage(item.getTrack().getAlbumImage())
                                            .durationSec(item.getTrack().getDurationSec())
                                            .build())
                                    .toList())
                            .build())
                    .build();
            webSocketHandler.broadcastExcept(userId.longValue(), event);
        }
        
        return toPlaylistResponse(playlist);
    }

    public void deletePlaylist(Integer playlistId, Integer userId) {
        Playlist playlist = playlistRepository.findById(playlistId)
                .orElseThrow(() -> new RuntimeException("Playlist not found"));
        
        if (!playlist.getOwner().getId().equals(userId)) {
            throw new RuntimeException("Not authorized to delete this playlist");
        }
        
        boolean wasPublic = Boolean.TRUE.equals(playlist.getIsPublic());
        
        commentRepository.findByPlaylistId(playlistId)
                .forEach(comment -> commentLikeRepository.deleteByCommentId(comment.getId()));
        commentRepository.deleteByPlaylistId(playlistId);
        playlistLikeRepository.deleteByPlaylistId(playlistId);
        shortUrlRepository.deleteByPlaylistId(playlistId);
        
        playlistRepository.delete(playlist);
        
        if (wasPublic) {
            BroadcastDto.DeleteEvent event = BroadcastDto.DeleteEvent.builder()
                    .type("playlist_deleted")
                    .id(playlistId)
                    .build();
            webSocketHandler.broadcastExcept(userId.longValue(), event);
        }
    }

    // 플레이리스트에 트랙 추가
    public TrackInfo addTrack(Integer playlistId, Integer userId, AddTrackRequest request) {
        Playlist playlist = playlistRepository.findById(playlistId)
                .orElseThrow(() -> new RuntimeException("Playlist not found"));
        
        if (!playlist.getOwner().getId().equals(userId)) {
            throw new RuntimeException("Not authorized to modify this playlist");
        }

        Track track = trackRepository.findByTitleAndArtist(request.getTitle(), request.getArtist())
                .orElseGet(() -> trackRepository.save(Track.builder()
                        .title(request.getTitle())
                        .artist(request.getArtist())
                        .albumName(request.getAlbumName())
                        .albumImage(request.getAlbumImage())
                        .durationSec(request.getDurationSec() != null ? request.getDurationSec() : 0)
                        .build()));

        int orderNo = request.getOrderNo() != null 
                ? request.getOrderNo() 
                : playlist.getItems().size() + 1;

        PlaylistItem item = PlaylistItem.builder()
                .playlist(playlist)
                .track(track)
                .orderNo(orderNo)
                .build();
        
        playlistItemRepository.save(item);

        // coverImage가 없으면 첫번째 트랙의 앨범이미지로 설정
        if (playlist.getCoverImageUrl() == null && track.getAlbumImage() != null) {
            playlist.setCoverImageUrl(track.getAlbumImage());
            playlistRepository.save(playlist);
        }

        return new TrackInfo(track.getId(), track.getTitle(), track.getArtist(), 
                track.getAlbumImage(), track.getDurationSec());
    }

    // 플레이리스트에서 트랙 삭제
    public void removeTrack(Integer playlistId, Integer trackId, Integer userId) {
        Playlist playlist = playlistRepository.findById(playlistId)
                .orElseThrow(() -> new RuntimeException("Playlist not found"));
        
        if (!playlist.getOwner().getId().equals(userId)) {
            throw new RuntimeException("Not authorized to modify this playlist");
        }

        PlaylistItem itemToRemove = playlist.getItems().stream()
                .filter(item -> item.getTrack().getId().equals(trackId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Track not found in playlist"));

        playlist.getItems().remove(itemToRemove);
        playlistItemRepository.delete(itemToRemove);

        // 순서 재정렬
        int orderNo = 1;
        for (PlaylistItem item : playlist.getItems()) {
            item.setOrderNo(orderNo++);
        }
        playlistRepository.save(playlist);
    }

    // 플레이리스트 트랙 정보 수정
    public TrackInfo updateTrack(Integer playlistId, Integer trackId, Integer userId, UpdateTrackRequest request) {
        Playlist playlist = playlistRepository.findById(playlistId)
                .orElseThrow(() -> new RuntimeException("Playlist not found"));
        
        if (!playlist.getOwner().getId().equals(userId)) {
            throw new RuntimeException("Not authorized to modify this playlist");
        }

        Track track = trackRepository.findById(trackId)
                .orElseThrow(() -> new RuntimeException("Track not found"));

        // 트랙 정보 업데이트
        if (request.getTitle() != null) track.setTitle(request.getTitle());
        if (request.getArtist() != null) track.setArtist(request.getArtist());
        if (request.getAlbumName() != null) track.setAlbumName(request.getAlbumName());
        if (request.getAlbumImage() != null) track.setAlbumImage(request.getAlbumImage());
        if (request.getDurationSec() != null) track.setDurationSec(request.getDurationSec());

        track = trackRepository.save(track);

        return new TrackInfo(track.getId(), track.getTitle(), track.getArtist(), 
                track.getAlbumImage(), track.getDurationSec());
    }

    // 트랙 순서 변경
    public void reorderTracks(Integer playlistId, Integer userId, List<Integer> trackIds) {
        Playlist playlist = playlistRepository.findById(playlistId)
                .orElseThrow(() -> new RuntimeException("Playlist not found"));
        
        if (!playlist.getOwner().getId().equals(userId)) {
            throw new RuntimeException("Not authorized to modify this playlist");
        }

        int orderNo = 1;
        for (Integer trackId : trackIds) {
            for (PlaylistItem item : playlist.getItems()) {
                if (item.getTrack().getId().equals(trackId)) {
                    item.setOrderNo(orderNo++);
                    break;
                }
            }
        }
        playlistRepository.save(playlist);
    }

    public PlaylistResponse toggleVisibility(Integer playlistId, Integer userId) {
        Playlist playlist = playlistRepository.findById(playlistId)
                .orElseThrow(() -> new RuntimeException("Playlist not found"));
        
        if (!playlist.getOwner().getId().equals(userId)) {
            throw new RuntimeException("Not authorized to modify this playlist");
        }
        
        playlist.setIsPublic(!playlist.getIsPublic());
        playlist = playlistRepository.save(playlist);
        
        User owner = playlist.getOwner();
        BroadcastDto.VisibilityEvent.VisibilityEventBuilder eventBuilder = BroadcastDto.VisibilityEvent.builder()
                .type("visibility_updated")
                .playlistId(playlistId)
                .isPublic(playlist.getIsPublic());
        
        if (Boolean.TRUE.equals(playlist.getIsPublic())) {
            eventBuilder.playlist(BroadcastDto.PlaylistData.builder()
                    .id(playlist.getId())
                    .title(playlist.getTitle())
                    .description(playlist.getDescription())
                    .coverImageUrl(playlist.getCoverImageUrl())
                    .isPublic(playlist.getIsPublic())
                    .viewCount(playlist.getViewCount())
                    .likeCount(playlistLikeRepository.countByPlaylistId(playlist.getId()))
                    .owner(BroadcastDto.OwnerData.builder()
                            .id(owner.getId())
                            .nickname(owner.getNickname())
                            .build())
                    .trackCount(playlist.getItems().size())
                    .tags(playlist.getTags().stream().map(Tag::getName).toList())
                    .createdAt(playlist.getCreatedAt().toString())
                    .tracks(playlist.getItems().stream()
                            .map(item -> BroadcastDto.TrackData.builder()
                                    .id(item.getTrack().getId())
                                    .title(item.getTrack().getTitle())
                                    .artist(item.getTrack().getArtist())
                                    .albumImage(item.getTrack().getAlbumImage())
                                    .durationSec(item.getTrack().getDurationSec())
                                    .build())
                            .toList())
                    .build());
        }
        
        webSocketHandler.broadcastExcept(userId.longValue(), eventBuilder.build());
        
        return toPlaylistResponse(playlist);
    }

    public Integer incrementShareCount(Integer playlistId) {
        Playlist playlist = playlistRepository.findById(playlistId)
                .orElseThrow(() -> new RuntimeException("Playlist not found"));
        
        playlist.setShareCount(playlist.getShareCount() + 1);
        playlist = playlistRepository.save(playlist);
        
        // 공개 플레이리스트인 경우 모든 사용자에게 브로드캐스트
        if (Boolean.TRUE.equals(playlist.getIsPublic())) {
            BroadcastDto.ShareEvent event = BroadcastDto.ShareEvent.builder()
                    .type("share_updated")
                    .playlistId(playlistId)
                    .shareCount(playlist.getShareCount())
                    .build();
            webSocketHandler.broadcastNotification(event);
        }
        
        return playlist.getShareCount();
    }

    // 플레이리스트 복제
    public PlaylistResponse duplicatePlaylist(Integer playlistId, Integer userId) {
        Playlist original = playlistRepository.findById(playlistId)
                .orElseThrow(() -> new RuntimeException("Playlist not found"));
        
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        // 새 플레이리스트 생성 (제목에 " (복사본)" 추가)
        Playlist duplicated = Playlist.builder()
                .owner(user)
                .title(original.getTitle() + " (복사본)")
                .description(original.getDescription())
                .coverImageUrl(original.getCoverImageUrl())
                .isPublic(false) // 복제된 플레이리스트는 기본적으로 비공개
                .isDraft(false)
                .build();
        
        duplicated = playlistRepository.save(duplicated);
        
        // 태그 복제
        for (Tag tag : original.getTags()) {
            duplicated.getTags().add(tag);
        }
        
        // 트랙 복제
        int orderNo = 1;
        for (PlaylistItem originalItem : original.getItems()) {
            PlaylistItem newItem = PlaylistItem.builder()
                    .playlist(duplicated)
                    .track(originalItem.getTrack())
                    .orderNo(orderNo++)
                    .build();
            duplicated.getItems().add(newItem);
        }
        
        duplicated = playlistRepository.save(duplicated);
        
        return toPlaylistResponse(duplicated);
    }

    private PlaylistResponse toPlaylistResponse(Playlist playlist) {
        // coverImage가 없으면 첫번째 트랙의 앨범이미지 사용
        String coverImageUrl = playlist.getCoverImageUrl();
        if (coverImageUrl == null && !playlist.getItems().isEmpty()) {
            Track firstTrack = playlist.getItems().get(0).getTrack();
            if (firstTrack != null && firstTrack.getAlbumImage() != null) {
                coverImageUrl = firstTrack.getAlbumImage();
            }
        }

        return PlaylistResponse.builder()
                .id(playlist.getId())
                .title(playlist.getTitle())
                .description(playlist.getDescription())
                .coverImageUrl(coverImageUrl)
                .isPublic(playlist.getIsPublic())
                .viewCount(playlist.getViewCount())
                .likeCount(playlistLikeRepository.countByPlaylistId(playlist.getId()))
                .shareCount(playlist.getShareCount())
                .owner(new OwnerInfo(playlist.getOwner().getId(), playlist.getOwner().getNickname()))
                .trackCount(playlist.getItems().size())
                .tags(playlist.getTags().stream().map(Tag::getName).toList())
                .createdAt(playlist.getCreatedAt().toString())
                .build();
    }
}
