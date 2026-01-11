package com.plyst.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

public class SubtitleDto {

    @Data
    @Builder(toBuilder = true)
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SubtitleSegment {
        private double startTime;
        private double endTime;
        private String text;
        private String originalLanguage;
        private String translatedText;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SubtitleResponse {
        private String videoId;
        private boolean available;
        private boolean processing;
        private String originalLanguage;
        private List<SubtitleSegment> segments;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SubtitleRequest {
        private String videoId;
        private boolean enableSubtitles;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SubtitleUpdate {
        private String videoId;
        private double currentTime;
        private SubtitleSegment currentSubtitle;
        private SubtitleSegment nextSubtitle;
    }
}
