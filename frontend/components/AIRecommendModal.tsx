import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Sparkles, Tag, Plus, Check, Music2, Loader2, AlertCircle } from "lucide-react";
import { Input } from "./ui/input";
import { getAIRecommendation, AIRecommendedPlaylist } from "../services/api";

interface RecommendedPlaylist {
  id: string;
  title: string;
  description: string;
  coverGradient: string;
  coverImage?: string;
  trackCount: number;
  tags: string[];
  tracks: {
    title: string;
    artist: string;
    duration: string;
    albumImage?: string;
  }[];
}

interface AIRecommendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlaylist: (playlist: RecommendedPlaylist) => void;
}

// 인기 태그 목록
const popularTags = [
  "비", "새벽", "감성", "운동", "공부", "드라이브", "카페", 
  "발라드", "힙합", "R&B", "팝", "재즈", "EDM", "피아노",
  "로맨틱", "신나는", "잔잔한", "힐링", "파티", "여행"
];

export default function AIRecommendModal({
  isOpen,
  onClose,
  onSelectPlaylist,
}: AIRecommendModalProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<RecommendedPlaylist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<RecommendedPlaylist | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAddTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleSearch = async () => {
    if (tags.length === 0) return;
    
    setIsSearching(true);
    setHasSearched(true);
    setSelectedPlaylist(null);
    setErrorMessage(null);
    
    try {
      const response = await getAIRecommendation(tags);
      
      if (response.playlists && response.playlists.length > 0) {
        // API 응답을 RecommendedPlaylist 형식으로 변환
        const playlists: RecommendedPlaylist[] = response.playlists.map((p: AIRecommendedPlaylist) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          coverGradient: p.coverGradient,
          coverImage: p.coverImage,
          trackCount: p.trackCount || p.tracks.length,
          tags: p.tags,
          tracks: p.tracks.map(t => ({
            title: t.title,
            artist: t.artist,
            duration: t.duration,
            albumImage: t.albumImage
          }))
        }));
        setSearchResults(playlists);
        
        if (!response.success && response.message) {
          setErrorMessage(response.message);
        }
      } else {
        setSearchResults([]);
        setErrorMessage(response.message || "추천 결과가 없습니다.");
      }
    } catch (error) {
      console.error("AI 추천 오류:", error);
      setSearchResults([]);
      setErrorMessage("AI 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectPlaylist = (playlist: RecommendedPlaylist) => {
    setSelectedPlaylist(playlist);
  };

  const handleConfirmSelection = () => {
    if (selectedPlaylist) {
      onSelectPlaylist(selectedPlaylist);
      handleClose();
    }
  };

  const handleClose = () => {
    setTags([]);
    setTagInput("");
    setSearchResults([]);
    setSelectedPlaylist(null);
    setHasSearched(false);
    setErrorMessage(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-3xl backdrop-blur-sm bg-gradient-to-br from-slate-800/95 to-slate-900/95 border border-violet-300/30 shadow-2xl shadow-violet-500/10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-violet-300/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-violet-400/30 to-fuchsia-400/30 rounded-xl">
                  <Sparkles className="w-6 h-6 text-violet-200" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">AI 추천 플레이리스트</h2>
                  <p className="text-violet-200/70 text-sm">태그를 입력하면 AI가 맞춤 플레이리스트를 추천해드려요</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-white/70" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(85vh-180px)] custom-scrollbar">
            {/* Tag Input Section */}
            <div className="mb-6">
              <label className="text-white/90 text-sm font-medium mb-2 flex items-center gap-2">
                <Tag className="w-4 h-4" />
                태그 입력
              </label>
              <div className="flex gap-2 mb-3">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag(tagInput);
                    }
                  }}
                  placeholder="원하는 분위기나 장르를 입력하세요"
                  className="flex-1 bg-white/10 border-violet-400/30 text-white placeholder:text-violet-200/50"
                />
                <button
                  onClick={() => handleAddTag(tagInput)}
                  className="px-4 py-2 bg-gradient-to-r from-violet-400/30 to-fuchsia-400/30 hover:from-violet-400/50 hover:to-fuchsia-400/50 border border-violet-300/30 rounded-xl text-white transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* Selected Tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-violet-400/40 to-fuchsia-400/40 border border-violet-300/40 rounded-full text-sm text-white backdrop-blur-sm"
                    >
                      #{tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="p-0.5 hover:bg-white/20 rounded-full transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Popular Tags */}
              <div className="mt-4">
                <p className="text-violet-200/70 text-xs mb-2">인기 태그</p>
                <div className="flex flex-wrap gap-2">
                  {popularTags.slice(0, 12).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => handleAddTag(tag)}
                      disabled={tags.includes(tag)}
                      className={`px-3 py-1 rounded-full text-xs transition-colors ${
                        tags.includes(tag)
                          ? "bg-violet-400/50 text-violet-100 cursor-not-allowed"
                          : "bg-white/10 hover:bg-white/20 text-white/80 hover:text-white"
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Search Button */}
            <button
              onClick={handleSearch}
              disabled={tags.length === 0 || isSearching}
              className="w-full py-3 bg-gradient-to-r from-violet-400 to-fuchsia-400 hover:from-violet-500 hover:to-fuchsia-500 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed rounded-xl text-white font-medium flex items-center justify-center gap-2 transition-all mb-6 shadow-lg shadow-violet-500/20"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  ChatGPT가 분석 중... (최대 30초 소요)
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  AI 플레이리스트 추천받기
                </>
              )}
            </button>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-400/30 rounded-xl flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-yellow-200 text-sm">{errorMessage}</p>
              </div>
            )}

            {/* Search Results */}
            {hasSearched && !isSearching && (
              <div className="space-y-3">
                <h3 className="text-white font-medium flex items-center gap-2">
                  <Music2 className="w-4 h-4" />
                  추천 플레이리스트 ({searchResults.length}개)
                </h3>
                
                {searchResults.length === 0 ? (
                  <div className="text-center py-8 text-purple-200/70">
                    <p>입력한 태그와 일치하는 플레이리스트가 없습니다.</p>
                    <p className="text-sm mt-1">다른 태그로 검색해보세요!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {searchResults.map((playlist) => (
                      <motion.div
                        key={playlist.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                          selectedPlaylist?.id === playlist.id
                            ? "bg-purple-500/30 border-purple-400/50"
                            : "bg-white/5 border-white/10 hover:bg-white/10"
                        }`}
                        onClick={() => handleSelectPlaylist(playlist)}
                      >
                        <div className="flex items-start gap-4">
                          {/* Playlist Cover */}
                          {playlist.coverImage ? (
                            <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                              <img 
                                src={playlist.coverImage} 
                                alt={playlist.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div
                              className={`w-16 h-16 rounded-xl bg-gradient-to-br ${playlist.coverGradient} flex items-center justify-center flex-shrink-0`}
                            >
                              <Music2 className="w-8 h-8 text-white/80" />
                            </div>
                          )}

                          {/* Playlist Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-white font-medium truncate">{playlist.title}</h4>
                              {selectedPlaylist?.id === playlist.id && (
                                <div className="p-1 bg-purple-500 rounded-full">
                                  <Check className="w-3 h-3 text-white" />
                                </div>
                              )}
                            </div>
                            <p className="text-purple-200/70 text-sm line-clamp-1 mt-0.5">
                              {playlist.description}
                            </p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <span className="text-purple-200/50 text-xs">
                                {playlist.trackCount}곡
                              </span>
                              <span className="text-purple-200/30">•</span>
                              {playlist.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-0.5 bg-purple-500/20 rounded-full text-xs text-purple-200/70"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Track Preview */}
                        {selectedPlaylist?.id === playlist.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="mt-4 pt-4 border-t border-purple-400/20"
                          >
                            <p className="text-purple-200/70 text-xs mb-2">수록곡 전체 보기 ({playlist.tracks.length}곡)</p>
                            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                              {playlist.tracks.map((track, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-sm py-1"
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="text-purple-300/50 w-4 text-xs">{idx + 1}</span>
                                    {track.albumImage ? (
                                      <img 
                                        src={track.albumImage} 
                                        alt={track.title}
                                        className="w-8 h-8 rounded object-cover"
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded bg-purple-500/30 flex items-center justify-center">
                                        <Music2 className="w-4 h-4 text-purple-300/50" />
                                      </div>
                                    )}
                                    <div className="flex flex-col">
                                      <span className="text-white/90 text-sm">{track.title}</span>
                                      <span className="text-purple-200/50 text-xs">{track.artist}</span>
                                    </div>
                                  </div>
                                  <span className="text-purple-200/50 text-xs">{track.duration}</span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-violet-300/20 flex justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleConfirmSelection}
              disabled={!selectedPlaylist}
              className="px-5 py-2.5 bg-gradient-to-r from-violet-400 to-fuchsia-400 hover:from-violet-500 hover:to-fuchsia-500 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed rounded-xl text-white font-medium flex items-center gap-2 transition-all shadow-lg shadow-violet-500/20"
            >
              <Plus className="w-4 h-4" />
              플레이리스트 추가
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
