package com.plyst.service;

import com.plyst.dto.StationDto.*;
import com.plyst.entity.*;
import com.plyst.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional
@SuppressWarnings("null")
public class StationService {

    private final StationRepository stationRepository;
    private final StationParticipantRepository participantRepository;
    private final StationPlaybackRepository playbackRepository;
    private final StationBanRepository banRepository;
    private final UserRepository userRepository;
    private final TrackRepository trackRepository;
    private final BlockService blockService;

    private static final String INVITE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int INVITE_CODE_LENGTH = 6;
    private static final SecureRandom RANDOM = new SecureRandom();

    public CreateStationResponse createStation(Integer userId, CreateStationRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        String inviteCode = generateUniqueInviteCode();
        int maxParticipants = request.getMaxParticipants() != null ? request.getMaxParticipants() : 10;
        boolean isPrivate = Boolean.TRUE.equals(request.getIsPrivate());

        Station station = Station.builder()
                .title(request.getTitle())
                .inviteCode(inviteCode)
                .maxParticipants(maxParticipants)
                .status("ACTIVE")
                .isPrivate(isPrivate)
                .build();

        station = stationRepository.save(station);

        StationParticipant hostParticipant = StationParticipant.builder()
                .station(station)
                .user(user)
                .role("HOST")
                .joinedAt(LocalDateTime.now())
                .lastActiveAt(LocalDateTime.now())
                .build();

        participantRepository.save(hostParticipant);

        return CreateStationResponse.builder()
                .id(station.getId())
                .inviteCode(station.getInviteCode())
                .build();
    }

    @Transactional(readOnly = true)
    public List<StationListItemResponse> getActiveStations() {
        List<Station> stations = stationRepository.findByStatusOrderByCreatedAtDesc("ACTIVE");

        return stations.stream()
                .filter(station -> !Boolean.TRUE.equals(station.getIsPrivate()))
                .map(this::toStationListItemResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public StationDetailResponse getStationDetail(Integer stationId) {
        Station station = stationRepository.findById(stationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Station not found"));

        return toStationDetailResponse(station);
    }

    public StationDetailResponse joinStation(Integer userId, String inviteCode) {
        Station station = stationRepository.findByInviteCode(inviteCode.toUpperCase())
                .orElseThrow(() -> new RuntimeException("Station not found with this invite code"));

        if (!"ACTIVE".equals(station.getStatus())) {
            throw new RuntimeException("Station is not active");
        }

        long currentParticipants = participantRepository.countByStationId(station.getId());
        if (currentParticipants >= station.getMaxParticipants()) {
            throw new RuntimeException("Station is full");
        }

        if (participantRepository.existsByStationIdAndUserId(station.getId(), userId)) {
            return toStationDetailResponse(station);
        }

        if (banRepository.existsByStationIdAndUserId(station.getId(), userId)) {
            throw new RuntimeException("You are banned from this station");
        }

        StationParticipant hostParticipant = participantRepository.findByStationIdAndRole(station.getId(), "HOST")
                .orElse(null);
        if (hostParticipant != null && blockService.isBlocked(hostParticipant.getUser().getId(), userId)) {
            throw new RuntimeException("You cannot join this station");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        StationParticipant participant = StationParticipant.builder()
                .station(station)
                .user(user)
                .role("MEMBER")
                .joinedAt(LocalDateTime.now())
                .lastActiveAt(LocalDateTime.now())
                .build();

        participantRepository.save(participant);

        return toStationDetailResponse(station);
    }

    public Integer leaveStation(Integer stationId, Integer userId) {
        Optional<Station> stationOpt = stationRepository.findById(stationId);
        if (stationOpt.isEmpty()) {
            return null;
        }

        Optional<StationParticipant> participantOpt = participantRepository.findByStationIdAndUserId(stationId, userId);
        if (participantOpt.isEmpty()) {
            return null;
        }
        StationParticipant participant = participantOpt.get();

        if ("HOST".equals(participant.getRole())) {
            List<StationParticipant> otherParticipants = participantRepository.findByStationId(stationId)
                    .stream()
                    .filter(p -> !p.getUser().getId().equals(userId))
                    .toList();
            
            if (otherParticipants.isEmpty()) {
                closeStation(stationId);
                return null;
            } else {
                StationParticipant newHost = otherParticipants.get(RANDOM.nextInt(otherParticipants.size()));
                newHost.setRole("HOST");
                participantRepository.save(newHost);
                participantRepository.deleteByStationIdAndUserId(stationId, userId);
                return newHost.getUser().getId();
            }
        } else {
            participantRepository.deleteByStationIdAndUserId(stationId, userId);
            return null;
        }
    }

    public Integer transferHost(Integer stationId, Integer currentHostId, Integer newHostId) {
        stationRepository.findById(stationId)
                .orElseThrow(() -> new RuntimeException("Station not found"));

        StationParticipant currentHost = participantRepository.findByStationIdAndUserId(stationId, currentHostId)
                .orElseThrow(() -> new RuntimeException("Current host not found"));

        if (!"HOST".equals(currentHost.getRole())) {
            throw new RuntimeException("Only host can transfer host privileges");
        }

        StationParticipant newHost = participantRepository.findByStationIdAndUserId(stationId, newHostId)
                .orElseThrow(() -> new RuntimeException("New host not found"));

        currentHost.setRole("MEMBER");
        newHost.setRole("HOST");
        participantRepository.save(currentHost);
        participantRepository.save(newHost);

        return newHostId;
    }

    public void banUser(Integer stationId, Integer hostUserId, Integer targetUserId) {
        Station station = stationRepository.findById(stationId)
                .orElseThrow(() -> new RuntimeException("Station not found"));

        StationParticipant hostParticipant = participantRepository.findByStationIdAndUserId(stationId, hostUserId)
                .orElseThrow(() -> new RuntimeException("Host not found"));

        if (!"HOST".equals(hostParticipant.getRole())) {
            throw new RuntimeException("Only host can ban users");
        }

        if (hostUserId.equals(targetUserId)) {
            throw new RuntimeException("Cannot ban yourself");
        }

        User targetUser = userRepository.findById(targetUserId)
                .orElseThrow(() -> new RuntimeException("Target user not found"));

        if (!banRepository.existsByStationIdAndUserId(stationId, targetUserId)) {
            StationBan ban = StationBan.builder()
                    .station(station)
                    .user(targetUser)
                    .build();
            banRepository.save(ban);
        }

        participantRepository.deleteByStationIdAndUserId(stationId, targetUserId);
    }

    public void unbanUser(Integer stationId, Integer hostUserId, Integer targetUserId) {
        stationRepository.findById(stationId)
                .orElseThrow(() -> new RuntimeException("Station not found"));

        StationParticipant hostParticipant = participantRepository.findByStationIdAndUserId(stationId, hostUserId)
                .orElseThrow(() -> new RuntimeException("Host not found"));

        if (!"HOST".equals(hostParticipant.getRole())) {
            throw new RuntimeException("Only host can unban users");
        }

        banRepository.deleteByStationIdAndUserId(stationId, targetUserId);
    }

    public List<BannedUserInfo> getBannedUsers(Integer stationId) {
        return banRepository.findByStationId(stationId).stream()
                .map(this::toBannedUserInfo)
                .toList();
    }

    public void deleteStation(Integer stationId, Integer userId) {
        Station station = stationRepository.findById(stationId)
                .orElseThrow(() -> new RuntimeException("Station not found"));

        StationParticipant hostParticipant = participantRepository.findByStationIdAndUserId(stationId, userId)
                .orElseThrow(() -> new RuntimeException("Participant not found"));

        if (!"HOST".equals(hostParticipant.getRole())) {
            throw new RuntimeException("Only host can delete the station");
        }

        closeStation(stationId);
    }

    public String updateTitle(Integer stationId, Integer userId, String newTitle) {
        Station station = stationRepository.findById(stationId)
                .orElseThrow(() -> new RuntimeException("Station not found"));

        StationParticipant hostParticipant = participantRepository.findByStationIdAndUserId(stationId, userId)
                .orElseThrow(() -> new RuntimeException("Participant not found"));

        if (!"HOST".equals(hostParticipant.getRole())) {
            throw new RuntimeException("Only host can update the station title");
        }

        station.setTitle(newTitle);
        stationRepository.save(station);
        return newTitle;
    }

    private void closeStation(Integer stationId) {
        playbackRepository.deleteByStationId(stationId);
        participantRepository.deleteByStationId(stationId);
        banRepository.deleteByStationId(stationId);
        stationRepository.deleteById(stationId);
    }

    public void updatePlayback(Integer stationId, PlaybackUpdateMessage playbackUpdate) {
        Station station = stationRepository.findById(stationId)
                .orElseThrow(() -> new RuntimeException("Station not found"));

        StationPlayback playback = playbackRepository.findByStationId(stationId)
                .orElse(null);

        Track track = null;
        if (playbackUpdate.getTrackId() != null) {
            track = trackRepository.findById(playbackUpdate.getTrackId()).orElse(null);
        }

        if (track == null && playbackUpdate.getTitle() != null && playbackUpdate.getArtist() != null) {
            track = trackRepository.findByTitleAndArtist(playbackUpdate.getTitle(), playbackUpdate.getArtist())
                    .orElseGet(() -> trackRepository.save(Track.builder()
                            .title(playbackUpdate.getTitle())
                            .artist(playbackUpdate.getArtist())
                            .albumImage(playbackUpdate.getAlbumImage())
                            .durationSec(playbackUpdate.getDurationSec())
                            .build()));
        }

        if (playback == null && track != null) {
            playback = StationPlayback.builder()
                    .station(station)
                    .track(track)
                    .positionMs(playbackUpdate.getPositionMs() != null ? playbackUpdate.getPositionMs() : 0)
                    .isPlaying(playbackUpdate.getIsPlaying() != null ? playbackUpdate.getIsPlaying() : false)
                    .build();
        } else if (playback != null) {
            if (track != null) {
                playback.setTrack(track);
            }
            if (playbackUpdate.getPositionMs() != null) {
                playback.setPositionMs(playbackUpdate.getPositionMs());
            }
            if (playbackUpdate.getIsPlaying() != null) {
                playback.setIsPlaying(playbackUpdate.getIsPlaying());
            }
        }

        if (playback != null) {
            playbackRepository.save(playback);
        }
    }

    public void updateParticipantActivity(Integer stationId, Integer userId) {
        participantRepository.findByStationIdAndUserId(stationId, userId)
                .ifPresent(participant -> {
                    participant.setLastActiveAt(LocalDateTime.now());
                    participantRepository.save(participant);
                });
    }

    public List<ParticipantInfo> getParticipants(Integer stationId) {
        return participantRepository.findByStationId(stationId).stream()
                .map(this::toParticipantInfo)
                .toList();
    }

    public boolean isHost(Integer stationId, Integer userId) {
        return participantRepository.findByStationIdAndUserId(stationId, userId)
                .map(p -> "HOST".equals(p.getRole()))
                .orElse(false);
    }

    private String generateUniqueInviteCode() {
        String code;
        do {
            code = generateInviteCode();
        } while (stationRepository.findByInviteCode(code).isPresent());
        return code;
    }

    private String generateInviteCode() {
        StringBuilder sb = new StringBuilder(INVITE_CODE_LENGTH);
        for (int i = 0; i < INVITE_CODE_LENGTH; i++) {
            sb.append(INVITE_CODE_CHARS.charAt(RANDOM.nextInt(INVITE_CODE_CHARS.length())));
        }
        return sb.toString();
    }

    private StationListItemResponse toStationListItemResponse(Station station) {
        StationParticipant hostParticipant = participantRepository.findByStationIdAndRole(station.getId(), "HOST")
                .orElse(null);

        UserInfo hostInfo = null;
        String hostNickname = null;
        if (hostParticipant != null) {
            User host = hostParticipant.getUser();
            hostNickname = host.getNickname();
            hostInfo = UserInfo.builder()
                    .id(host.getId())
                    .nickname(host.getNickname())
                    .avatar(host.getProfile() != null ? host.getProfile().getImageUrl() : null)
                    .build();
        }

        long participantCount = participantRepository.countByStationId(station.getId());

        return StationListItemResponse.builder()
                .id(station.getId())
                .title(station.getTitle())
                .inviteCode(station.getInviteCode())
                .hostNickname(hostNickname)
                .participantCount((int) participantCount)
                .maxParticipants(station.getMaxParticipants())
                .isLive("ACTIVE".equals(station.getStatus()))
                .isPrivate(Boolean.TRUE.equals(station.getIsPrivate()))
                .host(hostInfo)
                .createdAt(station.getCreatedAt().toString())
                .build();
    }

    private StationDetailResponse toStationDetailResponse(Station station) {
        StationParticipant hostParticipant = participantRepository.findByStationIdAndRole(station.getId(), "HOST")
                .orElse(null);

        UserInfo hostInfo = null;
        if (hostParticipant != null) {
            User host = hostParticipant.getUser();
            hostInfo = UserInfo.builder()
                    .id(host.getId())
                    .nickname(host.getNickname())
                    .avatar(host.getProfile() != null ? host.getProfile().getImageUrl() : null)
                    .build();
        }

        List<ParticipantInfo> participants = participantRepository.findByStationId(station.getId()).stream()
                .map(this::toParticipantInfo)
                .toList();

        List<BannedUserInfo> bannedUsers = banRepository.findByStationId(station.getId()).stream()
                .map(this::toBannedUserInfo)
                .toList();

        PlaybackInfo playbackInfo = playbackRepository.findByStationId(station.getId())
                .map(this::toPlaybackInfo)
                .orElse(null);

        return StationDetailResponse.builder()
                .id(station.getId())
                .title(station.getTitle())
                .inviteCode(station.getInviteCode())
                .maxParticipants(station.getMaxParticipants())
                .status(station.getStatus())
                .host(hostInfo)
                .participants(participants)
                .bannedUsers(bannedUsers)
                .playback(playbackInfo)
                .createdAt(station.getCreatedAt().toString())
                .build();
    }

    private ParticipantInfo toParticipantInfo(StationParticipant participant) {
        User user = participant.getUser();
        return ParticipantInfo.builder()
                .id(user.getId())
                .nickname(user.getNickname())
                .avatar(user.getProfile() != null ? user.getProfile().getImageUrl() : null)
                .role(participant.getRole())
                .joinedAt(participant.getJoinedAt().toString())
                .build();
    }

    private PlaybackInfo toPlaybackInfo(StationPlayback playback) {
        Track track = playback.getTrack();
        return PlaybackInfo.builder()
                .trackId(track.getId())
                .title(track.getTitle())
                .artist(track.getArtist())
                .albumImage(track.getAlbumImage())
                .durationSec(track.getDurationSec())
                .positionMs(playback.getPositionMs())
                .isPlaying(playback.getIsPlaying())
                .updatedAt(playback.getUpdatedAt().toString())
                .build();
    }

    private BannedUserInfo toBannedUserInfo(StationBan ban) {
        User user = ban.getUser();
        return BannedUserInfo.builder()
                .id(user.getId())
                .nickname(user.getNickname())
                .avatar(user.getProfile() != null ? user.getProfile().getImageUrl() : null)
                .bannedAt(ban.getBannedAt().toString())
                .build();
    }
}
