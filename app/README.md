# 도배·장판 견적관리

React + TypeScript + Vite 기반의 GitHub Pages용 정적 앱입니다. 고객 화면은 공개 소매 데이터만 사용하고, 관리자 원가 데이터는 로컬 브라우저에서 JSON 파일로 직접 가져올 때만 IndexedDB에 저장됩니다.

기본 고객사 정보는 가경지업사입니다.

- 업종: 도배공사
- 주소: 인천 미추홀구 석정로376번길 17 1층
- 전화: 0507-1351-3531
- 지도: 네이버 지도 장소 ID `2096080820`, 카카오맵 장소 ID `870596657`

## 실행

```bash
npm install
npm run dev
npm run test
npm run build
```

루트에서 실행할 때는 `npm run dev`, `npm run test`, `npm run build`를 사용해도 됩니다.

## 화면

- 고객 견적: `/`
- 카탈로그: 고객 견적 화면의 벽지 카드별 `카탈로그` 버튼에서 팝업으로 확인
- 관리자: `/admin`

`/admin`은 인증 기능이 아닙니다. 로컬 MVP에서는 이 브라우저 IndexedDB에만 관리자 편집값, 변경 이력, 임시 견적 기록이 저장됩니다.

## 데이터 수정

관리자 화면은 견적 계산을 첫 화면으로 표시합니다. 자료 관리는 벽지, 부자재, 장판, 공임, 카탈로그로 나뉘며 각 항목에서 값을 추가·수정할 수 있습니다. 견적 이력은 문의일자, 고객 전화번호, 요약을 먼저 보여주고 행을 누르면 상세 견적서 팝업을 확인할 수 있습니다. 백업 화면에서 JSON을 내보내거나 가져올 수 있습니다. 원가가 포함된 `private/quote_rules.json`을 가져온 경우 해당 값은 로컬 IndexedDB에만 저장되며 공개 번들에는 포함되지 않습니다.

고객 공개 데이터의 기본 파일은 `src/data/retail_rules.example.json`과 `public/retail_rules.example.json`입니다. 공개 저장소에는 원가 포함 `private/`, 개발 문서, 원본 ZIP, 원가 포함 테스트 픽스처를 커밋하지 마세요.

## GitHub Pages

기본 Vite base는 `/`입니다. 커스텀 도메인 또는 사용자/조직 Pages에서는 `/admin` 주소를 그대로 쓸 수 있습니다.

프로젝트 Pages 주소가 `https://<id>.github.io/<repo>/` 형태라면 브라우저 경로 앞에 저장소명이 붙어야 하므로 빌드 시 `VITE_BASE_PATH`를 바꿔 주세요.

```bash
VITE_BASE_PATH=/your-repo-name/ npm run build
```

GitHub Actions는 루트의 `.github/workflows/pages.yml` 예시를 사용합니다. GitHub 저장소 Settings → Pages → Source를 GitHub Actions로 설정하면 됩니다.

## 미등록 항목

장판 사용량·노무 기준, 장판 2.0T/2.2T 단가, 전용 16/18평 소폭 기준, 전용 입력 실크/광폭 역환산, VAT 산식, 짐 이동 비용, 실제 매장 연락처는 확정 데이터가 아니므로 앱이 금액을 임의 생성하지 않습니다.
