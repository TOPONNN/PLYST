# PLYST

> **Play + Playlist = PLYST**  
> 음악을 함께 듣고, 공유하고, 소통하는 음악 커뮤니티 플랫폼

[![Live Demo](https://img.shields.io/badge/Live-plyst.info-blue?style=for-the-badge)](https://plyst.info/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.x-6DB33F?style=flat-square&logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

---

## Overview

**PLYST**는 사용자가 플레이리스트를 생성하고 공유하며, 실시간으로 함께 음악을 즐길 수 있는 음악 커뮤니티 플랫폼입니다.

기존 음악 서비스의 개인 중심 감상 한계를 넘어, **AI 기반 음악 추천**과 **실시간 스테이션** 기능을 통해 사용자 간 소통과 참여를 강화합니다.

### Key Features

| Feature | Description |
|---------|-------------|
| **Playlist Sharing** | 플레이리스트를 게시글처럼 생성하고, 좋아요/댓글/공유 가능 |
| **AI Recommendation** | ChatGPT 기반 키워드 음악 추천 (3개 플레이리스트 × 10곡) |
| **Station** | 실시간 채팅과 함께 YouTube MV를 동시 시청하는 공간 |
| **Real-time Sync** | WebSocket 기반 실시간 알림 및 동기화 (40~50ms 딜레이) |
| **Live Subtitles** | Whisper API를 활용한 실시간 자막 및 번역 |
| **Social Login** | Google, Kakao OAuth 연동 |

---

## Tech Stack

### Frontend
- **React 18** + **TypeScript**
- **Vite** - Build tool
- **Shadcn UI** (Tailwind CSS + Radix UI)
- **STOMP.js** - WebSocket client

### Backend
- **Java 21** + **Spring Boot 3.x**
- **Spring Data JPA** - ORM
- **Spring WebSocket** + **STOMP** - Real-time communication
- **MySQL 8.0** - Database

### External APIs
| API | Usage |
|-----|-------|
| Spotify Web API | 음악 검색 및 메타데이터 |
| YouTube Data API | MV 검색 및 재생 |
| OpenAI ChatGPT | AI 플레이리스트 추천 |
| OpenAI Whisper | 실시간 자막 생성 |
| Brave Search API | 플레이리스트 커버 이미지 검색 |

### Infrastructure
- **AWS EC2** - Hosting
- **Docker** + **Docker Compose** - Containerization
- **Nginx** - Reverse proxy & SSL termination
- **Let's Encrypt** - HTTPS

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client                               │
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │   React App     │    │   WebSocket     │                 │
│  │   (Vite)        │    │   (STOMP)       │                 │
│  └────────┬────────┘    └────────┬────────┘                 │
└───────────┼──────────────────────┼──────────────────────────┘
            │ HTTPS                │ WSS
            ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                      Nginx (Reverse Proxy)                   │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Spring Boot Backend                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ REST API │  │WebSocket │  │ Services │  │   JPA    │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                        MySQL 8.0                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- Java 21+ (for local development)

### Quick Start with Docker

```bash
# 1. Clone the repository
git clone https://github.com/TOPONNN/PLYST.git
cd PLYST

# 2. Create .env file
cp .env.example .env
# Edit .env with your credentials

# 3. Run with Docker Compose
docker-compose up -d
```

### Local Development

**Backend:**
```bash
cd backend
./gradlew bootRun
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## Environment Variables

### Root `.env`

```env
# Database
DB_PASSWORD=your_mysql_root_password

# Email (Gmail SMTP)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password

# Spotify API
SPOTIFY_CLIENTID=your_spotify_client_id
SPOTIFY_CLIENTSECRET=your_spotify_client_secret

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Brave Search (for cover image search)
BRAVE_SEARCH_API_KEY=your_brave_search_api_key
```

### Frontend `.env`

```env
# Google OAuth
VITE_GOOGLE_CLIENT_ID=your_google_client_id

# Kakao OAuth
VITE_KAKAO_CLIENT_ID=your_kakao_client_id
```

### API Keys 발급 안내

| Service | URL |
|---------|-----|
| Spotify Developer | https://developer.spotify.com/dashboard |
| OpenAI API | https://platform.openai.com/api-keys |
| Brave Search | https://brave.com/search/api/ |
| Google Cloud Console | https://console.cloud.google.com/ |
| Kakao Developers | https://developers.kakao.com/ |
| Gmail App Password | https://myaccount.google.com/apppasswords |

---

## Project Structure

```
PLYST/
├── backend/
│   ├── src/main/java/com/plyst/
│   │   ├── config/          # Configuration classes
│   │   ├── controller/      # REST & WebSocket controllers
│   │   ├── dto/             # Data Transfer Objects
│   │   ├── entity/          # JPA Entities
│   │   ├── repository/      # Spring Data repositories
│   │   └── service/         # Business logic
│   └── build.gradle
│
├── frontend/
│   ├── components/
│   │   ├── screens/         # Page components
│   │   └── ui/              # Reusable UI components
│   ├── hooks/               # Custom React hooks
│   ├── services/            # API clients
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

---

## Screenshots

> 🎵 **Main Page** - 플레이리스트 피드  
> 🎧 **Station** - 실시간 음악 감상 공간  
> 🤖 **AI Recommend** - ChatGPT 기반 추천  

---

## Team

**클라우드 데브옵스 프론트엔드&백엔드 자바(JAVA) 풀스택 개발자 취업캠프 - 2조**

| Name | Role | Responsibilities |
|------|------|-----------------|
| 윤희준 | **Team Lead** / Backend | 전체 UI 설계, AWS 배포, AI 서비스, Station 기능 |
| 김성민 | Frontend | UI/UX 설계 (Figma), 모달 기능, API 연동 |
| 김관익 | Backend | 로그인/회원관리, 소셜 연동, 이메일 인증 |
| 박찬진 | Backend | API 연동, 인기 플레이리스트, AWS 테스트 |
| 정훈호 | Backend | WebSocket 실시간 처리, Station UI, DB 설계 |

---

## License

This project was created as part of an educational program.

---

<div align="center">
  <sub>Built with ❤️ by Team 2</sub>
</div>
