import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus, Search, Music2, Trash2, Loader2, Tag, Camera, Sparkles, Globe, Lock } from "lucide-react";
import { Input } from "./ui/input";
import { searchTracks, searchCoverImages, ImageSearchResult } from "../services/api";
import { compressImage, compressImageUrl } from "../utils/imageUtils";

interface Track {
  id: string;
  title: string;
  artist: string;
  albumImage?: string;
  duration?: string;
}

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (playlist: {
    title: string;
    description: string;
    tags: string[];
    tracks: Track[];
    coverImage?: string;
    isPublic: boolean;
  }) => void;
}

export default function CreatePlaylistModal({
  isOpen,
  onClose,
  onCreate,
}: CreatePlaylistModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "tracks">("info");
  const [coverImage, setCoverImage] = useState<string | undefined>(undefined);
  const [isPublic, setIsPublic] = useState(true);
  
  const [imageSearchKeyword, setImageSearchKeyword] = useState("");
  const [imageSearchResults, setImageSearchResults] = useState<ImageSearchResult[]>([]);
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [translatedKeyword, setTranslatedKeyword] = useState("");
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());

  // AI 이미지 검색
  const handleSearchImages = async () => {
    if (!imageSearchKeyword.trim()) {
      alert("검색할 키워드를 입력해주세요.");
      return;
    }
    
    setIsSearchingImages(true);
    setFailedImageIds(new Set());
    try {
      const result = await searchCoverImages(imageSearchKeyword, 8);
      setImageSearchResults(result.images);
      setTranslatedKeyword(result.translatedKeyword);
    } catch (error) {
      console.error("이미지 검색 오류:", error);
      alert("이미지 검색에 실패했습니다.");
    } finally {
      setIsSearchingImages(false);
    }
  };

  const handleImageError = (imageId: string) => {
    setFailedImageIds(prev => new Set(prev).add(imageId));
  };

  const handleSelectSearchedImage = async (imageUrl: string) => {
    try {
      const compressed = await compressImageUrl(imageUrl);
      setCoverImage(compressed);
    } catch (error) {
      console.error('이미지 압축 오류:', error);
      setCoverImage(imageUrl);
    }
    setImageSearchResults([]);
    setImageSearchKeyword("");
    setTranslatedKeyword("");
  };

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드할 수 있습니다.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('파일 크기는 5MB 이하로 제한됩니다.');
        return;
      }
      try {
        const compressed = await compressImage(file);
        setCoverImage(compressed);
      } catch (error) {
        console.error('이미지 압축 오류:', error);
        alert('이미지 처리에 실패했습니다.');
      }
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleSearchTracks = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const results = await searchTracks(searchQuery, 15);
      
      if (results && results.length > 0) {
        setSearchResults(
          results.map((info, index) => ({
            id: `${Date.now()}-${index}`,
            title: info.title,
            artist: info.artist,
            albumImage: info.albumImage,
            duration: info.duration ? formatDuration(info.duration) : "3:30",
          }))
        );
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("검색 오류:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleAddTrack = (track: Track) => {
    if (!tracks.find((t) => t.id === track.id)) {
      setTracks([...tracks, track]);
    }
    setSearchResults([]);
    setSearchQuery("");
    setSelectedTracks(new Set());
  };

  const handleToggleSelect = (trackId: string) => {
    setSelectedTracks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(trackId)) {
        newSet.delete(trackId);
      } else {
        newSet.add(trackId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedTracks.size === searchResults.length) {
      setSelectedTracks(new Set());
    } else {
      setSelectedTracks(new Set(searchResults.map(t => t.id)));
    }
  };

  const handleAddSelectedTracks = () => {
    const tracksToAdd = searchResults.filter(t => selectedTracks.has(t.id));
    const newTracks = tracksToAdd.filter(t => !tracks.find(existing => existing.id === t.id));
    setTracks([...tracks, ...newTracks]);
    setSearchResults([]);
    setSearchQuery("");
    setSelectedTracks(new Set());
  };

  const handleRemoveTrack = (trackId: string) => {
    setTracks(tracks.filter((t) => t.id !== trackId));
  };

  const handleCreate = () => {
    if (!title.trim()) {
      alert("플레이리스트 제목을 입력해주세요.");
      return;
    }
    if (tags.length === 0) {
      alert("최소 1개 이상의 태그를 입력해주세요.");
      return;
    }
    if (!coverImage) {
      alert("앨범 커버 이미지를 업로드해주세요.");
      return;
    }
    
    onCreate({
      title: title.trim(),
      description: description.trim(),
      tags,
      tracks,
      coverImage,
      isPublic,
    });
    
    setTitle("");
    setDescription("");
    setTags([]);
    setTracks([]);
    setSearchQuery("");
    setSearchResults([]);
    setCoverImage(undefined);
    setIsPublic(true);
    onClose();
  };

  const handleClose = () => {
    setTitle("");
    setDescription("");
    setTags([]);
    setTracks([]);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedTracks(new Set());
    setActiveTab("info");
    setCoverImage(undefined);
    setIsPublic(true);
    setImageSearchKeyword("");
    setImageSearchResults([]);
    setTranslatedKeyword("");
    setFailedImageIds(new Set());
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden backdrop-blur-sm bg-gradient-to-br from-slate-800/95 to-slate-900/95 border border-sky-300/30 rounded-3xl shadow-2xl shadow-sky-500/10"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-8 border-b border-sky-300/20">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-sky-400/30 to-cyan-400/30 rounded-2xl">
                  <Music2 className="w-8 h-8 text-sky-200" />
                </div>
                <h2 className="text-white text-2xl font-bold">플레이리스트 만들기</h2>
              </div>
              <button
                onClick={handleClose}
                className="p-3 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-7 h-7 text-white/70" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-3 p-6 border-b border-white/10">
              <button
                onClick={() => setActiveTab("info")}
                className={`px-6 py-3 rounded-xl text-lg font-medium transition-all ${
                  activeTab === "info"
                    ? "bg-white/20 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                기본 정보
              </button>
              <button
                onClick={() => setActiveTab("tracks")}
                className={`px-6 py-3 rounded-xl text-lg font-medium transition-all ${
                  activeTab === "tracks"
                    ? "bg-white/20 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                곡 추가 ({tracks.length})
              </button>
            </div>

            {/* Content */}
            <div className="p-8 overflow-y-auto max-h-[50vh] custom-scrollbar">
              {activeTab === "info" ? (
                <div className="space-y-8">
                  {/* Cover Image */}
                  <div>
                    <label className="block text-white/80 text-lg font-medium mb-4">앨범 커버 *</label>
                    <div className="flex items-center gap-6">
                      <div className="relative">
                        {coverImage ? (
                          <img 
                            src={coverImage} 
                            alt="커버" 
                            className="w-40 h-40 rounded-2xl object-cover shadow-lg border-2 border-white/20"
                          />
                        ) : (
                          <div className="w-40 h-40 bg-gradient-to-br from-sky-400/30 to-cyan-400/30 rounded-2xl flex items-center justify-center border-2 border-dashed border-white/30">
                            <Music2 className="w-16 h-16 text-white/40" />
                          </div>
                        )}
                        <label className="absolute bottom-2 right-2 w-12 h-12 bg-gradient-to-br from-sky-400 to-cyan-400 hover:from-sky-500 hover:to-cyan-500 border border-sky-300/50 rounded-full flex items-center justify-center cursor-pointer transition-colors shadow-lg shadow-sky-400/20">
                          <Camera className="w-6 h-6 text-white" />
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleCoverImageUpload}
                            className="hidden" 
                          />
                        </label>
                      </div>
                      <div className="flex-1 space-y-4">
                        <div className="text-white/60 text-base">
                          <p className="text-red-300 mb-2">* 필수 항목</p>
                          <p>직접 업로드하거나 AI로 이미지를 검색하세요</p>
                        </div>
                        
                        {/* AI 이미지 검색 */}
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <Input
                              type="text"
                              placeholder="한글 키워드 (예: 새벽, 카페, 비)"
                              value={imageSearchKeyword}
                              onChange={(e) => setImageSearchKeyword(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearchImages())}
                              className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40 py-3 px-4 rounded-xl"
                            />
                            <button
                              onClick={handleSearchImages}
                              disabled={isSearchingImages}
                              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-xl text-white font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                              {isSearchingImages ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (
                                <Sparkles className="w-5 h-5" />
                              )}
                              AI 검색
                            </button>
                          </div>
                          
                          {/* 번역된 키워드 표시 */}
                          {translatedKeyword && (
                            <p className="text-white/50 text-sm">
                              번역: <span className="text-sky-300">{translatedKeyword}</span>
                            </p>
                          )}
                          
                          {imageSearchResults.filter(img => !failedImageIds.has(img.id)).length > 0 && (
                            <div className="grid grid-cols-5 gap-2">
                              {imageSearchResults
                                .filter(img => !failedImageIds.has(img.id))
                                .slice(0, 5)
                                .map((img) => (
                                <button
                                  key={img.id}
                                  onClick={() => handleSelectSearchedImage(img.webformatUrl)}
                                  className="relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-sky-400 transition-all group"
                                >
                                  <img 
                                    src={img.previewUrl} 
                                    alt={img.tags}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                    onError={() => handleImageError(img.id)}
                                  />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                    <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-medium">선택</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block text-white/80 text-lg font-medium mb-3">제목 *</label>
                    <Input
                      type="text"
                      placeholder="플레이리스트 제목을 입력하세요"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40 text-lg py-4 px-5 rounded-xl"
                    />
                  </div>

                  {/* Public/Private Toggle */}
                  <div>
                    <label className="block text-white/80 text-lg font-medium mb-3">공개 설정</label>
                    <button
                      type="button"
                      onClick={() => setIsPublic(!isPublic)}
                      className={`flex items-center gap-3 px-5 py-3 rounded-xl border transition-all ${
                        isPublic 
                          ? 'bg-green-500/20 border-green-400/50 text-green-300' 
                          : 'bg-yellow-500/20 border-yellow-400/50 text-yellow-300'
                      }`}
                    >
                      {isPublic ? (
                        <>
                          <Globe className="w-5 h-5" />
                          <span>공개</span>
                          <span className="text-white/50 text-sm ml-2">- 모든 사용자가 볼 수 있습니다</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-5 h-5" />
                          <span>비공개</span>
                          <span className="text-white/50 text-sm ml-2">- 나만 볼 수 있습니다</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-white/80 text-lg font-medium mb-3">설명</label>
                    <textarea
                      placeholder="플레이리스트에 대한 설명을 입력하세요"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      className="w-full px-5 py-4 bg-white/10 border border-white/20 rounded-xl text-white text-lg placeholder:text-white/40 resize-none focus:outline-none focus:border-white/40 transition-colors"
                    />
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-white/80 text-lg font-medium mb-3">태그 * (최소 1개)</label>
                    <div className="flex gap-3">
                      <Input
                        type="text"
                        placeholder="태그 입력 (예: 감성, 드라이브)"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                        className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40 text-lg py-4 px-5 rounded-xl"
                      />
                      <button
                        onClick={handleAddTag}
                        className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white transition-colors"
                      >
                        <Plus className="w-6 h-6" />
                      </button>
                    </div>
                    
                    {/* Tag List */}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-3 mt-4">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-400/30 to-cyan-400/30 border border-sky-300/40 rounded-full text-sky-200 text-base backdrop-blur-sm"
                          >
                            <Tag className="w-4 h-4" />
                            {tag}
                            <button
                              onClick={() => handleRemoveTag(tag)}
                              className="ml-1 hover:text-white transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Search */}
                  <div>
                    <label className="block text-white/70 text-sm mb-2">곡 검색</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                        <Input
                          type="text"
                          placeholder="곡 제목 또는 '제목 - 아티스트' 형식으로 검색"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSearchTracks()}
                          className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40"
                        />
                      </div>
                      <button
                        onClick={handleSearchTracks}
                        disabled={isSearching}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white transition-colors disabled:opacity-50"
                      >
                        {isSearching ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Search className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-white/60 text-sm">검색 결과 ({searchResults.length}곡)</p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSelectAll}
                            className="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white/70 transition-colors backdrop-blur-sm"
                          >
                            {selectedTracks.size === searchResults.length ? "선택 해제" : "전체 선택"}
                          </button>
                          {selectedTracks.size > 0 && (
                            <button
                              onClick={handleAddSelectedTracks}
                              className="px-4 py-2 text-sm bg-gradient-to-r from-sky-400/40 to-cyan-400/40 hover:from-sky-400/60 hover:to-cyan-400/60 border border-sky-300/50 rounded-xl text-sky-100 transition-all backdrop-blur-sm shadow-lg shadow-sky-400/10"
                            >
                              {selectedTracks.size}곡 추가
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar">
                        {searchResults.map((track) => (
                          <div
                            key={track.id}
                            className={`flex items-center gap-3 p-3 border rounded-xl transition-colors cursor-pointer ${
                              selectedTracks.has(track.id)
                                ? "bg-gradient-to-r from-sky-400/20 to-cyan-400/20 border-sky-300/50"
                                : "bg-white/5 border-white/10 hover:bg-white/10"
                            }`}
                            onClick={() => handleToggleSelect(track.id)}
                          >
                            {/* Checkbox */}
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              selectedTracks.has(track.id)
                                ? "bg-gradient-to-br from-sky-400 to-cyan-400 border-sky-400"
                                : "border-white/30"
                            }`}>
                              {selectedTracks.has(track.id) && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            {track.albumImage ? (
                              <img
                                src={track.albumImage}
                                alt={track.title}
                                className="w-10 h-10 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-cyan-400 rounded-lg" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm truncate">{track.title}</p>
                              <p className="text-white/50 text-xs truncate">{track.artist}</p>
                            </div>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddTrack(track);
                              }}
                              className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                            >
                              <Plus className="w-4 h-4 text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Added Tracks */}
                  <div>
                    <p className="text-white/60 text-sm mb-2">추가된 곡 ({tracks.length})</p>
                    {tracks.length === 0 ? (
                      <div className="text-center py-8 text-white/40">
                        <Music2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>아직 추가된 곡이 없습니다</p>
                        <p className="text-sm mt-1">위에서 곡을 검색하여 추가하세요</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                        {tracks.map((track, index) => (
                          <div
                            key={track.id}
                            className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl"
                          >
                            <span className="w-6 text-white/40 text-sm text-center">
                              {index + 1}
                            </span>
                            {track.albumImage ? (
                              <img
                                src={track.albumImage}
                                alt={track.title}
                                className="w-10 h-10 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-cyan-400 rounded-lg" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm truncate">{track.title}</p>
                              <p className="text-white/50 text-xs truncate">{track.artist}</p>
                            </div>
                            <button
                              onClick={() => handleRemoveTrack(track.id)}
                              className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-8 border-t border-white/10">
              <div className="text-white/60 text-lg">
                <p>{tracks.length}곡 · {tags.length}개 태그</p>
                {(!coverImage || tags.length === 0) && (
                  <p className="text-red-300 text-sm mt-1">* 앨범 커버와 태그는 필수입니다</p>
                )}
              </div>
              <div className="flex gap-4">
                <button
                  onClick={handleClose}
                  className="px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white text-lg font-medium transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleCreate}
                  className="px-8 py-4 bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-500 hover:to-cyan-500 rounded-xl text-white text-lg font-bold transition-colors shadow-lg shadow-sky-500/20"
                >
                  만들기
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
