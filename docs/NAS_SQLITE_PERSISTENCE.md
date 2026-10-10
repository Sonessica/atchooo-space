# NAS SQLite 数据与备份

当前 `/bento/editor` 从 `/api/private/editor` 读取、写入一份共享快照。快照包含卡片、个人资料和站点设置。后端实现位于 `src/lib/server/editor-db.ts`，使用 Node.js 22 的 `node:sqlite`；当前编辑器接口公开，不依赖旧版 Supabase 登录或 `/api/private/session` 的会话状态。

## 存储位置

Compose 将宿主机 `./data` 挂载到容器 `/app/data`。默认数据库为 `./data/atchooo-space.sqlite`，上传媒体在 `./data/media/`；可分别通过 `ATCHOOO_DB_PATH`、`ATCHOOO_MEDIA_PATH` 调整容器内路径。数据库采用 WAL 模式，运行中可能同时出现 `atchooo-space.sqlite-wal` 和 `atchooo-space.sqlite-shm`。不要将 `data/` 纳入 Git 或 Docker 构建上下文。升级自旧版 Account Hub 时，运行时仍兼容原 `ACCOUNT_HUB_*` 环境变量，但建议迁移到新变量名。

## 保存与首次导入

- 页面加载时读取 SQLite；首次为空且当前浏览器有遗留 OpenBento localStorage 卡片时，展示一次性导入选择。无论选择导入还是空白开始，原 localStorage 不会被清除。
- 编辑后的快照自动保存。写入携带 revision；若其他浏览器已先保存，接口返回 HTTP 409，页面提示刷新，不会静默覆盖较新的快照。
- 快照请求限制为 20 MB；上传图片限制为每张 20 MB并转为 WebP，上传视频限制为每个 200 MB并转为 H.264/AAC MP4。Live Photo 以 WebP 封面和配套 MP4 保存。设置面板的「导出 JSON」只导出个人资料，不能替代数据库备份。

## 备份与恢复

备份应同时保护数据库和 `media/`，并放在 `data/` 目录之外。推荐使用 SQLite online backup API 生成一致性数据库副本，再复制媒体目录；另一种做法是先停止应用容器，再复制整个 `data/`（包含可能存在的 `-wal`、`-shm` 文件）。运行中只拷贝主 `.sqlite` 文件可能遗漏尚在 WAL 中的写入。

恢复时先停应用，确认备份来自同一时点，恢复数据库与对应媒体目录后再启动。不要把备份文件放回 `data/` 作为常驻文件：它会增加空间占用，也容易与当前数据库混淆。部署代码更新通常不需要清空或重建数据库；NAS 仅拉取 GitHub Actions 生成的镜像，使用 `docker compose --env-file .env --env-file deploy-image.env up -d --no-build` 继续使用原有 bind mount。不要在 NAS 上运行构建；发布和回退见 [部署说明](DEPLOYMENT.md)。

仓库仍保留旧版 Supabase 路由和会话代码；这些不是当前共享快照的备份来源。
