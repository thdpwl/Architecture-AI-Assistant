# Architecture-AI-Assistant

건축 도면과 설계 업무를 지원하는 AI 어시스턴트의 기획 및 프로토타입입니다.

## GitHub Pages

이 저장소는 GitHub Pages의 **Deploy from a branch** 방식으로 `main` 브랜치의 루트(`/`)를 배포합니다. 변경사항을 `main`에 반영하면 Pages가 자동으로 다시 빌드합니다. 공개 주소는 https://thdpwl.github.io/Architecture-AI-Assistant/ 입니다.

## 현재 프로토타입

`index.html`은 이슈 [#1](https://github.com/thdpwl/Architecture-AI-Assistant/issues/1)의 초기 구상을 바탕으로 한 한국어 프로토타입입니다. DXF 분석 메뉴에서 ASCII DXF 파일(최대 20MB)을 브라우저 내에서 읽어 레이어·객체 유형과 도면 범위를 집계하고, LINE/LWPOLYLINE/CIRCLE/ARC 요소 및 기본 블록 삽입을 미리 볼 수 있습니다. 파일은 서버로 전송하지 않습니다.

이슈 [#3](https://github.com/thdpwl/Architecture-AI-Assistant/issues/3)에서 제공한 `Drawing1.dxf`를 정리한 예시는 `examples/issue-3-commercial-floorplan.dxf`에 있습니다. 웹페이지에서 **이슈 #3 예시 평면도 분석**을 누르면 실제 도면 데이터를 불러옵니다. 공개 예시 사본에서는 작성자·위치·파일 식별 메타데이터를 제외하고, 도면에 필요한 레이어와 기하 정보만 남겼습니다.

이슈 [#5](https://github.com/thdpwl/Architecture-AI-Assistant/issues/5)의 설명에 따라 `AA-DWXM-DOOR`는 문·문틀, `AA-WAXM-CONC`는 콘크리트 벽체, `AA-WAXS-FIN1`은 마감재, `PBTEX`는 기둥으로 표시합니다. 의미 카드를 선택하면 해당 요소의 선을 도면에서 강조합니다. `AA-XXXX-OPEN`은 레이어명과 블록 내 선 형상을 바탕으로 개구부·문 여닫이선으로 추정해 표시합니다. 이 매핑은 알려진 레이어 이름에 대한 규칙이며, 임의 도면에 대한 AI 의미 인식은 아닙니다.

현재 분석은 도면 검토를 돕는 기초 정보이며, 블록 내부의 지원하지 않는 CAD 요소, 동적 블록, 해치와 치수 해석은 포함하지 않습니다. 건설CALS/EC 표준 적합성 판정이나 설계·법규 검토를 대신하지 않습니다. AI 질의응답과 도면/BIM 생성 등 나머지 기능은 아직 시뮬레이션/로드맵 상태이며, 구현 범위는 교수님 미팅 후 피드백에 따라 조정합니다.
