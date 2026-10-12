# 도배·장판 견적관리

React + TypeScript + Vite로 만든 GitHub Pages용 정적 앱입니다. 고객 화면은 공개 소매 데이터만 사용하고, 관리자 원가는 브라우저에서 JSON을 직접 가져올 때만 그 브라우저의 IndexedDB에 저장됩니다.

저장소: [Leeeyounghwan/Wallpaper_Estimate](https://github.com/Leeeyounghwan/Wallpaper_Estimate)

기본 고객사 정보는 가경지업사입니다.

- 업종: 도배공사
- 주소: 인천 미추홀구 석정로376번길 17 1층
- 전화: 0507-1351-3531
- 지도: 네이버 지도 장소 ID `2096080820`, 카카오맵 장소 ID `870596657`

## 구성

- `app/`: 견적 화면, 계산, 공개 소매 데이터
- `.github/workflows/pages.yml`: 테스트 후 GitHub Pages에 배포
- 루트 `package.json`: `app` 스크립트를 호출하는 실행 진입점

## 실행

의존성은 `app`에 설치합니다.

```bash
npm --prefix app install
npm run dev
npm run test
npm run build
```

`app` 디렉터리에서 `npm install`, `npm run dev`, `npm run test`, `npm run build`를 실행해도 됩니다.

## 화면

- 고객 견적: `/`
- 카탈로그: 고객 견적 화면의 벽지 카드별 `카탈로그` 버튼에서 팝업으로 확인
- 관리자: `/admin`

`/admin`은 로그인 화면이 아닙니다. 이 브라우저의 IndexedDB에만 관리자 편집값, 변경 이력, 임시 견적 기록이 저장됩니다.

## 데이터

관리자 화면은 견적 계산을 먼저 보여 줍니다. 자료는 벽지, 부자재, 장판, 공임, 카탈로그로 나뉘며 각 항목을 추가·수정할 수 있습니다. 견적 이력은 문의일자, 고객 전화번호, 요약을 보여 주고, 행을 누르면 상세 견적서가 열립니다. 백업 화면에서 JSON을 내보내거나 가져올 수 있습니다.

원가가 포함된 `private/quote_rules.json`을 가져오면 그 값은 로컬 IndexedDB에만 저장되고 공개 번들에는 들어가지 않습니다. 고객에게 공개하는 기본 데이터는 `app/src/data/retail_rules.example.json`과 `app/public/retail_rules.example.json`입니다.

공개 저장소에는 원가가 포함된 `private/`, 개발 문서, 원본 ZIP, 원가가 포함된 테스트 픽스처를 넣지 않습니다.

## GitHub Pages

로컬 빌드의 기본 base는 `/`입니다. 프로젝트 Pages는 `https://leeeyounghwan.github.io/Wallpaper_Estimate/`처럼 저장소 이름이 경로에 붙습니다. 현재 배포 워크플로는 `VITE_BASE_PATH=/wallpaper-estimate/`로 빌드합니다. Pages 경로와 다르면 워크플로의 값을 저장소 경로에 맞춥니다.

GitHub 저장소 Settings → Pages → Source를 GitHub Actions로 설정하면 `main`에 푸시할 때 배포됩니다.

## 미등록 항목

장판 사용량·노무 기준, 장판 2.0T/2.2T 단가, 전용 16/18평 소폭 기준, 전용 입력 실크/광폭 역환산, VAT 산식, 짐 이동 비용, 실제 매장 연락처는 확정 데이터가 아닙니다. 앱은 이 항목의 금액을 임의로 만들지 않습니다.
