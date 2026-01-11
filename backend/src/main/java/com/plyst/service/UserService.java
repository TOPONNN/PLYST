package com.plyst.service;

import com.plyst.dto.UserDto;
import com.plyst.dto.PlaylistDto;
import com.plyst.entity.User;
import com.plyst.entity.Playlist;
import com.plyst.entity.PlaylistLike;
import com.plyst.entity.Follow;
import com.plyst.repository.UserRepository;
import com.plyst.repository.PlaylistRepository;
import com.plyst.repository.PlaylistLikeRepository;
import com.plyst.repository.FollowRepository;
import com.plyst.repository.ProfileRepository;
import com.plyst.repository.CommentRepository;
import com.plyst.repository.CommentLikeRepository;
import com.plyst.repository.TrackLikeRepository;
import com.plyst.repository.BlockRepository;
import com.plyst.repository.NotificationRepository;
import com.plyst.repository.OAuthAccountRepository;
import com.plyst.repository.StationParticipantRepository;
import com.plyst.repository.StationBanRepository;
import com.plyst.entity.OAuthAccount;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class UserService {
    
    private final UserRepository userRepository;
    private final PlaylistRepository playlistRepository;
    private final PlaylistLikeRepository playlistLikeRepository;
    private final FollowRepository followRepository;
    private final ProfileRepository profileRepository;
    private final EmailService emailService;
    private final CommentRepository commentRepository;
    private final CommentLikeRepository commentLikeRepository;
    private final TrackLikeRepository trackLikeRepository;
    private final BlockRepository blockRepository;
    private final NotificationRepository notificationRepository;
    private final OAuthAccountRepository oAuthAccountRepository;
    private final StationParticipantRepository stationParticipantRepository;
    private final StationBanRepository stationBanRepository;
    private final EntityManager entityManager;
    
    // 회원가입
    @Transactional
    public UserDto.SignupResponse signup(UserDto.SignupRequest request) {
        // 이메일 중복 체크
        if (userRepository.existsByEmail(request.getEmail())) {
            return UserDto.SignupResponse.builder()
                    .success(false)
                    .message("이미 사용 중인 이메일입니다.")
                    .build();
        }
        
        // 닉네임 중복 체크
        if (userRepository.existsByNickname(request.getNickname())) {
            return UserDto.SignupResponse.builder()
                    .success(false)
                    .message("이미 사용 중인 닉네임입니다.")
                    .build();
        }
        
        // 아이디 중복 체크
        if (userRepository.existsByUserId(request.getUserId())) {
            return UserDto.SignupResponse.builder()
                    .success(false)
                    .message("이미 사용 중인 아이디입니다.")
                    .build();
        }
        
        // 사용자 생성
        User user = User.builder()
                .userId(request.getUserId())
                .email(request.getEmail())
                .password(request.getPassword()) // 실제 프로덕션에서는 암호화 필요
                .name(request.getRealName())
                .nickname(request.getNickname())
                .phone(request.getPhoneNumber())
                .status("ACTIVE")
                .role("USER")
                .build();
        
        User savedUser = userRepository.save(user);
        
        com.plyst.entity.Profile profile = com.plyst.entity.Profile.builder()
                .user(savedUser)
                .build();
        profileRepository.save(profile);
        
        return UserDto.SignupResponse.builder()
                .id(savedUser.getId())
                .nickname(savedUser.getNickname())
                .email(savedUser.getEmail())
                .success(true)
                .message("회원가입이 완료되었습니다.")
                .build();
    }
    
    @Transactional
    public UserDto.LoginResponse login(UserDto.LoginRequest request) {
        Optional<User> userOpt = userRepository.findByUserId(request.getUserId());
        
        if (userOpt.isEmpty()) {
            return UserDto.LoginResponse.builder()
                    .success(false)
                    .message("존재하지 않는 아이디입니다.")
                    .build();
        }
        
        User user = userOpt.get();
        
        if (!user.getPassword().equals(request.getPassword())) {
            return UserDto.LoginResponse.builder()
                    .success(false)
                    .message("비밀번호가 일치하지 않습니다.")
                    .build();
        }
        
        boolean isDormant = user.getDormantAt() != null;
        
        if (isDormant) {
            return UserDto.LoginResponse.builder()
                    .id(user.getId())
                    .nickname(user.getNickname())
                    .email(user.getEmail())
                    .success(false)
                    .message("휴면 상태의 계정입니다. 휴면 해제 후 이용해주세요.")
                    .isDormant(true)
                    .build();
        }
        
        user.setLastLoginAt(java.time.LocalDateTime.now());
        userRepository.save(user);
        
        String profileImage = profileRepository.findByUserId(user.getId())
                .map(p -> p.getImageUrl())
                .orElse(null);
        
        return UserDto.LoginResponse.builder()
                .id(user.getId())
                .nickname(user.getNickname())
                .email(user.getEmail())
                .success(true)
                .message("로그인 성공")
                .token("temp-token-" + user.getId())
                .profileImage(profileImage)
                .isDormant(false)
                .build();
    }
    
    @Transactional
    public UserDto.LoginResponse socialLogin(UserDto.SocialLoginRequest request) {
        Optional<OAuthAccount> existingOAuth = oAuthAccountRepository.findByProviderAndProviderUserId(
                request.getProvider(), request.getProviderId());
        
        if (existingOAuth.isPresent()) {
            User user = existingOAuth.get().getUser();
            String profileImage = profileRepository.findByUserId(user.getId())
                    .map(p -> p.getImageUrl())
                    .orElse(null);
            
            return UserDto.LoginResponse.builder()
                    .id(user.getId())
                    .nickname(user.getNickname())
                    .email(user.getEmail())
                    .success(true)
                    .message("소셜 로그인 성공")
                    .token("temp-token-" + user.getId())
                    .profileImage(profileImage)
                    .provider(request.getProvider())
                    .build();
        }
        
        Optional<User> emailUser = userRepository.findByEmail(request.getEmail());
        if (emailUser.isPresent()) {
            User user = emailUser.get();
            
            OAuthAccount oAuthAccount = OAuthAccount.builder()
                    .user(user)
                    .provider(request.getProvider())
                    .providerUserId(request.getProviderId())
                    .linkedAt(java.time.LocalDateTime.now())
                    .build();
            oAuthAccountRepository.save(oAuthAccount);
            
            com.plyst.entity.Profile profile = profileRepository.findByUserId(user.getId()).orElse(null);
            if (profile != null && profile.getImageUrl() == null && request.getProfileImage() != null) {
                profile.setImageUrl(request.getProfileImage());
                profileRepository.save(profile);
            }
            
            String profileImage = profile != null ? profile.getImageUrl() : null;
            
            return UserDto.LoginResponse.builder()
                    .id(user.getId())
                    .nickname(user.getNickname())
                    .email(user.getEmail())
                    .success(true)
                    .message("기존 계정에 소셜 로그인이 연동되었습니다.")
                    .token("temp-token-" + user.getId())
                    .profileImage(profileImage)
                    .provider(request.getProvider())
                    .build();
        }
        
        return UserDto.LoginResponse.builder()
                .success(false)
                .message("NEED_SIGNUP")
                .email(request.getEmail())
                .build();
    }
    
    @Transactional
    public UserDto.SignupResponse socialSignup(UserDto.SocialSignupRequest request) {
        if (userRepository.existsByNickname(request.getNickname())) {
            return UserDto.SignupResponse.builder()
                    .success(false)
                    .message("이미 사용 중인 닉네임입니다.")
                    .build();
        }
        
        if (userRepository.existsByEmail(request.getEmail())) {
            return UserDto.SignupResponse.builder()
                    .success(false)
                    .message("이미 사용 중인 이메일입니다.")
                    .build();
        }
        
        String uniqueUserId = request.getProvider() + "_" + request.getProviderId();
        
        User user = User.builder()
                .userId(uniqueUserId)
                .email(request.getEmail())
                .password(null)
                .name(request.getName())
                .nickname(request.getNickname())
                .phone(null)
                .status("ACTIVE")
                .role("USER")
                .build();
        
        User savedUser = userRepository.save(user);
        
        OAuthAccount oAuthAccount = OAuthAccount.builder()
                .user(savedUser)
                .provider(request.getProvider())
                .providerUserId(request.getProviderId())
                .linkedAt(java.time.LocalDateTime.now())
                .build();
        oAuthAccountRepository.save(oAuthAccount);
        
        com.plyst.entity.Profile profile = com.plyst.entity.Profile.builder()
                .user(savedUser)
                .imageUrl(request.getProfileImage())
                .build();
        profileRepository.save(profile);
        
        return UserDto.SignupResponse.builder()
                .id(savedUser.getId())
                .nickname(savedUser.getNickname())
                .email(savedUser.getEmail())
                .success(true)
                .message("소셜 회원가입이 완료되었습니다.")
                .build();
    }
    
    // 카카오 로그인 (서버에서 토큰 교환)
    @Transactional
    public UserDto.LoginResponse kakaoLogin(String code, String redirectUri) {
        try {
            // 1. 카카오 토큰 발급
            String tokenUrl = "https://kauth.kakao.com/oauth/token";
            String tokenParams = "grant_type=authorization_code"
                    + "&client_id=b3f613f50d8d7c59b4deaf5f245de42e"
                    + "&redirect_uri=" + java.net.URLEncoder.encode(redirectUri, "UTF-8")
                    + "&code=" + code;
            
            java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient();
            java.net.http.HttpRequest tokenRequest = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(tokenUrl))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(java.net.http.HttpRequest.BodyPublishers.ofString(tokenParams))
                    .build();
            
            java.net.http.HttpResponse<String> tokenResponse = client.send(tokenRequest, 
                    java.net.http.HttpResponse.BodyHandlers.ofString());
            
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            com.fasterxml.jackson.databind.JsonNode tokenJson = mapper.readTree(tokenResponse.body());
            
            // 토큰 에러 체크
            if (tokenJson.has("error")) {
                String errorDesc = tokenJson.has("error_description") 
                        ? tokenJson.get("error_description").asText() 
                        : tokenJson.get("error").asText();
                return UserDto.LoginResponse.builder()
                        .success(false)
                        .message("카카오 토큰 발급 실패: " + errorDesc)
                        .build();
            }
            
            if (!tokenJson.has("access_token")) {
                return UserDto.LoginResponse.builder()
                        .success(false)
                        .message("카카오 토큰을 받지 못했습니다")
                        .build();
            }
            
            String accessToken = tokenJson.get("access_token").asText();
            
            // 2. 카카오 사용자 정보 조회
            java.net.http.HttpRequest userRequest = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create("https://kapi.kakao.com/v2/user/me"))
                    .header("Authorization", "Bearer " + accessToken)
                    .GET()
                    .build();
            
            java.net.http.HttpResponse<String> userResponse = client.send(userRequest,
                    java.net.http.HttpResponse.BodyHandlers.ofString());
            
            com.fasterxml.jackson.databind.JsonNode userJson = mapper.readTree(userResponse.body());
            String kakaoId = userJson.get("id").asText();
            
            com.fasterxml.jackson.databind.JsonNode kakaoAccount = userJson.get("kakao_account");
            String email = kakaoAccount != null && kakaoAccount.has("email") 
                    ? kakaoAccount.get("email").asText() : kakaoId + "@kakao.com";
            
            com.fasterxml.jackson.databind.JsonNode profile = kakaoAccount != null ? kakaoAccount.get("profile") : null;
            String nickname = profile != null && profile.has("nickname") 
                    ? profile.get("nickname").asText() : "카카오유저";
            String profileImage = profile != null && profile.has("profile_image_url") 
                    ? profile.get("profile_image_url").asText() : null;
            
            // 3. 소셜 로그인 처리
            UserDto.SocialLoginRequest socialRequest = UserDto.SocialLoginRequest.builder()
                    .provider("kakao")
                    .providerId(kakaoId)
                    .email(email)
                    .name(nickname)
                    .profileImage(profileImage)
                    .build();
            
            UserDto.LoginResponse response = socialLogin(socialRequest);
            
            // NEED_SIGNUP인 경우 추가 정보 포함
            if ("NEED_SIGNUP".equals(response.getMessage())) {
                return UserDto.LoginResponse.builder()
                        .success(false)
                        .message("NEED_SIGNUP")
                        .email(email)
                        .providerId(kakaoId)
                        .name(nickname)
                        .profileImage(profileImage)
                        .provider("kakao")
                        .build();
            }
            
            return response;
            
        } catch (Exception e) {
            return UserDto.LoginResponse.builder()
                    .success(false)
                    .message("카카오 로그인 처리 중 오류가 발생했습니다: " + e.getMessage())
                    .build();
        }
    }
    
    // 이메일 중복 체크
    @Transactional(readOnly = true)
    public UserDto.CheckDuplicateResponse checkEmailDuplicate(String email) {
        boolean exists = userRepository.existsByEmail(email);
        return new UserDto.CheckDuplicateResponse(
                exists,
                exists ? "이미 사용 중인 이메일입니다." : "사용 가능한 이메일입니다."
        );
    }
    
    // 닉네임 중복 체크
    @Transactional(readOnly = true)
    public UserDto.CheckDuplicateResponse checkNicknameDuplicate(String nickname) {
        boolean exists = userRepository.existsByNickname(nickname);
        return new UserDto.CheckDuplicateResponse(
                exists,
                exists ? "이미 사용 중인 닉네임입니다." : "사용 가능한 닉네임입니다."
        );
    }
    
    // 아이디 중복 체크
    @Transactional(readOnly = true)
    public UserDto.CheckDuplicateResponse checkUserIdDuplicate(String userId) {
        boolean exists = userRepository.existsByUserId(userId);
        return new UserDto.CheckDuplicateResponse(
                exists,
                exists ? "이미 사용 중인 아이디입니다." : "사용 가능한 아이디입니다."
        );
    }
    
    // 사용자 정보 조회
    @Transactional(readOnly = true)
    public UserDto.UserInfo getUserInfo(Integer userId) {
        return userRepository.findById(userId)
                .map(user -> UserDto.UserInfo.builder()
                        .id(user.getId())
                        .nickname(user.getNickname())
                        .email(user.getEmail())
                        .name(user.getName())
                        .phone(user.getPhone())
                        .status(user.getStatus())
                        .build())
                .orElse(null);
    }
    
    // 사용자가 작성한 플레이리스트 목록 조회
    @Transactional(readOnly = true)
    public List<PlaylistDto.PlaylistSummary> getUserPlaylists(Integer userId) {
        List<Playlist> playlists = playlistRepository.findByOwnerIdOrderByCreatedAtDesc(userId);
        return playlists.stream()
                .map(playlist -> {
                        // coverImageUrl이 없으면 첫번째 트랙의 albumImage 사용
                        String coverImage = playlist.getCoverImageUrl();
                        if (coverImage == null && playlist.getItems() != null && !playlist.getItems().isEmpty()) {
                            coverImage = playlist.getItems().get(0).getTrack().getAlbumImage();
                        }
                        return PlaylistDto.PlaylistSummary.builder()
                        .id(playlist.getId())
                        .title(playlist.getTitle())
                        .description(playlist.getDescription())
                        .coverImageUrl(coverImage)
                        .trackCount(playlist.getItems() != null ? playlist.getItems().size() : 0)
                        .likeCount(playlistLikeRepository.countByPlaylistId(playlist.getId()))
                        .createdAt(playlist.getCreatedAt() != null ? playlist.getCreatedAt().toString() : null)
                        .isPublic(playlist.getIsPublic())
                        .build();
                })
                .collect(Collectors.toList());
    }
    
    // 사용자가 좋아요한 플레이리스트 목록 조회
    @Transactional(readOnly = true)
    public List<PlaylistDto.PlaylistSummary> getUserLikedPlaylists(Integer userId) {
        List<PlaylistLike> likes = playlistLikeRepository.findByUserIdOrderByCreatedAtDesc(userId);
        return likes.stream()
                .map(like -> {
                    Playlist playlist = like.getPlaylist();
                    // coverImageUrl이 없으면 첫번째 트랙의 albumImage 사용
                    String coverImage = playlist.getCoverImageUrl();
                    if (coverImage == null && playlist.getItems() != null && !playlist.getItems().isEmpty()) {
                        coverImage = playlist.getItems().get(0).getTrack().getAlbumImage();
                    }
                    return PlaylistDto.PlaylistSummary.builder()
                            .id(playlist.getId())
                            .title(playlist.getTitle())
                            .description(playlist.getDescription())
                            .coverImageUrl(coverImage)
                            .trackCount(playlist.getItems() != null ? playlist.getItems().size() : 0)
                            .likeCount(playlistLikeRepository.countByPlaylistId(playlist.getId()))
                            .createdAt(playlist.getCreatedAt() != null ? playlist.getCreatedAt().toString() : null)
                            .build();
                })
                .collect(Collectors.toList());
    }
    
    // 사용자의 팔로워 목록 조회
    @Transactional(readOnly = true)
    public List<UserDto.UserSimple> getUserFollowers(Integer userId) {
        List<Follow> follows = followRepository.findByFollowingId(userId);
        return follows.stream()
                .map(follow -> {
                    User follower = follow.getFollower();
                    String avatar = profileRepository.findByUserId(follower.getId())
                            .map(profile -> profile.getImageUrl())
                            .orElse(null);
                    return UserDto.UserSimple.builder()
                            .id(follower.getId())
                            .nickname(follower.getNickname())
                            .avatar(avatar)
                            .build();
                })
                .collect(Collectors.toList());
    }
    
    // 사용자가 팔로잉하는 사용자 목록 조회
    @Transactional(readOnly = true)
    public List<UserDto.UserSimple> getUserFollowing(Integer userId) {
        List<Follow> follows = followRepository.findByFollowerId(userId);
        return follows.stream()
                .map(follow -> {
                    User following = follow.getFollowing();
                    String avatar = profileRepository.findByUserId(following.getId())
                            .map(profile -> profile.getImageUrl())
                            .orElse(null);
                    return UserDto.UserSimple.builder()
                            .id(following.getId())
                            .nickname(following.getNickname())
                            .avatar(avatar)
                            .build();
                })
                .collect(Collectors.toList());
    }
    
    @Transactional
    public UserDto.SendVerificationResponse sendVerificationCode(UserDto.SendVerificationRequest request) {
        String email = request.getEmail();
        String purpose = request.getPurpose();
        
        if ("FIND_ID".equals(purpose)) {
            if (!userRepository.existsByEmail(email)) {
                return UserDto.SendVerificationResponse.builder()
                        .success(false)
                        .message("해당 이메일로 가입된 계정이 없습니다.")
                        .build();
            }
        } else if ("RESET_PASSWORD".equals(purpose)) {
            if (!userRepository.existsByEmail(email)) {
                return UserDto.SendVerificationResponse.builder()
                        .success(false)
                        .message("해당 이메일로 가입된 계정이 없습니다.")
                        .build();
            }
        }
        
        try {
            emailService.sendVerificationCode(email, purpose);
            return UserDto.SendVerificationResponse.builder()
                    .success(true)
                    .message("인증번호가 이메일로 발송되었습니다.")
                    .build();
        } catch (Exception e) {
            return UserDto.SendVerificationResponse.builder()
                    .success(false)
                    .message("이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.")
                    .build();
        }
    }
    
    @Transactional
    public UserDto.VerifyCodeResponse verifyCode(UserDto.VerifyCodeRequest request) {
        boolean verified = emailService.verifyCode(request.getEmail(), request.getCode());
        
        if (verified) {
            return UserDto.VerifyCodeResponse.builder()
                    .success(true)
                    .verified(true)
                    .message("인증이 완료되었습니다.")
                    .build();
        }
        
        return UserDto.VerifyCodeResponse.builder()
                .success(false)
                .verified(false)
                .message("인증번호가 올바르지 않거나 만료되었습니다.")
                .build();
    }
    
    @Transactional(readOnly = true)
    public UserDto.FindIdResponse findUserId(UserDto.FindIdRequest request) {
        boolean verified = emailService.verifyCode(request.getEmail(), request.getCode());
        
        if (!verified) {
            return UserDto.FindIdResponse.builder()
                    .success(false)
                    .message("인증번호가 올바르지 않거나 만료되었습니다.")
                    .build();
        }
        
        return userRepository.findByEmail(request.getEmail())
                .map(user -> {
                    String userId = user.getUserId();
                    String maskedUserId = maskUserId(userId);
                    return UserDto.FindIdResponse.builder()
                            .success(true)
                            .message("아이디를 찾았습니다.")
                            .userId(userId)
                            .maskedUserId(maskedUserId)
                            .build();
                })
                .orElse(UserDto.FindIdResponse.builder()
                        .success(false)
                        .message("해당 이메일로 가입된 계정이 없습니다.")
                        .build());
    }
    
    @Transactional
    public UserDto.ResetPasswordResponse resetPassword(UserDto.ResetPasswordRequest request) {
        boolean verified = emailService.isVerified(request.getEmail());
        
        if (!verified) {
            return UserDto.ResetPasswordResponse.builder()
                    .success(false)
                    .message("이메일 인증이 완료되지 않았습니다.")
                    .build();
        }
        
        return userRepository.findByEmail(request.getEmail())
                .map(user -> {
                    user.setPassword(request.getNewPassword());
                    userRepository.save(user);
                    return UserDto.ResetPasswordResponse.builder()
                            .success(true)
                            .message("비밀번호가 성공적으로 변경되었습니다.")
                            .build();
                })
                .orElse(UserDto.ResetPasswordResponse.builder()
                        .success(false)
                        .message("해당 이메일로 가입된 계정이 없습니다.")
                        .build());
    }
    
    private String maskUserId(String visibleUserId) {
        if (visibleUserId == null || visibleUserId.length() <= 3) {
            return visibleUserId;
        }
        int visibleLength = Math.max(2, visibleUserId.length() / 3);
        String visible = visibleUserId.substring(0, visibleLength);
        String masked = "*".repeat(visibleUserId.length() - visibleLength);
        return visible + masked;
    }
    
    @Transactional
    public UserDto.DeleteAccountResponse deleteAccount(UserDto.DeleteAccountRequest request) {
        Optional<User> userOpt = userRepository.findById(request.getUserId());
        if (userOpt.isEmpty()) {
            return UserDto.DeleteAccountResponse.builder()
                    .success(false)
                    .message("사용자를 찾을 수 없습니다.")
                    .build();
        }
        
        User user = userOpt.get();
        Integer userId = user.getId();
        
        boolean isSocialUser = !oAuthAccountRepository.findByUserId(userId).isEmpty();
        if (!isSocialUser) {
            if (request.getPassword() == null || !user.getPassword().equals(request.getPassword())) {
                return UserDto.DeleteAccountResponse.builder()
                        .success(false)
                        .message("비밀번호가 일치하지 않습니다.")
                        .build();
            }
        }
        
        commentLikeRepository.deleteByUserId(userId);
        commentRepository.deleteByUserId(userId);
        playlistLikeRepository.deleteByUserId(userId);
        
        List<Playlist> playlists = playlistRepository.findByOwnerId(userId);
        playlistRepository.deleteAll(playlists);
        
        trackLikeRepository.deleteByUserId(userId);
        followRepository.deleteByFollowerId(userId);
        followRepository.deleteByFollowingId(userId);
        blockRepository.deleteByBlockerId(userId);
        blockRepository.deleteByBlockedId(userId);
        notificationRepository.deleteByUserId(userId.longValue());
        stationParticipantRepository.deleteByUserId(userId);
        stationBanRepository.deleteByUserId(userId);
        oAuthAccountRepository.deleteByUserId(userId);
        profileRepository.deleteByUserId(userId);
        
        entityManager.flush();
        entityManager.clear();
        
        userRepository.deleteById(userId);
        
        return UserDto.DeleteAccountResponse.builder()
                .success(true)
                .message("회원 탈퇴가 완료되었습니다.")
                .build();
    }
    
    @Transactional
    public UserDto.ReactivateAccountResponse reactivateAccount(UserDto.ReactivateAccountRequest request) {
        return userRepository.findById(request.getUserId())
                .map(user -> {
                    if (user.getDormantAt() == null) {
                        return UserDto.ReactivateAccountResponse.builder()
                                .success(false)
                                .message("휴면 상태가 아닌 계정입니다.")
                                .build();
                    }
                    
                    boolean isSocialUser = !oAuthAccountRepository.findByUserId(user.getId()).isEmpty();
                    if (!isSocialUser) {
                        if (request.getPassword() == null || !user.getPassword().equals(request.getPassword())) {
                            return UserDto.ReactivateAccountResponse.builder()
                                    .success(false)
                                    .message("비밀번호가 일치하지 않습니다.")
                                    .build();
                        }
                    }
                    
                    user.setDormantAt(null);
                    user.setStatus("ACTIVE");
                    user.setLastLoginAt(java.time.LocalDateTime.now());
                    userRepository.save(user);
                    
                    return UserDto.ReactivateAccountResponse.builder()
                            .success(true)
                            .message("휴면 해제가 완료되었습니다.")
                            .build();
                })
                .orElse(UserDto.ReactivateAccountResponse.builder()
                        .success(false)
                        .message("사용자를 찾을 수 없습니다.")
                        .build());
    }
    
    @Transactional(readOnly = true)
    public UserDto.LinkedOAuthListResponse getLinkedOAuthAccounts(Integer userId) {
        List<OAuthAccount> accounts = oAuthAccountRepository.findByUserId(userId);
        List<UserDto.LinkedOAuthAccount> linkedAccounts = accounts.stream()
                .map(account -> UserDto.LinkedOAuthAccount.builder()
                        .id(account.getId())
                        .provider(account.getProvider())
                        .providerUserId(account.getProviderUserId())
                        .linkedAt(account.getLinkedAt() != null ? account.getLinkedAt().toString() : null)
                        .build())
                .collect(Collectors.toList());
        
        return UserDto.LinkedOAuthListResponse.builder()
                .success(true)
                .accounts(linkedAccounts)
                .build();
    }
    
    @Transactional
    public UserDto.LinkOAuthResponse linkOAuthAccount(UserDto.LinkOAuthRequest request) {
        if (oAuthAccountRepository.existsByProviderAndProviderUserId(
                request.getProvider(), request.getProviderUserId())) {
            return UserDto.LinkOAuthResponse.builder()
                    .success(false)
                    .message("이미 다른 계정에 연동된 소셜 계정입니다.")
                    .build();
        }
        
        if (oAuthAccountRepository.existsByUserIdAndProvider(
                request.getUserId(), request.getProvider())) {
            return UserDto.LinkOAuthResponse.builder()
                    .success(false)
                    .message("이미 해당 소셜 서비스가 연동되어 있습니다.")
                    .build();
        }
        
        return userRepository.findById(request.getUserId())
                .map(user -> {
                    OAuthAccount account = OAuthAccount.builder()
                            .user(user)
                            .provider(request.getProvider())
                            .providerUserId(request.getProviderUserId())
                            .linkedAt(java.time.LocalDateTime.now())
                            .build();
                    oAuthAccountRepository.save(account);
                    
                    return UserDto.LinkOAuthResponse.builder()
                            .success(true)
                            .message("소셜 계정이 연동되었습니다.")
                            .build();
                })
                .orElse(UserDto.LinkOAuthResponse.builder()
                        .success(false)
                        .message("사용자를 찾을 수 없습니다.")
                        .build());
    }
    
    @Transactional
    public UserDto.UnlinkOAuthResponse unlinkOAuthAccount(UserDto.UnlinkOAuthRequest request) {
        if (!oAuthAccountRepository.existsByUserIdAndProvider(
                request.getUserId(), request.getProvider())) {
            return UserDto.UnlinkOAuthResponse.builder()
                    .success(false)
                    .message("연동된 소셜 계정이 없습니다.")
                    .build();
        }
        
        oAuthAccountRepository.deleteByUserIdAndProvider(request.getUserId(), request.getProvider());
        
        return UserDto.UnlinkOAuthResponse.builder()
                .success(true)
                .message("소셜 계정 연동이 해제되었습니다.")
                .build();
    }
}
