# ATCHOOO

ATCHOOO `0.7.2` 是一个基于 [OpenBento](https://github.com/bravohenry/openbento) 改造的、自托管个人空间。它以 Bento 无限画布为核心，通过 HOME、NOTES、GALLERY、BOOKMARKS 四个独立 Space 管理和展示链接、媒体、文字与位置等内容。

当前版本面向桌面浏览器和个人使用场景。访客模式与编辑模式使用同一份 NAS SQLite 数据，修改会自动保存。

## 示例页面

### 首页

<img width="3840" height="1919" alt="image" src="https://github.com/user-attachments/assets/306c7b6f-2d36-4dc9-b323-22985c179beb" />

### 搜索

<img width="3840" height="1919" alt="image" src="https://github.com/user-attachments/assets/53157f5d-2204-4881-bb4a-dfac41d048f3" />

### 导航轮盘

<img width="3840" height="1919" alt="image" src="https://github.com/user-attachments/assets/652d2c58-8b72-46a5-b62b-9f74382e9a93" />

### LightBox

<img width="3840" height="1919" alt="image" src="https://github.com/user-attachments/assets/f7ded36b-97e1-4ee4-bc04-51105f69c16e" />



## 页面与入口

| 地址 | Space | 说明 |
| --- | --- | --- |
| `/` | HOME | 主画布，包含居中的卡片搜索框 |
| `/notes` | NOTES | 独立的笔记画布，不显示搜索框 |
| `/gallery` | GALLERY | 独立的图集画布，不显示搜索框 |
| `/bookmarks` | BOOKMARKS | 独立的收藏画布，不显示搜索框 |
| `/bento/editor`、`/editor` | HOME | 兼容旧地址，重定向至 `/` |

四个 Space 分别保存卡片布局、画布平移位置和缩放比例。首次打开网站会显示黄蓝渐变开屏动画；通过轮盘在 Space 之间切换时不会重复播放。

## 浏览模式

- 按住画布空白区域拖动，可以自由平移无限画布。
- HOME 的搜索框会按标题、URL、文字内容和卡片类型即时筛选卡片。
- 图片或图集卡片可双击进入 Lightbox。
- Lightbox 支持左右方向键、鼠标滚轮和缩略图切换图片，按 `Esc` 或点击背景关闭。
- 页面只渲染当前视口附近的卡片；大量卡片不会全部常驻 DOM。
- 被标记为隐藏的卡片不会在浏览模式显示，但仍可在编辑模式找到。

## Radial Navigation 2.0

右下角磨砂玻璃轮盘是四个 Space 的主要导航入口。

- HOME → NOTES → GALLERY → BOOKMARKS → HOME 无限循环，反向同样循环。
- 鼠标移入轮盘后显示完整内容；闲置时自动降低透明度和视觉权重。
- 编辑模式下轮盘收缩成低存在感 Orb，悬停后恢复完整尺寸。
- 在轮盘上滚动时先改变预选项，停止约 650 ms 后确认进入。
- 点击轮盘项目可以立即选择并进入。
- 第一次使用显示 `SCROLL TO SELECT`，成功操作一次后改为当前 Space 和序号提示。
- 页面切换使用方向一致的 View Transition；不支持或启用 reduced motion 时自动退化为普通切换。

轮盘键盘操作：

| 按键 | 操作 |
| --- | --- |
| `↑` / `←` | 预选上一个 Space |
| `↓` / `→` | 预选下一个 Space |
| `Enter` | 进入当前预选 Space |
| `Esc` | 取消预选，恢复当前 Space |

输入框、文本框或下拉框获得焦点时，轮盘不会拦截这些按键。

## 编辑模式

点击左下角“编辑”进入编辑模式，点击“完成”回到浏览模式。设置和编辑入口固定在页面左下角，不参与 Space 切换动画。

### 添加卡片

编辑模式下的添加工具栏支持：

- Link：粘贴或输入 URL，自动识别 GitHub、YouTube、X/Twitter、Spotify 等平台，并生成对应链接卡片。
- Media：上传静态图片、Live Photo 或视频；图片压缩为 WebP，动态内容转为 H.264/AAC MP4，SQLite 只保存媒体路径。
- Text：添加文字/便签卡片。
- Map：添加地图卡片并搜索位置。
- Section：添加分区标题卡片。

按 `Ctrl/Cmd + K` 可以打开 Universal Add / Command Palette：

- 粘贴 URL 后按 `Enter`，创建智能链接卡片。
- 输入普通文字后按 `Enter`，创建文字卡片。
- 执行自动布局。
- 切换四个 Space。
- 搜索并定位当前 Space 中已有的卡片。
- 按 `Esc` 或点击面板外关闭。

### 外部拖放

编辑模式下可以把内容直接拖入画布：

- 从浏览器拖入 URL：自动创建链接卡片。
- 拖入本地图片或视频：上传并创建媒体卡片。
- 同时拖入同名照片与 MOV：自动配对为 Live Photo；其他文件分别作为静态图片或视频。

单张图片上限为 20 MB，单个视频上限为 200 MB。上传后静态封面作为 WebP、动态内容作为 MP4 保存在媒体目录，不会以 base64 写入页面快照。

### 选择与操作卡片

- 单击卡片：选择卡片并显示浮动 Context Toolbar。
- `Shift + 单击`：加入或移出多选集合。
- 双击卡片：打开统一的 `WidgetEditorPanel` 内容编辑面板。
- 点击画布空白区域：取消选择并开始平移画布。
- 选中卡片会轻微抬升并增强阴影，不使用粗描边。

Context Toolbar 当前提供编辑、复制、锁定/解锁、隐藏和删除。尺寸选择器支持 `1×1`、`2×1`、`1×2`、`2×2`；地图卡片额外提供位置搜索。锁定卡片不会响应方向键移动。隐藏卡片仍会在编辑模式显示。

### 拖动、碰撞与 Resize

- 按住卡片拖动，卡片会抬升并使用 Spring 跟随指针。
- 放下时坐标吸附到 Bento Grid，不使用自由像素定位。
- 空白目标位置直接落位；同尺寸卡片落在对方原点时可交换位置。
- 覆盖一个或多个卡片时，阻挡卡片会被推到最近的合法位置。
- Resize 同样执行完整碰撞检测，并自动推挤被新尺寸覆盖的卡片。
- HOME 的搜索框保留区域始终参与碰撞检测，卡片不会覆盖搜索框。
- 其他三个 Space 没有搜索保留区，可以使用画布原点。
- 所有布局结果都会检查卡片完整占用区域，避免非法重叠。

### 自动布局

点击左下角“自动布局”执行 Balanced 布局。右键点击该按钮可选择 Compact、Balanced、Organic、Rows、Columns 或 Focus。

布局操作会进入 Undo/Redo 历史。Balanced 会围绕 HOME 搜索框或其他 Space 的原点均衡铺开，结果是确定性的，不再随机留下单侧大片空白。

### 画布缩放和视角

- `Ctrl/Cmd + 鼠标滚轮`：在 35%–180% 范围缩放画布。
- 右上角 `−`、百分比、`＋` 控件：调整缩放比例或恢复到 100%。
- 每个 Space 的 Pan 与 Zoom 保存在浏览器 localStorage，返回时恢复上次视角。
- Widget Registry 已预留 compact、standard、detail 尺寸变体定义。

## 编辑快捷键

以下快捷键仅在编辑模式、且输入控件没有获得焦点时生效：

| 快捷键 | 操作 |
| --- | --- |
| `Ctrl/Cmd + K` | 打开或关闭 Universal Add / Command Palette |
| `Ctrl/Cmd + Z` | 撤销 |
| `Ctrl/Cmd + Shift + Z` | 重做 |
| `Ctrl/Cmd + D` | 复制当前卡片 |
| `Ctrl/Cmd + C` | 将当前卡片复制到编辑器剪贴板 |
| `Ctrl/Cmd + V` | 粘贴编辑器剪贴板中的卡片 |
| `Ctrl/Cmd + A` | 选择当前 Space 的全部卡片 |
| `Delete` / `Backspace` | 删除当前选择；多选时批量删除 |
| `Esc` | 取消卡片选择 |
| `←` `→` `↑` `↓` | 将当前卡片移动一个网格单位，并处理碰撞 |
| `Shift + 方向键` | 将当前卡片移动两个网格单位，并处理碰撞 |

Undo/Redo 使用统一快照历史，覆盖创建、删除、复制、内容更新、移动、Resize 和自动布局。刷新页面后会开始新的浏览器会话历史；服务端另行保留版本快照。

## 卡片类型

### Link

- URL、标题、副标题、CTA、自定义图标、收藏夹、标签和背景图。统一采用磨砂玻璃面板及蓝色胶囊按钮，旧菜单色字段不再影响展示，编辑面板不再提供底色选择。
- 保留约 500ms 的封面缩为头像、面板向上展开和文字淡入过渡。1×1、1×2、2×1、2×2 分别采用适合尺寸的信息布局，底部图标和按钮在各自分区居中，展开前后保持固定位置；面板内部不显示分割线。悬停展开详情，右上角按钮可固定展开；无背景图时显示柔和渐变及平台图标。
- 根据 URL 自动检测平台并使用平台默认信息。
- 支持 GitHub、YouTube、X/Twitter、Instagram、TikTok、Spotify、LinkedIn、Facebook、Pinterest、Threads、Discord、Telegram、Twitch、Medium、Reddit 等平台及通用链接。
- 同一平台的不同账号可分别建立卡片；每张卡片有独立 ID、URL、标题与背景图。编辑工具栏创建时可手填账号名称和头像/背景图片 URL，创建后也可在编辑面板上传背景图。
- 浏览模式下点击卡片可直接打开 URL；左下角图标仍可设为单独的跳转地址。
- 编辑工具栏提供“批量导入 Link”，可上传或粘贴 CSV、JSON，预览后一次加入当前 Space。CSV 第一行须有 `url`，可选列为 `title`、`subtitle`、`ctaLabel`、`backgroundImage`、`customIcon`、`menuBg`、`collection`、`tags`、`onCanvas`；CSV 的多个标签用分号分隔，JSON 的 `tags` 可用字符串数组。每次最多 200 条，仅接受 HTTP/HTTPS URL。
- 页面左下角“收藏夹”汇总四个 Space 的 Link，可按标题、URL、标签、收藏夹和检查状态筛选。编辑模式下可设置标签和收藏夹，也可把链接从当前画布移除并保留在收藏夹，之后再显示到画布。其他 Space 的链接可跳转到对应 Space 编辑或复制到当前画布。
- 编辑模式下可手动检查当前 Space 的全部或单条链接。检查结果分为正常、已跳转、失效（404/410）和无法判断，随 Space 快照保存；修改 URL 会清除旧结果。检查接口需要管理员会话，并拒绝请求内网地址。
- 编辑模式下可在收藏夹预览 Vaultwarden 条目，再明确勾选要公开的 1–20 个链接同步到 Bookmarks。先登录站点管理员，再输入 Vaultwarden 主密码；密码只用于本次预览/同步，不写入环境变量或数据库，保管库条目 ID 只保存在服务端私有映射表中。手动设置的背景、标签、收藏夹和画布状态会保留；保管库中删除的条目不会自动删除对应卡片。同步前会校验 Bookmarks 版本，避免覆盖尚未保存或并发产生的修改。网址中的查询参数和片段会被移除，OAuth 授权页会改为站点首页。只有勾选后同步的 Link 卡片才公开可见。

### Media / Gallery

- 单个媒体卡片可混合保存最多 9 个静态图片、Live Photo 或视频。
- 支持批量上传、同名照片/MOV 自动配对、拖动排序、删除媒体、双击设置封面。
- Live Photo 和视频默认显示静态封面；浏览模式悬停约 300ms 后静音预览，多图导览的静图每张停留 2 秒，灯箱中可完整播放。
- 支持固定封面或随机封面。
- 支持 Crossfade、Blur、Drift、Ken Burns、Reveal、Shutter 和随机切换效果。
- 支持封面切换间隔、标题、副标题与 cover/contain 显示模式。
- 设置菜单的“媒体与动效”可调整悬停导览停留时间、视频播放上限、预览延迟、随机封面间隔、动效及新卡片默认值；“画布”可调整默认缩放、自动居中和开场动画。这些设置保存在 NAS SQLite 中，四个 Space 共用。卡片上单独设置的值优先于全局默认值。
- 浏览模式提供 Lightbox 和缩略图导航。

### Text

- 支持 note、quote、plain 变体。
- 可编辑正文、署名和 Emoji。

### Map

- 保存地点名称、经纬度、Zoom 与地图样式。
- 编辑状态提供位置搜索。

### Section Title

- 用于画布分区标题。
- 使用固定布局，不显示普通卡片的尺寸选择器。

## Widget Registry 与空间架构

`src/bento/widgets/widgetRegistry.ts` 描述 Link、Image、Text 和 Map 的类型、名称、图标、默认尺寸、允许尺寸、创建函数、操作集合和尺寸变体。

`src/lib/space-config.ts` 统一描述 Space 的 ID、名称、Label、地址、顺序、可见性、主题与 Anchor。SQLite 已建立 `hub_entities` 和 `custom_spaces` 表，为 Entity → Widget → Space 和自定义 Space 的后续界面提供迁移基础；当前公开导航仍固定显示四个内置 Space。

## 保存、冲突与版本历史

- 卡片、个人资料和站点设置在修改后约 1.5 秒自动保存。
- 保存中右上角显示状态动画；网络失败时保留当前状态并提供重试。
- 保存采用 revision 乐观锁；其他浏览器已经写入新版时会提示冲突并要求刷新。
- 服务端每次覆盖已有快照前，会把旧版本写入 `editor_versions`。
- `GET /api/private/editor?space=home&history=1` 可读取最近 30 个版本快照。
- 版本历史已经持久化，但尚未提供可视化 Preview / Restore 面板。

首次遇到空数据库时，HOME 可选择导入浏览器中遗留的 OpenBento 卡片，或从空白开始。导入不会删除原 localStorage 数据。

设置面板可修改个人资料和头像。设置中的 JSON 导入/导出只包含个人资料，不是完整的卡片与 Space 备份。

## 数据存储

服务端使用 Node.js 22 的 `node:sqlite`。Docker Compose 将宿主机的 `./data` 挂载到容器 `/app/data`。

| 内容 | 默认位置 |
| --- | --- |
| Space 快照、revision、版本历史 | `./data/atchooo-space.sqlite` |
| 上传并处理后的 WebP 图片与 MP4 视频 | `./data/media/` |
| 每个 Space 的 Pan / Zoom | 浏览器 localStorage |
| 首次迁移使用的旧卡片 | 浏览器 localStorage |

页面快照请求上限为 20 MB，单张原始图片上限为 20 MB，单个视频上限为 200 MB。SQLite 使用 WAL 模式，运行时可能出现 `atchooo-space.sqlite-wal` 和 `atchooo-space.sqlite-shm`。备份、恢复与一致性要求见 [NAS 数据说明](docs/NAS_SQLITE_PERSISTENCE.md)。

## NAS / Docker 部署

需要 Docker Compose、外部 Docker 网络 `nas-frontend` 和可写的 `data/` 目录。

```bash
cp .env.example .env
# 设置至少 6 字符的 ATCHOOO_ADMIN_PASSWORD
# 如需 Vaultwarden 同步，另设 VAULTWARDEN_URL 和 VAULTWARDEN_EMAIL；不要把主密码写入 .env
# 以及至少 32 字符的 ATCHOOO_SESSION_SECRET
docker compose pull
docker compose up -d --no-build
docker compose logs --tail=50 atchooo-space
```

发布由 [GitHub Actions](.github/workflows/deploy.yml) 执行：main 推送 → Linux 构建与 lint/测试 → standalone 镜像启动验证 → GHCR 发布 → NAS 拉取并重建应用容器。NAS 不执行 npm 安装或 Next.js 构建。私有 GHCR 镜像手工拉取前需先登录；自动发布使用短期 GITHUB_TOKEN，登录配置部署后即删除。

独立运行基础镜像 `ghcr.io/sonessica/atchooo-space-runtime` 仅包含官方 Node 22、FFmpeg、CA 证书和固定版本 Bitwarden CLI，不继承历史应用镜像。应用镜像只复制 `.next/standalone`、静态资源、public 和维护脚本，不复制完整开发依赖。两套 BuildKit 缓存保存在 GitHub Actions；缓存失效或更新基础镜像时仍可能重新下载基础依赖，但不会在 NAS 上执行。

仓库需配置加密 Secret `NAS_SSH_PASSWORD`。部署固定 SSH 主机公钥，使用现有 Docker 代理拉取镜像；网络失败不会先停止旧服务。部署脚本在 `releases/<commit>/before.sqlite` 创建在线 SQLite 备份，保留 `.env` 和 `data/`，以镜像 digest 固定版本，健康检查失败回退旧镜像（不自动回滚数据库）。备份不复制媒体：当前发布不修改已有媒体；完整备份仍需另行备份媒体目录。不要删除上一版镜像或全局 prune。发布记录与回退参考见 [部署说明](docs/DEPLOYMENT.md)。

当前 `docker-compose.yml` 的公开地址为 `https://space.atchooo.com:2096`。更换域名时需要同步检查 Compose、Dockerfile 中的 `NEXT_PUBLIC_APP_URL` 以及反向代理。

部署更新前应先备份 SQLite 和 `data/media`。不要使用 `docker compose down -v` 删除数据卷，也不要提交 `.env`、`data/` 或部署备份。

## 本地开发

需要 Node.js 22+。

```powershell
npm ci
$env:ATCHOOO_DB_PATH = (Join-Path (Get-Location) 'data/atchooo-space.sqlite')
$env:ATCHOOO_MEDIA_PATH = (Join-Path (Get-Location) 'data/media')
$env:NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
npm run dev
```

打开 `http://localhost:3000`。提交前运行：

```bash
npm run typecheck
npm run lint
npm run test:canvas
npm run build
```

`npm run migrate:images` 用于把旧快照中的 base64 图片迁移为独立文件。它会修改数据库，只应执行一次，并且必须先备份。

## 技术栈

- Next.js 16、React 19、TypeScript 5。
- Framer Motion、Tailwind CSS 4。
- Node.js `node:sqlite`、Sharp WebP 图片处理、FFmpeg 视频转码与封面提取。
- MapLibre GL、Docker Compose。

## 当前权限边界

当前主页是单用户、共享编辑数据的实现，现行编辑器和 `/api/private/editor`、`/api/private/media` 没有密码门禁。能访问站点的人也能进入编辑模式并修改页面。

仓库仍保留旧版 Supabase 多用户页面、认证 API 和会话接口，但它们不驱动当前主页。`.env` 中的管理密码与会话密钥是 Compose 和旧会话接口所需配置，不会自动保护当前编辑器。

## 当前尚未提供完整界面的能力

以下能力已有部分数据结构或扩展点，但不能视为当前可操作功能：

- Collection、空间展开和 Platform Group。
- 自定义 Space 的新增、重命名、排序、隐藏和删除界面。
- Accounts、Bookmarks、Notes、Projects 的独立内容库管理界面。
- Entity Library 的 CRUD 界面。
- 可视化版本历史 Preview / Restore。
- 框选、多选对齐/分布与集合化操作。
- 手机端专用布局和移动端交互优化。

## 代码与文档入口

| 路径 | 作用 |
| --- | --- |
| `src/app/page.tsx` | HOME 入口 |
| `src/app/notes`、`gallery`、`bookmarks` | 其他三个 Space 入口 |
| `src/bento/editor/` | 无限画布、编辑器、历史、自动布局、Command Palette |
| `src/bento/widgets/` | Widget 类型、渲染、平台识别与 Registry |
| `src/components/site/RadialNavigation.tsx` | 轮盘导航与 Space Transition |
| `src/lib/space-config.ts` | SpaceConfig 与 Anchor 定义 |
| `src/app/api/private/` | SQLite 快照与媒体接口 |
| `src/lib/server/editor-db.ts` | SQLite schema、保存和版本历史 |
| `docs/NAS_SQLITE_PERSISTENCE.md` | 数据、备份、恢复与迁移 |
| `docs/LOCATION_SEARCH.md` | 地图位置搜索 |

各模块的 `.folder.md` 是开发时使用的局部代码地图；维护约定见 [FRACTAL_DOCS.md](FRACTAL_DOCS.md)。实际行为以代码为准，修改架构时应同步更新对应文档。

## License

本项目按 [MIT License](LICENSE) 发布。

ATCHOOO 基于 [OpenBento](https://github.com/bravohenry/openbento) 修改。经核对，上游 `package.json` 将项目标注为 MIT，并将作者标注为 OpenBento Community，但上游当前没有独立的许可文件。本仓库已补齐完整 MIT 文本并保留上游归属说明；Uiverse 片段及其他第三方内容见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。第三方依赖仍分别适用其作者发布的许可条款。
