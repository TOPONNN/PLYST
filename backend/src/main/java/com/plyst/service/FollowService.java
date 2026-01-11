package com.plyst.service;

import com.plyst.entity.Follow;
import com.plyst.entity.User;
import com.plyst.repository.BlockRepository;
import com.plyst.repository.FollowRepository;
import com.plyst.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
@SuppressWarnings("null")
public class FollowService {

    private final FollowRepository followRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final BlockRepository blockRepository;

    // 팔로우/언팔로우 토글
    public boolean toggleFollow(Integer followerId, Integer followingId) {
        // 자기 자신은 팔로우할 수 없음
        if (followerId.equals(followingId)) {
            throw new RuntimeException("자기 자신을 팔로우할 수 없습니다.");
        }

        // 차단 관계 확인 (양방향)
        if (blockRepository.existsByBlockerIdAndBlockedId(followerId, followingId)) {
            throw new RuntimeException("차단한 사용자를 팔로우할 수 없습니다.");
        }
        if (blockRepository.existsByBlockerIdAndBlockedId(followingId, followerId)) {
            throw new RuntimeException("해당 사용자에게 차단되어 팔로우할 수 없습니다.");
        }

        if (followRepository.existsByFollowerIdAndFollowingId(followerId, followingId)) {
            // 이미 팔로우 중이면 언팔로우
            followRepository.findByFollowerIdAndFollowingId(followerId, followingId)
                    .ifPresent(follow -> followRepository.delete(follow));
            return false;
        } else {
            // 팔로우
            User follower = userRepository.findById(followerId)
                    .orElseThrow(() -> new RuntimeException("User not found"));
            User following = userRepository.findById(followingId)
                    .orElseThrow(() -> new RuntimeException("Target user not found"));

            Follow follow = Follow.builder()
                    .follower(follower)
                    .following(following)
                    .build();
            followRepository.save(follow);

            // 팔로우 알림 전송
            notificationService.sendFollowNotification(
                    followingId.longValue(),
                    follower.getNickname()
            );

            return true;
        }
    }

    // 팔로우 상태 확인
    @Transactional(readOnly = true)
    public boolean isFollowing(Integer followerId, Integer followingId) {
        if (followerId == null || followingId == null) {
            return false;
        }
        return followRepository.existsByFollowerIdAndFollowingId(followerId, followingId);
    }

    // 팔로워 수 조회
    @Transactional(readOnly = true)
    public long getFollowerCount(Integer userId) {
        return followRepository.countByFollowingId(userId);
    }

    // 팔로잉 수 조회
    @Transactional(readOnly = true)
    public long getFollowingCount(Integer userId) {
        return followRepository.countByFollowerId(userId);
    }
}
