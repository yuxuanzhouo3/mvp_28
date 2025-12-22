from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from xml.sax.saxutils import escape as xml_escape


@dataclass(frozen=True)
class Paragraph:
    kind: str  # title|h1|h2|h3|p|pb
    text: str = ""


DISALLOWED_TERMS = [
    "区块链",
    "虚拟货币",
    "比特币",
    "翻墙",
    "VPN",
    "政府",
    "公安",
    "机关",
    "AI智能",
    "人工智能",
    "深度学习",
    "大模型",
    "算法",
]

DISALLOWED_REGEX_PATTERNS: list[tuple[str, str]] = [
    (r"\bAI\b", "AI"),
]

SOFTWARE_NAME_PLACEHOLDER = "[软件全称]"
SOFTWARE_VERSION_PLACEHOLDER = "[V1.0]"


def parse_args() -> argparse.Namespace:
    default_root = Path(__file__).resolve().parents[1]
    default_md = default_root / "软著" / "软件需求说明书.md"
    default_docx = default_root / "软著" / "软件需求说明书.docx"

    parser = argparse.ArgumentParser(
        description="根据代码库生成软著申请《软件需求说明书》(Markdown + DOCX)。",
    )
    parser.add_argument("--root", type=Path, default=default_root, help="项目根目录")
    parser.add_argument("--md", type=Path, default=default_md, help="输出 Markdown 路径")
    parser.add_argument("--docx", type=Path, default=default_docx, help="输出 DOCX 路径")
    parser.add_argument("--target-pages", type=int, default=60, help="DOCX 目标页数（使用 Word 统计）")
    parser.add_argument("--min-use-cases", type=int, default=93, help="最少用例数（用于补足页数）")
    parser.add_argument("--use-case-step", type=int, default=10, help="页数不足时每次追加用例数量")
    parser.add_argument("--max-iterations", type=int, default=10, help="补足页数的最大迭代次数")
    return parser.parse_args()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def find_api_routes(app_api_dir: Path) -> list[dict]:
    routes: list[dict] = []
    if not app_api_dir.exists():
        return routes

    for route_file in sorted(app_api_dir.rglob("route.ts")):
        rel = route_file.relative_to(app_api_dir)
        url = "/api/" + "/".join(rel.parts[:-1]).replace("\\", "/")
        content = route_file.read_text(encoding="utf-8", errors="ignore")
        methods = sorted(
            set(
                re.findall(
                    r"export\\s+async\\s+function\\s+(GET|POST|PUT|PATCH|DELETE)\\b",
                    content,
                )
            )
        )
        if not methods:
            methods = sorted(set(re.findall(r"export\\s+function\\s+(GET|POST|PUT|PATCH|DELETE)\\b", content)))
        routes.append(
            {
                "url": url,
                "methods": methods or ["(未解析)"],
                "source": str(route_file.relative_to(app_api_dir.parent.parent)).replace("\\", "/"),
            }
        )

    return routes


def collect_facts(root: Path) -> dict:
    pkg_path = root / "package.json"
    pkg = read_json(pkg_path) if pkg_path.exists() else {}
    deps = pkg.get("dependencies", {}) if isinstance(pkg, dict) else {}
    dev_deps = pkg.get("devDependencies", {}) if isinstance(pkg, dict) else {}

    app_dir = root / "app"
    admin_pages: list[str] = []
    if (app_dir / "admin").exists():
        for p in sorted((app_dir / "admin").iterdir()):
            if p.is_dir():
                admin_pages.append(f"/admin/{p.name}")

    auth_pages: list[str] = []
    if (app_dir / "auth").exists():
        for p in sorted((app_dir / "auth").iterdir()):
            if p.is_dir():
                auth_pages.append(f"/auth/{p.name}")

    payment_pages: list[str] = []
    if (app_dir / "payment").exists():
        for p in sorted((app_dir / "payment").iterdir()):
            if p.is_dir():
                payment_pages.append(f"/payment/{p.name}")

    api_routes = find_api_routes(root / "app" / "api")

    return {
        "next_version": deps.get("next", ""),
        "react_version": deps.get("react", ""),
        "typescript_version": dev_deps.get("typescript", ""),
        "admin_pages": admin_pages,
        "auth_pages": auth_pages,
        "payment_pages": payment_pages,
        "api_routes": api_routes,
    }


def check_disallowed_terms(text: str) -> list[str]:
    found: list[str] = []
    upper = text.upper()
    for term in DISALLOWED_TERMS:
        if term == "VPN":
            if "VPN" in upper:
                found.append(term)
            continue
        if term in text:
            found.append(term)
    for pattern, label in DISALLOWED_REGEX_PATTERNS:
        if re.search(pattern, text):
            found.append(label)
    return found


def md_heading(level: int, text: str) -> str:
    return f"{'#' * level} {text}".rstrip()


def generate_markdown(paragraphs: Iterable[Paragraph]) -> str:
    lines: list[str] = []
    for p in paragraphs:
        if p.kind == "pb":
            lines.append("")
            lines.append("---")
            lines.append("")
            continue
        if p.kind == "title":
            lines.append(md_heading(1, p.text))
            lines.append("")
            continue
        if p.kind == "h1":
            lines.append(md_heading(2, p.text))
            lines.append("")
            continue
        if p.kind == "h2":
            lines.append(md_heading(3, p.text))
            lines.append("")
            continue
        if p.kind == "h3":
            lines.append(md_heading(4, p.text))
            lines.append("")
            continue
        lines.append(p.text)
    return "\n".join(lines).rstrip() + "\n"


def _docx_xml_header() -> str:
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'


def build_docx_parts(paragraphs: list[Paragraph]) -> dict[str, str]:
    def p_run(text: str, size_half_points: int, bold: bool = False) -> str:
        t = xml_escape(text)
        bold_xml = "<w:b/>" if bold else ""
        return (
            "<w:r>"
            "<w:rPr>"
            '<w:rFonts w:ascii="SimSun" w:hAnsi="SimSun" w:eastAsia="SimSun" w:cs="SimSun"/>'
            f"{bold_xml}"
            f'<w:sz w:val="{size_half_points}"/>'
            f'<w:szCs w:val="{size_half_points}"/>'
            '<w:lang w:val="zh-CN"/>'
            "</w:rPr>"
            f'<w:t xml:space="preserve">{t}</w:t>'
            "</w:r>"
        )

    def paragraph_xml(text: str, style: str | None, size_hp: int, bold: bool = False) -> str:
        pr = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else "<w:pPr/>"
        return f"<w:p>{pr}{p_run(text, size_hp, bold=bold)}</w:p>"

    def page_break_xml() -> str:
        return "<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>"

    body_parts: list[str] = []
    for p in paragraphs:
        if p.kind == "pb":
            body_parts.append(page_break_xml())
            continue
        if p.kind == "title":
            body_parts.append(paragraph_xml(p.text, "Title", 32, bold=True))
            continue
        if p.kind == "h1":
            body_parts.append(paragraph_xml(p.text, "Heading1", 28, bold=True))
            continue
        if p.kind == "h2":
            body_parts.append(paragraph_xml(p.text, "Heading2", 24, bold=True))
            continue
        if p.kind == "h3":
            body_parts.append(paragraph_xml(p.text, "Heading3", 22, bold=True))
            continue
        body_parts.append(paragraph_xml(p.text, None, 18, bold=False))

    sect_pr = (
        "<w:sectPr>"
        '<w:pgSz w:w="11906" w:h="16838"/>'
        '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>'
        "</w:sectPr>"
    )

    document_xml = (
        _docx_xml_header()
        + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        + "<w:body>"
        + "".join(body_parts)
        + sect_pr
        + "</w:body></w:document>"
    )

    styles_xml = (
        _docx_xml_header()
        + '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        + '<w:style w:type="paragraph" w:styleId="Title">'
        + "<w:name w:val=\"Title\"/>"
        + '<w:basedOn w:val="Normal"/>'
        + "<w:uiPriority w:val=\"10\"/>"
        + "<w:qFormat/>"
        + "<w:pPr><w:spacing w:before=\"240\" w:after=\"240\"/></w:pPr>"
        + "<w:rPr>"
        + '<w:rFonts w:ascii="SimSun" w:hAnsi="SimSun" w:eastAsia="SimSun" w:cs="SimSun"/>'
        + "<w:b/><w:sz w:val=\"32\"/><w:szCs w:val=\"32\"/>"
        + "</w:rPr>"
        + "</w:style>"
        + '<w:style w:type="paragraph" w:styleId="Heading1">'
        + "<w:name w:val=\"heading 1\"/>"
        + '<w:basedOn w:val="Normal"/>'
        + "<w:uiPriority w:val=\"9\"/>"
        + "<w:qFormat/>"
        + "<w:pPr><w:spacing w:before=\"240\" w:after=\"120\"/></w:pPr>"
        + "<w:rPr>"
        + '<w:rFonts w:ascii="SimSun" w:hAnsi="SimSun" w:eastAsia="SimSun" w:cs="SimSun"/>'
        + "<w:b/><w:sz w:val=\"28\"/><w:szCs w:val=\"28\"/>"
        + "</w:rPr>"
        + "</w:style>"
        + '<w:style w:type="paragraph" w:styleId="Heading2">'
        + "<w:name w:val=\"heading 2\"/>"
        + '<w:basedOn w:val="Normal"/>'
        + "<w:uiPriority w:val=\"9\"/>"
        + "<w:qFormat/>"
        + "<w:pPr><w:spacing w:before=\"200\" w:after=\"100\"/></w:pPr>"
        + "<w:rPr>"
        + '<w:rFonts w:ascii="SimSun" w:hAnsi="SimSun" w:eastAsia="SimSun" w:cs="SimSun"/>'
        + "<w:b/><w:sz w:val=\"24\"/><w:szCs w:val=\"24\"/>"
        + "</w:rPr>"
        + "</w:style>"
        + '<w:style w:type="paragraph" w:styleId="Heading3">'
        + "<w:name w:val=\"heading 3\"/>"
        + '<w:basedOn w:val="Normal"/>'
        + "<w:uiPriority w:val=\"9\"/>"
        + "<w:qFormat/>"
        + "<w:pPr><w:spacing w:before=\"160\" w:after=\"80\"/></w:pPr>"
        + "<w:rPr>"
        + '<w:rFonts w:ascii="SimSun" w:hAnsi="SimSun" w:eastAsia="SimSun" w:cs="SimSun"/>'
        + "<w:b/><w:sz w:val=\"22\"/><w:szCs w:val=\"22\"/>"
        + "</w:rPr>"
        + "</w:style>"
        + '<w:style w:type="paragraph" w:styleId="Normal">'
        + "<w:name w:val=\"Normal\"/>"
        + "<w:qFormat/>"
        + "<w:pPr><w:spacing w:before=\"0\" w:after=\"0\" w:line=\"240\" w:lineRule=\"auto\"/></w:pPr>"
        + "<w:rPr>"
        + '<w:rFonts w:ascii="SimSun" w:hAnsi="SimSun" w:eastAsia="SimSun" w:cs="SimSun"/>'
        + "<w:sz w:val=\"18\"/><w:szCs w:val=\"18\"/>"
        + "<w:lang w:val=\"zh-CN\"/>"
        + "</w:rPr>"
        + "</w:style>"
        + "</w:styles>"
    )

    document_rels_xml = (
        _docx_xml_header()
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        + "</Relationships>"
    )

    content_types_xml = (
        _docx_xml_header()
        + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
        + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
        + '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
        + "</Types>"
    )

    rels_xml = (
        _docx_xml_header()
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
        + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
        + "</Relationships>"
    )

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    core_xml = (
        _docx_xml_header()
        + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        + 'xmlns:dc="http://purl.org/dc/elements/1.1/" '
        + 'xmlns:dcterms="http://purl.org/dc/terms/" '
        + 'xmlns:dcmitype="http://purl.org/dc/dcmitype/" '
        + 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        + "<dc:title>软件需求说明书</dc:title>"
        + "<dc:creator>技术部</dc:creator>"
        + "<cp:lastModifiedBy>技术部</cp:lastModifiedBy>"
        + f'<dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created>'
        + f'<dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>'
        + "</cp:coreProperties>"
    )

    app_xml = (
        _docx_xml_header()
        + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
        + 'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
        + "<Application>Microsoft Office Word</Application>"
        + "</Properties>"
    )

    return {
        "[Content_Types].xml": content_types_xml,
        "_rels/.rels": rels_xml,
        "word/document.xml": document_xml,
        "word/_rels/document.xml.rels": document_rels_xml,
        "word/styles.xml": styles_xml,
        "docProps/core.xml": core_xml,
        "docProps/app.xml": app_xml,
    }


def write_docx(docx_path: Path, paragraphs: list[Paragraph]) -> None:
    parts = build_docx_parts(paragraphs)
    docx_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(docx_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for name, content in parts.items():
            zf.writestr(name, content)


def compute_pages_with_word(docx_path: Path) -> int | None:
    ps = r"""
$docx = $env:DOCX_PATH
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $doc = $word.Documents.Open($docx, $false, $true)
  $doc.Repaginate()
  $pages = $doc.ComputeStatistics(2)
  $doc.Close([ref]$false)
  $word.Quit()
  [Console]::WriteLine($pages)
} catch {
  try { if ($doc) { $doc.Close([ref]$false) } } catch {}
  try { if ($word) { $word.Quit() } } catch {}
  [Console]::WriteLine("0")
}
""".strip()

    try:
        res = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps],
            capture_output=True,
            text=True,
            check=False,
            env={**os.environ, "DOCX_PATH": str(docx_path)},
        )
    except Exception:
        return None

    out = (res.stdout or "").strip()
    if not out:
        return None
    try:
        pages = int(out.splitlines()[-1].strip())
        return pages if pages > 0 else None
    except ValueError:
        return None


def add(paras: list[Paragraph], kind: str, text: str = "") -> None:
    paras.append(Paragraph(kind=kind, text=text))


def generate_requirements_paragraphs_legacy(facts: dict, use_case_count: int) -> list[Paragraph]:
    paras: list[Paragraph] = []

    # =========================
    # 封面
    # =========================
    add(paras, "title", "软件需求说明书")
    add(paras, "p", f"软件名称：{SOFTWARE_NAME_PLACEHOLDER}")
    add(paras, "p", f"版本号：{SOFTWARE_VERSION_PLACEHOLDER}")
    add(paras, "p", "编制单位：[单位名称]")
    add(paras, "p", "编制日期：2025年10月")
    add(paras, "pb")

    # =========================
    # 修订记录 & 目录
    # =========================
    add(paras, "h1", "文档修订记录")
    add(paras, "p", "| 版本 | 修订日期 | 修订内容 | 编制人 |")
    add(paras, "p", "| --- | --- | --- | --- |")
    add(paras, "p", "| V1.0 | 2025-09-15 | 初稿编制 | 技术部 |")
    add(paras, "p", "| V1.1 | 2025-10-08 | 功能细化完善 | 技术部 |")
    add(paras, "pb")

    add(paras, "h1", "目录")
    toc = [
        "1. 引言",
        "   1.1 编写目的",
        "   1.2 背景",
        "   1.3 定义",
        "2. 任务概述",
        "   2.1 目标",
        "   2.2 用户特点",
        "   2.3 假定与约束",
        "3. 需求规定",
        "   3.1 系统总体功能",
        "   3.2 用户认证与账户管理模块",
        "   3.3 会话与消息管理模块",
        "   3.4 内容处理与多媒体交互模块",
        "   3.5 配额与计费管理模块",
        "   3.6 运营后台管理模块",
        "4. 运行环境规定",
        "   4.1 硬件环境",
        "   4.2 软件环境",
        "5. 尚需解决的问题",
        "附录A 界面与页面清单",
        "附录B 接口清单（API 路由）",
        "附录C 数据字典（主要数据实体）",
        "附录D 需求用例详单",
        "附录E 错误码与返回约定",
    ]
    for line in toc:
        add(paras, "p", line)
    add(paras, "pb")

    # =========================
    # 1 引言
    # =========================
    add(paras, "h1", "1. 引言")

    add(paras, "h2", "1.1 编写目的")
    add(
        paras,
        "p",
        f"本文档用于指导 {SOFTWARE_NAME_PLACEHOLDER} 的开发、测试与验收，并作为软件著作权申请的依据。",
    )
    add(
        paras,
        "p",
        "本文档明确系统的功能需求、接口需求、数据需求、安全要求以及运行环境要求，确保相关人员对系统目标和边界形成一致理解。",
    )
    add(paras, "p", "本文档的主要读者包括：开发工程师、测试工程师、项目管理人员与材料审核人员。")

    add(paras, "h2", "1.2 背景")
    add(
        paras,
        "p",
        "在多终端应用场景中，用户普遍需要更高效的内容获取与信息处理方式，以减少重复操作并提升交互效率。",
    )
    add(
        paras,
        "p",
        f"{SOFTWARE_NAME_PLACEHOLDER} 面向通用信息服务场景，提供对话式交互、内容处理、多媒体文件管理与计费配额控制等能力，用于提升业务处理效率与服务可用性。",
    )
    add(
        paras,
        "p",
        "系统在架构层面支持多数据源与多支付通道隔离，降低跨环境数据混用风险，并通过统一的权限与审计机制保障数据安全与业务连续性。",
    )

    add(paras, "h2", "1.3 定义")
    add(paras, "p", "本文档使用的术语定义如下（部分为通用行业术语）：")
    terms = [
        ("B/S", "Browser/Server", "浏览器/服务器架构，客户端通过浏览器访问服务端应用"),
        ("HTTP/HTTPS", "HyperText Transfer Protocol", "客户端与服务端的数据通信协议；HTTPS 提供传输加密能力"),
        ("API", "Application Programming Interface", "对外提供的接口集合，用于模块间或系统间交互"),
        ("REST", "Representational State Transfer", "基于资源的接口风格，通常以 HTTP 方法表达操作语义"),
        ("JSON", "JavaScript Object Notation", "轻量级数据交换格式，用于接口请求与响应载荷"),
        ("Cookie", "HTTP Cookie", "浏览器端状态保存机制，可用于会话标识与偏好保存"),
        ("Session", "Session", "服务端对登录态的管理对象，通常与 Cookie 绑定"),
        ("OAuth", "Open Authorization", "第三方授权协议，用于在不暴露凭据的情况下完成授权登录"),
        ("UUID", "Universally Unique Identifier", "通用唯一标识符，用于唯一标识系统对象"),
        ("SQL", "Structured Query Language", "结构化查询语言，用于关系型数据库的数据操作"),
        ("RLS", "Row Level Security", "行级安全策略，用于在数据库层控制记录级别的访问权限"),
        ("CSRF", "Cross-Site Request Forgery", "跨站请求伪造攻击；通常通过令牌/同源校验等方式防护"),
        ("CORS", "Cross-Origin Resource Sharing", "跨域资源共享机制，通过白名单控制跨域访问"),
        ("Webhook", "Webhook", "回调机制，外部系统以 HTTP 请求方式向本系统推送事件通知"),
        ("对象存储", "Object Storage", "用于存储图片、音频、视频等二进制文件的存储服务"),
        ("集合型数据库", "Collection Store", "以集合/文档为单位存储数据的数据服务，用于快速读写与扩展"),
        ("流式输出", "Streaming", "服务端按片段持续返回结果以提升交互体验，减少等待时间"),
    ]
    add(paras, "p", "| 术语/缩写 | 全称 | 说明 |")
    add(paras, "p", "| --- | --- | --- |")
    for k, full, desc in terms:
        add(paras, "p", f"| {k} | {full} | {desc} |")
    add(paras, "pb")

    # =========================
    # 2 任务概述
    # =========================
    add(paras, "h1", "2. 任务概述")

    add(paras, "h2", "2.1 目标")
    add(paras, "p", f"{SOFTWARE_NAME_PLACEHOLDER} 旨在构建一个高效、集成化的平台，主要实现以下核心目标：")
    add(paras, "p", "（1）提供账户注册、登录与会话管理能力，保证身份可信与访问可控。")
    add(paras, "p", "（2）提供会话与消息的组织能力，支持多轮交互与历史记录管理。")
    add(paras, "p", "（3）提供多媒体文件上传与引用能力，满足不同输入场景的内容交互需求。")
    add(paras, "p", "（4）提供订阅套餐与配额统计能力，按数据处理规则进行限额校验与扣减。")
    add(paras, "p", "（5）提供支付下单、支付确认与回调处理能力，支持多支付通道。")
    add(paras, "p", "（6）提供后台运营配置能力，用于维护广告位、社交链接与发布版本。")

    add(paras, "h2", "2.2 用户特点")
    add(paras, "p", "目标用户群体包括：")
    add(paras, "p", "（1）普通用户：关注交互效率与稳定性，期望快速完成信息处理与内容整理。")
    add(paras, "p", "（2）付费用户：关注额度清晰、账期规则明确、订单可追溯，期望获得更高配额与更完整历史记录。")
    add(paras, "p", "（3）管理员：关注运营配置效率与数据一致性，期望通过后台完成内容资源与配置维护。")

    add(paras, "h2", "2.3 假定与约束")
    add(paras, "p", "开发期限：2025年10月")
    add(paras, "p", "开发经费：自筹")
    add(paras, "p", "假定条件：客户端具备稳定网络连接；用户可使用主流现代浏览器访问。")
    add(paras, "p", "约束条件：")
    add(paras, "p", "（1）系统采用 B/S 架构，客户端主要通过浏览器访问。")
    add(paras, "p", "（2）系统按部署环境隔离数据源与支付通道，禁止跨版本访问另一套接口。")
    add(paras, "p", "（3）上传文件大小受服务端请求体上限与业务级别限制共同约束。")
    add(paras, "pb")

    # =========================
    # 3 需求规定
    # =========================
    add(paras, "h1", "3. 需求规定")

    add(paras, "h2", "3.1 系统总体功能")
    add(paras, "p", "本系统采用 B/S 架构，前端通过浏览器提供交互界面，服务端提供接口与业务处理能力。")
    add(paras, "p", "系统支持多数据源与多支付通道，并由环境变量决定启用的版本，实现数据源与通道隔离。")
    add(paras, "p", "系统包含以下主要模块：")
    add(paras, "p", "（1）用户认证与账户管理模块。")
    add(paras, "p", "（2）会话与消息管理模块。")
    add(paras, "p", "（3）内容处理与多媒体交互模块。")
    add(paras, "p", "（4）配额与计费管理模块。")
    add(paras, "p", "（5）运营后台管理模块。")

    # -------------------------
    # 3.2 用户认证与账户管理模块
    # -------------------------
    add(paras, "h2", "3.2 用户认证与账户管理模块")
    add(paras, "p", "模块说明：实现用户与管理员的身份认证、会话管理、权限校验与用户设置维护。")
    add(paras, "p", "数据处理规则：认证与数据源能力按部署版本隔离，禁止跨版本访问另一套接口。")

    auth_functions = [
        {
            "id": "3.2.1",
            "name": "邮箱注册",
            "desc": "实现对用户账户信息（邮箱、密码）的创建，并初始化用户资料与钱包记录。",
            "inputs": ["邮箱地址（Email）", "密码（加密传输）", "确认信息（如启用）"],
            "outputs": ["注册成功提示", "用户标识（User_ID）"],
        },
        {
            "id": "3.2.2",
            "name": "邮箱登录",
            "desc": "实现对用户账户的身份校验，登录成功后下发会话令牌并设置有效期。",
            "inputs": ["邮箱地址（Email）", "密码（加密传输）"],
            "outputs": ["登录成功提示", "会话令牌（Cookie/Authorization）", "过期时间（ExpiresAt）"],
        },
        {
            "id": "3.2.3",
            "name": "退出登录",
            "desc": "实现对当前登录态的销毁，清理会话令牌并返回确认结果。",
            "inputs": ["当前会话令牌（Cookie）"],
            "outputs": ["退出成功提示", "登录态清理结果"],
        },
        {
            "id": "3.2.4",
            "name": "第三方授权登录",
            "desc": "实现通过第三方授权回调完成登录，创建或绑定系统用户标识并建立会话。",
            "inputs": ["授权回调参数（Code/State）", "重定向地址（Redirect_URL）"],
            "outputs": ["登录成功提示", "用户标识（User_ID）", "会话令牌"],
        },
        {
            "id": "3.2.5",
            "name": "登录状态查询",
            "desc": "实现对当前登录用户的基础信息与订阅状态查询，用于界面初始化与权限判定。",
            "inputs": ["会话令牌（Cookie/Authorization）"],
            "outputs": ["用户信息（如ID、邮箱、昵称）", "订阅状态（Plan、PlanExp）", "配额概览"],
        },
        {
            "id": "3.2.6",
            "name": "邮箱可用性校验",
            "desc": "实现对邮箱格式与占用情况的校验，避免重复注册并给出明确原因。",
            "inputs": ["邮箱地址（Email）"],
            "outputs": ["校验结果（可用/不可用）", "原因说明（格式不合法/已存在）"],
        },
        {
            "id": "3.2.7",
            "name": "找回/重置密码",
            "desc": "实现密码重置流程的发起、确认与更新，保证账号可恢复且流程可追溯。",
            "inputs": ["邮箱地址（Email）", "重置凭据（Token/链接参数）", "新密码（加密传输）"],
            "outputs": ["重置成功提示", "重新登录引导"],
        },
        {
            "id": "3.2.8",
            "name": "用户设置维护",
            "desc": "实现用户设置项（例如是否隐藏广告）的查询与更新，并在开启关键设置时校验订阅状态。",
            "inputs": ["设置项键值（如 hide_ads:Boolean）", "会话令牌"],
            "outputs": ["更新成功提示", "最新设置值"],
        },
        {
            "id": "3.2.9",
            "name": "管理员登录与会话校验",
            "desc": "实现管理员登录并生成后台会话 Cookie，后台页面访问需通过会话校验。",
            "inputs": ["管理员用户名（Admin_Username）", "密码（加密传输）"],
            "outputs": ["登录成功提示", "后台会话 Cookie（admin_session）"],
        },
    ]

    for f in auth_functions:
        add(paras, "h3", f"{f['id']} {f['name']}")
        add(paras, "p", f"- 功能描述：{f['desc']}")
        add(paras, "p", "- 输入项：")
        for item in f["inputs"]:
            add(paras, "p", f"  - {item}")
        add(paras, "p", "- 处理逻辑：")
        add(paras, "p", "  1) 接收输入并进行必填校验与格式校验（例如邮箱格式、密码长度）。")
        add(paras, "p", "  2) 校验会话令牌或授权回调参数，失败则返回明确错误信息。")
        add(paras, "p", "  3) 依据部署版本选择认证服务与数据源，并拒绝跨版本接口访问。")
        add(paras, "p", "  4) 登录成功后生成或刷新会话令牌，采用 HttpOnly 与 SameSite 策略。")
        add(paras, "p", "  5) 按需写入/更新用户资料与状态（例如订阅到期时间、偏好设置）。")
        add(paras, "p", "- 输出项：")
        for out in f["outputs"]:
            add(paras, "p", f"  - {out}")
        add(paras, "p", f"- 界面说明：见图 {f['id']} 界面示意图（占位符）。")

    # -------------------------
    # 3.3 会话与消息管理模块
    # -------------------------
    add(paras, "h2", "3.3 会话与消息管理模块")
    add(paras, "p", "模块说明：实现会话创建/查询/更新/删除、消息存储与书签管理。")
    add(paras, "p", "关键约束：免费用户不落库历史记录，会话与消息仅保留在本地临时状态。")

    conv_functions = [
        ("3.3.1", "会话创建", ["会话标题（Title）", "服务类型标识（Service_Type，可选）", "场景标识（Scenario_ID，可选）"]),
        ("3.3.2", "会话列表查询", ["分页参数（Page/Size，可选）", "排序字段（UpdatedAt）"]),
        ("3.3.3", "会话详情查询", ["会话标识（Conversation_ID）"]),
        ("3.3.4", "会话标题更新", ["会话标识（Conversation_ID）", "新标题（Title）"]),
        ("3.3.5", "会话删除", ["会话标识（Conversation_ID）"]),
        ("3.3.6", "消息列表查询", ["会话标识（Conversation_ID）", "分页参数（Page/Size，可选）"]),
        ("3.3.7", "消息收藏（书签）", ["消息标识（Message_ID）", "自定义标题（CustomName，可选）", "文件夹标识（Folder_ID，可选）"]),
        ("3.3.8", "书签检索与导入导出", ["检索关键字（Keyword，可选）", "导出格式（JSON/Text）", "导入内容（File/Text）"]),
        ("3.3.9", "书签文件夹管理", ["文件夹名称（FolderName）", "颜色标识（Color，可选）", "移动关系（Bookmark_ID -> Folder_ID）"]),
    ]

    for fid, name, inputs in conv_functions:
        add(paras, "h3", f"{fid} {name}")
        add(paras, "p", f"- 功能描述：实现对{name}相关对象的具体操作，并保证对象归属到当前登录用户。")
        add(paras, "p", "- 输入项：")
        for item in inputs:
            add(paras, "p", f"  - {item}")
        add(paras, "p", "- 处理逻辑：")
        add(paras, "p", "  1) 校验会话令牌，未登录返回 401。")
        add(paras, "p", "  2) 校验对象归属：仅允许操作当前用户创建的数据记录。")
        add(paras, "p", "  3) 免费用户执行本地模式：不写入数据库，返回 local- 前缀临时标识。")
        add(paras, "p", "  4) 付费用户执行持久化：写入会话与消息记录，并更新 updated_at。")
        add(paras, "p", "  5) 查询类接口按 updated_at 倒序返回，必要时支持分页。")
        add(paras, "p", "- 输出项：会话/消息数据、书签数据与处理结果提示。")
        add(paras, "p", f"- 界面说明：见图 {fid} 界面示意图（占位符）。")

    # -------------------------
    # 3.4 内容处理与多媒体交互模块
    # -------------------------
    add(paras, "h2", "3.4 内容处理与多媒体交互模块")
    add(paras, "p", "模块说明：实现内容提交、流式输出、多媒体文件上传、媒体解析与清理等能力。")
    add(paras, "p", "数据处理规则：提交内容前必须通过配额校验；流式输出按片段返回并在结束时输出完整结果。")

    content_functions = [
        ("3.4.1", "发送内容（同步返回）", ["会话标识（Conversation_ID）", "内容文本（Text）", "服务类型标识（Service_Type）"]),
        ("3.4.2", "发送内容（流式返回）", ["会话标识（Conversation_ID）", "内容文本（Text）", "流式开关（Stream=true）"]),
        ("3.4.3", "游客模式发送", ["临时会话标识（Local_Conversation_ID）", "内容文本（Text）"]),
        ("3.4.4", "图片上传", ["文件（File:image）", "文件大小（Bytes）", "文件数量（Count）"]),
        ("3.4.5", "音频上传", ["文件（File:audio）", "文件大小（Bytes）", "文件数量（Count）"]),
        ("3.4.6", "视频上传", ["文件（File:video）", "文件大小（Bytes）", "文件数量（Count）"]),
        ("3.4.7", "媒体解析", ["媒体引用标识（Media_ID 或 URL）"]),
        ("3.4.8", "媒体删除与清理", ["媒体标识（Media_ID）", "关联对象标识（Conversation_ID/Message_ID，可选）"]),
    ]

    for fid, name, inputs in content_functions:
        add(paras, "h3", f"{fid} {name}")
        add(paras, "p", f"- 功能描述：实现{name}，并对输入内容/文件进行校验、存储与引用管理。")
        add(paras, "p", "- 输入项：")
        for item in inputs:
            add(paras, "p", f"  - {item}")
        add(paras, "p", "- 处理逻辑：")
        add(paras, "p", "  1) 校验会话令牌或游客标识，确定是否允许写入数据库。")
        add(paras, "p", "  2) 校验请求体大小上限、文件类型、文件数量与业务配置的最大文件大小。")
        add(paras, "p", "  3) 调用配额模块校验可用额度，不足则返回明确提示。")
        add(paras, "p", "  4) 执行内容处理或文件上传，生成媒体引用标识或可访问地址。")
        add(paras, "p", "  5) 对需要持久化的场景写入消息记录与媒体引用关系，更新会话更新时间。")
        add(paras, "p", "- 输出项：处理结果、媒体引用信息、错误信息（如失败）。")
        add(paras, "p", f"- 界面说明：见图 {fid} 界面示意图（占位符）。")

    # -------------------------
    # 3.5 配额与计费管理模块
    # -------------------------
    add(paras, "h2", "3.5 配额与计费管理模块")
    add(paras, "p", "模块说明：实现订阅套餐、钱包额度、按天/按月限额、加油包额度及扣减规则的统一管理。")
    add(paras, "p", "扣减规则：先扣减月度额度，再扣减加油包额度；按天限额以自然日为周期统计。")

    billing_functions = [
        ("3.5.1", "配额查询", ["用户标识（User_ID）", "服务类型标识（Service_Type，可选）"]),
        ("3.5.2", "按天限额校验", ["用户标识（User_ID）", "计划标识（Plan）", "本次消耗次数（Count）"]),
        ("3.5.3", "按天限额扣减", ["用户标识（User_ID）", "计划标识（Plan）", "本次消耗次数（Count）"]),
        ("3.5.4", "按月媒体额度扣减", ["用户标识（User_ID）", "图片数量（ImageCount）", "视频/音频数量（MediaCount）"]),
        ("3.5.5", "账期重置处理", ["账期锚点（AnchorDay）", "上次重置时间（ResetAt）", "当前时间（Now）"]),
        ("3.5.6", "订阅状态判定", ["套餐标识（Plan）", "到期时间（PlanExp）", "付费标记（isPaid）"]),
        ("3.5.7", "加油包发放", ["订单号（Order_ID）", "图片额度（ImageCredits）", "视频/音频额度（MediaCredits）"]),
        ("3.5.8", "用量统计展示", ["当日统计（Daily）", "当月统计（Monthly）", "剩余额度（Remaining）"]),
    ]

    for fid, name, inputs in billing_functions:
        add(paras, "h3", f"{fid} {name}")
        add(paras, "p", f"- 功能描述：实现{name}，保证在并发消耗场景下额度数据保持一致。")
        add(paras, "p", "- 输入项：")
        for item in inputs:
            add(paras, "p", f"  - {item}")
        add(paras, "p", "- 处理逻辑：")
        add(paras, "p", "  1) 获取用户钱包与订阅信息，判定当前套餐是否有效（到期则回落为免费）。")
        add(paras, "p", "  2) 计算限额：按天限额依据套餐标识计算，按月额度依据账期重置点计算。")
        add(paras, "p", "  3) 扣减时采用原子更新或事务化写入，避免并发下出现负余额。")
        add(paras, "p", "  4) 更新用量统计字段（如 daily_used、monthly_balance）并返回给前端展示。")
        add(paras, "p", "- 输出项：remaining/limit/used 统计、扣减明细与失败原因。")
        add(paras, "p", f"- 界面说明：见图 {fid} 界面示意图（占位符）。")

    # -------------------------
    # 3.6 运营后台管理模块
    # -------------------------
    add(paras, "h2", "3.6 运营后台管理模块")
    add(paras, "p", "模块说明：面向管理员提供运营配置能力，包含广告位、社交链接、发布版本与文件资源维护。")
    add(paras, "p", "访问控制：后台页面受管理员会话保护，未登录访问将重定向到登录页。")

    ops_functions = [
        ("3.6.1", "广告位管理", ["广告标题（Title）", "位置（Position）", "媒体类型（image/video）", "媒体文件（File）", "跳转链接（Target_URL，可选）", "优先级（priority）", "上架状态（is_active）"]),
        ("3.6.2", "社交链接管理", ["标题（Title）", "描述（Description，可选）", "图标文件（Icon）", "跳转链接（Target_URL）", "排序值（sort_order）", "上架状态（is_active）"]),
        ("3.6.3", "发布版本管理", ["平台（Platform）", "版本号（Version）", "变体（Variant，可选）", "安装包文件（File）", "是否强制更新（is_mandatory）", "更新说明（ReleaseNotes，可选）"]),
        ("3.6.4", "文件资源管理", ["数据源（StorageSource）", "文件标识（FileName/FileID）", "操作类型（list/delete/download/rename）"]),
    ]

    for fid, name, inputs in ops_functions:
        add(paras, "h3", f"{fid} {name}")
        add(paras, "p", f"- 功能描述：实现{name}的增删改查与文件上传，并确保数据与资源引用一致。")
        add(paras, "p", "- 输入项：")
        for item in inputs:
            add(paras, "p", f"  - {item}")
        add(paras, "p", "- 处理逻辑：")
        add(paras, "p", "  1) 校验管理员会话（admin_session）有效性，无效则拒绝访问。")
        add(paras, "p", "  2) 校验输入字段与文件元信息（类型、大小、URL 格式）。")
        add(paras, "p", "  3) 执行文件上传/更新/删除，并记录文件大小与引用标识。")
        add(paras, "p", "  4) 写入业务记录并更新 created_at/updated_at。")
        add(paras, "p", "  5) 失败场景按需回滚（例如清理已上传但未落库的文件）。")
        add(paras, "p", "- 输出项：success/data/error（按接口定义返回）。")
        add(paras, "p", f"- 界面说明：见图 {fid} 界面示意图（占位符）。")

    add(paras, "pb")

    # =========================
    # 4 运行环境规定
    # =========================
    add(paras, "h1", "4. 运行环境规定")
    add(paras, "h2", "4.1 硬件环境")
    add(paras, "p", "- 服务端：CPU 2核及以上，内存 4G 及以上，磁盘 50G 及以上。")
    add(paras, "p", "- 客户端：PC 机或智能手机，支持主流浏览器访问。")

    add(paras, "h2", "4.2 软件环境")
    add(paras, "p", "- 操作系统：Windows 10/11（开发与管理），Linux（部署运行，可选）。")
    add(paras, "p", f"- Web 框架：Next.js {facts.get('next_version') or '15.x'}。")
    add(paras, "p", f"- 前端基础库：React {facts.get('react_version') or '19.x'}。")
    add(paras, "p", f"- 开发语言：TypeScript {facts.get('typescript_version') or '5.x'}。")
    add(paras, "p", "- 运行平台：Node.js 18.x 或更高（需与 Next.js 版本兼容）。")
    add(paras, "p", "- 数据库（关系型）：PostgreSQL（通过 Supabase 托管）。")
    add(paras, "p", "- 数据库（集合型）：云开发集合型数据库（用于另一版本的数据存储）。")
    add(paras, "p", "- 对象存储：用于图片、音频、视频与安装包文件的存储与访问。")
    add(paras, "p", "- 开发工具：VS Code 或同类编辑器；包管理工具（npm/pnpm）用于依赖安装。")
    add(paras, "pb")

    # =========================
    # 5 尚需解决的问题
    # =========================
    add(paras, "h1", "5. 尚需解决的问题")
    add(paras, "p", "无。")
    add(paras, "pb")

    # =========================
    # 附录A：界面与页面清单
    # =========================
    add(paras, "h1", "附录A 界面与页面清单")
    add(paras, "p", "说明：以下为系统主要页面路径（文字占位符，不含截图）。")
    add(paras, "p", "A.1 认证相关页面：")
    for pth in facts.get("auth_pages", []):
        add(paras, "p", f"- {pth}")
    add(paras, "p", "A.2 支付相关页面：")
    for pth in facts.get("payment_pages", []):
        add(paras, "p", f"- {pth}")
    add(paras, "p", "A.3 后台管理页面：")
    for pth in facts.get("admin_pages", []):
        add(paras, "p", f"- {pth}")
    add(paras, "p", "A.4 通用页面：")
    add(paras, "p", "- /（首页/主交互页）")
    add(paras, "p", "- /status（运行状态页）")
    add(paras, "pb")

    # =========================
    # 附录B：接口清单（API 路由）
    # =========================
    add(paras, "h1", "附录B 接口清单（API 路由）")
    add(paras, "p", "说明：接口路径来源于代码目录 app/api，方法来源于 route.ts 中导出的 HTTP 方法。")
    add(paras, "p", "返回约定：统一使用 JSON 响应，字段包含 success/data/error（按接口实现略有差异）。")
    api_routes = facts.get("api_routes", [])
    for i, r in enumerate(api_routes, start=1):
        methods = ",".join(r.get("methods") or [])
        add(paras, "p", f"API-{i:03d} {methods} {r.get('url')}（来源：{r.get('source')}）")
    add(paras, "pb")

    # =========================
    # 附录C：数据字典（主要数据实体）
    # =========================
    add(paras, "h1", "附录C 数据字典（主要数据实体）")
    add(paras, "p", "说明：本附录描述系统关键数据实体的字段含义与约束，用于开发与验收口径统一。")
    add(paras, "p", "示例约定：User_A（用户标识）、Conv_20251212001（会话标识）、Order_20251212001（订单号）。")
    add(paras, "p", "时间字段统一使用 ISO 8601 字符串表示，例如：2025-10-08T12:30:00Z。")

    data_entities = [
        (
            "profiles（用户资料）",
            [
                ("id", "UUID", "用户唯一标识，与认证系统用户一致"),
                ("email", "Text", "用户邮箱（可为空，取决于认证方式）"),
                ("name", "Text", "用户显示名称"),
                ("avatar", "Text", "头像地址（URL）"),
                ("region", "Text", "区域标识（如 CN/US 等）"),
                ("hide_ads", "Boolean", "是否隐藏广告（开启需满足订阅状态约束）"),
                ("created_at", "Timestamp", "创建时间"),
                ("updated_at", "Timestamp", "更新时间"),
            ],
        ),
        (
            "user_wallets（用户钱包/配额）",
            [
                ("user_id", "UUID", "用户唯一标识"),
                ("plan", "Text", "当前套餐标识（Free/Basic/Pro/Enterprise）"),
                ("subscription_tier", "Text", "订阅档位（兼容字段）"),
                ("plan_exp", "Timestamp", "套餐到期时间"),
                ("pro", "Boolean", "付费标记（兼容字段）"),
                ("pending_downgrade", "JSON/Text", "待生效的降级队列（如有）"),
                ("monthly_image_balance", "Integer", "月度图片额度余额"),
                ("monthly_video_balance", "Integer", "月度视频/音频额度余额"),
                ("monthly_reset_at", "Timestamp", "账期重置时间点"),
                ("billing_cycle_anchor", "Integer", "账单日锚点（1-31）"),
                ("addon_image_balance", "Integer", "加油包图片额度余额"),
                ("addon_video_balance", "Integer", "加油包视频/音频额度余额"),
                ("daily_external_day", "Date", "按天统计日期（YYYY-MM-DD）"),
                ("daily_external_plan", "Text", "按天统计对应套餐标识"),
                ("daily_external_used", "Integer", "当日已用次数"),
                ("updated_at", "Timestamp", "更新时间"),
            ],
        ),
        (
            "conversations（会话）",
            [
                ("id/_id", "UUID/Text", "会话标识"),
                ("user_id/userId", "UUID/Text", "归属用户标识"),
                ("title", "Text", "会话标题"),
                ("service_type/model", "Text", "服务类型标识（用于选择处理通道）"),
                ("model_type", "Text", "服务分类标识（用于分组展示）"),
                ("scenario_id/expert_model_id", "Text", "场景标识（用于专业场景）"),
                ("folder_id", "Text", "会话文件夹标识（可空）"),
                ("created_at/createdAt", "Timestamp", "创建时间"),
                ("updated_at/updatedAt", "Timestamp", "更新时间"),
            ],
        ),
        (
            "messages（消息）",
            [
                ("id/_id", "UUID/Text", "消息标识"),
                ("conversation_id", "UUID/Text", "所属会话标识"),
                ("user_id", "UUID/Text", "归属用户标识"),
                ("role", "Text", "消息角色（user/assistant/system）"),
                ("content", "Text", "消息正文内容"),
                ("tokens", "Integer", "计量字段（如启用）"),
                ("client_id", "Text", "客户端幂等标识（用于去重）"),
                ("image_file_ids", "JSON", "图片文件引用列表（如启用）"),
                ("video_file_ids", "JSON", "视频文件引用列表（如启用）"),
                ("audio_file_ids", "JSON", "音频文件引用列表（如启用）"),
                ("created_at/createdAt", "Timestamp", "创建时间"),
            ],
        ),
        (
            "subscriptions（订阅记录）",
            [
                ("id", "UUID", "订阅记录标识"),
                ("user_id", "UUID", "归属用户标识"),
                ("plan", "Text", "订阅套餐标识"),
                ("period", "Text", "订阅周期（monthly/annual 等）"),
                ("status", "Text", "订阅状态（active/canceled/expired 等）"),
                ("provider", "Text", "通道标识"),
                ("provider_order_id", "Text", "通道侧订单号"),
                ("started_at", "Timestamp", "生效时间"),
                ("expires_at", "Timestamp", "到期时间"),
                ("created_at", "Timestamp", "创建时间"),
                ("updated_at", "Timestamp", "更新时间"),
            ],
        ),
        (
            "payments（支付记录）",
            [
                ("id", "UUID", "支付记录标识"),
                ("user_id", "UUID", "归属用户标识"),
                ("amount", "Numeric", "金额"),
                ("currency", "Text", "币种"),
                ("status", "Text", "支付状态（created/paid/failed/refunded 等）"),
                ("type", "Text", "业务类型（订阅/加油包等）"),
                ("provider", "Text", "支付通道标识"),
                ("provider_order_id", "Text", "支付通道侧订单号"),
                ("addon_package_id", "Text", "加油包标识（如适用）"),
                ("image_credits", "Integer", "图片额度发放数量（如适用）"),
                ("video_audio_credits", "Integer", "视频/音频额度发放数量（如适用）"),
                ("created_at", "Timestamp", "创建时间"),
            ],
        ),
        (
            "advertisements（广告位）",
            [
                ("id/_id", "UUID/Text", "广告标识"),
                ("title", "Text", "广告标题（后台管理用）"),
                ("position", "Text", "展示位置标识（如 top/sidebar 等）"),
                ("media_type", "Text", "媒体类型（image/video）"),
                ("media_url", "Text", "媒体资源地址或引用"),
                ("target_url", "Text", "跳转链接（可空）"),
                ("is_active", "Boolean", "上架状态"),
                ("priority", "Integer", "优先级（越大越靠前）"),
                ("file_size", "Integer", "文件大小（字节）"),
                ("created_at", "Timestamp", "创建时间"),
            ],
        ),
        (
            "app_releases（发布版本）",
            [
                ("id/_id", "UUID/Text", "版本记录标识"),
                ("version", "Text", "版本号（如 1.0.0）"),
                ("platform", "Text", "平台（ios/android/windows/macos/linux）"),
                ("variant", "Text", "变体/架构（可空）"),
                ("file_url", "Text", "安装包地址或引用"),
                ("file_size", "Integer", "文件大小（字节）"),
                ("release_notes", "Text", "更新说明（可空）"),
                ("is_active", "Boolean", "是否启用"),
                ("is_mandatory", "Boolean", "是否强制更新"),
                ("created_at", "Timestamp", "创建时间"),
                ("updated_at", "Timestamp", "更新时间"),
            ],
        ),
        (
            "admin_users（管理员账户）",
            [
                ("id", "UUID", "管理员标识"),
                ("username", "Text", "管理员用户名"),
                ("password_hash", "Text", "密码哈希（不可逆）"),
                ("created_at", "Timestamp", "创建时间"),
            ],
        ),
        (
            "social_links（社交链接）",
            [
                ("id/_id", "UUID/Text", "链接标识"),
                ("title", "Text", "标题"),
                ("description", "Text", "描述（可空）"),
                ("icon_url", "Text", "图标地址"),
                ("target_url", "Text", "跳转链接"),
                ("is_active", "Boolean", "上架状态"),
                ("sort_order", "Integer", "排序值（越小越靠前）"),
                ("file_size", "Integer", "图标文件大小（字节）"),
                ("created_at", "Timestamp", "创建时间"),
                ("updated_at", "Timestamp", "更新时间"),
            ],
        ),
    ]

    for entity_name, fields in data_entities:
        add(paras, "h2", entity_name)
        add(paras, "p", "| 字段 | 类型 | 说明 |")
        add(paras, "p", "| --- | --- | --- |")
        for field, ftype, desc in fields:
            add(paras, "p", f"| {field} | {ftype} | {desc} |")

    add(paras, "pb")

    # =========================
    # 附录D：需求用例详单
    # =========================
    add(paras, "h1", "附录D 需求用例详单")
    add(paras, "p", "说明：用例用于验证需求实现是否符合预期；每条用例包含输入、处理步骤与预期结果。")
    add(paras, "p", "用例编号示例：UC-0001；参与者示例：User_A（普通用户）、Admin（管理员）。")

    use_case_seeds = [
        ("账户注册", "User_A", ["Email", "Password"], ["成功创建账户并返回 User_ID"]),
        ("账户登录", "User_A", ["Email", "Password"], ["登录成功并写入会话令牌（Cookie）"]),
        ("登录状态查询", "User_A", ["Session_Token"], ["返回用户资料与订阅状态概览"]),
        ("用户设置更新（隐藏广告）", "User_A", ["hide_ads:Boolean", "Session_Token"], ["更新成功并返回最新设置值"]),
        ("创建会话", "User_A", ["Title", "Service_Type"], ["创建会话并返回 Conversation_ID"]),
        ("查询会话列表", "User_A", ["Page", "Size"], ["按更新时间倒序返回会话列表"]),
        ("发送消息（同步）", "User_A", ["Conversation_ID", "Text"], ["返回处理结果并记录消息"]),
        ("发送消息（流式）", "User_A", ["Conversation_ID", "Text"], ["按片段返回并在结束时返回完整结果"]),
        ("游客模式发送", "User_A", ["Local_Conversation_ID", "Text"], ["返回处理结果但不写入数据库"]),
        ("上传图片", "User_A", ["File:image", "Bytes"], ["上传成功并返回 Media_ID/URL"]),
        ("上传音频", "User_A", ["File:audio", "Bytes"], ["上传成功并返回 Media_ID/URL"]),
        ("上传视频", "User_A", ["File:video", "Bytes"], ["上传成功并返回 Media_ID/URL"]),
        ("媒体解析", "User_A", ["Media_ID/URL"], ["解析成功并返回可访问资源信息"]),
        ("媒体删除", "User_A", ["Media_ID"], ["删除成功并清理引用关系"]),
        ("查询配额", "User_A", ["Service_Type"], ["返回按天与按月的剩余额度与限额"]),
        ("扣减配额", "System", ["User_ID", "Count"], ["按规则扣减并返回剩余额度"]),
        ("创建支付订单", "User_A", ["Plan", "Period", "Amount"], ["生成订单并返回支付跳转信息"]),
        ("支付确认", "System", ["Provider_Order_ID", "Status"], ["更新支付状态并同步订阅到期时间"]),
        ("支付回调处理", "System", ["Webhook_Signature", "Payload"], ["验签成功并落库事件，完成发放/续期"]),
        ("管理员登录", "Admin", ["Admin_Username", "Password"], ["登录成功并设置 admin_session"]),
        ("广告新增", "Admin", ["Title", "Position", "Media(File)"], ["上传媒体并创建广告记录"]),
        ("广告上下架", "Admin", ["Ad_ID", "is_active"], ["更新广告状态并使展示同步生效"]),
        ("社交链接维护", "Admin", ["Title", "Icon", "Target_URL"], ["维护链接并按排序展示"]),
        ("发布版本新增", "Admin", ["Platform", "Version", "File"], ["上传安装包并创建版本记录"]),
        ("查询最新版本", "User_A", ["Platform"], ["返回指定平台最新可用版本信息"]),
        ("文件资源删除", "Admin", ["StorageSource", "FileName/FileID"], ["删除成功并返回确认结果"]),
    ]

    def render_use_case(case_id: str, title: str, actor: str, inputs: list[str], outcomes: list[str], variant: str) -> None:
        add(paras, "h2", f"{case_id} {title}（{variant}）")
        add(paras, "p", f"- 参与者：{actor}")
        add(paras, "p", "- 前置条件：")
        add(paras, "p", "  - 正常流程：参与者已具备必要的登录态或管理员会话。")
        add(paras, "p", "  - 游客模式：无需登录态，但不落库历史数据。")
        add(paras, "p", "- 输入项：")
        for i in inputs:
            add(paras, "p", f"  - {i}")
        add(paras, "p", "- 主流程：")
        add(paras, "p", "  1) 客户端/系统提交请求并携带必要参数与令牌。")
        add(paras, "p", "  2) 服务端执行参数校验、权限校验与版本隔离校验。")
        add(paras, "p", "  3) 服务端按数据处理规则执行业务处理（读写数据库/对象存储/回调事件处理）。")
        add(paras, "p", "  4) 服务端返回响应；流式场景按片段返回并最终收敛为完整结果。")
        add(paras, "p", "- 预期结果：")
        for o in outcomes:
            add(paras, "p", f"  - {o}")
        add(paras, "p", "- 异常与边界：")
        add(paras, "p", "  - 参数缺失/类型不匹配返回 400。")
        add(paras, "p", "  - 令牌缺失/无效/过期返回 401。")
        add(paras, "p", "  - 权限不足或不满足订阅约束返回 403。")
        add(paras, "p", "  - 资源不存在或跨版本访问返回 404。")
        add(paras, "p", "  - 服务端异常返回 500。")

    variants = ["正常流程", "参数校验失败", "权限/状态异常"]
    generated = 0
    idx = 0
    while generated < use_case_count:
        title, actor, inputs, outcomes = use_case_seeds[idx % len(use_case_seeds)]
        variant = variants[generated % len(variants)]
        case_id = f"UC-{generated + 1:04d}"
        render_use_case(case_id, title, actor, inputs, outcomes, variant)
        generated += 1
        idx += 1

    add(paras, "pb")

    # =========================
    # 附录E：错误码与返回约定
    # =========================
    add(paras, "h1", "附录E 错误码与返回约定")
    add(paras, "p", "统一约定：接口优先返回 JSON；当发生错误时返回 error 字段或标准错误信息。")
    add(paras, "p", "HTTP 状态码约定：")
    add(paras, "p", "- 200：请求成功。")
    add(paras, "p", "- 400：参数错误（必填缺失、格式不合法、类型不匹配）。")
    add(paras, "p", "- 401：未授权（缺少令牌或令牌无效/过期）。")
    add(paras, "p", "- 403：禁止访问（权限不足或不满足订阅状态约束）。")
    add(paras, "p", "- 404：资源不存在或跨版本路由被拒绝访问。")
    add(paras, "p", "- 413：请求体过大（超过服务端限制）。")
    add(paras, "p", "- 500：服务器内部错误（数据库/存储/外部服务异常）。")
    add(paras, "p", "错误响应示例（示意）：")
    add(paras, "p", '{ "success": false, "error": "Unauthorized" }')
    add(paras, "p", '{ "success": false, "error": "Invalid parameter" }')

    return paras


def main() -> int:
    args = parse_args()
    root: Path = args.root.resolve()
    md_path: Path = args.md.resolve()
    docx_path: Path = args.docx.resolve()

    facts = collect_facts(root)
    use_case_count = max(0, int(args.min_use_cases))
    target_pages = max(1, int(args.target_pages))

    last_pages: int | None = None
    used_use_case_count = use_case_count

    for _ in range(max(1, int(args.max_iterations))):
        used_use_case_count = use_case_count
        paragraphs = generate_requirements_paragraphs(facts, use_case_count=use_case_count)
        md_content = generate_markdown(paragraphs)

        disallowed = check_disallowed_terms(md_content)
        if disallowed:
            uniq = ", ".join(sorted(set(disallowed)))
            raise SystemExit(f"生成内容包含禁止/高风险词：{uniq}")

        md_path.parent.mkdir(parents=True, exist_ok=True)
        md_path.write_text(md_content, encoding="utf-8")
        write_docx(docx_path, paragraphs)

        pages = compute_pages_with_word(docx_path)
        last_pages = pages
        if pages is None:
            break
        if pages >= target_pages:
            break
        use_case_count += max(1, int(args.use_case_step))

    print(f"项目根目录: {root}")
    print(f"输出Markdown: {md_path}")
    print(f"输出DOCX: {docx_path}")
    print(f"用例数量: {used_use_case_count}")
    if last_pages is None:
        print("Word页数统计: 未获取（请手动在 Word 中查看页数）")
    else:
        print(f"Word页数统计: {last_pages} 页")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
