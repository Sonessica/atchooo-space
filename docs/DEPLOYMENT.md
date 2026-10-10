# 云端构建、NAS 部署

工作流：`.github/workflows/deploy.yml`。推送 main 自动运行，亦可 Actions 手工触发。并发发布串行排队，不中断正在部署的作业。

## 产物

- `ghcr.io/sonessica/atchooo-space-runtime:node22-ffmpeg-bw2026.6.0`：干净基础镜像，禁止以旧应用镜像作基础。
- `ghcr.io/sonessica/atchooo-space:<完整提交 SHA>`：通过检查的 standalone 应用。
- `latest`：最新通过检查的应用。线上使用 digest 而非可变标签。

基础镜像和应用分别缓存。FFmpeg/Bitwarden 变化只影响基础镜像，日常代码变化无需重新安装这些工具。GitHub 缓存可被淘汰，不能承诺永久免下载。

## NAS

目录 `/share/Container/atchooo-space`，网络 `nas-frontend`，沿用 Nginx 与 `space.atchooo.com:2096`。保留 `.env`、`data/`；Compose 不含 build。Docker 守护进程的现有代理处理 GHCR 拉取。

自动部署使用仓库 Secret `NAS_SSH_PASSWORD` 连接固定主机。GITHUB_TOKEN 经标准输入传输用于临时 GHCR 登录，部署结束删除临时认证配置，不写入 `.env`。SSH 主机公钥固定在工作流中；换主机必须核对后更新。

更新之前在线备份 SQLite 到 `releases/<commit>/before.sqlite`。发布失败自动恢复旧应用镜像，不覆盖数据库。当前工作流不支持破坏性数据库迁移；此类升级必须另拟恢复方案。

## 手工回退

确认旧镜像仍在，再将 `deploy-image.env` 的 `ATCHOOO_IMAGE` 设置为旧 digest 或本机已有镜像标签：

```sh
docker compose --env-file .env --env-file deploy-image.env up -d --no-build --pull never
```

只回退应用，不恢复数据库。完整数据灾难恢复见 NAS_SQLITE_PERSISTENCE.md。发布目录备份应定期归档；本流程不自动删除任何历史镜像或用户媒体。
