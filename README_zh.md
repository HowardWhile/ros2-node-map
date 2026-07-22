# ros2-node-map

> [English](README.md)

`ros2-node-map` 是一個進階的 `rqt_graph` 風格檢視器，用來快速理解 ROS 2
系統的整體拓樸。

![image-20260715015056371](./pic/README/image-20260715015056371.png)

[觀看示範影片](./pic/README/ros2-node-map.mp4)

## 後端開發

目前的目標環境為 ROS 2 Jazzy 與 Python 3.12。

```bash
cd backend
uv venv --system-site-packages
uv sync
uv run pytest
```

`uv venv --system-site-packages` 會建立可讀取 Ubuntu 系統 Python 套件的
`backend/.venv`，包括 ROS 2 所需的 `yaml` 模組；接著由 `uv sync` 安裝鎖定的
應用程式與開發依賴套件。不需要手動啟用虛擬環境。ROS discovery 所需的
`rclpy` 由已載入的 ROS 2 環境提供，不會從 PyPI 安裝。啟動即時拓樸後端：

```bash
source /opt/ros/jazzy/setup.bash
uv run ros2-node-map-backend serve
```

若不透過 UI，想直接檢查單次 snapshot，可執行：

```bash
source /opt/ros/jazzy/setup.bash
uv run ros2-node-map-backend snapshot --pretty
```

## App 開發

請使用目前的 Node.js LTS 版本。

```bash
cd app
npm install
npm run dev
```

若要開啟 Electron 外殼：

```bash
npm run electron:dev
```

## Snapshot 檔案與匯出

拓樸匯出選單可以將目前畫面儲存為 PNG 或可攜式 Mermaid Markdown，也可以
將完整的來源 snapshot 儲存為 graph JSON。

JSON 匯出不受目前顯示篩選器影響；檔案重新載入後，App 才會再次套用篩選器。

可使用 **Open JSON** 按鈕開啟 graph JSON snapshot，也可以將單一 JSON 檔案
拖放到應用程式視窗的任何位置。如果系統沒有 ROS 2 環境，仍可使用離線檢視與匯出功能。

## 建置獨立執行檔

請在 Ubuntu 24.04／Python 3.12 環境建置 Linux x86-64 AppImage。建置環境需要
Node.js LTS、npm、Python 3，以及 [uv](https://docs.astral.sh/uv/)：

```bash
cd app
npm install
npm run dist
```

```text
app/release/ros2-node-map-v<version>-linux-<architecture>.AppImage
```

例如，版本 `0.2.1` 的 x86-64 建置產物名稱為
`ros2-node-map-v0.2.1-linux-x86_64.AppImage`。架構後綴由 electron-builder
依據選用的建置目標自動產生。

## 安裝 `node-map` 指令

預設模式會偵測目前系統，從 GitHub Releases 下載對應的最新 Linux x86-64 或
ARM64 AppImage：

```bash
./scripts/install-node-map.sh
node-map
```

也可以直接透過線上腳本安裝：

```bash
wget -qO- https://raw.githubusercontent.com/HowardWhile/ros2-node-map/develop/scripts/install-node-map.sh | bash
```

下載的 AppImage 會放在
`${XDG_DATA_HOME:-~/.local/share}/ros2-node-map/`，`node-map` 指令會安裝到
`~/.local/bin`。如果該目錄尚未加入 `PATH`，請加入後重新開啟 shell。

若要離線安裝，直接使用 `app/release` 中已有的 AppImage：

```bash
./scripts/install-node-map.sh --offline
```

離線模式不會連線，會選擇目前 Linux 架構版本最高的 AppImage。


## 文件

- [變更日誌](CHANGELOG.md)
- [架構說明](docs/architecture.md)
- [Graph JSON 結構](docs/graph-json-schema.md)
- [測試說明](docs/testing.md)
- [開發路線圖](docs/roadmap.md)
- [功能規格](.agents/SPEC.md)
- [開發計畫](.agents/PLAN.md)

## 知識圖譜

本專案使用 [Understand-Anything](https://github.com/Egonex-AI/Understand-Anything)
分析程式碼，產生描述程式碼結構、元件關係與導覽路徑的知識圖譜。

知識圖譜有兩種使用方式：一般使用者可以透過互動式 Dashboard 瀏覽；AI agent
則可以直接檢視 JSON 圖譜資料。

### 提供給 AI agent

請在提示詞中加入以下指示：

> 查閱 `.ua/knowledge-graph.json`，它是本專案的知識圖譜。

> [!WARNING]
> 原始碼仍是最終事實。若圖譜是根據較舊版本的程式碼產生，請在使用圖譜內容
> 前重新產生。

### 提供給一般使用者

#### 準備環境

請安裝 [Node.js LTS](https://nodejs.org/)，以取得 `npm` 與 `npx` 指令。可用
下列指令確認安裝狀態：

```bash
node --version
npx --version
```

安裝最新版本的 Understand-Anything viewer：

```bash
npm install --global https://github.com/Egonex-AI/Understand-Anything/releases/latest/download/understand-anything-viewer.tgz
```

#### 啟動 Dashboard

在專案根目錄執行：

```bash
understand-anything-viewer .
```

## 授權

[MIT](LICENSE)
