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

### 🎵 플레이리스트
- Spotify API를 통한 음악 검색 및 추가
- 커버 이미지, 제목, 설명, 태그 설정
- 공개/비공개 설정 및 공유 링크 생성
- 좋아요, 댓글, 조회수 표시
- 드래그 앤 드롭으로 곡 순서 변경

### 🤖 AI 음악 추천
- ChatGPT 기반 키워드 맞춤 추천
- 한 번에 3개의 플레이리스트 × 10곡 제안
- Brave Search API로 커버 이미지 자동 검색

### 📺 스테이션 (실시간 동시 감상)
- YouTube MV 실시간 동기화 재생 (40~50ms 딜레이)
- 참여자 간 실시간 채팅
- 호스트 권한 관리 (재생 제어, 강퇴, 권한 양도)
- 공개/비공개 방 생성 및 초대 코드
- Whisper API 기반 실시간 자막 및 번역

### 💬 소셜 기능
- 좋아요, 댓글, 팔로우
- 실시간 알림 (WebSocket)
- 사용자 차단 및 관리

### 🔐 회원 관리
- 이메일 회원가입 및 로그인
- Google, Kakao 소셜 로그인
- 이메일 인증을 통한 아이디/비밀번호 찾기
- JWT 기반 자동 로그인

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

## 👥 팀 소개

<table>
  <thead>
    <tr>
      <th>이름</th>
      <th>역할</th>
      <th>담당 업무</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><b>윤희준</b></td>
      <td align="center">팀장 / Backend</td>
      <td>
        • 전체 UI 설계 및 로고 제작<br/>
        • AWS 환경 세팅 및 도메인 배포<br/>
        • Docker 이미지 배포<br/>
        • ChatGPT 기반 AI 추천 플레이리스트 설계<br/>
        • 플레이리스트 커버 이미지 검색 기능<br/>
        • 스테이션 기능 구현
      </td>
    </tr>
    <tr>
      <td align="center"><b>김성민</b></td>
      <td align="center">Frontend</td>
      <td>
        • Figma를 이용한 전체 UI/UX 설계<br/>
        • 주요 페이지 모달 기능 구현<br/>
        • 컴포넌트 구조 정리 및 재사용성 확보<br/>
        • Frontend API 연동
      </td>
    </tr>
    <tr>
      <td align="center"><b>김관익</b></td>
      <td align="center">Backend</td>
      <td>
        • 로그인/회원가입 구현 및 설계<br/>
        • 좋아요/팔로우/회원탈퇴 구현<br/>
        • Google, Kakao 소셜 연동 회원가입<br/>
        • 이메일 인증을 통한 아이디/비밀번호 찾기
      </td>
    </tr>
    <tr>
      <td align="center"><b>박찬진</b></td>
      <td align="center">Backend</td>
      <td>
        • API 연동 정보 및 사용법 조사<br/>
        • 기능 및 UI 아이디어 제안<br/>
        • 요구사항 분석서 설계<br/>
        • AWS 배포 테스트<br/>
        • 인기 플레이리스트 기능 구현
      </td>
    </tr>
    <tr>
      <td align="center"><b>정훈호</b></td>
      <td align="center">Backend</td>
      <td>
        • WebSocket을 이용한 메인 페이지 실시간 처리<br/>
        • 스테이션 페이지 UI/UX 설계<br/>
        • 클래스 다이어그램 및 데이터베이스 설계<br/>
        • 협업 도구(Notion, Discord, GitHub) 관리
      </td>
    </tr>
  </tbody>
</table>

<br/>

<p align="center">
  <sub>클라우드 데브옵스 프론트엔드&백엔드 자바(JAVA) 풀스택 개발자 취업캠프 - <b>2조</b></sub>
</p>

---

<p align="center">
  <sub>Made with ❤️ by Team PLYST</sub>
</p>
