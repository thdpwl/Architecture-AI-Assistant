# Architecture-AI-Assistant

건축 도면과 설계 업무를 지원하는 AI 어시스턴트의 기획 및 프로토타입입니다.

## GitHub Pages

저장소의 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정하면 `main` 브랜치에 반영할 때 정적 사이트가 배포됩니다. 배포가 완료되면 Pages 주소는 저장소의 Pages 설정에서 확인할 수 있습니다.

## 현재 프로토타입

`index.html`은 이슈 [#1](https://github.com/thdpwl/Architecture-AI-Assistant/issues/1)의 초기 구상을 바탕으로 한 한국어 프로토타입입니다. DXF 분석 메뉴에서 ASCII DXF 파일(최대 20MB)을 브라우저 내에서 읽어 레이어·객체 유형을 집계하고, LINE/LWPOLYLINE/CIRCLE/ARC 요소를 미리 볼 수 있습니다. 파일은 서버로 전송하지 않습니다.

현재 분석은 도면 검토를 돕는 기초 정보이며, 건설CALS/EC 표준 적합성 판정이나 설계·법규 검토를 대신하지 않습니다. AI 질의응답과 도면/BIM 생성 등 나머지 기능은 아직 시뮬레이션/로드맵 상태이며, 구현 범위는 교수님 미팅 후 피드백에 따라 조정합니다.
