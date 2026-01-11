<p align="center">
  <img src="https://img.shields.io/badge/PLYST-Music%20Community-8B5CF6?style=for-the-badge&logoColor=white" alt="PLYST"/>
</p>

<h1 align="center">PLYST</h1>

<p align="center">
  <strong>Playlist + List = PLYST</strong><br/>
  <sub>음악을 함께 듣고, 공유하고, 소통하는 음악 커뮤니티 플랫폼</sub>
</p>

<p align="center">
  <a href="https://plyst.info/">
    <img src="https://img.shields.io/badge/🎵%20Live%20Demo-plyst.info-8B5CF6?style=for-the-badge" alt="Live Demo"/>
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Spring%20Boot-6DB33F?style=flat-square&logo=springboot&logoColor=white"/>
  <img src="https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black"/>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/MySQL-4479A1?style=flat-square&logo=mysql&logoColor=white"/>
  <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white"/>
  <img src="https://img.shields.io/badge/AWS-232F3E?style=flat-square&logo=amazonaws&logoColor=white"/>
</p>

---

## 📖 소개

**PLYST**는 단순히 음악을 듣는 것을 넘어, 사람들과 **함께** 음악을 즐기는 경험을 제공합니다.

> 🎧 나만의 플레이리스트를 만들고 공유하세요  
> 🤖 AI가 당신의 취향에 맞는 음악을 추천해드립니다  
> 📺 스테이션에서 친구들과 실시간으로 뮤직비디오를 감상하세요  

---

## ✨ 주요 기능

<table>
  <tr>
    <td align="center" width="33%">
      <h3>🎵</h3>
      <b>플레이리스트</b><br/>
      <sub>생성 · 공유 · 검색</sub>
    </td>
    <td align="center" width="33%">
      <h3>🤖</h3>
      <b>AI 추천</b><br/>
      <sub>ChatGPT 기반 맞춤 추천</sub>
    </td>
    <td align="center" width="33%">
      <h3>📺</h3>
      <b>스테이션</b><br/>
      <sub>실시간 동시 감상</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <h3>💬</h3>
      <b>소셜 기능</b><br/>
      <sub>좋아요 · 댓글 · 팔로우</sub>
    </td>
    <td align="center">
      <h3>📝</h3>
      <b>실시간 자막</b><br/>
      <sub>Whisper AI 번역 자막</sub>
    </td>
    <td align="center">
      <h3>🔐</h3>
      <b>소셜 로그인</b><br/>
      <sub>Google · Kakao</sub>
    </td>
  </tr>
</table>

---

## 🛠 기술 스택

### Frontend
```
React 18  ·  TypeScript  ·  Vite  ·  Tailwind CSS  ·  Shadcn UI  ·  STOMP.js
```

### Backend
```
Java 21  ·  Spring Boot 3.x  ·  Spring Data JPA  ·  WebSocket  ·  MySQL 8.0
```

### Infrastructure
```
AWS EC2  ·  Docker  ·  Nginx  ·  Let's Encrypt (HTTPS)
```

### External APIs
| API | 용도 |
|:---:|:---|
| **Spotify** | 음악 검색 및 메타데이터 |
| **YouTube** | 뮤직비디오 검색 및 재생 |
| **OpenAI GPT** | AI 플레이리스트 추천 |
| **OpenAI Whisper** | 실시간 자막 생성 |
| **Brave Search** | 커버 이미지 검색 |

---

## 🏗 아키텍처

```
                              ┌──────────────┐
                              │    Client    │
                              │  React App   │
                              └──────┬───────┘
                                     │ HTTPS / WSS
                              ┌──────▼───────┐
                              │    Nginx     │
                              │   (Proxy)    │
                              └──────┬───────┘
                                     │
                              ┌──────▼───────┐
                              │ Spring Boot  │
                              │   Backend    │
                              └──────┬───────┘
                                     │
                              ┌──────▼───────┐
                              │   MySQL 8    │
                              │   Database   │
                              └──────────────┘
```

---

## 🚀 시작하기

### Docker로 실행 (권장)

```bash
# 1. 저장소 클론
git clone https://github.com/TOPONNN/PLYST.git
cd PLYST

# 2. 환경변수 설정
cp .env.example .env
# .env 파일을 열어 필요한 값 입력

# 3. 실행
docker-compose up -d
```

### 로컬 개발 환경

**Backend**
```bash
cd backend
./gradlew bootRun
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

---

## ⚙️ 환경변수 설정

### 루트 디렉토리 `.env`

| 변수명 | 설명 | 발급처 |
|:---|:---|:---|
| `DB_PASSWORD` | MySQL 비밀번호 | - |
| `MAIL_USERNAME` | Gmail 주소 | - |
| `MAIL_PASSWORD` | Gmail 앱 비밀번호 | [Google 계정](https://myaccount.google.com/apppasswords) |
| `SPOTIFY_CLIENTID` | Spotify Client ID | [Spotify Developer](https://developer.spotify.com/dashboard) |
| `SPOTIFY_CLIENTSECRET` | Spotify Client Secret | [Spotify Developer](https://developer.spotify.com/dashboard) |
| `OPENAI_API_KEY` | OpenAI API Key | [OpenAI Platform](https://platform.openai.com/api-keys) |
| `BRAVE_SEARCH_API_KEY` | Brave Search API Key | [Brave Search](https://brave.com/search/api/) |

### Frontend `.env`

| 변수명 | 설명 | 발급처 |
|:---|:---|:---|
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID | [Google Cloud Console](https://console.cloud.google.com/) |
| `VITE_KAKAO_CLIENT_ID` | Kakao OAuth App Key | [Kakao Developers](https://developers.kakao.com/) |

<details>
<summary><b>📄 .env.example 전체 보기</b></summary>

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

# Brave Search
BRAVE_SEARCH_API_KEY=your_brave_search_api_key
```

</details>

---

## 📁 프로젝트 구조

```
PLYST/
│
├── 📂 backend/
│   └── src/main/java/com/plyst/
│       ├── config/        # 설정
│       ├── controller/    # API 컨트롤러
│       ├── dto/           # 데이터 전송 객체
│       ├── entity/        # JPA 엔티티
│       ├── repository/    # 데이터 접근 계층
│       └── service/       # 비즈니스 로직
│
├── 📂 frontend/
│   ├── components/        # React 컴포넌트
│   │   ├── screens/       # 페이지 컴포넌트
│   │   └── ui/            # 공통 UI 컴포넌트
│   ├── hooks/             # 커스텀 훅
│   └── services/          # API 클라이언트
│
├── 📄 docker-compose.yml
└── 📄 README.md
```

---

## 👥 팀원

<table>
  <tr>
    <td align="center">
      <b>윤희준</b><br/>
      <sub>팀장 · Backend</sub><br/>
      <sub>배포 · AI 서비스 · Station</sub>
    </td>
    <td align="center">
      <b>김성민</b><br/>
      <sub>Frontend</sub><br/>
      <sub>UI/UX 설계 · API 연동</sub>
    </td>
    <td align="center">
      <b>김관익</b><br/>
      <sub>Backend</sub><br/>
      <sub>회원관리 · 소셜 로그인</sub>
    </td>
    <td align="center">
      <b>박찬진</b><br/>
      <sub>Backend</sub><br/>
      <sub>API 연동 · 인기 플레이리스트</sub>
    </td>
    <td align="center">
      <b>정훈호</b><br/>
      <sub>Backend</sub><br/>
      <sub>WebSocket · DB 설계</sub>
    </td>
  </tr>
</table>

<p align="center">
  <sub>클라우드 데브옵스 프론트엔드&백엔드 자바(JAVA) 풀스택 개발자 취업캠프 - 2조</sub>
</p>

---

<p align="center">
  <sub>Made with ❤️ by Team PLYST</sub>
</p>
