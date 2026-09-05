# FastAPI 应用入口：负责注册接口、中间件和各业务路由。
from fastapi import FastAPI, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import engine, SessionLocal
import models


# 应用启动时确保 ORM 模型对应的数据表已经存在。
models.Base.metadata.create_all(bind=engine)

# 创建 FastAPI 应用实例，title 会显示在自动生成的接口文档中。
app = FastAPI(title="Toy CMS")



# 记录非 GET 请求，便于追踪上传、修改和删除等写操作。
@app.middleware("http")
async def audit_log_middleware(request: Request, call_next):
    # 记录请求开始时间，用于统计接口处理耗时。
    start_time = time.time()
    # 将请求交给后续路由处理，并等待接口生成响应。
    response = await call_next(request)
    # 聚焦写操作（上传/删除等），排除GET查询
    if request.method != "GET":
        # 当前实现将审计信息输出到控制台，方便开发阶段观察写操作。
        print(f"[AUDIT] {request.url.path} | Status:{response.status_code} | Time:{time.time()-start_time:.2f}s")
    # 中间件必须返回响应，否则客户端无法收到接口结果。
    return response

def get_db():
    """为接口提供数据库会话，并在请求结束后关闭会话。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def root():
    """健康检查接口，用于确认后端服务已经启动。"""
    return {"msg": "后端接口跑通了！"}

# 分类
@app.post("/categories/", tags=["分类"])
def create_category(name: str, sort: int = 0, db: Session = Depends(get_db)):
    """创建分类；sort 越小，列表中的展示位置越靠前。"""
    # 根据请求参数创建 ORM 对象，此时对象尚未写入数据库。
    cat = models.Category(name=name, sort=sort)
    # 将新对象加入当前事务。
    db.add(cat)
    # 提交事务后，分类才会真正保存到数据库。
    db.commit()
    # 重新读取数据库生成的 id 等字段，再返回给客户端。
    db.refresh(cat)
    return cat

@app.get("/categories/", tags=["分类"])
def list_categories(db: Session = Depends(get_db)):
    """按排序值返回全部文章分类。"""
    # 查询分类并按 sort 升序排列，all() 将结果转换为列表。
    return db.query(models.Category).order_by(models.Category.sort).all()

# 文章 CRUD + 分类联动
@app.post("/articles/", tags=["文章"])
def create_article(title: str, content: str, category_id: int, status: int = 1, db: Session = Depends(get_db)):
    """创建文章，并在写入前校验所属分类是否存在。"""
    # 先查询分类，避免文章引用不存在的分类 id。
    cat = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not cat:
        # 分类不存在时终止请求，不创建无效文章。
        raise HTTPException(404, "分类不存在")
    # 分类存在后创建文章对象并保留请求中的发布状态。
    art = models.Article(title=title, content=content, category_id=category_id, status=status)
    db.add(art)
    db.commit()
    # 刷新对象以取得数据库生成的主键和时间字段。
    db.refresh(art)
    return art

@app.get("/articles/", tags=["文章"])
def list_articles(db: Session = Depends(get_db)):
    """按创建时间倒序返回文章，并附带分类名称。"""
    # 外连接保证即使分类记录缺失，文章本身仍能被查询出来。
    results = db.query(models.Article, models.Category.name).\
        outerjoin(models.Category, models.Article.category_id == models.Category.id).\
        order_by(desc(models.Article.created_at)).all()
    data = []
    for art, cat_name in results:
        # 手动组装响应字典，避免直接暴露 ORM 对象并补充分类名称。
        data.append({
            "id": art.id,
            "title": art.title,
            "content": art.content,
            "category_id": art.category_id,
            "category_name": cat_name,
            "status": art.status,
            "created_at": art.created_at
        })
    return data

@app.put("/articles/{article_id}", tags=["文章"])
def update_article(article_id: int, title: str, content: str, category_id: int, db: Session = Depends(get_db)):
    """更新文章标题、正文和所属分类。"""
    # 按路径参数查找待更新文章。
    art = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not art:
        raise HTTPException(404, "文章不存在")
    # 将请求中的新值写入已存在的 ORM 对象。
    art.title = title
    art.content = content
    art.category_id = category_id
    # SQLAlchemy 会提交对象字段的变化。
    db.commit()
    return {"msg": "更新成功"}

@app.delete("/articles/{article_id}", tags=["文章"])
def delete_article(article_id: int, db: Session = Depends(get_db)):
    """删除指定文章。"""
    # 删除前先确认目标文章存在。
    art = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not art:
        raise HTTPException(404, "文章不存在")
    # 标记对象删除并提交事务。
    db.delete(art)
    db.commit()
    return {"msg": "删除成功"}

# ================= FAQ =================
@app.post("/faqs/", tags=["FAQ"])
def create_faq(question: str, answer: str, sort: int = 0, db: Session = Depends(get_db)):
    """创建常见问题，并保存其展示顺序。"""
    # 将问答内容和排序值封装为新的 FAQ ORM 对象。
    faq = models.Faq(question=question, answer=answer, sort=sort)
    db.add(faq)
    # 提交后再刷新对象，确保返回数据库生成的字段。
    db.commit()
    db.refresh(faq)
    return faq

@app.get("/faqs/", tags=["FAQ"])
def list_faqs(db: Session = Depends(get_db)):
    """按 sort 顺序返回所有常见问题。"""
    # sort 用于控制前端 FAQ 的展示顺序。
    return db.query(models.Faq).order_by(models.Faq.sort).all()

@app.put("/faqs/{faq_id}", tags=["FAQ"])
def update_faq(faq_id: int, question: str, answer: str, sort: int = 0, db: Session = Depends(get_db)):
    """更新常见问题的问答内容和展示顺序。"""
    # 通过路径参数找到需要修改的 FAQ。
    faq = db.query(models.Faq).filter(models.Faq.id == faq_id).first()
    if not faq:
        raise HTTPException(404, "FAQ不存在")
    # 覆盖旧内容后提交事务。
    faq.question = question
    faq.answer = answer
    faq.sort = sort
    db.commit()
    return {"msg": "更新成功"}

@app.delete("/faqs/{faq_id}", tags=["FAQ"])
def delete_faq(faq_id: int, db: Session = Depends(get_db)):
    """删除指定常见问题。"""
    # 先查询目标记录，避免对不存在的 FAQ 执行删除。
    faq = db.query(models.Faq).filter(models.Faq.id == faq_id).first()
    if not faq:
        raise HTTPException(404, "FAQ不存在")
    db.delete(faq)
    db.commit()
    return {"msg": "删除成功"}


# ================= 公告 =================
@app.post("/announcements/", tags=["公告"])
def create_announcement(title: str, content: str, is_top: int = 0, db: Session = Depends(get_db)):
    """创建公告；is_top 为 1 时置顶显示。"""
    # is_top 由前端以 0/1 表示普通公告或置顶公告。
    ann = models.Announcement(title=title, content=content, is_top=is_top)
    db.add(ann)
    db.commit()
    db.refresh(ann)
    return ann

@app.get("/announcements/", tags=["公告"])
def list_announcements(db: Session = Depends(get_db)):
    """优先返回置顶公告，同组内按创建时间倒序排列。"""
    # 先按置顶字段降序，再按创建时间降序，保证最新置顶公告排在最前。
    return db.query(models.Announcement).order_by(
        models.Announcement.is_top.desc(),
        models.Announcement.created_at.desc()
    ).all()

@app.put("/announcements/{ann_id}", tags=["公告"])
def update_announcement(ann_id: int, title: str, content: str, is_top: int = 0, db: Session = Depends(get_db)):
    """更新公告内容及置顶状态。"""
    # 根据公告 id 查询已有记录。
    ann = db.query(models.Announcement).filter(models.Announcement.id == ann_id).first()
    if not ann:
        raise HTTPException(404, "公告不存在")
    # 同时更新公告正文和置顶状态。
    ann.title = title
    ann.content = content
    ann.is_top = is_top
    db.commit()
    return {"msg": "更新成功"}

@app.delete("/announcements/{ann_id}", tags=["公告"])
def delete_announcement(ann_id: int, db: Session = Depends(get_db)):
    """删除指定公告。"""
    # 删除前查询记录，使不存在时返回明确的 404 错误。
    ann = db.query(models.Announcement).filter(models.Announcement.id == ann_id).first()
    if not ann:
        raise HTTPException(404, "公告不存在")
    db.delete(ann)
    db.commit()
    return {"msg": "删除成功"}


# ================= SEO 配置 =================
@app.post("/seo/", tags=["SEO"])
def create_seo(page_key: str, meta_title: str = "", meta_description: str = "", meta_keywords: str = "", db: Session = Depends(get_db)):
    """为页面创建 SEO 元数据配置。"""
    # 将页面标识和搜索引擎元数据组合成一条配置记录。
    seo = models.SeoConfig(
        page_key=page_key,
        meta_title=meta_title,
        meta_description=meta_description,
        meta_keywords=meta_keywords
    )
    db.add(seo)
    db.commit()
    # 刷新后返回数据库生成的配置 id。
    db.refresh(seo)
    return seo

@app.get("/seo/", tags=["SEO"])
def list_seo(db: Session = Depends(get_db)):
    """返回全部页面的 SEO 配置。"""
    # SEO 配置数量通常较少，直接返回全部记录。
    return db.query(models.SeoConfig).all()

@app.put("/seo/{seo_id}", tags=["SEO"])
def update_seo(seo_id: int, meta_title: str = "", meta_description: str = "", meta_keywords: str = "", db: Session = Depends(get_db)):
    """更新指定页面的 SEO 标题、描述和关键词。"""
    # 先定位页面配置，再覆盖三个可编辑的元数据字段。
    seo = db.query(models.SeoConfig).filter(models.SeoConfig.id == seo_id).first()
    if not seo:
        raise HTTPException(404, "SEO配置不存在")
    seo.meta_title = meta_title
    seo.meta_description = meta_description
    seo.meta_keywords = meta_keywords
    db.commit()
    return {"msg": "更新成功"}

@app.delete("/seo/{seo_id}", tags=["SEO"])
def delete_seo(seo_id: int, db: Session = Depends(get_db)):
    """删除指定页面的 SEO 配置。"""
    # 只有找到对应配置后才执行删除。
    seo = db.query(models.SeoConfig).filter(models.SeoConfig.id == seo_id).first()
    if not seo:
        raise HTTPException(404, "SEO配置不存在")
    db.delete(seo)
    db.commit()
    return {"msg": "删除成功"}


# ================= 联系表单 & 工单 =================
@app.post("/contacts/", tags=["联系表单"])
def create_contact(name: str, phone: str, email: str = "", message: str = "", db: Session = Depends(get_db)):
    """前端用户提交线索"""
    # 新提交的工单统一从状态 0（新提交）开始。
    contact = models.ContactForm(name=name, phone=phone, email=email, message=message, status=0)
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact

@app.get("/contacts/", tags=["联系表单"])
def list_contacts(db: Session = Depends(get_db)):
    """后台查看所有线索"""
    # 最新提交的线索优先展示，方便后台及时处理。
    return db.query(models.ContactForm).order_by(models.ContactForm.created_at.desc()).all()

@app.put("/contacts/{contact_id}/status", tags=["联系表单"])
def update_contact_status(contact_id: int, status: int, db: Session = Depends(get_db)):
    """
    工单状态流转 (答辩亮点：状态机)
    0:新提交 -> 1:处理中 -> 2:已解决 / 3:已关闭
    """
    contact = db.query(models.ContactForm).filter(models.ContactForm.id == contact_id).first()
    if not contact:
        raise HTTPException(404, "工单不存在")
    # 只允许状态机中定义的四种状态值。
    if status not in [0, 1, 2, 3]:
        raise HTTPException(400, "无效状态")
    # 更新状态并持久化，返回新状态供前端刷新界面。
    contact.status = status
    db.commit()
    return {"msg": "状态更新成功", "current_status": status}

@app.delete("/contacts/{contact_id}", tags=["联系表单"])
def delete_contact(contact_id: int, db: Session = Depends(get_db)):
    """删除指定联系工单。"""
    # 查找目标工单，找不到时返回 404。
    contact = db.query(models.ContactForm).filter(models.ContactForm.id == contact_id).first()
    if not contact:
        raise HTTPException(404, "工单不存在")
    db.delete(contact)
    db.commit()
    return {"msg": "删除成功"}

# 媒体库所需的文件、随机命名和签名工具。
import os, uuid, hmac, hashlib, time
from fastapi import UploadFile, File, Query

# 模拟私有存储目录；部署到生产环境时可替换为 OSS 或 S3。
MEDIA_DIR = "media_private"
os.makedirs(MEDIA_DIR, exist_ok=True)
# 签名密钥用于防止未授权访问，实际部署时应改为环境变量配置。
SECRET_KEY = "your_secret_key"

@app.post("/media/upload", tags=["媒体库"])
async def upload_media(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """上传文件到私有目录，记录元数据"""
    # 保留原文件扩展名，便于下载时识别文件类型。
    ext = os.path.splitext(file.filename)[-1]
    # 使用 UUID 生成存储名，避免同名文件互相覆盖。
    new_name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(MEDIA_DIR, new_name)
    # 异步读取上传内容，再以二进制方式写入私有目录。
    content = await file.read()
    with open(path, "wb") as f:
        f.write(content)
    # 文件落盘成功后，再记录文件名、原始名称和 MIME 类型。
    media = models.MediaFile(
        filename=new_name,
        original_name=file.filename,
        file_type=file.content_type
    )
    db.add(media)
    db.commit()
    db.refresh(media)
    return {"id": media.id, "filename": new_name, "msg": "上传成功"}

@app.get("/media/", tags=["媒体库"])
def list_media(db: Session = Depends(get_db)):
    """后台媒体列表（仅元数据，不暴露直链）"""
    # 只返回数据库元数据，实际文件必须通过签名接口访问。
    return db.query(models.MediaFile).order_by(models.MediaFile.created_at.desc()).all()

@app.get("/media/{media_id}/sign", tags=["媒体库"])
def get_signed_url(media_id: int, expire: int = 60, db: Session = Depends(get_db)):
    """
    生成临时签名下载 URL（核心）
    expire: 有效期秒数（默认60秒）
    """
    media = db.query(models.MediaFile).filter(models.MediaFile.id == media_id).first()
    if not media:
        raise HTTPException(404, "文件不存在")
    # 将文件名、过期时间和密钥组合为待签名字符串。
    expire_ts = int(time.time()) + expire
    raw = f"{media.filename}:{expire_ts}:{SECRET_KEY}"
    # 使用 HMAC-SHA256 生成无法被客户端伪造的签名。
    sign = hmac.new(SECRET_KEY.encode(), raw.encode(), hashlib.sha256).hexdigest()
    # 返回“临时访问接口”（实际下载走 /media/download）
    signed_url = f"/media/download/{media.filename}?expire={expire_ts}&sign={sign}"
    return {
        "url": signed_url,
        "expire_at": expire_ts,
        "valid_sec": expire
    }

@app.get("/media/download/{filename}", tags=["媒体库"])
def download_media(filename: str, expire: int = Query(...), sign: str = Query(...)):
    """校验签名后允许下载（防盗链）"""
    # 按签名接口相同的规则重新计算服务端期望签名。
    raw = f"{filename}:{expire}:{SECRET_KEY}"
    expected_sign = hmac.new(SECRET_KEY.encode(), raw.encode(), hashlib.sha256).hexdigest()
    # 签名不匹配或超过有效期时拒绝下载。
    if sign != expected_sign or int(time.time()) > expire:
        raise HTTPException(403, "签名无效或已过期")
    path = os.path.join(MEDIA_DIR, filename)
    # 即使签名正确，也要确认目标文件仍存在。
    if not os.path.exists(path):
        raise HTTPException(404, "文件不存在")
    from fastapi.responses import FileResponse
    # 以文件响应返回私有目录中的文件内容。
    return FileResponse(path, filename=filename)


# 将仪表盘路由统一挂载到 /api 前缀下。
from routers import dashboard
app.include_router(dashboard.router, prefix="/api", tags=["dashboard"])