# SQLAlchemy 基础组件：负责创建连接、管理会话和声明 ORM 模型基类。
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from sqlalchemy.pool import NullPool

# 数据库连接地址。生产环境建议从环境变量读取，避免把账号密码写入源码。
SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:123456@localhost:3306/toy_cms?charset=utf8mb4"

# 创建数据库引擎；NullPool 表示每次使用独立连接，适合当前这个轻量后端。
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    poolclass=NullPool,
    echo=False
)

# 为每个请求创建独立的数据库会话，不自动提交也不自动刷新对象。
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
# 所有数据模型都继承这个基类，启动时可据此创建对应的数据表。
Base = declarative_base()

# FastAPI 依赖注入使用的会话生成器，请求结束后统一释放连接。
def get_db():
    # 创建当前请求专用的数据库会话。
    db = SessionLocal()
    try:
        # yield 会把会话交给接口函数使用，接口执行完后再继续清理。
        yield db
    finally:
        # 无论接口成功还是抛出异常，都要关闭会话释放数据库连接。
        db.close()

__all__ = ["engine", "SessionLocal", "Base", "get_db"]