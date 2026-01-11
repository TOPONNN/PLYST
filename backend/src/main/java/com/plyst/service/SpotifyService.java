package com.plyst.service;

import com.plyst.config.SpotifyProperties;
import com.plyst.dto.SpotifyDto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings({"unchecked", "null"})
public class SpotifyService {

    private final RestTemplate restTemplate;
    private final SpotifyProperties spotifyProperties;

    private static final String TOKEN_URL = "https://accounts.spotify.com/api/token";
    private static final String API_URL = "https://api.spotify.com/v1/";

    public String getAccessToken() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        String auth = spotifyProperties.getClientId() + ":" + spotifyProperties.getClientSecret();
        String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes(StandardCharsets.UTF_8));
        headers.set("Authorization", "Basic " + encodedAuth);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "client_credentials");

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);
        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                TOKEN_URL, HttpMethod.POST, request, 
                new ParameterizedTypeReference<Map<String, Object>>() {});
        
        Map<String, Object> responseBody = response.getBody();
        return responseBody != null ? (String) responseBody.get("access_token") : null;
    }

    public List<PlaylistResponse> searchPlaylists(String keyword, int offset) {
        String token = getAccessToken();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(Objects.requireNonNull(token));

        String url = API_URL + "search?q=" + keyword + "&type=playlist&limit=50&offset=" + (offset * 50) + "&market=KR";
        HttpEntity<?> entity = new HttpEntity<>(headers);

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                url, HttpMethod.GET, entity, 
                new ParameterizedTypeReference<Map<String, Object>>() {});
        
        Map<String, Object> responseBody = response.getBody();
        if (responseBody == null) return new ArrayList<>();
        
        Map<String, Object> playlists = (Map<String, Object>) responseBody.get("playlists");
        List<Map<String, Object>> items = (List<Map<String, Object>>) playlists.get("items");

        List<PlaylistResponse> result = new ArrayList<>();
        for (Map<String, Object> item : items) {
            if (item == null) continue;
            
            List<Map<String, Object>> images = (List<Map<String, Object>>) item.get("images");
            String imageUrl = (images != null && !images.isEmpty()) ? (String) images.get(0).get("url") : "";
            Map<String, Object> owner = (Map<String, Object>) item.get("owner");

            result.add(PlaylistResponse.builder()
                    .id((String) item.get("id"))
                    .name((String) item.get("name"))
                    .image(imageUrl)
                    .owner((String) owner.get("display_name"))
                    .build());
        }
        return result;
    }

    public List<TrackResponse> getPlaylistTracks(String playlistId) {
        String token = getAccessToken();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(Objects.requireNonNull(token));
        HttpEntity<?> entity = new HttpEntity<>(headers);

        // 먼저 총 트랙 수 확인
        String firstUrl = API_URL + "playlists/" + playlistId + "/tracks?limit=100&market=KR";
        ResponseEntity<Map<String, Object>> firstResponse = restTemplate.exchange(
                firstUrl, HttpMethod.GET, entity, 
                new ParameterizedTypeReference<Map<String, Object>>() {});
        
        Map<String, Object> firstBody = firstResponse.getBody();
        if (firstBody == null) return new ArrayList<>();
        
        int total = (int) firstBody.get("total");

        List<TrackResponse> allTracks = new ArrayList<>();
        
        for (int i = 0; i < Math.ceil(total / 100.0); i++) {
            String url = API_URL + "playlists/" + playlistId + "/tracks?offset=" + (i * 100) + "&market=KR";
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url, HttpMethod.GET, entity, 
                    new ParameterizedTypeReference<Map<String, Object>>() {});
            
            Map<String, Object> responseBody = response.getBody();
            if (responseBody == null) continue;
            
            List<Map<String, Object>> items = (List<Map<String, Object>>) responseBody.get("items");

            for (Map<String, Object> item : items) {
                Map<String, Object> track = (Map<String, Object>) item.get("track");
                if (track == null) continue;
                
                Map<String, Object> album = (Map<String, Object>) track.get("album");
                List<Map<String, Object>> images = (List<Map<String, Object>>) album.get("images");
                if (images == null || images.isEmpty()) continue;
                
                List<Map<String, Object>> artists = (List<Map<String, Object>>) track.get("artists");

                allTracks.add(TrackResponse.builder()
                        .title((String) track.get("name"))
                        .album(AlbumInfo.builder()
                                .title((String) album.get("name"))
                                .image((String) images.get(0).get("url"))
                                .build())
                        .artists((String) artists.get(0).get("name"))
                        .build());
            }
        }
        return allTracks;
    }

    public TrackInfoResponse getTrackInfo(String title, String artist) {
        try {
            String token = getAccessToken();
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(Objects.requireNonNull(token));
            HttpEntity<?> entity = new HttpEntity<>(headers);

            String searchQuery = (title + " " + artist).replaceAll("\\s+", " ").trim();
            String url = API_URL + "search?q=" + searchQuery + "&type=track&limit=1&market=KR";

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url, HttpMethod.GET, entity, 
                    new ParameterizedTypeReference<Map<String, Object>>() {});
            
            Map<String, Object> responseBody = response.getBody();
            if (responseBody == null) {
                return TrackInfoResponse.builder().albumImage("").build();
            }
            
            Map<String, Object> tracks = (Map<String, Object>) responseBody.get("tracks");
            List<Map<String, Object>> items = (List<Map<String, Object>>) tracks.get("items");

            if (items != null && !items.isEmpty()) {
                Map<String, Object> track = items.get(0);
                Map<String, Object> album = (Map<String, Object>) track.get("album");
                List<Map<String, Object>> images = (List<Map<String, Object>>) album.get("images");
                List<Map<String, Object>> artists = (List<Map<String, Object>>) track.get("artists");

                return TrackInfoResponse.builder()
                        .title((String) track.get("name"))
                        .artist((String) artists.get(0).get("name"))
                        .album((String) album.get("name"))
                        .albumImage((images != null && !images.isEmpty()) ? (String) images.get(0).get("url") : "")
                        .duration(((Number) track.get("duration_ms")).longValue())
                        .build();
            }
        } catch (Exception e) {
            log.error("트랙 정보 검색 오류: {}", e.getMessage());
        }
        return TrackInfoResponse.builder().albumImage("").build();
    }

    private static final String KOREA_TOP_50_PLAYLIST_ID = "20R8anptqFQTGk4P2X6dRp";

    public List<TrackInfoResponse> getKoreaChart(int limit) {
        try {
            String token = getAccessToken();
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(Objects.requireNonNull(token));
            HttpEntity<?> entity = new HttpEntity<>(headers);

            String url = API_URL + "playlists/" + KOREA_TOP_50_PLAYLIST_ID + "/tracks?limit=" + limit + "&market=KR";

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url, HttpMethod.GET, entity,
                    new ParameterizedTypeReference<Map<String, Object>>() {});

            Map<String, Object> responseBody = response.getBody();
            if (responseBody == null) {
                return new ArrayList<>();
            }

            List<Map<String, Object>> items = (List<Map<String, Object>>) responseBody.get("items");
            List<TrackInfoResponse> result = new ArrayList<>();

            if (items != null) {
                for (Map<String, Object> item : items) {
                    Map<String, Object> track = (Map<String, Object>) item.get("track");
                    if (track == null) continue;

                    Map<String, Object> album = (Map<String, Object>) track.get("album");
                    List<Map<String, Object>> images = (List<Map<String, Object>>) album.get("images");
                    List<Map<String, Object>> artists = (List<Map<String, Object>>) track.get("artists");

                    result.add(TrackInfoResponse.builder()
                            .title((String) track.get("name"))
                            .artist((String) artists.get(0).get("name"))
                            .album((String) album.get("name"))
                            .albumImage((images != null && !images.isEmpty()) ? (String) images.get(0).get("url") : "")
                            .duration(((Number) track.get("duration_ms")).longValue())
                            .build());
                }
            }
            return result;
        } catch (Exception e) {
            log.error("한국 차트 조회 오류: {} - {}", e.getClass().getSimpleName(), e.getMessage());
            e.printStackTrace();
        }
        return new ArrayList<>();
    }

    public List<TrackInfoResponse> searchTracks(String query, int limit) {
        try {
            String token = getAccessToken();
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(Objects.requireNonNull(token));
            HttpEntity<?> entity = new HttpEntity<>(headers);

            String searchQuery = query.replaceAll("\\s+", " ").trim();
            String url = API_URL + "search?q=" + searchQuery + "&type=track&limit=" + limit + "&market=KR";

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url, HttpMethod.GET, entity, 
                    new ParameterizedTypeReference<Map<String, Object>>() {});
            
            Map<String, Object> responseBody = response.getBody();
            if (responseBody == null) {
                return new ArrayList<>();
            }
            
            Map<String, Object> tracks = (Map<String, Object>) responseBody.get("tracks");
            List<Map<String, Object>> items = (List<Map<String, Object>>) tracks.get("items");

            List<TrackInfoResponse> result = new ArrayList<>();
            if (items != null) {
                for (Map<String, Object> track : items) {
                    Map<String, Object> album = (Map<String, Object>) track.get("album");
                    List<Map<String, Object>> images = (List<Map<String, Object>>) album.get("images");
                    List<Map<String, Object>> artists = (List<Map<String, Object>>) track.get("artists");

                    result.add(TrackInfoResponse.builder()
                            .title((String) track.get("name"))
                            .artist((String) artists.get(0).get("name"))
                            .album((String) album.get("name"))
                            .albumImage((images != null && !images.isEmpty()) ? (String) images.get(0).get("url") : "")
                            .duration(((Number) track.get("duration_ms")).longValue())
                            .build());
                }
            }
            return result;
        } catch (Exception e) {
            log.error("트랙 검색 오류: {}", e.getMessage());
        }
        return new ArrayList<>();
    }
}
