package com.plyst.controller;

import com.plyst.dto.ProfileDto;
import com.plyst.service.ProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {
    
    private final ProfileService profileService;
    
    // 프로필 조회
    @GetMapping("/{userId}")
    public ResponseEntity<ProfileDto.ProfileResponse> getProfile(@PathVariable Integer userId) {
        ProfileDto.ProfileResponse profile = profileService.getProfile(userId);
        if (profile == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(profile);
    }
    
    // 프로필 수정
    @PutMapping("/{userId}")
    public ResponseEntity<ProfileDto.UpdateProfileResponse> updateProfile(
            @PathVariable Integer userId,
            @RequestBody ProfileDto.UpdateProfileRequest request) {
        ProfileDto.UpdateProfileResponse response = profileService.updateProfile(userId, request);
        return ResponseEntity.ok(response);
    }
}
