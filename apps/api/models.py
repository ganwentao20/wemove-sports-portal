# 数据库表模型定义：每个 ORM 类对应一张业务数据表。
from database import Base
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime

class Category(Base):
    """文章分类，支持自定义展示顺序。"""
    __tablename__ = "categories"
    # 分类主键，同时建立索引以加快按 id 查询。
    id = Column(Integer, primary_key=True, index=True)
    # 分类名称必须唯一，避免出现同名分类。
    name = Column(String(50), unique=True)
    # 数值越小越靠前，用于控制分类展示顺序。
    sort = Column(Integer, default=0)
    # 一个分类可以关联多篇文章。
    articles = relationship("Article", back_populates="category")

class Article(Base):
    """文章内容及其发布状态。"""
    __tablename__ = "articles"
    # 文章主键。
    id = Column(Integer, primary_key=True, index=True)
    # 文章标题和正文内容。
    title = Column(String(100))
    content = Column(Text)
    # 外键关联 categories.id，实现文章分类联动。
    category_id = Column(Integer, ForeignKey("categories.id"))
    # 文章状态：1 表示发布，0 表示草稿。
    status = Column(Integer, default=1)
    # 创建时间由数据库对象生成后自动记录。
    created_at = Column(DateTime, default=datetime.now)
    # 更新文章时自动刷新该时间；新建时为空。
    updated_at = Column(DateTime, onupdate=datetime.now)
    # 反向访问文章所属的分类对象。
    category = relationship("Category", back_populates="articles")

class User(Base):
    """后台用户及角色信息。"""
    __tablename__ = "users"
    # 后台用户主键。
    id = Column(Integer, primary_key=True)
    # 登录用户名必须唯一。
    username = Column(String(50), unique=True)
    # 用户密码字段；正式项目中应保存加密后的密码哈希。
    password = Column(String(255))
    # 用户角色，默认允许编辑内容。
    role = Column(String(20), default="editor")


class MediaFile(Base):
    """媒体文件元数据，实际文件保存在私有目录中。"""
    __tablename__ = "media_files"
    # 媒体记录主键。
    id = Column(Integer, primary_key=True, autoincrement=True)
    # 私有目录中的随机文件名，不能为空且不能重复。
    filename = Column(String(255), unique=True, nullable=False)
    # 用户上传时的原始文件名，供后台展示。
    original_name = Column(String(255))
    # MIME 类型，例如 image/png 或 application/pdf。
    file_type = Column(String(100))
    # 文件元数据创建时间。
    created_at = Column(DateTime, default=datetime.utcnow)
    



class Tag(Base):
    """文章标签。"""
    __tablename__ = "tags"
    # 标签主键和唯一名称。
    id = Column(Integer, primary_key=True)
    name = Column(String(30), unique=True)

class ArticleTag(Base):
    """文章与标签之间的关联记录。"""
    __tablename__ = "article_tags"
    # 关联记录主键。
    id = Column(Integer, primary_key=True)
    # 被标记的文章 id。
    article_id = Column(Integer, ForeignKey("articles.id"))
    # 关联的标签 id。
    tag_id = Column(Integer, ForeignKey("tags.id"))

class Comment(Base):
    """文章评论内容。"""
    __tablename__ = "comments"
    # 评论主键。
    id = Column(Integer, primary_key=True)
    # 评论所属文章。
    article_id = Column(Integer, ForeignKey("articles.id"))
    # 评论正文。
    content = Column(Text)
    # 评论发表时间。
    created_at = Column(DateTime, default=datetime.now)

class Setting(Base):
    """系统键值配置。"""
    __tablename__ = "settings"
    # 配置记录主键。
    id = Column(Integer, primary_key=True)
    # 配置键必须唯一，便于通过 key 定位配置项。
    key = Column(String(50), unique=True)
    # 配置值统一以字符串形式保存。
    value = Column(String(255))

# 联系表单同时作为后台工单使用，通过 status 记录处理进度。
class ContactForm(Base):
    """前台用户提交的联系信息和咨询内容。"""
    __tablename__ = "contact_forms"
    # 工单主键，同时建立索引方便后台按 id 查询。
    id = Column(Integer, primary_key=True, index=True)
    # 联系人基本信息。
    name = Column(String(50))
    phone = Column(String(20))
    email = Column(String(100))
    # 用户提交的咨询内容。
    message = Column(Text)
    # 工单状态：0 新提交，1 处理中，2 已解决，3 已关闭。
    status = Column(Integer, default=0)
    # 工单提交时间。
    created_at = Column(DateTime, default=datetime.utcnow)

class AuditLog(Base):
    """写操作审计记录，用于追踪后台数据变更请求。"""
    __tablename__ = "audit_logs"
    # 审计日志主键。
    id = Column(Integer, primary_key=True)
    # 被访问的接口路径和 HTTP 方法。
    path = Column(String(255))
    method = Column(String(10))
    # 接口最终返回的 HTTP 状态码。
    status_code = Column(Integer)
    # 日志产生时间。
    created_at = Column(DateTime, default=datetime.utcnow)


