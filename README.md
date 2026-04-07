# A 股因子评测看板

这是一个和 `quant` 并行的轻量动态网站项目，用来展示 Dagster 因子分析产物。

架构：

- FastAPI 后端提供 `/api/analysis`、`/api/factors`、`/health`
- 前端页面从 API 动态读取因子评测结果
- 数据目录默认是 `./data`，也可以用环境变量 `FACTOR_DASHBOARD_DATA_DIR` 指定

## 云端部署

```bash
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

Docker 部署：

```bash
docker build -t factor-dashboard .
docker run -p 8080:8080 factor-dashboard
```

如果云服务器需要指定数据目录：

```bash
FACTOR_DASHBOARD_DATA_DIR=/data/factor-dashboard/data uvicorn app.main:app --host 0.0.0.0 --port 8080
```

推送到 GitHub：

```bash
git init
git add .
git commit -m "Initial factor dashboard"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

## GitHub 自动部署到云服务器

这个项目已经包含：

```text
.github/workflows/deploy.yml
```

每次推送到 GitHub `main` 分支后，GitHub Actions 会通过 SSH 登录服务器，让服务器在部署目录里执行：

```bash
git fetch origin main
git reset --hard origin/main
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart factor-dashboard
```

这版不使用 Docker。你的 GitHub Deploy Key 用在服务器上，让服务器可以从 GitHub 拉取仓库。

你需要在 GitHub 仓库的 `Settings -> Secrets and variables -> Actions -> Repository secrets` 里配置：

```text
SERVER_HOST              服务器公网 IP
SERVER_USER              SSH 用户名，例如 ubuntu
SERVER_SSH_KEY           GitHub Actions 登录服务器用的 SSH 私钥
SERVER_PORT              SSH 端口，可选，默认 22
DEPLOY_PATH              服务器部署目录，可选，默认 /home/ubuntu/factor-dashboard
SERVICE_NAME             systemd 服务名，可选，默认 factor-dashboard
```

服务器上需要提前完成首次 clone：

```bash
cd /home/ubuntu
git clone <your-github-repo-url> factor-dashboard
```

并创建 systemd 服务，例如 `/etc/systemd/system/factor-dashboard.service`：

```ini
[Unit]
Description=Factor Dashboard
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/factor-dashboard
Environment=FACTOR_DASHBOARD_DATA_DIR=/home/ubuntu/factor-dashboard/data
ExecStart=/home/ubuntu/factor-dashboard/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8080
Restart=always

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable factor-dashboard
sudo systemctl start factor-dashboard
```

访问：

```text
http://<your-server-ip>:8080
```

## 当前展示内容

页面会展示单个因子、单个 horizon 下的：

- `summary`：IC 均值、ICIR、`|IC| > 0.02` 比例、多空收益、夏普、最大回撤、换手率、胜率
- `metadata`：因子字段名、展示名、计算公式、数据来源
- `ic_timeseries`：IC 时间序列
- `group_returns`：分组收益与多空收益
- `monitor`：预处理后的因子覆盖率、均值、标准差
- `raw_monitor`：原始因子覆盖率、均值、标准差

## 数据接入格式

如果你修改了 `quant` 里的 `FACTOR_LIST`，先在云端项目根目录执行：

```bash
cd quant
python3 scripts/export_factor_registry_metadata.py
```

它会生成：

```text
factor-dashboard/data/factor-metadata.json
```

前端会优先用这个文件展示因子字段名、展示名、计算公式和所需字段。

后端会优先读取：

```text
data/factors/{factor_name}/horizon_{horizon}/analysis.json
```

如果找不到，就使用：

```text
data/sample-factor-analysis.json
```

后续可以在 `quant` 里增加一个导出步骤，把这些 parquet：

```text
factor/analysis/{factor_name}/horizon_{horizon}/summary.parquet
factor/analysis/{factor_name}/horizon_{horizon}/ic.parquet
factor/analysis/{factor_name}/horizon_{horizon}/group_returns.parquet
factor/analysis/{factor_name}/horizon_{horizon}/monitor.parquet
factor/analysis/{factor_name}/horizon_{horizon}/raw_monitor.parquet
```

聚合成 `analysis.json` 给前端读取。
