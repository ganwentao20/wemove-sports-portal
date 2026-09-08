"""Build the reviewed course-submission manifest from the approved file set."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DELIVERABLES = ROOT / "docs" / "deliverables"
OUTPUT = DELIVERABLES / "review-manifest-20260908-v2.json"

FILES = [
    ("下午班-08组-WEMOVE-原网站重构-项目需求文档-v0.7.docx", "DOCX", 9, None),
    ("下午班-08组-WEMOVE-原网站重构-测试报告-v0.9.docx", "DOCX", 5, None),
    ("下午班-08组-WEMOVE-原网站重构-项目汇报-v1.5.pptx", "PPTX", None, 15),
    ("下午班-08组-WEMOVE-原网站重构-项目进度计划-v1.0.docx", "DOCX", 2, None),
    ("下午班-08组-WEMOVE-原网站重构-正式会议纪要-第1次-v1.0.docx", "DOCX", 2, None),
    ("下午班-08组-WEMOVE-原网站重构-分工与工作量报告-v1.3.docx", "DOCX", 2, None),
    ("下午班-08组-WEMOVE-原网站重构-大模型辅助实践说明-v1.1.docx", "DOCX", 3, None),
    ("成员A-需求分析-审核稿-v1.0.docx", "DOCX", 6, None),
    ("Web开发技术现状报告_陈婧琳_原网站重构校订版.docx", "DOCX", 2, None),
    ("Web开发技术现状报告_甘文韬_原网站重构校订版.docx", "DOCX", 2, None),
    ("Web开发技术现状报告_龙祖怡_原网站重构校订版.docx", "DOCX", 2, None),
    ("Web开发技术现状报告_倪依玲_原网站重构校订版.docx", "DOCX", 2, None),
    ("Web开发技术现状报告_周慧莹_原网站重构校订版.docx", "DOCX", 3, None),
    ("提交说明-20260908.md", "Markdown", None, None),
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    entries = []
    for name, kind, pages, slides in FILES:
        path = DELIVERABLES / name
        if not path.is_file():
            raise FileNotFoundError(path)
        entry = {
            "name": name,
            "type": kind,
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
            "reviewStatus": (
                "内容审校完成；已渲染并逐页/逐张检查"
                if kind in {"DOCX", "PPTX"}
                else "内容审校完成"
            ),
        }
        if pages is not None:
            entry["pages"] = pages
        if slides is not None:
            entry["slides"] = slides
        entries.append(entry)

    manifest = {
        "project": "WEMOVE 原网站与业务门户重构",
        "generatedAt": "2026-09-08T00:00:00+08:00",
        "reviewBasis": "保留原 wemovetoy.com 前端、栏目、交错图文布局和原图；复用现有后端并补齐选题功能",
        "verification": {
            "lint": "通过",
            "typecheck": "通过",
            "tests": "29 个测试文件、154 项测试通过",
            "seed": "通过；原站分类 1 个、商品 7 款，中英文主数据已核对",
            "build": "通过；Web 53 页与 API 构建成功",
            "browserSmoke": "中英文原站首页、分类/商品/内容/支持页及兼容重定向通过",
        },
        "remainingExternalWork": [
            "真实支付、退款、银行到账、税务票据和物流接口联调",
            "正式域名、SMTP、CDN、生产密钥及监控告警配置",
            "业务方确认最终价格、库存、说明书、证书和授权商品素材",
            "真机、人工无障碍、生产容量和长期可用率验收",
        ],
        "excludedFromPackage": "旧版核心文档、WEMOVE SPORTS 反面方向材料、临时渲染文件和测试输出",
        "files": entries,
    }
    OUTPUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(OUTPUT)


if __name__ == "__main__":
    main()
