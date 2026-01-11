package com.plyst.service;

import com.plyst.dto.ProfileDto;
import com.plyst.entity.Profile;
import com.plyst.entity.User;
import com.plyst.repository.CommentRepository;
import com.plyst.repository.FollowRepository;
import com.plyst.repository.PlaylistLikeRepository;
import com.plyst.repository.PlaylistRepository;
import com.plyst.repository.ProfileRepository;
import com.plyst.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.Objects;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ProfileService {
    
    private final ProfileRepository profileRepository;
    private final UserRepository userRepository;
    private final PlaylistRepository playlistRepository;
    private final PlaylistLikeRepository playlistLikeRepository;
    private final FollowRepository followRepository;
    private final CommentRepository commentRepository;
    
    // 프로필 조회
    @Transactional(readOnly = true)
    public ProfileDto.ProfileResponse getProfile(Integer userId) {
        if (userId == null) {
            return null;
        }
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return null;
        }
        
        User user = userOpt.get();
        Optional<Profile> profileOpt = profileRepository.findByUserId(userId);
        
        // 통계 조회
        long playlistCount = playlistRepository.countByOwnerId(userId);
        long likedPlaylistCount = playlistLikeRepository.countByUserId(userId);
        long followerCount = followRepository.countByFollowingId(userId);
        long followingCount = followRepository.countByFollowerId(userId);
        long commentCount = commentRepository.countByUserIdAndStatus(userId, "ACTIVE");
        
        Profile profile = profileOpt.orElse(null);
        
        return ProfileDto.ProfileResponse.builder()
                .userId(userId)
                .nickname(user.getNickname())
                .bio(profile != null ? profile.getIntro() : "")
                .avatar(profile != null && profile.getImageUrl() != null ? profile.getImageUrl() : "🎧")
                .musicTags(profile != null ? new ArrayList<>(profile.getTasteTags()) : new ArrayList<>())
                .playlists((int) playlistCount)
                .likedPlaylists((int) likedPlaylistCount)
                .followers((int) followerCount)
                .following((int) followingCount)
                .comments((int) commentCount)
                .build();
    }
    
    // 프로필 수정
    @Transactional
    public ProfileDto.UpdateProfileResponse updateProfile(Integer userId, ProfileDto.UpdateProfileRequest request) {
        if (userId == null) {
            return ProfileDto.UpdateProfileResponse.builder()
                    .success(false)
                    .message("사용자 ID가 유효하지 않습니다.")
                    .build();
        }
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ProfileDto.UpdateProfileResponse.builder()
                    .success(false)
                    .message("사용자를 찾을 수 없습니다.")
                    .build();
        }
        
        User user = userOpt.get();
        
        // 닉네임 변경 시 중복 체크
        if (request.getNickname() != null && !request.getNickname().equals(user.getNickname())) {
            if (userRepository.existsByNickname(request.getNickname())) {
                return ProfileDto.UpdateProfileResponse.builder()
                        .success(false)
                        .message("이미 사용 중인 닉네임입니다.")
                        .build();
            }
            user.setNickname(request.getNickname());
            userRepository.save(user);
        }
        
        // 프로필 조회 또는 생성
        Profile profile = profileRepository.findByUserId(userId)
                .orElseGet(() -> Profile.builder()
                        .user(user)
                        .tasteTags(new HashSet<>())
                        .build());
        
        // 프로필 업데이트
        if (request.getBio() != null) {
            profile.setIntro(request.getBio());
        }
        
        if (request.getAvatar() != null) {
            profile.setImageUrl(request.getAvatar());
        }
        
        if (request.getMusicTags() != null) {
            profile.setTasteTags(new HashSet<>(request.getMusicTags()));
        }
        
        profileRepository.save(Objects.requireNonNull(profile));
        
        // 업데이트된 프로필 조회
        ProfileDto.ProfileResponse updatedProfile = getProfile(userId);
        
        return ProfileDto.UpdateProfileResponse.builder()
                .success(true)
                .message("프로필이 수정되었습니다.")
                .profile(Objects.requireNonNull(updatedProfile))
                .build();
    }
}
