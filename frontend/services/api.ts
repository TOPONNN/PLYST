import axios, { AxiosError } from 'axios';

const API_BASE_URL = 'https://plyst.info';

// axios 인스턴스 생성 (타임아웃 설정)
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30초 타임아웃
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터 - 공통 헤더 설정
apiClient.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

// 응답 인터셉터 - 에러 핸들링
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // 네트워크 오류 또는 타임아웃
    if (!error.response) {
      console.error('네트워크 오류:', error.message);
    }
    return Promise.reject(error);
  }
);

// Spotify 플레이리스트 검색
export interface Playlist {
  id: string;
  name: string;
  image: string;
  owner: string;
}

// 플레이리스트 내 트랙
export interface Track {
  title: string;
  album: {
    title: string;
    image: string;
  };
  artists: string;
}

// Spotify 플레이리스트 검색
export const searchPlaylists = async (keyword: string, offset: number = 0): Promise<Playlist[]> => {
  try {
    const response = await apiClient.get(`/search/playlist/${encodeURIComponent(keyword)}?offset=${offset}`);
    return response.data;
  } catch {
    return [];
  }
};

// 플레이리스트의 트랙 가져오기
export const getPlaylistTracks = async (playlistId: string): Promise<Track[]> => {
  try {
    const response = await apiClient.get(`/search/tracks/${playlistId}`, {
      timeout: 60000, // 대용량 플레이리스트를 위해 60초 타임아웃
    });
    return response.data;
  } catch {
    return [];
  }
};

// YouTube 비디오 ID 가져오기
export const getYoutubeVideoId = async (title: string, artist: string): Promise<string> => {
  try {
    // 특수문자 정리
    const cleanTitle = title.replace(/[\[\](){}'"<>]/g, ' ').trim();
    const cleanArtist = artist.replace(/[\[\](){}'"<>]/g, ' ').trim();
    
    const response = await apiClient.get(`/search/track`, {
      params: { title: cleanTitle, artist: cleanArtist },
      timeout: 15000, // 15초 타임아웃
    });
    return response.data || '';
  } catch (error) {
    console.error('YouTube 검색 오류:', error);
    return '';
  }
};

export const getAlternativeYoutubeVideoId = async (
  title: string, 
  artist: string, 
  excludeVideoIds: string[] = []
): Promise<string> => {
  try {
    const cleanTitle = title.replace(/[\[\](){}'"<>]/g, ' ').trim();
    const cleanArtist = artist.replace(/[\[\](){}'"<>]/g, ' ').trim();
    
    const searchVariations = [
      `${cleanTitle} ${cleanArtist} audio`,
      `${cleanTitle} ${cleanArtist} lyrics`,
      `${cleanTitle} ${cleanArtist} official`,
      `${cleanTitle} ${cleanArtist} MV`,
      `${cleanTitle} audio`,
    ];
    
    for (const searchQuery of searchVariations) {
      try {
        const response = await apiClient.get(`/search/track`, {
          params: { 
            title: searchQuery, 
            artist: '',
            exclude: excludeVideoIds.join(',')
          },
          timeout: 10000,
        });
        
        const videoId = response.data || '';
        if (videoId && !excludeVideoIds.includes(videoId)) {
          return videoId;
        }
      } catch {
        continue;
      }
    }
    
    return '';
  } catch (error) {
    console.error('대체 YouTube 검색 오류:', error);
    return '';
  }
};

// 트랙 정보 가져오기 (앨범 이미지 등)
export interface TrackInfo {
  title: string;
  artist: string;
  album: string;
  albumImage: string;
  duration: number;
}

export const getTrackInfo = async (title: string, artist: string): Promise<TrackInfo | null> => {
  try {
    const response = await apiClient.get(`/search/track/info`, {
      params: { title, artist }
    });
    return response.data;
  } catch (error) {
    console.error('트랙 정보 검색 오류:', error);
    return null;
  }
};

// 여러 트랙 검색
export const searchTracks = async (query: string, limit: number = 15): Promise<TrackInfo[]> => {
  try {
    const response = await apiClient.get(`/search/tracks`, {
      params: { query, limit }
    });
    return response.data;
  } catch (error) {
    console.error('트랙 검색 오류:', error);
    return [];
  }
};

export const getKoreaChart = async (limit: number = 20): Promise<TrackInfo[]> => {
  try {
    const response = await apiClient.get(`/search/chart/korea`, {
      params: { limit }
    });
    return response.data;
  } catch (error) {
    console.error('한국 차트 조회 오류:', error);
    return [];
  }
};

// ===== 플레이리스트 API =====

export interface PlaylistOwner {
  id: number;
  nickname: string;
}

export interface PlaylistTrack {
  id: number;
  title: string;
  artist: string;
  albumImage: string;
  durationSec: number;
}

export interface PlaylistResponse {
  id: number;
  title: string;
  description: string;
  coverImageUrl: string;
  isPublic: boolean;
  viewCount: number;
  likeCount: number;
  shareCount: number;
  owner: PlaylistOwner;
  trackCount: number;
  tags: string[];
  createdAt: string;
}

export interface PlaylistDetailResponse {
  id: number;
  title: string;
  description: string;
  coverImageUrl: string;
  isPublic: boolean;
  viewCount: number;
  likeCount: number;
  shareCount: number;
  isLiked: boolean;
  owner: PlaylistOwner;
  tracks: PlaylistTrack[];
  tags: string[];
  createdAt: string;
}

export interface CommentResponse {
  id: number;
  content: string;
  author: {
    id: number;
    nickname: string;
    avatar?: string;
  };
  likeCount: number;
  isLiked: boolean;
  createdAt: string;
}

// 플레이리스트 생성 요청
export interface CreatePlaylistRequest {
  title: string;
  description?: string;
  coverImageUrl?: string;
  isPublic?: boolean;
  tags?: string[];
  tracks?: {
    title: string;
    artist: string;
    albumName?: string;
    albumImage?: string;
    durationSec?: number;
  }[];
}

// 플레이리스트 생성
export const createPlaylist = async (userId: number, request: CreatePlaylistRequest): Promise<PlaylistResponse | null> => {
  try {
    const response = await apiClient.post('/api/playlists', request, {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('플레이리스트 생성 오류:', error);
    return null;
  }
};

export const getPublicPlaylists = async (userId?: number): Promise<PlaylistResponse[]> => {
  try {
    const response = await apiClient.get('/api/playlists', {
      params: userId ? { userId } : {}
    });
    return response.data;
  } catch (error) {
    console.error('플레이리스트 목록 조회 오류:', error);
    return [];
  }
};

export const getPlaylistDetail = async (playlistId: number, userId?: number, incrementView: boolean = true): Promise<PlaylistDetailResponse | null> => {
  try {
    const response = await apiClient.get(`/api/playlists/${playlistId}`, {
      params: { ...(userId ? { userId } : {}), incrementView }
    });
    return response.data;
  } catch (error) {
    console.error('플레이리스트 상세 조회 오류:', error);
    return null;
  }
};

// 플레이리스트 수정
export interface UpdatePlaylistRequest {
  title?: string;
  description?: string;
  coverImageUrl?: string;
  isPublic?: boolean;
  tags?: string[];
}

export const updatePlaylist = async (playlistId: number, userId: number, request: UpdatePlaylistRequest): Promise<PlaylistResponse | null> => {
  try {
    const response = await apiClient.put(`/api/playlists/${playlistId}`, request, {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('플레이리스트 수정 오류:', error);
    return null;
  }
};

// 플레이리스트 삭제
export const deletePlaylist = async (playlistId: number, userId: number): Promise<boolean> => {
  try {
    await apiClient.delete(`/api/playlists/${playlistId}`, {
      params: { userId }
    });
    return true;
  } catch (error) {
    console.error('플레이리스트 삭제 오류:', error);
    return false;
  }
};

export const sharePlaylist = async (playlistId: number): Promise<number | null> => {
  try {
    const response = await apiClient.post(`/api/playlists/${playlistId}/share`);
    return response.data;
  } catch (error) {
    console.error('플레이리스트 공유 오류:', error);
    return null;
  }
};

// 플레이리스트의 댓글 목록 조회
export const getPlaylistComments = async (playlistId: number, userId?: number): Promise<CommentResponse[]> => {
  try {
    const response = await apiClient.get(`/api/comments/playlist/${playlistId}`, {
      params: userId ? { userId } : {}
    });
    return response.data;
  } catch (error) {
    console.error('댓글 목록 조회 오류:', error);
    return [];
  }
};

// 댓글 작성
export const createComment = async (playlistId: number, userId: number, content: string): Promise<CommentResponse | null> => {
  try {
    const response = await apiClient.post('/api/comments', 
      { playlistId, content },  // body로 전송
      { params: { userId } }     // userId는 query param
    );
    return response.data;
  } catch (error) {
    console.error('댓글 작성 오류:', error);
    return null;
  }
};

// 댓글 수정
export const updateComment = async (commentId: number, userId: number, content: string): Promise<CommentResponse | null> => {
  try {
    const response = await apiClient.put(`/api/comments/${commentId}`,
      { content },
      { params: { userId } }
    );
    return response.data;
  } catch (error) {
    console.error('댓글 수정 오류:', error);
    return null;
  }
};

// 댓글 삭제
export const deleteComment = async (commentId: number, userId: number): Promise<boolean> => {
  try {
    await apiClient.delete(`/api/comments/${commentId}`, {
      params: { userId }
    });
    return true;
  } catch (error) {
    console.error('댓글 삭제 오류:', error);
    return false;
  }
};

// 사용자가 작성한 댓글 목록 조회
export interface UserCommentResponse extends CommentResponse {
  playlistId?: number;
  playlistTitle?: string;
}

export const getUserComments = async (userId: number): Promise<UserCommentResponse[]> => {
  try {
    const response = await apiClient.get(`/api/comments/user/${userId}`);
    return response.data;
  } catch (error) {
    console.error('사용자 댓글 목록 조회 오류:', error);
    return [];
  }
};

// 사용자가 작성한 댓글 수 조회
export const getUserCommentsCount = async (userId: number): Promise<number> => {
  try {
    const response = await apiClient.get(`/api/comments/user/${userId}/count`);
    return response.data.count || 0;
  } catch (error) {
    console.error('사용자 댓글 수 조회 오류:', error);
    return 0;
  }
};

// ===== 팔로우 API =====

export interface FollowResponse {
  isFollowing: boolean;
  followerCount: number;
}

// 팔로우/언팔로우 토글
export const toggleFollow = async (targetUserId: number, userId: number): Promise<FollowResponse> => {
  try {
    const response = await apiClient.post(`/api/follow/${targetUserId}`, null, {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('팔로우 오류:', error);
    throw error;
  }
};

// 팔로우 상태 조회
export const getFollowStatus = async (targetUserId: number, userId: number): Promise<FollowResponse> => {
  try {
    const response = await apiClient.get(`/api/follow/${targetUserId}/status`, {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('팔로우 상태 조회 오류:', error);
    return { isFollowing: false, followerCount: 0 };
  }
};

// ===== 좋아요 API =====

export interface LikeResponse {
  isLiked: boolean;
  likeCount: number;
}

// 플레이리스트 좋아요 토글
export const togglePlaylistLike = async (playlistId: number, userId: number): Promise<LikeResponse> => {
  try {
    const response = await apiClient.post(`/api/likes/playlist/${playlistId}`, null, {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('플레이리스트 좋아요 오류:', error);
    throw error;
  }
};

// 플레이리스트 좋아요 상태 조회
export const getPlaylistLikeStatus = async (playlistId: number, userId: number): Promise<LikeResponse> => {
  try {
    const response = await apiClient.get(`/api/likes/playlist/${playlistId}`, {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('플레이리스트 좋아요 상태 조회 오류:', error);
    throw error;
  }
};

// 댓글 좋아요 토글
export const toggleCommentLike = async (commentId: number, userId: number): Promise<LikeResponse> => {
  try {
    const response = await apiClient.post(`/api/likes/comment/${commentId}`, null, {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('댓글 좋아요 오류:', error);
    throw error;
  }
};

// 댓글 좋아요 상태 조회
export const getCommentLikeStatus = async (commentId: number, userId: number): Promise<LikeResponse> => {
  try {
    const response = await apiClient.get(`/api/likes/comment/${commentId}`, {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('댓글 좋아요 상태 조회 오류:', error);
    throw error;
  }
};

// ===== 트랙 좋아요 API =====

// 트랙 좋아요 토글
export const toggleTrackLike = async (title: string, artist: string, userId: number): Promise<LikeResponse> => {
  try {
    const response = await apiClient.post(`/api/likes/track`, null, {
      params: { title, artist, userId }
    });
    return response.data;
  } catch (error) {
    console.error('트랙 좋아요 오류:', error);
    throw error;
  }
};

// 사용자가 좋아요한 트랙 목록 조회
export const getUserLikedTracks = async (userId: number): Promise<{ title: string; artist: string; albumImage?: string; duration?: string }[]> => {
  try {
    const response = await apiClient.get(`/api/likes/tracks/user/${userId}`);
    return response.data;
  } catch (error) {
    console.error('좋아요 트랙 목록 조회 오류:', error);
    return [];
  }
};

// ===== 사용자 좋아요 목록 API =====

export interface LikedItem {
  type: 'playlist' | 'comment' | 'track';
  id: number;
  title?: string;
  artist?: string;
  playlistTitle?: string;
  commentContent?: string;
  likedAt: string;
}

// 사용자의 모든 좋아요 항목 조회
export const getUserAllLikes = async (userId: number): Promise<LikedItem[]> => {
  try {
    const response = await apiClient.get(`/api/likes/user/${userId}/all`);
    return response.data;
  } catch (error) {
    console.error('사용자 좋아요 목록 조회 오류:', error);
    return [];
  }
};

// 사용자가 좋아요한 댓글 목록 조회
export const getUserLikedComments = async (userId: number): Promise<{
  id: number;
  content: string;
  author: string;
  playlistTitle: string;
  likedAt: string;
}[]> => {
  try {
    const response = await apiClient.get(`/api/likes/comments/user/${userId}`);
    return response.data;
  } catch (error) {
    console.error('좋아요 댓글 목록 조회 오류:', error);
    return [];
  }
};

// 사용자가 좋아요한 플레이리스트 목록 조회
export const getUserLikedPlaylists = async (userId: number): Promise<{
  id: number;
  title: string;
  owner: string;
  trackCount: number;
  coverGradient: string;
}[]> => {
  try {
    const response = await apiClient.get(`/api/likes/playlists/user/${userId}`);
    return response.data;
  } catch (error) {
    console.error('좋아요 플레이리스트 목록 조회 오류:', error);
    return [];
  }
};

// ===== 사용자 API =====

export interface SignupRequest {
  nickname: string;
  userId: string;
  email: string;
  password: string;
  realName: string;
  phoneNumber: string;
  gender: string;
}

export interface SignupResponse {
  id: number;
  nickname: string;
  email: string;
  message: string;
  success: boolean;
}

export interface LoginRequest {
  userId: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  id: number;
  nickname: string;
  email: string;
  token: string;
  success: boolean;
  message: string;
  profileImage?: string;
  dormant?: boolean;
}

// 소셜 로그인 요청
export interface SocialLoginRequest {
  provider: string;      // "google" 또는 "kakao"
  providerId: string;    // 소셜 제공자의 고유 ID
  email: string;
  name: string;
  profileImage?: string;
}

// 소셜 회원가입 요청
export interface SocialSignupRequest {
  provider: string;
  providerId: string;
  email: string;
  name: string;
  nickname: string;
  profileImage?: string;
}

export interface CheckDuplicateResponse {
  exists: boolean;
  message: string;
}

// 회원가입
export const signup = async (request: SignupRequest): Promise<SignupResponse> => {
  try {
    const response = await apiClient.post('/api/users/signup', request);
    return response.data;
  } catch (error: any) {
    if (error.response?.data) {
      return error.response.data;
    }
    return { id: 0, nickname: '', email: '', message: '회원가입 중 오류가 발생했습니다.', success: false };
  }
};

// 로그인
export const login = async (request: LoginRequest): Promise<LoginResponse> => {
  try {
    const response = await apiClient.post('/api/users/login', request);
    return response.data;
  } catch (error: any) {
    if (error.response?.data) {
      return error.response.data;
    }
    return { id: 0, nickname: '', email: '', token: '', message: '로그인 중 오류가 발생했습니다.', success: false };
  }
};

// 소셜 로그인
export const socialLogin = async (request: SocialLoginRequest): Promise<LoginResponse> => {
  try {
    const response = await apiClient.post('/api/users/social-login', request);
    return response.data;
  } catch (error: any) {
    if (error.response?.data) {
      return error.response.data;
    }
    return { id: 0, nickname: '', email: '', token: '', message: '소셜 로그인 중 오류가 발생했습니다.', success: false };
  }
};

// 소셜 회원가입
export const socialSignup = async (request: SocialSignupRequest): Promise<SignupResponse> => {
  try {
    const response = await apiClient.post('/api/users/social-signup', request);
    return response.data;
  } catch (error: any) {
    if (error.response?.data) {
      return error.response.data;
    }
    return { id: 0, nickname: '', email: '', message: '소셜 회원가입 중 오류가 발생했습니다.', success: false };
  }
};

// 이메일 중복 체크
export const checkEmailDuplicate = async (email: string): Promise<CheckDuplicateResponse> => {
  try {
    const response = await apiClient.get('/api/users/check-email', { params: { email } });
    return response.data;
  } catch (error) {
    console.error('이메일 중복 체크 오류:', error);
    return { exists: false, message: '중복 체크 중 오류가 발생했습니다.' };
  }
};

// 닉네임 중복 체크
export const checkNicknameDuplicate = async (nickname: string): Promise<CheckDuplicateResponse> => {
  try {
    const response = await apiClient.get('/api/users/check-nickname', { params: { nickname } });
    return response.data;
  } catch (error) {
    console.error('닉네임 중복 체크 오류:', error);
    return { exists: false, message: '중복 체크 중 오류가 발생했습니다.' };
  }
};

export const checkUserIdDuplicate = async (userId: string): Promise<CheckDuplicateResponse> => {
  try {
    const response = await apiClient.get('/api/users/check-userid', { params: { userId } });
    return response.data;
  } catch (error) {
    console.error('아이디 중복 체크 오류:', error);
    return { exists: false, message: '중복 체크 중 오류가 발생했습니다.' };
  }
};

export interface SendVerificationRequest {
  email: string;
  purpose: 'FIND_ID' | 'RESET_PASSWORD';
}

export interface SendVerificationResponse {
  success: boolean;
  message: string;
}

export interface VerifyCodeRequest {
  email: string;
  code: string;
}

export interface VerifyCodeResponse {
  success: boolean;
  message: string;
  verified: boolean;
}

export interface FindIdRequest {
  email: string;
  code: string;
}

export interface FindIdResponse {
  success: boolean;
  message: string;
  userId?: string;
  maskedUserId?: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

export const sendVerificationCode = async (request: SendVerificationRequest): Promise<SendVerificationResponse> => {
  try {
    const response = await apiClient.post('/api/users/send-verification', request);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as { response?: { data?: SendVerificationResponse } };
    if (axiosError.response?.data) {
      return axiosError.response.data;
    }
    return { success: false, message: '인증번호 발송 중 오류가 발생했습니다.' };
  }
};

export const verifyCode = async (request: VerifyCodeRequest): Promise<VerifyCodeResponse> => {
  try {
    const response = await apiClient.post('/api/users/verify-code', request);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as { response?: { data?: VerifyCodeResponse } };
    if (axiosError.response?.data) {
      return axiosError.response.data;
    }
    return { success: false, message: '인증 확인 중 오류가 발생했습니다.', verified: false };
  }
};

export const findUserId = async (request: FindIdRequest): Promise<FindIdResponse> => {
  try {
    const response = await apiClient.post('/api/users/find-id', request);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as { response?: { data?: FindIdResponse } };
    if (axiosError.response?.data) {
      return axiosError.response.data;
    }
    return { success: false, message: '아이디 찾기 중 오류가 발생했습니다.' };
  }
};

export const resetPassword = async (request: ResetPasswordRequest): Promise<ResetPasswordResponse> => {
  try {
    const response = await apiClient.post('/api/users/reset-password', request);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as { response?: { data?: ResetPasswordResponse } };
    if (axiosError.response?.data) {
      return axiosError.response.data;
    }
    return { success: false, message: '비밀번호 재설정 중 오류가 발생했습니다.' };
  }
};

export interface DeleteAccountRequest {
  userId: number;
  password?: string;
}

export interface DeleteAccountResponse {
  success: boolean;
  message: string;
}

export const deleteAccount = async (request: DeleteAccountRequest): Promise<DeleteAccountResponse> => {
  try {
    const response = await apiClient.post('/api/users/delete-account', request);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as { response?: { data?: DeleteAccountResponse } };
    if (axiosError.response?.data) {
      return axiosError.response.data;
    }
    return { success: false, message: '회원 탈퇴 중 오류가 발생했습니다.' };
  }
};

export interface ReactivateAccountRequest {
  userId: number;
  password?: string;
}

export interface ReactivateAccountResponse {
  success: boolean;
  message: string;
}

export const reactivateAccount = async (request: ReactivateAccountRequest): Promise<ReactivateAccountResponse> => {
  try {
    const response = await apiClient.post('/api/users/reactivate-account', request);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as { response?: { data?: ReactivateAccountResponse } };
    if (axiosError.response?.data) {
      return axiosError.response.data;
    }
    return { success: false, message: '휴면 해제 중 오류가 발생했습니다.' };
  }
};

// ===== 프로필 API =====

export interface ProfileResponse {
  userId: number;
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

export interface UpdateProfileRequest {
  nickname?: string;
  bio?: string;
  avatar?: string;
  musicTags?: string[];
}

export interface UpdateProfileResponse {
  success: boolean;
  message: string;
  profile?: ProfileResponse;
}

// 프로필 조회
export const getProfile = async (userId: number): Promise<ProfileResponse | null> => {
  try {
    const response = await apiClient.get(`/api/profile/${userId}`);
    return response.data;
  } catch (error) {
    console.error('프로필 조회 오류:', error);
    return null;
  }
};

// 프로필 수정
export const updateProfile = async (userId: number, request: UpdateProfileRequest): Promise<UpdateProfileResponse> => {
  try {
    const response = await apiClient.put(`/api/profile/${userId}`, request);
    return response.data;
  } catch (error) {
    console.error('프로필 수정 오류:', error);
    return { success: false, message: '프로필 수정 중 오류가 발생했습니다.' };
  }
};

// ===== AI 추천 API =====

export interface AIRecommendedTrack {
  title: string;
  artist: string;
  duration: string;
  albumImage?: string;
}

export interface AIRecommendedPlaylist {
  id: string;
  title: string;
  description: string;
  coverGradient: string;
  coverImage?: string; // DALL-E generated image URL
  trackCount: number;
  tags: string[];
  tracks: AIRecommendedTrack[];
}

export interface AIRecommendResponse {
  success: boolean;
  message?: string;
  playlists: AIRecommendedPlaylist[];
}

// 이미지 검색 응답 인터페이스
export interface ImageSearchResult {
  id: string;
  previewUrl: string;
  webformatUrl: string;
  largeUrl: string;
  tags: string;
}

export interface ImageSearchResponse {
  originalKeyword: string;
  translatedKeyword: string;
  images: ImageSearchResult[];
}

// AI 이미지 검색 (한글 키워드 -> 영어 번역 -> Pixabay 검색)
export const searchCoverImages = async (keyword: string, count: number = 5): Promise<ImageSearchResponse> => {
  try {
    const response = await apiClient.get('/api/ai/images/search', {
      params: { keyword, count },
      timeout: 30000
    });
    return response.data;
  } catch (error) {
    console.error('이미지 검색 오류:', error);
    return {
      originalKeyword: keyword,
      translatedKeyword: keyword,
      images: []
    };
  }
};

// AI 플레이리스트 추천
export const getAIRecommendation = async (tags: string[]): Promise<AIRecommendResponse> => {
  try {
    const response = await apiClient.post('/api/ai/recommend', { tags }, {
      timeout: 60000 // ChatGPT 응답 대기를 위해 60초 타임아웃
    });
    return response.data;
  } catch (error) {
    console.error('AI 추천 오류:', error);
    return { 
      success: false, 
      message: 'AI 추천 서비스에 연결할 수 없습니다.',
      playlists: [] 
    };
  }
};

// AI 추천 플레이리스트 저장
export const saveAIPlaylist = async (playlist: AIRecommendedPlaylist, userId?: number): Promise<{ success: boolean; message: string; playlistId?: number }> => {
  try {
    const response = await apiClient.post('/api/ai/playlists', playlist, {
      params: userId ? { userId } : undefined
    });
    return response.data;
  } catch (error) {
    console.error('AI 플레이리스트 저장 오류:', error);
    return { success: false, message: '저장에 실패했습니다.' };
  }
};

// 저장된 AI 플레이리스트 목록 조회
export const getSavedAIPlaylists = async (userId?: number): Promise<AIRecommendedPlaylist[]> => {
  try {
    const response = await apiClient.get('/api/ai/playlists', {
      params: userId ? { userId } : undefined
    });
    return response.data;
  } catch (error) {
    console.error('AI 플레이리스트 조회 오류:', error);
    return [];
  }
};

// 특정 AI 플레이리스트 조회
export const getAIPlaylist = async (id: number): Promise<AIRecommendedPlaylist | null> => {
  try {
    const response = await apiClient.get(`/api/ai/playlists/${id}`);
    return response.data;
  } catch (error) {
    console.error('AI 플레이리스트 조회 오류:', error);
    return null;
  }
};

// AI 플레이리스트 삭제
export const deleteAIPlaylist = async (id: number, userId?: number): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await apiClient.delete(`/api/ai/playlists/${id}`, {
      params: userId ? { userId } : undefined
    });
    return response.data;
  } catch (error) {
    console.error('AI 플레이리스트 삭제 오류:', error);
    return { success: false, message: '삭제에 실패했습니다.' };
  }
};

// 사용자가 작성한 플레이리스트 목록 조회
export const getUserPlaylists = async (userId: number): Promise<{
  id: number;
  title: string;
  description: string;
  coverImageUrl?: string;
  trackCount: number;
  likeCount: number;
  createdAt: string;
}[]> => {
  try {
    const response = await apiClient.get(`/api/users/${userId}/playlists`);
    return response.data;
  } catch (error) {
    console.error('사용자 플레이리스트 조회 오류:', error);
    return [];
  }
};

// 사용자가 좋아요한 플레이리스트 목록 조회 (프로필용)
export const getUserLikedPlaylistsSummary = async (userId: number): Promise<{
  id: number;
  title: string;
  description: string;
  coverImageUrl?: string;
  trackCount: number;
  likeCount: number;
  createdAt: string;
}[]> => {
  try {
    const response = await apiClient.get(`/api/users/${userId}/liked-playlists`);
    return response.data;
  } catch (error) {
    console.error('좋아요 플레이리스트 조회 오류:', error);
    return [];
  }
};

// 사용자의 팔로워 목록 조회
export const getUserFollowers = async (userId: number): Promise<{
  id: number;
  nickname: string;
  avatar: string;
}[]> => {
  try {
    const response = await apiClient.get(`/api/users/${userId}/followers`);
    return response.data;
  } catch (error) {
    console.error('팔로워 조회 오류:', error);
    return [];
  }
};

// 사용자가 팔로잉하는 사용자 목록 조회
export const getUserFollowing = async (userId: number): Promise<{
  id: number;
  nickname: string;
  avatar: string;
}[]> => {
  try {
    const response = await apiClient.get(`/api/users/${userId}/following`);
    return response.data;
  } catch (error) {
    console.error('팔로잉 조회 오류:', error);
    return [];
  }
};

// 플레이리스트 트랙 관리 API

// 플레이리스트에 트랙 추가
export const addTrackToPlaylist = async (playlistId: number, userId: number, track: {
  title: string;
  artist: string;
  albumName?: string;
  albumImage?: string;
  durationSec?: number;
  orderNo?: number;
}): Promise<{
  id: number;
  title: string;
  artist: string;
  albumImage?: string;
  durationSec: number;
} | null> => {
  try {
    const response = await apiClient.post(`/api/playlists/${playlistId}/tracks`, track, {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('트랙 추가 오류:', error);
    return null;
  }
};

// 플레이리스트에서 트랙 삭제
export const removeTrackFromPlaylist = async (playlistId: number, trackId: number, userId: number): Promise<boolean> => {
  try {
    await apiClient.delete(`/api/playlists/${playlistId}/tracks/${trackId}`, {
      params: { userId }
    });
    return true;
  } catch (error) {
    console.error('트랙 삭제 오류:', error);
    return false;
  }
};

// 플레이리스트 트랙 정보 수정
export const updateTrackInPlaylist = async (playlistId: number, trackId: number, userId: number, update: {
  title?: string;
  artist?: string;
  albumName?: string;
  albumImage?: string;
  durationSec?: number;
}): Promise<{
  id: number;
  title: string;
  artist: string;
  albumImage?: string;
  durationSec: number;
} | null> => {
  try {
    const response = await apiClient.put(`/api/playlists/${playlistId}/tracks/${trackId}`, update, {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('트랙 수정 오류:', error);
    return null;
  }
};

// 플레이리스트 트랙 순서 변경
export const reorderPlaylistTracks = async (playlistId: number, userId: number, trackIds: number[]): Promise<boolean> => {
  try {
    await apiClient.put(`/api/playlists/${playlistId}/tracks/reorder`, { trackIds }, {
      params: { userId }
    });
    return true;
  } catch (error) {
    console.error('트랙 순서 변경 오류:', error);
    return false;
  }
};

export const togglePlaylistVisibility = async (playlistId: number, userId: number): Promise<PlaylistResponse | null> => {
  try {
    const response = await apiClient.put(`/api/playlists/${playlistId}/visibility`, null, {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('플레이리스트 공개설정 변경 오류:', error);
    return null;
  }
};

export const duplicatePlaylist = async (playlistId: number, userId: number): Promise<PlaylistResponse | null> => {
  try {
    const response = await apiClient.post(`/api/playlists/${playlistId}/duplicate`, null, {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('플레이리스트 복제 오류:', error);
    return null;
  }
};

// ===== 차단 API =====

export interface BlockResponse {
  isBlocked: boolean;
  blockedCount: number;
}

export interface BlockStatusResponse {
  isBlocked: boolean;
  isBlockedByTarget: boolean;
}

export interface BlockedUserResponse {
  id: number;
  nickname: string;
  avatar: string;
  reason?: string;
  blockedAt: string;
}

export const toggleBlock = async (targetUserId: number, userId: number, reason?: string): Promise<BlockResponse> => {
  try {
    const response = await apiClient.post(`/api/block/${targetUserId}`, null, {
      params: { userId, reason }
    });
    return response.data;
  } catch (error) {
    console.error('차단 토글 오류:', error);
    throw error;
  }
};

export const blockUser = async (targetUserId: number, userId: number, reason?: string): Promise<{ success: boolean; isBlocked: boolean; message: string }> => {
  try {
    const response = await apiClient.post(`/api/block/${targetUserId}/block`, null, {
      params: { userId, reason }
    });
    return response.data;
  } catch (error) {
    console.error('차단 오류:', error);
    throw error;
  }
};

export const unblockUser = async (targetUserId: number, userId: number): Promise<{ success: boolean; isBlocked: boolean; message: string }> => {
  try {
    const response = await apiClient.delete(`/api/block/${targetUserId}`, {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('차단 해제 오류:', error);
    throw error;
  }
};

export const getBlockStatus = async (targetUserId: number, userId: number): Promise<BlockStatusResponse> => {
  try {
    const response = await apiClient.get(`/api/block/${targetUserId}/status`, {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('차단 상태 조회 오류:', error);
    return { isBlocked: false, isBlockedByTarget: false };
  }
};

export const getBlockedUsers = async (userId: number): Promise<BlockedUserResponse[]> => {
  try {
    const response = await apiClient.get(`/api/block/list`, {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('차단 목록 조회 오류:', error);
    return [];
  }
};

export const getBlockedCount = async (userId: number): Promise<number> => {
  try {
    const response = await apiClient.get(`/api/block/count`, {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('차단 수 조회 오류:', error);
    return 0;
  }
};

// ===== Station API Types =====

export interface StationUserInfo {
  id: number;
  nickname: string;
  avatar?: string;
}

export interface StationParticipant {
  id: number;
  nickname: string;
  avatar?: string;
  role: 'HOST' | 'MEMBER' | string;
  joinedAt: string;
}

export interface BannedUser {
  id: number;
  nickname: string;
  avatar?: string;
  bannedAt: string;
}

export interface StationPlayback {
  title?: string;
  artist?: string;
  albumImage?: string;
  durationSec?: number;
  positionMs?: number;
  isPlaying?: boolean;
}

export interface StationDetail {
  id: number;
  title: string;
  inviteCode: string;
  status: 'ACTIVE' | 'CLOSED' | string;
  host: StationUserInfo;
  maxParticipants: number;
  participants: StationParticipant[];
  bannedUsers?: BannedUser[];
  playback?: StationPlayback;
  createdAt: string;
  isPrivate?: boolean;
}

export interface StationListItem {
  id: number;
  title: string;
  inviteCode: string;
  hostNickname: string;
  participantCount: number;
  maxParticipants: number;
  isLive: boolean;
  isPrivate?: boolean;
  host?: StationUserInfo;
}

export interface CreateStationRequest {
  title: string;
  maxParticipants?: number;
  isPrivate?: boolean;
}

export interface CreateStationResponse {
  id: number;
  title: string;
  inviteCode: string;
  isPrivate?: boolean;
}

// ===== Station API Functions =====

// Create a new station
export const createStation = async (
  userId: number, 
  request: CreateStationRequest
): Promise<CreateStationResponse | null> => {
  try {
    const response = await apiClient.post('/api/stations', request, {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('스테이션 생성 오류:', error);
    return null;
  }
};

// Get list of active stations
export const getActiveStations = async (): Promise<StationListItem[]> => {
  try {
    const response = await apiClient.get('/api/stations');
    return response.data;
  } catch (error) {
    console.error('스테이션 목록 조회 오류:', error);
    return [];
  }
};

// Get station details
export const getStationDetail = async (stationId: number): Promise<StationDetail | null> => {
  try {
    const response = await apiClient.get(`/api/stations/${stationId}`);
    return response.data;
  } catch (error) {
    console.error('스테이션 상세 조회 오류:', error);
    return null;
  }
};

// Join station by invite code
export const joinStation = async (
  userId: number, 
  inviteCode: string
): Promise<StationDetail | null> => {
  try {
    const response = await apiClient.post(`/api/stations/join`, null, {
      params: { userId, inviteCode }
    });
    return response.data;
  } catch (error) {
    console.error('스테이션 입장 오류:', error);
    return null;
  }
};

// Leave station
export const leaveStation = async (
  stationId: number, 
  userId: number
): Promise<{ success: boolean }> => {
  try {
    const response = await apiClient.post(`/api/stations/${stationId}/leave`, null, {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('스테이션 퇴장 오류:', error);
    return { success: false };
  }
};

// Ban user from station (host only) - permanent ban
export const banStationUser = async (
  stationId: number, 
  hostUserId: number, 
  targetUserId: number
): Promise<{ success: boolean }> => {
  try {
    const response = await apiClient.post(`/api/stations/${stationId}/ban`, null, {
      params: { userId: hostUserId, targetUserId }
    });
    return response.data;
  } catch (error) {
    console.error('스테이션 영구추방 오류:', error);
    return { success: false };
  }
};

// Unban user from station (host only)
export const unbanStationUser = async (
  stationId: number, 
  hostUserId: number, 
  targetUserId: number
): Promise<{ success: boolean }> => {
  try {
    const response = await apiClient.post(`/api/stations/${stationId}/unban`, null, {
      params: { userId: hostUserId, targetUserId }
    });
    return response.data;
  } catch (error) {
    console.error('스테이션 차단해제 오류:', error);
    return { success: false };
  }
};

// Transfer host role to another participant (host only)
export const transferStationHost = async (
  stationId: number,
  currentHostId: number,
  newHostId: number
): Promise<{ success: boolean; newHostId?: number }> => {
  try {
    const response = await apiClient.post(`/api/stations/${stationId}/transfer-host`, null, {
      params: { userId: currentHostId, newHostId }
    });
    return response.data;
  } catch (error) {
    console.error('호스트 이전 오류:', error);
    return { success: false };
  }
};

// Delete/close station (host only)
export const deleteStation = async (
  stationId: number, 
  userId: number
): Promise<boolean> => {
  try {
    await apiClient.delete(`/api/stations/${stationId}`, {
      params: { userId }
    });
    return true;
  } catch (error) {
    console.error('스테이션 삭제 오류:', error);
    return false;
  }
};

// Update station title (host only)
export const updateStationTitle = async (
  stationId: number,
  userId: number,
  title: string
): Promise<{ success: boolean; title?: string }> => {
  try {
    const response = await apiClient.patch(`/api/stations/${stationId}/title`, { title }, {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('스테이션 제목 변경 오류:', error);
    return { success: false };
  }
};
