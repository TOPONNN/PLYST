package com.plyst.service;

import com.plyst.dto.CommentDto.AuthorInfo;
import com.plyst.dto.CommentDto.CommentResponse;
import com.plyst.dto.CommentDto.CreateCommentRequest;
import com.plyst.dto.CommentDto.UpdateCommentRequest;
import com.plyst.entity.Comment;
import com.plyst.entity.Playlist;
import com.plyst.entity.Profile;
import com.plyst.entity.User;
import com.plyst.repository.BlockRepository;
import com.plyst.repository.CommentLikeRepository;
import com.plyst.repository.CommentRepository;
import com.plyst.repository.PlaylistRepository;
import com.plyst.repository.UserRepository;
import com.plyst.repository.ProfileRepository;
import com.plyst.dto.BroadcastDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
@SuppressWarnings("null")
public class CommentService {

    private final CommentRepository commentRepository;
    private final CommentLikeRepository commentLikeRepository;
    private final UserRepository userRepository;
    private final PlaylistRepository playlistRepository;
    private final ProfileRepository profileRepository;
    private final NotificationService notificationService;
    private final BlockRepository blockRepository;
    private final WebSocketHandler webSocketHandler;
    
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Transactional(readOnly = true)
    public List<CommentResponse> getCommentsByPlaylist(Integer playlistId, Integer userId) {
        return commentRepository.findByPlaylistIdAndParentIsNullAndStatusOrderByCreatedAtDesc(playlistId, "ACTIVE")
                .stream()
                .filter(comment -> !isBlockedEitherWay(userId, comment.getUser().getId()))
                .map(comment -> toCommentResponse(comment, userId))
                .toList();
    }
    
    private boolean isBlockedEitherWay(Integer userId1, Integer userId2) {
        if (userId1 == null || userId2 == null) return false;
        return blockRepository.existsByBlockerIdAndBlockedId(userId1, userId2) ||
               blockRepository.existsByBlockerIdAndBlockedId(userId2, userId1);
    }

    // 댓글 작성
    public CommentResponse createComment(Integer userId, CreateCommentRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        Playlist playlist = playlistRepository.findById(request.getPlaylistId())
                .orElseThrow(() -> new RuntimeException("Playlist not found"));
        
        Comment parent = null;
        if (request.getParentId() != null) {
            parent = commentRepository.findById(request.getParentId())
                    .orElseThrow(() -> new RuntimeException("Parent comment not found"));
        }
        
        Comment comment = Comment.builder()
                .playlist(playlist)
                .user(user)
                .parent(parent)
                .content(request.getContent())
                .status("ACTIVE")
                .build();
        
        comment = commentRepository.save(comment);
        
        // 플레이리스트 주인에게 댓글 알림 전송 (본인 댓글 제외)
        if (!playlist.getOwner().getId().equals(userId)) {
            notificationService.sendCommentNotification(
                    playlist.getOwner().getId().longValue(),
                    user.getNickname(),
                    request.getContent(),
                    playlist.getId().longValue()
            );
        }
        
        String avatarUrl = profileRepository.findByUserId(userId)
                .map(Profile::getImageUrl)
                .orElse(null);
        
        BroadcastDto.CommentEvent event = BroadcastDto.CommentEvent.builder()
                .type("comment_added")
                .playlistId(playlist.getId())
                .comment(BroadcastDto.CommentData.builder()
                        .id(comment.getId())
                        .content(comment.getContent())
                        .author(BroadcastDto.AuthorData.builder()
                                .id(user.getId())
                                .nickname(user.getNickname())
                                .avatar(avatarUrl)
                                .build())
                        .likeCount(0L)
                        .isLiked(false)
                        .createdAt(comment.getCreatedAt().format(DATE_FORMATTER))
                        .build())
                .build();
        webSocketHandler.broadcastExcept(userId.longValue(), event);
        
        return toCommentResponse(comment, userId);
    }

    // 댓글 수정
    public CommentResponse updateComment(Integer commentId, Integer userId, UpdateCommentRequest request) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new RuntimeException("Comment not found"));
        
        if (!comment.getUser().getId().equals(userId)) {
            throw new RuntimeException("Not authorized to update this comment");
        }
        
        comment.setContent(request.getContent());
        comment = commentRepository.save(comment);
        return toCommentResponse(comment, userId);
    }

    public void deleteComment(Integer commentId, Integer userId) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new RuntimeException("Comment not found"));
        
        if (!comment.getUser().getId().equals(userId)) {
            throw new RuntimeException("Not authorized to delete this comment");
        }
        
        Integer playlistId = comment.getPlaylist().getId();
        
        comment.setStatus("DELETED");
        commentRepository.save(comment);
        
        BroadcastDto.DeleteEvent event = BroadcastDto.DeleteEvent.builder()
                .type("comment_deleted")
                .id(commentId)
                .playlistId(playlistId)
                .build();
        webSocketHandler.broadcastExcept(userId.longValue(), event);
    }

    private CommentResponse toCommentResponse(Comment comment, Integer userId) {
        boolean isLiked = userId != null && commentLikeRepository.existsByUserIdAndCommentId(userId, comment.getId());
        long likeCount = commentLikeRepository.countByCommentId(comment.getId());
        
        // 프로필 이미지 조회
        String avatarUrl = profileRepository.findByUserId(comment.getUser().getId())
                .map(Profile::getImageUrl)
                .orElse(null);
        
        return CommentResponse.builder()
                .id(comment.getId())
                .content(comment.getContent())
                .author(new AuthorInfo(comment.getUser().getId(), comment.getUser().getNickname(), avatarUrl))
                .likeCount(likeCount)
                .isLiked(isLiked)
                .createdAt(comment.getCreatedAt().format(DATE_FORMATTER))
                .build();
    }

    // 사용자가 작성한 댓글 목록 조회
    @Transactional(readOnly = true)
    public List<CommentResponse> getCommentsByUser(Integer userId) {
        return commentRepository.findByUserIdAndStatusOrderByCreatedAtDesc(userId, "ACTIVE")
                .stream()
                .map(comment -> toCommentResponseWithPlaylist(comment, userId))
                .toList();
    }

    // 사용자가 작성한 댓글 수 조회
    @Transactional(readOnly = true)
    public long countUserComments(Integer userId) {
        return commentRepository.countByUserIdAndStatus(userId, "ACTIVE");
    }

    private CommentResponse toCommentResponseWithPlaylist(Comment comment, Integer userId) {
        CommentResponse response = toCommentResponse(comment, userId);
        // 플레이리스트 정보 추가
        if (comment.getPlaylist() != null) {
            response.setPlaylistId(comment.getPlaylist().getId());
            response.setPlaylistTitle(comment.getPlaylist().getTitle());
        }
        return response;
    }
}
