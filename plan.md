# ros2-node-map Lumino Workbench PoC 修改計畫

## 1. 文件目的

本文件提供 coding agent 一套可直接執行的修改計畫，將 `ros2-node-map` 現有的固定三欄 React 介面，漸進式改造成以 **Lumino DockPanel** 為核心的 Workbench Shell。

本階段是 **Proof of Concept（PoC）**，目的是驗證：

- Lumino 是否適合作為未來 ROS 2 GUI 框架的 MainForm／Workbench Shell。
- 既有 React Component 能否穩定嵌入 Lumino Widget。
- Cytoscape Graph 在 Dock、Tab、Split、Resize 情境下是否正常。
- 同一份前端是否能同時在瀏覽器與 Electron 運作。
- Layout 是否能保存、恢復與重設。
- Panel 關閉後是否能透過命令或選單重新開啟。
- 前端單一 Panel 發生 React render 錯誤時，是否能隔離在該 Panel。

本階段不得直接實作完整插件系統、Python Plugin Host 或 Python UI DSL。

---

## 2. Repository 基準

執行前先確認：

```bash
git status
git branch --show-current
git log -1 --oneline
```

預期工作基準：

```text
repository: HowardWhile/ros2-node-map
base branch: develop
```

建立獨立分支：

```bash
git checkout develop
git pull --ff-only
git checkout -b feature/lumino-workbench-poc
```

如果工作目錄已有未提交變更，不得覆蓋、刪除或重設使用者的修改。

---

## 3. 現況摘要

目前前端主要由以下部分組成：

```text
app/src/
├─ App.tsx
├─ DetailPanel.tsx
├─ GraphView.tsx
├─ Sidebar.tsx
├─ api.ts
├─ main.tsx
├─ styles.css
└─ types.ts
```

目前 `App.tsx` 同時負責：

- Backend WebSocket URL。
- WebSocket 建立與重連生命週期。
- Connection status。
- Graph snapshot。
- Debug／Infrastructure resource filter。
- Graph selection。
- 左右 Panel 收合。
- 左右 Panel 寬度。
- Pointer resize。
- Toolbar。
- 三欄 Layout。

目前畫面：

```text
Toolbar
└─ Explorer | Graph | Details
```

目標畫面：

```text
Menu Bar
Toolbar
└─ Lumino DockPanel
   ├─ Explorer
   ├─ ROS Graph
   └─ Details
Status Bar（可先保持精簡）
```

---

## 4. 核心原則

### 4.1 採漸進式改造

必須保留：

- React。
- Cytoscape.js。
- 現有 Graph 視覺樣式與互動。
- 現有 WebSocket protocol。
- 現有 Python backend。
- Electron 包裝與 AppImage 流程。

Lumino 在本階段只負責：

- Workbench Shell。
- DockPanel。
- Tab。
- Split layout。
- Panel lifecycle。
- Command registry。
- View menu。
- Layout 保存與恢復。

### 4.2 不重寫 GraphView

`GraphView.tsx` 已使用 `ResizeObserver` 呼叫 Cytoscape `resize()`，應先保留其既有實作。

只有在 Lumino 切換 Tab 或恢復 Layout 後實際出現尺寸問題時，才增加 Lumino resize／activate bridge。

### 4.3 狀態不能綁死在單一 React Root

改造後會有多個 React Root：

```text
Toolbar React Root
Explorer React Root
Graph React Root
Details React Root
```

因此共享狀態不得只放在某一個 React Component 的 `useState`。

需建立一個前端應用層 Store，所有 Panel 共用同一個 Store instance。

### 4.4 不建立過度抽象的通用框架

本階段只為 `ros2-node-map` 建立足夠的 Workbench 模組。

禁止預先建立尚未被使用的：

- Generic plugin marketplace。
- Python Plugin SDK。
- Dynamic module federation。
- Dependency injection container。
- Permission system。
- iframe plugin runtime。
- Remote plugin loader。
- 通用 ROS 2 Widget schema。

等第二個應用也需要相同能力時，再抽出真正可共用的 package。

---

## 5. 非目標

本 PoC 不包含：

- Python Plugin Host。
- 插件獨立 subprocess。
- `rclpy` 執行模型變更。
- Python Layout DSL。
- 插件安裝、移除與升級。
- 插件簽章或權限。
- React 改寫成純 Lumino。
- Vue 或 Angular。
- Backend API 修改。
- Graph JSON schema 修改。
- Cytoscape 替換。
- Electron 改成 Tauri。
- Windows installer。
- 視覺設計全面重製。
- 新增複雜狀態管理框架，例如 Redux。

---

## 6. 依賴策略

### 6.1 禁止繼續使用 `latest`

目前 `package.json` 有多個 dependency 使用 `"latest"`。

Agent 必須：

1. 從現有 `package-lock.json` 讀取實際安裝版本。
2. 將既有核心 dependency 的 `"latest"` 改成精確版本。
3. 不得趁此任務升級 React、Electron、Vite、TypeScript 或 Cytoscape。
4. Lumino package 使用 `--save-exact` 安裝。
5. 提交更新後的 `package-lock.json`。

建議安裝：

```bash
cd app

npm install --save-exact \
  @lumino/widgets \
  @lumino/commands \
  @lumino/signaling \
  @lumino/default-theme
```

只有確定程式直接使用時，才增加：

```text
@lumino/application
@lumino/coreutils
@lumino/messaging
```

不要因為 Lumino 間接依賴某 package，就把它重複加入直接 dependency。

### 6.2 Dependency checkpoint

完成依賴修改後執行：

```bash
npm install
npm run build
```

此階段 build 必須仍然成功，才能繼續後續修改。

---

## 7. 目標模組切分

第一版目標目錄：

```text
app/src/
├─ main.tsx
├─ api.ts
├─ types.ts
├─ styles.css
│
├─ workbench/
│  ├─ bootstrap.ts
│  ├─ WorkbenchShell.ts
│  ├─ ReactPanelWidget.tsx
│  ├─ PanelErrorBoundary.tsx
│  ├─ PanelRegistry.ts
│  ├─ commands.ts
│  ├─ layoutPersistence.ts
│  └─ workbench.css
│
├─ graph/
│  ├─ GraphSessionStore.ts
│  ├─ useGraphSession.ts
│  ├─ ToolbarView.tsx
│  ├─ ExplorerView.tsx
│  ├─ GraphPanelView.tsx
│  └─ DetailsView.tsx
│
├─ GraphView.tsx
├─ Sidebar.tsx
└─ DetailPanel.tsx
```

第一輪不要急著搬動大型既有檔案：

```text
GraphView.tsx
Sidebar.tsx
DetailPanel.tsx
api.ts
types.ts
```

先透過 wrapper 引用它們，降低 diff 與回歸風險。

PoC 穩定後，才可在獨立 commit 將其搬入 `graph/`。

---

# 8. 執行階段

## Phase 0：建立基準與保護現有行為

### 任務

1. 建立功能分支。
2. 執行前端 build。
3. 啟動 backend 與現有 frontend。
4. 記錄目前功能：
   - Backend URL connect。
   - Connection status。
   - Node／edge count。
   - Debug resources filter。
   - Infrastructure resources filter。
   - Explorer 選取 Graph node。
   - Graph 選取同步 Details。
   - Fit graph。
   - Reset layout。
   - Export PNG。
5. 截圖或在 PR 描述中記錄原始介面。

### 驗證

```bash
cd app
npm install
npm run build
```

需要 ROS 2 live data 時：

```bash
cd backend
source /opt/ros/jazzy/setup.bash
uv run ros2-node-map-backend serve
```

另一個 terminal：

```bash
cd app
npm run dev
```

---

## Phase 1：鎖定 Dependency 並加入 Lumino

### 修改

更新：

```text
app/package.json
app/package-lock.json
```

加入 Lumino dependency，並將既有 `"latest"` 依 `package-lock.json` 改為精確版本。

### 注意

- 不得執行會全面升級 package 的指令。
- 不得刪除 lock file 後重新產生。
- 不得將 package manager 改成 pnpm 或 yarn。
- 不得改變 Node module format。
- 不得改變 Electron build target。

### Checkpoint

```bash
npm ci
npm run build
```

---

## Phase 2：建立 GraphSessionStore

建立：

```text
app/src/graph/GraphSessionStore.ts
app/src/graph/useGraphSession.ts
```

### Store 責任

`GraphSessionStore` 取代 `App.tsx` 裡的共享 `useState` 與 `useEffect`，管理：

```ts
interface GraphSessionState {
  urlInput: string;
  backendUrl: string;
  connectionStatus: ConnectionStatus;
  statusMessage: string;
  snapshot: GraphSnapshot | null;
  visibleSnapshot: GraphSnapshot | null;
  selectionRequest: GraphSelectionRequest | null;
  selectedNodeIds: string[];
  showDebugResources: boolean;
  showInfrastructureResources: boolean;
}
```

Store 應提供：

```ts
class GraphSessionStore {
  getSnapshot(): GraphSessionState;
  subscribe(listener: () => void): () => void;

  setUrlInput(value: string): void;
  connect(): void;
  setShowDebugResources(value: boolean): void;
  setShowInfrastructureResources(value: boolean): void;
  requestNodeSelection(id: string, additive: boolean): void;
  setSelectedNodeIds(ids: string[]): void;

  dispose(): void;
}
```

### 實作要求

- State update 必須 immutable。
- 每次有效 state update 後通知 subscriber。
- 可以使用 `@lumino/signaling`，或建立等價的小型 subscribe 機制。
- 不得新增 Redux、MobX 或 Zustand。
- `visibleSnapshot` 可在更新時派生，或由 pure selector 計算。
- Debug／Infrastructure filter 規則必須保持與原本一致。
- Selection request token 行為必須保持一致。
- `connectGraphStream()` 回傳的 cleanup function 必須保存。
- Backend URL 改變時，必須先清理舊 connection。
- `dispose()` 必須關閉 WebSocket 並清除 listener。
- Store instance 在整個 Workbench 生命週期只能建立一次。

### React Hook

`useGraphSession.ts` 建議使用：

```ts
useSyncExternalStore
```

確保多個獨立 React Root 能訂閱同一個 Store。

概念：

```ts
export function useGraphSession(store: GraphSessionStore) {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
}
```

注意 method binding，避免把未綁定的 class method 直接傳入 hook。

### Checkpoint

先建立一個暫時的 React wrapper，讓原本介面透過 Store 運作。

確認所有既有功能不變後再進入 Phase 3。

---

## Phase 3：拆出 React Panel View

建立：

```text
app/src/graph/ToolbarView.tsx
app/src/graph/ExplorerView.tsx
app/src/graph/GraphPanelView.tsx
app/src/graph/DetailsView.tsx
```

### ToolbarView

負責：

- Brand。
- Backend URL input。
- Connect button。
- Connection status。
- Node count。
- Edge count。

所有資料與 action 都從 `GraphSessionStore` 取得。

### ExplorerView

包裝現有：

```tsx
<Sidebar />
```

需要移除或停用由 `App.tsx` 控制的：

- `collapsed`
- `onToggle`

Panel 開關改由 Lumino 管理。

Sidebar 的 filter 與 node selection 行為必須保持不變。

### GraphPanelView

包裝：

```tsx
<GraphView />
```

連接：

- `visibleSnapshot`
- `selectionRequest`
- `setSelectedNodeIds`

GraphView 的 Cytoscape 邏輯先不重構。

### DetailsView

包裝：

```tsx
<DetailPanel />
```

需要移除或停用：

- `collapsed`
- `onToggle`

Details Panel 的開關由 Lumino 管理。

### Checkpoint

可先用一個暫時的 React page 同時 render 四個 View，確認它們共享 Store 正常，再接 Lumino。

---

## Phase 4：建立 ReactPanelWidget 與錯誤邊界

建立：

```text
app/src/workbench/ReactPanelWidget.tsx
app/src/workbench/PanelErrorBoundary.tsx
```

### ReactPanelWidget

`ReactPanelWidget` 繼承 Lumino `Widget`，負責將 React Component 掛載到 Lumino Panel。

必須處理：

- `Widget.id`
- `title.label`
- `title.caption`
- `title.closable`
- React `createRoot()`
- `onAfterAttach`
- `dispose()`
- React root `unmount()`
- 避免重複 mount。
- Panel root element 高度與寬度必須是 100%。

建議 API：

```ts
interface ReactPanelWidgetOptions {
  id: string;
  title: string;
  closable?: boolean;
  render: () => React.ReactNode;
}

class ReactPanelWidget extends Widget {
  constructor(options: ReactPanelWidgetOptions);
}
```

不要在 constructor 中立刻依賴已 attach 的 DOM 狀態。

### PanelErrorBoundary

每個 ReactPanelWidget 的 React tree 最外層包一個 Error Boundary。

錯誤 Panel 應顯示：

- Panel name。
- 簡短錯誤訊息。
- Retry／reload panel button。
- Console 中保留完整 stack。

一個 Panel render 錯誤時，不得讓其他 React Root 或 Lumino Shell 消失。

### Checkpoint

建立兩個測試 Panel：

- 正常 React Panel。
- 可手動觸發 render error 的測試 Panel。

確認錯誤只顯示在測試 Panel。

測試 Panel 完成驗證後不得留在正式 UI。

---

## Phase 5：建立 PanelRegistry

建立：

```text
app/src/workbench/PanelRegistry.ts
```

### 目的

集中管理可開啟的 Workbench Panel，避免 `WorkbenchShell` 內充滿硬編碼。

建議資料模型：

```ts
type PanelId =
  | "ros2-node-map.explorer"
  | "ros2-node-map.graph"
  | "ros2-node-map.details";

interface PanelDefinition {
  id: PanelId;
  title: string;
  create: () => Widget;
  defaultArea: "main" | "left" | "right" | "bottom";
  closable: boolean;
}
```

Registry 應提供：

```ts
register(definition: PanelDefinition): void;
create(id: PanelId): Widget;
getOrCreate(id: PanelId): Widget;
findOpen(id: PanelId): Widget | null;
open(id: PanelId): Widget;
activate(id: PanelId): void;
```

### Panel lifecycle

- Graph Panel 可設為不可關閉，或關閉後能從 View menu 重開。
- Explorer 與 Details 必須可關閉並重開。
- 已開啟 Panel 再執行 open command 時，只 activate，不建立 duplicate。
- Panel dispose 後，Registry 必須移除其 instance reference。
- 新建立的 React Panel 仍使用同一個 `GraphSessionStore`。

---

## Phase 6：建立 WorkbenchShell

建立：

```text
app/src/workbench/WorkbenchShell.ts
app/src/workbench/commands.ts
app/src/workbench/workbench.css
```

### Shell 組成

建議使用 Lumino Widget／Panel：

```text
WorkbenchShell
├─ MenuBar
├─ Toolbar ReactPanelWidget
├─ DockPanel
└─ StatusBar（可先簡化）
```

Toolbar 不放進可拖曳 DockPanel。

DockPanel 預設配置：

```text
Explorer | ROS Graph | Details
```

加入順序概念：

```ts
dock.addWidget(graphWidget);

dock.addWidget(explorerWidget, {
  mode: "split-left",
  ref: graphWidget,
});

dock.addWidget(detailsWidget, {
  mode: "split-right",
  ref: graphWidget,
});
```

### Widget ID

固定使用穩定 ID，不得使用隨機 UUID：

```text
ros2-node-map.explorer
ros2-node-map.graph
ros2-node-map.details
```

Layout persistence 將依賴這些 ID。

### Commands

至少建立：

```text
view.openExplorer
view.openGraph
view.openDetails
view.resetLayout
view.saveLayout
```

可選：

```text
view.closeActivePanel
view.activateNextTab
view.activatePreviousTab
```

### View Menu

新增 `View` menu，至少包含：

```text
Explorer
ROS Graph
Details
Reset Layout
```

執行已開啟 Panel 的命令時應 activate 該 Panel。

### Keyboard shortcut

第一版只加入少量、不衝突的 shortcut。

例如：

```text
Ctrl/Cmd + Shift + E → Explorer
Ctrl/Cmd + Shift + G → Graph
Ctrl/Cmd + Shift + D → Details
```

如果與瀏覽器或 Electron 常用 shortcut 衝突，優先移除，不要強行覆蓋。

---

## Phase 7：Layout 保存與恢復

建立：

```text
app/src/workbench/layoutPersistence.ts
```

### Local storage key

使用帶版本的 key：

```text
ros2-node-map.workbench.layout.v1
```

### 重要限制

Lumino `DockPanel.saveLayout()` 回傳的 layout 中包含 Widget object，不能直接把整個物件丟入 `JSON.stringify()`。

需要建立明確 serializer：

```text
Lumino Widget object → stable widget ID
```

以及 deserializer：

```text
stable widget ID → PanelRegistry 建立或取得 Widget
```

### 要求

- 遞迴處理 tab-area 與 split-area。
- 忽略未知或已移除的 Panel ID。
- JSON parse error 時不得使 App 啟動失敗。
- Restore 失敗時回到 default layout。
- Layout schema 加入版本。
- 只保存必要欄位。
- Browser 與 Electron 使用相同 persistence 邏輯。

### 保存時機

至少支援：

- 使用者執行 Save Layout command。
- Window unload 前保存。
- Panel close／layout changed 後 debounce 保存。

不要在 drag 過程每一個 frame 寫 localStorage。

建議 debounce：

```text
250–1000 ms
```

### Reset Layout

Reset 必須：

1. 清除 localStorage。
2. 關閉／dispose 目前可重建的 Panel。
3. 恢復預設三欄配置。
4. 保持 GraphSessionStore 與 WebSocket connection 不被重建。

---

## Phase 8：Bootstrap 改造

建立：

```text
app/src/workbench/bootstrap.ts
```

修改：

```text
app/src/main.tsx
```

### bootstrap 責任

1. 建立唯一 `GraphSessionStore`。
2. 建立 `CommandRegistry`。
3. 建立 `PanelRegistry`。
4. 註冊 Panel factory。
5. 建立 `WorkbenchShell`。
6. 將 Shell attach 到 `#root`。
7. 嘗試恢復 Layout。
8. 啟動 Graph connection。
9. 註冊 window cleanup。
10. 頂層錯誤顯示 fallback。

概念：

```ts
const store = new GraphSessionStore();
const commands = new CommandRegistry();
const panels = new PanelRegistry(store);
const shell = new WorkbenchShell({ store, commands, panels });

Widget.attach(shell, document.getElementById("root")!);
```

### Cleanup

Window 關閉時：

```text
save layout
dispose shell
dispose store
```

確保 WebSocket 不殘留。

### App.tsx

完成改造後：

- 若 `App.tsx` 已無用途，刪除。
- 不要保留兩套並行 entry path。
- 不得讓 React StrictMode 造成 Store 或 WebSocket 建立兩次。

---

## Phase 9：CSS 整理

修改：

```text
app/src/styles.css
app/src/workbench/workbench.css
```

### 加入 Lumino CSS

匯入 Lumino default theme 所需 CSS。

確認實際 package 版本的 CSS entry path後再加入，不得猜測不存在的路徑。

### 移除舊 Layout CSS

以下類型的樣式在 Lumino 接管 layout 後應移除：

```text
.workspace grid columns
.panel-resizer
.is-resizing-panels
left/right collapsed width
manual split border
```

不要一次刪除所有 Sidebar／Details 視覺樣式。

### 必要尺寸規則

至少確保：

```css
html,
body,
#root {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}

.lm-Widget {
  min-width: 0;
  min-height: 0;
}

.graph-panel {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}
```

Lumino 某些版本不再預設對 Widget 使用 `overflow: hidden`，應只在需要的 Workbench container 或 Panel class 上設定，不要盲目套用到所有 Widget。

### Theme

PoC 維持現有 dark theme。

可以覆寫 Lumino CSS variable 與 tab／dock 樣式，使其接近現有 UI，但不得在本任務中全面重新設計色彩系統。

---

## Phase 10：Browser 與 Electron 驗證

### Browser

```bash
cd app
npm run dev
```

驗證 Chrome／Chromium：

- 可正常啟動。
- Menu 顯示。
- Dock 拖曳。
- Panel 分割。
- Panel tab 化。
- Panel 關閉與重開。
- WebSocket graph 更新。
- Layout reload restore。

### Electron

```bash
cd app
npm run electron:dev
```

驗證：

- Electron 啟動。
- Menu 與 Dock 正常。
- Dev server reconnect 不造成重複 Store。
- Window resize 正常。
- Cytoscape resize 正常。
- Window close 後 backend connection 清理。

### Production build

```bash
npm run build
npm run dist
```

驗證 AppImage 至少可以：

```bash
./release/ros2-node-map-*.AppImage --appimage-extract-and-run
```

本任務不得改變「backend 需獨立啟動」的既有模式。

---

# 9. 功能驗收條件

全部條件都必須通過。

## 9.1 原有功能

- [ ] Backend URL 可以輸入。
- [ ] Connect 可以切換 backend URL。
- [ ] Connection status 正常。
- [ ] Node count 正常。
- [ ] Edge count 正常。
- [ ] Graph snapshot 持續更新。
- [ ] Debug resource filter 正常。
- [ ] Infrastructure resource filter 正常。
- [ ] Explorer 選取會定位／選取 Graph node。
- [ ] Graph 選取會更新 Explorer selection。
- [ ] Graph 選取會更新 Details。
- [ ] Graph Fit 正常。
- [ ] Graph Reset Layout 正常。
- [ ] Export PNG 正常。

## 9.2 Lumino Workbench

- [ ] Explorer、Graph、Details 是獨立 Lumino Widget。
- [ ] Panel 可拖曳。
- [ ] Panel 可 split-left／right／top／bottom。
- [ ] Panel 可組成 Tab。
- [ ] Explorer 可關閉。
- [ ] Details 可關閉。
- [ ] 關閉後可從 View menu 重開。
- [ ] 重複 open command 不會產生 duplicate Panel。
- [ ] Graph Panel resize 後 Cytoscape 尺寸正確。
- [ ] 隱藏 Tab 再切回時 Graph 正常顯示。

## 9.3 Layout

- [ ] Reload 後 Layout 可恢復。
- [ ] 未保存 Layout 時使用 default layout。
- [ ] 損壞的 localStorage JSON 不會讓 App 白畫面。
- [ ] Unknown panel ID 會被忽略。
- [ ] Reset Layout 可恢復三欄預設配置。
- [ ] Reset Layout 不會重建 WebSocket Store。

## 9.4 容錯

- [ ] ReactPanelWidget dispose 時 React Root 正確 unmount。
- [ ] 關閉、重開 Panel 不會累積 subscription。
- [ ] Panel render error 只影響該 Panel。
- [ ] Shell 仍可操作並可重新開啟錯誤 Panel。
- [ ] Window close 時 WebSocket cleanup 有執行。
- [ ] Console 不得持續出現 unhandled exception。

## 9.5 Packaging

- [ ] `npm ci` 成功。
- [ ] `npm run build` 成功。
- [ ] `npm run electron:dev` 成功。
- [ ] `npm run dist` 成功。
- [ ] AppImage 可啟動前端。

---

# 10. 測試建議

本 PoC 至少增加可測試的 pure functions：

```text
layout serializer
layout deserializer
resource filter
GraphSessionStore state transition
```

如果 repository 尚未有 frontend test framework：

- 可以加入 Vitest，但必須鎖定精確版本。
- 不要同時加入多套 test framework。
- 不要為了測試導入完整 browser E2E framework。

最低測試案例：

1. Layout serialize 後不含 Widget object。
2. Layout deserialize 可依 ID 找回 Widget。
3. Unknown widget ID 不會 throw。
4. Invalid JSON 回傳 default layout。
5. Debug filter 行為與既有實作相同。
6. Infrastructure filter 行為與既有實作相同。
7. Store dispose 只執行一次 connection cleanup。
8. Reconnect 會先 cleanup 舊 connection。

如未加入自動測試，必須在 PR 中完整記錄手動驗證結果。

---

# 11. 建議 Commit 切分

不要把全部修改塞進單一 commit。

建議：

```text
1. chore(app): pin frontend dependencies and add Lumino
2. refactor(app): extract graph session store
3. refactor(app): split graph views into independent React panels
4. feat(app): add Lumino React panel adapter
5. feat(app): add Lumino workbench shell and view commands
6. feat(app): persist and restore dock layout
7. style(app): integrate Lumino theme with existing dark UI
8. test(app): cover layout persistence and graph store
9. docs(app): document Lumino workbench development
```

每個 commit 都應能 build。

---

# 12. Agent 工作規則

Agent 執行時必須遵守：

1. 先閱讀：
   - `README.md`
   - `SPEC.md`
   - `docs/architecture.md`
   - `app/package.json`
   - `app/src/App.tsx`
   - `app/src/GraphView.tsx`
   - `app/src/Sidebar.tsx`
   - `app/src/DetailPanel.tsx`
   - `app/src/api.ts`
   - `app/src/types.ts`
2. 先跑 baseline build，再修改。
3. 不得修改 backend protocol。
4. 不得變更 Graph JSON schema。
5. 不得刪除既有功能。
6. 不得無理由全面格式化大型檔案。
7. 不得順手升級無關 dependency。
8. 不得用 `any` 繞過 TypeScript error，除非第三方型別確實無法表示，且要加註解。
9. 不得吞掉 exception；錯誤需記錄並提供 fallback。
10. 不得將 Store 建立在個別 React Panel 內。
11. 不得讓 Panel factory 建立新的 WebSocket connection。
12. 不得使用隨機 Widget ID。
13. 不得直接 JSON serialize Lumino Widget。
14. 不得把 React Component 直接寫進 `WorkbenchShell.ts`。
15. 每完成一個 Phase 就執行 build。
16. 發現既有測試或 build 失敗時，先確認是否為 baseline 問題。
17. 保留使用者未提交的修改。
18. 最終回報實際完成項目、未完成項目與已知限制。

---

# 13. 預期最終架構

```text
Browser / Electron Renderer
│
├─ Lumino WorkbenchShell
│  ├─ MenuBar
│  ├─ ToolbarWidget
│  ├─ DockPanel
│  │  ├─ Explorer ReactPanelWidget
│  │  ├─ Graph ReactPanelWidget
│  │  └─ Details ReactPanelWidget
│  └─ StatusBar
│
├─ CommandRegistry
├─ PanelRegistry
├─ LayoutPersistence
│
└─ GraphSessionStore
   ├─ WebSocket lifecycle
   ├─ Connection state
   ├─ Graph snapshot
   ├─ Visible graph selector
   ├─ Filter state
   └─ Selection state
```

資料流：

```text
Python backend
    ↓ WebSocket JSON
GraphSessionStore
    ↓ subscriptions
Independent React Panel Roots
    ↓
Lumino Widgets
```

Panel layout 與 ROS graph data 必須保持分離：

```text
Lumino 管 Panel 位置與生命週期
GraphSessionStore 管應用資料與 WebSocket
React 管 Panel 內部顯示
Cytoscape 管 Graph canvas
```

---

# 14. PoC 完成後的評估問題

完成後在 PR 或 `docs/lumino-poc-result.md` 回答：

1. Lumino DockPanel 操作是否符合預期？
2. Cytoscape 在 Dock resize 與 Tab 切換是否可靠？
3. ReactPanelWidget mount／unmount 是否穩定？
4. 多 React Root 共用 Store 是否易於維護？
5. Layout serializer 是否足夠可靠？
6. Electron 與 Browser 行為是否一致？
7. Lumino CSS 與現有 CSS 是否容易整合？
8. Bundle size 增加多少？
9. 是否出現明顯效能退化？
10. Workbench 模組是否值得在第二個應用重用？
11. 哪些模組具有抽成 framework package 的價值？
12. 哪些設計應留在 `ros2-node-map`，不應抽象化？

只有 PoC 通過後，才進入下一階段：

```text
Plugin View API
→ Frontend plugin registry
→ Python Plugin Host
→ Python declarative UI
```

---

# 15. Definition of Done

本任務只有在以下條件全部成立時才算完成：

- 現有 Graph 功能無回歸。
- 固定三欄 CSS layout 已由 Lumino DockPanel 取代。
- Explorer、Graph、Details 可 Dock／Split／Tab。
- Panel 可透過 View menu 關閉與重開。
- Layout 可保存、恢復與重設。
- React Panel 有獨立 Error Boundary。
- Browser 與 Electron 都能運行。
- AppImage build 未被破壞。
- Dependency 已鎖定，不再使用 `"latest"`。
- Build 無 TypeScript error。
- 沒有修改 backend protocol。
- 文件記錄 PoC 結果與已知限制。
