package com.plyst.controller;

import com.plyst.dto.UserDto;
import com.plyst.dto.PlaylistDto;
import com.plyst.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
    
    private final UserService userService;
    
    // 회원가입
    @PostMapping("/signup")
    public ResponseEntity<UserDto.SignupResponse> signup(@RequestBody UserDto.SignupRequest request) {
        UserDto.SignupResponse response = userService.signup(request);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }
    
    // 로그인
    @PostMapping("/login")
    public ResponseEntity<UserDto.LoginResponse> login(@RequestBody UserDto.LoginRequest request) {
        UserDto.LoginResponse response = userService.login(request);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }
    
    // 소셜 로그인 (구글, 카카오)
    @PostMapping("/social-login")
    public ResponseEntity<UserDto.LoginResponse> socialLogin(@RequestBody UserDto.SocialLoginRequest request) {
        UserDto.LoginResponse response = userService.socialLogin(request);
        // NEED_SIGNUP인 경우도 200으로 반환 (프론트엔드에서 처리)
        return ResponseEntity.ok(response);
    }
    
    // 소셜 회원가입
    @PostMapping("/social-signup")
    public ResponseEntity<UserDto.SignupResponse> socialSignup(@RequestBody UserDto.SocialSignupRequest request) {
        UserDto.SignupResponse response = userService.socialSignup(request);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }
    
    // 카카오 로그인 (서버에서 토큰 교환)
    @GetMapping("/kakao-login")
    public ResponseEntity<UserDto.LoginResponse> kakaoLogin(
            @RequestParam String code,
            @RequestParam String redirectUri) {
        UserDto.LoginResponse response = userService.kakaoLogin(code, redirectUri);
        return ResponseEntity.ok(response);
    }
    
    // 이메일 중복 체크
    @GetMapping("/check-email")
    public ResponseEntity<UserDto.CheckDuplicateResponse> checkEmail(@RequestParam String email) {
        return ResponseEntity.ok(userService.checkEmailDuplicate(email));
    }
    
    // 닉네임 중복 체크
    @GetMapping("/check-nickname")
    public ResponseEntity<UserDto.CheckDuplicateResponse> checkNickname(@RequestParam String nickname) {
        return ResponseEntity.ok(userService.checkNicknameDuplicate(nickname));
    }
    
    // 아이디 중복 체크
    @GetMapping("/check-userid")
    public ResponseEntity<UserDto.CheckDuplicateResponse> checkUserId(@RequestParam String userId) {
        return ResponseEntity.ok(userService.checkUserIdDuplicate(userId));
    }
    
    // 사용자 정보 조회
    @GetMapping("/{userId}")
    public ResponseEntity<UserDto.UserInfo> getUserInfo(@PathVariable Integer userId) {
        UserDto.UserInfo userInfo = userService.getUserInfo(userId);
        if (userInfo != null) {
            return ResponseEntity.ok(userInfo);
        }
        return ResponseEntity.notFound().build();
    }
    
    // 사용자가 작성한 플레이리스트 목록 조회
    @GetMapping("/{userId}/playlists")
    public ResponseEntity<List<PlaylistDto.PlaylistSummary>> getUserPlaylists(@PathVariable Integer userId) {
        List<PlaylistDto.PlaylistSummary> playlists = userService.getUserPlaylists(userId);
        return ResponseEntity.ok(playlists);
    }
    
    // 사용자가 좋아요한 플레이리스트 목록 조회
    @GetMapping("/{userId}/liked-playlists")
    public ResponseEntity<List<PlaylistDto.PlaylistSummary>> getUserLikedPlaylists(@PathVariable Integer userId) {
        List<PlaylistDto.PlaylistSummary> playlists = userService.getUserLikedPlaylists(userId);
        return ResponseEntity.ok(playlists);
    }
    
    // 사용자의 팔로워 목록 조회
    @GetMapping("/{userId}/followers")
    public ResponseEntity<List<UserDto.UserSimple>> getUserFollowers(@PathVariable Integer userId) {
        List<UserDto.UserSimple> followers = userService.getUserFollowers(userId);
        return ResponseEntity.ok(followers);
    }
    
    // 사용자가 팔로잉하는 사용자 목록 조회
    @GetMapping("/{userId}/following")
    public ResponseEntity<List<UserDto.UserSimple>> getUserFollowing(@PathVariable Integer userId) {
        List<UserDto.UserSimple> following = userService.getUserFollowing(userId);
        return ResponseEntity.ok(following);
    }
    
    @PostMapping("/send-verification")
    public ResponseEntity<UserDto.SendVerificationResponse> sendVerification(
            @RequestBody UserDto.SendVerificationRequest request) {
        UserDto.SendVerificationResponse response = userService.sendVerificationCode(request);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }
    
    @PostMapping("/verify-code")
    public ResponseEntity<UserDto.VerifyCodeResponse> verifyCode(
            @RequestBody UserDto.VerifyCodeRequest request) {
        UserDto.VerifyCodeResponse response = userService.verifyCode(request);
        return ResponseEntity.ok(response);
    }
    
    @PostMapping("/find-id")
    public ResponseEntity<UserDto.FindIdResponse> findUserId(
            @RequestBody UserDto.FindIdRequest request) {
        UserDto.FindIdResponse response = userService.findUserId(request);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }
    
    @PostMapping("/reset-password")
    public ResponseEntity<UserDto.ResetPasswordResponse> resetPassword(
            @RequestBody UserDto.ResetPasswordRequest request) {
        UserDto.ResetPasswordResponse response = userService.resetPassword(request);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }
    
    @PostMapping("/delete-account")
    public ResponseEntity<UserDto.DeleteAccountResponse> deleteAccount(
            @RequestBody UserDto.DeleteAccountRequest request) {
        UserDto.DeleteAccountResponse response = userService.deleteAccount(request);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }
    
    @PostMapping("/reactivate-account")
    public ResponseEntity<UserDto.ReactivateAccountResponse> reactivateAccount(
            @RequestBody UserDto.ReactivateAccountRequest request) {
        UserDto.ReactivateAccountResponse response = userService.reactivateAccount(request);
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }
}
