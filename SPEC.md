# ros2-node-map 開發規劃文件

## 1. 專案目標

`ros2-node-map` 是一個用來取代 `rqt_graph` 的 ROS 2 拓撲視覺化工具。

本工具的目標是以更直覺、現代、接近 Obsidian 關聯圖的方式，顯示 ROS 2 系統中的：

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

* 像 Obsidian Graph View 一樣探索節點關係
* 支援搜尋、篩選、聚焦
* 能清楚看出 node/topic/service/action 的關聯
* 預設隱藏系統雜訊，例如 `/rosout`、`/parameter_events`
* Action 的底層 topic/service 預設收合，不直接攤開
* 支援遠端 ROS 2 系統
* 前端與 ROS 2 discovery 解耦
* 未來可匯出 JSON、Mermaid、Obsidian Markdown

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

---

## 4. 專案目錄結構

建議 repo 結構如下：

```text
ros2-node-map/
├── README.md
├── LICENSE
├── .gitignore
├── SPEC.md
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
│ Search       │ Obsidian-like graph            │ Selected item       │
│ Namespace    │ Zoom / Drag / Highlight        │ Node info           │
│ Filters      │                               │ Topic info          │
│ Layout       │                               │ ROS commands        │
└──────────────┴───────────────────────────────┴─────────────────────┘
```

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

顏色可以先使用低對比、深色背景風格，接近 Obsidian Graph View。

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

---

## 15. 開發里程碑

### Milestone 1：建立專案骨架

目標：

* 建立 repo 結構
* 建立 README
* 建立 backend Python package
* 建立 app Electron/Vite/React 專案
* 定義 graph JSON schema

完成條件：

* repo 可以安裝 backend
* app 可以啟動空白畫面
* docs 中有 architecture 與 schema 說明

---

### Milestone 2：Backend Topic Graph

目標：

* 使用 `rclpy` 掃描 ROS 2 nodes
* 使用 `rclpy` 掃描 topics
* 建立 publisher edge
* 建立 subscriber edge
* 輸出 graph JSON

完成條件：

```bash
ros2-node-map-backend snapshot
```

可以輸出包含：

* ros_node
* ros_topic
* publish edge
* subscribe edge

的 JSON。

---

### Milestone 3：WebSocket Server

目標：

* Backend 提供 WebSocket server
* 每秒送出 graph snapshot
* 支援本機與遠端連線

完成條件：

```bash
ros2-node-map-backend serve --host 0.0.0.0 --port 8766
```

前端或測試 client 可以收到 graph JSON。

---

### Milestone 4：Electron Graph Viewer

目標：

* Electron app 可以連接 WebSocket
* Cytoscape.js 可以顯示 node/topic graph
* 支援基本縮放與拖曳

完成條件：

* 可以看到 node/topic 關係
* 可以更新 graph
* 不需要重啟 app 就能看到 ROS graph 變化

---

### Milestone 5：Service Graph

目標：

* Backend 掃描 services
* 建立 service node
* 建立 service client edge
* 建立 service server edge
* Detail panel 顯示 service 資訊

完成條件：

* graph 中可以看到 service
* service 關係以 `client node -> service -> server node` 表示

---

### Milestone 6：Action Graph

目標：

* 從 action internal topic/service 推導 action
* 建立 action node
* 建立 action client/server edge
* 預設隱藏 action internal channels
* Detail panel 顯示 action internal channels

完成條件：

* graph 中可以看到 action
* action 關係以 `client node -> action -> server node` 表示
* 開啟 `show action internals` 後可看到底層 topic/service

---

### Milestone 7：搜尋與篩選

目標：

* 搜尋 node/topic/service/action
* namespace filter
* kind filter
* system topic filter
* isolated node filter

完成條件：

* 可以快速找到指定 node
* 可以只看某個 namespace
* 可以隱藏系統雜訊

---

### Milestone 8：Detail Panel

目標：

* 點選 graph item 後顯示詳細資訊
* 顯示 ROS CLI 指令
* 支援 copy command

完成條件：

* 點 node 可看到 topic/service/action 關聯
* 點 topic 可看到 pub/sub
* 點 service 可看到 client/server
* 點 action 可看到 client/server/internal channels

---

### Milestone 9：Export

目標：

* 匯出 graph JSON
* 匯出 Mermaid
* 匯出 Obsidian Markdown vault

完成條件：

* 可以保存目前 graph snapshot
* 可以產生 Markdown 文件
* 可以在 Obsidian 中查看關聯圖

---

## 16. 測試規劃

### 16.1 Backend Unit Test

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

### 16.2 Backend Integration Test

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

### 16.3 Frontend Unit Test

測試項目：

* graph JSON 轉 Cytoscape elements
* filter 邏輯
* search 邏輯
* selected item detail mapping
* hidden system topic 行為
* hidden action internal 行為

---

### 16.4 Frontend Manual Test

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

---

### 16.5 測試用 ROS 2 範例系統

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

---

## 17. 驗收條件

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

---

## 18. 開發限制

請遵守以下限制：

* 不要讓 Electron 直接依賴 ROS 2 DDS
* 不要在 frontend 中 import ROS 2 library
* ROS 2 discovery 必須集中在 Python backend
* WebSocket 傳輸格式必須是 JSON
* graph schema 必須保持穩定
* action internal channels 預設必須隱藏
* 不要在第一版實作 topic echo、service call、action goal send
* 不要在第一版實作 parameter edit
* 不要把本工具做成完整 robot monitor
* 本工具核心目標是取代 `rqt_graph`

---

## 19. 建議 Commit 順序

### Commit 1

```text
Initial project structure for ros2-node-map
```

內容：

* README
* SPEC
* backend package skeleton
* app skeleton
* docs skeleton

### Commit 2

```text
Define graph JSON schema
```

內容：

* graph_model.py
* TypeScript graph types
* schema docs
* unit tests

### Commit 3

```text
Implement ROS 2 topic graph snapshot
```

內容：

* node discovery
* topic discovery
* publisher/subscriber edges
* snapshot CLI

### Commit 4

```text
Add WebSocket graph server
```

內容：

* graph_server.py
* serve CLI
* refresh interval

### Commit 5

```text
Create Electron graph viewer
```

內容：

* Electron main process
* React app
* WebSocket client
* Cytoscape rendering

### Commit 6

```text
Add service graph support
```

內容：

* service nodes
* service client/server edges
* service detail panel

### Commit 7

```text
Add action graph support
```

內容：

* action inference
* action nodes
* action client/server edges
* hide action internals

### Commit 8

```text
Add search and filters
```

內容：

* search box
* namespace filter
* kind filter
* system topic toggle

### Commit 9

```text
Add detail panel and copy commands
```

內容：

* selected item panel
* ROS CLI commands
* copy button

### Commit 10

```text
Add graph export features
```

內容：

* export JSON
* export Mermaid
* export Obsidian Markdown

---

## 20. 最終願景

`ros2-node-map` 最終希望成為一個比 `rqt_graph` 更適合大型 ROS 2 系統的 topology viewer。

它應該具備：

* 即時 ROS 2 graph 可視化
* Obsidian-like graph exploration
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
