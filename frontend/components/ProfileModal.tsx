import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Edit3, LogOut, Music2, Heart, Users, UserPlus, Camera, Save, Loader2, ChevronLeft, ChevronRight, MessageCircle, Ban, UserX, Trash2, Globe, Lock } from "lucide-react";
import { getProfile, updateProfile, getUserPlaylists, getUserLikedPlaylistsSummary, getUserFollowers, getUserFollowing, getUserComments, getBlockStatus, blockUser, unblockUser, getBlockedUsers, BlockedUserResponse, deleteAccount, togglePlaylistVisibility } from "../services/api";
import { compressImage } from "../utils/imageUtils";

// URL 정규화 헬퍼 함수 (protocol-relative URL 처리)
const normalizeImageUrl = (url: string | undefined | null): string | null => {
  if (!url) return null;
  if (url.startsWith('//')) return `https:${url}`;
  return url;
};

// 이미지 URL인지 확인하는 헬퍼 함수
const isImageUrl = (url: string | undefined | null): boolean => {
  if (!url) return false;
  return url.startsWith('data:image') || url.startsWith('http') || url.startsWith('//');
};

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  userId: number;
  onPlaylistSelect?: (playlistId: number) => void;
  onProfileUpdate?: (avatar: string) => void;
}

interface UserProfile {
  nickname: string;
  bio: string;
  avatar: string;
  musicTags: string[];
  playlists: number;
  likedPlaylists: number;
  followers: number;
  following: number;
  comments: number;
}

interface PlaylistItem {
  id: number;
  title: string;
  description: string;
  coverImageUrl?: string;
  trackCount: number;
  likeCount: number;
  createdAt: string;
  isPublic?: boolean;
}

interface UserItem {
  id: number;
  nickname: string;
  avatar: string;
  bio?: string;
  musicTags?: string[];
  playlists?: number;
  followers?: number;
}

interface CommentItem {
  id: number;
  content: string;
  playlistId?: number;
  playlistTitle?: string;
  createdAt: string;
  likeCount: number;
}

type DetailViewType = "playlists" | "liked" | "followers" | "following" | "comments" | "blocked" | null;

const AVAILABLE_TAGS = [
  "재즈", "발라드", "EDM", "힙합", "R&B", "클래식", "록", "팝",
  "인디", "K-POP", "J-POP", "OST", "어쿠스틱", "일렉트로닉", "레트로"
];

export default function ProfileModal({ isOpen, onClose, onLogout, userId, onPlaylistSelect, onProfileUpdate }: ProfileModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [detailView, setDetailView] = useState<DetailViewType>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState<PlaylistItem[]>([]);
  const [likedPlaylists, setLikedPlaylists] = useState<PlaylistItem[]>([]);
  const [followers, setFollowers] = useState<UserItem[]>([]);
  const [following, setFollowing] = useState<UserItem[]>([]);
  const [userComments, setUserComments] = useState<CommentItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [enlargedAvatar, setEnlargedAvatar] = useState<{ url: string; name: string } | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserResponse[]>([]);
  const [isUserBlocked, setIsUserBlocked] = useState(false);
  const [isBlockingUser, setIsBlockingUser] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [togglingPlaylistId, setTogglingPlaylistId] = useState<number | null>(null);
  const [profile, setProfile] = useState<UserProfile>({
    nickname: "",
    bio: "",
    avatar: "🎧",
    musicTags: [],
    playlists: 0,
    likedPlaylists: 0,
    followers: 0,
    following: 0,
    comments: 0,
  });

  const [editForm, setEditForm] = useState({
    nickname: profile.nickname,
    bio: profile.bio,
    avatar: profile.avatar,
    musicTags: [...profile.musicTags],
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        const compressed = await compressImage(file, 200, 200, 0.8);
        setEditForm({ ...editForm, avatar: compressed });
      } catch (error) {
        console.error('이미지 압축 오류:', error);
        alert('이미지 처리에 실패했습니다.');
      }
    }
  };

  // 프로필 데이터 로드
  useEffect(() => {
    if (isOpen && userId) {
      loadProfile();
    }
    // 모달이 닫힐 때 상태 초기화
    if (!isOpen) {
      setEnlargedAvatar(null);
      setSelectedUser(null);
      setDetailView(null);
    }
  }, [isOpen, userId]);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const data = await getProfile(userId);
      if (data) {
        setProfile({
          nickname: data.nickname || "",
          bio: data.bio || "",
          avatar: data.avatar || "🎧",
          musicTags: data.musicTags || [],
          playlists: data.playlists || 0,
          likedPlaylists: data.likedPlaylists || 0,
          followers: data.followers || 0,
          following: data.following || 0,
          comments: data.comments || 0,
        });
        setEditForm({
          nickname: data.nickname || "",
          bio: data.bio || "",
          avatar: data.avatar || "🎧",
          musicTags: data.musicTags || [],
        });
      }
    } catch (error) {
      console.error('프로필 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await updateProfile(userId, {
        nickname: editForm.nickname,
        bio: editForm.bio,
        avatar: editForm.avatar,
        musicTags: editForm.musicTags,
      });
      
      if (response.success && response.profile) {
        setProfile({
          ...profile,
          nickname: response.profile.nickname,
          bio: response.profile.bio || "",
          avatar: response.profile.avatar || editForm.avatar,
          musicTags: response.profile.musicTags || [],
        });
        // localStorage에 닉네임 업데이트
        localStorage.setItem('userNickname', response.profile.nickname);
        // 프로필 아바타 업데이트 콜백 호출
        if (onProfileUpdate) {
          onProfileUpdate(response.profile.avatar || editForm.avatar);
        }
        setIsEditing(false);
      } else {
        alert(response.message);
      }
    } catch (error) {
      console.error('프로필 저장 오류:', error);
      alert('프로필 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditForm({
      nickname: profile.nickname,
      bio: profile.bio,
      avatar: profile.avatar,
      musicTags: [...profile.musicTags],
    });
    setIsEditing(false);
  };

  // 상세 정보 로드
  const loadDetailData = async (type: DetailViewType) => {
    if (!type) return;
    setDetailLoading(true);
    setDetailView(type);
    
    try {
      switch (type) {
        case "playlists":
          const playlists = await getUserPlaylists(userId);
          setUserPlaylists(playlists);
          break;
        case "liked":
          const liked = await getUserLikedPlaylistsSummary(userId);
          setLikedPlaylists(liked);
          break;
        case "followers":
          const followerList = await getUserFollowers(userId);
          setFollowers(followerList);
          break;
        case "following":
          const followingList = await getUserFollowing(userId);
          setFollowing(followingList);
          break;
        case "comments":
          const comments = await getUserComments(userId);
          setUserComments(comments.map(c => ({
            id: c.id,
            content: c.content,
            playlistId: c.playlistId,
            playlistTitle: c.playlistTitle,
            createdAt: c.createdAt,
            likeCount: c.likeCount || 0
          })));
          break;
      }
    } catch (error) {
      console.error('상세 정보 로드 오류:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  // 팔로워/팔로잉 유저 상세 정보 로드
  const loadUserProfile = async (user: UserItem) => {
    try {
      const profileData = await getProfile(user.id);
      if (profileData) {
        setSelectedUser({
          ...user,
          bio: profileData.bio,
          musicTags: profileData.musicTags,
          playlists: profileData.playlists,
          followers: profileData.followers
        });
      } else {
        setSelectedUser(user);
      }
    } catch (error) {
      console.error('유저 프로필 로드 오류:', error);
      setSelectedUser(user);
    }
  };

  const toggleTag = (tag: string) => {
    if (editForm.musicTags.includes(tag)) {
      setEditForm({
        ...editForm,
        musicTags: editForm.musicTags.filter(t => t !== tag),
      });
    } else if (editForm.musicTags.length < 5) {
      setEditForm({
        ...editForm,
        musicTags: [...editForm.musicTags, tag],
      });
    }
  };

  const checkBlockStatus = async (targetUserId: number) => {
    try {
      const status = await getBlockStatus(targetUserId, userId);
      setIsUserBlocked(status.isBlocked);
    } catch (error) {
      console.error('차단 상태 확인 오류:', error);
    }
  };

  const handleBlockUser = async () => {
    if (!selectedUser) return;
    
    const confirmed = window.confirm(
      `${selectedUser.nickname}님을 차단하시겠습니까?\n\n차단하면 해당 사용자의 플레이리스트와 댓글을 볼 수 없으며, 서로 팔로우할 수 없습니다.`
    );
    
    if (!confirmed) return;
    
    setIsBlockingUser(true);
    try {
      await blockUser(selectedUser.id, userId);
      setIsUserBlocked(true);
      alert('사용자를 차단했습니다.');
    } catch (error) {
      console.error('차단 오류:', error);
      alert('차단에 실패했습니다.');
    } finally {
      setIsBlockingUser(false);
    }
  };

  const handleUnblockUser = async (targetId?: number) => {
    const targetUserId = targetId || selectedUser?.id;
    if (!targetUserId) return;
    
    setIsBlockingUser(true);
    try {
      await unblockUser(targetUserId, userId);
      setIsUserBlocked(false);
      if (targetId) {
        setBlockedUsers(blockedUsers.filter(u => u.id !== targetId));
      }
    } catch (error) {
      console.error('차단 해제 오류:', error);
      alert('차단 해제에 실패했습니다.');
    } finally {
      setIsBlockingUser(false);
    }
  };

  const loadBlockedUsers = async () => {
    setDetailLoading(true);
    setDetailView("blocked");
    try {
      const users = await getBlockedUsers(userId);
      setBlockedUsers(users);
    } catch (error) {
      console.error('차단 목록 로드 오류:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleToggleVisibility = async (playlistId: number, currentIsPublic: boolean) => {
    setTogglingPlaylistId(playlistId);
    try {
      const result = await togglePlaylistVisibility(playlistId, userId);
      if (result) {
        setUserPlaylists(prev => prev.map(p => 
          p.id === playlistId ? { ...p, isPublic: !currentIsPublic } : p
        ));
      }
    } catch (error) {
      console.error('공개설정 변경 오류:', error);
      alert('공개설정 변경에 실패했습니다.');
    } finally {
      setTogglingPlaylistId(null);
    }
  };

  const isSocialLogin = () => {
    const provider = localStorage.getItem("userProvider");
    return provider === "google" || provider === "kakao";
  };

  const handleDeleteAccount = async () => {
    if (!isSocialLogin() && !deletePassword) {
      setDeleteError("비밀번호를 입력해주세요.");
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      const response = await deleteAccount({
        userId,
        password: isSocialLogin() ? undefined : deletePassword,
      });

      if (response.success) {
        localStorage.clear();
        sessionStorage.clear();
        alert("회원 탈퇴가 완료되었습니다.");
        onLogout();
      } else {
        setDeleteError(response.message);
      }
    } catch {
      setDeleteError("회원 탈퇴 중 오류가 발생했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (selectedUser && selectedUser.id !== userId) {
      checkBlockStatus(selectedUser.id);
    }
  }, [selectedUser]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
        style={{ willChange: 'opacity' }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70" style={{ willChange: 'auto' }} />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: (enlargedAvatar || selectedUser) ? 0 : 1, scale: (enlargedAvatar || selectedUser) ? 0.95 : 1, y: (enlargedAvatar || selectedUser) ? 10 : 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", damping: 30, stiffness: 400 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden bg-gradient-to-br from-gray-800/95 to-gray-900/95 border border-white/20 rounded-3xl shadow-2xl"
          style={{ willChange: 'transform, opacity', transform: 'translateZ(0)', visibility: (enlargedAvatar || selectedUser) ? 'hidden' : 'visible' }}
        >
          {/* Scrollable Content Container */}
          <div className="max-h-[90vh] overflow-y-auto custom-scrollbar">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-white/10 bg-gray-800/90 rounded-t-3xl">
            <h2 className="text-white text-xl font-bold">내 프로필</h2>
            <div className="flex items-center gap-2">
              {!isEditing && !isLoading && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <Edit3 className="w-5 h-5 text-white" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Profile Content */}
          <div className="p-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin mb-4" />
                <p className="text-white/70">프로필을 불러오는 중...</p>
              </div>
            ) : (
              <>
            {/* Avatar Section */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative">
                {isImageUrl(isEditing ? editForm.avatar : profile.avatar) ? (
                  <img 
                    src={normalizeImageUrl(isEditing ? editForm.avatar : profile.avatar) || ''} 
                    alt="프로필" 
                    className="w-28 h-28 rounded-full object-cover shadow-lg border-2 border-white/30 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => !isEditing && setEnlargedAvatar({ url: normalizeImageUrl(profile.avatar) || profile.avatar, name: profile.nickname })}
                  />
                ) : (
                  <div 
                    className="w-28 h-28 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-5xl shadow-lg cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => !isEditing && setEnlargedAvatar({ url: profile.avatar, name: profile.nickname })}
                  >
                    {isEditing ? editForm.avatar : profile.avatar}
                  </div>
                )}
                {isEditing && (
                  <label className="absolute bottom-0 right-0 w-9 h-9 bg-gradient-to-br from-sky-400 to-cyan-400 hover:from-sky-500 hover:to-cyan-500 border border-sky-300/50 rounded-full flex items-center justify-center cursor-pointer transition-colors shadow-lg shadow-sky-400/20">
                    <Camera className="w-4 h-4 text-white" />
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleAvatarUpload}
                      className="hidden" 
                    />
                  </label>
                )}
              </div>

              {/* Nickname */}
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.nickname}
                  onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                  className="mt-4 text-xl font-bold text-white bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-center focus:outline-none focus:border-purple-400"
                  placeholder="닉네임"
                />
              ) : (
                <h3 className="mt-4 text-xl font-bold text-white">{profile.nickname}</h3>
              )}

              {/* Bio */}
              {isEditing ? (
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  className="mt-2 w-full text-white/80 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-center focus:outline-none focus:border-purple-400 resize-none"
                  placeholder="한줄 소개"
                  rows={2}
                />
              ) : (
                <p className="mt-2 text-white/70 text-center">{profile.bio}</p>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-5 gap-2 mb-6">
              <button 
                onClick={() => loadDetailData("playlists")}
                className="bg-white/10 hover:bg-white/20 rounded-xl p-3 text-center transition-colors"
              >
                <div className="flex items-center justify-center mb-1">
                  <Music2 className="w-4 h-4 text-purple-400" />
                </div>
                <p className="text-white font-bold">{profile.playlists}</p>
                <p className="text-white/50 text-xs">플레이리스트</p>
              </button>
              <button 
                onClick={() => loadDetailData("liked")}
                className="bg-white/10 hover:bg-white/20 rounded-xl p-3 text-center transition-colors"
              >
                <div className="flex items-center justify-center mb-1">
                  <Heart className="w-4 h-4 text-pink-400" />
                </div>
                <p className="text-white font-bold">{profile.likedPlaylists}</p>
                <p className="text-white/50 text-xs">좋아요</p>
              </button>
              <button 
                onClick={() => loadDetailData("comments")}
                className="bg-white/10 hover:bg-white/20 rounded-xl p-3 text-center transition-colors"
              >
                <div className="flex items-center justify-center mb-1">
                  <MessageCircle className="w-4 h-4 text-orange-400" />
                </div>
                <p className="text-white font-bold">{profile.comments}</p>
                <p className="text-white/50 text-xs">댓글</p>
              </button>
              <button 
                onClick={() => loadDetailData("followers")}
                className="bg-white/10 hover:bg-white/20 rounded-xl p-3 text-center transition-colors"
              >
                <div className="flex items-center justify-center mb-1">
                  <Users className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-white font-bold">{profile.followers}</p>
                <p className="text-white/50 text-xs">팔로워</p>
              </button>
              <button 
                onClick={() => loadDetailData("following")}
                className="bg-white/10 hover:bg-white/20 rounded-xl p-3 text-center transition-colors"
              >
                <div className="flex items-center justify-center mb-1">
                  <UserPlus className="w-4 h-4 text-green-400" />
                </div>
                <p className="text-white font-bold">{profile.following}</p>
                <p className="text-white/50 text-xs">팔로잉</p>
              </button>
            </div>

            {/* Music Tags */}
            <div className="mb-6">
              <h4 className="text-white font-medium mb-3">🎵 음악 취향</h4>
              {isEditing ? (
                <div className="space-y-3">
                  <p className="text-white/50 text-sm">최대 5개까지 선택 가능</p>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_TAGS.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                          editForm.musicTags.includes(tag)
                            ? "bg-gradient-to-r from-sky-400 to-cyan-400 text-white shadow-lg shadow-sky-400/20"
                            : "bg-white/10 text-white/70 hover:bg-white/20"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {profile.musicTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1.5 bg-gradient-to-r from-sky-400/30 to-cyan-400/30 border border-sky-300/40 rounded-full text-sm text-sky-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {isEditing ? (
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 py-3 bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-500 hover:to-cyan-500 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-sky-400/20 border border-sky-300/30"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <button
                  onClick={loadBlockedUsers}
                  className="w-full py-3 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <UserX className="w-4 h-4" />
                  차단 목록 관리
                </button>
                <button
                  onClick={onLogout}
                  className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  로그아웃
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-3 bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 border border-red-500/30"
                >
                  <Trash2 className="w-4 h-4" />
                  회원 탈퇴
                </button>
              </div>
            )}
              </>
            )}

            {showDeleteConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-3xl z-50 flex items-center justify-center p-6"
              >
                <div className="bg-slate-800 border border-red-500/30 rounded-2xl p-6 w-full max-w-sm">
                  <h3 className="text-xl font-bold text-red-400 mb-4 text-center">회원 탈퇴</h3>
                  <p className="text-white/70 text-sm mb-4 text-center">
                    정말 탈퇴하시겠습니까?<br />
                    모든 데이터가 삭제되며 복구할 수 없습니다.
                  </p>
                  
                  {!isSocialLogin() && (
                    <div className="mb-4">
                      <label className="block text-white/70 text-sm mb-2">비밀번호 확인</label>
                      <input
                        type="password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder="비밀번호를 입력하세요"
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-red-500/50"
                      />
                    </div>
                  )}
                  
                  {deleteError && (
                    <p className="text-red-400 text-sm mb-4 text-center">{deleteError}</p>
                  )}
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeletePassword("");
                        setDeleteError("");
                      }}
                      disabled={isDeleting}
                      className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={isDeleting}
                      className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      {isDeleting ? "처리 중..." : "탈퇴하기"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
          </div>

          {/* Detail View Overlay */}
          <AnimatePresence>
            {detailView && (
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: selectedUser ? 0 : 1, x: selectedUser ? 50 : 0 }}
                exit={{ opacity: 0, x: 50 }}
                className="absolute inset-0 bg-slate-900 border border-white/20 rounded-3xl z-20 flex flex-col"
                style={{ visibility: selectedUser ? 'hidden' : 'visible' }}
              >
                {/* Detail Header */}
                <div className="flex-shrink-0 z-30 flex items-center gap-3 p-4 border-b border-white/15 bg-gray-800/90 rounded-t-3xl">
                  <button
                    onClick={() => setDetailView(null)}
                    className="px-3 py-2 bg-white/15 hover:bg-white/25 border border-white/20 rounded-lg transition-colors flex items-center gap-2 shadow-lg"
                  >
                    <ChevronLeft className="w-5 h-5 text-white" />
                    <span className="text-white text-sm font-medium">뒤로</span>
                  </button>
                  <h2 className="text-white text-lg font-bold drop-shadow-lg">
                    {detailView === "playlists" && "작성한 플레이리스트"}
                    {detailView === "liked" && "좋아요한 플레이리스트"}
                    {detailView === "followers" && "팔로워"}
                    {detailView === "following" && "팔로잉"}
                    {detailView === "blocked" && "차단 목록"}
                  </h2>
                </div>

                {/* Detail Content */}
                <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                  {detailLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 text-purple-400 animate-spin mb-4" />
                      <p className="text-white/70">불러오는 중...</p>
                    </div>
                  ) : (
                    <>
                      {/* 플레이리스트 목록 */}
                      {(detailView === "playlists" || detailView === "liked") && (
                        <div className="space-y-3">
                          {(detailView === "playlists" ? userPlaylists : likedPlaylists).length === 0 ? (
                            <div className="text-center py-12 bg-white/10 rounded-2xl border border-white/20">
                              <Music2 className="w-12 h-12 text-white/40 mx-auto mb-4" />
                              <p className="text-white/60">
                                {detailView === "playlists" ? "작성한 플레이리스트가 없습니다" : "좋아요한 플레이리스트가 없습니다"}
                              </p>
                            </div>
                          ) : (
                            (detailView === "playlists" ? userPlaylists : likedPlaylists).map((playlist) => (
                              <div
                                key={playlist.id}
                                className="flex items-center gap-4 p-4 bg-white/15 hover:bg-white/25 border border-white/20 rounded-xl transition-colors group shadow-lg"
                              >
                                <div 
                                  className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
                                  onClick={() => {
                                    if (onPlaylistSelect) {
                                      onPlaylistSelect(playlist.id);
                                      onClose();
                                    }
                                  }}
                                >
                                  {playlist.coverImageUrl ? (
                                    <img 
                                      src={playlist.coverImageUrl} 
                                      alt={playlist.title}
                                      className="w-14 h-14 rounded-lg object-cover shrink-0 shadow-lg"
                                    />
                                  ) : (
                                    <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center shrink-0 shadow-lg">
                                      <Music2 className="w-7 h-7 text-white" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h4 className="text-white font-medium text-base drop-shadow truncate">{playlist.title}</h4>
                                      {detailView === "playlists" && (
                                        <span className={`shrink-0 px-2 py-0.5 rounded text-xs ${playlist.isPublic !== false ? 'bg-green-500/30 text-green-300' : 'bg-yellow-500/30 text-yellow-300'}`}>
                                          {playlist.isPublic !== false ? '공개' : '비공개'}
                                        </span>
                                      )}
                                    </div>
                                    {playlist.description && (
                                      <p className="text-white/70 text-sm mb-1 line-clamp-1">{playlist.description}</p>
                                    )}
                                    <p className="text-white/50 text-xs">{playlist.trackCount}곡 • ❤️ {playlist.likeCount}</p>
                                  </div>
                                </div>
                                {detailView === "playlists" && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleVisibility(playlist.id, playlist.isPublic !== false);
                                    }}
                                    disabled={togglingPlaylistId === playlist.id}
                                    className={`shrink-0 p-2.5 rounded-lg transition-colors ${
                                      playlist.isPublic !== false 
                                        ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300' 
                                        : 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300'
                                    } disabled:opacity-50`}
                                    title={playlist.isPublic !== false ? '비공개로 전환' : '공개로 전환'}
                                  >
                                    {togglingPlaylistId === playlist.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : playlist.isPublic !== false ? (
                                      <Globe className="w-4 h-4" />
                                    ) : (
                                      <Lock className="w-4 h-4" />
                                    )}
                                  </button>
                                )}
                                <div 
                                  className="p-2 bg-white/20 group-hover:bg-white/30 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg cursor-pointer shrink-0"
                                  onClick={() => {
                                    if (onPlaylistSelect) {
                                      onPlaylistSelect(playlist.id);
                                      onClose();
                                    }
                                  }}
                                >
                                  <ChevronRight className="w-4 h-4 text-white" />
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {/* 팔로워/팔로잉 목록 */}
                      {(detailView === "followers" || detailView === "following") && (
                        <div className="space-y-3">
                          {(detailView === "followers" ? followers : following).length === 0 ? (
                            <div className="text-center py-12 bg-white/10 rounded-2xl border border-white/20">
                              <Users className="w-12 h-12 text-white/40 mx-auto mb-4" />
                              <p className="text-white/60">
                                {detailView === "followers" ? "팔로워가 없습니다" : "팔로잉하는 사용자가 없습니다"}
                              </p>
                            </div>
                          ) : (
                            (detailView === "followers" ? followers : following).map((user) => (
                              <div
                                key={user.id}
                                className="flex items-center gap-3 p-4 bg-white/15 hover:bg-white/25 border border-white/20 rounded-xl transition-colors shadow-lg"
                              >
                                {isImageUrl(user.avatar) ? (
                                  <img 
                                    src={normalizeImageUrl(user.avatar) || ''} 
                                    alt={user.nickname}
                                    className="w-12 h-12 rounded-full object-cover shrink-0 shadow-lg cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEnlargedAvatar({ url: normalizeImageUrl(user.avatar) || user.avatar, name: user.nickname });
                                    }}
                                  />
                                ) : (
                                  <div 
                                    className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-xl shrink-0 shadow-lg cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEnlargedAvatar({ url: user.avatar || "🎧", name: user.nickname });
                                    }}
                                  >
                                    {user.avatar || "🎧"}
                                  </div>
                                )}
                                <div 
                                  className="flex-1 min-w-0 cursor-pointer"
                                  onClick={() => loadUserProfile(user)}
                                >
                                  <h4 className="text-white font-medium truncate drop-shadow">{user.nickname}</h4>
                                </div>
                                <div 
                                  className="p-2 bg-white/20 hover:bg-white/30 rounded-full cursor-pointer transition-colors"
                                  onClick={() => loadUserProfile(user)}
                                >
                                  <ChevronRight className="w-4 h-4 text-white" />
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {/* 댓글 목록 */}
                      {detailView === "comments" && (
                        <div className="space-y-3">
                          {userComments.length === 0 ? (
                            <div className="text-center py-12 bg-white/10 rounded-2xl border border-white/20">
                              <MessageCircle className="w-12 h-12 text-white/40 mx-auto mb-4" />
                              <p className="text-white/60">작성한 댓글이 없습니다</p>
                            </div>
                          ) : (
                            userComments.map((comment) => (
                              <div
                                key={comment.id}
                                className="p-4 bg-white/15 border border-white/20 rounded-xl shadow-lg cursor-pointer hover:bg-white/25 transition-colors"
                                onClick={() => {
                                  if (comment.playlistId && onPlaylistSelect) {
                                    onPlaylistSelect(comment.playlistId);
                                    onClose();
                                  }
                                }}
                              >
                                <p className="text-white mb-2">{comment.content}</p>
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-purple-300">
                                    📝 {comment.playlistTitle || "플레이리스트"}
                                  </span>
                                  <div className="flex items-center gap-3 text-white/50">
                                    <span>❤️ {comment.likeCount}</span>
                                    <span>{comment.createdAt}</span>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {detailView === "blocked" && (
                        <div className="space-y-3">
                          {blockedUsers.length === 0 ? (
                            <div className="text-center py-12 bg-white/10 rounded-2xl border border-white/20">
                              <UserX className="w-12 h-12 text-white/40 mx-auto mb-4" />
                              <p className="text-white/60">차단한 사용자가 없습니다</p>
                            </div>
                          ) : (
                            blockedUsers.map((user) => (
                              <div
                                key={user.id}
                                className="flex items-center gap-3 p-4 bg-white/15 border border-white/20 rounded-xl shadow-lg"
                              >
                                {isImageUrl(user.avatar) ? (
                                  <img 
                                    src={normalizeImageUrl(user.avatar) || ''} 
                                    alt={user.nickname}
                                    className="w-12 h-12 rounded-full object-cover shrink-0 shadow-lg"
                                  />
                                ) : (
                                  <div className="w-12 h-12 bg-gradient-to-br from-gray-500 to-gray-600 rounded-full flex items-center justify-center text-xl shrink-0 shadow-lg">
                                    {user.avatar || "🎧"}
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-white font-medium truncate drop-shadow">{user.nickname}</h4>
                                  {user.blockedAt && (
                                    <p className="text-white/50 text-xs">{user.blockedAt.split('T')[0]} 차단됨</p>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleUnblockUser(user.id)}
                                  disabled={isBlockingUser}
                                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                >
                                  차단 해제
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>

        {/* 유저 정보 모달 - 메인 모달 바깥에 배치 */}
        <AnimatePresence>
          {selectedUser && !enlargedAvatar && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[55] flex items-center justify-center bg-black/80 p-4"
              onClick={() => setSelectedUser(null)}
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
                  onClick={() => setSelectedUser(null)}
                  className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>

                {/* 유저 프로필 */}
                <div className="flex flex-col items-center">
                  {isImageUrl(selectedUser.avatar) ? (
                    <img 
                      src={normalizeImageUrl(selectedUser.avatar) || ''} 
                      alt={selectedUser.nickname}
                      className="w-48 h-48 rounded-full object-cover shadow-xl border-4 border-white/30 mb-8 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setEnlargedAvatar({ url: normalizeImageUrl(selectedUser.avatar) || selectedUser.avatar, name: selectedUser.nickname })}
                    />
                  ) : (
                    <div 
                      className="w-48 h-48 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-8xl shadow-xl mb-8 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setEnlargedAvatar({ url: selectedUser.avatar || "🎧", name: selectedUser.nickname })}
                    >
                      {selectedUser.avatar || "🎧"}
                    </div>
                  )}
                  <h3 className="text-3xl font-bold text-white mb-3">{selectedUser.nickname}</h3>
                  {selectedUser.bio && (
                    <p className="text-white/70 text-center mb-6 text-lg max-w-lg">{selectedUser.bio}</p>
                  )}

                  {/* 통계 */}
                  <div className="flex gap-12 mb-6">
                    <div className="text-center">
                      <p className="text-white font-bold text-2xl">{selectedUser.playlists || 0}</p>
                      <p className="text-white/50 text-sm">플레이리스트</p>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-bold text-2xl">{selectedUser.followers || 0}</p>
                      <p className="text-white/50 text-sm">팔로워</p>
                    </div>
                  </div>

                  {/* 음악 취향 */}
                  {selectedUser.musicTags && selectedUser.musicTags.length > 0 && (
                    <div className="w-full max-w-md mb-6">
                      <h4 className="text-white/80 text-base mb-3 text-center">🎵 음악 취향</h4>
                      <div className="flex flex-wrap justify-center gap-3">
                        {selectedUser.musicTags.map((tag) => (
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

                  {selectedUser.id !== userId && (
                    <button
                      onClick={isUserBlocked ? () => handleUnblockUser() : handleBlockUser}
                      disabled={isBlockingUser}
                      className={`mt-4 px-6 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                        isUserBlocked 
                          ? "bg-white/20 hover:bg-white/30 text-white" 
                          : "bg-red-500/20 hover:bg-red-500/30 text-red-400"
                      }`}
                    >
                      {isBlockingUser ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Ban className="w-4 h-4" />
                      )}
                      {isBlockingUser ? '처리 중...' : isUserBlocked ? '차단 해제' : '차단하기'}
                    </button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 프로필 사진 확대 모달 - 메인 모달 바깥에 배치 */}
        <AnimatePresence>
          {enlargedAvatar && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
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
                  className="absolute -top-14 right-0 p-2 text-white/70 hover:text-white transition-colors"
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
      </motion.div>
    </AnimatePresence>
  );
}
