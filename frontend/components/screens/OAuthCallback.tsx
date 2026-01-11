import { useEffect, useState } from "react";
import { socialLogin } from "../../services/api";

type MessageType = "SOCIAL_LOGIN_SUCCESS" | "SOCIAL_SIGNUP_NEEDED" | "SOCIAL_LOGIN_ERROR";

interface SocialLoginPayload {
  id: number;
  nickname: string;
  email: string;
  profileImage?: string;
  provider?: string;
}

interface SocialSignupPayload {
  provider: string;
  providerId: string;
  email: string;
  name: string;
  profileImage?: string;
}

interface ErrorPayload {
  message: string;
}

function sendMessageToOpener(type: MessageType, payload: SocialLoginPayload | SocialSignupPayload | ErrorPayload) {
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({ type, payload }, window.location.origin);
    window.close();
  } else {
    if (type === "SOCIAL_LOGIN_SUCCESS") {
      const p = payload as SocialLoginPayload;
      localStorage.setItem("userId", String(p.id));
      localStorage.setItem("userNickname", p.nickname);
      localStorage.setItem("userEmail", p.email);
      if (p.profileImage) {
        localStorage.setItem("userProfileImage", p.profileImage);
      }
      if (p.provider) {
        localStorage.setItem("userProvider", p.provider);
      }
      localStorage.setItem("socialLoginSuccess", "true");
    } else if (type === "SOCIAL_SIGNUP_NEEDED") {
      localStorage.setItem("socialSignupData", JSON.stringify(payload));
    } else if (type === "SOCIAL_LOGIN_ERROR") {
      localStorage.setItem("socialLoginError", (payload as ErrorPayload).message);
    }
    window.location.href = window.location.origin;
  }
}

export default function OAuthCallback() {
  const [status, setStatus] = useState("처리 중...");

  useEffect(() => {
    const processOAuth = async () => {
      const hash = window.location.hash;
      const search = window.location.search;
      const path = window.location.pathname;
      
      if (path.includes("/auth/google/callback") && hash.includes("access_token=")) {
        const accessToken = hash.split("access_token=")[1]?.split("&")[0];
        if (accessToken) {
          setStatus("구글 로그인 처리 중...");
          try {
            const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            const data = await response.json();
            
            const result = await socialLogin({
              provider: "google",
              providerId: data.id,
              email: data.email,
              name: data.name,
              profileImage: data.picture
            });

            if (result.success) {
              setStatus("로그인 성공!");
              sendMessageToOpener("SOCIAL_LOGIN_SUCCESS", {
                id: result.id,
                nickname: result.nickname,
                email: result.email,
                profileImage: result.profileImage,
                provider: "google"
              });
            } else if (result.message === "NEED_SIGNUP") {
              setStatus("회원가입이 필요합니다...");
              sendMessageToOpener("SOCIAL_SIGNUP_NEEDED", {
                provider: "google",
                providerId: data.id,
                email: data.email,
                name: data.name,
                profileImage: data.picture
              });
            } else {
              setStatus("로그인 실패");
              sendMessageToOpener("SOCIAL_LOGIN_ERROR", {
                message: result.message || "로그인 실패"
              });
            }
          } catch {
            setStatus("오류 발생");
            sendMessageToOpener("SOCIAL_LOGIN_ERROR", {
              message: "구글 로그인 처리 중 오류 발생"
            });
          }
          return;
        }
      }
      
      if (path.includes("/auth/kakao/callback") && search.includes("code=")) {
        const code = new URLSearchParams(search).get("code");
        if (code) {
          setStatus("카카오 로그인 처리 중...");
          try {
            const response = await fetch(
              `https://plyst.info/api/users/kakao-login?code=${code}&redirectUri=${encodeURIComponent(window.location.origin + "/auth/kakao/callback")}`
            );
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();

            if (result.success) {
              setStatus("로그인 성공!");
              sendMessageToOpener("SOCIAL_LOGIN_SUCCESS", {
                id: result.id,
                nickname: result.nickname,
                email: result.email,
                profileImage: result.profileImage,
                provider: "kakao"
              });
            } else if (result.message === "NEED_SIGNUP") {
              setStatus("회원가입이 필요합니다...");
              sendMessageToOpener("SOCIAL_SIGNUP_NEEDED", {
                provider: "kakao",
                providerId: result.providerId,
                email: result.email,
                name: result.name,
                profileImage: result.profileImage
              });
            } else {
              setStatus("로그인 실패");
              sendMessageToOpener("SOCIAL_LOGIN_ERROR", {
                message: result.message || "카카오 로그인 실패"
              });
            }
          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "알 수 없는 오류";
            setStatus("오류 발생: " + errorMessage);
            sendMessageToOpener("SOCIAL_LOGIN_ERROR", {
              message: "카카오 로그인 처리 중 오류: " + errorMessage
            });
          }
          return;
        }
      }

      if (search.includes("error=") || hash.includes("error=")) {
        const error = new URLSearchParams(search).get("error") || 
                      new URLSearchParams(hash.substring(1)).get("error");
        setStatus("오류 발생");
        sendMessageToOpener("SOCIAL_LOGIN_ERROR", {
          message: error || "인증 오류"
        });
      }
    };

    processOAuth();
  }, []);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center text-white">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p>{status}</p>
        <p className="text-sm text-white/60 mt-2">잠시만 기다려주세요</p>
      </div>
    </div>
  );
}
