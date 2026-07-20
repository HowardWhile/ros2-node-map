# ros2-node-map 開發計畫

本文件記錄開發里程碑與建議 Commit 順序。產品需求、架構與驗收規格請參考
[SPEC.md](SPEC.md)。

## 1. 開發里程碑

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

* 透過 Graph View 匯出目前顯示的 graph JSON
* 將 PNG 匯出改為 PNG／JSON 下拉選單
* 匯出包含 Mermaid graph 語法的 Markdown 檔
* 支援拖放或選取 graph JSON 檔並以 File mode 顯示
* ROS runtime 不可用時自動進入 File-only Mode
* 匯出 Obsidian Markdown vault

完成條件：

* 可以下載目前顯示 topology 的 PNG 與 JSON
* 可以下載並在支援 Mermaid 的 Markdown renderer 中顯示的 Mermaid Markdown
* 匯出的 JSON 可拖放回 app 並呈現相同的 graph 資料
* JSON schema 不相容或檔案格式錯誤時可顯示錯誤且保留既有畫面
* 沒有 ROS 2 Jazzy 的主機仍可開啟 app、載入 JSON 並探索 graph
* File mode 中不可變更 ROS domain
* 可以產生 Markdown 文件
* 可以在 Obsidian 中查看關聯圖

## 2. 建議 Commit 順序

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

* export JSON from the Graph View
* PNG / JSON export menu
* export Mermaid Markdown
* import graph JSON by drag and drop
* File-only Mode when ROS 2 is unavailable
* export Obsidian Markdown
