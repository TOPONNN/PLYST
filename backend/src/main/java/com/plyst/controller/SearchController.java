package com.plyst.controller;

import com.plyst.dto.SpotifyDto.*;
import com.plyst.service.SpotifyService;
import com.plyst.service.YoutubeService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class SearchController {

    private final SpotifyService spotifyService;
    private final YoutubeService youtubeService;

    @GetMapping("/")
    public String home() {
        return "PLYST Backend Server Running";
    }

    // Spotify 플레이리스트 검색
    @GetMapping("/search/playlist/{keyword}")
    public List<PlaylistResponse> searchPlaylist(
            @PathVariable String keyword,
            @RequestParam(defaultValue = "0") int offset) {
        return spotifyService.searchPlaylists(keyword, offset);
    }

    // 플레이리스트 트랙 가져오기
    @GetMapping("/search/tracks/{id}")
    public List<TrackResponse> getPlaylistTracks(@PathVariable String id) {
        return spotifyService.getPlaylistTracks(id);
    }

    // YouTube 비디오 ID 검색
    @GetMapping("/search/track")
    public String findYoutubeVideo(
            @RequestParam String title,
            @RequestParam String artist) {
        return youtubeService.findVideoId(title, artist);
    }

    // 트랙 정보 검색 (앨범 이미지 등)
    @GetMapping("/search/track/info")
    public TrackInfoResponse getTrackInfo(
            @RequestParam String title,
            @RequestParam String artist) {
        return spotifyService.getTrackInfo(title, artist);
    }

    // 여러 트랙 검색
    @GetMapping("/search/tracks")
    public List<TrackInfoResponse> searchTracks(
            @RequestParam String query,
            @RequestParam(defaultValue = "15") int limit) {
        return spotifyService.searchTracks(query, limit);
    }

    @GetMapping("/search/chart/korea")
    public List<TrackInfoResponse> getKoreaChart(
            @RequestParam(defaultValue = "20") int limit) {
        return spotifyService.getKoreaChart(limit);
    }
}
