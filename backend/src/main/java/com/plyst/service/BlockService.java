package com.plyst.service;

import com.plyst.dto.BlockDto;
import com.plyst.entity.Block;
import com.plyst.entity.User;
import com.plyst.repository.BlockRepository;
import com.plyst.repository.FollowRepository;
import com.plyst.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
@SuppressWarnings("null")
public class BlockService {

    private final BlockRepository blockRepository;
    private final UserRepository userRepository;
    private final FollowRepository followRepository;

    // 차단/차단해제 토글
    public boolean toggleBlock(Integer blockerId, Integer blockedId, String reason) {
        // 자기 자신은 차단할 수 없음
        if (blockerId.equals(blockedId)) {
            throw new RuntimeException("자기 자신을 차단할 수 없습니다.");
        }

        if (blockRepository.existsByBlockerIdAndBlockedId(blockerId, blockedId)) {
            // 이미 차단 중이면 차단 해제
            blockRepository.findByBlockerIdAndBlockedId(blockerId, blockedId)
                    .ifPresent(block -> blockRepository.delete(block));
            return false;
        } else {
            // 차단
            User blocker = userRepository.findById(blockerId)
                    .orElseThrow(() -> new RuntimeException("User not found"));
            User blocked = userRepository.findById(blockedId)
                    .orElseThrow(() -> new RuntimeException("Target user not found"));

            Block block = Block.builder()
                    .blocker(blocker)
                    .blocked(blocked)
                    .reason(reason)
                    .build();
            blockRepository.save(block);

            // 차단 시 상호 팔로우 관계 해제
            followRepository.findByFollowerIdAndFollowingId(blockerId, blockedId)
                    .ifPresent(followRepository::delete);
            followRepository.findByFollowerIdAndFollowingId(blockedId, blockerId)
                    .ifPresent(followRepository::delete);

            return true;
        }
    }

    // 차단만 (토글 없이)
    public boolean blockUser(Integer blockerId, Integer blockedId, String reason) {
        if (blockerId.equals(blockedId)) {
            throw new RuntimeException("자기 자신을 차단할 수 없습니다.");
        }

        if (blockRepository.existsByBlockerIdAndBlockedId(blockerId, blockedId)) {
            return false; // 이미 차단됨
        }

        User blocker = userRepository.findById(blockerId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        User blocked = userRepository.findById(blockedId)
                .orElseThrow(() -> new RuntimeException("Target user not found"));

        Block block = Block.builder()
                .blocker(blocker)
                .blocked(blocked)
                .reason(reason)
                .build();
        blockRepository.save(block);

        // 차단 시 상호 팔로우 관계 해제
        followRepository.findByFollowerIdAndFollowingId(blockerId, blockedId)
                .ifPresent(followRepository::delete);
        followRepository.findByFollowerIdAndFollowingId(blockedId, blockerId)
                .ifPresent(followRepository::delete);

        return true;
    }

    // 차단 해제만
    public boolean unblockUser(Integer blockerId, Integer blockedId) {
        if (!blockRepository.existsByBlockerIdAndBlockedId(blockerId, blockedId)) {
            return false; // 차단되어 있지 않음
        }

        blockRepository.findByBlockerIdAndBlockedId(blockerId, blockedId)
                .ifPresent(blockRepository::delete);
        return true;
    }

    // 차단 상태 확인
    @Transactional(readOnly = true)
    public boolean isBlocked(Integer blockerId, Integer blockedId) {
        if (blockerId == null || blockedId == null) {
            return false;
        }
        return blockRepository.existsByBlockerIdAndBlockedId(blockerId, blockedId);
    }

    // 양방향 차단 확인 (A가 B를 차단했거나 B가 A를 차단한 경우)
    @Transactional(readOnly = true)
    public boolean isBlockedEitherWay(Integer userId1, Integer userId2) {
        if (userId1 == null || userId2 == null) {
            return false;
        }
        return blockRepository.existsByBlockerIdAndBlockedId(userId1, userId2) ||
               blockRepository.existsByBlockerIdAndBlockedId(userId2, userId1);
    }

    @Transactional(readOnly = true)
    public List<BlockDto.BlockedUserResponse> getBlockedUsersWithDetails(Integer blockerId) {
        return blockRepository.findByBlockerId(blockerId).stream()
                .map(block -> BlockDto.BlockedUserResponse.builder()
                        .id(block.getBlocked().getId())
                        .nickname(block.getBlocked().getNickname())
                        .avatar(null)
                        .reason(block.getReason())
                        .blockedAt(block.getCreatedAt() != null ? block.getCreatedAt().toString() : null)
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<User> getBlockedUsers(Integer blockerId) {
        return blockRepository.findByBlockerId(blockerId).stream()
                .map(Block::getBlocked)
                .collect(Collectors.toList());
    }

    // 나를 차단한 사용자 목록 조회
    @Transactional(readOnly = true)
    public List<User> getBlockersOfUser(Integer blockedId) {
        return blockRepository.findByBlockedId(blockedId).stream()
                .map(Block::getBlocker)
                .collect(Collectors.toList());
    }

    // 내가 차단한 사용자 수 조회
    @Transactional(readOnly = true)
    public long getBlockedCount(Integer blockerId) {
        return blockRepository.countByBlockerId(blockerId);
    }

    // 차단 정보 조회 (사유 포함)
    @Transactional(readOnly = true)
    public Block getBlockInfo(Integer blockerId, Integer blockedId) {
        return blockRepository.findByBlockerIdAndBlockedId(blockerId, blockedId)
                .orElse(null);
    }
}
