# ros2-node-map 開發規劃文件

## 1. 專案目標

`ros2-node-map` 是一個用來取代 `rqt_graph` 的 ROS 2 拓撲視覺化工具。

本工具的目標是以更直覺、現代的互動式關聯圖，顯示 ROS 2 系統中的：

* Node
* Topic
* Service
* Action
* Publisher / Subscriber 關係
* Service Client / Service Server 關係
* Action Client / Action Server 關係

本專案採用完全獨立 repo 開發，不依附既有 ROS package。

---

## 2. 核心設計理念

`rqt_graph` 適合臨時除錯，但在大型 ROS 2 系統中容易變成雜亂的線圖。

`ros2-node-map` 的設計重點是：

* 以互動式 Graph View 探索節點關係
* 支援搜尋、篩選、聚焦
* 能清楚看出 node/topic/service/action 的關聯
* 預設隱藏系統雜訊，例如 `/rosout`、`/parameter_events`
* Action 的底層 topic/service 預設收合，不直接攤開
* 支援遠端 ROS 2 系統
* 前端與 ROS 2 discovery 解耦
* 可匯出 JSON 與 Mermaid Markdown

---

## 3. 技術架構

本專案分成兩個主要部分：

```text
ROS 2 Runtime
    ↓
Python rclpy Backend
    ↓
WebSocket JSON Graph
    ↓
Electron + Web Frontend
```

### 3.1 Backend

Backend 使用 Python + `rclpy`。

Backend 負責：

* 建立 ROS 2 node
* 掃描 ROS graph
* 取得 nodes
* 取得 topics
* 取得 publishers
* 取得 subscribers
* 取得 services
* 取得 service clients / service servers
* 推導 actions
* 產生 graph JSON
* 透過 WebSocket 提供 graph snapshot

Backend 不負責 GUI。

### 3.2 Frontend

Frontend 使用：

* Electron
* Vite
* React
* TypeScript
* Cytoscape.js

Frontend 負責：

* 顯示 graph
* 搜尋
* 篩選 namespace
* 篩選 node/topic/service/action
* 點選節點顯示詳細資訊
* highlight 相鄰節點
* 縮放、拖曳、聚焦
* 連線到本機或遠端 backend

Frontend 不直接使用 ROS 2 DDS。

### 3.3 Snapshot File Mode

Frontend 必須能在沒有 ROS 2 backend 的情況下，直接載入並檢視既有的
graph JSON snapshot。此模式使用與 WebSocket 相同、版本穩定的 graph JSON
schema，因此匯出的檔案可直接重新開啟。

File mode 的資料來源是使用者選取或拖放的 JSON 檔案；不會啟動 ROS 2
discovery，也不會連線到 backend。

---

## 4. 專案目錄結構

建議 repo 結構如下：

```text
ros2-node-map/
├── README.md
├── README_zh.md
├── LICENSE
├── .gitignore
├── .agents/
│   ├── SPEC.md
│   └── PLAN.md
├── scripts/
│   ├── install-node-map.sh
│   └── version.mjs
├── backend/
│   ├── pyproject.toml
│   ├── ros2_node_map/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── graph_model.py
│   │   ├── graph_reader.py
│   │   ├── service_reader.py
│   │   ├── action_reader.py
│   │   ├── filters.py
│   │   └── graph_server.py
│   └── tests/
│       ├── test_graph_model.py
│       ├── test_filters.py
│       └── test_action_reader.py
├── app/
│   ├── package.json
│   ├── vite.config.ts
│   ├── electron/
│   │   ├── main.ts
│   │   └── preload.ts
│   └── src/
│       ├── App.tsx
│       ├── GraphView.tsx
│       ├── Sidebar.tsx
│       ├── DetailPanel.tsx
│       ├── api.ts
│       ├── types.ts
│       └── styles.css
└── docs/
    ├── architecture.md
    ├── graph-json-schema.md
    ├── testing.md
    └── roadmap.md
```

---

## 5. Graph 資料模型

Graph 使用 JSON 表示。

Graph 由兩個核心集合組成：

* `nodes`
* `edges`

### 5.1 Node 種類

支援以下 node kind：

```text
ros_node
ros_topic
ros_service
ros_action
```

### 5.2 Edge 種類

支援以下 edge kind：

```text
publish
subscribe
service_client
service_server
action_client
action_server
```

### 5.3 Graph JSON 範例

```json
{
  "schema_version": "0.1.0",
  "timestamp": "2026-07-03T15:00:00+08:00",
  "ros_domain_id": "0",
  "nodes": [
    {
      "id": "node:/right_arm/connector_check",
      "kind": "ros_node",
      "label": "/right_arm/connector_check",
      "name": "connector_check",
      "namespace": "/right_arm"
    },
    {
      "id": "topic:/camera/color/image_raw",
      "kind": "ros_topic",
      "label": "/camera/color/image_raw",
      "types": ["sensor_msgs/msg/Image"]
    },
    {
      "id": "service:/vision/connector",
      "kind": "ros_service",
      "label": "/vision/connector",
      "types": ["fii_humanoid_interfaces/srv/Vision2D"]
    },
    {
      "id": "action:/execute_task",
      "kind": "ros_action",
      "label": "/execute_task",
      "types": ["fiibot_interfaces/action/ExecuteTask"]
    }
  ],
  "edges": [
    {
      "id": "publish:node:/right_arm/yolo_node->topic:/vision/detection",
      "kind": "publish",
      "source": "node:/right_arm/yolo_node",
      "target": "topic:/vision/detection"
    },
    {
      "id": "subscribe:topic:/camera/color/image_raw->node:/right_arm/connector_check",
      "kind": "subscribe",
      "source": "topic:/camera/color/image_raw",
      "target": "node:/right_arm/connector_check"
    },
    {
      "id": "service_client:node:/fii_busbar_gui->service:/vision/connector",
      "kind": "service_client",
      "source": "node:/fii_busbar_gui",
      "target": "service:/vision/connector"
    },
    {
      "id": "service_server:service:/vision/connector->node:/right_arm/connector_check",
      "kind": "service_server",
      "source": "service:/vision/connector",
      "target": "node:/right_arm/connector_check"
    },
    {
      "id": "action_client:node:/mission_manager->action:/execute_task",
      "kind": "action_client",
      "source": "node:/mission_manager",
      "target": "action:/execute_task"
    },
    {
      "id": "action_server:action:/execute_task->node:/task_executor",
      "kind": "action_server",
      "source": "action:/execute_task",
      "target": "node:/task_executor"
    }
  ]
}
```

---

## 6. Topic 顯示規則

Topic 使用獨立節點表示。

方向規則：

```text
publisher node -> topic
topic -> subscriber node
```

範例：

```text
/right_arm/yolo_node
    ↓ publish
/vision/detection
    ↓ subscribe
/fii_busbar_gui
```

Topic node 應顯示：

* topic name
* message type
* publishers
* subscribers

---

## 7. Service 顯示規則

Service 使用獨立節點表示，不直接畫成 node -> node。

方向規則：

```text
client node -> service
service -> server node
```

範例：

```text
/fii_busbar_gui
    ↓ service_client
/vision/connector
    ↓ service_server
/right_arm/connector_check
```

Service node 應顯示：

* service name
* service type
* service clients
* service servers

---

## 8. Action 顯示規則

Action 使用高階節點表示。

方向規則：

```text
client node -> action
action -> server node
```

範例：

```text
/mission_manager
    ↓ action_client
/execute_task
    ↓ action_server
/task_executor
```

ROS 2 action 底層通常會展開為：

```text
/action_name/_action/send_goal
/action_name/_action/get_result
/action_name/_action/cancel_goal
/action_name/_action/feedback
/action_name/_action/status
```

這些底層 topic/service 預設不直接顯示在主 graph 中。

Action detail panel 可以顯示底層通道。

---

## 9. Action 推導策略

第一版採用務實策略：從 topic/service 名稱推導 action。

若偵測到以下命名規則：

```text
/<action_name>/_action/send_goal
/<action_name>/_action/get_result
/<action_name>/_action/cancel_goal
/<action_name>/_action/feedback
/<action_name>/_action/status
```

則推導出：

```text
action:/<action_name>
```

Action type 可從相關 service/topic type 推導。

第一版可以先只建立 action node，不要求 100% 精準辨識所有 client/server。

後續版本再補強：

* action server 偵測
* action client 偵測
* action type 完整解析
* 顯示 action internal channels

---

## 10. 預設過濾規則

預設隱藏以下系統資訊：

```text
/rosout
/parameter_events
/statistics
```

預設隱藏 action internal channels：

```text
/_action/send_goal
/_action/get_result
/_action/cancel_goal
/_action/feedback
/_action/status
```

但 UI 必須提供選項讓使用者打開：

```text
Show system topics
Show action internals
Show isolated nodes
```

---

## 11. 前端 UI 規劃

主畫面採三欄式設計。

```text
┌──────────────┬───────────────────────────────┬─────────────────────┐
│ Sidebar      │ Graph View                     │ Detail Panel        │
│              │                               │                     │
│ Search       │ Interactive graph              │ Selected item       │
│ Namespace    │ Zoom / Drag / Highlight        │ Node info           │
│ Filters      │                               │ Topic info          │
│ Layout       │                               │ ROS commands        │
└──────────────┴───────────────────────────────┴─────────────────────┘
```

Graph View 右下角必須顯示產品版本，格式為 `vX.Y.Z`，且版本值必須來自
Frontend 的產品版本來源。

### 11.1 Sidebar

Sidebar 功能：

* backend connection URL
* connect / disconnect
* search
* namespace filter
* show nodes
* show topics
* show services
* show actions
* show system topics
* show action internals
* show isolated nodes
* layout selection

### 11.2 Graph View

Graph View 功能：

* 顯示互動式 graph
* 滑鼠拖曳節點
* 滾輪縮放
* 點選節點
* highlight 相鄰節點
* 雙擊聚焦
* reset view
* refresh layout

### 11.3 Detail Panel

點選 `ros_node` 時顯示：

* full name
* namespace
* publishers
* subscribers
* service clients
* service servers
* action clients
* action servers
* copy command: `ros2 node info <node>`

點選 `ros_topic` 時顯示：

* topic name
* message type
* publishers
* subscribers
* copy command: `ros2 topic info <topic>`

點選 `ros_service` 時顯示：

* service name
* service type
* clients
* servers
* copy command: `ros2 service type <service>`

點選 `ros_action` 時顯示：

* action name
* action type
* clients
* servers
* internal channels
* copy command: `ros2 action info <action>`

### 11.4 Snapshot 匯出與檔案模式

Graph View 的既有 `Save graph as PNG` 控制項應改為匯出下拉選單，至少提供：

* Download PNG：下載目前畫面的 graph 圖片
* Download JSON：下載資料來源的完整 graph snapshot JSON，不套用前端顯示篩選
* Download Mermaid Markdown：下載包含 Mermaid graph 語法的 `.md` 檔

Mermaid Markdown 必須以 `mermaid` code fence 包住可直接貼入支援 Mermaid 的
Markdown renderer 的圖表定義，並保留目前顯示 topology 的 node、edge、label
與關係方向。

使用者可將符合 graph schema 的 `.json` 檔拖放至應用程式視窗，或透過檔案
選擇器開啟。載入成功後，前端必須使用該 snapshot 渲染 graph、sidebar 與
detail panel；載入失敗時必須顯示可理解的 schema／JSON 錯誤訊息，且不可
覆蓋目前已成功顯示的 graph。

匯入的 JSON 必須完整保存在前端資料層；系統資源、類型與其他顯示篩選只在
渲染階段套用，不可刪除原始 snapshot 中的 node 或 edge。再次匯出 JSON 時
必須輸出完整 snapshot。

ROS domain 控制項必須顯示目前資料來源，並支援以下三種模式：

* System：使用系統 `ROS_DOMAIN_ID` 的即時 ROS backend
* Custom：使用使用者設定的 `ROS_DOMAIN_ID` 的即時 ROS backend
* File：顯示已載入 JSON 的 `ros_domain_id`；此模式為唯讀，不可切換 domain

### 11.5 ROS 不可用時的 File-only Mode

Electron app 啟動時必須偵測 ROS 2 Jazzy runtime 與 bundled backend 是否可用。
若無法使用 ROS 2（例如缺少 `/opt/ros/<distro>/setup.bash`、backend 無法啟動，
或 app 被部署在非 ROS 主機），app 必須進入 File-only Mode：

* 不啟動 ROS backend，也不嘗試 ROS discovery
* 主畫面保留開啟／拖放 graph JSON 的功能與既有 graph 互動功能
* ROS domain 控制項的 System 與 Custom 選項、輸入框與套用按鈕全部停用
* 明確顯示目前為 File-only Mode，並提示使用者載入 graph JSON
* 已載入檔案時，domain 區塊顯示該 snapshot 的 `ros_domain_id`

---

## 12. 前端視覺樣式

節點樣式：

```text
ros_node    = circle
ros_topic   = rounded rectangle
ros_service = rectangle
ros_action  = diamond
```

線條樣式：

```text
publish / subscribe       = solid line
service_client/server     = dashed line
action_client/server      = dotted line
```

顏色可以先使用低對比、深色背景風格。

第一版不需要過度追求美術設計，應優先完成：

* 清楚
* 可互動
* 可搜尋
* 可篩選
* 大 graph 下不會完全失控

---

## 13. Backend 指令設計

Backend 應提供 CLI。

### 13.1 輸出一次 snapshot

```bash
ros2-node-map-backend snapshot
```

輸出 JSON：

```bash
ros2-node-map-backend snapshot > graph.json
```

### 13.2 啟動 WebSocket server

```bash
ros2-node-map-backend serve --host 0.0.0.0 --port 8766
```

預設：

```text
host: 127.0.0.1
port: 8766
refresh interval: 1.0 sec
```

### 13.3 常用參數

```bash
ros2-node-map-backend serve \
  --host 0.0.0.0 \
  --port 8766 \
  --interval 1.0 \
  --show-system-topics false \
  --show-action-internals false
```

---

## 14. Frontend 啟動方式

開發模式：

```bash
cd app
npm install
npm run dev
```

Electron 開發模式：

```bash
npm run electron:dev
```

正式打包：

```bash
npm run build
npm run dist
```

### 14.1 Headless Web Mode

已安裝的 `node-map` 指令必須支援：

```bash
node-map --headless
node-map --headless --port 9000
node-map --headless -p 9000
```

此模式適合在有 ROS 2 runtime、但沒有桌面環境的裝置上使用，行為如下：

* 不可建立 Electron `BrowserWindow`，也不可嘗試啟動 GUI。
* 必須啟動 bundled ROS backend，並以同一個 HTTP server 提供 production frontend、
  HTTP API 與 WebSocket graph stream。
* 預設監聽 `0.0.0.0:8766`；`-p PORT` 與 `--port PORT` 可指定 1 至 65535 的監聽
  port，讓同一個受信任網路中的其他電腦可用瀏覽器連入。此選項只可與
  `--headless` 一起使用。
* 啟動成功後必須在終端機以英文印出可直接使用的 URL：
  * `http://localhost:8766`
  * 每個可用非 loopback IPv4 位址對應的 `http://<ip>:8766`
* 透過 headless server 載入的 frontend 必須依目前網頁的 HTTP origin 建立 WebSocket
  URL，而不可固定連線至瀏覽器本機的 `127.0.0.1`。
* 收到結束訊號時必須停止 HTTP server 與 bundled ROS backend。
* 若 ROS 2 runtime、bundled backend、frontend assets 或監聽 port 不可用，必須以
  英文顯示可理解的錯誤並以非零狀態結束。

此模式不包含帳號或授權機制；使用者只可在受信任網路中使用，並自行設定防火牆。

### 14.2 Headless Capture Mode

已安裝的 `node-map` 指令必須支援：

```bash
node-map --capture
```

此模式用於在沒有 GUI 的裝置上擷取一次完整 topology snapshot，行為如下：

* 不可建立 Electron `BrowserWindow`，也不可啟動 HTTP server。
* 建立 ROS discovery node 後，必須先等待至少 3 秒讓 DDS discovery 更新，再讀取 graph
  並寫出 snapshot。
* 必須使用與 GUI 的 `Download JSON` 相同、未套用前端顯示篩選的完整 graph JSON
  schema 與資料內容。
* 成功後必須在目前工作目錄寫入一個新的
  `ros2-node-map-<UTC timestamp>.json` 檔案，不可覆蓋既有檔案。
* 終端機必須以英文印出已寫入檔案的絕對路徑，並提醒可將檔案複製至其他電腦，
  透過 node-map 的 File mode 開啟。
* 輸出的 JSON 必須能通過 frontend graph snapshot parser，並以 File mode 載入。
* 若無法取得 ROS graph 或無法寫入檔案，必須以英文顯示可理解的錯誤並以非零
  狀態結束，且不可留下部分輸出的 JSON 檔案。

### 14.3 AppImage Self-install Mode

每個 release AppImage 必須支援直接執行：

```bash
./ros2-node-map-v<version>-linux-<architecture>.AppImage --install
./ros2-node-map-v<version>-linux-<architecture>.AppImage --uninstall
```

此模式用於讓使用者不必先取得 repository 的安裝腳本即可建立或移除
`node-map` 指令，行為如下：

* `--install` 不可建立 GUI、啟動 ROS backend 或使用網路。
* `--install` 必須將目前正在執行的 AppImage 本身連結至
  `${XDG_BIN_HOME:-$HOME/.local/bin}/node-map`；不可下載、複製或移動 AppImage。
* 若 `node-map` 已是 symlink，`--install` 可更新它；若它是非 symlink 檔案，必須
  拒絕覆寫並以非零狀態結束。
* 成功後必須以英文顯示 `node-map` 啟動指令、
  `./ros2-node-map-v<version>-linux-<architecture>.AppImage --uninstall` 解除安裝指令，
  以及最後的 `source ~/.bashrc` 提醒；若目標 bin 目錄不在 `PATH`，也必須提示加入。
* `--uninstall` 不可建立 GUI、啟動 ROS backend 或使用網路。它只可移除指向目前
  AppImage 的 `node-map` symlink，不可刪除 AppImage 本身或任何其他檔案。
* 若 `node-map` 不存在、不是 symlink，或指向其他 AppImage，`--uninstall` 必須拒絕
  移除並以英文說明原因、以非零狀態結束。
* 自我安裝模式只適用於由 AppImage runtime 啟動的 release AppImage；若無法辨識
  目前 AppImage 路徑，必須以英文錯誤和非零狀態結束。

`-c` 與 `--capture` 為相同的 capture 模式。`--headless`、capture、`--install` 與
`--uninstall` 彼此不可同時使用；任意
無效組合必須顯示 usage 並以狀態碼 `2` 結束。未提供這些選項時，既有 GUI 啟動
行為必須保持不變。

`node-map -h` 與 `node-map --help` 必須以英文列出 GUI、headless、capture、install
與 uninstall 的可用指令，並以狀態碼 `0` 結束且不可啟動 GUI 或 ROS backend。

`node-map -v` 與 `node-map --version` 必須印出目前 node-map 版本，並以狀態碼 `0`
結束且不可啟動 GUI 或 ROS backend。

Release AppImage 產生後，必須提供安裝腳本
`scripts/install-node-map.sh`，支援以下安裝方式：

* 預設模式偵測目前系統，從 `HowardWhile/ros2-node-map` 的 GitHub latest
  release 下載對應的 Linux x86-64 或 ARM64 AppImage。
* 使用者可以透過 raw GitHub URL 執行線上安裝：
  `wget -qO- https://raw.githubusercontent.com/HowardWhile/ros2-node-map/develop/scripts/install-node-map.sh | bash`
* `scripts/install-node-map.sh --offline` 必須完全不連線，從
  `app/release` 選擇目前架構版本最高的 AppImage。
* 線上下載 AppImage 時必須顯示 Wget progress bar。
* 安裝腳本自行輸出的訊息必須使用英文。
* 安裝完成後必須顯示 `node-map` 的啟動指令、適合目前安裝模式的解除安裝指令，
  並在最後提醒使用者執行 `source ~/.bashrc`。

兩種模式都必須將 `node-map` 指令連結至選定的 AppImage；目前支援 Linux
x86-64 與 ARM64。

---

## 15. 測試規劃

### 15.1 Backend Unit Test

測試項目：

* graph node id 產生是否穩定
* edge id 產生是否穩定
* full node name 組合是否正確
* system topic filter 是否正確
* action internal channel filter 是否正確
* action name 推導是否正確

範例測試：

```text
input: /execute_task/_action/feedback
expected action name: /execute_task

input: /navigate_to_pose/_action/send_goal
expected action name: /navigate_to_pose
```

---

### 15.2 Backend Integration Test

建立測試用 ROS 2 nodes：

* 一個 publisher
* 一個 subscriber
* 一個 service server
* 一個 service client
* 一個 action server
* 一個 action client

測試 backend 是否能偵測：

* topic node
* service node
* action node
* publish edge
* subscribe edge
* service_client edge
* service_server edge
* action_client edge
* action_server edge

---

### 15.3 Frontend Unit Test

測試項目：

* graph JSON 轉 Cytoscape elements
* filter 邏輯
* search 邏輯
* selected item detail mapping
* hidden system topic 行為
* hidden action internal 行為

---

### 15.4 Frontend Manual Test

手動測試：

* 啟動 backend
* 啟動 Electron app
* 連接 `ws://localhost:8766`
* 檢查 node/topic/service/action 是否顯示
* 測試搜尋
* 測試 namespace filter
* 測試點選節點
* 測試 highlight neighbor
* 測試 layout reset
* 測試遠端 robot IP 連線
* 從匯出選單下載 PNG 與 JSON
* 從匯出選單下載 Mermaid Markdown，確認 node、edge 與方向正確
* 將匯出的 JSON 拖放回 app，確認 graph 與 domain ID 正確顯示
* 在沒有 ROS Jazzy runtime 的環境啟動 app，確認進入 File-only Mode
  且 System／Custom domain 控制項已停用

---

### 15.5 測試用 ROS 2 範例系統

建立一組簡單測試 topology：

```text
/talker
    publish -> /chatter

/listener
    subscribe <- /chatter

/add_two_ints_client
    service_client -> /add_two_ints

/add_two_ints_server
    service_server <- /add_two_ints

/task_client
    action_client -> /execute_task

/task_server
    action_server <- /execute_task
```

此範例系統可放在：

```text
examples/ros2_demo_graph/
```

### 15.6 Headless Mode Test

測試項目：

* `node-map --headless` 不建立 GUI，並提供 frontend、`/api/health` 與
  `/ws/graph`。
* 從另一台電腦以終端機顯示的 non-loopback URL 開啟網頁，確認 frontend 可收到
  graph snapshot。
* `node-map --capture` 在目前工作目錄建立完整且可解析的 JSON snapshot，並可在
  另一台電腦的 File mode 開啟。
* `node-map --headless --capture` 以狀態碼 `2` 失敗且顯示 usage。
* headless 與 capture 模式在 ROS runtime 或輸出目錄不可用時，正確以非零狀態
  結束且不產生 GUI。
* 直接執行 AppImage 的 `--install` 建立指向該 AppImage 的 `node-map` symlink，
  且不下載、複製或啟動 GUI。
* 直接執行同一個 AppImage 的 `--uninstall` 只移除該 symlink，不刪除 AppImage；
  指向其他 AppImage 的 symlink 必須保留。

---

## 16. 驗收條件

第一個可用版本必須滿足：

* 可以在 ROS 2 Jazzy 上執行
* 可以啟動 backend
* 可以啟動 Electron app
* app 可以連接 backend
* 可以顯示 node/topic
* 可以顯示 service
* 可以顯示 action
* 可以搜尋
* 可以依 namespace 篩選
* 可以隱藏系統 topic
* 可以點選 item 查看詳細資訊
* 可以匯出 graph JSON
* 可以拖放 graph JSON 並離線檢視 topology
* ROS 2 Jazzy 不可用時，app 可進入 File-only Mode
* 可以以 `node-map --headless` 在 headless 裝置提供瀏覽器可存取的 graph viewer
* 可以以 `node-map --capture` 產生可由 File mode 載入的完整 graph JSON
* Release AppImage 可透過 `--install` 與 `--uninstall` 安全管理 `node-map` 指令

---

## 17. 開發限制

請遵守以下限制：

* 不要讓 Electron 直接依賴 ROS 2 DDS
* 不要在 frontend 中 import ROS 2 library
* ROS 2 discovery 必須集中在 Python backend
* WebSocket 傳輸格式必須是 JSON
* graph schema 必須保持穩定
* 產品版本必須使用 `x.y.z` 三段數字格式，Frontend 與 Backend 版本必須一致
* 產品版本與 graph schema 版本必須分開管理；一般產品升版不得連帶修改 schema 版本
* Release 檔名必須包含以 `v` 開頭的產品版本、作業系統與 CPU 架構
* action internal channels 預設必須隱藏
* 不要在第一版實作 topic echo、service call、action goal send
* 不要在第一版實作 parameter edit
* 不要把本工具做成完整 robot monitor
* 本工具核心目標是取代 `rqt_graph`

---

## 18. 最終願景

`ros2-node-map` 最終希望成為一個比 `rqt_graph` 更適合大型 ROS 2 系統的 topology viewer。

它應該具備：

* 即時 ROS 2 graph 可視化
* 互動式 graph exploration
* 清楚的 node/topic/service/action 分類
* 遠端 robot 支援
* 可搜尋、可篩選、可聚焦
* 可匯出文件
* 可保存 snapshot
* 可用於系統交接、除錯、架構 review

本專案的第一目標不是取代 Foxglove，也不是做完整監控系統。

本專案的第一目標是：

```text
做出一個比 rqt_graph 更清楚、更現代、更適合大型 ROS 2 專案的 graph viewer。
```
