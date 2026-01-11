package com.plyst.dto;

import lombok.*;

public class UserDto {
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SignupRequest {
        private String nickname;
        private String userId;  // 이메일 대신 사용자 ID
        private String email;
        private String password;
        private String realName;
        private String phoneNumber;
        private String gender;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SignupResponse {
        private Integer id;
        private String nickname;
        private String email;
        private String message;
        private boolean success;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LoginRequest {
        private String userId;
        private String password;
        private boolean rememberMe;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LoginResponse {
        private Integer id;
        private String nickname;
        private String email;
        private String token;
        private boolean success;
        private String message;
        private String profileImage;
        // 소셜 로그인 NEED_SIGNUP 시 사용
        private String providerId;
        private String name;
        // 휴면계정 여부
        private boolean isDormant;
        // 소셜 로그인 제공자 (google, kakao)
        private String provider;
    }
    
    // 소셜 로그인 요청
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SocialLoginRequest {
        private String provider;      // "google" 또는 "kakao"
        private String providerId;    // 소셜 제공자의 고유 ID
        private String email;         // 이메일
        private String name;          // 이름
        private String profileImage;  // 프로필 이미지 URL
    }
    
    // 소셜 회원가입 요청 (추가 정보 입력용)
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SocialSignupRequest {
        private String provider;
        private String providerId;
        private String email;
        private String name;
        private String nickname;
        private String profileImage;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CheckDuplicateResponse {
        private boolean exists;
        private String message;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UserInfo {
        private Integer id;
        private String nickname;
        private String email;
        private String name;
        private String phone;
        private String status;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UserSimple {
        private Integer id;
        private String nickname;
        private String avatar;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SendVerificationRequest {
        private String email;
        private String purpose;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SendVerificationResponse {
        private boolean success;
        private String message;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VerifyCodeRequest {
        private String email;
        private String code;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class VerifyCodeResponse {
        private boolean success;
        private String message;
        private boolean verified;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FindIdRequest {
        private String email;
        private String code;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class FindIdResponse {
        private boolean success;
        private String message;
        private String userId;
        private String maskedUserId;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ResetPasswordRequest {
        private String email;
        private String code;
        private String newPassword;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ResetPasswordResponse {
        private boolean success;
        private String message;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DeleteAccountRequest {
        private Integer userId;
        private String password;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DeleteAccountResponse {
        private boolean success;
        private String message;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReactivateAccountRequest {
        private Integer userId;
        private String password;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ReactivateAccountResponse {
        private boolean success;
        private String message;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LinkedOAuthAccount {
        private Integer id;
        private String provider;
        private String providerUserId;
        private String linkedAt;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LinkOAuthRequest {
        private Integer userId;
        private String provider;
        private String providerUserId;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LinkOAuthResponse {
        private boolean success;
        private String message;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UnlinkOAuthRequest {
        private Integer userId;
        private String provider;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UnlinkOAuthResponse {
        private boolean success;
        private String message;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LinkedOAuthListResponse {
        private boolean success;
        private java.util.List<LinkedOAuthAccount> accounts;
    }
}
