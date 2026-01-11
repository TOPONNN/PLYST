package com.plyst.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plyst.config.OpenAIProperties;
import com.plyst.dto.SubtitleDto.SubtitleSegment;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class WhisperService {

    private final RestTemplate restTemplate;
    private final OpenAIProperties openAIProperties;
    private final ObjectMapper objectMapper;

    private static final String WHISPER_API_URL = "https://api.openai.com/v1/audio/transcriptions";
    private static final String TRANSLATION_API_URL = "https://api.openai.com/v1/chat/completions";
    private static final String COOKIES_FILE = "/home/ubuntu/PLYST_1.0.2/backend/config/youtube_cookies.txt";
    
    private final Map<String, List<SubtitleSegment>> subtitleCache = new ConcurrentHashMap<>();
    private final Set<String> processingVideos = ConcurrentHashMap.newKeySet();
    private final ExecutorService executorService = Executors.newFixedThreadPool(3);

    public CompletableFuture<List<SubtitleSegment>> getSubtitles(String videoId) {
        if (subtitleCache.containsKey(videoId)) {
            log.info("캐시된 자막 반환: {}", videoId);
            return CompletableFuture.completedFuture(subtitleCache.get(videoId));
        }
        
        if (processingVideos.contains(videoId)) {
            log.info("자막 처리 중: {}", videoId);
            return CompletableFuture.completedFuture(Collections.emptyList());
        }
        
        return CompletableFuture.supplyAsync(() -> {
            try {
                return processVideoSubtitles(videoId);
            } catch (Exception e) {
                log.error("자막 생성 실패: {}", e.getMessage());
                return Collections.emptyList();
            }
        }, executorService);
    }

    private List<SubtitleSegment> processVideoSubtitles(String videoId) {
        processingVideos.add(videoId);
        Path audioFile = null;
        
        try {
            log.info("자막 생성 시작: {}", videoId);
            
            audioFile = downloadYoutubeAudio(videoId);
            if (audioFile == null) {
                log.error("오디오 다운로드 실패: {}", videoId);
                return Collections.emptyList();
            }
            
            List<SubtitleSegment> segments = transcribeAudio(audioFile);
            if (segments.isEmpty()) {
                log.error("전사 실패: {}", videoId);
                return Collections.emptyList();
            }
            
            List<SubtitleSegment> translatedSegments = translateSegments(segments);
            subtitleCache.put(videoId, translatedSegments);
            
            log.info("자막 생성 완료: {} - {}개 세그먼트", videoId, translatedSegments.size());
            return translatedSegments;
            
        } finally {
            processingVideos.remove(videoId);
            if (audioFile != null) {
                try {
                    Files.deleteIfExists(audioFile);
                    Files.deleteIfExists(audioFile.getParent());
                } catch (IOException e) {
                    log.warn("임시 파일 삭제 실패: {}", audioFile);
                }
            }
        }
    }

    private Path downloadYoutubeAudio(String videoId) {
        try {
            String url = "https://www.youtube.com/watch?v=" + videoId;
            Path tempDir = Files.createTempDirectory("plyst_audio_");
            Path outputTemplate = tempDir.resolve(videoId + ".%(ext)s");
            
            log.info("오디오 다운로드 시작: {} -> {}", videoId, tempDir);
            
            List<String> command = new ArrayList<>();
            command.add("/usr/local/bin/yt-dlp");
            command.add("-f");
            command.add("ba[ext=m4a][filesize<25M]/ba[ext=webm][filesize<25M]/ba[filesize<25M]/ba");
            command.add("-o");
            command.add(outputTemplate.toString());
            command.add("--no-playlist");
            command.add("--concurrent-fragments");
            command.add("8");
            command.add("--buffer-size");
            command.add("16K");
            command.add("--no-warnings");
            command.add("--no-part");
            
            Path cookiesPath = Paths.get(COOKIES_FILE);
            if (Files.exists(cookiesPath)) {
                command.add("--cookies");
                command.add(COOKIES_FILE);
                log.info("YouTube 쿠키 파일 사용: {}", COOKIES_FILE);
            }
            
            command.add(url);
            
            ProcessBuilder pb = new ProcessBuilder(command);
            
            Map<String, String> env = pb.environment();
            String currentPath = env.getOrDefault("PATH", "");
            env.put("PATH", "/home/ubuntu/.deno/bin:" + currentPath);
            
            pb.redirectErrorStream(true);
            Process process = pb.start();
            
            StringBuilder output = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                    log.info("yt-dlp: {}", line);
                }
            }
            
            int exitCode = process.waitFor();
            if (exitCode != 0) {
                log.error("yt-dlp 실패: exit code {}, output: {}", exitCode, output);
                return null;
            }
            
            try (var files = Files.list(tempDir)) {
                Optional<Path> audioFile = files
                    .filter(f -> {
                        String name = f.getFileName().toString().toLowerCase();
                        return name.contains(videoId.toLowerCase()) && 
                               (name.endsWith(".mp3") || name.endsWith(".m4a") || name.endsWith(".webm") || name.endsWith(".opus"));
                    })
                    .findFirst();
                
                if (audioFile.isPresent()) {
                    log.info("오디오 파일 찾음: {}", audioFile.get());
                    Path compressed = compressAudio(audioFile.get(), tempDir, videoId);
                    return compressed != null ? compressed : audioFile.get();
                }
            }
            
            log.error("오디오 파일을 찾을 수 없음: {}", tempDir);
            return null;
            
        } catch (Exception e) {
            log.error("오디오 다운로드 오류: {}", e.getMessage(), e);
            return null;
        }
    }

    private Path compressAudio(Path inputFile, Path tempDir, String videoId) {
        try {
            Path outputFile = tempDir.resolve(videoId + "_compressed.mp3");
            
            List<String> command = List.of(
                "/usr/bin/ffmpeg",
                "-i", inputFile.toString(),
                "-ar", "16000",
                "-ac", "1",
                "-b:a", "32k",
                "-y",
                outputFile.toString()
            );
            
            ProcessBuilder pb = new ProcessBuilder(command);
            pb.redirectErrorStream(true);
            Process process = pb.start();
            
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                while (reader.readLine() != null) {}
            }
            
            int exitCode = process.waitFor();
            if (exitCode == 0 && Files.exists(outputFile)) {
                long originalSize = Files.size(inputFile);
                long compressedSize = Files.size(outputFile);
                log.info("오디오 압축 완료: {}KB -> {}KB ({}% 감소)", 
                    originalSize / 1024, compressedSize / 1024, 
                    100 - (compressedSize * 100 / originalSize));
                Files.deleteIfExists(inputFile);
                return outputFile;
            }
            
            log.warn("ffmpeg 압축 실패, 원본 사용");
            return null;
        } catch (Exception e) {
            log.warn("오디오 압축 오류: {}", e.getMessage());
            return null;
        }
    }

    private List<SubtitleSegment> transcribeAudio(Path audioFile) {
        try {
            String apiKey = openAIProperties.getApiKey();
            if (apiKey == null || apiKey.isEmpty()) {
                log.error("OpenAI API 키가 설정되지 않았습니다.");
                return Collections.emptyList();
            }
            
            byte[] audioBytes = Files.readAllBytes(audioFile);
            
            if (audioBytes.length > 25 * 1024 * 1024) {
                log.warn("오디오 파일이 너무 큽니다: {} bytes", audioBytes.length);
            }
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            headers.setBearerAuth(apiKey);
            
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            
            ByteArrayResource fileResource = new ByteArrayResource(audioBytes) {
                @Override
                public String getFilename() {
                    return audioFile.getFileName().toString();
                }
            };
            body.add("file", fileResource);
            body.add("model", "whisper-1");
            body.add("response_format", "verbose_json");
            body.add("timestamp_granularities[]", "segment");
            
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
            
            ResponseEntity<String> response = restTemplate.exchange(
                WHISPER_API_URL,
                HttpMethod.POST,
                requestEntity,
                String.class
            );
            
            return parseWhisperResponse(response.getBody());
            
        } catch (Exception e) {
            log.error("Whisper API 호출 오류: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    private List<SubtitleSegment> parseWhisperResponse(String responseBody) {
        List<SubtitleSegment> segments = new ArrayList<>();
        
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            String detectedLanguage = root.path("language").asText("unknown");
            
            log.info("감지된 언어: {}", detectedLanguage);
            
            JsonNode segmentsNode = root.path("segments");
            for (JsonNode segmentNode : segmentsNode) {
                double start = segmentNode.path("start").asDouble();
                double end = segmentNode.path("end").asDouble();
                String text = segmentNode.path("text").asText().trim();
                
                if (!text.isEmpty()) {
                    segments.add(SubtitleSegment.builder()
                        .startTime(start)
                        .endTime(end)
                        .text(text)
                        .originalLanguage(detectedLanguage)
                        .translatedText(null)
                        .build());
                }
            }
            
        } catch (Exception e) {
            log.error("Whisper 응답 파싱 오류: {}", e.getMessage());
        }
        
        return segments;
    }

    private List<SubtitleSegment> translateSegments(List<SubtitleSegment> segments) {
        if (segments.isEmpty()) return segments;
        
        String language = segments.get(0).getOriginalLanguage();
        if ("korean".equalsIgnoreCase(language) || "ko".equalsIgnoreCase(language)) {
            return segments.stream()
                .map(s -> s.toBuilder().translatedText(s.getText()).build())
                .toList();
        }
        
        if (!"english".equalsIgnoreCase(language) && !"japanese".equalsIgnoreCase(language) 
            && !"en".equalsIgnoreCase(language) && !"ja".equalsIgnoreCase(language)) {
            log.info("지원하지 않는 언어: {} - 원문 유지", language);
            return segments.stream()
                .map(s -> s.toBuilder().translatedText(s.getText()).build())
                .toList();
        }
        
        int batchSize = 30;
        List<List<SubtitleSegment>> batches = new ArrayList<>();
        for (int i = 0; i < segments.size(); i += batchSize) {
            batches.add(segments.subList(i, Math.min(i + batchSize, segments.size())));
        }
        
        String lang = language;
        List<CompletableFuture<List<String>>> futures = batches.stream()
            .map(batch -> CompletableFuture.supplyAsync(() -> translateBatch(batch, lang), executorService))
            .toList();
        
        List<SubtitleSegment> translatedSegments = new ArrayList<>();
        for (int i = 0; i < batches.size(); i++) {
            List<SubtitleSegment> batch = batches.get(i);
            List<String> translations;
            try {
                translations = futures.get(i).get(30, TimeUnit.SECONDS);
            } catch (Exception e) {
                translations = batch.stream().map(SubtitleSegment::getText).toList();
            }
            for (int j = 0; j < batch.size(); j++) {
                SubtitleSegment original = batch.get(j);
                String translated = j < translations.size() ? translations.get(j) : original.getText();
                translatedSegments.add(original.toBuilder().translatedText(translated).build());
            }
        }
        
        return translatedSegments;
    }

    private List<String> translateBatch(List<SubtitleSegment> segments, String sourceLanguage) {
        try {
            String apiKey = openAIProperties.getApiKey();
            if (apiKey == null || apiKey.isEmpty()) {
                return segments.stream().map(SubtitleSegment::getText).toList();
            }
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiKey);
            
            StringBuilder textsJson = new StringBuilder("[");
            for (int i = 0; i < segments.size(); i++) {
                if (i > 0) textsJson.append(",");
                textsJson.append("\"").append(escapeJson(segments.get(i).getText())).append("\"");
            }
            textsJson.append("]");
            
            String langName = "english".equalsIgnoreCase(sourceLanguage) || "en".equalsIgnoreCase(sourceLanguage) 
                ? "영어" : "일본어";
            
            String systemPrompt = "당신은 전문 번역가입니다. " + langName + " 가사/대사를 자연스러운 한국어로 번역해주세요. " +
                "JSON 배열 형식으로 입력받아 동일한 순서로 번역된 JSON 배열을 반환하세요. 다른 텍스트 없이 JSON 배열만 반환하세요.";
            
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", "gpt-4o-mini");
            requestBody.put("temperature", 0.3);
            requestBody.put("max_completion_tokens", 2000);
            
            List<Map<String, String>> messages = new ArrayList<>();
            messages.add(Map.of("role", "system", "content", systemPrompt));
            messages.add(Map.of("role", "user", "content", "다음 텍스트들을 한국어로 번역해주세요:\n" + textsJson));
            requestBody.put("messages", messages);
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
            
            ResponseEntity<String> response = restTemplate.exchange(
                TRANSLATION_API_URL,
                HttpMethod.POST,
                entity,
                String.class
            );
            
            JsonNode root = objectMapper.readTree(response.getBody());
            String content = root.path("choices").get(0).path("message").path("content").asText();
            
            if (content.contains("[")) {
                content = content.substring(content.indexOf("["), content.lastIndexOf("]") + 1);
            }
            
            JsonNode translationsArray = objectMapper.readTree(content);
            List<String> translations = new ArrayList<>();
            for (JsonNode node : translationsArray) {
                translations.add(node.asText());
            }
            
            return translations;
            
        } catch (Exception e) {
            log.error("번역 오류: {}", e.getMessage());
            return segments.stream().map(SubtitleSegment::getText).toList();
        }
    }

    private String escapeJson(String text) {
        return text.replace("\\", "\\\\")
                   .replace("\"", "\\\"")
                   .replace("\n", "\\n")
                   .replace("\r", "\\r")
                   .replace("\t", "\\t");
    }

    public SubtitleSegment getSubtitleAt(String videoId, double timeSeconds) {
        List<SubtitleSegment> segments = subtitleCache.get(videoId);
        if (segments == null || segments.isEmpty()) {
            return null;
        }
        
        for (SubtitleSegment segment : segments) {
            if (timeSeconds >= segment.getStartTime() && timeSeconds <= segment.getEndTime()) {
                return segment;
            }
        }
        
        return null;
    }

    public boolean hasSubtitles(String videoId) {
        return subtitleCache.containsKey(videoId);
    }

    public boolean isProcessing(String videoId) {
        return processingVideos.contains(videoId);
    }

    public void clearCache(String videoId) {
        subtitleCache.remove(videoId);
    }
    
    public List<SubtitleSegment> getCachedSubtitles(String videoId) {
        return subtitleCache.getOrDefault(videoId, Collections.emptyList());
    }
}
