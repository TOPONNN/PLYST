import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Search, Music, Loader2, Play, Users, Globe, Tag } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useSpotifySearch, TrackWithVideo } from "../hooks/useSpotifySearch";
import { Playlist, Track } from "../services/api";

interface UserPlaylist {
  id: number;
  author: {
    name: string;
    avatar: string;
  };
  title: string;
  description: string;
  coverGradient: string;
  coverImage?: string;
  tags?: string[];
  tracks: {
    id: number;
    title: string;
    artist: string;
    duration: string;
    albumImage?: string;
  }[];
}

interface PlaylistTrack {
  title: string;
  artist: string;
  albumImage?: string;
  duration?: string;
}

interface SearchPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTrack: (track: TrackWithVideo, videoId: string) => void;
  onPlayPlaylist?: (tracks: PlaylistTrack[], startIndex: number, videoId: string, track: TrackWithVideo) => void;
  userPlaylistPosts?: UserPlaylist[];
}

export default function SearchPlaylistModal({
  isOpen,
  onClose,
  onSelectTrack,
  onPlayPlaylist,
  userPlaylistPosts = [],
}: SearchPlaylistModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTab, setSearchTab] = useState<"user" | "spotify">("user");
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [selectedUserPlaylist, setSelectedUserPlaylist] = useState<UserPlaylist | null>(null);
  const [loadingVideoId, setLoadingVideoId] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  
  const {
    playlists,
    tracks,
    loading,
    error,
    searchPlaylistsByKeyword,
    loadPlaylistTracks,
    getVideoId,
    clearSearch,
  } = useSpotifySearch();

  const userPlaylists = useMemo(() => {
    let filtered = userPlaylistPosts;
    
    if (selectedTags.size > 0) {
      filtered = filtered.filter(p => 
        p.tags?.some(tag => selectedTags.has(tag))
      );
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        p => p.title.toLowerCase().includes(query) || 
             p.description.toLowerCase().includes(query) ||
             p.author.name.toLowerCase().includes(query) ||
             p.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [searchQuery, userPlaylistPosts, selectedTags]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    userPlaylistPosts.forEach(p => p.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).slice(0, 10);
  }, [userPlaylistPosts]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tag)) {
        newSet.delete(tag);
      } else {
        newSet.add(tag);
      }
      return newSet;
    });
  };

  // 검색 실행 (Spotify 탭일 때만)
  const handleSearch = () => {
    if (searchQuery.trim() && searchTab === "spotify") {
      setSelectedPlaylist(null);
      searchPlaylistsByKeyword(searchQuery);
    }
  };

  // 엔터 키 처리
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchTab === "spotify") {
      handleSearch();
    }
  };

  // Spotify 플레이리스트 선택
  const handleSelectPlaylist = async (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    await loadPlaylistTracks(playlist.id);
  };

  // 유저 플레이리스트 선택
  const handleSelectUserPlaylist = (playlist: UserPlaylist) => {
    setSelectedUserPlaylist(playlist);
  };

  // 트랙 재생 (Spotify 플레이리스트에서)
  const handlePlayTrack = async (track: Track, index: number) => {
    setLoadingVideoId(track.title);
    try {
      const videoId = await getVideoId(track);
      if (videoId) {
        // 플레이리스트 전체 곡을 전달
        if (onPlayPlaylist && tracks.length > 0) {
          const playlistTracks: PlaylistTrack[] = tracks.map(t => ({
            title: t.title,
            artist: t.artists,
            albumImage: t.album?.image,
            duration: "",
          }));
          onPlayPlaylist(playlistTracks, index, videoId, track);
        } else {
          onSelectTrack(track, videoId);
        }
        onClose();
      }
    } finally {
      setLoadingVideoId(null);
    }
  };

  // 유저 플레이리스트 트랙 재생
  const handlePlayUserTrack = async (track: { title: string; artist: string; albumImage?: string; duration?: string }, index: number, allTracks: { title: string; artist: string; albumImage?: string; duration?: string }[]) => {
    setLoadingVideoId(track.title);
    try {
      const fakeTrack: Track = {
        title: track.title,
        artists: track.artist,
        album: { title: "", image: track.albumImage || "" },
      };
      const videoId = await getVideoId(fakeTrack);
      if (videoId) {
        // 플레이리스트 전체 곡을 전달
        if (onPlayPlaylist) {
          const playlistTracks: PlaylistTrack[] = allTracks.map(t => ({
            title: t.title,
            artist: t.artist,
            albumImage: t.albumImage,
            duration: t.duration,
          }));
          onPlayPlaylist(playlistTracks, index, videoId, fakeTrack);
        } else {
          onSelectTrack(fakeTrack, videoId);
        }
        onClose();
      }
    } finally {
      setLoadingVideoId(null);
    }
  };

  // 모달 닫힐 때 초기화
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setSelectedPlaylist(null);
      setSelectedUserPlaylist(null);
      setSearchTab("user");
      setSelectedTags(new Set());
      clearSearch();
    }
  }, [isOpen, clearSearch]);

  // 뒤로가기
  const handleBack = () => {
    setSelectedPlaylist(null);
    setSelectedUserPlaylist(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="w-full max-w-2xl max-h-[85vh] backdrop-blur-3xl bg-slate-900/60 border border-white/5 rounded-3xl overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/5">
            <div className="flex items-center gap-4">
              {(selectedPlaylist || selectedUserPlaylist) ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="text-white hover:bg-white/10 rounded-full h-10 w-10 p-0"
                >
                  ←
                </Button>
              ) : (
                <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                  <Search className="w-6 h-6 text-white/70" />
                </div>
              )}
              <h2 className="text-white/90 text-xl font-bold tracking-tight">
                {selectedPlaylist ? selectedPlaylist.name : 
                 selectedUserPlaylist ? selectedUserPlaylist.title : "플레이리스트 검색"}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Tab Selector */}
          {!selectedPlaylist && !selectedUserPlaylist && (
            <div className="flex p-1 mx-6 mt-6 mb-2 bg-white/5 rounded-2xl border border-white/5">
              <button
                onClick={() => setSearchTab("user")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                  searchTab === "user"
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                }`}
              >
                <Users className="w-4 h-4" />
                유저 플레이리스트
              </button>
              <button
                onClick={() => setSearchTab("spotify")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                  searchTab === "spotify"
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                }`}
              >
                <Globe className="w-4 h-4" />
                Spotify 검색
              </button>
            </div>
          )}

          {/* Search Bar */}
          {!selectedPlaylist && !selectedUserPlaylist && (
            <div className="px-6 pb-6 border-b border-white/5 space-y-4">
              <div className="flex gap-3">
                <div className="relative flex-1 group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 group-focus-within:text-white/70 transition-colors" />
                  <Input
                    type="text"
                    placeholder={searchTab === "user" ? "유저 플레이리스트 검색..." : "Spotify에서 검색..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-12 h-12 bg-white/5 border-white/5 text-white placeholder:text-white/20 rounded-xl focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-all"
                  />
                </div>
                {searchTab === "spotify" && (
                  <Button
                    onClick={handleSearch}
                    disabled={loading}
                    className="h-12 px-6 bg-white/10 hover:bg-white/20 text-white border border-white/5 rounded-xl shadow-none transition-all"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "검색"}
                  </Button>
                )}
              </div>

              {searchTab === "user" && allTags.length > 0 && (
                <div 
                  className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar mask-gradient-right scroll-smooth"
                  onWheel={(e) => {
                    if (e.deltaY !== 0) {
                      e.currentTarget.scrollLeft += e.deltaY;
                      e.preventDefault();
                    }
                  }}
                >
                  <div className="flex items-center gap-2 px-1">
                    <Tag className="w-4 h-4 text-white/40" />
                    <span className="text-xs text-white/40 font-medium whitespace-nowrap">태그:</span>
                  </div>
                  {selectedTags.size > 0 && (
                    <button
                      onClick={() => setSelectedTags(new Set())}
                      className="px-3 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white/60 hover:text-white/90 transition-all whitespace-nowrap"
                    >
                      초기화
                    </button>
                  )}
                  {allTags.map((tag, i) => (
                    <button
                      key={i}
                      onClick={() => handleTagToggle(tag)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap border ${
                        selectedTags.has(tag)
                          ? "bg-white/10 border-white/20 text-white shadow-sm"
                          : "bg-transparent border-white/5 text-white/40 hover:text-white/80 hover:border-white/10"
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <div className="overflow-y-auto max-h-[55vh] p-6 custom-scrollbar bg-transparent">
            {error && (
              <div className="text-center text-red-400 py-8 bg-red-500/5 rounded-2xl border border-red-500/10">
                {error}
              </div>
            )}

            {loading && !playlists.length && !tracks.length && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-white/5 blur-xl rounded-full animate-pulse" />
                  <Loader2 className="w-10 h-10 text-white animate-spin relative z-10" />
                </div>
                <p className="text-white/40 text-sm">검색 중입니다...</p>
              </div>
            )}

            {searchTab === "user" && !selectedUserPlaylist && userPlaylists.length > 0 && (
              <div className="space-y-3">
                {(searchQuery.trim() || selectedTags.size > 0) && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/50 text-sm">
                      {userPlaylists.length}개의 플레이리스트
                    </span>
                    {selectedTags.size > 0 && (
                      <div className="flex items-center gap-2">
                        <Tag className="w-3 h-3 text-white/40" />
                        <span className="text-white/40 text-xs">{selectedTags.size}개 태그 선택됨</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3">
                {userPlaylists.map((playlist, i) => (
                  <motion.div
                    key={playlist.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="group relative bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-2xl p-3 transition-all cursor-pointer hover:shadow-lg overflow-hidden"
                    onClick={() => handleSelectUserPlaylist(playlist)}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                    <div className="flex gap-4 items-center">
                      <div className="relative">
                        {playlist.coverImage ? (
                          <img
                            src={playlist.coverImage}
                            alt={playlist.title}
                            className="w-20 h-20 rounded-xl object-cover shadow-sm group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className={`w-20 h-20 rounded-xl bg-gradient-to-br ${playlist.coverGradient} flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-300`}>
                            <Music className="w-8 h-8 text-white" />
                          </div>
                        )}
                        <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-black/5" />
                      </div>
                      
                      <div className="flex-1 min-w-0 py-1">
                        <div className="flex justify-between items-start">
                          <p className="text-white/90 font-bold text-lg truncate group-hover:text-white transition-colors">
                            {playlist.title}
                          </p>
                          <span className="text-xs text-white/30 bg-white/5 px-2 py-1 rounded-full border border-white/5">
                            {playlist.tracks.length}곡
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-2xl">{playlist.author.avatar}</span>
                           <p className="text-white/50 text-sm truncate hover:text-white/70 transition-colors">
                            {playlist.author.name}
                          </p>
                        </div>

                        {playlist.tags && playlist.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {playlist.tags.slice(0, 3).map((tag, index) => (
                              <button
                                key={index}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTagToggle(tag);
                                }}
                                className={`px-2 py-0.5 text-[10px] font-medium rounded-full transition-all ${
                                  selectedTags.has(tag)
                                    ? "bg-white/20 border border-white/20 text-white"
                                    : "bg-transparent border border-white/10 text-white/40 hover:border-white/20 hover:text-white/80"
                                }`}
                              >
                                #{tag}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="pr-2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                         <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                            <span className="text-white">→</span>
                         </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
                </div>
              </div>
            )}
            {selectedUserPlaylist && (
              <div className="space-y-3">
                <div className="flex gap-4 mb-6 p-4 bg-white/5 rounded-2xl border border-white/5">
                   <div className="w-24 h-24 rounded-xl overflow-hidden shadow-lg">
                      {selectedUserPlaylist.coverImage ? (
                          <img src={selectedUserPlaylist.coverImage} className="w-full h-full object-cover" />
                      ) : (
                          <div className={`w-full h-full bg-gradient-to-br ${selectedUserPlaylist.coverGradient} flex items-center justify-center`}>
                              <Music className="w-8 h-8 text-white" />
                          </div>
                      )}
                   </div>
                   <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-1">{selectedUserPlaylist.title}</h3>
                      <p className="text-white/60 text-sm mb-2">{selectedUserPlaylist.author.name}</p>
                      <p className="text-white/50 text-xs line-clamp-2">{selectedUserPlaylist.description}</p>
                   </div>
                </div>

                {selectedUserPlaylist.tracks.map((track, index) => (
                  <motion.div
                    key={`${track.id}-${index}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="group flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-all cursor-pointer"
                    onClick={() => handlePlayUserTrack(track, index, selectedUserPlaylist.tracks)}
                  >
                    <div className="relative">
                      {track.albumImage ? (
                        <img
                          src={track.albumImage}
                          alt={track.title}
                          className="w-12 h-12 rounded-lg object-cover shadow-sm group-hover:opacity-80 transition-opacity"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-sky-400/80 to-cyan-400/80 flex items-center justify-center shadow-sm">
                          <Music className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                            {loadingVideoId === track.title ? (
                                <Loader2 className="w-4 h-4 text-white animate-spin" />
                            ) : (
                                <Play className="w-4 h-4 text-white fill-white" />
                            )}
                         </div>
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate group-hover:text-white transition-colors">{track.title}</p>
                      <p className="text-white/50 text-xs truncate">{track.artist}</p>
                    </div>
                    <span className="text-white/30 text-xs font-mono">{track.duration}</span>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Spotify 플레이리스트 목록 */}
            {searchTab === "spotify" && !selectedPlaylist && playlists.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {playlists.map((playlist, i) => (
                  <motion.div
                    key={playlist.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="group relative flex flex-col bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-2xl p-4 transition-all cursor-pointer hover:shadow-lg hover:-translate-y-1"
                    onClick={() => handleSelectPlaylist(playlist)}
                  >
                    <div className="relative aspect-square mb-3 overflow-hidden rounded-xl shadow-sm">
                      {playlist.image ? (
                        <img
                          src={playlist.image}
                          alt={playlist.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                          <Music className="w-12 h-12 text-white/50" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold truncate text-sm mb-1 group-hover:text-white transition-colors">
                        {playlist.name}
                      </p>
                      <p className="text-white/50 text-xs truncate flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {playlist.owner}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* 트랙 목록 */}
            {selectedPlaylist && tracks.length > 0 && (
              <div className="space-y-3">
                 <div className="flex gap-4 mb-6 p-4 bg-white/5 rounded-2xl border border-white/5">
                   <div className="w-24 h-24 rounded-xl overflow-hidden shadow-lg">
                      {selectedPlaylist.image ? (
                          <img src={selectedPlaylist.image} className="w-full h-full object-cover" />
                      ) : (
                          <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                              <Music className="w-8 h-8 text-white" />
                          </div>
                      )}
                   </div>
                   <div className="flex-1 justify-center flex flex-col">
                      <h3 className="text-xl font-bold text-white mb-1">{selectedPlaylist.name}</h3>
                      <p className="text-white/60 text-sm flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        {selectedPlaylist.owner}
                      </p>
                   </div>
                </div>

                {tracks.map((track, index) => (
                  <motion.div
                    key={`${track.title}-${index}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="group flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-all cursor-pointer"
                    onClick={() => handlePlayTrack(track, index)}
                  >
                    <div className="relative">
                      {track.album.image ? (
                        <img
                          src={track.album.image}
                          alt={track.album.title}
                          className="w-12 h-12 rounded-lg object-cover shadow-sm group-hover:opacity-80 transition-opacity"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-sm">
                          <Music className="w-5 h-5 text-white" />
                        </div>
                      )}
                       <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                            {loadingVideoId === track.title ? (
                                <Loader2 className="w-4 h-4 text-white animate-spin" />
                            ) : (
                                <Play className="w-4 h-4 text-white fill-white" />
                            )}
                         </div>
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate group-hover:text-white transition-colors">
                        {track.title}
                      </p>
                      <p className="text-white/50 text-xs truncate">
                        {track.artists}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {searchTab === "user" && !selectedUserPlaylist && userPlaylists.length === 0 && (searchQuery.trim() || selectedTags.size > 0) && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 ring-1 ring-white/10">
                  <Search className="w-7 h-7 text-white/30" />
                </div>
                <h3 className="text-white font-bold text-base mb-2">검색 결과가 없습니다</h3>
                <p className="text-white/40 text-sm mb-4">
                  다른 검색어나 태그를 시도해보세요
                </p>
                {selectedTags.size > 0 && (
                  <button
                    onClick={() => setSelectedTags(new Set())}
                    className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white/60 hover:text-white transition-all"
                  >
                    태그 필터 초기화
                  </button>
                )}
              </div>
            )}

            {/* Empty State */}
            {!loading && !selectedPlaylist && !selectedUserPlaylist && playlists.length === 0 && userPlaylistPosts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 ring-1 ring-white/10 shadow-lg">
                  <Music className="w-8 h-8 text-white/20" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">음악을 발견해보세요</h3>
                <p className="text-white/40 text-sm max-w-xs leading-relaxed">
                  원하는 플레이리스트를 검색하고<br/>
                  새로운 음악 여행을 시작하세요
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
