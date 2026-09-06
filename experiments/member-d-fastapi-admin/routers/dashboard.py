# 仪表盘只提供聚合统计接口，具体业务数据仍由各业务路由负责。
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import MediaFile, AuditLog

# 路由器由 main.py 统一挂载到 /api 前缀下。
router = APIRouter()

@router.get("/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """返回后台首页需要展示的媒体文件数和审计日志数。"""
    # 统计媒体元数据记录数量，用于展示媒体库规模。
    media_count = db.query(MediaFile).count()
    # 统计审计日志数量，用于展示系统写操作记录规模。
    log_count = db.query(AuditLog).count()
    # 统一返回仪表盘所需的聚合结果和接口状态。
    return {"media_total": media_count, "audit_logs": log_count, "status": "ok"}