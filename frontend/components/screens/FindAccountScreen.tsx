import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Eye, EyeOff, Mail, Check, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  sendVerificationCode,
  verifyCode,
  findUserId,
  resetPassword,
} from "../../services/api";

const imgBackground = "/background.jpg";

interface FindAccountScreenProps {
  onBack: () => void;
}

type TabType = "find-id" | "reset-password";
type StepType = "email" | "verify" | "result" | "new-password";

export default function FindAccountScreen({ onBack }: FindAccountScreenProps) {
  const [activeTab, setActiveTab] = useState<TabType>("find-id");
  const [step, setStep] = useState<StepType>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [foundUserId, setFoundUserId] = useState("");
  const [maskedUserId, setMaskedUserId] = useState("");
  const [showFullId, setShowFullId] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const resetState = () => {
    setStep("email");
    setEmail("");
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
    setFoundUserId("");
    setMaskedUserId("");
    setShowFullId(false);
    setError("");
    setSuccess("");
    setCountdown(0);
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    resetState();
  };

  const validateEmail = (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const handleSendCode = async () => {
    if (!email) {
      setError("이메일을 입력해주세요.");
      return;
    }
    if (!validateEmail(email)) {
      setError("올바른 이메일 형식이 아닙니다.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await sendVerificationCode({
        email,
        purpose: activeTab === "find-id" ? "FIND_ID" : "RESET_PASSWORD",
      });

      if (response.success) {
        setStep("verify");
        setCountdown(600);
        setSuccess("인증번호가 이메일로 발송되었습니다.");
      } else {
        setError(response.message);
      }
    } catch {
      setError("인증번호 발송에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code || code.length !== 6) {
      setError("6자리 인증번호를 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      if (activeTab === "find-id") {
        const response = await findUserId({ email, code });
        if (response.success && response.userId) {
          setFoundUserId(response.userId);
          setMaskedUserId(response.maskedUserId || response.userId);
          setStep("result");
        } else {
          setError(response.message);
        }
      } else {
        const response = await verifyCode({ email, code });
        if (response.verified) {
          setStep("new-password");
          setSuccess("");
        } else {
          setError(response.message);
        }
      }
    } catch {
      setError("인증에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword) {
      setError("새 비밀번호를 입력해주세요.");
      return;
    }
    if (newPassword.length < 4) {
      setError("비밀번호는 최소 4자 이상이어야 합니다.");
      return;
    }
    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) {
      setError("비밀번호는 영문과 숫자를 포함해야 합니다.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await resetPassword({ email, code, newPassword });
      if (response.success) {
        setStep("result");
        setSuccess("비밀번호가 성공적으로 변경되었습니다.");
      } else {
        setError(response.message);
      }
    } catch {
      setError("비밀번호 변경에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatCountdown = () => {
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className="absolute inset-0 bg-center bg-cover bg-no-repeat overflow-y-auto"
      style={{ backgroundImage: `url('${imgBackground}')` }}
    >
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />

      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl">
            <div className="flex items-center mb-6">
              <button
                onClick={onBack}
                className="text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h2 className="text-white text-2xl ml-4">계정 찾기</h2>
            </div>

            <div className="flex mb-6 bg-white/10 rounded-xl p-1">
              <button
                onClick={() => handleTabChange("find-id")}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "find-id"
                    ? "bg-white/20 text-white"
                    : "text-white/60 hover:text-white"
                }`}
              >
                아이디 찾기
              </button>
              <button
                onClick={() => handleTabChange("reset-password")}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "reset-password"
                    ? "bg-white/20 text-white"
                    : "text-white/60 hover:text-white"
                }`}
              >
                비밀번호 찾기
              </button>
            </div>

            {step === "email" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-5"
              >
                <p className="text-white/70 text-sm text-center mb-4">
                  {activeTab === "find-id"
                    ? "가입 시 등록한 이메일로 아이디를 찾을 수 있습니다."
                    : "가입 시 등록한 이메일로 비밀번호를 재설정할 수 있습니다."}
                </p>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white">
                    이메일
                  </Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="example@email.com"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50 backdrop-blur-sm focus:bg-white/20 focus:border-white/40 pr-10"
                    />
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-500/20 border border-red-500/30 rounded-lg px-4 py-2 text-red-200 text-sm flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    {error}
                  </motion.div>
                )}

                <Button
                  onClick={handleSendCode}
                  disabled={isLoading}
                  className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm transition-all duration-300"
                >
                  {isLoading ? "발송 중..." : "인증번호 받기"}
                </Button>
              </motion.div>
            )}

            {step === "verify" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-5"
              >
                <div className="text-center mb-4">
                  <p className="text-white/70 text-sm">
                    <span className="text-white font-medium">{email}</span>으로
                  </p>
                  <p className="text-white/70 text-sm">인증번호를 발송했습니다.</p>
                  {countdown > 0 && (
                    <p className="text-white/50 text-sm mt-2">
                      남은 시간: {formatCountdown()}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code" className="text-white">
                    인증번호
                  </Label>
                  <Input
                    id="code"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6자리 숫자"
                    maxLength={6}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50 backdrop-blur-sm focus:bg-white/20 focus:border-white/40 text-center text-xl tracking-widest"
                  />
                </div>

                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-green-500/20 border border-green-500/30 rounded-lg px-4 py-2 text-green-200 text-sm flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    {success}
                  </motion.div>
                )}

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-500/20 border border-red-500/30 rounded-lg px-4 py-2 text-red-200 text-sm flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    {error}
                  </motion.div>
                )}

                <Button
                  onClick={handleVerifyCode}
                  disabled={isLoading || code.length !== 6}
                  className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm transition-all duration-300"
                >
                  {isLoading ? "확인 중..." : "인증하기"}
                </Button>

                <button
                  onClick={() => {
                    setCountdown(0);
                    handleSendCode();
                  }}
                  disabled={isLoading}
                  className="w-full text-white/60 hover:text-white text-sm py-2"
                >
                  인증번호 다시 받기
                </button>
              </motion.div>
            )}

            {step === "new-password" && activeTab === "reset-password" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-5"
              >
                <p className="text-white/70 text-sm text-center mb-4">
                  새로운 비밀번호를 입력해주세요.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-white">
                    새 비밀번호
                  </Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="영문, 숫자 포함 4자 이상"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50 backdrop-blur-sm focus:bg-white/20 focus:border-white/40 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-white">
                    비밀번호 확인
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="비밀번호를 다시 입력하세요"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50 backdrop-blur-sm focus:bg-white/20 focus:border-white/40 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword === newPassword && (
                    <p className="text-green-300 text-sm flex items-center gap-1">
                      <Check className="w-3 h-3" /> 비밀번호가 일치합니다
                    </p>
                  )}
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-500/20 border border-red-500/30 rounded-lg px-4 py-2 text-red-200 text-sm flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    {error}
                  </motion.div>
                )}

                <Button
                  onClick={handleResetPassword}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium py-3 rounded-xl"
                >
                  {isLoading ? "변경 중..." : "비밀번호 변경"}
                </Button>
              </motion.div>
            )}

            {step === "result" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-5"
              >
                {activeTab === "find-id" ? (
                  <div className="text-center">
                    <div className="bg-white/10 rounded-xl p-6 mb-4">
                      <p className="text-white/70 text-sm mb-2">회원님의 아이디는</p>
                      <p className="text-white text-2xl font-bold mb-2">
                        {showFullId ? foundUserId : maskedUserId}
                      </p>
                      <button
                        onClick={() => setShowFullId(!showFullId)}
                        className="text-white/60 hover:text-white text-sm underline"
                      >
                        {showFullId ? "아이디 숨기기" : "전체 아이디 보기"}
                      </button>
                    </div>
                    <p className="text-white/50 text-sm">
                      위 아이디로 로그인해주세요.
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-6 mb-4">
                      <Check className="w-12 h-12 text-green-400 mx-auto mb-3" />
                      <p className="text-white text-lg font-medium">
                        비밀번호가 변경되었습니다
                      </p>
                    </div>
                    <p className="text-white/50 text-sm">
                      새로운 비밀번호로 로그인해주세요.
                    </p>
                  </div>
                )}

                <Button
                  onClick={onBack}
                  className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm transition-all duration-300"
                >
                  로그인으로 돌아가기
                </Button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
