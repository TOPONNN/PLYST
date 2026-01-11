package com.plyst.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plyst.config.BraveSearchProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class ImageSearchService {

    private final RestTemplate restTemplate;
    private final BraveSearchProperties braveSearchProperties;
    private final ObjectMapper objectMapper;

    private static final String BRAVE_IMAGE_SEARCH_URL = "https://api.search.brave.com/res/v1/images/search";

    /**
     * Brave Search에서 이미지 검색
     */
    public List<Map<String, String>> searchImages(String query, int count) {
        List<Map<String, String>> images = new ArrayList<>();
        
        try {
            String apiKey = braveSearchProperties.getApiKey();
            
            if (apiKey == null || apiKey.isEmpty() || apiKey.startsWith("your_")) {
                log.debug("Brave Search API 키가 설정되지 않았습니다. 이미지 검색을 건너뜁니다.");
                return images;
            }

            String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
            String url = String.format("%s?q=%s&count=%d&safesearch=strict&country=kr",
                    BRAVE_IMAGE_SEARCH_URL, encodedQuery, Math.min(count, 20));

            HttpHeaders headers = new HttpHeaders();
            headers.set("Accept", "application/json");
            headers.set("X-Subscription-Token", apiKey);
            
            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);

            String responseBody = response.getBody();
            if (responseBody == null) {
                return images;
            }
            
            if (responseBody.contains("SUBSCRIPTION_TOKEN_INVALID")) {
                log.warn("Brave Search API 키가 유효하지 않습니다. 이미지 검색 기능이 비활성화됩니다.");
                return images;
            }
            
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode results = root.path("results");

            for (JsonNode item : results) {
                Map<String, String> image = new HashMap<>();
                image.put("id", String.valueOf(images.size()));
                image.put("previewUrl", item.path("thumbnail").path("src").asText());
                image.put("webformatUrl", item.path("properties").path("url").asText());
                image.put("largeUrl", item.path("properties").path("url").asText());
                image.put("tags", item.path("title").asText());
                images.add(image);
            }

            log.debug("Brave 검색 결과: {} 이미지 발견 (쿼리: {})", images.size(), query);

        } catch (Exception e) {
            log.debug("Brave 검색 건너뜀: {}", e.getMessage());
        }

        return images;
    }

    /**
     * 키워드로 이미지 검색
     */
    public Map<String, Object> searchImagesByKeyword(String keyword, int count) {
        Map<String, Object> result = new HashMap<>();
        result.put("keyword", keyword);
        
        List<Map<String, String>> images = searchImages(keyword, count);
        result.put("images", images);
        
        return result;
    }
}
