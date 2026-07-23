# ros2-node-map 開發計畫

本文件記錄開發里程碑。產品需求、架構與驗收規格請參考
[SPEC.md](SPEC.md)。

## 1. 里程碑 Checklist

只有完成條件已實作且已驗證的里程碑才可勾選。未勾選項目可已有部分實作，
但仍須完成列出的驗證或缺漏功能。

- [x] Milestone 1：建立專案骨架
- [x] Milestone 2：Backend Topic Graph
- [ ] Milestone 3：WebSocket Server — 以實際 client 驗證持續收到 snapshot。
- [ ] Milestone 4：Electron Graph Viewer — 完成 live backend 的 Electron 手動驗收。
- [ ] Milestone 5：Service Graph — 以實際 service client/server topology 驗證。
- [ ] Milestone 6：Action Graph — 以實際 action client/server topology 驗證。
- [ ] Milestone 7：搜尋與篩選 — 實作 namespace filter 與 isolated node filter。
- [ ] Milestone 8：Detail Panel — 完成 Detail Panel 的 Electron 手動驗收。
- [ ] Milestone 9：Export — 完成 Electron 手動驗收及線上安裝腳本實測。
- [ ] Milestone 10：Headless Modes — 實作並驗證 headless web 與 capture 模式。

## 2. 開發里程碑

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

* 透過 Graph View 匯出未套用前端顯示篩選的完整 graph JSON
* 將 PNG 匯出改為 PNG／JSON／Mermaid 匯出選單
* 匯出包含 Mermaid graph 語法的 Markdown 檔
* 支援拖放或選取 graph JSON 檔並以 File mode 顯示
* ROS runtime 不可用時自動進入 File-only Mode
* Windows release 固定使用 File-only Mode，且不包含或啟動 ROS backend
* 安裝腳本預設可從 GitHub latest release 下載目前架構的 Linux AppImage
* 安裝腳本支援 `--offline`，只使用 `app/release` 中的 AppImage

完成條件：

* PNG 反映目前畫面，JSON 則包含資料來源中的完整 topology
* 可以下載並在支援 Mermaid 的 Markdown renderer 中顯示的 Mermaid Markdown
* 匯出的 JSON 可拖放回 app 並呈現相同的 graph 資料
* JSON 載回後保留完整資料，畫面再依目前 filter 設定顯示
* JSON schema 不相容或檔案格式錯誤時可顯示錯誤且保留既有畫面
* 沒有 ROS 2 Jazzy 的主機仍可開啟 app、載入 JSON 並探索 graph
* Windows portable release 可開啟 app、載入 JSON 並探索 graph
* File mode 中不可變更 ROS domain
* 可以產生 Markdown 文件
* 可以透過線上或離線安裝腳本建立 `node-map` 指令

驗證命令：

```bash
cd app
npm test
npm run build
```

完成前仍需依 `SPEC.md` 15.4 執行 Electron 手動測試，包含拖放匯入、匯出檔案、
無效 JSON，以及無 ROS 2 runtime 的 File-only Mode。

---

### Milestone 10：Headless Modes

目標：

* `node-map --headless` 不啟動 GUI，並在 headless 裝置提供 production frontend、
  HTTP API 與 WebSocket graph stream。
* 啟動時顯示 localhost 與可用 LAN IPv4 的瀏覽器網址。
* headless frontend 連回提供網頁的同一個主機，而不是瀏覽器本機的 localhost。
* `node-map --capture` 不啟動 GUI 或 HTTP server，並在目前工作目錄產生完整 graph
  JSON snapshot。
* release AppImage 可透過 `--install` 連結自身為 `node-map`，並可透過
  `--uninstall` 安全移除該連結。
* 保持既有未帶選項時的 GUI 啟動行為。

完成條件：

* `node-map --headless` 不建立 `BrowserWindow`，且可由另一台電腦使用終端機顯示
  的 LAN URL 開啟並收到即時 graph snapshot。
* `node-map --capture` 產生可由另一台電腦 File mode 載入的完整、未套用前端篩選的
  graph JSON，並印出絕對輸出路徑。
* `node-map --headless --capture` 顯示 usage，並以狀態碼 `2` 結束。
* `AppImage --install` 不下載、複製或啟動 GUI，並建立指向目前 AppImage 的
  `node-map` symlink；`AppImage --uninstall` 只移除指向目前 AppImage 的 symlink。
* ROS runtime、frontend assets、監聽 port 或輸出路徑不可用時，兩種模式皆以英文
  顯示可理解的錯誤、以非零狀態結束，且不啟動 GUI。

驗證：

* 執行 `node-map --headless`，以 localhost 與另一台電腦測試 frontend、
  `/api/health` 與 `/ws/graph`。
* 在可寫入的暫存目錄執行 `node-map --capture`，驗證輸出檔可被 frontend parser
  驗證並以 File mode 開啟。
* 以暫存 `XDG_BIN_HOME` 執行 AppImage `--install`／`--uninstall`，驗證建立與移除
  的 symlink 都指向目前 AppImage，且非 symlink 或其他版本的 symlink 不會被覆寫。
* 驗證互斥參數、ROS runtime 不可用、port 衝突及輸出目錄不可寫入的失敗情況。
