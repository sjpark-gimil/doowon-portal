# Doowon Portal

두원공조 포탈 시스템 - 주간보고관리, 출장보고관리, 하드웨어관리

## 개요

Doowon Portal은 두원공조의 업무 관리를 위한 웹 포탈 시스템입니다. Codebeamer를 백엔드로 사용하여 다음 기능들을 제공합니다:

- **주간보고관리**: 주간 보고서 작성, 제출 및 관리
- **출장보고관리**: 출장 보고서 작성, 승인 및 관리  
- **하드웨어관리**: 하드웨어 자산 등록, 관리 및 추적

## 기능

### 1. 주간보고관리 (Weekly Report Management)
- 주간 보고서 작성 및 편집
- 보고서 제출 및 상태 관리
- 첨부파일 지원
- 보고서 검색 및 필터링

### 2. 출장보고관리 (Travel Report Management)
- 출장 보고서 작성
- 경비 내역 관리
- 출장 일정 관리
- 승인 워크플로우

### 3. 하드웨어관리 (Hardware Management)
- 하드웨어 자산 등록
- 사용자 배정 및 위치 관리
- 보증 기간 추적
- 수리 및 유지보수 관리

## 기술 스택

- **Frontend**: HTML, CSS, JavaScript, EJS
- **Backend**: Node.js, Express.js
- **Database**: Codebeamer (외부 API)
- **Authentication**: Express Session

## 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
`.env` 파일을 생성하고 다음 변수들을 설정하세요:
```
CB_BASE_URL=your_codebeamer_url
SESSION_SECRET=your_session_secret
```

### 3. 애플리케이션 실행
```bash
# 개발 모드
npm run dev

# 프로덕션 모드
npm start
```

### 4. 접속
브라우저에서 `http://localhost:3000`으로 접속하세요.

## Codebeamer 연동

이 포탈은 Codebeamer를 백엔드 데이터베이스로 사용합니다. Codebeamer의 프로젝트, 트래커, 필드 설정은 정적으로 관리되며, 나중에 설정 정보를 제공받아 연동할 예정입니다.

## 개발자 정보

- **회사**: 두원공조
- **버전**: 1.0.0
- **라이선스**: ISC

## 라이선스

ISC License