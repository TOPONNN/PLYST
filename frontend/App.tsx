import { useState, useEffect, lazy, Suspense } from "react";

// Lazy load screens for code splitting
const SplashScreen = lazy(() => import("./components/screens/SplashScreen"));
const LoginScreen = lazy(() => import("./components/screens/LoginScreen"));
const SignupScreen = lazy(() => import("./components/screens/SignupScreen"));
const HomeScreen = lazy(() => import("./components/screens/HomeScreen"));
const OAuthCallback = lazy(() => import("./components/screens/OAuthCallback"));
const FindAccountScreen = lazy(() => import("./components/screens/FindAccountScreen"));
const StationScreen = lazy(() => import("./components/screens/StationScreen"));

type Screen = "splash" | "login" | "signup" | "home" | "oauth-callback" | "find-account" | "station";

const getPlaylistIdFromUrl = (): number | null => {
  const match = window.location.pathname.match(/^\/playlist\/(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
};

// Loading fallback component
const ScreenLoader = () => (
  <div className="flex items-center justify-center w-full h-full min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
    <div className="flex gap-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-3 h-3 bg-white rounded-full animate-pulse"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  </div>
);

const isLoggedIn = (): boolean => {
  const rememberMe = localStorage.getItem("rememberMe") === "true";
  const storage = rememberMe ? localStorage : sessionStorage;
  return !!storage.getItem("userId");
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>(() => {
    const path = window.location.pathname;
    if (path.includes("/auth/google/callback") || path.includes("/auth/kakao/callback")) {
      return "oauth-callback";
    }
    if (path.startsWith("/playlist/")) {
      return "splash";
    }
    return "splash";
  });
  
  const [sharedPlaylistId] = useState<number | null>(() => getPlaylistIdFromUrl());
  const [activeStationId, setActiveStationId] = useState<number | null>(null);

  useEffect(() => {
    if (currentScreen === "splash") {
      const timer = setTimeout(() => {
        if (isLoggedIn()) {
          setCurrentScreen("home");
        } else {
          setCurrentScreen("login");
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentScreen]);

  const navigateToScreen = (screen: Screen) => {
    setCurrentScreen(screen);
  };

  const navigateToStation = (stationId: number) => {
    setActiveStationId(stationId);
    setCurrentScreen("station");
  };

  return (
    <div className="relative w-full h-full overflow-hidden min-h-screen">
      <Suspense fallback={<ScreenLoader />}>
        {currentScreen === "splash" && <SplashScreen />}
        {currentScreen === "login" && (
          <LoginScreen
            onSignupClick={() => navigateToScreen("signup")}
            onLoginSuccess={() => navigateToScreen("home")}
            onSocialSignupNeeded={() => navigateToScreen("signup")}
            onFindAccountClick={() => navigateToScreen("find-account")}
          />
        )}
        {currentScreen === "signup" && (
          <SignupScreen
            onBack={() => navigateToScreen("login")}
            onSignupSuccess={() => navigateToScreen("home")}
          />
        )}
        {currentScreen === "find-account" && (
          <FindAccountScreen onBack={() => navigateToScreen("login")} />
        )}
        {currentScreen === "home" && (
          <HomeScreen 
            onLogout={() => navigateToScreen("login")} 
            sharedPlaylistId={sharedPlaylistId}
            onNavigateToStation={navigateToStation}
          />
        )}
        {currentScreen === "oauth-callback" && <OAuthCallback />}
        {currentScreen === "station" && activeStationId && (
          <StationScreen 
            stationId={activeStationId} 
            onExit={() => {
              setActiveStationId(null);
              navigateToScreen("home");
            }} 
          />
        )}
      </Suspense>
    </div>
  );
}
