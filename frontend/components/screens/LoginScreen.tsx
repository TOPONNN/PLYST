import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Eye, EyeOff, Music2, X, AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { login, reactivateAccount } from "../../services/api";

const imgBackground = "/background.jpg";

// 구글 OAuth 설정
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_REDIRECT_URI = window.location.origin + "/auth/google/callback";

// 카카오 OAuth 설정
const KAKAO_CLIENT_ID = import.meta.env.VITE_KAKAO_CLIENT_ID;
const KAKAO_REDIRECT_URI = window.location.origin + "/auth/kakao/callback";

const POPUP_WIDTH = 500;
const POPUP_HEIGHT = 600;

interface LoginScreenProps {
  onSignupClick: () => void;
  onLoginSuccess: () => void;
  onSocialSignupNeeded?: () => void;
  onFindAccountClick?: () => void;
}

export default function LoginScreen({
  onSignupClick,
  onLoginSuccess,
  onSocialSignupNeeded,
  onFindAccountClick,
}: LoginScreenProps) {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem("rememberMe") === "true";
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [showDormantModal, setShowDormantModal] = useState(false);
  const [dormantUserId, setDormantUserId] = useState<number | null>(null);
  const [dormantPassword, setDormantPassword] = useState("");
  const [reactivating, setReactivating] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const popupCheckIntervalRef = useRef<number | null>(null);

  const clearPopupCheck = useCallback(() => {
    if (popupCheckIntervalRef.current) {
      clearTimeout(popupCheckIntervalRef.current);
      popupCheckIntervalRef.current = null;
    }
    popupRef.current = null;
  }, []);

  const startPopupCheck = useCallback(() => {
    // COOP 정책으로 인해 popup.closed 접근 시 콘솔 경고가 발생하므로
    // postMessage 기반으로만 처리하고, 5분 타임아웃으로 자동 정리
    const timeoutId = window.setTimeout(() => {
      setSocialLoading(null);
      clearPopupCheck();
    }, 5 * 60 * 1000); // 5분 타임아웃

    popupCheckIntervalRef.current = timeoutId as unknown as number;
  }, [clearPopupCheck]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const { type, payload } = event.data || {};
      
      if (type === "SOCIAL_LOGIN_SUCCESS") {
        clearPopupCheck();
        localStorage.setItem("userId", String(payload.id));
        localStorage.setItem("userNickname", payload.nickname);
        localStorage.setItem("userEmail", payload.email);
        if (payload.profileImage) {
          localStorage.setItem("userProfileImage", payload.profileImage);
        }
        if (payload.provider) {
          localStorage.setItem("userProvider", payload.provider);
        }
        setSocialLoading(null);
        onLoginSuccess();
      } else if (type === "SOCIAL_SIGNUP_NEEDED") {
        clearPopupCheck();
        sessionStorage.setItem("socialSignupData", JSON.stringify(payload));
        setSocialLoading(null);
        onSocialSignupNeeded?.();
      } else if (type === "SOCIAL_LOGIN_ERROR") {
        clearPopupCheck();
        setError(payload.message || "소셜 로그인 실패");
        setSocialLoading(null);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onLoginSuccess, onSocialSignupNeeded, clearPopupCheck]);

  useEffect(() => {
    return () => {
      if (popupCheckIntervalRef.current) {
        clearTimeout(popupCheckIntervalRef.current);
      }
    };
  }, []);

  const openPopup = (url: string, title: string): Window | null => {
    const left = window.screenX + (window.outerWidth - POPUP_WIDTH) / 2;
    const top = window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2;
    
    const popup = window.open(
      url,
      title,
      `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );
    
    return popup;
  };

  // 구글 로그인 처리
  const handleGoogleLogin = () => {
    setError("");
    const scope = encodeURIComponent("email profile");
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}&response_type=token&scope=${scope}`;
    
    const popup = openPopup(googleAuthUrl, "Google Login");
    
    if (popup) {
      popupRef.current = popup;
      setSocialLoading("google");
      startPopupCheck();
    } else {
      setError("팝업이 차단되었습니다. 팝업 차단을 해제해주세요.");
    }
  };

  const handleKakaoLogin = () => {
    setError("");
    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_CLIENT_ID}&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}&response_type=code`;
    
    const popup = openPopup(kakaoAuthUrl, "Kakao Login");
    
    if (popup) {
      popupRef.current = popup;
      setSocialLoading("kakao");
      startPopupCheck();
    } else {
      setError("팝업이 차단되었습니다. 팝업 차단을 해제해주세요.");
    }
  };

  const saveUserSession = (id: number, nickname: string, email: string, profileImage?: string) => {
    localStorage.setItem("userId", String(id));
    localStorage.setItem("userNickname", nickname);
    localStorage.setItem("userEmail", email);
    if (profileImage) {
      localStorage.setItem("userProfileImage", profileImage);
    }
    localStorage.setItem("rememberMe", String(rememberMe));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!userId || !password) {
      setError("사용자 ID와 비밀번호를 입력해주세요");
      return;
    }

    setIsLoading(true);
    try {
      const response = await login({ userId, password, rememberMe });
      if (response.success) {
        saveUserSession(response.id, response.nickname, response.email, response.profileImage);
        onLoginSuccess();
      } else if (response.dormant) {
        setDormantUserId(response.id);
        setDormantPassword(password);
        setShowDormantModal(true);
      } else {
        setError(response.message || "로그인에 실패했습니다");
      }
    } catch (err) {
      setError("로그인 중 오류가 발생했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!dormantUserId) return;
    
    setReactivating(true);
    try {
      const response = await reactivateAccount({ userId: dormantUserId, password: dormantPassword });
      if (response.success) {
        setShowDormantModal(false);
        const loginResponse = await login({ userId, password, rememberMe });
        if (loginResponse.success) {
          saveUserSession(loginResponse.id, loginResponse.nickname, loginResponse.email, loginResponse.profileImage);
          onLoginSuccess();
        }
      } else {
        setError(response.message || "휴면 해제에 실패했습니다");
        setShowDormantModal(false);
      }
    } catch (err) {
      setError("휴면 해제 중 오류가 발생했습니다");
      setShowDormantModal(false);
    } finally {
      setReactivating(false);
    }
  };

  return (
    <div
      className="absolute inset-0 bg-center bg-cover bg-no-repeat flex items-center justify-center p-4"
      style={{
        backgroundImage: `url('${imgBackground}')`,
      }}
    >
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Glassy card */}
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="bg-white/20 backdrop-blur-lg border border-white/30 rounded-2xl p-4">
              <Music2 className="w-12 h-12 text-white" strokeWidth={1.5} />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-white text-3xl text-center mb-2">로그인</h2>
          <p className="text-white/70 text-center mb-8">
            계정에 로그인하여 음악을 즐기세요
          </p>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* User ID Input */}
            <div className="space-y-2">
              <Label htmlFor="userId" className="text-white">
                사용자 ID
              </Label>
              <Input
                id="userId"
                type="text"
                placeholder="사용자 ID를 입력하세요"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50 backdrop-blur-sm focus:bg-white/20 focus:border-white/40"
              />
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">
                비밀번호
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="비밀번호를 입력하세요"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 backdrop-blur-sm focus:bg-white/20 focus:border-white/40 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="rememberMe" className="text-white/80 cursor-pointer select-none text-sm">
                자동 로그인
              </Label>
              <button
                type="button"
                role="switch"
                aria-checked={rememberMe}
                onClick={() => setRememberMe(!rememberMe)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-white/30 ${
                  rememberMe ? "bg-emerald-500" : "bg-white/20"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
                    rememberMe ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/20 border border-red-500/30 rounded-lg px-4 py-2 text-red-200 text-sm"
              >
                {error}
              </motion.div>
            )}

            {/* Login Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm transition-all duration-300 hover:scale-105 active:scale-95"
            >
              {isLoading ? "로그인 중..." : "로그인"}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-6">
            <div className="flex-1 h-px bg-white/20"></div>
            <span className="px-4 text-white/50 text-sm">또는</span>
            <div className="flex-1 h-px bg-white/20"></div>
          </div>

          {/* Social Login Buttons */}
          <div className="space-y-3">
            {/* Google Login */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={socialLoading !== null}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 font-medium py-3 px-4 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              {socialLoading === "google" ? (
                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              <span>{socialLoading === "google" ? "처리 중..." : "Google로 계속하기"}</span>
            </button>

            {/* Kakao Login */}
            <button
              type="button"
              onClick={handleKakaoLogin}
              disabled={socialLoading !== null}
              className="w-full flex items-center justify-center gap-3 bg-[#FEE500] hover:bg-[#FDD835] text-[#3C1E1E] font-medium py-3 px-4 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              {socialLoading === "kakao" ? (
                <div className="w-5 h-5 border-2 border-[#3C1E1E]/40 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#3C1E1E">
                  <path d="M12 3C6.48 3 2 6.58 2 11c0 2.83 1.82 5.32 4.56 6.73-.19.67-.68 2.42-.78 2.8-.12.47.17.47.36.34.15-.1 2.37-1.61 3.33-2.26.51.08 1.03.12 1.53.12 5.52 0 10-3.58 10-8s-4.48-8-10-8z"/>
                </svg>
              )}
              <span>{socialLoading === "kakao" ? "처리 중..." : "카카오로 계속하기"}</span>
            </button>
          </div>

          {/* Find Account Link */}
          <div className="mt-4 text-center">
            <button
              onClick={onFindAccountClick}
              className="text-white/60 hover:text-white text-sm hover:underline"
            >
              아이디 / 비밀번호 찾기
            </button>
          </div>

          {/* Signup Link */}
          <div className="mt-4 text-center">
            <p className="text-white/70 text-sm">
              계정이 없으신가요?{" "}
              <button
                onClick={onSignupClick}
                className="text-white hover:underline"
              >
                회원가입
              </button>
            </p>
          </div>
        </div>
      </motion.div>

      {/* Dormant Account Modal */}
      <AnimatePresence>
        {showDormantModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDormantModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/20 rounded-full">
                    <AlertTriangle className="w-6 h-6 text-amber-400" />
                  </div>
                  <h3 className="text-white text-lg font-semibold">휴면 계정</h3>
                </div>
                <button
                  onClick={() => setShowDormantModal(false)}
                  className="text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-white/70 text-sm mb-6">
                오랫동안 로그인하지 않아 휴면 상태로 전환된 계정입니다.
                <br />
                <span className="text-white/90">휴면을 해제하고 계속 사용하시겠습니까?</span>
              </p>

              <div className="flex gap-3">
                <Button
                  onClick={() => setShowDormantModal(false)}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/20"
                >
                  취소
                </Button>
                <Button
                  onClick={handleReactivate}
                  disabled={reactivating}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white border-0"
                >
                  {reactivating ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      처리 중...
                    </div>
                  ) : (
                    "휴면 해제"
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
