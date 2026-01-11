package com.plyst.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class YoutubeService {

    private final RestTemplate restTemplate;

    public String findVideoId(String title, String artist) {
        try {
            String query = artist + " " + title + " MV";
            String url = "https://www.youtube.com/results?search_query=" + query.replace(" ", "+");
            
            String html = restTemplate.getForObject(url, String.class);
            
            Pattern pattern = Pattern.compile("\"videoRenderer\":\\{\"videoId\":\"([^\"]+)\"");
            Matcher matcher = pattern.matcher(html);
            
            if (matcher.find()) {
                return matcher.group(1);
            }
        } catch (Exception e) {
            log.error("YouTube 검색 오류: {}", e.getMessage());
        }
        return "";
    }
}
