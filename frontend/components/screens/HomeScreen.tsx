import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, Bell, User, Music2, TrendingUp, Clock, Heart, Share2, MessageCircle, Play, ChevronDown, ChevronUp, Send, Loader2, Plus, Sparkles, Edit2, Trash2, X, Copy, Globe, Lock, Ban, Eye, Radio, Users } from "lucide-react";
import { Input } from "../ui/input";
import MusicPlayer from "../MusicPlayer";
import SearchPlaylistModal from "../SearchPlaylistModal";
import CreatePlaylistModal from "../CreatePlaylistModal";
import EditPlaylistModal from "../EditPlaylistModal";
import AIRecommendModal from "../AIRecommendModal";
import ProfileModal from "../ProfileModal";
import NotificationModal from "../NotificationModal";
import { useWebSocket, NotificationData, BroadcastEvent } from "../../hooks/useWebSocket";
import { Track, getYoutubeVideoId, getTrackInfo, togglePlaylistLike, toggleCommentLike, toggleTrackLike, getUserLikedTracks, getPublicPlaylists, getPlaylistDetail, getPlaylistComments, createComment, getSavedAIPlaylists, saveAIPlaylist, updatePlaylist, deletePlaylist, updateComment, deleteComment, createPlaylist, toggleFollow, getFollowStatus, getProfile, deleteAIPlaylist, removeTrackFromPlaylist, togglePlaylistVisibility, duplicatePlaylist, blockUser, unblockUser, getBlockStatus, sharePlaylist, getActiveStations, createStation, joinStation, deleteStation, StationListItem, getKoreaChart, TrackInfo } from "../../services/api";

const imgBackground = "/background.jpg";

const normalizeImageUrl = (url: string | undefined | null): string | null => {
  if (!url) return null;
  if (url.startsWith('//')) return `https:${url}`;
  return url;
};

const isImageUrl = (url: string | undefined | null): boolean => {
  if (!url) return false;
  return url.startsWith('data:image') || url.startsWith('http') || url.startsWith('//');
};

interface CurrentTrack {
  track: Track;
  videoId: string;
}

interface PlaylistPost {
  id: number;
  author: {
    id: number;
    name: string;
    avatar: string;
  };
  title: string;
  description: string;
  coverGradient: string;
  coverImage?: string;
  tags: string[];
  likes: number;
  comments: Comment[];
  shares: number;
  viewCount: number;
  isLiked: boolean;
  isPublic: boolean;
  createdAt: string;
  tracks: {
    id: number;
    title: string;
    artist: string;
    duration: string;
    albumImage?: string;
  }[];
}

interface Comment {
  id: number;
  authorId: number;
  author: string;
  avatar?: string;
  content: string;
  createdAt: string;
  likes: number;
  isLiked: boolean;
}

interface RecentlyPlayedTrack {
  id: string;
  title: string;
  artist: string;
  albumImage?: string;
  duration: string;
  playedAt: Date;
  isLiked: boolean;
}

// 재생 대기열 인터페이스
interface PlayQueue {
  tracks: { id?: string; title: string; artist: string; albumImage?: string; duration?: string; videoId?: string }[];
  currentIndex: number;
  originalTracks?: { id?: string; title: string; artist: string; albumImage?: string; duration?: string; videoId?: string }[]; // 셔플 전 원본
}

interface HomeScreenProps {
  onLogout: () => void;
  sharedPlaylistId?: number | null;
  onNavigateToStation?: (stationId: number) => void;
}

// 날짜 포맷팅 함수 (yyyy-MM-dd HH:mm EEE요일)
const formatDateTime = (dateString: string): string => {
  if (!dateString || dateString === "방금 전") return "방금 전";
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const dayOfWeek = days[date.getDay()];
    
    return `${year}-${month}-${day} ${hours}:${minutes} ${dayOfWeek}요일`;
  } catch {
    return dateString;
  }
};

// duration 문자열("3:30")을 초로 변환
const parseDuration = (duration: string): number => {
  if (!duration) return 210;
  const parts = duration.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }
  return 210;
};

export default function HomeScreen({ onLogout, sharedPlaylistId, onNavigateToStation }: HomeScreenProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"trending" | "ai" | "popular" | "recent" | "liked" | "station">("trending");
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
  const [playQueue, setPlayQueue] = useState<PlayQueue | null>(null);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [likedTracks, setLikedTracks] = useState<Map<string, { albumImage?: string; duration?: string }>>(new Map());
  const [likedTracksLoading, setLikedTracksLoading] = useState(true);
  const [expandedPlaylist, setExpandedPlaylist] = useState<number | null>(null);
  const [expandedAIPlaylist, setExpandedAIPlaylist] = useState<number | null>(null);
  const [loadingTrack, setLoadingTrack] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [trackAlbumImages, setTrackAlbumImages] = useState<Record<string, string>>({});
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  const [isAIRecommendOpen, setIsAIRecommendOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [showFullscreenPlayer, setShowFullscreenPlayer] = useState(false);
  
  // 더보기 기능 상태
  const [showAllPlaylists, setShowAllPlaylists] = useState(false);
  const [showAllPopular, setShowAllPopular] = useState(false);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [showAllLikedPlaylists, setShowAllLikedPlaylists] = useState(false);
  const [showAllLikedTracks, setShowAllLikedTracks] = useState(false);
  const [showAllLikedComments, setShowAllLikedComments] = useState(false);
  
  // 기본 표시 개수
  const DEFAULT_DISPLAY_COUNT = 10;
  
  // 수정/삭제 관련 상태
  const [editingPlaylist, setEditingPlaylist] = useState<{
    id: number;
    title: string;
    description: string;
    tags: string[];
    coverImage?: string;
    tracks?: { id: number; title: string; artist: string; duration: string; albumImage?: string; }[];
  } | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editCommentContent, setEditCommentContent] = useState("");
  
  // 팔로우 상태 관리 (userId -> isFollowing)
  const [followingStatus, setFollowingStatus] = useState<Map<number, boolean>>(new Map());
  const [followLoading, setFollowLoading] = useState<number | null>(null);
  
  // 프로필 이미지 확대 모달 상태
  const [enlargedAvatar, setEnlargedAvatar] = useState<{url: string; name: string} | null>(null);
  
  // 현재 유저 프로필 정보
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  
  // 댓글 작성자 프로필 모달 상태
  const [commentAuthorProfile, setCommentAuthorProfile] = useState<{
    id: number;
    nickname: string;
    avatar: string;
    bio?: string;
    musicTags?: string[];
    playlists?: number;
    followers?: number;
    isBlocked?: boolean;
  } | null>(null);
  const [isBlockingCommentAuthor, setIsBlockingCommentAuthor] = useState(false);
  const [shareModalPost, setShareModalPost] = useState<PlaylistPost | null>(null);
  
  const [stations, setStations] = useState<StationListItem[]>([]);
  const [stationsLoading, setStationsLoading] = useState(true);
  const [newStationTitle, setNewStationTitle] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [stationError, setStationError] = useState<string | null>(null);
  const [isPrivateStation, setIsPrivateStation] = useState(false);
  const likingPlaylistIds = useRef<Set<number>>(new Set());
  
  const [koreaChart, setKoreaChart] = useState<TrackInfo[]>([]);
  const [koreaChartLoading, setKoreaChartLoading] = useState(true);
  
  const [playlistPosts, setPlaylistPosts] = useState<PlaylistPost[]>([]);
  
  // 실시간 알림 콜백 - 좋아요/댓글/새 플레이리스트 발생 시 UI 업데이트
  const handleNewNotification = useCallback(async (notification: NotificationData) => {
    if (notification.relatedId) {
      const playlistId = notification.relatedId;
      
      if (notification.type === 'like') {
        // 좋아요 알림 - 해당 플레이리스트의 좋아요 수 증가
        setPlaylistPosts(prev => prev.map(post => 
          post.id === playlistId 
            ? { ...post, likes: post.likes + 1 }
            : post
        ));
      } else if (notification.type === 'comment') {
        // 댓글 알림 - 해당 플레이리스트의 댓글 새로고침
        try {
          const userId = Number(localStorage.getItem('userId'));
          const comments = await getPlaylistComments(playlistId, userId);
          setPlaylistPosts(prev => prev.map(post => 
            post.id === playlistId 
              ? { 
                  ...post, 
                  comments: comments.map(c => ({
                    id: c.id,
                    authorId: c.author.id,
                    author: c.author.nickname,
                    avatar: c.author.avatar,
                    content: c.content,
                    createdAt: c.createdAt,
                    likes: c.likeCount,
                    isLiked: c.isLiked
                  }))
                }
              : post
          ));
        } catch (error) {
          console.error('댓글 새로고침 오류:', error);
        }
      } else if (notification.type === 'playlist') {
        // 새 플레이리스트 알림 - 플레이리스트 목록에 추가
        try {
          const userId = Number(localStorage.getItem('userId'));
          const playlistDetail = await getPlaylistDetail(playlistId, userId, false);
          if (playlistDetail) {
            // 이미 목록에 있는지 확인
            setPlaylistPosts(prev => {
              if (prev.some(post => post.id === playlistDetail.id)) {
                return prev; // 이미 있으면 추가하지 않음
              }
              const newPost: PlaylistPost = {
                id: playlistDetail.id,
                author: { 
                  id: playlistDetail.owner.id, 
                  name: playlistDetail.owner.nickname, 
                  avatar: "🎵" 
                },
                title: playlistDetail.title,
                description: playlistDetail.description || "",
                coverGradient: "from-purple-500 to-pink-500",
                coverImage: playlistDetail.coverImageUrl,
                tags: playlistDetail.tags || [],
                likes: Number(playlistDetail.likeCount) || 0,
                shares: 0,
                viewCount: playlistDetail.viewCount || 0,
                isLiked: playlistDetail.isLiked || false,
                isPublic: playlistDetail.isPublic ?? true,
                createdAt: playlistDetail.createdAt,
                tracks: playlistDetail.tracks?.map((t, i) => ({
                  id: i + 1,
                  title: t.title,
                  artist: t.artist,
                  duration: t.durationSec ? `${Math.floor(t.durationSec / 60)}:${(t.durationSec % 60).toString().padStart(2, '0')}` : "3:30",
                  albumImage: t.albumImage,
                })) || [],
                comments: [],
              };
              return [newPost, ...prev]; // 맨 앞에 추가
            });
          }
        } catch (error) {
          console.error('새 플레이리스트 로드 오류:', error);
        }
      }
    }
  }, []);

  const handleBroadcast = useCallback((event: BroadcastEvent) => {
    if (event.type === 'playlist_created' && event.playlist) {
      const p = event.playlist;
      const gradients = [
        "from-blue-500 to-indigo-600",
        "from-purple-600 to-pink-500",
        "from-orange-500 to-red-600",
        "from-green-500 to-teal-600",
        "from-pink-500 to-rose-600",
      ];
      const newPost: PlaylistPost = {
        id: p.id,
        author: { id: p.owner.id, name: p.owner.nickname, avatar: "🎧" },
        title: p.title,
        description: p.description || "",
        coverGradient: gradients[p.id % gradients.length],
        coverImage: p.coverImageUrl,
        tags: p.tags || [],
        likes: p.likeCount || 0,
        shares: 0,
        viewCount: p.viewCount || 0,
        isLiked: false,
        isPublic: p.isPublic,
        createdAt: p.createdAt,
        tracks: p.tracks?.map(t => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          duration: t.durationSec ? `${Math.floor(t.durationSec / 60)}:${String(t.durationSec % 60).padStart(2, '0')}` : "0:00",
          albumImage: t.albumImage
        })) || [],
        comments: []
      };
      setPlaylistPosts(prev => {
        if (prev.some(post => post.id === p.id)) return prev;
        return [newPost, ...prev];
      });
    } else if (event.type === 'playlist_deleted' && event.id) {
      setPlaylistPosts(prev => prev.filter(post => post.id !== event.id));
    } else if (event.type === 'comment_added' && event.playlistId && event.comment) {
      const c = event.comment;
      setPlaylistPosts(prev => prev.map(post =>
        post.id === event.playlistId
          ? {
              ...post,
              comments: [...post.comments, {
                id: c.id,
                authorId: c.author.id,
                author: c.author.nickname,
                avatar: c.author.avatar,
                content: c.content,
                createdAt: c.createdAt,
                likes: c.likeCount,
                isLiked: c.isLiked
              }]
            }
          : post
      ));
    } else if (event.type === 'comment_deleted' && event.playlistId && event.id) {
      setPlaylistPosts(prev => prev.map(post =>
        post.id === event.playlistId
          ? { ...post, comments: post.comments.filter(c => c.id !== event.id) }
          : post
      ));
    } else if (event.type === 'share_updated' && event.playlistId && event.shareCount !== undefined) {
      setPlaylistPosts(prev => prev.map(post =>
        post.id === event.playlistId
          ? { ...post, shares: event.shareCount! }
          : post
      ));
    } else if (event.type === 'view_updated' && event.playlistId && event.viewCount !== undefined) {
      setPlaylistPosts(prev => prev.map(post =>
        post.id === event.playlistId
          ? { ...post, viewCount: event.viewCount! }
          : post
      ));
    } else if (event.type === 'playlist_updated' && event.playlist) {
      const p = event.playlist;
      setPlaylistPosts(prev => prev.map(post =>
        post.id === p.id
          ? {
              ...post,
              title: p.title,
              description: p.description || "",
              coverImage: p.coverImageUrl,
              tags: p.tags || [],
              isPublic: p.isPublic,
              tracks: p.tracks?.map(t => ({
                id: t.id,
                title: t.title,
                artist: t.artist,
                duration: t.durationSec ? `${Math.floor(t.durationSec / 60)}:${String(t.durationSec % 60).padStart(2, '0')}` : "0:00",
                albumImage: t.albumImage
              })) || post.tracks
            }
          : post
      ));
    } else if (event.type === 'visibility_updated' && event.playlistId && event.isPublic !== undefined) {
      const gradients = [
        "from-blue-500 to-indigo-600",
        "from-purple-600 to-pink-500",
        "from-orange-500 to-red-600",
        "from-green-500 to-teal-600",
        "from-pink-500 to-rose-600",
      ];
      setPlaylistPosts(prev => {
        if (event.isPublic && event.playlist) {
          const p = event.playlist;
          if (prev.some(post => post.id === p.id)) {
            return prev.map(post =>
              post.id === p.id ? { ...post, isPublic: true } : post
            );
          }
          const newPost: PlaylistPost = {
            id: p.id,
            author: { id: p.owner.id, name: p.owner.nickname, avatar: "🎧" },
            title: p.title,
            description: p.description || "",
            coverGradient: gradients[p.id % gradients.length],
            coverImage: p.coverImageUrl,
            tags: p.tags || [],
            likes: p.likeCount || 0,
            shares: 0,
            viewCount: p.viewCount || 0,
            isLiked: false,
            isPublic: true,
            createdAt: p.createdAt,
            tracks: p.tracks?.map(t => ({
              id: t.id,
              title: t.title,
              artist: t.artist,
              duration: t.durationSec ? `${Math.floor(t.durationSec / 60)}:${String(t.durationSec % 60).padStart(2, '0')}` : "0:00",
              albumImage: t.albumImage
            })) || [],
            comments: []
          };
          return [newPost, ...prev];
        } else {
          return prev.filter(post => post.id !== event.playlistId);
        }
      });
    }
  }, []);
  
  const currentUserId = Number(localStorage.getItem('userId'));
  const {
    notifications,
    unreadCount,
    isConnected: isNotificationConnected,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll: clearAllNotifications
  } = useWebSocket(currentUserId, {
    onNewNotification: handleNewNotification,
    onBroadcast: handleBroadcast
  });
  
  const [aiRecommendedPlaylists, setAIRecommendedPlaylists] = useState<PlaylistPost[]>([]);
  const [aiPlaylistsLoading, setAiPlaylistsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const userId = Number(localStorage.getItem('userId'));
        const playlists = await getSavedAIPlaylists(userId);
        const posts: PlaylistPost[] = playlists.map((p) => ({
          id: Number(p.id),
          author: { id: userId, name: "AI 추천", avatar: "✨" },
          title: p.title,
          description: p.description,
          coverGradient: p.coverGradient,
          coverImage: p.coverImage,
          tags: p.tags || [],
          likes: 0,
          shares: 0,
          viewCount: 0,
          isLiked: false,
          isPublic: false,
          createdAt: "저장됨",
          tracks: p.tracks.map((t, i) => ({
            id: i + 1,
            title: t.title,
            artist: t.artist,
            duration: t.duration,
            albumImage: t.albumImage,
          })),
          comments: [],
        }));
        setAIRecommendedPlaylists(posts);
      } catch (error) {
        console.error('AI 플레이리스트 불러오기 실패:', error);
      } finally {
        setAiPlaylistsLoading(false);
      }
    })();
  }, []);

  const [recentlyPlayed, setRecentlyPlayed] = useState<RecentlyPlayedTrack[]>(() => {
    // localStorage에서 최근 재생 기록 불러오기
    const saved = localStorage.getItem("recentlyPlayed");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((item: RecentlyPlayedTrack) => ({
          ...item,
          playedAt: new Date(item.playedAt),
        }));
      } catch {
        return [];
      }
    }
    return [];
  });
  // playlistPosts는 위에서 이미 선언됨
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [totalPlayTime, setTotalPlayTime] = useState<number>(() => {
    // localStorage에서 총 재생 시간 불러오기 (초 단위)
    const saved = localStorage.getItem("totalPlayTime");
    return saved ? parseInt(saved, 10) : 0;
  });

  // 최근 재생 기록을 localStorage에 저장
  useEffect(() => {
    localStorage.setItem("recentlyPlayed", JSON.stringify(recentlyPlayed));
  }, [recentlyPlayed]);

  // 최근 재생 목록에서 앨범 이미지/duration 없는 항목 가져오기 (백그라운드)
  useEffect(() => {
    const fetchMissingTrackInfo = async () => {
      const tracksNeedingInfo = recentlyPlayed.filter(t => !t.albumImage || !t.duration || t.duration === "0:00");
      if (tracksNeedingInfo.length === 0) return;
      
      for (const track of tracksNeedingInfo) {
        try {
          const trackInfo = await getTrackInfo(track.title, track.artist);
          if (trackInfo) {
            // duration은 밀리초 단위이므로 1000으로 나누어 초로 변환
            const durationSec = trackInfo.duration ? Math.floor(trackInfo.duration / 1000) : 0;
            const durationStr = durationSec > 0
              ? `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}`
              : track.duration;
            setRecentlyPlayed(prev => 
              prev.map(t => 
                t.id === track.id 
                  ? { 
                      ...t, 
                      albumImage: trackInfo.albumImage || t.albumImage,
                      duration: durationStr || t.duration
                    } 
                  : t
              )
            );
          }
        } catch (e) {
          console.error('트랙 정보 가져오기 실패:', e);
        }
      }
    };
    
    // 최초 로드 시 한 번만 실행
    if (recentlyPlayed.length > 0) {
      fetchMissingTrackInfo();
    }
  }, []); // 빈 의존성 배열로 최초 1회만 실행

  // 재생 시간을 localStorage에 저장
  useEffect(() => {
    localStorage.setItem("totalPlayTime", totalPlayTime.toString());
  }, [totalPlayTime]);

  // 재생 중일 때 1초마다 재생 시간 누적
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (currentTrack) {
      interval = setInterval(() => {
        setTotalPlayTime(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentTrack]);

  // DB에서 좋아요한 트랙 목록 불러오기
  useEffect(() => {
    const fetchLikedTracks = async () => {
      try {
        setLikedTracksLoading(true);
        const tracks = await getUserLikedTracks(currentUserId);
        const trackMap = new Map<string, { albumImage?: string; duration?: string }>();
        
        // 먼저 DB에서 가져온 정보로 Map 생성
        tracks.forEach(t => {
          trackMap.set(`${t.title}-${t.artist}`, { 
            albumImage: t.albumImage, 
            duration: t.duration 
          });
        });
        setLikedTracks(trackMap);
        
        // 앨범 이미지 또는 duration이 없는 트랙들은 Spotify API에서 가져오기 (백그라운드)
        for (const t of tracks) {
          if (!t.albumImage || !t.duration || t.duration === "0:00" || t.duration === "") {
            try {
              const trackInfo = await getTrackInfo(t.title, t.artist);
              if (trackInfo) {
                // duration은 밀리초 단위이므로 1000으로 나누어 초로 변환
                const durationSec = trackInfo.duration ? Math.floor(trackInfo.duration / 1000) : 0;
                const durationStr = durationSec > 0
                  ? `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}`
                  : t.duration;
                setLikedTracks(prev => {
                  const newMap = new Map(prev);
                  const key = `${t.title}-${t.artist}`;
                  const existing = newMap.get(key);
                  newMap.set(key, { 
                    albumImage: trackInfo.albumImage || existing?.albumImage,
                    duration: durationStr || existing?.duration
                  });
                  return newMap;
                });
              }
            } catch (e) {
              console.error('트랙 정보 가져오기 실패:', e);
            }
          }
        }
      } catch (error) {
        console.error('좋아요 트랙 불러오기 오류:', error);
      } finally {
        setLikedTracksLoading(false);
      }
    };
    fetchLikedTracks();
  }, []);

  // 현재 유저 프로필 로드 (프로필 버튼에 아바타 표시용)
  useEffect(() => {
    const loadCurrentUserProfile = async () => {
      try {
        const userId = Number(localStorage.getItem('userId'));
        if (userId) {
          const profile = await getProfile(userId);
          if (profile?.avatar) {
            setCurrentUserAvatar(profile.avatar);
          }
        }
      } catch (error) {
        console.error('프로필 로드 오류:', error);
      }
    };
    loadCurrentUserProfile();
  }, []);

  // DB에서 플레이리스트 목록 불러오기
  useEffect(() => {
    const fetchPlaylists = async () => {
      try {
        setPlaylistsLoading(true);
        const playlists = await getPublicPlaylists(currentUserId);
        
        // DB에서 가져온 플레이리스트를 PlaylistPost 형태로 변환
        const posts: PlaylistPost[] = await Promise.all(
          playlists.map(async (playlist) => {
            const detail = await getPlaylistDetail(playlist.id, currentUserId, false);
            const comments = await getPlaylistComments(playlist.id, currentUserId);
            
            // 그라데이션 색상 랜덤 생성
            const gradients = [
              "from-blue-500 to-indigo-600",
              "from-purple-600 to-pink-500",
              "from-orange-500 to-red-600",
              "from-green-500 to-teal-600",
              "from-pink-500 to-rose-600",
            ];
            const randomGradient = gradients[playlist.id % gradients.length];
            
            // coverImage가 없으면 첫번째 트랙의 albumImage를 사용
            const firstTrackImage = detail?.tracks?.[0]?.albumImage;
            const coverImage = detail?.coverImageUrl || playlist.coverImageUrl || firstTrackImage;
            
            return {
              id: playlist.id,
              author: { 
                id: playlist.owner?.id || 0,
                name: playlist.owner?.nickname || "익명", 
                avatar: "🎵" 
              },
              title: playlist.title,
              description: playlist.description || "",
              coverGradient: randomGradient,
              coverImage: coverImage,
              tags: playlist.tags || [],
              likes: playlist.likeCount || 0,
              shares: detail?.shareCount || playlist.shareCount || 0,
              viewCount: detail?.viewCount || playlist.viewCount || 0,
              isLiked: detail?.isLiked || false,
              isPublic: detail?.isPublic ?? playlist.isPublic ?? true,
              createdAt: formatDateTime(playlist.createdAt) || "방금 전",
              tracks: detail?.tracks?.map((t: any) => ({
                id: t.id,
                title: t.title,
                artist: t.artist,
                albumImage: t.albumImage || "",
                duration: t.durationSec ? `${Math.floor(t.durationSec / 60)}:${String(t.durationSec % 60).padStart(2, '0')}` : "0:00"
              })) || [],
              comments: comments.map(c => ({
                id: c.id,
                authorId: c.author?.id || 0,
                author: c.author?.nickname || "익명",
                avatar: c.author?.avatar,
                content: c.content,
                createdAt: formatDateTime(c.createdAt) || "방금 전",
                likes: c.likeCount || 0,
                isLiked: c.isLiked || false
              }))
            };
          })
        );
        
        setPlaylistPosts(posts);
        
        // 팔로우 상태 초기화
        const authorIds = posts.map(post => post.author.id);
        initFollowStatus(authorIds);
      } catch (error) {
        console.error('플레이리스트 불러오기 오류:', error);
      } finally {
        setPlaylistsLoading(false);
      }
    };
    fetchPlaylists();
  }, []);

  const fetchStations = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setStationsLoading(true);
      const stationList = await getActiveStations();
      setStations(stationList);
    } catch (error) {
      console.error('스테이션 목록 조회 오류:', error);
    } finally {
      if (showLoading) setStationsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStations(true);
    const interval = setInterval(() => fetchStations(false), 5000);
    return () => clearInterval(interval);
  }, [fetchStations]);

  useEffect(() => {
    const fetchKoreaChart = async () => {
      try {
        setKoreaChartLoading(true);
        const chartData = await getKoreaChart(20);
        setKoreaChart(chartData);
      } catch (error) {
        console.error('한국 차트 조회 오류:', error);
      } finally {
        setKoreaChartLoading(false);
      }
    };
    fetchKoreaChart();
  }, []);

  useEffect(() => {
    if (sharedPlaylistId && playlistPosts.length > 0) {
      const targetPlaylist = playlistPosts.find(p => p.id === sharedPlaylistId);
      if (targetPlaylist) {
        setExpandedPlaylist(sharedPlaylistId);
        setActiveTab("trending");
      }
    }
  }, [sharedPlaylistId, playlistPosts]);

  useEffect(() => {
    if (expandedPlaylist !== null && activeTab !== "liked") {
      getPlaylistDetail(expandedPlaylist, currentUserId, true).then(detail => {
        if (detail) {
          setPlaylistPosts(prev => prev.map(post =>
            post.id === expandedPlaylist ? { ...post, viewCount: detail.viewCount } : post
          ));
        }
      });
    }
  }, [expandedPlaylist, currentUserId, activeTab]);

  // 최근 재생 기록에 곡 추가
  const addToRecentlyPlayed = (track: { title: string; artist: string; albumImage?: string; duration?: string }) => {
    const newTrack: RecentlyPlayedTrack = {
      id: `${track.title}-${track.artist}-${Date.now()}`,
      title: track.title,
      artist: track.artist,
      albumImage: track.albumImage || "",
      duration: track.duration || "0:00",
      playedAt: new Date(),
      isLiked: false,
    };

    setRecentlyPlayed(prev => {
      // 같은 곡이 이미 있으면 제거 (최상단에 다시 추가하기 위해)
      const filtered = prev.filter(
        item => !(item.title === track.title && item.artist === track.artist)
      );
      // 최대 50개까지만 저장
      return [newTrack, ...filtered].slice(0, 50);
    });
  };

  // 팔로우/언팔로우 토글
  const handleFollow = async (targetUserId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // 클릭 이벤트 전파 방지
    
    if (targetUserId === currentUserId) return; // 자기 자신은 팔로우 불가
    
    setFollowLoading(targetUserId);
    try {
      const response = await toggleFollow(targetUserId, currentUserId);
      setFollowingStatus(prev => new Map(prev).set(targetUserId, response.isFollowing));
    } catch (error) {
      console.error('팔로우 오류:', error);
    } finally {
      setFollowLoading(null);
    }
  };

  // 팔로우 상태 초기화 (플레이리스트 로드 시)
  const initFollowStatus = async (authorIds: number[]) => {
    const uniqueIds = [...new Set(authorIds)].filter(id => id !== currentUserId);
    const statusMap = new Map<number, boolean>();
    
    await Promise.all(
      uniqueIds.map(async (authorId) => {
        try {
          const response = await getFollowStatus(authorId, currentUserId);
          statusMap.set(authorId, response.isFollowing);
        } catch {
          statusMap.set(authorId, false);
        }
      })
    );
    
    setFollowingStatus(prev => {
      const newMap = new Map(prev);
      statusMap.forEach((value, key) => newMap.set(key, value));
      return newMap;
    });
  };

  const handleLikePlaylist = async (postId: number) => {
    if (likingPlaylistIds.current.has(postId)) return;
    
    likingPlaylistIds.current.add(postId);
    try {
      const response = await togglePlaylistLike(postId, currentUserId);
      setPlaylistPosts(posts =>
        posts.map(post =>
          post.id === postId
            ? { ...post, isLiked: response.isLiked, likes: response.likeCount }
            : post
        )
      );
    } catch (error) {
      console.error('플레이리스트 좋아요 오류:', error);
    } finally {
      likingPlaylistIds.current.delete(postId);
    }
  };

  const handleAddComment = async (postId: number) => {
    if (!newComment.trim()) return;
    
    try {
      const response = await createComment(postId, currentUserId, newComment);
      if (response) {
        setPlaylistPosts(posts =>
          posts.map(post =>
            post.id === postId
              ? {
                  ...post,
                  comments: [
                    ...post.comments,
                    { 
                      id: response.id,
                      authorId: response.author?.id || currentUserId,
                      author: response.author?.nickname || "나",
                      avatar: response.author?.avatar,
                      content: response.content, 
                      createdAt: formatDateTime(response.createdAt) || "방금 전", 
                      likes: 0, 
                      isLiked: false 
                    },
                  ],
                }
              : post
          )
        );
        setNewComment("");
      }
    } catch (error) {
      console.error('댓글 작성 오류:', error);
      // API 실패 시 로컬에서만 추가
      setPlaylistPosts(posts =>
        posts.map(post =>
          post.id === postId
            ? {
                ...post,
                comments: [
                  ...post.comments,
                  { id: Date.now(), authorId: currentUserId, author: "나", content: newComment, createdAt: formatDateTime(new Date().toISOString()), likes: 0, isLiked: false },
                ],
              }
            : post
        )
      );
      setNewComment("");
    }
  };

  // 댓글 좋아요 토글
  const handleLikeComment = async (postId: number, commentId: number) => {
    try {
      const response = await toggleCommentLike(commentId, currentUserId);
      setPlaylistPosts(posts =>
        posts.map(post =>
          post.id === postId
            ? {
                ...post,
                comments: post.comments.map(comment =>
                  comment.id === commentId
                    ? {
                        ...comment,
                        isLiked: response.isLiked,
                        likes: response.likeCount,
                      }
                    : comment
                ),
            }
          : post
      )
    );
    } catch (error) {
      console.error('댓글 좋아요 오류:', error);
      // API 실패 시 로컬 상태만 변경
      setPlaylistPosts(posts =>
        posts.map(post =>
          post.id === postId
            ? {
                ...post,
                comments: post.comments.map(comment =>
                  comment.id === commentId
                    ? {
                        ...comment,
                        isLiked: !comment.isLiked,
                        likes: comment.isLiked ? comment.likes - 1 : comment.likes + 1,
                      }
                    : comment
                ),
            }
          : post
        )
      );
    }
  };

  const handleShare = (post: PlaylistPost) => {
    setShareModalPost(post);
  };

  const handleActualShare = async () => {
    if (!shareModalPost) return;
    
    const playlistUrl = `${window.location.origin}/playlist/${shareModalPost.id}`;

    try {
      await navigator.clipboard.writeText(playlistUrl);
      const newCount = await sharePlaylist(shareModalPost.id);
      if (newCount !== null) {
        setPlaylistPosts(posts => posts.map(p => 
          p.id === shareModalPost.id ? { ...p, shares: newCount } : p
        ));
      }
      setShareModalPost(null);
      alert("링크가 복사되었습니다!");
    } catch {
      alert("복사에 실패했습니다. 다시 시도해주세요.");
    }
  };

  // 플레이리스트 수정 시작
  const handleEditPlaylist = (post: PlaylistPost) => {
    setEditingPlaylist({
      id: post.id,
      title: post.title,
      description: post.description,
      tags: post.tags || [],
      coverImage: post.coverImage,
      tracks: post.tracks,
    });
  };

  // 플레이리스트 수정 저장
  const handleSavePlaylistEdit = async (data: {
    title: string;
    description: string;
    tags: string[];
    coverImage?: string;
  }) => {
    if (!editingPlaylist) return;
    
    try {
      const response = await updatePlaylist(editingPlaylist.id, currentUserId, {
        title: data.title,
        description: data.description,
        tags: data.tags,
        coverImageUrl: data.coverImage,
      });
      
      if (response) {
        setPlaylistPosts(posts =>
          posts.map(post =>
            post.id === editingPlaylist.id
              ? { ...post, title: data.title, description: data.description, tags: data.tags, coverImage: data.coverImage }
              : post
          )
        );
        setEditingPlaylist(null);
      }
    } catch (error) {
      console.error('플레이리스트 수정 오류:', error);
      alert('플레이리스트 수정에 실패했습니다.');
    }
  };

  // 플레이리스트 삭제
  const handleDeletePlaylist = async (postId: number) => {
    if (!confirm('정말 이 플레이리스트를 삭제하시겠습니까?')) return;
    
    try {
      const success = await deletePlaylist(postId, currentUserId);
      if (success) {
        setPlaylistPosts(posts => posts.filter(post => post.id !== postId));
        alert('플레이리스트가 삭제되었습니다.');
      } else {
        alert('플레이리스트 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('플레이리스트 삭제 오류:', error);
      alert('플레이리스트 삭제에 실패했습니다.');
    }
  };

  const handleToggleVisibility = async (postId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const response = await togglePlaylistVisibility(postId, currentUserId);
      if (response) {
        setPlaylistPosts(posts =>
          posts.map(post =>
            post.id === postId
              ? { ...post, isPublic: response.isPublic }
              : post
          )
        );
      }
    } catch (error) {
      console.error('공개설정 변경 오류:', error);
      alert('공개설정 변경에 실패했습니다.');
    }
  };

  const handleDuplicatePlaylist = async (postId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const response = await duplicatePlaylist(postId, currentUserId);
      if (response) {
        const detail = await getPlaylistDetail(response.id, currentUserId, false);
        const gradients = [
          "from-blue-500 to-indigo-600",
          "from-purple-600 to-pink-500",
          "from-orange-500 to-red-600",
          "from-green-500 to-teal-600",
          "from-pink-500 to-rose-600",
        ];
        const newPost: PlaylistPost = {
          id: response.id,
          author: { 
            id: response.owner?.id || currentUserId, 
            name: response.owner?.nickname || "나", 
            avatar: "🎵" 
          },
          title: response.title,
          description: response.description || "",
          coverGradient: gradients[response.id % gradients.length],
          coverImage: response.coverImageUrl,
          tags: response.tags || [],
          likes: 0,
          shares: 0,
          viewCount: 0,
          isLiked: false,
          isPublic: response.isPublic ?? false,
          createdAt: "방금 전",
          tracks: detail?.tracks?.map((t: any) => ({
            id: t.id,
            title: t.title,
            artist: t.artist,
            albumImage: t.albumImage || "",
            duration: t.durationSec ? `${Math.floor(t.durationSec / 60)}:${String(t.durationSec % 60).padStart(2, '0')}` : "0:00"
          })) || [],
          comments: []
        };
        setPlaylistPosts(posts => [newPost, ...posts]);
        alert('플레이리스트가 복제되었습니다!');
      }
    } catch (error) {
      console.error('플레이리스트 복제 오류:', error);
      alert('플레이리스트 복제에 실패했습니다.');
    }
  };

  // 댓글 수정 시작
  const handleEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditCommentContent(comment.content);
  };

  // 댓글 수정 저장
  const handleSaveCommentEdit = async (postId: number, commentId: number) => {
    try {
      const response = await updateComment(commentId, currentUserId, editCommentContent);
      
      if (response) {
        setPlaylistPosts(posts =>
          posts.map(post =>
            post.id === postId
              ? {
                  ...post,
                  comments: post.comments.map(comment =>
                    comment.id === commentId
                      ? { ...comment, content: editCommentContent }
                      : comment
                  ),
                }
              : post
          )
        );
        setEditingCommentId(null);
        setEditCommentContent("");
      }
    } catch (error) {
      console.error('댓글 수정 오류:', error);
      alert('댓글 수정에 실패했습니다.');
    }
  };

  // 댓글 수정 취소
  const handleCancelCommentEdit = () => {
    setEditingCommentId(null);
    setEditCommentContent("");
  };

  // 댓글 삭제
  const handleDeleteComment = async (postId: number, commentId: number) => {
    if (!confirm('정말 이 댓글을 삭제하시겠습니까?')) return;
    
    try {
      const success = await deleteComment(commentId, currentUserId);
      if (success) {
        setPlaylistPosts(posts =>
          posts.map(post =>
            post.id === postId
              ? { ...post, comments: post.comments.filter(c => c.id !== commentId) }
              : post
          )
        );
      }
    } catch (error) {
      console.error('댓글 삭제 오류:', error);
      alert('댓글 삭제에 실패했습니다.');
    }
  };

  // 플레이리스트가 펼쳐지면 트랙들의 앨범 이미지 가져오기 (DB에 없는 경우만)
  useEffect(() => {
    if (expandedPlaylist === null) return;
    
    const post = playlistPosts.find(p => p.id === expandedPlaylist);
    if (!post) return;

    const fetchAlbumImages = async () => {
      for (const track of post.tracks) {
        const trackKey = `${track.title}-${track.artist}`;
        // DB에 앨범 이미지가 있거나 이미 로드됨
        if (track.albumImage || trackAlbumImages[trackKey]) continue;
        
        try {
          const info = await getTrackInfo(track.title, track.artist);
          if (info?.albumImage) {
            setTrackAlbumImages(prev => ({
              ...prev,
              [trackKey]: info.albumImage
            }));
          }
        } catch (error) {
          console.error('앨범 이미지 가져오기 오류:', error);
        }
      }
    };

    fetchAlbumImages();
  }, [expandedPlaylist, playlistPosts]);

  // 플레이리스트에서 특정 트랙 재생 (재생 대기열 설정)
  const handlePlayTrackFromPlaylist = async (
    trackIndex: number,
    playlistTracks: { title: string; artist: string; albumImage?: string; duration?: string }[]
  ) => {
    const track = playlistTracks[trackIndex];
    const trackKey = `${track.title}-${track.artist}`;
    if (loadingTrack === trackKey) return;
    
    setLoadingTrack(trackKey);
    try {
      const videoId = await getYoutubeVideoId(track.title, track.artist);
      if (videoId) {
        const trackData: Track = {
          title: track.title,
          artists: track.artist,
          album: {
            title: "플레이리스트",
            image: track.albumImage || "",
          },
        };
        setCurrentTrack({ track: trackData, videoId });
        setPlayQueue({ tracks: playlistTracks, currentIndex: trackIndex });
        
        // 최근 재생 기록에 추가
        addToRecentlyPlayed(track);
      } else {
        alert("해당 곡을 찾을 수 없습니다.");
      }
    } catch (error) {
      console.error("트랙 재생 오류:", error);
      alert("재생 중 오류가 발생했습니다.");
    } finally {
      setLoadingTrack(null);
    }
  };

  const handlePlayTrack = async (title: string, artist: string, albumImage?: string, duration?: string) => {
    const trackKey = `${title}-${artist}`;
    if (loadingTrack === trackKey) return;
    
    setLoadingTrack(trackKey);
    try {
      const videoId = await getYoutubeVideoId(title, artist);
      if (videoId) {
        // 앨범 이미지 또는 duration이 없으면 Spotify API에서 가져오기
        let finalAlbumImage = albumImage;
        let finalDuration = duration;
        if (!finalAlbumImage || !finalDuration || finalDuration === "0:00" || finalDuration === "") {
          try {
            const trackInfo = await getTrackInfo(title, artist);
            if (trackInfo) {
              if (!finalAlbumImage && trackInfo.albumImage) {
                finalAlbumImage = trackInfo.albumImage;
              }
              if ((!finalDuration || finalDuration === "0:00" || finalDuration === "") && trackInfo.duration) {
                // duration은 밀리초 단위이므로 1000으로 나누어 초로 변환
                const durationSec = Math.floor(trackInfo.duration / 1000);
                finalDuration = `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}`;
              }
            }
          } catch (e) {
            console.error("트랙 정보 가져오기 실패:", e);
          }
        }
        
        const track: Track = {
          title,
          artists: artist,
          album: {
            title: "플레이리스트",
            image: finalAlbumImage || "",
          },
        };
        setCurrentTrack({ track, videoId });
        // 단일 트랙 재생 시에도 현재 트랙을 재생 대기열에 포함
        const singleTrack = { title, artist, albumImage: finalAlbumImage, duration: finalDuration };
        setPlayQueue({ tracks: [singleTrack], currentIndex: 0 });
        
        // 최근 재생 기록에 추가
        addToRecentlyPlayed({ title, artist, albumImage: finalAlbumImage, duration: finalDuration });
      } else {
        alert("해당 곡을 찾을 수 없습니다.");
      }
    } catch (error) {
      console.error("트랙 재생 오류:", error);
      alert("재생 중 오류가 발생했습니다.");
    } finally {
      setLoadingTrack(null);
    }
  };

  // 이전 트랙 재생
  const handlePreviousTrack = async () => {
    if (!playQueue) return;
    
    let newIndex: number;
    
    if (playQueue.currentIndex <= 0) {
      // 첫 곡에서 이전 버튼 누르면
      if (repeatMode === "all") {
        // 전체 반복 모드: 마지막 곡으로 이동
        newIndex = playQueue.tracks.length - 1;
      } else {
        return; // 반복 모드 아니면 무시
      }
    } else {
      newIndex = playQueue.currentIndex - 1;
    }
    
    await handlePlayTrackFromPlaylist(newIndex, playQueue.tracks);
  };

  // 다음 트랙 재생
  const handleNextTrack = async () => {
    if (!playQueue) return;
    
    let newIndex: number;
    
    if (playQueue.currentIndex >= playQueue.tracks.length - 1) {
      // 마지막 곡에서 다음 버튼 누르면
      if (repeatMode === "all" || isShuffle) {
        // 전체 반복 또는 셔플 모드: 첫 곡으로 이동
        newIndex = 0;
      } else {
        return; // 반복 모드 아니면 무시
      }
    } else {
      newIndex = playQueue.currentIndex + 1;
    }
    
    await handlePlayTrackFromPlaylist(newIndex, playQueue.tracks);
  };

  // 트랙 종료 시 호출 (다음 곡 자동 재생)
  const handleTrackEnd = async () => {
    if (!playQueue) return;
    
    const isLastTrack = playQueue.currentIndex >= playQueue.tracks.length - 1;
    
    if (isLastTrack) {
      // 마지막 곡일 때
      if (repeatMode === "all" || isShuffle) {
        // 전체 반복 또는 셔플 모드: 첫 곡으로 돌아가기
        await handlePlayTrackFromPlaylist(0, playQueue.tracks);
      }
      // repeatMode가 "off"이고 셔플이 아니면 아무것도 하지 않음 (곡 종료)
    } else {
      // 다음 곡이 있으면 자동 재생
      await handleNextTrack();
    }
  };

  // 재생 큐에서 트랙 삭제
  const handleRemoveFromQueue = (index: number) => {
    if (!playQueue) return;
    
    const newTracks = [...playQueue.tracks];
    newTracks.splice(index, 1);
    
    if (newTracks.length === 0) {
      // 모든 트랙이 삭제되면 플레이어 닫기
      setPlayQueue(null);
      setCurrentTrack(null);
      return;
    }
    
    let newCurrentIndex = playQueue.currentIndex;
    
    if (index < playQueue.currentIndex) {
      // 현재 재생 중인 곡 앞의 트랙 삭제 시 인덱스 조정
      newCurrentIndex = playQueue.currentIndex - 1;
    } else if (index === playQueue.currentIndex) {
      // 현재 재생 중인 곡을 삭제하면 다음 곡 재생
      if (newCurrentIndex >= newTracks.length) {
        newCurrentIndex = 0;
      }
      // 새로운 현재 트랙 재생
      const newTrack = newTracks[newCurrentIndex];
      if (newTrack) {
        setCurrentTrack({ 
          track: {
            title: newTrack.title,
            artists: newTrack.artist,
            album: newTrack.albumImage ? { title: '', image: newTrack.albumImage } : { title: '', image: '' },
          },
          videoId: newTrack.videoId || ''
        });
      }
    }
    
    setPlayQueue({ tracks: newTracks, currentIndex: newCurrentIndex });
  };

  // 재생 큐에서 트랙 이동
  const handleMoveTrackInQueue = (fromIndex: number, toIndex: number) => {
    if (!playQueue) return;
    if (fromIndex === toIndex) return;
    
    const newTracks = [...playQueue.tracks];
    const [movedTrack] = newTracks.splice(fromIndex, 1);
    newTracks.splice(toIndex, 0, movedTrack);
    
    // 현재 재생 인덱스 조정
    let newCurrentIndex = playQueue.currentIndex;
    if (fromIndex === playQueue.currentIndex) {
      // 이동한 트랙이 현재 재생 중이면 새 위치로
      newCurrentIndex = toIndex;
    } else if (fromIndex < playQueue.currentIndex && toIndex >= playQueue.currentIndex) {
      newCurrentIndex = playQueue.currentIndex - 1;
    } else if (fromIndex > playQueue.currentIndex && toIndex <= playQueue.currentIndex) {
      newCurrentIndex = playQueue.currentIndex + 1;
    }
    
    setPlayQueue({ tracks: newTracks, currentIndex: newCurrentIndex });
  };

  // 셔플 토글
  const handleShuffleToggle = () => {
    if (!playQueue) {
      setIsShuffle(!isShuffle);
      return;
    }

    if (!isShuffle) {
      // 셔플 ON: 현재 트랙을 제외한 나머지를 섞고 현재 트랙을 맨 앞에 배치
      const currentTrackData = playQueue.tracks[playQueue.currentIndex];
      const otherTracks = playQueue.tracks.filter((_, i) => i !== playQueue.currentIndex);
      
      // Fisher-Yates 셔플
      for (let i = otherTracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [otherTracks[i], otherTracks[j]] = [otherTracks[j], otherTracks[i]];
      }
      
      const shuffledTracks = [currentTrackData, ...otherTracks];
      setPlayQueue({
        tracks: shuffledTracks,
        currentIndex: 0,
        originalTracks: playQueue.originalTracks || playQueue.tracks,
      });
    } else {
      // 셔플 OFF: 원본 순서로 복원
      if (playQueue.originalTracks) {
        const currentTrackData = playQueue.tracks[playQueue.currentIndex];
        const originalIndex = playQueue.originalTracks.findIndex(
          t => t.title === currentTrackData.title && t.artist === currentTrackData.artist
        );
        setPlayQueue({
          tracks: playQueue.originalTracks,
          currentIndex: originalIndex >= 0 ? originalIndex : 0,
          originalTracks: undefined,
        });
      }
    }
    setIsShuffle(!isShuffle);
  };

  // 반복 모드 토글
  const handleRepeatToggle = () => {
    if (repeatMode === "off") setRepeatMode("all");
    else if (repeatMode === "all") setRepeatMode("one");
    else setRepeatMode("off");
  };

  // 좋아요 토글 (현재 재생 중인 트랙)
  const handleLikeToggle = async () => {
    if (!currentTrack) return;
    const trackKey = `${currentTrack.track.title}-${currentTrack.track.artists}`;
    
    try {
      await toggleTrackLike(currentTrack.track.title, currentTrack.track.artists, currentUserId);
      setLikedTracks(prev => {
        const newMap = new Map(prev);
        if (newMap.has(trackKey)) {
          newMap.delete(trackKey);
        } else {
          newMap.set(trackKey, { 
            albumImage: currentTrack.track.album?.image, 
            duration: "" 
          });
        }
        return newMap;
      });
    } catch (error) {
      console.error('트랙 좋아요 오류:', error);
      // API 실패 시 로컬 상태만 변경
      setLikedTracks(prev => {
        const newMap = new Map(prev);
        if (newMap.has(trackKey)) {
          newMap.delete(trackKey);
        } else {
          newMap.set(trackKey, { 
            albumImage: currentTrack.track.album?.image, 
            duration: "" 
          });
        }
        return newMap;
      });
    }
  };

  // 댓글 작성자 프로필 로드
  const loadCommentAuthorProfile = async (authorId: number, nickname: string, avatar?: string) => {
    try {
      const [profileData, blockStatus] = await Promise.all([
        getProfile(authorId),
        currentUserId ? getBlockStatus(authorId, currentUserId) : Promise.resolve({ isBlocked: false, isBlockedByTarget: false })
      ]);
      
      if (profileData) {
        setCommentAuthorProfile({
          id: authorId,
          nickname: profileData.nickname || nickname,
          avatar: profileData.avatar || avatar || "🎧",
          bio: profileData.bio,
          musicTags: profileData.musicTags,
          playlists: profileData.playlists,
          followers: profileData.followers,
          isBlocked: blockStatus.isBlocked
        });
      } else {
        setCommentAuthorProfile({
          id: authorId,
          nickname,
          avatar: avatar || "🎧",
          isBlocked: blockStatus.isBlocked
        });
      }
    } catch (error) {
      console.error('댓글 작성자 프로필 로드 오류:', error);
      setCommentAuthorProfile({
        id: authorId,
        nickname,
        avatar: avatar || "🎧",
        isBlocked: false
      });
    }
  };

  // 댓글 작성자 차단/해제
  const handleBlockCommentAuthor = async () => {
    if (!commentAuthorProfile || !currentUserId) return;
    
    const isCurrentlyBlocked = commentAuthorProfile.isBlocked;
    const blockedUserId = commentAuthorProfile.id;
    const confirmMessage = isCurrentlyBlocked 
      ? `${commentAuthorProfile.nickname}님의 차단을 해제하시겠습니까?`
      : `${commentAuthorProfile.nickname}님을 차단하시겠습니까?\n\n차단하면 해당 사용자의 플레이리스트와 댓글을 볼 수 없으며, 서로 팔로우할 수 없습니다.`;
    
    if (!confirm(confirmMessage)) return;
    
    setIsBlockingCommentAuthor(true);
    try {
      if (isCurrentlyBlocked) {
        await unblockUser(blockedUserId, currentUserId);
        setCommentAuthorProfile(prev => prev ? { ...prev, isBlocked: false } : null);
      } else {
        await blockUser(blockedUserId, currentUserId);
        setCommentAuthorProfile(null);
        
        setPlaylistPosts(prev => prev
          .filter(post => post.author.id !== blockedUserId)
          .map(post => ({
            ...post,
            comments: post.comments.filter(comment => comment.authorId !== blockedUserId)
          }))
        );
      }
    } catch (error) {
      console.error('차단 처리 오류:', error);
      alert('차단 처리에 실패했습니다.');
    } finally {
      setIsBlockingCommentAuthor(false);
    }
  };

  // 트랙 좋아요 토글 (플레이리스트 내 트랙용)
  const handleTrackLikeToggle = async (title: string, artist: string, albumImage?: string, duration?: string) => {
    const trackKey = `${title}-${artist}`;
    
    try {
      await toggleTrackLike(title, artist, currentUserId);
      setLikedTracks(prev => {
        const newMap = new Map(prev);
        if (newMap.has(trackKey)) {
          newMap.delete(trackKey);
        } else {
          newMap.set(trackKey, { albumImage, duration });
        }
        return newMap;
      });
    } catch (error) {
      console.error('트랙 좋아요 오류:', error);
      // API 실패 시 로컬 상태만 변경
      setLikedTracks(prev => {
        const newMap = new Map(prev);
        if (newMap.has(trackKey)) {
          newMap.delete(trackKey);
        } else {
          newMap.set(trackKey, { albumImage, duration });
        }
        return newMap;
      });
    }
  };

  const handleCreateStation = async () => {
    if (!newStationTitle.trim()) return;
    
    try {
      const result = await createStation(currentUserId, { 
        title: newStationTitle.trim(),
        isPrivate: isPrivateStation
      });
      if (result && onNavigateToStation) {
        setNewStationTitle("");
        setIsPrivateStation(false);
        onNavigateToStation(result.id);
      }
    } catch (error) {
      setStationError('스테이션 생성에 실패했습니다.');
    }
  };

  const handleJoinStation = async () => {
    if (!joinCode.trim()) return;
    
    try {
      const result = await joinStation(currentUserId, joinCode.trim());
      if (result && onNavigateToStation) {
        setJoinCode("");
        onNavigateToStation(result.id);
      } else {
        setStationError('스테이션을 찾을 수 없습니다.');
      }
    } catch (error) {
      setStationError('스테이션 입장에 실패했습니다.');
    }
  };

  const handleEnterStation = (stationId: number) => {
    if (onNavigateToStation) {
      onNavigateToStation(stationId);
    }
  };

  const isCurrentTrackLiked = currentTrack 
    ? likedTracks.has(`${currentTrack.track.title}-${currentTrack.track.artists}`)
    : false;

  return (
    <div
      className="absolute inset-0 bg-center bg-cover bg-no-repeat flex flex-col"
      style={{
        backgroundImage: `url('${imgBackground}')`,
      }}
    >
      {/* Dark overlay for 20% opacity */}
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />
      
      {/* Top Header - Glassy */}
      <header className="relative z-10 flex items-center justify-between p-4 backdrop-blur-xl bg-black/20 border-b border-white/10">
        {/* Left: Logo/Title */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="bg-white/20 backdrop-blur-lg border border-white/30 rounded-xl p-2">
            <Music2 className="w-6 h-6 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-white text-xl hidden sm:block">PLYST</h1>
        </motion.div>

        {/* Center: Search */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex-1 max-w-md mx-4"
        >
          <div 
            className="relative cursor-pointer"
            onClick={() => setIsSearchModalOpen(true)}
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
            <Input
              type="text"
              placeholder="플레이리스트 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={() => setIsSearchModalOpen(true)}
              readOnly
              className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50 backdrop-blur-sm focus:bg-white/20 focus:border-white/40 cursor-pointer"
            />
          </div>
        </motion.div>

        {/* Right: Notification, Profile */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2"
        >
          <button 
            onClick={() => setIsNotificationOpen(true)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors relative"
          >
            <Bell className="w-5 h-5 text-white" />
            {/* Notification badge - 읽지 않은 알림이 있을 때만 표시 */}
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          <button 
            onClick={() => setIsProfileOpen(true)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            {isImageUrl(currentUserAvatar) ? (
              <img 
                src={normalizeImageUrl(currentUserAvatar) || ''} 
                alt="프로필" 
                className="w-8 h-8 rounded-full object-cover border border-white/30"
              />
            ) : (
              <div className="w-8 h-8 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full flex items-center justify-center">
                {currentUserAvatar ? (
                  <span className="text-sm">{currentUserAvatar}</span>
                ) : (
                  <User className="w-4 h-4 text-white" />
                )}
              </div>
            )}
          </button>
        </motion.div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
        <div className="max-w-[1600px] mx-auto">
          {/* Welcome Section - Glassy Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 md:p-8 mb-6 shadow-2xl"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-white text-3xl mb-2">환영합니다, {localStorage.getItem("userNickname") || "사용자"}님! 👋</h2>
                <p className="text-white/70">오늘도 좋은 음악과 함께하세요</p>
              </div>
              <div className="flex gap-2">
                <div className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-2xl px-4 py-2">
                  <p className="text-white/60 text-xs">재생 시간</p>
                  <p className="text-white">
                    {Math.floor(totalPlayTime / 3600)}시간 {Math.floor((totalPlayTime % 3600) / 60)}분
                  </p>
                </div>
                <div className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-2xl px-4 py-2">
                  <p className="text-white/60 text-xs">좋아요</p>
                  <p className="text-white">{likedTracks.size}곡</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Quick Access Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-6"
          >
            {[
              { title: "플레이리스트", desc: "모든 플레이리스트", icon: Music2, color: "from-indigo-500 via-purple-500 to-indigo-600", iconBg: "from-indigo-400 to-purple-500", action: () => setActiveTab("trending") },
              { title: "AI 추천", desc: "AI 맞춤 추천", icon: Sparkles, color: "from-purple-500 via-pink-500 to-purple-600", iconBg: "from-purple-400 to-pink-500", action: () => setActiveTab("ai") },
              { title: "인기", desc: "인기 플레이리스트", icon: TrendingUp, color: "from-pink-500 via-rose-500 to-pink-600", iconBg: "from-pink-400 to-rose-500", action: () => setActiveTab("popular") },
              { title: "스테이션", desc: "함께 듣기", icon: Radio, color: "from-emerald-500 via-teal-500 to-emerald-600", iconBg: "from-emerald-400 to-teal-500", action: () => setActiveTab("station") },
              { title: "최근 재생", desc: "최근 들은 음악", icon: Clock, color: "from-blue-500 via-cyan-500 to-blue-600", iconBg: "from-blue-400 to-cyan-500", action: () => setActiveTab("recent") },
              { title: "좋아요", desc: "좋아한 음악", icon: Heart, color: "from-rose-500 via-orange-500 to-rose-600", iconBg: "from-rose-400 to-orange-500", action: () => setActiveTab("liked") },
            ].map((item, i) => (
              <motion.div
                key={i}
                onClick={item.action}
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                className="relative backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4 md:p-5 cursor-pointer group overflow-hidden shadow-lg hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300"
              >
                {/* Animated background gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-20 transition-opacity duration-500`} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                {/* Glow effect */}
                <div className={`absolute -top-10 -right-10 w-24 h-24 bg-gradient-to-br ${item.color} rounded-full blur-2xl opacity-0 group-hover:opacity-30 transition-opacity duration-500`} />
                
                {/* Content */}
                <div className="relative z-10">
                  <div className={`bg-gradient-to-br ${item.iconBg} rounded-xl p-2.5 w-fit mb-3 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                    <item.icon className="w-5 h-5 md:w-6 md:h-6 text-white drop-shadow-sm" />
                  </div>
                  <h3 className="text-white font-semibold text-base md:text-lg mb-0.5 truncate">{item.title}</h3>
                  <p className="text-white/50 text-xs md:text-sm truncate">{item.desc}</p>
                </div>
                
                {/* Bottom shine effect */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </motion.div>
            ))}
          </motion.div>

          {/* Playlist Creation Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="flex flex-wrap gap-3 mb-6"
          >
            <button 
              onClick={() => setIsCreatePlaylistOpen(true)}
              className="group flex items-center gap-3 backdrop-blur-xl bg-gradient-to-r from-sky-400/20 to-cyan-400/20 hover:from-sky-400/30 hover:to-cyan-400/30 border border-sky-300/40 hover:border-sky-300/60 rounded-2xl px-5 py-3 transition-all shadow-lg shadow-sky-500/10"
            >
              <div className="p-2 bg-gradient-to-br from-sky-400/30 to-cyan-400/30 rounded-xl group-hover:from-sky-400/40 group-hover:to-cyan-400/40 transition-colors">
                <Plus className="w-5 h-5 text-sky-200" />
              </div>
              <div className="text-left">
                <p className="text-white font-medium">플레이리스트 만들기</p>
                <p className="text-sky-200/70 text-xs">나만의 플레이리스트 생성</p>
              </div>
            </button>
            
            <button 
              onClick={() => setIsAIRecommendOpen(true)}
              className="group flex items-center gap-3 backdrop-blur-xl bg-gradient-to-r from-violet-400/20 to-fuchsia-400/20 hover:from-violet-400/30 hover:to-fuchsia-400/30 border border-violet-300/40 hover:border-violet-300/60 rounded-2xl px-5 py-3 transition-all shadow-lg shadow-violet-500/10">
              <div className="p-2 bg-gradient-to-br from-violet-400/30 to-fuchsia-400/30 rounded-xl group-hover:from-violet-400/40 group-hover:to-fuchsia-400/40 transition-colors">
                <Sparkles className="w-5 h-5 text-violet-200" />
              </div>
              <div className="text-left">
                <p className="text-white font-medium">AI 추천 플레이리스트</p>
                <p className="text-violet-200/70 text-xs">AI가 취향에 맞게 추천</p>
              </div>
            </button>
          </motion.div>

          {/* Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-2 mb-6 inline-flex gap-2"
          >
            {[
              { id: "trending" as const, label: "플레이리스트", icon: Music2 },
              { id: "ai" as const, label: "AI 추천", icon: Sparkles },
              { id: "popular" as const, label: "인기", icon: TrendingUp },
              { id: "station" as const, label: "스테이션", icon: Radio },
              { id: "recent" as const, label: "최근 재생", icon: Clock },
              { id: "liked" as const, label: "좋아요", icon: Heart },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  // 탭 변경 시 더보기 상태 초기화
                  setShowAllPlaylists(false);
                  setShowAllPopular(false);
                  setShowAllRecent(false);
                  setShowAllLikedPlaylists(false);
                  setShowAllLikedTracks(false);
                  setShowAllLikedComments(false);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  activeTab === tab.id
                    ? "bg-white/20 text-white border border-white/30"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="text-sm">{tab.label}</span>
              </button>
            ))}
          </motion.div>

          {/* Music Grid / Playlist Posts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 mb-6 shadow-2xl"
          >
            <h3 className="text-white text-2xl mb-4">
              {activeTab === "trending" && "플레이리스트"}
              {activeTab === "ai" && "✨ AI 추천 플레이리스트"}
              {activeTab === "station" && "📻 스테이션"}
              {activeTab === "recent" && "최근 재생"}
              {activeTab === "liked" && "좋아요 목록"}
            </h3>
            
            {/* Playlist Posts for Trending Tab */}
            {activeTab === "trending" && (
              <div className="space-y-6">
                {playlistsLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Loader2 className="w-10 h-10 text-white/50 animate-spin mb-4" />
                    <p className="text-white/50 text-lg">플레이리스트를 불러오는 중...</p>
                  </div>
                ) : playlistPosts.length === 0 ? (
                  <div className="backdrop-blur-xl bg-white/5 border border-dashed border-white/20 rounded-2xl p-12 text-center">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Music2 className="w-10 h-10 text-white/20" />
                    </div>
                    <p className="text-white/60 text-lg font-medium">등록된 플레이리스트가 없습니다</p>
                    <p className="text-white/40 mt-2">첫 번째 플레이리스트를 만들어보세요!</p>
                  </div>
                ) : (
                  (showAllPlaylists ? playlistPosts : playlistPosts.slice(0, DEFAULT_DISPLAY_COUNT)).map((post, postIndex) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * (postIndex % 5) }}
                      layout
                      className={`group backdrop-blur-xl border transition-all duration-500 overflow-hidden ${
                        expandedPlaylist === post.id
                          ? "bg-white/10 border-white/30 rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.4)] ring-1 ring-white/20"
                          : "bg-white/5 border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:-translate-y-1"
                      }`}
                    >
                      <div 
                        className="p-5 md:p-6 flex flex-col md:flex-row gap-6 cursor-pointer relative"
                        onClick={() => setExpandedPlaylist(expandedPlaylist === post.id ? null : post.id)}
                      >
                         <div className="relative shrink-0 mx-auto md:mx-0">
                            <div className={`w-32 h-32 md:w-36 md:h-36 rounded-2xl shadow-2xl overflow-hidden relative group/cover ${expandedPlaylist === post.id ? 'scale-105' : ''} transition-transform duration-500`}>
                                {post.coverImage ? (
                                    <img 
                                        src={post.coverImage} 
                                        alt={post.title}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover/cover:scale-110"
                                    />
                                ) : (
                                    <div className={`w-full h-full bg-gradient-to-br ${post.coverGradient} flex items-center justify-center text-4xl`}>
                                        {post.author.avatar}
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/cover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                     <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const playlistTracks = post.tracks.map((t) => ({
                                                title: t.title,
                                                artist: t.artist,
                                                albumImage: t.albumImage,
                                                duration: t.duration,
                                            }));
                                            handlePlayTrackFromPlaylist(0, playlistTracks);
                                        }}
                                        className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center hover:scale-110 transition-transform text-white border border-white/30"
                                     >
                                         <Play className="w-7 h-7 ml-1 fill-white" />
                                     </button>
                                </div>
                            </div>
                         </div>

                         <div className="flex-1 min-w-0 flex flex-col justify-center text-center md:text-left">
                            <div className="flex items-center justify-center md:justify-start gap-2 mb-2 text-sm text-white/60">
                                <div className="flex items-center gap-2 bg-white/5 rounded-full px-3 py-1 border border-white/5">
                                    <span className="font-medium text-white/90">{post.author.name}</span>
                                    {post.author.id !== currentUserId && (
                                        <button
                                            onClick={(e) => handleFollow(post.author.id, e)}
                                            disabled={followLoading === post.author.id}
                                            className={`text-xs font-bold transition-colors ${
                                                followingStatus.get(post.author.id)
                                                    ? 'text-white/40 hover:text-white/60'
                                                    : 'text-sky-400 hover:text-sky-300'
                                            }`}
                                        >
                                            {followLoading === post.author.id ? '...' : followingStatus.get(post.author.id) ? '팔로잉' : '팔로우'}
                                        </button>
                                    )}
                                </div>
                                <span className="text-xs opacity-50">• {post.createdAt}</span>
                            </div>

                            <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                                <h3 className="text-xl md:text-2xl font-bold text-white truncate leading-tight tracking-tight">
                                    {post.title}
                                </h3>
                                {!post.isPublic && (
                                    <span className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 p-1.5 rounded-lg">
                                        <Lock className="w-3.5 h-3.5" />
                                    </span>
                                )}
                            </div>

                            <p className="text-white/70 text-sm md:text-base line-clamp-2 mb-4 font-light leading-relaxed">
                                {post.description}
                            </p>

                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-4">
                                <div className="flex items-center gap-4 text-sm font-medium text-white/50 bg-black/20 px-4 py-2 rounded-xl">
                                    <span className="flex items-center gap-1.5 hover:text-pink-400 transition-colors">
                                        <Heart className={`w-4 h-4 ${post.isLiked ? "fill-pink-500 text-pink-500" : ""}`} /> 
                                        {post.likes}
                                    </span>
                                    <span className="w-px h-3 bg-white/10" />
                                    <span className="flex items-center gap-1.5 hover:text-blue-400 transition-colors">
                                        <MessageCircle className="w-4 h-4" /> {post.comments.length}
                                    </span>
                                    <span className="w-px h-3 bg-white/10" />
                                    <span className="flex items-center gap-1.5 hover:text-white transition-colors">
                                        <Music2 className="w-4 h-4" /> {post.tracks.length}곡
                                    </span>
                                    <span className="w-px h-3 bg-white/10" />
                                    <span className="flex items-center gap-1.5 hover:text-white/70 transition-colors">
                                        <Eye className="w-4 h-4" /> {post.viewCount}
                                    </span>
                                    <span className="w-px h-3 bg-white/10" />
                                    <span className="flex items-center gap-1.5 hover:text-green-400 transition-colors">
                                        <Share2 className="w-4 h-4" /> {post.shares}
                                    </span>
                                </div>
                                
                                {post.tags && post.tags.length > 0 && (
                                    <div className="flex gap-2">
                                        {post.tags.slice(0, 3).map((tag, i) => (
                                            <span key={i} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/5 text-white/40 border border-white/5">
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-center md:justify-start gap-2" onClick={e => e.stopPropagation()}>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleLikePlaylist(post.id); }}
                                    className={`h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-medium transition-all ${
                                        post.isLiked 
                                        ? "bg-pink-500/20 text-pink-400 border border-pink-500/30" 
                                        : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white"
                                    }`}
                                >
                                    <Heart className={`w-4 h-4 ${post.isLiked ? "fill-current" : ""}`} />
                                    좋아요
                                </button>
                                
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleShare(post); }}
                                    className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-all"
                                    title="공유"
                                >
                                    <Share2 className="w-4 h-4" />
                                </button>

                                <button 
                                    onClick={(e) => handleDuplicatePlaylist(post.id, e)}
                                    className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-green-500/20 hover:text-green-400 hover:border-green-500/30 transition-all"
                                    title="복제"
                                >
                                    <Copy className="w-4 h-4" />
                                </button>

                                {post.author.id === currentUserId && (
                                    <>
                                        <div className="w-px h-6 bg-white/10 mx-1" />
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleEditPlaylist(post); }} 
                                            className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-blue-500/20 hover:text-blue-400 hover:border-blue-500/30 transition-all"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeletePlaylist(post.id); }} 
                                            className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={(e) => handleToggleVisibility(post.id, e)}
                                            className={`h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center transition-all ${
                                                post.isPublic 
                                                    ? 'text-white/60 hover:bg-yellow-500/20 hover:text-yellow-400 hover:border-yellow-500/30' 
                                                    : 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30'
                                            }`}
                                            title={post.isPublic ? '비공개로 전환' : '공개로 전환'}
                                        >
                                            {post.isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                        </button>
                                    </>
                                )}
                            </div>
                         </div>

                         <div className="hidden md:flex flex-col items-center justify-center border-l border-white/5 pl-6">
                            <button
                                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                                    expandedPlaylist === post.id 
                                        ? "bg-white/20 text-white rotate-180" 
                                        : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
                                }`}
                            >
                                <ChevronDown className="w-6 h-6" />
                            </button>
                         </div>
                      </div>

                      <AnimatePresence>
                         {expandedPlaylist === post.id && (
                             <motion.div
                                 initial={{ height: 0, opacity: 0 }}
                                 animate={{ height: "auto", opacity: 1 }}
                                 exit={{ height: 0, opacity: 0 }}
                                 transition={{ duration: 0.4, ease: "circOut" }}
                             >
                                <div className="px-6 pb-6 pt-0 border-t border-white/5">
                                    <div className="flex items-center justify-between py-4">
                                        <h4 className="text-white/80 font-medium flex items-center gap-2">
                                            <Music2 className="w-4 h-4" /> 트랙 목록
                                        </h4>
                                        {post.tracks.length > 0 && (
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const playlistTracks = post.tracks.map((t) => ({
                                                        title: t.title,
                                                        artist: t.artist,
                                                        albumImage: t.albumImage,
                                                        duration: t.duration,
                                                    }));
                                                    handlePlayTrackFromPlaylist(0, playlistTracks);
                                                }}
                                                className="text-xs font-medium px-3 py-1.5 bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 rounded-lg transition-colors flex items-center gap-1.5"
                                            >
                                                <Play className="w-3 h-3 fill-current" /> 전체 재생
                                            </button>
                                        )}
                                    </div>

                                    <div className="bg-black/20 rounded-2xl p-2 mb-6 max-h-[400px] overflow-y-auto custom-scrollbar">
                                        {post.tracks.map((track, trackIndex) => {
                                            const trackKey = `${track.title}-${track.artist}`;
                                            const albumImage = trackAlbumImages[trackKey] || track.albumImage;
                                            const isLoading = loadingTrack === trackKey;
                                            const playlistTracks = post.tracks.map((t) => ({
                                                title: t.title,
                                                artist: t.artist,
                                                albumImage: trackAlbumImages[`${t.title}-${t.artist}`] || t.albumImage,
                                                duration: t.duration,
                                            }));

                                            return (
                                                <div 
                                                    key={track.id}
                                                    onClick={() => handlePlayTrackFromPlaylist(trackIndex, playlistTracks)}
                                                    className={`group/track flex items-center gap-4 p-3 rounded-xl transition-all cursor-pointer ${
                                                        isLoading 
                                                            ? "bg-sky-500/10 border border-sky-500/20" 
                                                            : "hover:bg-white/5 border border-transparent hover:border-white/5"
                                                    }`}
                                                >
                                                    <span className={`w-6 text-center text-sm font-medium ${isLoading ? "text-sky-400" : "text-white/30 group-hover/track:text-white/50"}`}>
                                                        {trackIndex + 1}
                                                    </span>
                                                    
                                                    <div className="relative w-12 h-12 shrink-0">
                                                        {albumImage ? (
                                                            <img src={albumImage} alt={track.title} className={`w-full h-full rounded-lg object-cover ${isLoading ? "opacity-50" : ""}`} />
                                                        ) : (
                                                            <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-600 rounded-lg" />
                                                        )}
                                                        <div className={`absolute inset-0 flex items-center justify-center ${isLoading ? "opacity-100" : "opacity-0 group-hover/track:opacity-100"} transition-opacity`}>
                                                            {isLoading ? (
                                                                <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />
                                                            ) : (
                                                                <Play className="w-5 h-5 text-white drop-shadow-md fill-white" />
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <p className={`font-medium truncate ${isLoading ? "text-sky-400" : "text-white"}`}>{track.title}</p>
                                                        <p className="text-white/50 text-xs truncate">{track.artist}</p>
                                                    </div>

                                                    <div className="text-right">
                                                        <span className="text-white/30 text-xs mr-4 font-mono">{track.duration}</span>
                                                    </div>

                                                    <div className="flex items-center gap-1 opacity-0 group-hover/track:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleTrackLikeToggle(track.title, track.artist, albumImage, track.duration);
                                                            }}
                                                            className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-pink-400 transition-colors"
                                                            title="좋아요"
                                                        >
                                                            <Heart className={`w-4 h-4 ${likedTracks.has(trackKey) ? "fill-pink-500 text-pink-500" : ""}`} />
                                                        </button>
                                                        {post.author.id === currentUserId && (
                                                            <button
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    if (confirm(`"${track.title}" 곡을 삭제하시겠습니까?`)) {
                                                                        const userId = Number(localStorage.getItem("userId"));
                                                                        const success = await removeTrackFromPlaylist(post.id, track.id, userId);
                                                                        if (success) {
                                                                            setPlaylistPosts(playlistPosts.map(p => 
                                                                                p.id === post.id ? { ...p, tracks: p.tracks.filter(t => t.id !== track.id) } : p
                                                                            ));
                                                                        }
                                                                    }
                                                                }}
                                                                className="p-2 hover:bg-red-500/10 rounded-lg text-white/30 hover:text-red-400 transition-colors"
                                                                title="삭제"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="border-t border-white/10 pt-4">
                                        <h4 className="text-white/80 font-medium mb-4 flex items-center gap-2">
                                            <MessageCircle className="w-4 h-4" /> 댓글 <span className="text-white/40 text-sm font-normal">({post.comments.length})</span>
                                        </h4>
                                        
                                        <div className="flex gap-3 mb-6">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-lg shrink-0 shadow-lg overflow-hidden">
                                                {isImageUrl(currentUserAvatar) ? (
                                                    <img src={normalizeImageUrl(currentUserAvatar) || ''} alt="ME" className="w-full h-full rounded-full object-cover" />
                                                ) : (
                                                    <span>👤</span>
                                                )}
                                            </div>
                                            <div className="flex-1 relative group/input">
                                                <input
                                                    type="text"
                                                    value={newComment}
                                                    onChange={(e) => setNewComment(e.target.value)}
                                                    onKeyDown={(e) => e.key === "Enter" && handleAddComment(post.id)}
                                                    placeholder="아름다운 댓글을 남겨주세요..."
                                                    className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 pl-4 pr-12 text-white placeholder:text-white/30 focus:outline-none focus:bg-white/10 focus:border-white/30 transition-all"
                                                />
                                                <button
                                                    onClick={() => handleAddComment(post.id)}
                                                    disabled={!newComment.trim()}
                                                    className="absolute right-1 top-1 h-8 w-8 flex items-center justify-center rounded-lg bg-white/10 text-white/60 hover:bg-sky-500 hover:text-white disabled:opacity-0 disabled:hover:bg-transparent transition-all"
                                                >
                                                    <Send className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                            {post.comments.length === 0 ? (
                                                <div className="text-center py-8 text-white/30 text-sm">
                                                    첫 번째 댓글의 주인공이 되어보세요!
                                                </div>
                                            ) : (
                                                post.comments.map((comment) => (
                                                    <div key={comment.id} className="flex gap-3 group/comment">
                                                        <div 
                                                            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 cursor-pointer overflow-hidden"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                loadCommentAuthorProfile(comment.authorId, comment.author, comment.avatar);
                                                            }}
                                                        >
                                                            {isImageUrl(comment.avatar) ? <img src={normalizeImageUrl(comment.avatar) || ''} alt={comment.author} className="w-full h-full object-cover" /> : "👤"}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-baseline gap-2 mb-0.5">
                                                                <span className="text-white font-medium text-sm hover:underline cursor-pointer" onClick={() => loadCommentAuthorProfile(comment.authorId, comment.author, comment.avatar)}>{comment.author}</span>
                                                                <span className="text-white/30 text-xs">{comment.createdAt}</span>
                                                            </div>
                                                            
                                                            {editingCommentId === comment.id ? (
                                                                <div className="mt-1">
                                                                    <textarea
                                                                        value={editCommentContent}
                                                                        onChange={(e) => setEditCommentContent(e.target.value)}
                                                                        className="w-full bg-white/10 border border-white/20 rounded-lg p-2 text-white text-sm focus:outline-none"
                                                                        rows={2}
                                                                    />
                                                                    <div className="flex gap-2 mt-2">
                                                                        <button onClick={() => handleSaveCommentEdit(post.id, comment.id)} className="text-xs px-3 py-1 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30">저장</button>
                                                                        <button onClick={handleCancelCommentEdit} className="text-xs px-3 py-1 bg-white/10 text-white/60 rounded-lg hover:bg-white/20">취소</button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <p className="text-white/80 text-sm leading-relaxed">{comment.content}</p>
                                                                    <div className="flex items-center gap-3 mt-1.5 opacity-60 group-hover/comment:opacity-100 transition-opacity">
                                                                        <button 
                                                                            onClick={(e) => { e.stopPropagation(); handleLikeComment(post.id, comment.id); }}
                                                                            className={`text-xs flex items-center gap-1 hover:text-white transition-colors ${comment.isLiked ? "text-red-400" : "text-white/50"}`}
                                                                        >
                                                                            <Heart className={`w-3 h-3 ${comment.isLiked ? "fill-current" : ""}`} /> {comment.likes || "좋아요"}
                                                                        </button>
                                                                        {comment.authorId === currentUserId && (
                                                                            <>
                                                                                <button onClick={(e) => { e.stopPropagation(); handleEditComment(comment); }} className="text-xs text-white/50 hover:text-blue-400">수정</button>
                                                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteComment(post.id, comment.id); }} className="text-xs text-white/50 hover:text-red-400">삭제</button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                             </motion.div>
                         )}
                      </AnimatePresence>
                    </motion.div>
                  ))
                )}
              </div>
            )}

            {/* AI 추천 탭 */}
            {activeTab === "ai" && (
              <div className="space-y-6">
                {/* 새로운 추천 받기 버튼 */}
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => setIsAIRecommendOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 border border-purple-400/30 rounded-xl transition-all text-white font-medium shadow-lg shadow-purple-500/20 hover:scale-105 active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    새로운 추천 받기
                  </button>
                </div>

                {aiPlaylistsLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Loader2 className="w-10 h-10 text-purple-400 animate-spin mb-4" />
                    <p className="text-white/50 text-lg">AI 플레이리스트를 불러오는 중...</p>
                  </div>
                ) : aiRecommendedPlaylists.length === 0 ? (
                  <div 
                    onClick={() => setIsAIRecommendOpen(true)}
                    className="backdrop-blur-xl bg-white/5 border border-dashed border-purple-400/30 rounded-3xl p-12 text-center cursor-pointer group hover:bg-white/10 transition-all"
                  >
                    <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500">
                        <Sparkles className="w-10 h-10 text-purple-400" />
                    </div>
                    <p className="text-white/80 text-lg font-medium mb-2">아직 AI 추천 플레이리스트가 없습니다</p>
                    <p className="text-purple-200/50">클릭하여 취향에 맞는 음악을 추천받아보세요!</p>
                  </div>
                ) : (
                  aiRecommendedPlaylists.map((playlist, index) => (
                    <motion.div
                      key={playlist.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * (index % 5) }}
                      layout
                      className={`group backdrop-blur-xl border transition-all duration-500 overflow-hidden ${
                        expandedAIPlaylist === playlist.id
                          ? "bg-white/10 border-white/30 rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.4)] ring-1 ring-white/20"
                          : "bg-white/5 border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:-translate-y-1"
                      }`}
                    >
                      <div 
                        className="p-5 md:p-6 flex flex-col md:flex-row gap-6 cursor-pointer relative"
                        onClick={() => setExpandedAIPlaylist(expandedAIPlaylist === playlist.id ? null : playlist.id)}
                      >
                         <div className="relative shrink-0 mx-auto md:mx-0">
                            <div className={`w-32 h-32 md:w-36 md:h-36 rounded-2xl shadow-2xl overflow-hidden relative group/cover ${expandedAIPlaylist === playlist.id ? 'scale-105' : ''} transition-transform duration-500`}>
                                {playlist.coverImage ? (
                                    <img 
                                        src={playlist.coverImage} 
                                        alt={playlist.title}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover/cover:scale-110"
                                    />
                                ) : (
                                    <div className={`w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center`}>
                                        <Sparkles className="w-12 h-12 text-white/50" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/cover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                     <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const playlistTracks = playlist.tracks.map((t) => ({
                                                title: t.title,
                                                artist: t.artist,
                                                albumImage: t.albumImage,
                                                duration: t.duration,
                                            }));
                                            handlePlayTrackFromPlaylist(0, playlistTracks);
                                        }}
                                        className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center hover:scale-110 transition-transform text-white border border-white/30"
                                     >
                                         <Play className="w-7 h-7 ml-1 fill-white" />
                                     </button>
                                </div>
                            </div>
                         </div>

                         <div className="flex-1 min-w-0 flex flex-col justify-center text-center md:text-left">
                            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                                <span className="px-2.5 py-0.5 bg-gradient-to-r from-purple-500/30 to-pink-500/30 border border-purple-500/30 rounded-full text-xs font-bold text-purple-200">
                                  AI 추천
                                </span>
                                <span className="text-white/40 text-xs">• {playlist.createdAt}</span>
                            </div>

                            <h3 className="text-xl md:text-2xl font-bold text-white truncate leading-tight tracking-tight mb-2">
                                {playlist.title}
                            </h3>

                            <p className="text-white/70 text-sm md:text-base line-clamp-2 mb-4 font-light leading-relaxed">
                                {playlist.description}
                            </p>

                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-4">
                                <div className="flex items-center gap-4 text-sm font-medium text-white/50 bg-black/20 px-4 py-2 rounded-xl">
                                    <span className="flex items-center gap-1.5 hover:text-white transition-colors">
                                        <Music2 className="w-4 h-4" /> {playlist.tracks.length}곡
                                    </span>
                                </div>
                                
                                {playlist.tags && playlist.tags.length > 0 && (
                                    <div className="flex gap-2">
                                        {playlist.tags.slice(0, 3).map((tag, i) => (
                                            <span key={i} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/5 text-white/40 border border-white/5">
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-center md:justify-start gap-2" onClick={e => e.stopPropagation()}>
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        if (confirm("이 AI 플레이리스트를 삭제하시겠습니까?")) {
                                            const userId = localStorage.getItem("userId");
                                            const result = await deleteAIPlaylist(playlist.id, userId ? Number(userId) : undefined);
                                            if (result.success) {
                                                setAIRecommendedPlaylists(aiRecommendedPlaylists.filter(p => p.id !== playlist.id));
                                            } else {
                                                alert(result.message || "삭제에 실패했습니다.");
                                            }
                                        }
                                    }}
                                    className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 text-white/60 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all text-sm font-medium"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    삭제
                                </button>
                            </div>
                         </div>

                         <div className="hidden md:flex flex-col items-center justify-center border-l border-white/5 pl-6">
                            <button
                                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                                    expandedAIPlaylist === playlist.id 
                                        ? "bg-white/20 text-white rotate-180" 
                                        : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
                                }`}
                            >
                                <ChevronDown className="w-6 h-6" />
                            </button>
                         </div>
                      </div>

                      <AnimatePresence>
                         {expandedAIPlaylist === playlist.id && (
                             <motion.div
                                 initial={{ height: 0, opacity: 0 }}
                                 animate={{ height: "auto", opacity: 1 }}
                                 exit={{ height: 0, opacity: 0 }}
                                 transition={{ duration: 0.4, ease: "circOut" }}
                             >
                                <div className="px-6 pb-6 pt-0 border-t border-white/5">
                                    <div className="flex items-center justify-between py-4">
                                        <h4 className="text-white/80 font-medium flex items-center gap-2">
                                            <Music2 className="w-4 h-4" /> 트랙 목록
                                        </h4>
                                        {playlist.tracks.length > 0 && (
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const playlistTracks = playlist.tracks.map((t) => ({
                                                        title: t.title,
                                                        artist: t.artist,
                                                        albumImage: t.albumImage,
                                                        duration: t.duration,
                                                    }));
                                                    handlePlayTrackFromPlaylist(0, playlistTracks);
                                                }}
                                                className="text-xs font-medium px-3 py-1.5 bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 rounded-lg transition-colors flex items-center gap-1.5"
                                            >
                                                <Play className="w-3 h-3 fill-current" /> 전체 재생
                                            </button>
                                        )}
                                    </div>

                                    <div className="bg-black/20 rounded-2xl p-2 mb-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                                        {playlist.tracks.map((track, idx) => (
                                            <div
                                                key={track.id}
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    const trackKey = `${track.title}-${track.artist}`;
                                                    setLoadingTrack(trackKey);
                                                    try {
                                                        const videoId = await getYoutubeVideoId(track.title, track.artist);
                                                        if (videoId) {
                                                            const trackInfo = await getTrackInfo(track.title, track.artist);
                                                            const albumImage = trackInfo?.albumImage || track.albumImage || "";
                                                            const durationSec = trackInfo?.duration ? Math.floor(trackInfo.duration / 1000) : 0;
                                                            const durationStr = durationSec > 0 
                                                                ? `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}`
                                                                : track.duration;
                                                            
                                                            setCurrentTrack({
                                                                track: {
                                                                    title: trackInfo?.title || track.title,
                                                                    artists: trackInfo?.artist || track.artist,
                                                                    album: {
                                                                        title: trackInfo?.album || "",
                                                                        image: albumImage,
                                                                    },
                                                                },
                                                                videoId,
                                                            });
                                                            
                                                            const playlistTracks = playlist.tracks.map(t => ({
                                                                title: t.title,
                                                                artist: t.artist,
                                                                albumImage: t.albumImage,
                                                                duration: t.duration,
                                                            }));
                                                            setPlayQueue({ tracks: playlistTracks, currentIndex: idx });
                                                            
                                                            addToRecentlyPlayed({ 
                                                                title: track.title, 
                                                                artist: track.artist, 
                                                                albumImage, 
                                                                duration: durationStr 
                                                            });
                                                        }
                                                    } catch (error) {
                                                        console.error("Error playing track:", error);
                                                    } finally {
                                                        setLoadingTrack(null);
                                                    }
                                                }}
                                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer group/track"
                                            >
                                                <span className="w-6 text-white/40 text-sm text-center">{idx + 1}</span>
                                                <div className="relative w-10 h-10 shrink-0">
                                                    {track.albumImage ? (
                                                        <img src={track.albumImage} alt={track.title} className="w-10 h-10 rounded-lg object-cover" />
                                                    ) : (
                                                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                                                            <Music2 className="w-5 h-5 text-white/80" />
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center opacity-0 group-hover/track:opacity-100 transition-opacity">
                                                        {loadingTrack === `${track.title}-${track.artist}` ? (
                                                            <Loader2 className="w-4 h-4 text-white animate-spin" />
                                                        ) : (
                                                            <Play className="w-4 h-4 text-white ml-0.5" />
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-white text-sm truncate">{track.title}</p>
                                                    <p className="text-white/50 text-xs truncate">{track.artist}</p>
                                                </div>
                                                <span className="text-white/40 text-xs">{track.duration}</span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleTrackLikeToggle(track.title, track.artist, track.albumImage, track.duration);
                                                    }}
                                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                                >
                                                    <Heart 
                                                        className={`w-4 h-4 ${
                                                            likedTracks.has(`${track.title}-${track.artist}`)
                                                                ? "fill-red-500 text-red-500" 
                                                                : "text-white/30 hover:text-white/80"
                                                        }`} 
                                                    />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                             </motion.div>
                         )}
                      </AnimatePresence>
                    </motion.div>
                  ))
                )}
              </div>
            )}

            {/* 인기 플레이리스트 탭 */}
            {activeTab === "popular" && (
              <div className="space-y-8">
                {/* 대한민국 인기 차트 섹션 */}
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="p-2.5 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl border border-green-500/20">
                      <TrendingUp className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-white text-lg font-bold">인기차트</h3>
                      <p className="text-white/50 text-sm">Spotify 대한민국 인기 차트</p>
                    </div>
                  </div>
                  
                  {koreaChartLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
                    </div>
                  ) : koreaChart.length === 0 ? (
                    <div className="text-center py-10 text-white/40">
                      차트를 불러올 수 없습니다
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {koreaChart.map((track, index) => (
                        <motion.div
                          key={`${track.title}-${track.artist}-${index}`}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="group flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all cursor-pointer"
                          onClick={() => handlePlayTrack(track.title, track.artist, track.albumImage, track.duration ? `${Math.floor(track.duration / 60000)}:${String(Math.floor((track.duration % 60000) / 1000)).padStart(2, '0')}` : undefined)}
                        >
                          <div className={`w-7 h-7 flex items-center justify-center rounded-lg text-sm font-bold ${
                            index < 3 
                              ? index === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white' 
                                : index === 1 ? 'bg-gradient-to-br from-gray-300 to-slate-400 text-white'
                                : 'bg-gradient-to-br from-orange-600 to-orange-700 text-white'
                              : 'bg-white/10 text-white/60'
                          }`}>
                            {index + 1}
                          </div>
                          {track.albumImage ? (
                            <img src={track.albumImage} alt={track.title} className="w-11 h-11 rounded-lg object-cover group-hover:scale-105 transition-transform" />
                          ) : (
                            <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                              <Music2 className="w-5 h-5 text-white/80" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate group-hover:text-green-300 transition-colors">{track.title}</p>
                            <p className="text-white/50 text-xs truncate">{track.artist}</p>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="w-5 h-5 text-green-400 fill-green-400" />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 인기 플레이리스트 섹션 */}
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="p-2.5 bg-gradient-to-br from-pink-500/20 to-rose-500/20 rounded-xl border border-pink-500/20">
                      <Heart className="w-5 h-5 text-pink-400" />
                    </div>
                    <div>
                      <h3 className="text-white text-lg font-bold">인기 플레이리스트</h3>
                      <p className="text-white/50 text-sm">PLYST 커뮤니티 인기</p>
                    </div>
                  </div>
                  
                {playlistsLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Loader2 className="w-10 h-10 text-white/60 animate-spin mb-4" />
                    <p className="text-white/50 text-lg">인기 플레이리스트를 불러오는 중...</p>
                  </div>
                ) : (() => {
                  const popularPlaylists = [...playlistPosts]
                    .map(post => ({
                      ...post,
                      popularityScore: (post.likes * 3) + (post.comments.length * 2) + (post.viewCount * 1)
                    }))
                    .sort((a, b) => b.popularityScore - a.popularityScore)
                    .filter(post => post.likes > 0 || post.comments.length > 0 || post.viewCount > 0)
                    .slice(0, 10);
                  
                  if (popularPlaylists.length === 0) {
                    return (
                      <div className="backdrop-blur-xl bg-white/5 border border-dashed border-white/20 rounded-3xl p-12 text-center">
                        <div className="w-20 h-20 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                          <TrendingUp className="w-10 h-10 text-orange-400" />
                        </div>
                        <p className="text-white/60 text-lg font-medium">아직 인기 플레이리스트가 없습니다</p>
                        <p className="text-white/40 mt-2">플레이리스트에 좋아요나 댓글을 남겨보세요!</p>
                      </div>
                    );
                  }
                  
                  const displayPosts = showAllPopular ? popularPlaylists : popularPlaylists.slice(0, DEFAULT_DISPLAY_COUNT);
                  
                  return displayPosts.map((post, postIndex) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * (postIndex % 5) }}
                      layout
                      className={`group backdrop-blur-xl border transition-all duration-500 overflow-hidden ${
                        expandedPlaylist === post.id
                          ? "bg-white/10 border-white/30 rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.4)] ring-1 ring-white/20"
                          : "bg-white/5 border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:-translate-y-1"
                      }`}
                    >
                      <div 
                        className="p-5 md:p-6 flex flex-col md:flex-row gap-6 cursor-pointer relative"
                        onClick={() => setExpandedPlaylist(expandedPlaylist === post.id ? null : post.id)}
                      >
                        <div className="relative shrink-0 mx-auto md:mx-0">
                          <div className={`w-32 h-32 md:w-36 md:h-36 rounded-2xl shadow-2xl overflow-hidden relative group/cover ${expandedPlaylist === post.id ? 'scale-105' : ''} transition-transform duration-500`}>
                            {post.coverImage ? (
                              <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover transition-transform duration-700 group-hover/cover:scale-110" />
                            ) : (
                              <div className={`w-full h-full bg-gradient-to-br ${post.coverGradient} flex items-center justify-center text-4xl`}>{post.author.avatar}</div>
                            )}
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/cover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlayTrackFromPlaylist(0, post.tracks.map((t) => ({ title: t.title, artist: t.artist, albumImage: t.albumImage, duration: t.duration })));
                                }}
                                className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center hover:scale-110 transition-transform text-white border border-white/30"
                              >
                                <Play className="w-7 h-7 ml-1 fill-white" />
                              </button>
                            </div>
                            {postIndex < 3 ? (
                              <div className={`absolute top-0 left-0 w-10 h-10 flex items-center justify-center rounded-br-2xl text-lg font-bold text-white shadow-lg ${
                                postIndex === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                                postIndex === 1 ? 'bg-gradient-to-br from-gray-300 to-slate-400' :
                                'bg-gradient-to-br from-orange-600 to-orange-700'
                              }`}>{postIndex + 1}</div>
                            ) : (
                              <div className="absolute top-0 left-0 w-8 h-8 flex items-center justify-center rounded-br-xl bg-black/60 backdrop-blur-sm text-sm font-bold text-white/90">{postIndex + 1}</div>
                            )}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-center text-center md:text-left">
                          <div className="flex items-center justify-center md:justify-start gap-2 mb-2 text-sm text-white/60">
                            <span className="font-medium text-white/90">{post.author.name}</span>
                            <span className="text-xs opacity-50">• {post.createdAt}</span>
                          </div>
                          <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                            <h3 className="text-xl md:text-2xl font-bold text-white truncate leading-tight tracking-tight">{post.title}</h3>
                            {!post.isPublic && <span className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 p-1.5 rounded-lg"><Lock className="w-3.5 h-3.5" /></span>}
                          </div>
                          <p className="text-white/70 text-sm md:text-base line-clamp-2 mb-4 font-light leading-relaxed">{post.description}</p>
                          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-4">
                            <div className="flex items-center gap-4 text-sm font-medium text-white/50 bg-black/20 px-4 py-2 rounded-xl">
                              <span className="flex items-center gap-1.5 text-pink-400"><Heart className="w-4 h-4 fill-pink-400" /> {post.likes}</span>
                              <span className="w-px h-3 bg-white/10" />
                              <span className="flex items-center gap-1.5 text-blue-400"><MessageCircle className="w-4 h-4" /> {post.comments.length}</span>
                              <span className="w-px h-3 bg-white/10" />
                              <span className="flex items-center gap-1.5 text-white/70"><Eye className="w-4 h-4" /> {post.viewCount}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-center md:justify-start gap-2" onClick={e => e.stopPropagation()}>
                            <button onClick={(e) => { e.stopPropagation(); handleLikePlaylist(post.id); }} className={`h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-medium transition-all ${post.isLiked ? "bg-pink-500/20 text-pink-400 border border-pink-500/30" : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white"}`}>
                              <Heart className={`w-4 h-4 ${post.isLiked ? "fill-current" : ""}`} /> 좋아요
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleShare(post); }} className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-all" title="공유"><Share2 className="w-4 h-4" /></button>
                          </div>
                        </div>

                        <div className="hidden md:flex flex-col items-center justify-center border-l border-white/5 pl-6">
                          <button className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${expandedPlaylist === post.id ? "bg-white/20 text-white rotate-180" : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"}`}>
                            <ChevronDown className="w-6 h-6" />
                          </button>
                        </div>
                      </div>

                      <AnimatePresence>
                        {expandedPlaylist === post.id && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: "circOut" }}>
                            <div className="px-6 pb-6 pt-0 border-t border-white/5">
                              <div className="flex items-center justify-between py-4">
                                <h4 className="text-white/80 font-medium flex items-center gap-2"><Music2 className="w-4 h-4" /> 트랙 목록</h4>
                                {post.tracks.length > 0 && (
                                  <button onClick={(e) => { e.stopPropagation(); handlePlayTrackFromPlaylist(0, post.tracks.map((t) => ({ title: t.title, artist: t.artist, albumImage: t.albumImage, duration: t.duration }))); }} className="text-xs font-medium px-3 py-1.5 bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 rounded-lg transition-colors flex items-center gap-1.5">
                                    <Play className="w-3 h-3 fill-current" /> 전체 재생
                                  </button>
                                )}
                              </div>
                              <div className="bg-black/20 rounded-2xl p-2 mb-6 max-h-[400px] overflow-y-auto custom-scrollbar">
                                {post.tracks.map((track, trackIndex) => {
                                  const trackKey = `${track.title}-${track.artist}`;
                                  const albumImage = trackAlbumImages[trackKey] || track.albumImage;
                                  return (
                                    <div key={track.id} onClick={() => handlePlayTrackFromPlaylist(trackIndex, post.tracks.map((t) => ({ title: t.title, artist: t.artist, albumImage: trackAlbumImages[`${t.title}-${t.artist}`] || t.albumImage, duration: t.duration })))} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer group">
                                      <span className="w-6 text-white/40 text-sm text-center">{trackIndex + 1}</span>
                                      <div className="relative w-10 h-10 shrink-0">
                                        {albumImage ? <img src={albumImage} alt={track.title} className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg" />}
                                        <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Play className="w-4 h-4 text-white ml-0.5" /></div>
                                      </div>
                                      <div className="flex-1 min-w-0"><p className="text-white text-sm truncate">{track.title}</p><p className="text-white/50 text-xs truncate">{track.artist}</p></div>
                                      <span className="text-white/40 text-xs">{track.duration}</span>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="border-t border-white/10 pt-4">
                                <h4 className="text-white/80 font-medium mb-4 flex items-center gap-2"><MessageCircle className="w-4 h-4" /> 댓글 <span className="text-white/40 text-sm font-normal">({post.comments.length})</span></h4>
                                <div className="flex gap-3 mb-6">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-lg shrink-0 shadow-lg overflow-hidden">{isImageUrl(currentUserAvatar) ? <img src={normalizeImageUrl(currentUserAvatar) || ''} alt="ME" className="w-full h-full rounded-full object-cover" /> : <span>👤</span>}</div>
                                  <div className="flex-1 relative">
                                    <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddComment(post.id)} placeholder="댓글 작성..." className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 pr-12 text-white placeholder:text-white/30 focus:outline-none focus:bg-white/10 focus:border-white/30 transition-all" />
                                    <button onClick={() => handleAddComment(post.id)} disabled={!newComment.trim()} className="absolute right-1 top-1 h-8 w-8 flex items-center justify-center rounded-lg bg-white/10 text-white/60 hover:bg-sky-500 hover:text-white disabled:opacity-0 transition-all"><Send className="w-4 h-4" /></button>
                                  </div>
                                </div>
                                <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                  {post.comments.length === 0 ? <div className="text-center py-8 text-white/30 text-sm">첫 번째 댓글의 주인공이 되어보세요!</div> : post.comments.map((comment) => (
                                    <div key={comment.id} className="flex gap-3 group/comment">
                                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 cursor-pointer overflow-hidden" onClick={(e) => { e.stopPropagation(); loadCommentAuthorProfile(comment.authorId, comment.author, comment.avatar); }}>
                                        {isImageUrl(comment.avatar) ? <img src={normalizeImageUrl(comment.avatar) || ''} alt={comment.author} className="w-full h-full object-cover" /> : "👤"}
                                      </div>
                                      <div className="flex-1">
                                        <div className="flex items-baseline gap-2 mb-0.5">
                                          <span className="text-white font-medium text-sm hover:underline cursor-pointer" onClick={() => loadCommentAuthorProfile(comment.authorId, comment.author, comment.avatar)}>{comment.author}</span>
                                          <span className="text-white/30 text-xs">{comment.createdAt}</span>
                                        </div>
                                        <p className="text-white/80 text-sm leading-relaxed">{comment.content}</p>
                                        <div className="flex items-center gap-3 mt-1.5 opacity-60 group-hover/comment:opacity-100 transition-opacity">
                                          <button onClick={(e) => { e.stopPropagation(); handleLikeComment(post.id, comment.id); }} className={`text-xs flex items-center gap-1 hover:text-white transition-colors ${comment.isLiked ? "text-red-400" : "text-white/50"}`}>
                                            <Heart className={`w-3 h-3 ${comment.isLiked ? "fill-current" : ""}`} /> {comment.likes || "좋아요"}
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ));
                })()}
                </div>
              </div>
            )}

            {/* Song List for other tabs */}
            {activeTab !== "trending" && activeTab !== "popular" && (
              <div className="space-y-4">
                {/* 최근 재생 탭 */}
                {activeTab === "recent" && (
                  <>
                    {recentlyPlayed.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="backdrop-blur-xl bg-white/5 border border-dashed border-white/20 rounded-2xl p-8"
                      >
                        <div className="flex flex-col items-center justify-center text-center">
                          <div className="w-16 h-16 bg-gradient-to-br from-purple-500/50 to-pink-500/50 rounded-2xl flex items-center justify-center mb-4">
                            <Clock className="w-8 h-8 text-white/60" />
                          </div>
                          <p className="text-white/80 mb-2">최근 재생한 곡이 없습니다</p>
                          <p className="text-white/50 text-sm">플레이리스트에서 곡을 재생해보세요!</p>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="space-y-2">
                        {(showAllRecent ? recentlyPlayed : recentlyPlayed.slice(0, DEFAULT_DISPLAY_COUNT)).map((item, i) => (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 + i * 0.05 }}
                            className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer group"
                            onClick={() => handlePlayTrack(item.title, item.artist, item.albumImage, item.duration)}
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-8 h-8 flex items-center justify-center text-white/50 group-hover:text-white transition-colors">
                                <span>{i + 1}</span>
                              </div>
                              {item.albumImage ? (
                                <img src={item.albumImage} alt={item.title} className="w-12 h-12 rounded-lg shrink-0 group-hover:scale-105 transition-transform object-cover" />
                              ) : (
                                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg shrink-0 group-hover:scale-105 transition-transform flex items-center justify-center">
                                  <Music2 className="w-6 h-6 text-white/80" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-white truncate">{item.title}</p>
                                <p className="text-white/60 text-sm truncate">{item.artist}</p>
                              </div>
                              <div className="text-white/60 text-sm hidden sm:block">{item.duration}</div>
                              <button 
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTrackLikeToggle(item.title, item.artist, item.albumImage, item.duration);
                                }}
                              >
                                <Heart className={`w-5 h-5 ${likedTracks.has(`${item.title}-${item.artist}`) ? "fill-red-500 text-red-500" : "text-white/70"}`} />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* 스테이션 탭 */}
                {activeTab === "station" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5">
                        <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                          <Plus className="w-4 h-4" />
                          스테이션 만들기
                        </h4>
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <Input
                              value={newStationTitle}
                              onChange={(e) => setNewStationTitle(e.target.value)}
                              placeholder="스테이션 이름"
                              className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                            />
                            <button
                              onClick={handleCreateStation}
                              disabled={!newStationTitle.trim()}
                              className="h-10 px-4 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-xl hover:bg-emerald-500/30 transition-all disabled:opacity-50 whitespace-nowrap"
                            >
                              생성
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsPrivateStation(!isPrivateStation)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-sm ${
                              isPrivateStation 
                                ? 'bg-yellow-500/20 border-yellow-400/50 text-yellow-300' 
                                : 'bg-white/5 border-white/20 text-white/60 hover:bg-white/10'
                            }`}
                          >
                            {isPrivateStation ? (
                              <>
                                <Lock className="w-4 h-4" />
                                <span>비공개</span>
                                <span className="text-white/40 text-xs">- 초대 코드로만 입장</span>
                              </>
                            ) : (
                              <>
                                <Globe className="w-4 h-4" />
                                <span>공개</span>
                                <span className="text-white/40 text-xs">- 목록에 표시됨</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      
                      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5">
                        <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          초대 코드로 입장
                        </h4>
                        <div className="flex gap-2">
                          <Input
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            placeholder="초대 코드 입력"
                            maxLength={6}
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/40 uppercase"
                          />
                          <button
                            onClick={handleJoinStation}
                            disabled={!joinCode.trim()}
                            className="h-10 px-4 bg-sky-500/20 border border-sky-500/30 text-sky-300 rounded-xl hover:bg-sky-500/30 transition-all disabled:opacity-50 whitespace-nowrap"
                          >
                            입장
                          </button>
                        </div>
                        <p className="text-white/40 text-xs mt-2">
                          비공개 스테이션도 초대 코드로 입장할 수 있습니다
                        </p>
                      </div>
                    </div>
                    
                    {stationError && (
                      <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-2 rounded-xl flex items-center justify-between">
                        <span>{stationError}</span>
                        <button onClick={() => setStationError(null)}>
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    
                    <div>
                      <h4 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
                        <Radio className="w-5 h-5" />
                        공개 스테이션
                      </h4>
                      
                      {stationsLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
                        </div>
                      ) : stations.filter(s => !s.isPrivate).length === 0 ? (
                        <div className="backdrop-blur-xl bg-white/5 border border-dashed border-white/20 rounded-2xl p-12 text-center">
                          <Radio className="w-12 h-12 text-white/20 mx-auto mb-4" />
                          <p className="text-white/60">활성화된 공개 스테이션이 없습니다</p>
                          <p className="text-white/40 text-sm mt-1">첫 번째 스테이션을 만들어보세요!</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {stations.filter(s => !s.isPrivate).map((station) => (
                            <motion.div
                              key={station.id}
                              whileHover={{ scale: 1.02 }}
                              className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 cursor-pointer hover:bg-white/10 transition-all"
                              onClick={() => handleEnterStation(station.id)}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-emerald-500/20 rounded-xl">
                                    <Radio className="w-5 h-5 text-emerald-400" />
                                  </div>
                                  <div>
                                    <h5 className="text-white font-medium">{station.title}</h5>
                                    <p className="text-white/50 text-sm">호스트: {station.hostNickname}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {station.isLive && (
                                    <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 text-xs rounded-full border border-emerald-500/30">
                                      LIVE
                                    </span>
                                  )}
                                  {station.host?.id === currentUserId && (
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (window.confirm("스테이션을 종료하시겠습니까?")) {
                                          const result = await deleteStation(station.id, currentUserId);
                                          if (result) {
                                            setStations(prev => prev.filter(s => s.id !== station.id));
                                          } else {
                                            alert("스테이션 종료에 실패했습니다.");
                                          }
                                        }
                                      }}
                                      className="px-2 py-1 bg-red-500/20 text-red-300 text-xs rounded-full border border-red-500/30 hover:bg-red-500/30 transition-all"
                                    >
                                      종료
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-white/40 text-sm flex items-center gap-1">
                                  <Users className="w-4 h-4" />
                                  {station.participantCount}/{station.maxParticipants}
                                </span>
                                <span className="text-white/40 text-xs">
                                  코드: {station.inviteCode}
                                </span>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 좋아요 탭 */}
                {activeTab === "liked" && (
                  <div className="space-y-6">
                    {/* 좋아요한 플레이리스트 섹션 */}
                    <div>
                      <h3 className="text-white/80 text-lg font-medium mb-3 flex items-center gap-2">
                        <Music2 className="w-5 h-5 text-purple-400" />
                        좋아요한 플레이리스트
                      </h3>
                      {playlistPosts.filter(post => post.isLiked).length === 0 ? (
                        <div className="backdrop-blur-xl bg-white/5 border border-dashed border-white/20 rounded-xl p-6">
                          <p className="text-white/50 text-center text-sm">좋아요한 플레이리스트가 없습니다</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {(showAllLikedPlaylists 
                            ? playlistPosts.filter(post => post.isLiked) 
                            : playlistPosts.filter(post => post.isLiked).slice(0, DEFAULT_DISPLAY_COUNT)
                          ).map((post, i) => (
                            <motion.div
                              key={post.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer group"
                              onClick={() => setExpandedPlaylist(expandedPlaylist === post.id ? null : post.id)}
                            >
                              <div className="flex items-center gap-3">
                                {post.coverImage ? (
                                  <img 
                                    src={post.coverImage} 
                                    alt={post.title}
                                    loading="lazy"
                                    className="w-12 h-12 rounded-lg object-cover shrink-0 group-hover:scale-105 transition-transform"
                                  />
                                ) : (
                                  <div className={`w-12 h-12 bg-gradient-to-br ${post.coverGradient} rounded-lg shrink-0 flex items-center justify-center group-hover:scale-105 transition-transform`}>
                                    <Music2 className="w-6 h-6 text-white" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-white font-medium truncate">{post.title}</p>
                                  <p className="text-white/50 text-sm truncate flex items-center gap-1">
                                    {post.author.name} · {post.tracks.length}곡
                                  </p>
                                </div>
                                <button
                                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleLikePlaylist(post.id);
                                  }}
                                >
                                  <Heart className="w-5 h-5 fill-red-500 text-red-500" />
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 좋아요한 곡 섹션 */}
                    <div>
                      <h3 className="text-white/80 text-lg font-medium mb-3 flex items-center gap-2">
                        <Heart className="w-5 h-5 text-pink-400" />
                        좋아요한 곡
                      </h3>
                      {likedTracksLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 text-white/60 animate-spin" />
                          <span className="text-white/60 ml-2 text-sm">불러오는 중...</span>
                        </div>
                      ) : likedTracks.size === 0 ? (
                        <div className="backdrop-blur-xl bg-white/5 border border-dashed border-white/20 rounded-xl p-6">
                          <p className="text-white/50 text-center text-sm">좋아요한 곡이 없습니다</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {(showAllLikedTracks 
                            ? Array.from(likedTracks.entries()) 
                            : Array.from(likedTracks.entries()).slice(0, DEFAULT_DISPLAY_COUNT)
                          ).map(([trackKey, trackInfo], i) => {
                            const [title, artist] = trackKey.split('-');
                            // DB에서 가져온 앨범 이미지 사용, 없으면 recentlyPlayed에서 찾기
                            const recentTrack = recentlyPlayed.find(t => t.title === title && t.artist === artist);
                            const albumImage = trackInfo.albumImage || recentTrack?.albumImage || trackAlbumImages[trackKey];
                            const duration = trackInfo.duration || recentTrack?.duration || "";
                            
                            return (
                              <motion.div
                                key={trackKey}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 + i * 0.05 }}
                                className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-4 transition-all group"
                              >
                                <div className="flex items-center gap-4">
                                  <div className="w-8 h-8 flex items-center justify-center text-white/50 group-hover:text-white transition-colors">
                                    <span>{i + 1}</span>
                                  </div>
                                  {albumImage ? (
                                    <img src={albumImage} alt={title} className="w-12 h-12 rounded-lg shrink-0 group-hover:scale-105 transition-transform object-cover" />
                                  ) : (
                                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg shrink-0 group-hover:scale-105 transition-transform flex items-center justify-center">
                                      <Music2 className="w-6 h-6 text-white/80" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-white truncate">{title}</p>
                                    <p className="text-white/60 text-sm truncate">{artist}</p>
                                  </div>
                                  {duration && <div className="text-white/60 text-sm hidden sm:block">{duration}</div>}
                                  <button 
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // 좋아요 해제 - API 호출
                                      handleTrackLikeToggle(title, artist, albumImage, duration);
                                    }}
                                  >
                                    <Heart className="w-5 h-5 fill-red-500 text-red-500" />
                                  </button>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* 좋아요한 댓글 섹션 */}
                    <div>
                      <h3 className="text-white/80 text-lg font-medium mb-3 flex items-center gap-2">
                        <MessageCircle className="w-5 h-5 text-blue-400" />
                        좋아요한 댓글
                      </h3>
                      {(() => {
                        // 모든 플레이리스트에서 좋아요한 댓글 찾기
                        const likedComments = playlistPosts.flatMap(post => 
                          post.comments
                            .filter(comment => comment.isLiked)
                            .map(comment => ({
                              ...comment,
                              playlistTitle: post.title,
                              postId: post.id
                            }))
                        );
                        
                        return likedComments.length === 0 ? (
                          <div className="backdrop-blur-xl bg-white/5 border border-dashed border-white/20 rounded-xl p-6">
                            <p className="text-white/50 text-center text-sm">좋아요한 댓글이 없습니다</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {(showAllLikedComments 
                              ? likedComments 
                              : likedComments.slice(0, DEFAULT_DISPLAY_COUNT)
                            ).map((comment, i) => (
                              <motion.div
                                key={`${comment.postId}-${comment.id}`}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 + i * 0.05 }}
                                className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all"
                              >
                                <div className="flex items-start gap-3">
                                  {isImageUrl(comment.avatar) ? (
                                    <img 
                                      src={normalizeImageUrl(comment.avatar) || ''} 
                                      alt={comment.author} 
                                      className="w-8 h-8 rounded-full object-cover shrink-0 cursor-pointer hover:ring-2 hover:ring-purple-400 transition-all"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        loadCommentAuthorProfile(comment.authorId, comment.author, comment.avatar);
                                      }}
                                    />
                                  ) : (
                                    <div 
                                      className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm shrink-0 cursor-pointer hover:ring-2 hover:ring-purple-400 transition-all"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        loadCommentAuthorProfile(comment.authorId, comment.author, comment.avatar);
                                      }}
                                    >
                                      👤
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-white font-medium text-sm">{comment.author}</span>
                                      <span className="text-white/40 text-xs">{comment.createdAt}</span>
                                    </div>
                                    <p className="text-white/80 text-sm mb-1">{comment.content}</p>
                                    <p className="text-white/40 text-xs">
                                      플레이리스트: {comment.playlistTitle}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => handleLikeComment(comment.postId, comment.id)}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                  >
                                    <Heart className="w-5 h-5 fill-red-500 text-red-500" />
                                  </button>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* View All Button */}
            {activeTab === "trending" && playlistPosts.length > DEFAULT_DISPLAY_COUNT && (
              <button 
                onClick={() => setShowAllPlaylists(!showAllPlaylists)}
                className="w-full mt-4 backdrop-blur-lg bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white hover:bg-white/20 transition-all flex items-center justify-center gap-2"
              >
                {showAllPlaylists ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    접기
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    더 보기 ({playlistPosts.length - DEFAULT_DISPLAY_COUNT}개 더)
                  </>
                )}
              </button>
            )}
            {activeTab === "popular" && (() => {
              const popularCount = playlistPosts
                .filter(post => post.likes > 0 || post.comments.length > 0)
                .length;
              return popularCount > DEFAULT_DISPLAY_COUNT ? (
                <button 
                  onClick={() => setShowAllPopular(!showAllPopular)}
                  className="w-full mt-4 backdrop-blur-lg bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                >
                  {showAllPopular ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      접기
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      더 보기 ({popularCount - DEFAULT_DISPLAY_COUNT}개 더)
                    </>
                  )}
                </button>
              ) : null;
            })()}
            {activeTab === "recent" && recentlyPlayed.length > DEFAULT_DISPLAY_COUNT && (
              <button 
                onClick={() => setShowAllRecent(!showAllRecent)}
                className="w-full mt-4 backdrop-blur-lg bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white hover:bg-white/20 transition-all flex items-center justify-center gap-2"
              >
                {showAllRecent ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    접기
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    더 보기 ({recentlyPlayed.length - DEFAULT_DISPLAY_COUNT}개 더)
                  </>
                )}
              </button>
            )}
            {activeTab === "liked" && (
              <div className="space-y-2 mt-4">
                {/* 좋아요한 플레이리스트 더보기 */}
                {playlistPosts.filter(post => post.isLiked).length > DEFAULT_DISPLAY_COUNT && (
                  <button 
                    onClick={() => setShowAllLikedPlaylists(!showAllLikedPlaylists)}
                    className="w-full backdrop-blur-lg bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                  >
                    {showAllLikedPlaylists ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        좋아요한 플레이리스트 접기
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        좋아요한 플레이리스트 더 보기 ({playlistPosts.filter(post => post.isLiked).length - DEFAULT_DISPLAY_COUNT}개 더)
                      </>
                    )}
                  </button>
                )}
                {/* 좋아요한 곡 더보기 */}
                {likedTracks.size > DEFAULT_DISPLAY_COUNT && (
                  <button 
                    onClick={() => setShowAllLikedTracks(!showAllLikedTracks)}
                    className="w-full backdrop-blur-lg bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                  >
                    {showAllLikedTracks ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        좋아요한 곡 접기
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        좋아요한 곡 더 보기 ({likedTracks.size - DEFAULT_DISPLAY_COUNT}개 더)
                      </>
                    )}
                  </button>
                )}
                {/* 좋아요한 댓글 더보기 */}
                {(() => {
                  const likedCommentsCount = playlistPosts.flatMap(post => 
                    post.comments.filter(comment => comment.isLiked)
                  ).length;
                  return likedCommentsCount > DEFAULT_DISPLAY_COUNT && (
                    <button 
                      onClick={() => setShowAllLikedComments(!showAllLikedComments)}
                      className="w-full backdrop-blur-lg bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                    >
                      {showAllLikedComments ? (
                        <>
                          <ChevronUp className="w-4 h-4" />
                          좋아요한 댓글 접기
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" />
                          좋아요한 댓글 더 보기 ({likedCommentsCount - DEFAULT_DISPLAY_COUNT}개 더)
                        </>
                      )}
                    </button>
                  );
                })()}
              </div>
            )}
          </motion.div>

          {/* Bottom padding for music player */}
          <div className="h-32" />
        </div>
      </main>

      {/* Bottom Music Player - 트랙이 선택되고 유효한 videoId가 있을 때만 표시 */}
      {currentTrack?.videoId && currentTrack.videoId.trim() !== '' && (
        <MusicPlayer 
          track={currentTrack.track}
          videoId={currentTrack.videoId}
          onClose={() => setCurrentTrack(null)}
          onPrevious={handlePreviousTrack}
          onNext={handleNextTrack}
          hasPrevious={playQueue !== null && (playQueue.currentIndex > 0 || repeatMode === "all")}
          hasNext={playQueue !== null && (playQueue.currentIndex < playQueue.tracks.length - 1 || repeatMode === "all" || isShuffle)}
          onTrackEnd={handleTrackEnd}
          isShuffle={isShuffle}
          onShuffleToggle={handleShuffleToggle}
          repeatMode={repeatMode}
          onRepeatToggle={handleRepeatToggle}
          isLiked={isCurrentTrackLiked}
          onLikeToggle={handleLikeToggle}
          playQueue={playQueue}
          onPlayFromQueue={async (index) => {
            if (playQueue) {
              await handlePlayTrackFromPlaylist(index, playQueue.tracks);
            }
          }}
          initialShowQueue={showFullscreenPlayer}
          onShowQueueChange={setShowFullscreenPlayer}
          onRemoveFromQueue={handleRemoveFromQueue}
          onMoveTrackInQueue={handleMoveTrackInQueue}
        />
      )}

      {/* Search Playlist Modal */}
      <SearchPlaylistModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectTrack={(track, videoId) => {
          setCurrentTrack({ track, videoId });
          setIsSearchModalOpen(false);
          
          // 최근 재생 기록에 추가
          addToRecentlyPlayed({
            title: track.title,
            artist: track.artists,
            albumImage: track.album?.image,
          });
        }}
        onPlayPlaylist={(tracks, startIndex, videoId, track) => {
          // 플레이리스트 전체를 재생 큐에 설정
          setPlayQueue({ tracks, currentIndex: startIndex });
          setCurrentTrack({ 
            track: {
              title: track.title,
              artists: track.artists,
              album: track.album || { title: "", image: "" }
            }, 
            videoId 
          });
          setIsSearchModalOpen(false);
          
          // 최근 재생 기록에 추가
          addToRecentlyPlayed({
            title: track.title,
            artist: track.artists,
            albumImage: track.album?.image,
          });
        }}
        userPlaylistPosts={playlistPosts.map(post => ({
          id: post.id,
          author: post.author,
          title: post.title,
          description: post.description,
          coverGradient: post.coverGradient,
          coverImage: post.coverImage,
          tags: post.tags,
          tracks: post.tracks,
        }))}
      />

      {/* Create Playlist Modal */}
      <CreatePlaylistModal
        isOpen={isCreatePlaylistOpen}
        onClose={() => setIsCreatePlaylistOpen(false)}
        onCreate={async (newPlaylist) => {
          const result = await createPlaylist(currentUserId, {
            title: newPlaylist.title,
            description: newPlaylist.description,
            coverImageUrl: newPlaylist.coverImage,
            isPublic: newPlaylist.isPublic ?? true,
            tags: newPlaylist.tags || [],
            tracks: newPlaylist.tracks.map(t => ({
              title: t.title,
              artist: t.artist,
              albumImage: t.albumImage,
              durationSec: t.duration ? parseDuration(t.duration) : 210,
            })),
          });

          if (result) {
            // 생성 성공 시 백엔드에서 반환된 ID 사용
            const newPost: PlaylistPost = {
              id: result.id,
              author: { id: currentUserId, name: "나", avatar: "🎵" },
              title: newPlaylist.title,
              description: newPlaylist.description,
              coverGradient: "from-cyan-500 to-blue-600",
              coverImage: newPlaylist.coverImage,
              tags: newPlaylist.tags || [],
              likes: 0,
              shares: 0,
              viewCount: 0,
              isLiked: false,
              isPublic: newPlaylist.isPublic ?? true,
              createdAt: formatDateTime(new Date().toISOString()),
              tracks: newPlaylist.tracks.map((t, i) => ({
                id: i + 1,
                title: t.title,
                artist: t.artist,
                duration: t.duration || "3:30",
                albumImage: t.albumImage,
              })),
              comments: [],
            };
            setPlaylistPosts([newPost, ...playlistPosts]);
            alert(`"${newPlaylist.title}" 플레이리스트가 생성되었습니다!`);
          } else {
            alert('플레이리스트 생성에 실패했습니다.');
          }
        }}
      />

      {/* AI Recommend Playlist Modal */}
      <AIRecommendModal
        isOpen={isAIRecommendOpen}
        onClose={() => setIsAIRecommendOpen(false)}
        onSelectPlaylist={async (playlist) => {
          // AI 추천 플레이리스트를 DB에 저장
          const userId = Number(localStorage.getItem('userId'));
          const saveResult = await saveAIPlaylist({
            id: playlist.id,
            title: playlist.title,
            description: playlist.description,
            coverGradient: playlist.coverGradient,
            coverImage: playlist.coverImage,
            trackCount: playlist.tracks.length,
            tags: playlist.tags || [],
            tracks: playlist.tracks.map(t => ({
              title: t.title,
              artist: t.artist,
              duration: t.duration,
              albumImage: t.albumImage,
            })),
          }, userId);

          if (saveResult.success && saveResult.playlistId) {
            const newPost: PlaylistPost = {
              id: saveResult.playlistId,
              author: { id: userId, name: "AI 추천", avatar: "✨" },
              title: playlist.title,
              description: playlist.description,
              coverGradient: playlist.coverGradient,
              coverImage: playlist.coverImage,
              tags: playlist.tags || [],
              likes: 0,
              shares: 0,
              viewCount: 0,
              isLiked: false,
              isPublic: false,
              createdAt: formatDateTime(new Date().toISOString()),
              tracks: playlist.tracks.map((t, i) => ({
                id: i + 1,
                title: t.title,
                artist: t.artist,
                duration: t.duration,
                albumImage: t.albumImage,
              })),
              comments: [],
            };
            setAIRecommendedPlaylists([newPost, ...aiRecommendedPlaylists]);
          } else {
            const newPost: PlaylistPost = {
              id: Date.now(),
              author: { id: userId, name: "AI 추천", avatar: "✨" },
              title: playlist.title,
              description: playlist.description,
              coverGradient: playlist.coverGradient,
              coverImage: playlist.coverImage,
              tags: playlist.tags || [],
              likes: 0,
              shares: 0,
              viewCount: 0,
              isLiked: false,
              isPublic: false,
              createdAt: formatDateTime(new Date().toISOString()),
              tracks: playlist.tracks.map((t, i) => ({
                id: i + 1,
                title: t.title,
                artist: t.artist,
                duration: t.duration,
                albumImage: t.albumImage,
              })),
              comments: [],
            };
            setAIRecommendedPlaylists([newPost, ...aiRecommendedPlaylists]);
          }
        }}
      />

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onLogout={() => {
          // 로그아웃 처리
          localStorage.removeItem('userId');
          localStorage.removeItem('userNickname');
          localStorage.removeItem('userToken');
          setIsProfileOpen(false);
          onLogout();
        }}
        userId={Number(localStorage.getItem('userId'))}
        onPlaylistSelect={(playlistId) => {
          // 플레이리스트 상세 화면으로 이동
          setExpandedPlaylist(playlistId);
        }}
        onProfileUpdate={(avatar) => {
          // 프로필 아바타 업데이트
          setCurrentUserAvatar(avatar);
        }}
      />

      {/* 플레이리스트 수정 모달 */}
      <EditPlaylistModal
        isOpen={editingPlaylist !== null}
        onClose={() => setEditingPlaylist(null)}
        onSave={handleSavePlaylistEdit}
        onTracksChange={async () => {
          // 트랙 변경 시 해당 플레이리스트 정보 갱신
          if (editingPlaylist) {
            const detail = await getPlaylistDetail(editingPlaylist.id, currentUserId, false);
            if (detail) {
              const updatedTracks = detail.tracks?.map((t: any) => ({
                id: t.id,
                title: t.title,
                artist: t.artist,
                albumImage: t.albumImage || "",
                duration: t.durationSec ? `${Math.floor(t.durationSec / 60)}:${String(t.durationSec % 60).padStart(2, '0')}` : "0:00"
              })) || [];
              
              setPlaylistPosts(posts =>
                posts.map(post =>
                  post.id === editingPlaylist.id
                    ? { ...post, tracks: updatedTracks }
                    : post
                )
              );
              
              // editingPlaylist의 tracks도 갱신
              setEditingPlaylist(prev => prev ? { ...prev, tracks: updatedTracks } : null);
            }
          }
        }}
        playlist={editingPlaylist}
      />

      <AnimatePresence>
        {shareModalPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShareModalPost(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-pink-500/10 rounded-3xl pointer-events-none" />
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShareModalPost(null);
                }}
                className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white/80 hover:text-white transition-all"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="relative text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 backdrop-blur-sm flex items-center justify-center border border-white/10">
                  <Share2 className="w-8 h-8 text-purple-300" />
                </div>
                <h3 className="text-xl font-bold text-white mb-1">플레이리스트 공유</h3>
                <p className="text-white/50 text-sm">{shareModalPost.title}</p>
              </div>
              
              <div className="relative bg-black/20 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-white/10">
                <p className="text-white/50 text-xs mb-2">공유 링크</p>
                <p className="text-white text-sm break-all font-mono bg-black/30 rounded-lg p-3">
                  {window.location.origin}/playlist/{shareModalPost.id}
                </p>
              </div>
              
              <button
                onClick={handleActualShare}
                className="relative w-full py-3.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-semibold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Copy className="w-5 h-5" />
                링크 복사
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 프로필 이미지 확대 모달 */}
      <AnimatePresence>
        {enlargedAvatar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
            onClick={() => setEnlargedAvatar(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative max-w-2xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setEnlargedAvatar(null)}
                className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors"
              >
                <X className="w-10 h-10" />
              </button>
              {isImageUrl(enlargedAvatar.url) ? (
                <img
                  src={normalizeImageUrl(enlargedAvatar.url) || ''}
                  alt="프로필 사진"
                  className="w-full aspect-square rounded-3xl object-cover shadow-2xl"
                />
              ) : (
                <div className="w-full aspect-square bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl flex items-center justify-center text-[12rem] shadow-2xl">
                  {enlargedAvatar.url}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 댓글 작성자 프로필 모달 */}
      <AnimatePresence>
        {commentAuthorProfile && !enlargedAvatar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setCommentAuthorProfile(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-3xl bg-gradient-to-br from-gray-800/95 to-gray-900/95 border border-white/20 rounded-3xl p-10 shadow-2xl"
            >
              {/* 닫기 버튼 */}
              <button
                onClick={() => setCommentAuthorProfile(null)}
                className="absolute top-6 right-6 p-3 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-7 h-7 text-white" />
              </button>

              {/* 유저 프로필 */}
              <div className="flex flex-col items-center">
                {isImageUrl(commentAuthorProfile.avatar) ? (
                  <img 
                    src={normalizeImageUrl(commentAuthorProfile.avatar) || ''} 
                    alt={commentAuthorProfile.nickname}
                    className="w-48 h-48 rounded-full object-cover shadow-xl border-4 border-white/30 mb-8 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setEnlargedAvatar({ url: normalizeImageUrl(commentAuthorProfile.avatar) || commentAuthorProfile.avatar, name: commentAuthorProfile.nickname })}
                  />
                ) : (
                  <div 
                    className="w-48 h-48 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-8xl shadow-xl mb-8 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setEnlargedAvatar({ url: commentAuthorProfile.avatar, name: commentAuthorProfile.nickname })}
                  >
                    {commentAuthorProfile.avatar || "🎧"}
                  </div>
                )}
                <h3 className="text-3xl font-bold text-white mb-3">{commentAuthorProfile.nickname}</h3>
                {commentAuthorProfile.bio && (
                  <p className="text-white/70 text-center mb-6 text-lg max-w-lg">{commentAuthorProfile.bio}</p>
                )}

                {/* 통계 */}
                <div className="flex gap-12 mb-6">
                  <div className="text-center">
                    <p className="text-white font-bold text-2xl">{commentAuthorProfile.playlists || 0}</p>
                    <p className="text-white/50 text-sm">플레이리스트</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white font-bold text-2xl">{commentAuthorProfile.followers || 0}</p>
                    <p className="text-white/50 text-sm">팔로워</p>
                  </div>
                </div>

                {/* 음악 취향 */}
                {commentAuthorProfile.musicTags && commentAuthorProfile.musicTags.length > 0 && (
                  <div className="w-full max-w-md">
                    <h4 className="text-white/80 text-base mb-3 text-center">🎵 음악 취향</h4>
                    <div className="flex flex-wrap justify-center gap-3">
                      {commentAuthorProfile.musicTags.map((tag) => (
                        <span
                          key={tag}
                          className="px-4 py-2 bg-gradient-to-r from-sky-400/30 to-cyan-400/30 border border-sky-300/40 rounded-full text-sm text-sky-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {commentAuthorProfile.id !== currentUserId && (
                  <button
                    onClick={handleBlockCommentAuthor}
                    disabled={isBlockingCommentAuthor}
                    className={`mt-6 flex items-center gap-2 px-6 py-3 rounded-xl transition-all ${
                      commentAuthorProfile.isBlocked
                        ? 'bg-gray-500/30 hover:bg-gray-500/50 text-gray-300'
                        : 'bg-red-500/20 hover:bg-red-500/40 text-red-400'
                    } disabled:opacity-50`}
                  >
                    {isBlockingCommentAuthor ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Ban className="w-5 h-5" />
                    )}
                    <span>{isBlockingCommentAuthor ? '처리 중...' : commentAuthorProfile.isBlocked ? '차단 해제' : '차단하기'}</span>
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification Modal */}
      <NotificationModal
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        isConnected={isNotificationConnected}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onDeleteNotification={deleteNotification}
        onClearAll={clearAllNotifications}
      />
    </div>
  );
}
