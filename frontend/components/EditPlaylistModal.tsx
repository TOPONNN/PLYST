import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus, Music2, Tag, Camera, Check, Sparkles, Loader2, Trash2, Search } from "lucide-react";
import { Input } from "./ui/input";
import { searchCoverImages, ImageSearchResult, addTrackToPlaylist, removeTrackFromPlaylist, searchTracks, TrackInfo as ApiTrackInfo } from "../services/api";
import { compressImage, compressImageUrl } from "../utils/imageUtils";

interface TrackItem {
  id: number;
  title: string;
  artist: string;
  albumImage?: string;
  duration: string;
  durationSec?: number;
}

interface EditPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    description: string;
    tags: string[];
    coverImage?: string;
  }) => void;
  onTracksChange?: () => void; // 트랙 변경 시 호출
  playlist: {
    id: number;
    title: string;
    description: string;
    tags: string[];
    coverImage?: string;
    tracks?: TrackItem[];
  } | null;
}

export default function EditPlaylistModal({
  isOpen,
  onClose,
  onSave,
  onTracksChange,
  playlist,
}: EditPlaylistModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [coverImage, setCoverImage] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  
  // 트랙 관리 관련 상태
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [showTrackSearch, setShowTrackSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ApiTrackInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [imageSearchKeyword, setImageSearchKeyword] = useState("");
  const [imageSearchResults, setImageSearchResults] = useState<ImageSearchResult[]>([]);
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [translatedKeyword, setTranslatedKeyword] = useState("");
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());

  // 플레이리스트 정보가 바뀌면 상태 초기화
  useEffect(() => {
    if (playlist) {
      setTitle(playlist.title);
      setDescription(playlist.description);
      setTags(playlist.tags || []);
      setCoverImage(playlist.coverImage);
      setTracks(playlist.tracks || []);
      setImageSearchKeyword("");
      setImageSearchResults([]);
      setTranslatedKeyword("");
      setFailedImageIds(new Set());
      setShowTrackSearch(false);
      setSearchQuery("");
    }
  }, [playlist]);

  // 트랙 검색
  const handleSearchTracks = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchTracks(searchQuery, 10);
      setSearchResults(results);
    } catch (error) {
      console.error("트랙 검색 오류:", error);
    } finally {
      setIsSearching(false);
    }
  };

  // 트랙 추가
  const handleAddTrack = async (trackInfo: ApiTrackInfo) => {
    if (!playlist) return;
    
    const userId = Number(localStorage.getItem("userId"));
    const durationSec = Math.floor(trackInfo.duration / 1000); // duration은 밀리초
    
    const result = await addTrackToPlaylist(playlist.id, userId, {
      title: trackInfo.title,
      artist: trackInfo.artist,
      albumName: trackInfo.album,
      albumImage: trackInfo.albumImage,
      durationSec: durationSec
    });
    
    if (result) {
      const newTrack: TrackItem = {
        id: result.id,
        title: result.title,
        artist: result.artist,
        albumImage: result.albumImage,
        duration: `${Math.floor(result.durationSec / 60)}:${String(result.durationSec % 60).padStart(2, '0')}`,
        durationSec: result.durationSec
      };
      setTracks([...tracks, newTrack]);
      setShowTrackSearch(false);
      setSearchQuery("");
      setSearchResults([]);
      onTracksChange?.();
    } else {
      alert("트랙 추가에 실패했습니다.");
    }
  };

  // 트랙 삭제
  const handleRemoveTrack = async (trackId: number) => {
    if (!playlist) return;
    if (!confirm("이 곡을 삭제하시겠습니까?")) return;
    
    const userId = Number(localStorage.getItem("userId"));
    const success = await removeTrackFromPlaylist(playlist.id, trackId, userId);
    
    if (success) {
      setTracks(tracks.filter(t => t.id !== trackId));
      onTracksChange?.();
    } else {
      alert("곡 삭제에 실패했습니다.");
    }
  };



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

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
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

  const handleSave = async () => {
    if (!title.trim()) {
      alert("플레이리스트 제목을 입력해주세요.");
      return;
    }
    
    setIsSaving(true);
    try {
      onSave({
        title: title.trim(),
        description: description.trim(),
        tags,
        coverImage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setTitle("");
    setDescription("");
    setTags([]);
    setTagInput("");
    setCoverImage(undefined);
    setTracks([]);
    setShowTrackSearch(false);
    setSearchQuery("");
    setSearchResults([]);
    setImageSearchKeyword("");
    setImageSearchResults([]);
    setTranslatedKeyword("");
    setFailedImageIds(new Set());
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && playlist && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-3xl max-h-[85vh] overflow-hidden backdrop-blur-sm bg-gradient-to-br from-slate-800/95 to-slate-900/95 border border-sky-300/30 rounded-3xl shadow-2xl shadow-sky-500/10"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-8 border-b border-sky-300/20">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-sky-400/30 to-cyan-400/30 rounded-2xl">
                  <Music2 className="w-8 h-8 text-sky-200" />
                </div>
                <h2 className="text-white text-2xl font-bold">플레이리스트 수정</h2>
              </div>
              <button
                onClick={handleClose}
                className="p-3 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-7 h-7 text-white/70" />
              </button>
            </div>

            {/* Content */}
            <div className="p-8 overflow-y-auto max-h-[55vh] custom-scrollbar space-y-8">
              {/* Cover Image */}
              <div>
                <label className="block text-white/80 text-lg font-medium mb-4">앨범 커버</label>
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
                  <div className="text-white/60 text-base">
                    <p>권장 크기: 300x300px</p>
                    <p>최대 파일 크기: 5MB</p>
                    <p>지원 형식: JPG, PNG, GIF</p>
                  </div>
                </div>
                
                {/* AI 이미지 검색 */}
                <div className="mt-6 p-4 bg-white/5 border border-white/10 rounded-xl">
                  <label className="block text-white/80 text-base font-medium mb-3 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-sky-300" />
                    AI 이미지 검색 (한글 키워드)
                  </label>
                  <div className="flex gap-3">
                    <Input
                      type="text"
                      placeholder="예: 여름 바다, 밤하늘, 감성..."
                      value={imageSearchKeyword}
                      onChange={(e) => setImageSearchKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearchImages())}
                      className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40 text-lg py-3 px-4 rounded-xl"
                    />
                    <button
                      onClick={handleSearchImages}
                      disabled={isSearchingImages || !imageSearchKeyword.trim()}
                      className="px-5 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-xl text-white font-medium transition-colors shadow-lg shadow-purple-500/20 flex items-center gap-2 disabled:opacity-50"
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
                    <p className="mt-2 text-white/50 text-sm">
                      번역된 키워드: <span className="text-sky-300">{translatedKeyword}</span>
                    </p>
                  )}
                  
                  {imageSearchResults.filter(img => !failedImageIds.has(img.id)).length > 0 && (
                    <div className="mt-4">
                      <p className="text-white/60 text-sm mb-2">이미지를 클릭하여 선택하세요:</p>
                      <div className="grid grid-cols-5 gap-3">
                        {imageSearchResults
                          .filter(img => !failedImageIds.has(img.id))
                          .slice(0, 5)
                          .map((img) => (
                          <button
                            key={img.id}
                            onClick={() => handleSelectSearchedImage(img.webformatUrl)}
                            className="relative group aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-sky-400 transition-all"
                          >
                            <img
                              src={img.previewUrl}
                              alt={img.tags}
                              className="w-full h-full object-cover"
                              onError={() => handleImageError(img.id)}
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Check className="w-8 h-8 text-white" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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
                <label className="block text-white/80 text-lg font-medium mb-3">태그</label>
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
                          <X className="w-4 h-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Track Management */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-white/80 text-lg font-medium">곡 목록 ({tracks.length}곡)</label>
                  <button
                    onClick={() => setShowTrackSearch(!showTrackSearch)}
                    className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    곡 추가
                  </button>
                </div>

                {/* Track Search */}
                <AnimatePresence>
                  {showTrackSearch && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mb-4 overflow-hidden"
                    >
                      <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                        <div className="flex gap-3 mb-3">
                          <Input
                            type="text"
                            placeholder="곡 제목 또는 아티스트 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSearchTracks()}
                            className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40"
                          />
                          <button
                            onClick={handleSearchTracks}
                            disabled={isSearching}
                            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg text-white transition-colors flex items-center gap-2"
                          >
                            {isSearching ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Search className="w-4 h-4" />
                            )}
                            검색
                          </button>
                        </div>
                        
                        {/* Search Results */}
                        {searchResults.length > 0 && (
                          <div className="max-h-48 overflow-y-auto space-y-2">
                            {searchResults.map((track, idx) => (
                              <div
                                key={`${track.title}-${track.artist}-${idx}`}
                                onClick={() => handleAddTrack(track)}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
                              >
                                <img
                                  src={track.albumImage}
                                  alt={track.title}
                                  className="w-10 h-10 rounded object-cover"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-sm truncate">{track.title}</p>
                                  <p className="text-white/60 text-xs truncate">
                                    {track.artist}
                                  </p>
                                </div>
                                <Plus className="w-5 h-5 text-green-400" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Track List */}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {tracks.length === 0 ? (
                    <div className="text-center py-8 text-white/40">
                      <Music2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>아직 추가된 곡이 없습니다</p>
                      <p className="text-sm">위의 "곡 추가" 버튼을 눌러 곡을 추가하세요</p>
                    </div>
                  ) : (
                    tracks.map((track, idx) => (
                      <div
                        key={track.id}
                        className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors group"
                      >
                        <span className="text-white/40 text-sm w-6 text-center">{idx + 1}</span>
                        {track.albumImage ? (
                          <img
                            src={track.albumImage}
                            alt={track.title}
                            className="w-10 h-10 rounded object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-purple-500/30 rounded flex items-center justify-center">
                            <Music2 className="w-5 h-5 text-purple-300" />
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm truncate">{track.title}</p>
                          <p className="text-white/60 text-xs truncate">{track.artist}</p>
                        </div>
                        <span className="text-white/40 text-xs">{track.duration}</span>
                        <button
                          onClick={() => handleRemoveTrack(track.id)}
                          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-8 border-t border-white/10">
              <p className="text-white/60 text-lg">
                {tracks.length}곡 · {tags.length}개 태그
              </p>
              <div className="flex gap-4">
                <button
                  onClick={handleClose}
                  className="px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white text-lg font-medium transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-8 py-4 bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-500 hover:to-cyan-500 rounded-xl text-white text-lg font-bold transition-colors shadow-lg shadow-sky-500/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>저장 중...</>
                  ) : (
                    <>
                      <Check className="w-6 h-6" />
                      저장
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
