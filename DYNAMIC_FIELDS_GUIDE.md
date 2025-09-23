# Dynamic Field System Guide

## 개요

Doowon Portal의 동적 필드 시스템은 Codebeamer를 백엔드로 사용하여 각 관리 페이지의 필드를 동적으로 구성하고 관리할 수 있는 시스템입니다.

## 주요 특징

### 1. 4가지 필드 타입 지원
- **String (문자열)**: 텍스트 입력 필드
- **Number (숫자)**: 숫자 입력 필드
- **Calendar (날짜)**: 날짜 선택 필드
- **Selector (선택)**: 드롭다운 선택 필드

### 2. 동적 필드 관리
- 관리자가 웹 인터페이스를 통해 필드를 추가/수정/삭제
- 실시간 필드 미리보기
- Codebeamer 필드 ID 매핑
- 필수/읽기전용 설정

### 3. Codebeamer 통합
- Codebeamer API를 통한 실시간 연결 테스트
- 필드 매핑 검증
- 트래커별 필드 정의 조회

## 시스템 구조

### 파일 구조
```
views/
├── admin-dynamic.ejs          # 동적 관리자 페이지
├── weekly-reports-dynamic.ejs # 동적 주간보고 페이지
└── ...

public/js/
└── dynamic-forms.js           # 동적 폼 핸들러

data/
└── field-configs.json         # 필드 설정 저장소
```

### API 엔드포인트
```
GET  /api/admin/field-configs           # 모든 필드 설정 조회
POST /api/admin/field-configs           # 필드 설정 저장
GET  /api/admin/field-configs/:section  # 특정 섹션 필드 설정 조회
GET  /api/field-configs/:section        # 공개 필드 설정 조회
POST /api/admin/test-field-mapping      # 필드 매핑 테스트
```

## 사용 방법

### 1. 관리자 페이지 접근
```
http://localhost:3000/admin/dynamic
```

### 2. 필드 추가
1. 필드 타입 선택 (String, Number, Calendar, Selector)
2. 관리 섹션 선택 (주간보고, 출장보고, 하드웨어, 장비, 교육)
3. 필드명 입력
4. Codebeamer 필드 ID 입력
5. 필수/읽기전용 설정
6. 선택 필드의 경우 옵션 입력
7. "필드 추가" 버튼 클릭

### 3. 필드 관리
- **수정**: 필드 목록에서 "수정" 버튼 클릭
- **삭제**: 필드 목록에서 "삭제" 버튼 클릭
- **매핑 저장**: 섹션별 "매핑 저장" 버튼
- **매핑 테스트**: Codebeamer 연결 테스트

### 4. 동적 페이지 사용
```
http://localhost:3000/weekly-reports/dynamic
```

## 필드 설정 구조

### 기본 필드 설정
```json
{
  "id": 1,
  "name": "보고서 제목",
  "codebeamerId": "name",
  "type": "string",
  "required": true,
  "readonly": true,
  "options": []
}
```

### 필드 타입별 설정

#### String 필드
```json
{
  "type": "string",
  "options": []
}
```

#### Number 필드
```json
{
  "type": "number",
  "options": []
}
```

#### Calendar 필드
```json
{
  "type": "calendar",
  "options": []
}
```

#### Selector 필드
```json
{
  "type": "selector",
  "options": ["옵션1", "옵션2", "옵션3"]
}
```

## JavaScript API

### DynamicFormHandler 클래스
```javascript
// 필드 설정 로드
await dynamicFormHandler.loadFieldConfigs('weekly-reports');

// 동적 폼 렌더링
await dynamicFormHandler.renderForm('containerId', 'weekly-reports', initialData);

// 동적 테이블 렌더링
await dynamicFormHandler.renderTable('containerId', items, 'weekly-reports');

// 폼 데이터 가져오기
const formData = dynamicFormHandler.getFormData();

// 폼 검증
const validation = dynamicFormHandler.validateForm();

// 폼 초기화
dynamicFormHandler.clearForm();
```

### 전역 함수
```javascript
// 동적 폼 로드
await loadDynamicForm('containerId', 'weekly-reports', initialData);

// 동적 테이블 로드
await loadDynamicTable('containerId', items, 'weekly-reports');

// 폼 데이터 가져오기
const formData = getFormData();

// 폼 검증
const validation = validateForm();

// 폼 초기화
clearForm();
```

## 기본 필드 설정

### 주간보고관리 (weekly-reports)
- 보고서 제목 (name) - String, 필수, 읽기전용
- 보고 주차 (custom_field_1) - String, 필수
- 작성일 (submittedAt) - Calendar, 필수, 읽기전용
- 사업부 (custom_field_2) - String
- 금주 주간보고 (custom_field_3) - String, 필수
- 차주 주간보고 (custom_field_4) - String
- 첨부파일 (attachments) - String, 읽기전용
- 상태 (status) - String, 필수, 읽기전용

### 출장보고관리 (travel-reports)
- 보고서 제목 (name) - String, 필수, 읽기전용
- 출장지 (custom_field_5) - String, 필수
- 출장 목적 (custom_field_6) - String, 필수
- 출발일 (custom_field_7) - Calendar, 필수
- 귀환일 (custom_field_8) - Calendar, 필수
- 동행자 (custom_field_9) - String
- 교통비 (custom_field_10) - Number
- 숙박비 (custom_field_11) - Number
- 식비 (custom_field_12) - Number
- 기타 경비 (custom_field_13) - Number
- 출장 내용 (description) - String, 필수

### 하드웨어관리 (hardware-management)
- 하드웨어명 (name) - String, 필수, 읽기전용
- HW 버전 (custom_field_3) - String, 필수, 읽기전용
- SW 버전 (custom_field_10002) - String, 읽기전용
- 차종 (custom_field_1000) - Selector, 필수, 읽기전용
- 변경사항 (custom_field_1001) - Selector, 필수, 읽기전용
- 변경 사유 (custom_field_10005) - String, 필수, 읽기전용
- Release 일자 (custom_field_10006) - Calendar, 읽기전용
- 설명 (description) - String, 읽기전용
- 상태 (status) - String, 필수, 읽기전용
- 등록자 (submittedBy) - String, 필수, 읽기전용

### 장비관리 (equipment-management)
- 장비명 (name) - String, 필수, 읽기전용
- 카테고리 (custom_field_14) - String, 필수
- 제조사 (custom_field_15) - String, 필수
- 모델명 (custom_field_16) - String, 필수
- 시리얼 번호 (custom_field_17) - String, 필수
- 구매일 (custom_field_18) - Calendar
- 보증만료일 (custom_field_19) - Calendar
- 설치위치 (custom_field_20) - String
- 담당자 (custom_field_21) - String
- 사양 (description) - String
- 비고 (custom_field_22) - String

### 외부교육관리 (external-training)
- 교육명 (name) - String, 필수, 읽기전용
- 교육기관 (custom_field_23) - String, 필수
- 교육유형 (custom_field_24) - String, 필수
- 교육시작일 (custom_field_25) - Calendar, 필수
- 교육종료일 (custom_field_26) - Calendar, 필수
- 교육장소 (custom_field_27) - String
- 참석자 (custom_field_28) - String, 필수
- 수강료 (custom_field_29) - Number
- 숙박비 (custom_field_30) - Number
- 교통비 (custom_field_31) - Number
- 식비 (custom_field_32) - Number
- 교육내용 (description) - String, 필수
- 기대효과 (custom_field_33) - String

## 확장 방법

### 새로운 관리 섹션 추가
1. `DEFAULT_FIELD_CONFIGS`에 새 섹션 추가
2. 관리자 페이지의 섹션 선택 옵션에 추가
3. 동적 페이지 생성
4. API 라우트 추가

### 새로운 필드 타입 추가
1. `fieldTypes` 객체에 새 타입 추가
2. `createInputElement` 메서드에 새 타입 처리 로직 추가
3. 관리자 페이지의 필드 타입 선택기에 추가

### 검증 규칙 추가
1. `validateForm` 메서드에 새 검증 로직 추가
2. 필드별 커스텀 검증 함수 구현

## 주의사항

1. **Codebeamer 필드 ID**: 실제 Codebeamer 트래커의 필드 ID와 일치해야 함
2. **필드 타입 매핑**: Codebeamer 필드 타입과 포탈 필드 타입이 호환되어야 함
3. **데이터 저장**: 필드 설정은 `data/field-configs.json`에 저장됨
4. **백업**: 필드 설정 변경 전 백업 권장

## 문제 해결

### 필드가 표시되지 않는 경우
1. 필드 설정이 올바르게 저장되었는지 확인
2. Codebeamer 연결 상태 확인
3. 브라우저 콘솔에서 오류 메시지 확인

### 매핑 테스트 실패
1. Codebeamer 서버 연결 상태 확인
2. 트래커 ID가 올바른지 확인
3. 인증 정보 확인

### 폼 검증 오류
1. 필수 필드가 모두 입력되었는지 확인
2. 필드 타입별 데이터 형식 확인
3. 날짜 필드의 경우 유효한 날짜 형식인지 확인

