import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  MeasuringStrategy,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Heart,
  Volume2,
  VolumeX,
  ListMusic,
  X,
  Music2,
  ChevronDown,
  GripVertical,
  Trash2,
} from "lucide-react";
import { Slider } from "./ui/slider";
import { Track, getTrackInfo, getAlternativeYoutubeVideoId } from "../services/api";

// 마퀴 스크롤 텍스트 컴포넌트 - 텍스트 길이 기반
interface MarqueeTextProps {
  text: string;
  className?: string;
  maxLength?: number; // 이 길이 초과하면 스크롤
}

const MarqueeText = ({ text, className = "", maxLength = 20 }: MarqueeTextProps) => {
  // 텍스트 길이가 maxLength보다 길면 스크롤
  const shouldScroll = text.length > maxLength;
  const duration = Math.max(text.length * 0.25, 8);

  if (!shouldScroll) {
    return (
      <div className="overflow-hidden">
        <span className={`block truncate ${className}`}>
          {text}
        </span>
      </div>
    );
  }

  return (
    <div className="overflow-hidden group">
      <div 
        className="inline-flex whitespace-nowrap"
        style={{
          animation: `marqueeAnim ${duration}s linear infinite`,
        }}
      >
        <span className={className}>{text}</span>
        <span className="mx-6 opacity-30">•</span>
        <span className={className}>{text}</span>
        <span className="mx-6 opacity-30">•</span>
      </div>
    </div>
  );
};

interface PlayQueueTrack {
  title: string;
  artist: string;
  albumImage?: string;
  duration?: string;
}

// 고유 ID가 포함된 트랙
interface LocalTrack extends PlayQueueTrack {
  _id: string;
}

// SortableTrackItem 컴포넌트
interface SortableTrackItemProps {
  track: LocalTrack;
  index: number;
  isCurrentTrack: boolean;
  onPlay: () => void;
  onDelete: () => void;
}

function SortableTrackItem({ track, index, isCurrentTrack, onPlay, onDelete }: SortableTrackItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track._id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)',
    zIndex: isDragging ? 999 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group track-item flex items-center gap-4 p-3 mb-2 rounded-2xl cursor-grab active:cursor-grabbing touch-none select-none transition-colors ${
        isDragging 
          ? "bg-gradient-to-r from-purple-600/60 via-pink-500/60 to-purple-600/60 border-2 border-white/50 shadow-2xl scale-[1.02] ring-2 ring-purple-400/30"
          : isCurrentTrack
            ? "bg-gradient-to-r from-white/15 via-white/10 to-white/15 border border-white/20 shadow-lg shadow-white/5"
            : "bg-white/5 border border-transparent hover:bg-white/10 hover:border-white/10"
      }`}
    >
      {/* Drag Handle Icon (visual only) */}
      <div className={`p-1 rounded-lg shrink-0 transition-colors ${isDragging ? 'text-white/70' : 'text-white/30 group-hover:text-white/50'}`}>
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Track Number or Playing Indicator */}
      <div className="w-6 text-center shrink-0">
        {isCurrentTrack ? (
          <div className="flex items-center justify-center gap-0.5">
            <div className="playing-bar-1 w-1 bg-white/80 rounded-full" style={{ height: '6px' }} />
            <div className="playing-bar-2 w-1 bg-white rounded-full" style={{ height: '14px' }} />
            <div className="playing-bar-3 w-1 bg-white/80 rounded-full" style={{ height: '6px' }} />
          </div>
        ) : (
          <span className="text-white/30 text-sm font-medium">{index + 1}</span>
        )}
      </div>

      {/* Album Art */}
      {track.albumImage ? (
        <img
          src={track.albumImage}
          alt={track.title}
          loading="lazy"
          draggable={false}
          className={`w-12 h-12 rounded-xl object-cover shrink-0 ${
            isCurrentTrack ? "ring-2 ring-white/30" : "ring-1 ring-white/10"
          }`}
        />
      ) : (
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center shrink-0 ${
          isCurrentTrack ? "ring-2 ring-white/30" : "ring-1 ring-white/10"
        }`}>
          <Music2 className="w-5 h-5 text-white/50" />
        </div>
      )}

      {/* Track Info */}
      <div className="flex-1 min-w-0">
        <p className={`text-base truncate ${
          isCurrentTrack ? "text-white font-semibold" : "text-white/80"
        }`}>
          {track.title}
        </p>
        <p className="text-sm text-white/40 truncate">
          {track.artist}
        </p>
      </div>

      {/* Duration */}
      {track.duration && (
        <span className={`text-sm shrink-0 px-3 py-1 rounded-lg ${
          isCurrentTrack 
            ? "bg-white/10 text-white/70" 
            : "bg-white/5 text-white/30"
        }`}>
          {track.duration}
        </span>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay();
          }}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-white/40 hover:text-white transition-all"
          title="재생"
        >
          <Play className="w-4 h-4" fill="currentColor" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all"
          title="삭제"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

interface MusicPlayerProps {
  track: Track | null;
  videoId: string | null;
  onClose?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onTrackEnd?: () => void;
  isShuffle?: boolean;
  onShuffleToggle?: () => void;
  repeatMode?: "off" | "all" | "one";
  onRepeatToggle?: () => void;
  isLiked?: boolean;
  onLikeToggle?: () => void;
  playQueue?: { tracks: PlayQueueTrack[]; currentIndex: number } | null;
  onPlayFromQueue?: (index: number) => void;
  initialShowQueue?: boolean;
  onShowQueueChange?: (show: boolean) => void;
  onRemoveFromQueue?: (index: number) => void;
  onMoveTrackInQueue?: (fromIndex: number, toIndex: number) => void;
  onVideoIdChange?: (newVideoId: string) => void;
}

declare global {
  interface Window {
    YT: {
      Player: new (elementId: string, options: {
        videoId: string;
        playerVars?: Record<string, number>;
        events?: {
          onReady?: (event: { target: YTPlayer }) => void;
          onStateChange?: (event: { data: number; target: YTPlayer }) => void;
          onError?: (event: { data: number }) => void;
        };
      }) => YTPlayer;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
      };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  setVolume: (volume: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  destroy: () => void;
}

export default function MusicPlayer({ 
  track, 
  videoId, 
  onPrevious, 
  onNext, 
  hasPrevious = false, 
  hasNext = false,
  onTrackEnd,
  isShuffle = false,
  onShuffleToggle,
  repeatMode = "off",
  onRepeatToggle,
  isLiked = false,
  onLikeToggle,
  playQueue = null,
  onPlayFromQueue,
  initialShowQueue = false,
  onShowQueueChange,
  onRemoveFromQueue,
  onMoveTrackInQueue,
  onVideoIdChange
}: MusicPlayerProps) {
  const [showQueue, setShowQueue] = useState(initialShowQueue);
  const [showTrackList, setShowTrackList] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState([100]);
  const [progress, setProgress] = useState([0]);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [showVolumeValue, setShowVolumeValue] = useState(false);
  const [rippleProgress, setRippleProgress] = useState(false);
  const [rippleVolume, setRippleVolume] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [albumImage, setAlbumImage] = useState<string | null>(null);
  const [localTracks, setLocalTracks] = useState<LocalTrack[]>([]);
  
  const playerRef = useRef<YTPlayer | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idCounterRef = useRef(0);
  const failedVideoIdsRef = useRef<string[]>([]);

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    })
  );

  // initialShowQueue가 변경되면 반영
  useEffect(() => {
    setShowQueue(initialShowQueue);
  }, [initialShowQueue]);

  // showQueue 변경 시 콜백 호출
  useEffect(() => {
    onShowQueueChange?.(showQueue);
  }, [showQueue, onShowQueueChange]);

  // playQueue.tracks가 변경될 때 localTracks 동기화 (고유 ID 부여)
  useEffect(() => {
    if (playQueue?.tracks) {
      const tracksWithId = playQueue.tracks.map((t, i) => ({
        ...t,
        _id: `track-${idCounterRef.current++}-${i}`,
      }));
      setLocalTracks(tracksWithId);
    }
  }, [playQueue?.tracks]);

  // dnd-kit 드래그 핸들러
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    const oldIndex = localTracks.findIndex(t => t._id === active.id);
    const newIndex = localTracks.findIndex(t => t._id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    // 로컬 트랙 리스트 업데이트
    const newTracks = arrayMove(localTracks, oldIndex, newIndex);
    setLocalTracks(newTracks);
    
    // 부모에게 알림
    if (onMoveTrackInQueue) {
      onMoveTrackInQueue(oldIndex, newIndex);
    }
  }, [localTracks, onMoveTrackInQueue]);

  const handleVideoError = useCallback(async (errorCode: number, failedVideoId: string) => {
    const isEmbedError = errorCode === 101 || errorCode === 150;
    
    if (!isEmbedError || !track) {
      console.warn("재생 불가:", errorCode);
      return;
    }

    failedVideoIdsRef.current = [...failedVideoIdsRef.current, failedVideoId];
    
    if (failedVideoIdsRef.current.length > 5) {
      console.warn("대체 영상 검색 한도 초과");
      if (onNext && hasNext) {
        setTimeout(() => onNext(), 2000);
      }
      return;
    }

    try {
      const alternativeVideoId = await getAlternativeYoutubeVideoId(
        track.title,
        track.artists,
        failedVideoIdsRef.current
      );

      if (alternativeVideoId) {
        onVideoIdChange?.(alternativeVideoId);
      } else {
        console.warn("대체 영상을 찾을 수 없음");
        if (onNext && hasNext) {
          setTimeout(() => onNext(), 2000);
        }
      }
    } catch (err) {
      console.error("대체 영상 검색 실패:", err);
    }
  }, [track, onNext, hasNext, onVideoIdChange]);

  useEffect(() => {
    if (!track) {
      setAlbumImage(null);
      return;
    }

    // 이미 앨범 이미지가 있으면 사용
    if (track.album.image) {
      setAlbumImage(track.album.image);
      return;
    }

    // Spotify API에서 앨범 이미지 가져오기
    const fetchAlbumImage = async () => {
      try {
        const info = await getTrackInfo(track.title, track.artists);
        if (info?.albumImage) {
          setAlbumImage(info.albumImage);
        }
      } catch (error) {
        console.error('앨범 이미지 가져오기 오류:', error);
      }
    };

    fetchAlbumImage();
  }, [track]);

  // YouTube IFrame API 로드
  useEffect(() => {
    if (!videoId || videoId.trim() === '') {
      // videoId가 없으면 기존 플레이어 정리
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      setIsPlayerReady(false);
      return;
    }
    
    const currentVideoId = videoId; // 클로저 캡처
    
    const initPlayer = () => {
      // videoId 유효성 재확인 (클로저 캡처된 값 사용)
      if (!currentVideoId || currentVideoId.trim() === '') {
        console.warn('Invalid video ID, skipping player initialization');
        return;
      }

      if (playerRef.current) {
        playerRef.current.destroy();
      }

      playerRef.current = new window.YT.Player('youtube-player', {
        videoId: currentVideoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: (event) => {
            setIsPlayerReady(true);
            setIsPlaying(true);
            failedVideoIdsRef.current = [];
            event.target.setVolume(volume[0]);
            const dur = event.target.getDuration();
            setDuration(dur);
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
            } else if (event.data === window.YT.PlayerState.ENDED) {
              if (repeatMode === "one") {
                event.target.seekTo(0, true);
                event.target.playVideo();
              } else if (onTrackEnd) {
                onTrackEnd();
              } else {
                setIsPlaying(false);
              }
            }
          },
          onError: (event: { data: number }) => {
            console.error("YouTube 플레이어 에러:", event.data);
            if (currentVideoId) {
              handleVideoError(event.data, currentVideoId);
            }
          },
        },
      });
    };

    const loadYouTubeAPI = () => {
      if (window.YT && window.YT.Player) {
        initPlayer();
        return;
      }

      // 이미 스크립트가 로드 중인지 확인
      const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }

      window.onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    };

    loadYouTubeAPI();

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoId]);

  // 진행률 업데이트
  useEffect(() => {
    if (isPlaying && isPlayerReady && playerRef.current) {
      progressIntervalRef.current = setInterval(() => {
        if (playerRef.current && !isDraggingProgress && typeof playerRef.current.getCurrentTime === 'function') {
          try {
            const current = playerRef.current.getCurrentTime();
            const dur = playerRef.current.getDuration();
            setCurrentTime(current);
            if (dur > 0) {
              setProgress([(current / dur) * 100]);
            }
          } catch (e) {
            // Player not ready yet
          }
        }
      }, 1000);
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying, isPlayerReady, isDraggingProgress]);

  // 볼륨 조절
  useEffect(() => {
    if (playerRef.current && isPlayerReady && typeof playerRef.current.setVolume === 'function') {
      try {
        playerRef.current.setVolume(volume[0]);
      } catch (e) {
        // Player not ready
      }
    }
  }, [volume, isPlayerReady]);

  const isMuted = volume[0] === 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePlayPause = useCallback(() => {
    if (!playerRef.current || !isPlayerReady) return;
    
    try {
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    } catch (e) {
      // Player not ready
    }
  }, [isPlaying, isPlayerReady]);

  const handleProgressChange = (value: number[]) => {
    setProgress(value);
    setIsDraggingProgress(true);
    setRippleProgress(true);
    setTimeout(() => setRippleProgress(false), 600);
  };

  const handleProgressCommit = (value: number[]) => {
    if (playerRef.current && isPlayerReady && duration > 0) {
      try {
        const seekTime = (value[0] / 100) * duration;
        playerRef.current.seekTo(seekTime, true);
        setCurrentTime(seekTime);
      } catch (e) {
        // Player not ready
      }
    }
    setIsDraggingProgress(false);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value);
    setIsDraggingVolume(true);
    setRippleVolume(true);
    setTimeout(() => setRippleVolume(false), 600);
  };

  // 재생 중인 곡이 없으면 렌더링하지 않음
  if (!track || !videoId) {
    return null;
  }

  return (
    <>
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: "spring", damping: 20 }}
      className="backdrop-blur-sm bg-gradient-to-t from-black/40 via-black/30 to-black/20 border-t border-white/10 p-4 shadow-2xl"
    >
      {/* Hidden YouTube Player */}
      <div id="youtube-player" className="hidden" />

      <div className="max-w-7xl mx-auto">
        {/* Progress Bar - Enhanced Glassy */}
        <div className="mb-4 relative">
          <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-2xl p-3">
            <div className="relative">
              {/* Ripple effect when dragging */}
              <AnimatePresence>
                {rippleProgress && (
                  <>
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0.6 }}
                      animate={{ scale: 1.5, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="absolute inset-0 bg-white/10 rounded-xl"
                    />
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0.4 }}
                      animate={{ scale: 1.3, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
                      className="absolute inset-0 bg-white/5 rounded-xl"
                    />
                  </>
                )}
              </AnimatePresence>

              <motion.div
                animate={{
                  y: isDraggingProgress ? [0, -2, 0, 2, 0] : 0,
                }}
                transition={{
                  duration: 0.4,
                  ease: "easeInOut",
                }}
              >
                <Slider
                  value={progress}
                  onValueChange={handleProgressChange}
                  onValueCommit={handleProgressCommit}
                  onPointerUp={() => handleProgressCommit(progress)}
                  onPointerLeave={() => setIsDraggingProgress(false)}
                  max={100}
                  step={0.1}
                  className="cursor-pointer relative z-10"
                />
              </motion.div>

              {/* Time display - Glassy badges */}
              <div className="flex justify-between mt-3 text-xs">
                <motion.span
                  animate={{
                    scale: isDraggingProgress ? 1.1 : 1,
                    color: isDraggingProgress ? "#ffffff" : "#ffffff99",
                  }}
                  className="backdrop-blur-md bg-white/10 border border-white/20 rounded-full px-3 py-1"
                >
                  {formatTime(currentTime)}
                </motion.span>
                <motion.span
                  className="backdrop-blur-md bg-white/10 border border-white/20 rounded-full px-3 py-1 text-white/60"
                >
                  {formatTime(duration)}
                </motion.span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          {/* Left: Album Art and Song Info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Album Art - Enhanced Glassy */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="relative group"
            >
              {albumImage ? (
                <img
                  src={albumImage}
                  alt={track.album.title}
                  className="w-14 h-14 rounded-xl shrink-0 object-cover border-2 border-white/30 shadow-lg"
                />
              ) : (
                <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl shrink-0 backdrop-blur-sm border-2 border-white/30 shadow-lg" />
              )}
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 rounded-xl transition-colors" />
            </motion.div>

            {/* Song Info */}
            <div className="min-w-0 flex-1 max-w-[180px]">
              <MarqueeText 
                text={track.title} 
                className="text-white"
                maxLength={15}
              />
              <MarqueeText 
                text={track.artists} 
                className="text-white/60 text-sm"
                maxLength={20}
              />
            </div>

            {/* Like Button - Enhanced Glassy */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={onLikeToggle}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors shrink-0 backdrop-blur-md border border-white/20"
            >
              <motion.div
                animate={{
                  scale: isLiked ? [1, 1.2, 1] : 1,
                }}
                transition={{ duration: 0.3 }}
              >
                <Heart
                  className={`w-5 h-5 transition-colors ${
                    isLiked ? "fill-red-500 text-red-500" : "text-white/70"
                  }`}
                  strokeWidth={1.5}
                />
              </motion.div>
            </motion.button>
          </div>

          {/* Center: Playback Controls */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              {/* Shuffle - Enhanced Glassy */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onShuffleToggle}
                title={isShuffle ? "셔플 끄기" : "셔플 켜기"}
                className={`p-2.5 rounded-xl transition-all backdrop-blur-md border ${
                  isShuffle
                    ? "bg-white/30 border-white/50 text-white shadow-lg shadow-white/20"
                    : "bg-white/10 border-white/20 text-white/70 hover:bg-white/20"
                }`}
              >
                <Shuffle className="w-4 h-4" strokeWidth={1.5} />
              </motion.button>

              {/* Previous - Enhanced Glassy */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onPrevious}
                disabled={!hasPrevious}
                title="이전 곡"
                className={`p-2.5 rounded-xl transition-all backdrop-blur-md border border-white/20 shadow-lg ${
                  hasPrevious
                    ? "bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                    : "bg-white/5 text-white/30 cursor-not-allowed"
                }`}
              >
                <SkipBack className="w-5 h-5" strokeWidth={1.5} fill="currentColor" />
              </motion.button>

              {/* Play/Pause - Enhanced with multiple effects */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={handlePlayPause}
                className="p-4 bg-gradient-to-br from-white to-white/90 hover:from-white hover:to-white rounded-full transition-all backdrop-blur-sm border-2 border-white/50 shadow-2xl shadow-white/30 relative"
              >
                {/* Pulsing ring when playing */}
                {isPlaying && (
                  <motion.div
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.5, 0, 0.5],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="absolute inset-0 rounded-full border-2 border-white/40"
                  />
                )}

                <AnimatePresence mode="wait">
                  {isPlaying ? (
                    <motion.div
                      key="pause"
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0, rotate: 180 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Pause className="w-5 h-5 text-gray-900" strokeWidth={1.5} fill="currentColor" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="play"
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0, rotate: 180 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Play className="w-5 h-5 text-gray-900" strokeWidth={1.5} fill="currentColor" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>

              {/* Next - Enhanced Glassy */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onNext}
                disabled={!hasNext}
                title="다음 곡"
                className={`p-2.5 rounded-xl transition-all backdrop-blur-md border border-white/20 shadow-lg ${
                  hasNext
                    ? "bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                    : "bg-white/5 text-white/30 cursor-not-allowed"
                }`}
              >
                <SkipForward className="w-5 h-5" strokeWidth={1.5} fill="currentColor" />
              </motion.button>

              {/* Repeat - Enhanced Glassy */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onRepeatToggle}
                title={repeatMode === "off" ? "전체 반복" : repeatMode === "all" ? "한 곡 반복" : "반복 끄기"}
                className={`p-2.5 rounded-xl transition-all backdrop-blur-md border relative ${
                  repeatMode !== "off"
                    ? "bg-white/30 border-white/50 text-white shadow-lg shadow-white/20"
                    : "bg-white/10 border-white/20 text-white/70 hover:bg-white/20"
                }`}
              >
                <Repeat className="w-4 h-4" strokeWidth={1.5} />
                {repeatMode === "one" && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-black text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg">
                    1
                  </span>
                )}
              </motion.button>
            </div>
          </div>

          {/* Right: Volume Control - Enhanced Glassy */}
          <div className="flex items-center gap-3 flex-1 justify-end min-w-0">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setVolume(isMuted ? [70] : [0])}
              className="p-2.5 hover:bg-white/10 rounded-xl transition-colors backdrop-blur-md border border-white/20 shrink-0"
            >
              <AnimatePresence mode="wait">
                {isMuted ? (
                  <motion.div
                    key="muted"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 180 }}
                  >
                    <VolumeX className="w-5 h-5 text-white/70" strokeWidth={1.5} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="volume"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 180 }}
                  >
                    <Volume2 className="w-5 h-5 text-white/70" strokeWidth={1.5} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>

            <div
              className="w-28 hidden sm:block relative"
              onMouseEnter={() => setShowVolumeValue(true)}
              onMouseLeave={() => setShowVolumeValue(false)}
            >
              {/* Volume slider container - Glassy */}
              <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl p-2 relative">
                {/* Ripple effect when dragging */}
                <AnimatePresence>
                  {rippleVolume && (
                    <>
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0.6 }}
                        animate={{ scale: 1.5, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="absolute inset-0 bg-white/10 rounded-xl"
                      />
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0.4 }}
                        animate={{ scale: 1.3, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
                        className="absolute inset-0 bg-white/5 rounded-xl"
                      />
                    </>
                  )}
                </AnimatePresence>

                <motion.div
                  animate={{
                    x: isDraggingVolume ? [0, -1, 0, 1, 0] : 0,
                  }}
                  transition={{
                    duration: 0.4,
                    ease: "easeInOut",
                  }}
                >
                  <Slider
                    value={volume}
                    onValueChange={handleVolumeChange}
                    onPointerUp={() => setIsDraggingVolume(false)}
                    onPointerLeave={() => setIsDraggingVolume(false)}
                    max={100}
                    step={1}
                    className="relative z-10"
                  />
                </motion.div>

                {/* Volume value tooltip */}
                <AnimatePresence>
                  {(showVolumeValue || isDraggingVolume) && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.9 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute -top-10 left-1/2 -translate-x-1/2 backdrop-blur-md bg-black/40 border border-white/20 rounded-lg px-2.5 py-1 shadow-lg"
                    >
                      <motion.span
                        key={volume[0]}
                        initial={{ scale: 1.1 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.1 }}
                        className="text-white text-xs font-medium"
                      >
                        {volume[0]}%
                      </motion.span>
                      {/* Arrow */}
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black/40 border-r border-b border-white/20 rotate-45" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Queue Button */}
            {playQueue && playQueue.tracks.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowQueue(!showQueue)}
                title="재생목록"
                className={`p-2.5 rounded-xl transition-all backdrop-blur-md border shrink-0 ${
                  showQueue
                    ? "bg-white/30 border-white/50 text-white shadow-lg shadow-white/20"
                    : "bg-white/10 border-white/20 text-white/70 hover:bg-white/20"
                }`}
              >
                <ListMusic className="w-5 h-5" strokeWidth={1.5} />
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.div>

      {/* Fullscreen Now Playing Panel */}
      <AnimatePresence>
        {showQueue && playQueue && playQueue.tracks.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] overflow-hidden"
          >
            {/* Background with album art blur */}
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ 
                backgroundImage: albumImage ? `url(${albumImage})` : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)'
              }}
            />
            <div className="absolute inset-0 bg-black/70 backdrop-blur-lg" />
            
            {/* Decorative gradient orbs */}
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-sky-400/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-rose-400/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-violet-400/10 rounded-full blur-3xl pointer-events-none" />

            {/* Main Content */}
            <div className="relative h-full flex flex-col">
              {/* Header - Now just shows track info */}
              <div className="flex items-center justify-center p-6 pt-8">
                <div className="text-center">
                  <p className="text-white/60 text-sm uppercase tracking-wider">지금 재생 중</p>
                  <p className="text-white/40 text-xs mt-1">{playQueue.currentIndex + 1} / {playQueue.tracks.length}</p>
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 flex overflow-hidden">
                {/* Now Playing View */}
                <motion.div 
                  className="flex-1 flex flex-col items-center justify-center px-6"
                  initial={false}
                  animate={{ 
                    opacity: showTrackList ? 0 : 1,
                    scale: showTrackList ? 0.98 : 1
                  }}
                  transition={{ 
                    duration: 0.2,
                    ease: "easeInOut"
                  }}
                  style={{ 
                    pointerEvents: showTrackList ? 'none' : 'auto'
                  }}
                >
                  {/* Album Art - Large */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, type: "spring" }}
                    className="relative mb-8"
                  >
                    {albumImage ? (
                      <motion.img
                        src={albumImage}
                        alt={track?.title}
                        className="w-72 h-72 md:w-80 md:h-80 lg:w-96 lg:h-96 rounded-3xl object-cover shadow-2xl ring-1 ring-white/20"
                        animate={{
                          boxShadow: [
                            "0 25px 80px rgba(168, 85, 247, 0.3)",
                            "0 25px 100px rgba(236, 72, 153, 0.4)",
                            "0 25px 80px rgba(168, 85, 247, 0.3)"
                          ]
                        }}
                        transition={{ duration: 4, repeat: Infinity }}
                      />
                    ) : (
                      <div className="w-72 h-72 md:w-80 md:h-80 lg:w-96 lg:h-96 rounded-3xl bg-gradient-to-br from-purple-500/60 to-pink-500/60 flex items-center justify-center shadow-2xl backdrop-blur-md ring-1 ring-white/20">
                        <Music2 className="w-32 h-32 text-white/60" />
                      </div>
                    )}
                    
                    {/* Playing animation ring */}
                    {isPlaying && (
                      <motion.div
                        className="absolute -inset-2 rounded-3xl border-2 border-purple-400/30"
                        animate={{ scale: [1, 1.02, 1], opacity: [0.5, 0.8, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                  </motion.div>

                  {/* Track Info */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-center mb-8 w-full max-w-md px-4"
                  >
                    <MarqueeText 
                      text={track?.title || ""} 
                      className="text-white text-2xl md:text-3xl font-bold"
                      maxLength={18}
                    />
                    <div className="mt-2">
                      <MarqueeText 
                        text={track?.artists || ""} 
                        className="text-white/60 text-lg"
                        maxLength={25}
                      />
                    </div>
                    {track?.album.title && (
                      <div className="mt-2">
                        <MarqueeText 
                          text={track.album.title} 
                          className="text-white/40 text-sm"
                          maxLength={30}
                        />
                      </div>
                    )}
                  </motion.div>

                  {/* Progress Bar */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="w-full max-w-md mb-6"
                  >
                    <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-4">
                      <Slider
                        value={progress}
                        max={100}
                        step={0.1}
                        onValueChange={(value) => {
                          setProgress(value);
                          if (playerRef.current && duration > 0) {
                            const newTime = (value[0] / 100) * duration;
                            playerRef.current.seekTo(newTime, true);
                          }
                        }}
                        className="w-full"
                      />
                      <div className="flex justify-between text-white/50 text-sm mt-2">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Playback Controls */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="flex items-center justify-center gap-4 mb-6"
                  >
                    {/* Shuffle */}
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={onShuffleToggle}
                      className={`p-3 rounded-2xl transition-all backdrop-blur-md border ${
                        isShuffle 
                          ? "bg-sky-400/30 border-sky-300/50 text-sky-200" 
                          : "bg-white/10 border-white/20 text-white/60 hover:bg-white/20"
                      }`}
                    >
                      <Shuffle className="w-5 h-5" />
                    </motion.button>

                    {/* Previous */}
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={onPrevious}
                      disabled={!hasPrevious}
                      className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all backdrop-blur-md border border-white/20 disabled:opacity-30"
                    >
                      <SkipBack className="w-6 h-6 text-white" fill="white" />
                    </motion.button>

                    {/* Play/Pause */}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handlePlayPause}
                      className="p-6 bg-gradient-to-br from-white to-white/90 hover:from-white hover:to-white rounded-full shadow-2xl shadow-white/40 hover:shadow-white/60 transition-all border-2 border-white/50"
                    >
                      {isPlaying ? (
                        <Pause className="w-8 h-8 text-gray-900" fill="currentColor" />
                      ) : (
                        <Play className="w-8 h-8 text-gray-900 ml-1" fill="currentColor" />
                      )}
                    </motion.button>

                    {/* Next */}
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={onNext}
                      disabled={!hasNext}
                      className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all backdrop-blur-md border border-white/20 disabled:opacity-30"
                    >
                      <SkipForward className="w-6 h-6 text-white" fill="white" />
                    </motion.button>

                    {/* Repeat */}
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={onRepeatToggle}
                      className={`p-3 rounded-2xl transition-all backdrop-blur-md border relative ${
                        repeatMode !== "off" 
                          ? "bg-rose-400/30 border-rose-300/50 text-rose-200" 
                          : "bg-white/10 border-white/20 text-white/60 hover:bg-white/20"
                      }`}
                    >
                      <Repeat className="w-5 h-5" />
                      {repeatMode === "one" && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-400 rounded-full text-[10px] flex items-center justify-center text-white font-bold">1</span>
                      )}
                    </motion.button>
                  </motion.div>

                  {/* Volume & Like & Queue */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="flex items-center gap-4"
                  >
                    {/* Like Button */}
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={onLikeToggle}
                      className={`p-3 rounded-2xl transition-all backdrop-blur-md border ${
                        isLiked 
                          ? "bg-pink-500/30 border-pink-400/50" 
                          : "bg-white/10 border-white/20 hover:bg-white/20"
                      }`}
                    >
                      <Heart className={`w-5 h-5 ${isLiked ? "text-pink-400 fill-pink-400" : "text-white/60"}`} />
                    </motion.button>

                    {/* Volume Control */}
                    <div className="flex items-center gap-3 backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl px-4 py-2">
                      <button
                        onClick={() => setVolume(volume[0] > 0 ? [0] : [100])}
                        className="text-white/60 hover:text-white transition-colors"
                      >
                        {volume[0] === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                      </button>
                      <Slider
                        value={volume}
                        max={100}
                        step={1}
                        onValueChange={(value) => {
                          setVolume(value);
                          if (playerRef.current) {
                            playerRef.current.setVolume(value[0]);
                          }
                        }}
                        className="w-24"
                      />
                      <span className="text-white/50 text-sm font-medium min-w-[2.5rem] text-right">
                        {Math.round(volume[0])}%
                      </span>
                    </div>

                    {/* Queue Button */}
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setShowTrackList(!showTrackList)}
                      className={`p-3 rounded-2xl transition-all backdrop-blur-md border ${
                        showTrackList 
                          ? "bg-white/30 border-white/50 text-white shadow-lg shadow-white/20" 
                          : "bg-white/10 border-white/20 text-white/60 hover:bg-white/20"
                      }`}
                    >
                      <ListMusic className="w-5 h-5" />
                    </motion.button>

                    {/* Close Panel Button */}
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        setShowQueue(false);
                        setShowTrackList(false);
                      }}
                      className="p-3 rounded-2xl transition-all backdrop-blur-md border bg-white/10 border-white/20 text-white/60 hover:bg-white/20"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </motion.button>
                  </motion.div>
                </motion.div>

                {/* Track List View */}
                <AnimatePresence>
                  {showTrackList && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                      style={{ zIndex: 100 }}
                      onClick={() => {
                        setShowTrackList(false);
                      }}
                    >
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="w-[95%] max-w-3xl h-[85vh] max-h-[900px] bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-sm rounded-3xl overflow-hidden flex flex-col border border-white/10 shadow-2xl shadow-black/50"
                        onClick={(e) => e.stopPropagation()}
                      >
                      {/* Track List Header */}
                      <div className="p-5 border-b border-white/10 bg-white/5">
                        <div className="flex items-center justify-between">
                          <div>
                            <h2 className="text-white font-bold text-2xl">재생목록</h2>
                            <p className="text-white/40 text-sm mt-1">{playQueue.tracks.length}곡</p>
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => {
                              setShowTrackList(false);
                            }}
                            className="p-3 rounded-2xl transition-all backdrop-blur-md border bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
                          >
                            <X className="w-5 h-5" />
                          </motion.button>
                        </div>
                      </div>

                      {/* Track List with dnd-kit Drag & Drop */}
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                        measuring={{
                          droppable: {
                            strategy: MeasuringStrategy.Always,
                          },
                        }}
                      >
                        <SortableContext
                          items={localTracks.map(t => t._id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {localTracks.map((qTrack, index) => {
                              const originalIndex = playQueue.tracks.findIndex(
                                t => t.title === qTrack.title && t.artist === qTrack.artist
                              );
                              const isCurrentTrack = originalIndex === playQueue.currentIndex;
                              
                              return (
                                <SortableTrackItem
                                  key={qTrack._id}
                                  track={qTrack}
                                  index={index}
                                  isCurrentTrack={isCurrentTrack}
                                  onPlay={() => {
                                    if (originalIndex !== -1) {
                                      onPlayFromQueue?.(originalIndex);
                                    }
                                    setShowTrackList(false);
                                  }}
                                  onDelete={() => {
                                    if (onRemoveFromQueue && originalIndex !== -1) {
                                      onRemoveFromQueue(originalIndex);
                                    }
                                  }}
                                />
                              );
                            })}
                          </div>
                        </SortableContext>
                      </DndContext>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
