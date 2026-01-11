import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Eye, EyeOff, Check, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Progress } from "../ui/progress";
import { signup, checkUserIdDuplicate, checkNicknameDuplicate, checkEmailDuplicate, socialSignup } from "../../services/api";

const imgBackground = "/background.jpg";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_REDIRECT_URI = window.location.origin + "/auth/google/callback";

const KAKAO_CLIENT_ID = import.meta.env.VITE_KAKAO_CLIENT_ID;
const KAKAO_REDIRECT_URI = window.location.origin + "/auth/kakao/callback";

const POPUP_WIDTH = 500;
const POPUP_HEIGHT = 600;

interface SignupScreenProps {
  onBack: () => void;
  onSignupSuccess: () => void;
}

export default function SignupScreen({
  onBack,
  onSignupSuccess,
}: SignupScreenProps) {
  const [formData, setFormData] = useState({
    nickname: "",
    userId: "",
    email: "",
    password: "",
    passwordConfirm: "",
    realName: "",
    phoneNumber: "",
    gender: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isUserIdChecked, setIsUserIdChecked] = useState(false);
  const [isNicknameChecked, setIsNicknameChecked] = useState(false);
  const [isEmailChecked, setIsEmailChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const popupCheckIntervalRef = useRef<number | null>(null);

  const [socialData, setSocialData] = useState<{
    provider: string;
    providerId: string;
    email: string;
    name: string;
    profileImage?: string;
  } | null>(null);

  const startPopupCheck = useCallback(() => {
    popupCheckIntervalRef.current = window.setInterval(() => {
      try {
        if (popupRef.current && popupRef.current.closed) {
          setSocialLoading(null);
          if (popupCheckIntervalRef.current) {
            clearInterval(popupCheckIntervalRef.current);
            popupCheckIntervalRef.current = null;
          }
          popupRef.current = null;
        }
      } catch {
        // COOP 정책으로 인해 cross-origin 팝업 상태 접근 불가
      }
    }, 500);
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const { type, payload } = event.data || {};
      
      if (type === "SOCIAL_LOGIN_SUCCESS") {
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
        onSignupSuccess();
      } else if (type === "SOCIAL_SIGNUP_NEEDED") {
        setSocialData({
          provider: payload.provider,
          providerId: payload.providerId,
          email: payload.email,
          name: payload.name,
          profileImage: payload.profileImage
        });
        setFormData(prev => ({
          ...prev,
          email: payload.email,
          realName: payload.name,
        }));
        setSocialLoading(null);
      } else if (type === "SOCIAL_LOGIN_ERROR") {
        setErrors({ general: payload.message || "소셜 로그인 실패" });
        setSocialLoading(null);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onSignupSuccess]);

  useEffect(() => {
    const signupDataStr = sessionStorage.getItem("socialSignupData");
    if (signupDataStr) {
      sessionStorage.removeItem("socialSignupData");
      try {
        const data = JSON.parse(signupDataStr);
        setSocialData({
          provider: data.provider,
          providerId: data.providerId,
          email: data.email,
          name: data.name,
          profileImage: data.profileImage
        });
        setFormData(prev => ({
          ...prev,
          email: data.email,
          realName: data.name,
        }));
      } catch {
        setErrors({ general: "소셜 로그인 데이터 처리 오류" });
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (popupCheckIntervalRef.current) {
        clearInterval(popupCheckIntervalRef.current);
      }
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
    };
  }, []);

  const openPopup = (url: string, title: string): Window | null => {
    const left = window.screenX + (window.outerWidth - POPUP_WIDTH) / 2;
    const top = window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2;
    
    return window.open(
      url,
      title,
      `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );
  };

  const handleGoogleSignup = () => {
    setErrors({});
    const scope = encodeURIComponent("email profile");
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}&response_type=token&scope=${scope}`;
    
    const popup = openPopup(googleAuthUrl, "Google Signup");
    
    if (popup) {
      popupRef.current = popup;
      setSocialLoading("google");
      startPopupCheck();
    } else {
      setErrors({ general: "팝업이 차단되었습니다. 팝업 차단을 해제해주세요." });
    }
  };

  const handleKakaoSignup = () => {
    setErrors({});
    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_CLIENT_ID}&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}&response_type=code`;
    
    const popup = openPopup(kakaoAuthUrl, "Kakao Signup");
    
    if (popup) {
      popupRef.current = popup;
      setSocialLoading("kakao");
      startPopupCheck();
    } else {
      setErrors({ general: "팝업이 차단되었습니다. 팝업 차단을 해제해주세요." });
    }
  };

  // 소셜 회원가입 제출
  const handleSocialSignupSubmit = async () => {
    if (!socialData) return;
    
    const nicknameError = validateNickname(formData.nickname);
    if (nicknameError) {
      setErrors({ nickname: nicknameError });
      return;
    }

    setIsLoading(true);
    try {
      const result = await socialSignup({
        provider: socialData.provider,
        providerId: socialData.providerId,
        email: socialData.email,
        name: socialData.name,
        nickname: formData.nickname,
        profileImage: socialData.profileImage,
      });

      if (result.success) {
        localStorage.setItem("userId", String(result.id));
        localStorage.setItem("userNickname", result.nickname);
        localStorage.setItem("userEmail", result.email);
        if (socialData.profileImage) {
          localStorage.setItem("userProfileImage", socialData.profileImage);
        }
        localStorage.setItem("userProvider", socialData.provider);
        onSignupSuccess();
      } else {
        setErrors({ general: result.message || "회원가입에 실패했습니다" });
      }
    } catch {
      setErrors({ general: "회원가입 중 오류가 발생했습니다" });
    } finally {
      setIsLoading(false);
    }
  };

  // Validation functions
  const validateNickname = (value: string) => {
    if (value.length < 2 || value.length > 10) {
      return "닉네임은 2-10자여야 합니다";
    }
    return "";
  };

  const validateUserId = (value: string) => {
    if (value.length < 6 || value.length > 10) {
      return "사용자 ID는 6-10자여야 합니다";
    }
    if (!/^[a-zA-Z0-9]+$/.test(value)) {
      return "영문자와 숫자만 사용 가능합니다";
    }
    return "";
  };

  const validateEmail = (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return "올바른 이메일 형식이 아닙니다";
    }
    return "";
  };

  const validatePassword = (value: string) => {
    if (value.length < 4) {
      return "비밀번호는 최소 4자 이상이어야 합니다";
    }
    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(value)) {
      return "영문과 숫자를 포함해야 합니다";
    }
    return "";
  };

  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 4) strength += 50;
    if (/[a-z]/.test(password)) strength += 15;
    if (/[A-Z]/.test(password)) strength += 15;
    if (/\d/.test(password)) strength += 10;
    if (/[!@#$%^&*]/.test(password)) strength += 10;
    return Math.min(strength, 100);
  };

  const validateRealName = (value: string) => {
    if (value.length < 2 || value.length > 5) {
      return "실명은 2-5자여야 합니다";
    }
    if (!/^[가-힣]+$/.test(value)) {
      return "한글만 입력 가능합니다";
    }
    return "";
  };

  const validatePhoneNumber = (value: string) => {
    const phoneRegex = /^010-\d{4}-\d{4}$/;
    if (!phoneRegex.test(value)) {
      return "010-XXXX-XXXX 형식으로 입력하세요";
    }
    return "";
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    
    if (errors[field]) {
      setErrors({ ...errors, [field]: "" });
    }

    if (field === "nickname") {
      setIsNicknameChecked(false);
    }
    if (field === "userId") {
      setIsUserIdChecked(false);
    }
    if (field === "email") {
      setIsEmailChecked(false);
    }

    if (field === "phoneNumber") {
      let formatted = value.replace(/[^0-9]/g, "");
      if (formatted.length > 3) {
        formatted = formatted.slice(0, 3) + "-" + formatted.slice(3);
      }
      if (formatted.length > 8) {
        formatted = formatted.slice(0, 8) + "-" + formatted.slice(8, 12);
      }
      setFormData({ ...formData, [field]: formatted });
    }
  };

  const handleBlur = async (field: string, value: string) => {
    let error = "";
    switch (field) {
      case "nickname":
        error = validateNickname(value);
        if (!error && value) {
          try {
            const response = await checkNicknameDuplicate(value);
            if (response.exists) {
              error = "이미 사용 중인 닉네임입니다";
              setIsNicknameChecked(false);
            } else {
              setIsNicknameChecked(true);
            }
          } catch {
            error = "중복 확인 중 오류가 발생했습니다";
          }
        }
        break;
      case "userId":
        error = validateUserId(value);
        if (!error && value) {
          try {
            const response = await checkUserIdDuplicate(value);
            if (response.exists) {
              error = "이미 사용 중인 ID입니다";
              setIsUserIdChecked(false);
            } else {
              setIsUserIdChecked(true);
            }
          } catch {
            error = "중복 확인 중 오류가 발생했습니다";
          }
        }
        break;
      case "email":
        error = validateEmail(value);
        if (!error && value) {
          try {
            const response = await checkEmailDuplicate(value);
            if (response.exists) {
              error = "이미 사용 중인 이메일입니다";
              setIsEmailChecked(false);
            } else {
              setIsEmailChecked(true);
            }
          } catch {
            error = "중복 확인 중 오류가 발생했습니다";
          }
        }
        break;
      case "password":
        error = validatePassword(value);
        break;
      case "passwordConfirm":
        if (value !== formData.password) {
          error = "비밀번호가 일치하지 않습니다";
        }
        break;
      case "realName":
        error = validateRealName(value);
        break;
      case "phoneNumber":
        error = validatePhoneNumber(value);
        break;
    }
    setErrors({ ...errors, [field]: error });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const newErrors: Record<string, string> = {};
    newErrors.nickname = validateNickname(formData.nickname);
    newErrors.userId = validateUserId(formData.userId);
    newErrors.email = validateEmail(formData.email);
    newErrors.password = validatePassword(formData.password);
    if (formData.passwordConfirm !== formData.password) {
      newErrors.passwordConfirm = "비밀번호가 일치하지 않습니다";
    }
    newErrors.realName = validateRealName(formData.realName);
    newErrors.phoneNumber = validatePhoneNumber(formData.phoneNumber);

    if (!formData.gender) {
      newErrors.gender = "성별을 선택해주세요";
    }

    if (!isUserIdChecked) {
      newErrors.userId = "중복 확인이 필요합니다";
    }

    if (!isNicknameChecked) {
      newErrors.nickname = "중복 확인이 필요합니다";
    }

    if (!isEmailChecked) {
      newErrors.email = "중복 확인이 필요합니다";
    }

    const hasErrors = Object.values(newErrors).some((error) => error !== "");
    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      const response = await signup({
        nickname: formData.nickname,
        userId: formData.userId,
        email: formData.email,
        password: formData.password,
        realName: formData.realName,
        phoneNumber: formData.phoneNumber,
        gender: formData.gender,
      });
      
      if (response.success) {
        alert('회원가입이 완료되었습니다!');
        onSignupSuccess();
      } else {
        setErrors({ ...newErrors, submit: response.message });
      }
    } catch (err) {
      setErrors({ ...newErrors, submit: '회원가입 중 오류가 발생했습니다.' });
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength(formData.password);

  return (
    <div
      className="absolute inset-0 bg-center bg-cover bg-no-repeat overflow-y-auto"
      style={{
        backgroundImage: `url('${imgBackground}')`,
      }}
    >
      {/* Dark overlay for 20% opacity */}
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />
      
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-2xl"
        >
          {/* Glassy card */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl">
            {/* Header */}
            <div className="flex items-center mb-6">
              <button
                onClick={onBack}
                className="text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h2 className="text-white text-3xl ml-4">회원가입</h2>
            </div>

            {/* Progress */}
            <div className="mb-8">
              <div className="flex justify-between text-white/70 text-sm mb-2">
                <span>{socialData ? "닉네임 설정" : "회원 정보 입력"}</span>
                <span>
                  {socialData 
                    ? (formData.nickname ? "1" : "0") + " / 1"
                    : Object.values(formData).filter((v) => v !== "").length + " / 8"
                  }
                </span>
              </div>
              <Progress
                value={
                  socialData 
                    ? (formData.nickname ? 100 : 0)
                    : (Object.values(formData).filter((v) => v !== "").length / 8) * 100
                }
                className="h-2 bg-white/10"
              />
            </div>

            {socialData ? (
              <div className="space-y-5">
                <div className="bg-white/10 border border-white/20 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-4">
                    {socialData.profileImage ? (
                      <img
                        src={socialData.profileImage}
                        alt="Profile"
                        className="w-16 h-16 rounded-full object-cover border-2 border-white/30"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                        <span className="text-white text-2xl font-medium">
                          {socialData.name?.charAt(0) || "?"}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="text-white/80 text-sm mb-1">
                        {socialData.provider === "google" ? "Google" : "Kakao"}로 연결됨
                      </p>
                      <p className="text-white font-medium">{socialData.email}</p>
                      {socialData.name && (
                        <p className="text-white/60 text-sm">{socialData.name}</p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="nickname" className="text-white">
                    닉네임 <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="nickname"
                    value={formData.nickname}
                    onChange={(e) => handleInputChange("nickname", e.target.value)}
                    onBlur={(e) => handleBlur("nickname", e.target.value)}
                    placeholder="2-10자 닉네임을 입력하세요"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50 backdrop-blur-sm focus:bg-white/20 focus:border-white/40"
                  />
                  {errors.nickname && (
                    <p className="text-red-300 text-sm flex items-center gap-1">
                      <X className="w-3 h-3" /> {errors.nickname}
                    </p>
                  )}
                </div>

                {errors.general && (
                  <p className="text-red-300 text-sm text-center">{errors.general}</p>
                )}

                <Button
                  type="button"
                  onClick={handleSocialSignupSubmit}
                  disabled={!formData.nickname || isLoading}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium py-3 rounded-xl disabled:opacity-50"
                >
                  {isLoading ? "가입 중..." : "가입 완료"}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setSocialData(null);
                    setFormData(prev => ({ ...prev, email: "", realName: "" }));
                  }}
                  className="w-full text-white/60 hover:text-white text-sm py-2"
                >
                  다른 방법으로 가입하기
                </button>
              </div>
            ) : (
              <>
                {/* 소셜 로그인 버튼 */}
                <div className="mb-6">
                  <div className="flex gap-3">
                    {/* 구글 로그인 버튼 */}
                    <button
                      type="button"
                      onClick={handleGoogleSignup}
                      disabled={socialLoading !== null}
                      className="flex-1 flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-700 font-medium py-3 px-4 rounded-xl transition-all disabled:opacity-50 shadow-lg"
                    >
                      {socialLoading === "google" ? (
                        <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                      )}
                      <span>Google</span>
                    </button>

                    {/* 카카오 로그인 버튼 */}
                    <button
                      type="button"
                      onClick={handleKakaoSignup}
                      disabled={socialLoading !== null}
                      className="flex-1 flex items-center justify-center gap-3 bg-[#FEE500] hover:bg-[#FDD800] text-[#191919] font-medium py-3 px-4 rounded-xl transition-all disabled:opacity-50 shadow-lg"
                    >
                      {socialLoading === "kakao" ? (
                        <div className="w-5 h-5 border-2 border-[#191919]/40 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path
                            fill="#191919"
                            d="M12 3C6.48 3 2 6.58 2 11c0 2.84 1.87 5.33 4.67 6.77l-.95 3.53c-.08.3.24.55.5.4l4.2-2.78c.52.05 1.05.08 1.58.08 5.52 0 10-3.58 10-8s-4.48-8-10-8z"
                          />
                        </svg>
                      )}
                      <span>Kakao</span>
                    </button>
                  </div>
                </div>

                {/* 구분선 */}
                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/20"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-transparent text-white/60 backdrop-blur-sm">
                      또는 이메일로 가입
                    </span>
                  </div>
                </div>

                {errors.general && (
                  <p className="text-red-300 text-sm text-center mb-4">{errors.general}</p>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
              {/* Nickname */}
              <div className="space-y-2">
                <Label htmlFor="nickname" className="text-white">
                  닉네임 <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="nickname"
                  value={formData.nickname}
                  onChange={(e) => handleInputChange("nickname", e.target.value)}
                  onBlur={(e) => handleBlur("nickname", e.target.value)}
                  placeholder="2-10자"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 backdrop-blur-sm focus:bg-white/20 focus:border-white/40"
                />
                {isNicknameChecked && !errors.nickname && (
                  <p className="text-green-300 text-sm flex items-center gap-1">
                    <Check className="w-3 h-3" /> 사용 가능한 닉네임입니다
                  </p>
                )}
                {errors.nickname && (
                  <p className="text-red-300 text-sm flex items-center gap-1">
                    <X className="w-3 h-3" /> {errors.nickname}
                  </p>
                )}
              </div>

              {/* User ID */}
              <div className="space-y-2">
                <Label htmlFor="userId" className="text-white">
                  사용자 ID <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="userId"
                  value={formData.userId}
                  onChange={(e) => handleInputChange("userId", e.target.value)}
                  onBlur={(e) => handleBlur("userId", e.target.value)}
                  placeholder="6-10자 영문, 숫자"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 backdrop-blur-sm focus:bg-white/20 focus:border-white/40"
                />
                {isUserIdChecked && !errors.userId && (
                  <p className="text-green-300 text-sm flex items-center gap-1">
                    <Check className="w-3 h-3" /> 사용 가능한 ID입니다
                  </p>
                )}
                {errors.userId && (
                  <p className="text-red-300 text-sm flex items-center gap-1">
                    <X className="w-3 h-3" /> {errors.userId}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">
                  이메일 <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  onBlur={(e) => handleBlur("email", e.target.value)}
                  placeholder="example@email.com"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 backdrop-blur-sm focus:bg-white/20 focus:border-white/40"
                />
                {isEmailChecked && !errors.email && (
                  <p className="text-green-300 text-sm flex items-center gap-1">
                    <Check className="w-3 h-3" /> 사용 가능한 이메일입니다
                  </p>
                )}
                {errors.email && (
                  <p className="text-red-300 text-sm flex items-center gap-1">
                    <X className="w-3 h-3" /> {errors.email}
                  </p>
                )}
              </div>

              {/* Password with strength indicator */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white">
                  비밀번호 <span className="text-red-400">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) =>
                      handleInputChange("password", e.target.value)
                    }
                    onBlur={(e) => handleBlur("password", e.target.value)}
                    placeholder="영문, 숫자 포함 4자 이상"
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
                {formData.password && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm text-white/70">
                      <span>비밀번호 강도</span>
                      <span>
                        {passwordStrength < 40 && "약함"}
                        {passwordStrength >= 40 && passwordStrength < 70 && "보통"}
                        {passwordStrength >= 70 && "강함"}
                      </span>
                    </div>
                    <Progress
                      value={passwordStrength}
                      className="h-2 bg-white/10"
                    />
                  </div>
                )}
                {errors.password && (
                  <p className="text-red-300 text-sm flex items-center gap-1">
                    <X className="w-3 h-3" /> {errors.password}
                  </p>
                )}
              </div>

              {/* Password Confirm */}
              <div className="space-y-2">
                <Label htmlFor="passwordConfirm" className="text-white">
                  비밀번호 확인 <span className="text-red-400">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="passwordConfirm"
                    type={showPasswordConfirm ? "text" : "password"}
                    value={formData.passwordConfirm}
                    onChange={(e) =>
                      handleInputChange("passwordConfirm", e.target.value)
                    }
                    onBlur={(e) =>
                      handleBlur("passwordConfirm", e.target.value)
                    }
                    placeholder="비밀번호를 다시 입력하세요"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50 backdrop-blur-sm focus:bg-white/20 focus:border-white/40 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
                  >
                    {showPasswordConfirm ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {formData.passwordConfirm &&
                  formData.passwordConfirm === formData.password && (
                    <p className="text-green-300 text-sm flex items-center gap-1">
                      <Check className="w-3 h-3" /> 비밀번호가 일치합니다
                    </p>
                  )}
                {errors.passwordConfirm && (
                  <p className="text-red-300 text-sm flex items-center gap-1">
                    <X className="w-3 h-3" /> {errors.passwordConfirm}
                  </p>
                )}
              </div>

              {/* Real Name */}
              <div className="space-y-2">
                <Label htmlFor="realName" className="text-white">
                  실명 <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="realName"
                  value={formData.realName}
                  onChange={(e) => handleInputChange("realName", e.target.value)}
                  onBlur={(e) => handleBlur("realName", e.target.value)}
                  placeholder="2-5자 한글"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 backdrop-blur-sm focus:bg-white/20 focus:border-white/40"
                />
                {errors.realName && (
                  <p className="text-red-300 text-sm flex items-center gap-1">
                    <X className="w-3 h-3" /> {errors.realName}
                  </p>
                )}
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <Label htmlFor="phoneNumber" className="text-white">
                  전화번호 <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={(e) =>
                    handleInputChange("phoneNumber", e.target.value)
                  }
                  onBlur={(e) => handleBlur("phoneNumber", e.target.value)}
                  placeholder="010-XXXX-XXXX"
                  maxLength={13}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 backdrop-blur-sm focus:bg-white/20 focus:border-white/40"
                />
                {errors.phoneNumber && (
                  <p className="text-red-300 text-sm flex items-center gap-1">
                    <X className="w-3 h-3" /> {errors.phoneNumber}
                  </p>
                )}
              </div>

              {/* Gender */}
              <div className="space-y-2">
                <Label className="text-white">
                  성별 <span className="text-red-400">*</span>
                </Label>
                <RadioGroup
                  value={formData.gender}
                  onValueChange={(value) => handleInputChange("gender", value)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value="male"
                      id="male"
                      className="border-white/40 text-white"
                    />
                    <Label
                      htmlFor="male"
                      className="text-white cursor-pointer"
                    >
                      남성
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value="female"
                      id="female"
                      className="border-white/40 text-white"
                    />
                    <Label
                      htmlFor="female"
                      className="text-white cursor-pointer"
                    >
                      여성
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value="other"
                      id="other"
                      className="border-white/40 text-white"
                    />
                    <Label
                      htmlFor="other"
                      className="text-white cursor-pointer"
                    >
                      기타
                    </Label>
                  </div>
                </RadioGroup>
                {errors.gender && (
                  <p className="text-red-300 text-sm flex items-center gap-1">
                    <X className="w-3 h-3" /> {errors.gender}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm transition-all duration-300 hover:scale-105 active:scale-95 mt-8"
              >
                {isLoading ? "가입 중..." : "회원가입"}
              </Button>
            </form>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
