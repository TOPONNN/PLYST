package com.plyst.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plyst.config.OpenAIProperties;
import com.plyst.config.BraveSearchProperties;
import com.plyst.dto.AIRecommendDto.*;
import com.plyst.dto.SpotifyDto.TrackInfoResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class ChatGPTService {

    private final RestTemplate restTemplate;
    private final OpenAIProperties openAIProperties;
    private final BraveSearchProperties braveSearchProperties;
    private final ObjectMapper objectMapper;
    private final SpotifyService spotifyService;

    private static final String OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
    private static final String BRAVE_IMAGE_SEARCH_URL = "https://api.search.brave.com/res/v1/images/search";

    public AIPlaylistResponse recommendPlaylist(List<String> tags) {
        try {
            String apiKey = openAIProperties.getApiKey();
            if (apiKey == null || apiKey.isEmpty()) {
                log.error("OpenAI API 키가 설정되지 않았습니다.");
                return createFallbackResponse(tags);
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiKey);

            String prompt = createPrompt(tags);
            
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", "gpt-5.2");
            requestBody.put("temperature", 0.8);
            requestBody.put("max_completion_tokens", 2000);
            
            List<Map<String, String>> messages = new ArrayList<>();
            Map<String, String> systemMessage = new HashMap<>();
            systemMessage.put("role", "system");
            systemMessage.put("content", "당신은 음악 전문가입니다. 사용자의 요청에 맞는 플레이리스트를 추천해주세요. 반드시 JSON 형식으로만 응답하세요.");
            messages.add(systemMessage);
            
            Map<String, String> userMessage = new HashMap<>();
            userMessage.put("role", "user");
            userMessage.put("content", prompt);
            messages.add(userMessage);
            
            requestBody.put("messages", messages);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    OPENAI_API_URL,
                    HttpMethod.POST,
                    entity,
                    String.class
            );

            return parseResponse(response.getBody(), tags);

        } catch (Exception e) {
            log.error("ChatGPT API 호출 오류: {}", e.getMessage());
            return createFallbackResponse(tags);
        }
    }

    private String createPrompt(List<String> tags) {
        String tagsStr = String.join(", ", tags);
        return String.format("""
            다음 태그들에 어울리는 플레이리스트를 3개 추천해주세요: %s
            
            중요한 규칙:
            1. 각 플레이리스트에는 10곡씩 포함해주세요.
            2. 실제로 존재하는 곡과 아티스트를 추천해주세요.
            3. 태그에 "한국", "K-pop", "케이팝", "발라드", "트로트" 등 한국 음악 관련 키워드가 있으면 반드시 한국 곡만 추천해주세요.
               태그에 "외국", "팝", "pop", "영어", "미국", "빌보드" 등 외국 음악 관련 키워드가 있으면 외국 곡만 추천해주세요.
               그 외의 경우에만 한국 곡과 외국 곡을 섞어주세요.
            4. 플레이리스트 제목과 설명은 반드시 한국어로 작성해주세요!
            5. 제목에는 분위기에 맞는 이모지를 포함해주세요.
            6. imageKeyword는 사용자가 입력한 태그들(%s) 중에서 이미지 검색에 가장 적합한 태그를 그대로 사용해주세요. 번역하지 마세요.
               예시: 태그가 "비, 새벽"이면 imageKeyword는 "비" 또는 "새벽"
            
            반드시 아래 JSON 형식으로만 응답해주세요 (다른 텍스트 없이):
            {
              "playlists": [
                {
                  "title": "한국어 플레이리스트 제목 (이모지 포함)",
                  "description": "한국어로 된 플레이리스트 설명",
                  "imageKeyword": "사용자가 입력한 태그 중 하나 (번역하지 않음)",
                  "tags": ["태그1", "태그2", "태그3"],
                  "tracks": [
                    {"title": "곡 제목", "artist": "아티스트", "duration": "3:45"},
                    {"title": "곡 제목", "artist": "아티스트", "duration": "4:20"}
                  ]
                }
              ]
            }
            """, tagsStr, tagsStr);
    }

    private AIPlaylistResponse parseResponse(String responseBody, List<String> tags) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode content = root.path("choices").get(0).path("message").path("content");
            String jsonContent = content.asText();
            
            // JSON 부분만 추출 (마크다운 코드 블록 제거)
            if (jsonContent.contains("```json")) {
                jsonContent = jsonContent.substring(jsonContent.indexOf("```json") + 7);
                jsonContent = jsonContent.substring(0, jsonContent.indexOf("```"));
            } else if (jsonContent.contains("```")) {
                jsonContent = jsonContent.substring(jsonContent.indexOf("```") + 3);
                jsonContent = jsonContent.substring(0, jsonContent.indexOf("```"));
            }
            
            JsonNode playlistsJson = objectMapper.readTree(jsonContent.trim());
            JsonNode playlistsArray = playlistsJson.path("playlists");
            
            List<RecommendedPlaylist> playlists = new ArrayList<>();
            String[] gradients = {
                "from-purple-500 to-pink-500",
                "from-blue-500 to-cyan-500",
                "from-green-500 to-teal-500",
                "from-orange-500 to-red-500",
                "from-indigo-500 to-purple-500"
            };
            
            int idx = 0;
            for (JsonNode playlistNode : playlistsArray) {
                List<TrackInfo> tracks = new ArrayList<>();
                for (JsonNode trackNode : playlistNode.path("tracks")) {
                    String trackTitle = trackNode.path("title").asText();
                    String trackArtist = trackNode.path("artist").asText();
                    
                    // Spotify에서 실제 트랙 검색하여 검증된 정보 가져오기
                    TrackInfo verifiedTrack = searchAndVerifyTrack(trackTitle, trackArtist);
                    if (verifiedTrack != null) {
                        tracks.add(verifiedTrack);
                    } else {
                        // 검색 실패 시 원본 정보 사용
                        tracks.add(TrackInfo.builder()
                                .title(trackTitle)
                                .artist(trackArtist)
                                .duration(trackNode.path("duration").asText("3:30"))
                                .albumImage(null)
                                .build());
                    }
                }
                
                List<String> playlistTags = new ArrayList<>();
                for (JsonNode tagNode : playlistNode.path("tags")) {
                    playlistTags.add(tagNode.asText());
                }
                
                // Brave에서 분위기에 맞는 이미지 가져오기
                String playlistTitle = playlistNode.path("title").asText();
                String playlistDesc = playlistNode.path("description").asText();
                String imageKeyword = playlistNode.path("imageKeyword").asText("music");
                String coverImage = fetchBraveImage(imageKeyword);
                
                playlists.add(RecommendedPlaylist.builder()
                        .id(UUID.randomUUID().toString())
                        .title(playlistTitle)
                        .description(playlistDesc)
                        .coverGradient(gradients[idx % gradients.length])
                        .coverImage(coverImage)
                        .trackCount(tracks.size())
                        .tags(playlistTags)
                        .tracks(tracks)
                        .build());
                idx++;
            }
            
            return AIPlaylistResponse.builder()
                    .success(true)
                    .playlists(playlists)
                    .build();
                    
        } catch (Exception e) {
            log.error("응답 파싱 오류: {}", e.getMessage());
            return createFallbackResponse(tags);
        }
    }

    private String fetchBraveImage(String keyword) {
        try {
            // Brave Search API로 키워드 기반 이미지 검색
            String apiKey = braveSearchProperties.getApiKey();
            
            if (apiKey == null || apiKey.isEmpty() || apiKey.startsWith("your_")) {
                log.debug("Brave Search API 키가 설정되지 않았습니다. 이미지 검색을 건너뜁니다.");
                return null;
            }
            
            String encodedKeyword = java.net.URLEncoder.encode(keyword, "UTF-8");
            String apiUrl = String.format(
                "%s?q=%s&count=5&safesearch=strict&country=kr",
                BRAVE_IMAGE_SEARCH_URL, encodedKeyword
            );
            
            HttpHeaders headers = new HttpHeaders();
            headers.set("Accept", "application/json");
            headers.set("X-Subscription-Token", apiKey);
            
            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<String> response = restTemplate.exchange(apiUrl, HttpMethod.GET, entity, String.class);
            
            String responseBody = response.getBody();
            if (responseBody == null) {
                return null;
            }
            
            // API 키가 유효하지 않은 경우 조용히 실패
            if (responseBody.contains("SUBSCRIPTION_TOKEN_INVALID")) {
                log.warn("Brave Search API 키가 유효하지 않습니다. 이미지 검색 기능이 비활성화됩니다.");
                return null;
            }
            
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode results = root.path("results");
            
            if (results.isArray() && results.size() > 0) {
                // 랜덤하게 이미지 선택
                int randomIndex = new Random().nextInt(Math.min(results.size(), 5));
                String imageUrl = results.get(randomIndex).path("properties").path("url").asText();
                log.debug("Brave 이미지 가져오기 성공: {} -> {}", keyword, imageUrl);
                return imageUrl;
            }
            
            log.debug("Brave에서 이미지를 찾을 수 없음: {}", keyword);
            return null;
            
        } catch (Exception e) {
            log.debug("Brave API 호출 건너뜀: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Spotify에서 트랙을 검색하고 앨범 이미지와 duration을 가져옵니다.
     * 제목과 아티스트는 ChatGPT가 추천한 한국어 원본을 유지합니다.
     */
    private TrackInfo searchAndVerifyTrack(String originalTitle, String originalArtist) {
        try {
            // 아티스트명에서 괄호 안의 영어 이름 추출 (예: "헤이즈 (Heize)" -> "Heize")
            String englishArtist = extractEnglishName(originalArtist);
            String cleanArtist = cleanArtistName(originalArtist);
            
            // 1차 시도: 원본 제목 + 영어 아티스트명으로 검색
            String searchQuery = originalTitle + " " + (englishArtist != null ? englishArtist : cleanArtist);
            List<TrackInfoResponse> searchResults = spotifyService.searchTracks(searchQuery, 5);
            
            if (searchResults != null && !searchResults.isEmpty()) {
                // 첫 번째 결과 사용 (Spotify 검색은 일반적으로 정확함)
                TrackInfoResponse bestMatch = searchResults.get(0);
                
                String formattedDuration = formatDuration(bestMatch.getDuration());
                
                log.info("Spotify 트랙 매칭 성공: {} - {} (앨범이미지, duration 적용)", 
                        originalTitle, originalArtist);
                
                // 한국어 원본 제목/아티스트 유지, Spotify에서 앨범이미지와 duration만 가져옴
                return TrackInfo.builder()
                        .title(originalTitle)
                        .artist(originalArtist)
                        .duration(formattedDuration)
                        .albumImage(bestMatch.getAlbumImage())
                        .build();
            }
            
            // 2차 시도: 원본 그대로 검색
            searchQuery = originalTitle + " " + cleanArtist;
            searchResults = spotifyService.searchTracks(searchQuery, 3);
            
            if (searchResults != null && !searchResults.isEmpty()) {
                TrackInfoResponse bestMatch = searchResults.get(0);
                String formattedDuration = formatDuration(bestMatch.getDuration());
                
                log.info("Spotify 트랙 매칭 성공 (2차): {} - {} (앨범이미지, duration 적용)", 
                        originalTitle, originalArtist);
                
                return TrackInfo.builder()
                        .title(originalTitle)
                        .artist(originalArtist)
                        .duration(formattedDuration)
                        .albumImage(bestMatch.getAlbumImage())
                        .build();
            }
            
            // 3차 시도: getTrackInfo 사용
            TrackInfoResponse trackInfo = spotifyService.getTrackInfo(originalTitle, cleanArtist);
            if (trackInfo != null && trackInfo.getAlbumImage() != null && !trackInfo.getAlbumImage().isEmpty()) {
                String formattedDuration = formatDuration(trackInfo.getDuration());
                log.info("Spotify 트랙 매칭 성공 (3차): {} - {} (앨범이미지, duration 적용)", 
                        originalTitle, originalArtist);
                return TrackInfo.builder()
                        .title(originalTitle)
                        .artist(originalArtist)
                        .duration(formattedDuration)
                        .albumImage(trackInfo.getAlbumImage())
                        .build();
            }
            
            log.warn("Spotify에서 트랙을 찾을 수 없음: {} - {}", originalTitle, originalArtist);
            
        } catch (Exception e) {
            log.warn("Spotify 트랙 검색 실패: {} - {} ({})", originalTitle, originalArtist, e.getMessage());
        }
        return null;
    }
    
    /**
     * 아티스트명에서 괄호 안의 영어 이름을 추출합니다.
     * 예: "헤이즈 (Heize)" -> "Heize", "폴킴" -> null
     */
    private String extractEnglishName(String artistName) {
        // 괄호 안의 내용 추출
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("\\(([A-Za-z][A-Za-z0-9\\s\\.]+)\\)");
        java.util.regex.Matcher matcher = pattern.matcher(artistName);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }
        return null;
    }
    
    /**
     * 아티스트명에서 괄호와 feat. 등을 제거합니다.
     * 예: "헤이즈 (Heize)" -> "헤이즈", "에픽하이 feat. 윤하" -> "에픽하이"
     */
    private String cleanArtistName(String artistName) {
        // 괄호 안 내용 제거
        String cleaned = artistName.replaceAll("\\([^)]*\\)", "").trim();
        // feat., Feat., featuring 등 제거
        cleaned = cleaned.replaceAll("(?i)\\s*(feat\\.?|featuring|ft\\.?).*", "").trim();
        return cleaned;
    }
    
    /**
     * duration(ms)을 분:초 형식으로 변환합니다.
     */
    private String formatDuration(Long durationMs) {
        if (durationMs == null || durationMs <= 0) {
            return "3:30";
        }
        long totalSeconds = durationMs / 1000;
        long minutes = totalSeconds / 60;
        long seconds = totalSeconds % 60;
        return String.format("%d:%02d", minutes, seconds);
    }

    private AIPlaylistResponse createFallbackResponse(List<String> tags) {
        // API 실패 시 기본 플레이리스트 반환
        List<RecommendedPlaylist> fallbackPlaylists = new ArrayList<>();
        
        fallbackPlaylists.add(RecommendedPlaylist.builder()
                .id(UUID.randomUUID().toString())
                .title("감성 플레이리스트 ✨")
                .description("태그: " + String.join(", ", tags) + "에 어울리는 음악")
                .coverGradient("from-purple-500 to-pink-500")
                .coverImage(null)
                .trackCount(5)
                .tags(tags)
                .tracks(Arrays.asList(
                        TrackInfo.builder().title("밤편지").artist("아이유").duration("4:30").build(),
                        TrackInfo.builder().title("Through the Night").artist("IU").duration("4:30").build(),
                        TrackInfo.builder().title("너의 모든 순간").artist("성시경").duration("4:18").build(),
                        TrackInfo.builder().title("사랑은 늘 도망가").artist("임영웅").duration("4:02").build(),
                        TrackInfo.builder().title("좋니").artist("윤종신").duration("4:44").build()
                ))
                .build());
        
        return AIPlaylistResponse.builder()
                .success(false)
                .message("AI 서비스 연결에 실패했습니다. 기본 추천 플레이리스트를 제공합니다.")
                .playlists(fallbackPlaylists)
                .build();
    }
}
