package com.plyst.service;

import com.plyst.dto.SubtitleDto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class SubtitleService {

    private final WhisperService whisperService;
    
    private final Map<Integer, Boolean> stationSubtitleEnabled = new ConcurrentHashMap<>();
    private final Map<Integer, ScheduledFuture<?>> subtitleBroadcastTasks = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);

    public void enableSubtitles(Integer stationId, String videoId, SubtitleBroadcastCallback callback) {
        stationSubtitleEnabled.put(stationId, true);
        
        if (whisperService.hasSubtitles(videoId)) {
            log.info("캐시된 자막 사용: stationId={}, videoId={}", stationId, videoId);
            startSubtitleBroadcast(stationId, videoId, callback);
            return;
        }
        
        if (whisperService.isProcessing(videoId)) {
            log.info("자막 처리 중, 대기: stationId={}, videoId={}", stationId, videoId);
            waitForSubtitlesAndBroadcast(stationId, videoId, callback);
            return;
        }
        
        log.info("자막 생성 시작: stationId={}, videoId={}", stationId, videoId);
        whisperService.getSubtitles(videoId).thenAccept(segments -> {
            if (!segments.isEmpty() && Boolean.TRUE.equals(stationSubtitleEnabled.get(stationId))) {
                log.info("자막 생성 완료, 브로드캐스트 시작: stationId={}, segments={}", stationId, segments.size());
                startSubtitleBroadcast(stationId, videoId, callback);
            } else {
                log.warn("자막 생성 실패 또는 비활성화됨: stationId={}, segmentsEmpty={}, enabled={}", 
                    stationId, segments.isEmpty(), stationSubtitleEnabled.get(stationId));
                callback.onSubtitlesReady(SubtitleResponse.builder()
                    .videoId(videoId)
                    .available(false)
                    .processing(false)
                    .segments(Collections.emptyList())
                    .build());
            }
        }).exceptionally(ex -> {
            log.error("자막 생성 예외 발생: stationId={}, videoId={}, error={}", stationId, videoId, ex.getMessage());
            callback.onSubtitlesReady(SubtitleResponse.builder()
                .videoId(videoId)
                .available(false)
                .processing(false)
                .segments(Collections.emptyList())
                .build());
            return null;
        });
    }

    public void disableSubtitles(Integer stationId) {
        stationSubtitleEnabled.put(stationId, false);
        stopSubtitleBroadcast(stationId);
    }

    public boolean isSubtitleEnabled(Integer stationId) {
        return Boolean.TRUE.equals(stationSubtitleEnabled.get(stationId));
    }

    private void waitForSubtitlesAndBroadcast(Integer stationId, String videoId, SubtitleBroadcastCallback callback) {
        scheduler.schedule(() -> {
            if (whisperService.hasSubtitles(videoId) && Boolean.TRUE.equals(stationSubtitleEnabled.get(stationId))) {
                startSubtitleBroadcast(stationId, videoId, callback);
            } else if (whisperService.isProcessing(videoId)) {
                waitForSubtitlesAndBroadcast(stationId, videoId, callback);
            }
        }, 2, TimeUnit.SECONDS);
    }

    private void startSubtitleBroadcast(Integer stationId, String videoId, SubtitleBroadcastCallback callback) {
        stopSubtitleBroadcast(stationId);
        
        List<SubtitleSegment> segments = whisperService.getCachedSubtitles(videoId);
        if (segments.isEmpty()) {
            log.warn("자막 세그먼트 없음: videoId={}", videoId);
            return;
        }
        
        callback.onSubtitlesReady(SubtitleResponse.builder()
            .videoId(videoId)
            .available(true)
            .processing(false)
            .originalLanguage(segments.get(0).getOriginalLanguage())
            .segments(segments)
            .build());
        
        log.info("자막 준비 완료 알림: stationId={}, segments={}", stationId, segments.size());
    }

    private void stopSubtitleBroadcast(Integer stationId) {
        ScheduledFuture<?> task = subtitleBroadcastTasks.remove(stationId);
        if (task != null) {
            task.cancel(false);
        }
    }

    public SubtitleSegment getSubtitleForTime(String videoId, double timeSeconds) {
        return whisperService.getSubtitleAt(videoId, timeSeconds);
    }

    public SubtitleResponse getSubtitleStatus(String videoId) {
        if (whisperService.hasSubtitles(videoId)) {
            List<SubtitleSegment> segments = whisperService.getCachedSubtitles(videoId);
            return SubtitleResponse.builder()
                .videoId(videoId)
                .available(true)
                .processing(false)
                .originalLanguage(segments.isEmpty() ? "unknown" : segments.get(0).getOriginalLanguage())
                .segments(segments)
                .build();
        }
        
        if (whisperService.isProcessing(videoId)) {
            return SubtitleResponse.builder()
                .videoId(videoId)
                .available(false)
                .processing(true)
                .segments(Collections.emptyList())
                .build();
        }
        
        return SubtitleResponse.builder()
            .videoId(videoId)
            .available(false)
            .processing(false)
            .segments(Collections.emptyList())
            .build();
    }

    public void requestSubtitleGeneration(String videoId) {
        if (!whisperService.hasSubtitles(videoId) && !whisperService.isProcessing(videoId)) {
            whisperService.getSubtitles(videoId);
        }
    }

    public void cleanup(Integer stationId) {
        stationSubtitleEnabled.remove(stationId);
        stopSubtitleBroadcast(stationId);
    }

    @FunctionalInterface
    public interface SubtitleBroadcastCallback {
        void onSubtitlesReady(SubtitleResponse response);
    }
}
