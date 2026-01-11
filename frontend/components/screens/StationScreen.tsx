import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRightLeft, Crown, Loader2, Pause, Play, Radio, RefreshCcw, Search, Send, UserX, Users, Music, Clock, Volume2, VolumeX, Maximize, List, Plus, Trash2, GripVertical, Subtitles, Languages, Pencil, ChevronDown, ChevronUp, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Input } from "../ui/input";
import {
  getStationDetail,
  joinStation,
  leaveStation,
  banStationUser,
  unbanStationUser,
  transferStationHost,
  deleteStation,
  searchTracks,
  getYoutubeVideoId,
  getAlternativeYoutubeVideoId,
  updateStationTitle,
  StationDetail,
  StationParticipant,
  StationPlayback,
  StationUserInfo,
  TrackInfo,
  BannedUser
} from "../../services/api";
import { useStationStomp, ChatMessage, QueueItem, SubtitleSegment } from "../../hooks/useStationStomp";

const imgBackground = "/background.jpg";

interface StationScreenProps {
  stationId: number;
  onExit: () => void;
}



interface PendingPlayback {
  positionMs: number;
  isPlaying: boolean;
}

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume?: (volume: number) => void;
  getVolume?: () => number;
  isMuted?: () => boolean;
  mute?: () => void;
  unMute?: () => void;
  setPlaybackQuality?: (quality: string) => void;
  getAvailableQualityLevels?: () => string[];
  getPlaybackQuality?: () => string;
  destroy: () => void;
}



interface SortableQueueItemProps {
  item: QueueItem;
  index: number;
  isHost: boolean;
  onPlay: (id: string) => void;
  onRemove: (id: string) => void;
}



interface SubtitleState {
  enabled: boolean;
  available: boolean;
  processing: boolean;
  originalLanguage: string;
  segments: SubtitleSegment[];
  currentSegment: SubtitleSegment | null;
}

function SortableQueueItem({ item, index, isHost, onPlay, onRemove }: SortableQueueItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10"
    >
      {isHost && (
        <button
          {...attributes}
          {...listeners}
          className="p-1 rounded-lg text-white/30 hover:text-white/60 cursor-grab active:cursor-grabbing transition-colors"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}
      <span className="text-white/30 text-sm w-6">{index + 1}</span>
      {item.albumImage ? (
        <img src={item.albumImage} alt={item.title} className="w-10 h-10 rounded-lg object-cover" />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
          <Music className="w-4 h-4 text-white/30" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{item.title}</p>
        <p className="text-white/50 text-xs truncate">{item.artist}</p>
      </div>
      {isHost && (
        <>
          <button
            onClick={() => onPlay(item.id)}
            className="p-2 rounded-lg bg-white/5 hover:bg-green-500/20 text-white/40 hover:text-green-400 transition-all"
            title="지금 재생"
          >
            <Play className="w-4 h-4" />
          </button>
          <button
            onClick={() => onRemove(item.id)}
            className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all"
            title="대기열에서 제거"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}

export default function StationScreen({ stationId, onExit }: StationScreenProps) {
  const currentUserId = Number(localStorage.getItem("userId"));

  const [station, setStation] = useState<StationDetail | null>(null);
  const [participants, setParticipants] = useState<StationParticipant[]>([]);
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [playback, setPlayback] = useState<StationPlayback | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TrackInfo[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isSearchingAlternative, setIsSearchingAlternative] = useState(false);

  const [subtitle, setSubtitle] = useState<SubtitleState>({
    enabled: false,
    available: false,
    processing: false,
    originalLanguage: "",
    segments: [],
    currentSegment: null,
  });
  const [showOriginalText, setShowOriginalText] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [isParticipantsCollapsed, setIsParticipantsCollapsed] = useState(false);

  const stompDisconnectRef = useRef<(() => void) | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const playerReadyRef = useRef(false);
  const pendingPlaybackRef = useRef<PendingPlayback | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const videoIdRef = useRef<string | null>(null);
  const playbackRef = useRef<StationPlayback | null>(null);
  const queueRef = useRef<QueueItem[]>([]);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const playerWrapperRef = useRef<HTMLDivElement | null>(null);
  const isHostRef = useRef(false);
  const failedVideoIdsRef = useRef<string[]>([]);

  const isHost = station?.host?.id === currentUserId;
  const _isParticipant = Boolean(station?.participants?.some((participant) => participant.id === currentUserId));
  void _isParticipant;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const stompCallbacks = useMemo(() => ({
    onStationDetail: (stationData: StationDetail, incomingVideoId?: string, incomingQueue?: QueueItem[], incomingVolume?: number, subtitleData?: { enabled: boolean; segments?: SubtitleSegment[]; language?: string }) => {
      setStation(stationData);
      setParticipants(stationData.participants || []);
      setBannedUsers(stationData.bannedUsers || []);
      if (stationData.playback) {
        setPlayback(stationData.playback);
        setIsPlaying(Boolean(stationData.playback.isPlaying));
        if (incomingVideoId) {
          videoIdRef.current = incomingVideoId;
          setVideoId(incomingVideoId);
        }
      }
      if (incomingQueue) {
        setQueue(incomingQueue);
        queueRef.current = incomingQueue;
      }
      if (incomingVolume !== undefined) {
        setVolume(incomingVolume);
        setIsMuted(incomingVolume === 0);
        if (playerRef.current && playerReadyRef.current) {
          playerRef.current.setVolume?.(incomingVolume);
        }
      }
      if (subtitleData?.enabled) {
        setSubtitle(prev => ({
          ...prev,
          enabled: true,
          available: !!subtitleData.segments,
          processing: !subtitleData.segments,
          originalLanguage: subtitleData.language || "",
          segments: subtitleData.segments || [],
        }));
      }
    },
    onParticipantsUpdate: (newParticipants: StationParticipant[], host?: StationUserInfo, status?: string, _action?: string) => {
      setParticipants(newParticipants);
      setStation(prev => {
        if (!prev) return prev;
        return { ...prev, host: host ?? prev.host, status: status ?? prev.status };
      });
      if (status === "CLOSED") {
        alert("스테이션이 종료되었습니다.");
      }
    },
    onPlaybackUpdate: (playbackData: StationPlayback, incomingVideoId?: string, serverTime?: number, senderId?: number) => {
      if (senderId && senderId === currentUserId) return;
      setPlayback(playbackData);
      setIsPlaying(Boolean(playbackData.isPlaying));
      if (incomingVideoId && incomingVideoId !== videoIdRef.current) {
        videoIdRef.current = incomingVideoId;
        setVideoId(incomingVideoId);
      }
      const basePosition = playbackData.positionMs ?? 0;
      const drift = playbackData.isPlaying && serverTime ? Math.max(0, Date.now() - serverTime) : 0;
      const targetPosition = basePosition + drift;
      const player = playerRef.current;
      if (player && playerReadyRef.current) {
        const targetSeconds = targetPosition / 1000;
        const currentSeconds = player.getCurrentTime();
        if (Math.abs(currentSeconds - targetSeconds) > 1.2) {
          player.seekTo(targetSeconds, true);
        }
        if (playbackData.isPlaying) {
          player.playVideo();
        } else {
          player.pauseVideo();
        }
      } else {
        pendingPlaybackRef.current = { positionMs: targetPosition, isPlaying: Boolean(playbackData.isPlaying) };
      }
    },
    onChat: (message: ChatMessage) => {
      setChatMessages(prev => [...prev, message]);
    },
    onKicked: () => {
      alert("스테이션에서 추방되었습니다.");
      stompDisconnectRef.current?.();
      onExit();
    },
    onStationClosed: () => {
      alert("호스트가 스테이션을 종료했습니다.");
      stompDisconnectRef.current?.();
      onExit();
    },
    onVolumeUpdate: (newVolume: number) => {
      if (!isHostRef.current) {
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
        if (playerRef.current && playerReadyRef.current) {
          playerRef.current.setVolume?.(newVolume);
        }
      }
    },
    onQueueUpdate: (newQueue: QueueItem[]) => {
      if (!isHostRef.current) {
        setQueue(newQueue);
        queueRef.current = newQueue;
      }
    },
    onQueueAdd: (item: QueueItem) => {
      setQueue(prev => {
        const updated = [...prev, item];
        queueRef.current = updated;
        return updated;
      });
    },
    onHostChanged: (newHostId: number, newParticipants?: StationParticipant[], host?: StationUserInfo) => {
      if (newParticipants) setParticipants(newParticipants);
      if (host) setStation(prev => prev ? { ...prev, host } : prev);
      if (newHostId === currentUserId) {
        alert("당신이 새로운 호스트가 되었습니다!");
      }
    },
    onSubtitleEnabled: () => {
      setSubtitle(prev => ({ ...prev, enabled: true, processing: true }));
    },
    onSubtitleDisabled: () => {
      setSubtitle(prev => ({ ...prev, enabled: false, processing: false, currentSegment: null }));
    },
    onSubtitleReady: (data: { available: boolean; originalLanguage: string; segments: SubtitleSegment[] }) => {
      setSubtitle(prev => ({
        ...prev,
        available: data.available,
        processing: false,
        originalLanguage: data.originalLanguage || "",
        segments: data.segments || [],
      }));
    },
    onSubtitleStatus: (data: { enabled: boolean; available: boolean; processing: boolean; originalLanguage?: string; segments?: SubtitleSegment[] }) => {
      setSubtitle(prev => ({
        ...prev,
        enabled: data.enabled,
        available: data.available,
        processing: data.processing,
        originalLanguage: data.originalLanguage || "",
        segments: data.segments || [],
      }));
    },
    onTitleChanged: (title: string) => {
      setStation(prev => prev ? { ...prev, title } : prev);
    },
  }), [currentUserId, onExit]);

  const {
    isConnected,
    sendPlaybackUpdate: stompSendPlayback,
    sendChat: stompSendChat,
    requestSync,
    sendVolumeUpdate: stompSendVolume,
    sendQueueUpdate: stompSendQueueUpdate,
    sendQueueAdd: stompSendQueueAdd,
    sendSubtitleEnable: stompSendSubtitleEnable,
    sendSubtitleDisable: stompSendSubtitleDisable,
    disconnect: stompDisconnect,
  } = useStationStomp(stationId, currentUserId, stompCallbacks);

  useEffect(() => {
    stompDisconnectRef.current = stompDisconnect;
  }, [stompDisconnect]);
  
  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    const updatePlayerScale = () => {
      const wrapper = playerWrapperRef.current;
      if (wrapper) {
        const containerWidth = wrapper.clientWidth;
        const scale = containerWidth / 2560;
        wrapper.style.setProperty('--player-scale', String(scale));
      }
    };
    updatePlayerScale();
    window.addEventListener('resize', updatePlayerScale);
    return () => window.removeEventListener('resize', updatePlayerScale);
  }, []);

  const setVideoIdSafe = useCallback((nextId: string | null) => {
    if (!nextId || nextId === videoIdRef.current) {
      return;
    }
    videoIdRef.current = nextId;
    setVideoId(nextId);
    setSubtitle(prev => ({
      ...prev,
      available: false,
      processing: false,
      segments: [],
      currentSegment: null,
    }));
  }, []);

  const resolveVideoId = useCallback(async (title: string, artist: string) => {
    if (!title || !artist) return;
    const resolved = await getYoutubeVideoId(title, artist);
    if (resolved) {
      setVideoIdSafe(resolved);
    }
  }, [setVideoIdSafe]);

  const applyPlaybackSync = useCallback((positionMs: number, shouldPlay: boolean) => {
    const player = playerRef.current;
    if (!player || !playerReadyRef.current) {
      pendingPlaybackRef.current = { positionMs, isPlaying: shouldPlay };
      return;
    }
    try {
      const targetSeconds = positionMs / 1000;
      const currentSeconds = player.getCurrentTime();
      if (Math.abs(currentSeconds - targetSeconds) > 1.2) {
        player.seekTo(targetSeconds, true);
      }
      if (shouldPlay) {
        player.playVideo();
      } else {
        player.pauseVideo();
      }
    } catch {
      pendingPlaybackRef.current = { positionMs, isPlaying: shouldPlay };
    }
  }, []);

  const applyIncomingPlayback = useCallback((
    payload: StationPlayback | null,
    incomingVideoId?: string,
    serverTime?: number,
    senderId?: number
  ) => {
    if (!payload) {
      setPlayback(null);
      setIsPlaying(false);
      return;
    }
    if (senderId && senderId === currentUserId) {
      return;
    }
    setPlayback(payload);
    setIsPlaying(Boolean(payload.isPlaying));

    if (incomingVideoId) {
      setVideoIdSafe(incomingVideoId);
    } else if (payload.title && payload.artist) {
      resolveVideoId(payload.title, payload.artist);
    }

    const basePosition = payload.positionMs ?? 0;
    const drift = payload.isPlaying && serverTime ? Math.max(0, Date.now() - serverTime) : 0;
    const targetPosition = basePosition + drift;
    applyPlaybackSync(targetPosition, Boolean(payload.isPlaying));
  }, [applyPlaybackSync, currentUserId, resolveVideoId, setVideoIdSafe]);

  const sendPlaybackUpdate = useCallback((override?: Partial<StationPlayback> & { videoId?: string }) => {
    if (!isHost || !isConnected) return;

    const title = override?.title ?? playback?.title;
    const artist = override?.artist ?? playback?.artist;
    if (!title || !artist) {
      return;
    }

    const player = playerRef.current;
    const positionMs = override?.positionMs ?? (player ? Math.floor(player.getCurrentTime() * 1000) : (playback?.positionMs ?? 0));
    const durationSec = override?.durationSec ?? playback?.durationSec ?? (player ? Math.floor(player.getDuration()) : undefined);
    const isPlayingValue = override?.isPlaying ?? playback?.isPlaying ?? isPlaying;

    const payload = {
      title,
      artist,
      albumImage: override?.albumImage ?? playback?.albumImage,
      durationSec,
      positionMs,
      isPlaying: Boolean(isPlayingValue),
      videoId: override?.videoId ?? videoIdRef.current ?? undefined,
    };

    stompSendPlayback(payload as StationPlayback & { videoId?: string });
    setPlayback((prev) => ({ ...(prev ?? {}), ...payload }));
    setIsPlaying(Boolean(isPlayingValue));
  }, [isHost, isConnected, playback, isPlaying, stompSendPlayback]);

  const handleSendChat = useCallback(() => {
    if (!chatInput.trim() || !isConnected) return;
    stompSendChat(chatInput.trim());
    setChatInput("");
  }, [chatInput, isConnected, stompSendChat]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const results = await searchTracks(searchQuery.trim(), 8);
      setSearchResults(results);
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery]);

  const handlePlayTrack = useCallback(async (track: TrackInfo) => {
    if (!isHost) return;
    const video = await getYoutubeVideoId(track.title, track.artist);
    if (!video) {
      alert("재생할 영상을 찾지 못했습니다.");
      return;
    }

    const durationSec = track.duration ? Math.floor(track.duration / 1000) : undefined;
    setVideoIdSafe(video);
    sendPlaybackUpdate({
      title: track.title,
      artist: track.artist,
      albumImage: track.albumImage,
      durationSec,
      positionMs: 0,
      isPlaying: true,
      videoId: video
    });
  }, [isHost, sendPlaybackUpdate, setVideoIdSafe]);

  const handleLeave = useCallback(async () => {
    if (!currentUserId) {
      onExit();
      return;
    }
    try {
      await leaveStation(stationId, currentUserId);
    } finally {
      stompDisconnect();
      onExit();
    }
  }, [currentUserId, onExit, stationId, stompDisconnect]);

  const handleBan = useCallback(async (targetId: number) => {
    if (!isHost || !currentUserId) return;
    const result = await banStationUser(stationId, currentUserId, targetId);
    if (result?.success) {
      const detail = await getStationDetail(stationId);
      if (detail) {
        setParticipants(detail.participants || []);
        setBannedUsers(detail.bannedUsers || []);
      }
    } else {
      alert("영구추방에 실패했습니다.");
    }
  }, [currentUserId, isHost, stationId]);

  const handleUnban = useCallback(async (targetId: number) => {
    if (!isHost || !currentUserId) return;
    const result = await unbanStationUser(stationId, currentUserId, targetId);
    if (result?.success) {
      setBannedUsers(prev => prev.filter(u => u.id !== targetId));
    } else {
      alert("차단해제에 실패했습니다.");
    }
  }, [currentUserId, isHost, stationId]);

  const handleTransferHost = useCallback(async (targetId: number) => {
    if (!isHost || !currentUserId) return;
    const targetUser = participants.find(p => p.id === targetId);
    if (!targetUser) return;
    
    const confirmed = window.confirm(`${targetUser.nickname}님에게 호스트 권한을 이전하시겠습니까?`);
    if (!confirmed) return;
    
    const result = await transferStationHost(stationId, currentUserId, targetId);
    if (!result?.success) {
      alert("호스트 이전에 실패했습니다.");
    }
  }, [currentUserId, isHost, participants, stationId]);

  const handleDeleteStation = useCallback(async () => {
    if (!isHost || !currentUserId) return;
    
    const confirmed = window.confirm("스테이션을 종료하시겠습니까? 모든 참여자가 퇴장됩니다.");
    if (!confirmed) return;
    
    const result = await deleteStation(stationId, currentUserId);
    if (result) {
      onExit();
    } else {
      alert("스테이션 종료에 실패했습니다.");
    }
  }, [currentUserId, isHost, stationId, onExit]);

  const sendQueueUpdate = useCallback((newQueue: QueueItem[]) => {
    if (isHost && isConnected) {
      stompSendQueueUpdate(newQueue);
    }
  }, [isHost, isConnected, stompSendQueueUpdate]);

  const handleAddToQueue = useCallback(async (track: TrackInfo) => {
    if (!isConnected) return;
    const video = await getYoutubeVideoId(track.title, track.artist);
    const newItem: QueueItem = {
      id: `${Date.now()}-${Math.random()}`,
      title: track.title,
      artist: track.artist,
      albumImage: track.albumImage,
      duration: track.duration,
      videoId: video || undefined
    };
    stompSendQueueAdd(newItem);
  }, [isConnected, stompSendQueueAdd]);

  const handleRemoveFromQueue = useCallback((itemId: string) => {
    if (!isHost) return;
    setQueue(prev => {
      const updated = prev.filter(item => item.id !== itemId);
      queueRef.current = updated;
      sendQueueUpdate(updated);
      return updated;
    });
  }, [isHost, sendQueueUpdate]);

  const handlePlayFromQueue = useCallback(async (itemId: string) => {
    if (!isHost) return;
    const item = queueRef.current.find(q => q.id === itemId);
    if (!item) return;
    
    const updated = queueRef.current.filter(q => q.id !== itemId);
    setQueue(updated);
    queueRef.current = updated;
    sendQueueUpdate(updated);

    let video = item.videoId;
    if (!video) {
      video = await getYoutubeVideoId(item.title, item.artist) || undefined;
    }
    if (!video) return;

    const durationSec = item.duration ? Math.floor(item.duration / 1000) : undefined;
    setVideoIdSafe(video);
    sendPlaybackUpdate({
      title: item.title,
      artist: item.artist,
      albumImage: item.albumImage,
      durationSec,
      positionMs: 0,
      isPlaying: true,
      videoId: video
    });
  }, [isHost, sendPlaybackUpdate, setVideoIdSafe, sendQueueUpdate]);

  const handleQueueReorder = useCallback((activeId: string, overId: string) => {
    if (!isHost) return;
    setQueue(prev => {
      const oldIndex = prev.findIndex(item => item.id === activeId);
      const newIndex = prev.findIndex(item => item.id === overId);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const updated = arrayMove(prev, oldIndex, newIndex);
      queueRef.current = updated;
      sendQueueUpdate(updated);
      return updated;
    });
  }, [isHost, sendQueueUpdate]);

  const playNextInQueue = useCallback(async () => {
    if (!isHost || queueRef.current.length === 0) return;
    const [nextTrack, ...rest] = queueRef.current;
    setQueue(rest);
    queueRef.current = rest;
    sendQueueUpdate(rest);

    let video = nextTrack.videoId;
    if (!video) {
      video = await getYoutubeVideoId(nextTrack.title, nextTrack.artist) || undefined;
    }
    if (!video) return;

    const durationSec = nextTrack.duration ? Math.floor(nextTrack.duration / 1000) : undefined;
    setVideoIdSafe(video);
    sendPlaybackUpdate({
      title: nextTrack.title,
      artist: nextTrack.artist,
      albumImage: nextTrack.albumImage,
      durationSec,
      positionMs: 0,
      isPlaying: true,
      videoId: video
    });
  }, [isHost, sendPlaybackUpdate, setVideoIdSafe, sendQueueUpdate]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    if (playerRef.current && playerReadyRef.current) {
      playerRef.current.setVolume?.(newVolume);
      if (newVolume === 0) {
        playerRef.current.mute?.();
        setIsMuted(true);
      } else if (isMuted) {
        playerRef.current.unMute?.();
        setIsMuted(false);
      }
    }
    if (isHost && isConnected) {
      stompSendVolume(newVolume);
    }
  }, [isHost, isMuted, isConnected, stompSendVolume]);

  const toggleMute = useCallback(() => {
    if (playerRef.current && playerReadyRef.current) {
      const newVolume = isMuted ? (volume || 100) : 0;
      playerRef.current.setVolume?.(newVolume);
      setIsMuted(!isMuted);
      if (isHost && isConnected) {
        stompSendVolume(newVolume);
      }
    }
  }, [isMuted, volume, isHost, isConnected, stompSendVolume]);

  const toggleFullscreen = useCallback(() => {
    const container = playerContainerRef.current;
    if (!container) return;
    
    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  const toggleSubtitle = useCallback(() => {
    if (!isHost || !isConnected) return;
    
    if (subtitle.enabled) {
      stompSendSubtitleDisable();
      setSubtitle(prev => ({ ...prev, enabled: false, currentSegment: null }));
    } else {
      stompSendSubtitleEnable(videoIdRef.current ?? undefined);
      setSubtitle(prev => ({ ...prev, enabled: true }));
    }
  }, [isHost, isConnected, subtitle.enabled, stompSendSubtitleDisable, stompSendSubtitleEnable]);

  const updateCurrentSubtitle = useCallback((timeSeconds: number) => {
    if (!subtitle.enabled || subtitle.segments.length === 0) {
      if (subtitle.currentSegment) {
        setSubtitle(prev => ({ ...prev, currentSegment: null }));
      }
      return;
    }
    
    const segment = subtitle.segments.find(
      s => timeSeconds >= s.startTime && timeSeconds <= s.endTime
    );
    
    if (segment !== subtitle.currentSegment) {
      setSubtitle(prev => ({ ...prev, currentSegment: segment || null }));
    }
  }, [subtitle.enabled, subtitle.segments, subtitle.currentSegment]);

  const handleVideoError = useCallback(async (errorCode: number, failedVideoId: string) => {
    const isEmbedError = errorCode === 101 || errorCode === 150;
    
    if (!isEmbedError) {
      setVideoError("영상을 재생할 수 없습니다.");
      return;
    }

    const currentPlayback = playbackRef.current;
    if (!currentPlayback?.title || !currentPlayback?.artist) {
      setVideoError("영상 정보를 찾을 수 없습니다.");
      return;
    }

    failedVideoIdsRef.current = [...failedVideoIdsRef.current, failedVideoId];
    
    if (failedVideoIdsRef.current.length > 5) {
      setVideoError("재생 가능한 영상을 찾을 수 없습니다.");
      if (isHost && queueRef.current.length > 0) {
        playNextInQueue();
      }
      return;
    }

    setIsSearchingAlternative(true);
    setVideoError("다른 영상을 검색 중입니다...");

    try {
      const alternativeVideoId = await getAlternativeYoutubeVideoId(
        currentPlayback.title,
        currentPlayback.artist,
        failedVideoIdsRef.current
      );

      if (alternativeVideoId) {
        setVideoError(null);
        setVideoIdSafe(alternativeVideoId);
        
        if (isHost) {
          sendPlaybackUpdate({
            videoId: alternativeVideoId,
            positionMs: 0,
            isPlaying: true
          });
        }
      } else {
        setVideoError("재생 가능한 영상을 찾을 수 없습니다.");
        if (isHost && queueRef.current.length > 0) {
          setTimeout(() => playNextInQueue(), 2000);
        }
      }
    } catch {
      setVideoError("대체 영상 검색에 실패했습니다.");
    } finally {
      setIsSearchingAlternative(false);
    }
  }, [isHost, playNextInQueue, sendPlaybackUpdate, setVideoIdSafe]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadStation = async () => {
      setIsLoading(true);
      const detail = await getStationDetail(stationId);
      if (!mounted) return;
      if (detail) {
        const alreadyParticipant = detail.participants?.some((participant) => participant.id === currentUserId);
        if (!alreadyParticipant && currentUserId) {
          const joined = await joinStation(currentUserId, detail.inviteCode);
          if (!mounted) return;
          if (joined) {
            setStation(joined);
            setParticipants(joined.participants || []);
            setBannedUsers(joined.bannedUsers || []);
            if (joined.playback) {
              applyIncomingPlayback(joined.playback, undefined, undefined, undefined);
            }
          } else {
            alert("스테이션 입장에 실패했습니다.");
            onExit();
          }
        } else {
          setStation(detail);
          setParticipants(detail.participants || []);
          setBannedUsers(detail.bannedUsers || []);
          if (detail.playback) {
            applyIncomingPlayback(detail.playback, undefined, undefined, undefined);
          }
        }
      }
      setIsLoading(false);
    };
    loadStation();
    return () => {
      mounted = false;
    };
  }, [applyIncomingPlayback, currentUserId, onExit, stationId]);



  useEffect(() => {
    playbackRef.current = playback;
  }, [playback]);

  const ytApiLoadedRef = useRef(false);

  useEffect(() => {
    if (!videoId) return;

    playerReadyRef.current = false;
    setIsPlaying(false);

    const initPlayer = () => {
      const container = document.getElementById("station-player");
      if (!container) {
        console.error("station-player container not found");
        return;
      }

      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
        }
        playerRef.current = null;
      }

      container.innerHTML = "";

      try {
        playerRef.current = new window.YT.Player("station-player", {
          videoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            enablejsapi: 1,
            fs: 0,
            iv_load_policy: 3,
            disablekb: 1,
            mute: 0
          },
          events: {
            onReady: (event) => {
              console.log("스테이션 YouTube 플레이어 준비됨");
              playerReadyRef.current = true;
              playerRef.current = event.target;
              setVideoError(null);
              failedVideoIdsRef.current = [];
              const player = event.target as YTPlayer;
              setTimeout(() => {
                const qualities = player.getAvailableQualityLevels?.() || [];
                const preferredQualities = ['highres', 'hd2160', 'hd1440', 'hd1080'];
                const bestQuality = preferredQualities.find(q => qualities.includes(q));
                if (bestQuality) {
                  player.setPlaybackQuality?.(bestQuality);
                }
              }, 500);
              event.target.setVolume?.(volume);
              const pending = pendingPlaybackRef.current;
              const latestPlayback = playbackRef.current;
              if (pending) {
                applyPlaybackSync(pending.positionMs, pending.isPlaying);
                pendingPlaybackRef.current = null;
              } else if (!isHost && latestPlayback?.positionMs !== undefined) {
                applyPlaybackSync(latestPlayback.positionMs, Boolean(latestPlayback.isPlaying));
              }
              if (!isHost && latestPlayback?.isPlaying === false) {
                event.target.pauseVideo();
              }
            },
            onStateChange: (event: { data: number; target: YTPlayer }) => {
              if (event.data === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true);
                const qualities = event.target.getAvailableQualityLevels?.() || [];
                const preferredQualities = ['highres', 'hd2160', 'hd1440', 'hd1080'];
                const bestQuality = preferredQualities.find(q => qualities.includes(q));
                if (bestQuality) {
                  event.target.setPlaybackQuality?.(bestQuality);
                }
                if (isHost) {
                  sendPlaybackUpdate({ isPlaying: true });
                }
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                setIsPlaying(false);
                if (isHost) {
                  sendPlaybackUpdate({ isPlaying: false });
                }
              } else if (event.data === window.YT.PlayerState.ENDED) {
                setIsPlaying(false);
                if (isHost) {
                  if (queueRef.current.length > 0) {
                    playNextInQueue();
                  } else {
                    sendPlaybackUpdate({ isPlaying: false, positionMs: 0 });
                  }
                }
              }
            },
            onError: (event: { data: number }) => {
              console.error("YouTube 플레이어 에러:", event.data);
              if (videoId) {
                handleVideoError(event.data, videoId);
              }
            }
          }
        });
      } catch (err) {
        console.error("Failed to create YouTube player:", err);
      }
    };

    const loadYTApi = () => {
      if (window.YT && window.YT.Player) {
        setTimeout(initPlayer, 100);
        return;
      }

      const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if (!existingScript) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName("script")[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      }

      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        ytApiLoadedRef.current = true;
        if (prevCallback) prevCallback();
        initPlayer();
      };

      const checkInterval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(checkInterval);
          if (!playerRef.current) {
            initPlayer();
          }
        }
      }, 100);

      setTimeout(() => clearInterval(checkInterval), 5000);
    };

    loadYTApi();

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
        }
        playerRef.current = null;
      }
    };
  }, [videoId]);

  useEffect(() => {
    if (!isHost || !isPlaying) return;
    const interval = setInterval(() => {
      sendPlaybackUpdate();
    }, 2000);
    return () => clearInterval(interval);
  }, [isHost, isPlaying, sendPlaybackUpdate]);

  useEffect(() => {
    if (!videoId) {
      setCurrentTime(0);
      setDuration(0);
      return;
    }
    const interval = setInterval(() => {
      const player = playerRef.current;
      if (player && playerReadyRef.current) {
        const time = player.getCurrentTime?.() || 0;
        const dur = player.getDuration?.() || 0;
        setCurrentTime(time);
        setDuration(dur);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [videoId]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    updateCurrentSubtitle(currentTime);
  }, [currentTime, updateCurrentSubtitle]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (value: number) => {
    const player = playerRef.current;
    if (!player || !playerReadyRef.current) return;
    player.seekTo?.(value, true);
    setCurrentTime(value);
    sendPlaybackUpdate({ positionMs: value * 1000 });
  };

  const playbackTitle = playback?.title || "재생 중인 곡이 없습니다.";
  const playbackArtist = playback?.artist || "호스트가 곡을 선택하면 동기화됩니다.";

  const hostLabel = useMemo(() => {
    if (!station?.host) return "호스트 없음";
    return station.host.nickname;
  }, [station?.host]);

  if (!currentUserId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        로그인이 필요합니다.
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 bg-center bg-cover bg-no-repeat flex flex-col"
      style={{ backgroundImage: `url('${imgBackground}')` }}
    >
      <div className="absolute inset-0 bg-black/30 pointer-events-none" />

      <header className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-4 md:p-6 backdrop-blur-xl bg-black/20 border-b border-white/10">
        <div className="flex items-center gap-4">
          <button
            onClick={handleLeave}
            className="p-2 rounded-xl bg-white/10 border border-white/20 text-white/70 hover:bg-white/20 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10 border border-white/20">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white/50 text-xs">스테이션</p>
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editTitleValue}
                    onChange={(e) => setEditTitleValue(e.target.value)}
                    className="bg-white/10 border border-white/30 rounded-lg px-2 py-1 text-white text-lg font-semibold focus:outline-none focus:border-white/50"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (editTitleValue.trim()) {
                          updateStationTitle(stationId, currentUserId, editTitleValue.trim()).then((result) => {
                            if (result.success) setStation(prev => prev ? { ...prev, title: editTitleValue.trim() } : prev);
                          });
                        }
                        setIsEditingTitle(false);
                      } else if (e.key === "Escape") {
                        setIsEditingTitle(false);
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (editTitleValue.trim()) {
                        updateStationTitle(stationId, currentUserId, editTitleValue.trim()).then((result) => {
                          if (result.success) setStation(prev => prev ? { ...prev, title: editTitleValue.trim() } : prev);
                        });
                      }
                      setIsEditingTitle(false);
                    }}
                    className="p-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsEditingTitle(false)}
                    className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-white text-xl font-semibold">{station?.title || "스테이션"}</h1>
                  {isHost && (
                    <button
                      onClick={() => {
                        setEditTitleValue(station?.title || "");
                        setIsEditingTitle(true);
                      }}
                      className="p-1 rounded bg-white/10 text-white/50 hover:bg-white/20 hover:text-white/80 transition-all"
                      title="제목 수정"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/60 text-sm">
            코드 {station?.inviteCode || "----"}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs border ${isConnected ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/40" : "bg-white/10 text-white/50 border-white/20"}`}>
            {isConnected ? "LIVE" : "연결 끊김"}
          </span>
          <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/60 text-sm">
            호스트 {hostLabel}
          </span>
          {isHost && (
            <button
              onClick={handleDeleteStation}
              className="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all"
            >
              스테이션 종료
            </button>
          )}
          <button
            onClick={handleLeave}
            className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white/70 hover:bg-white/20 transition-all"
          >
            나가기
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
        <div className="max-w-[2400px] mx-auto">
          <div className="grid lg:grid-cols-[2.5fr_1fr] gap-6">
            <div className="space-y-6">
              <div 
                ref={playerContainerRef}
                className={`rounded-3xl overflow-hidden border border-white/20 bg-black shadow-2xl ${isFullscreen ? 'fullscreen-mode' : ''}`}
              >
                <div ref={playerWrapperRef} className="relative w-full aspect-video bg-black overflow-hidden">
                  <div 
                    id="station-player" 
                    className="absolute top-0 left-0 origin-top-left"
                    style={{ width: '2560px', height: '1440px', transform: 'scale(var(--player-scale, 0.4))' }}
                  />
                  {!videoId && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-gradient-to-br from-slate-900/80 to-slate-800/80 z-10">
                      <Radio className="w-12 h-12 text-white/50 mb-4" />
                      <p className="text-white/70 text-lg">재생 대기 중</p>
                      <p className="text-white/40 text-sm mt-2">호스트가 곡을 선택하면 즉시 동기화됩니다.</p>
                    </div>
                  )}
                  {videoError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-gradient-to-br from-red-900/80 to-slate-900/80 z-20">
                      {isSearchingAlternative ? (
                        <>
                          <Loader2 className="w-12 h-12 text-yellow-400 mb-4 animate-spin" />
                          <p className="text-yellow-300 text-lg font-medium">{videoError}</p>
                          <p className="text-white/50 text-sm mt-2">잠시만 기다려 주세요...</p>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                            <span className="text-red-400 text-2xl">!</span>
                          </div>
                          <p className="text-red-300 text-lg font-medium">{videoError}</p>
                          <p className="text-white/50 text-sm mt-2">영상 소유자가 외부 재생을 차단했습니다.</p>
                        </>
                      )}
                    </div>
                  )}
                  <AnimatePresence>
                    {subtitle.enabled && subtitle.currentSegment && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="absolute bottom-4 left-4 right-4 z-30 flex justify-center"
                      >
                        <div className="bg-black/80 backdrop-blur-sm rounded-xl px-6 py-3 max-w-[90%] text-center">
                          <p className="text-white text-lg font-medium leading-relaxed">
                            {showOriginalText 
                              ? subtitle.currentSegment.text 
                              : subtitle.currentSegment.translatedText || subtitle.currentSegment.text
                            }
                          </p>
                          {subtitle.currentSegment.translatedText && subtitle.currentSegment.text !== subtitle.currentSegment.translatedText && (
                            <p className="text-white/50 text-sm mt-1">
                              {showOriginalText 
                                ? subtitle.currentSegment.translatedText 
                                : subtitle.currentSegment.text
                              }
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {subtitle.enabled && subtitle.processing && (
                    <div className="absolute bottom-4 left-4 right-4 z-30 flex justify-center">
                      <div className="bg-black/80 backdrop-blur-sm rounded-xl px-6 py-3 flex items-center gap-3">
                        <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                        <p className="text-white/70 text-sm">자막 생성 중...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-white/20 bg-white/10 backdrop-blur-xl p-5 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="text-white/50 text-xs mb-1">현재 재생 중</p>
                    <h2 className="text-white text-2xl font-semibold mb-1">{playbackTitle}</h2>
                    <p className="text-white/50 text-sm">{playbackArtist}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {isHost && (
                      <button
                        onClick={() => {
                          const player = playerRef.current;
                          if (!player || !playerReadyRef.current || typeof player.playVideo !== "function" || typeof player.pauseVideo !== "function") {
                            return;
                          }
                          if (isPlaying) {
                            player.pauseVideo();
                          } else {
                            player.playVideo();
                          }
                        }}
                        className="px-4 py-2 rounded-xl bg-white/15 border border-white/30 text-white hover:bg-white/25 transition-all flex items-center gap-2"
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        {isPlaying ? "일시정지" : "재생"}
                      </button>
                    )}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/20">
                      {isHost ? (
                        <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors">
                          {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                      ) : (
                        <span className="text-white/50">
                          {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </span>
                      )}
                      {isHost ? (
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={isMuted ? 0 : volume}
                          onChange={(e) => handleVolumeChange(Number(e.target.value))}
                          className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                        />
                      ) : (
                        <div className="w-20 h-1 bg-white/20 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-white/50 rounded-full transition-all"
                            style={{ width: `${isMuted ? 0 : volume}%` }}
                          />
                        </div>
                      )}
                      <span className="text-white/50 text-xs w-8">{isMuted ? 0 : volume}%</span>
                    </div>
                    {!isHost && (
                      <button
                        onClick={requestSync}
                        className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white/70 hover:bg-white/20 transition-all flex items-center gap-2"
                      >
                        <RefreshCcw className="w-4 h-4" />
                        동기화
                      </button>
                    )}
                    <span className="text-white/40 text-xs">{isPlaying ? "재생 중" : "일시정지"}</span>
                    <button
                      onClick={toggleFullscreen}
                      className="p-2 rounded-xl bg-white/10 border border-white/20 text-white/70 hover:bg-white/20 transition-all"
                      title="전체화면"
                    >
                      <Maximize className="w-4 h-4" />
                    </button>
                    {isHost && videoId && (
                      <button
                        onClick={toggleSubtitle}
                        className={`px-3 py-2 rounded-xl border transition-all flex items-center gap-2 text-sm ${
                          subtitle.enabled 
                            ? "bg-blue-500/20 border-blue-500/40 text-blue-300 hover:bg-blue-500/30" 
                            : "bg-white/10 border-white/20 text-white/70 hover:bg-white/20"
                        }`}
                        title={subtitle.enabled ? "자막 끄기" : "자막 켜기 (AI 번역)"}
                      >
                        <Subtitles className="w-4 h-4" />
                        {subtitle.processing ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /> 생성중</>
                        ) : (
                          subtitle.enabled ? "자막 끄기" : "자막 켜기"
                        )}
                      </button>
                    )}
                    {subtitle.enabled && (
                      <button
                        onClick={() => setShowOriginalText(!showOriginalText)}
                        className={`p-2 rounded-xl border transition-all ${
                          showOriginalText 
                            ? "bg-purple-500/20 border-purple-500/40 text-purple-300 hover:bg-purple-500/30" 
                            : "bg-white/10 border-white/20 text-white/70 hover:bg-white/20"
                        }`}
                        title={showOriginalText ? "번역문 보기" : "원문 보기"}
                      >
                        <Languages className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                {videoId && duration > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="flex items-center gap-3">
                      <span className="text-white/50 text-xs w-10 text-right">{formatTime(currentTime)}</span>
                      {isHost ? (
                        <input
                          type="range"
                          min="0"
                          max={duration}
                          value={currentTime}
                          onChange={(e) => handleSeek(Number(e.target.value))}
                          className="flex-1 h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg"
                        />
                      ) : (
                        <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-white/60 rounded-full transition-all duration-300"
                            style={{ width: `${(currentTime / duration) * 100}%` }}
                          />
                        </div>
                      )}
                      <span className="text-white/50 text-xs w-10">{formatTime(duration)}</span>
                    </div>
                  </div>
                )}
              </div>

              <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-3xl border border-white/20 bg-white/10 backdrop-blur-2xl p-6 shadow-2xl overflow-hidden relative"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10">
                        <Search className="w-5 h-5 text-indigo-300" />
                      </div>
                      <div>
                        <h3 className="text-white text-lg font-bold tracking-tight">음악 검색</h3>
                        <p className="text-white/40 text-xs font-medium">{isHost ? "곡을 검색하고 바로 재생하세요" : "곡을 검색하고 대기열에 추가하세요"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="relative mb-6 group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-white/30 group-focus-within:text-white/80 transition-colors" />
                    </div>
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="곡 제목 또는 아티스트로 검색..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSearch();
                        }
                      }}
                      className="h-12 pl-11 pr-12 rounded-2xl bg-black/20 border-white/10 text-white placeholder:text-white/30 focus:bg-black/30 focus:border-white/30 transition-all text-base"
                    />
                    <button
                      onClick={handleSearch}
                      disabled={searchLoading}
                      className="absolute right-2 top-1.5 bottom-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/5 text-white/80 transition-all disabled:opacity-50"
                    >
                      {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeft className="w-4 h-4 rotate-180" />}
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar -mr-2">
                    <AnimatePresence mode="popLayout">
                      {searchResults.map((track, index) => (
                        <motion.div
                          key={`${track.title}-${track.artist}-${index}`}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ delay: index * 0.05 }}
                          className="group relative flex items-center gap-4 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all duration-300 overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/0 to-indigo-500/0 group-hover:from-white/5 group-hover:to-transparent transition-all duration-500" />
                          
                          <div className="relative shrink-0">
                            {track.albumImage ? (
                              <img
                                src={track.albumImage}
                                alt={track.title}
                                className="w-14 h-14 rounded-xl object-cover shadow-lg border border-white/10 group-hover:scale-105 transition-transform duration-500"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                                <Music className="w-6 h-6 text-white/20" />
                              </div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl backdrop-blur-[1px] pointer-events-none">
                              <Play className="w-6 h-6 text-white drop-shadow-lg fill-white" />
                            </div>
                          </div>

                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <h4 className="text-white text-base font-medium truncate leading-tight group-hover:text-indigo-200 transition-colors">
                              {track.title}
                            </h4>
                            <p className="text-white/50 text-sm truncate mt-0.5 group-hover:text-white/70 transition-colors">
                              {track.artist}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 pr-2">
                            {track.duration && (
                              <div className="hidden sm:flex items-center gap-1.5 text-white/30 text-xs font-medium tabular-nums bg-black/20 px-2 py-1 rounded-lg">
                                <Clock className="w-3 h-3" />
                                {Math.floor(track.duration / 60000)}:{String(Math.floor((track.duration % 60000) / 1000)).padStart(2, '0')}
                              </div>
                            )}
                            
                            <button
                              onClick={() => handleAddToQueue(track)}
                              className="relative overflow-hidden p-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-white/70 hover:text-white transition-all z-10"
                              title="대기열에 추가"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            {isHost && (
                              <button
                                onClick={() => handlePlayTrack(track)}
                                className="relative overflow-hidden px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white text-sm font-medium transition-all hover:scale-105 active:scale-95 z-10"
                              >
                                <span className="relative z-10 flex items-center gap-2">
                                  재생
                                </span>
                              </button>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    
                    {searchResults.length === 0 && !searchLoading && (
                      <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center py-12 text-center"
                      >
                        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                          <Music className="w-8 h-8 text-white/20" />
                        </div>
                        <p className="text-white/40 text-sm font-medium">좋아하는 곡을 검색하세요</p>
                        <p className="text-white/20 text-xs mt-1">YouTube Music 검색 결과</p>
                      </motion.div>
                    )}
                  </div>
                </motion.div>

              </div>

            <div className="space-y-6">
              <div className="rounded-3xl border border-white/20 bg-white/10 backdrop-blur-xl p-5 shadow-xl">
                <button
                  onClick={() => setIsParticipantsCollapsed(!isParticipantsCollapsed)}
                  className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-white" />
                    <h3 className="text-white text-lg font-semibold">참여자</h3>
                    <span className="text-white/50 text-sm">{participants.length}/{station?.maxParticipants || 0}</span>
                  </div>
                  {isParticipantsCollapsed ? (
                    <ChevronDown className="w-5 h-5 text-white/50" />
                  ) : (
                    <ChevronUp className="w-5 h-5 text-white/50" />
                  )}
                </button>
                {!isParticipantsCollapsed && (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                  {participants.map((participant) => {
                    const isParticipantHost = participant.role === "HOST" || participant.role === "host";
                    const isSelf = participant.id === currentUserId;
                    return (
                      <div
                        key={participant.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/5 border border-white/10"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {participant.avatar && (participant.avatar.startsWith("http") || participant.avatar.startsWith("data:")) ? (
                            <img
                              src={participant.avatar}
                              alt={participant.nickname}
                              className="w-10 h-10 rounded-full object-cover border border-white/20 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs text-white/70 shrink-0">
                              {participant.nickname?.slice(0, 1) || "?"}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-white text-sm font-medium truncate max-w-[100px]">{participant.nickname}</p>
                            <div className="flex items-center gap-2 text-white/40 text-xs">
                              {isParticipantHost ? "HOST" : "MEMBER"}
                              {isSelf && "(나)"}
                            </div>
                          </div>
                          {isParticipantHost && <Crown className="w-4 h-4 text-amber-300 shrink-0" />}
                        </div>
                        {isHost && !isParticipantHost && !isSelf && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleTransferHost(participant.id)}
                              className="px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 transition-all flex items-center gap-1 text-xs"
                              title="호스트 권한 이전"
                            >
                              <ArrowRightLeft className="w-4 h-4" />
                              호스트
                            </button>
                            <button
                              onClick={() => handleBan(participant.id)}
                              className="px-3 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all flex items-center gap-1 text-xs"
                            >
                              <UserX className="w-4 h-4" />
                              추방
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                )}
              </div>

              {isHost && bannedUsers.length > 0 && (
                <div className="rounded-3xl border border-red-500/20 bg-red-500/5 backdrop-blur-xl p-5 shadow-xl">
                  <div className="flex items-center gap-2 mb-4">
                    <UserX className="w-5 h-5 text-red-400" />
                    <h3 className="text-red-400 text-lg font-semibold">차단된 유저</h3>
                    <span className="text-red-400/60 text-sm">({bannedUsers.length})</span>
                  </div>
                  <div className="space-y-3 max-h-[200px] overflow-y-auto custom-scrollbar">
                    {bannedUsers.map((user) => (
                      <div key={user.id} className="flex items-center justify-between bg-white/5 rounded-2xl p-3">
                        <div className="flex items-center gap-3">
                          {user.avatar && (user.avatar.startsWith("http") || user.avatar.startsWith("data:")) ? (
                            <img
                              src={user.avatar}
                              alt={user.nickname}
                              className="w-10 h-10 rounded-full object-cover border border-red-500/30"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-sm text-red-400">
                              {user.nickname?.slice(0, 1) || "?"}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-white text-sm font-medium truncate">{user.nickname}</p>
                            <p className="text-white/40 text-xs">차단됨</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnban(user.id)}
                          className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white/60 hover:bg-white/20 transition-all flex items-center gap-1 text-xs"
                        >
                          차단해제
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={`rounded-3xl border border-white/20 bg-white/10 backdrop-blur-xl p-5 shadow-xl flex flex-col ${isParticipantsCollapsed ? "h-[700px]" : "h-[480px]"} transition-all duration-300`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white text-lg font-semibold">실시간 채팅</h3>
                  <span className="text-white/40 text-xs">{isConnected ? "연결됨" : "오프라인"}</span>
                </div>
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className="flex items-start gap-3 overflow-hidden">
                      {msg.user.avatar && (msg.user.avatar.startsWith("http") || msg.user.avatar.startsWith("data:")) ? (
                        <img
                          src={msg.user.avatar}
                          alt={msg.user.nickname}
                          className="w-9 h-9 rounded-full object-cover border border-white/20 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs text-white/70 shrink-0">
                          {msg.user.nickname?.slice(0, 1) || "?"}
                        </div>
                      )}
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-white text-sm font-medium truncate max-w-[120px]">{msg.user.nickname}</p>
                          <span className="text-white/40 text-xs shrink-0">{new Date(msg.sentAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <p className="text-white/70 text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                      </div>
                    </div>
                  ))}
                  {chatMessages.length === 0 && (
                    <p className="text-white/40 text-sm">아직 채팅이 없습니다.</p>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="mt-4 flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="메시지를 입력하세요"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSendChat();
                      }
                    }}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  />
                  <button
                    onClick={handleSendChat}
                    disabled={!chatInput.trim()}
                    className="px-4 rounded-xl bg-white/15 border border-white/30 text-white hover:bg-white/25 transition-all disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {queue.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-3xl border border-white/20 bg-white/10 backdrop-blur-xl p-5 shadow-xl"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <List className="w-5 h-5 text-white" />
                      <h3 className="text-white text-lg font-semibold">재생 대기열</h3>
                    </div>
                    <span className="text-white/50 text-sm">{queue.length}곡</span>
                  </div>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event: DragEndEvent) => {
                        const { active, over } = event;
                        if (over && active.id !== over.id) {
                          handleQueueReorder(String(active.id), String(over.id));
                        }
                      }}
                    >
                      <SortableContext items={queue.map(q => q.id)} strategy={verticalListSortingStrategy}>
                        {queue.map((item, index) => (
                          <SortableQueueItem
                            key={item.id}
                            item={item}
                            index={index}
                            isHost={isHost}
                            onPlay={handlePlayFromQueue}
                            onRemove={handleRemoveFromQueue}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {isLoading && (
            <div className="mt-6 text-white/50 text-sm">스테이션 정보를 불러오는 중...</div>
          )}
        </div>
      </main>
    </div>
  );
}
