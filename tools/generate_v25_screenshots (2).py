# -*- coding: utf-8 -*-
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "screenshots-v2.5"
OUT.mkdir(exist_ok=True)

W, H = 430, 884

COLORS = {
    "bg": "#060b1b",
    "panel": "#111a2d",
    "panel2": "#162238",
    "border": "#263852",
    "muted": "#99a8bd",
    "text": "#f8fbff",
    "blue": "#21b8ff",
    "green": "#24d36b",
    "red": "#dd3333",
    "amber": "#ffb020",
}


def font(size, weight="regular"):
    names = {
        "regular": "segoeui.ttf",
        "semibold": "seguisb.ttf",
        "bold": "segoeuib.ttf",
    }
    path = Path("C:/Windows/Fonts") / names.get(weight, "segoeui.ttf")
    return ImageFont.truetype(str(path), size)


F = {
    "xs": font(10),
    "sm": font(12),
    "base": font(14),
    "md": font(16),
    "lg": font(20, "semibold"),
    "xl": font(27, "bold"),
    "num": font(30, "bold"),
    "brand": font(34, "bold"),
}


def rr(draw, box, fill, outline=None, radius=8, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def text(draw, xy, value, fill=None, fnt=None, anchor=None):
    draw.text(xy, value, fill=fill or COLORS["text"], font=fnt or F["base"], anchor=anchor)


def center_text(draw, box, value, fill=None, fnt=None):
    fnt = fnt or F["base"]
    x1, y1, x2, y2 = box
    bbox = draw.textbbox((0, 0), value, font=fnt)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((x1 + (x2 - x1 - tw) / 2, y1 + (y2 - y1 - th) / 2 - 1), value, fill=fill or COLORS["text"], font=fnt)


def small_icon(draw, kind, cx, cy, color):
    if kind == "home":
        s = 7
        for dx in (-s - 2, s + 2):
            for dy in (-s - 2, s + 2):
                draw.rectangle((cx + dx - 4, cy + dy - 4, cx + dx + 4, cy + dy + 4), outline=color, width=2)
    elif kind == "map":
        draw.ellipse((cx - 8, cy - 11, cx + 8, cy + 5), outline=color, width=2)
        draw.ellipse((cx - 3, cy - 6, cx + 3, cy), fill=color)
        draw.line((cx, cy + 5, cx, cy + 12), fill=color, width=2)
    elif kind == "tasks":
        draw.rounded_rectangle((cx - 9, cy - 11, cx + 9, cy + 11), radius=2, outline=color, width=2)
        draw.rectangle((cx - 4, cy - 14, cx + 4, cy - 9), outline=color, width=2)
        draw.line((cx - 4, cy - 1, cx - 1, cy + 3), fill=color, width=2)
        draw.line((cx - 1, cy + 3, cx + 6, cy - 5), fill=color, width=2)
    elif kind == "report":
        draw.rounded_rectangle((cx - 8, cy - 12, cx + 8, cy + 12), radius=2, outline=color, width=2)
        draw.line((cx - 4, cy - 3, cx + 5, cy - 3), fill=color, width=2)
        draw.line((cx - 4, cy + 4, cx + 5, cy + 4), fill=color, width=2)
    elif kind == "layer":
        draw.rectangle((cx - 10, cy - 7, cx + 7, cy + 10), outline=color, width=2)
        draw.rectangle((cx - 5, cy - 12, cx + 12, cy + 5), outline=color, width=2)
    elif kind == "doc":
        draw.rounded_rectangle((cx - 8, cy - 10, cx + 8, cy + 10), radius=2, outline=color, width=2)
        draw.line((cx - 4, cy - 2, cx + 5, cy - 2), fill=color, width=2)
        draw.line((cx - 4, cy + 4, cx + 5, cy + 4), fill=color, width=2)
    elif kind == "bell":
        draw.arc((cx - 7, cy - 9, cx + 7, cy + 7), 200, -20, fill=color, width=2)
        draw.line((cx - 7, cy + 4, cx + 7, cy + 4), fill=color, width=2)
        draw.ellipse((cx - 2, cy + 7, cx + 2, cy + 11), fill=color)
    elif kind == "exit":
        draw.rectangle((cx - 9, cy - 8, cx, cy + 8), outline=color, width=2)
        draw.line((cx - 1, cy, cx + 9, cy), fill=color, width=2)
        draw.line((cx + 5, cy - 4, cx + 9, cy), fill=color, width=2)
        draw.line((cx + 5, cy + 4, cx + 9, cy), fill=color, width=2)


def wrap(draw, value, x, y, max_width, fnt, fill=None, line_gap=3):
    words = value.split()
    line = ""
    for word in words:
        test = f"{line} {word}".strip()
        if draw.textlength(test, font=fnt) <= max_width:
            line = test
        else:
            text(draw, (x, y), line, fill, fnt)
            y += fnt.size + line_gap
            line = word
    if line:
        text(draw, (x, y), line, fill, fnt)
        y += fnt.size + line_gap
    return y


def phone_base(title, subtitle=None, active="Ana Sayfa"):
    img = Image.new("RGB", (W, H), COLORS["bg"])
    d = ImageDraw.Draw(img)
    # subtle phone viewport guides
    d.rounded_rectangle((5, 5, W - 5, H - 5), radius=38, outline="#263043", width=2)
    d.ellipse((199, 20, 231, 52), fill="#050814", outline="#171e30")
    d.ellipse((211, 30, 219, 38), fill="#203556")
    text(d, (30, 30), "Tarım ve Orman Bakanlığı", COLORS["blue"], F["xs"])
    text(d, (30, 51), title, COLORS["text"], F["xl"])
    if subtitle:
        wrap(d, subtitle, 30, 88, 330, F["sm"], COLORS["muted"])
    rr(d, (345, 29, 393, 78), COLORS["green"], "#79ef9d", 8)
    center_text(d, (345, 29, 393, 78), "2.5", COLORS["text"], F["sm"])
    nav(d, active)
    return img, d


def nav(draw, active):
    y = 815
    draw.line((0, y - 1, W, y - 1), fill="#142038")
    items = [("Ana Sayfa", "home"), ("CBS", "map"), ("Denetimler", "tasks"), ("Rapor", "report")]
    xs = [66, 158, 262, 362]
    for (label, kind), x in zip(items, xs):
        color = COLORS["green"] if label == active else "#aab7c9"
        small_icon(draw, kind, x, y + 12, color)
        text(draw, (x, y + 35), label, color, F["xs"], anchor="mm")


def card(draw, box, title=None):
    rr(draw, box, COLORS["panel"], COLORS["border"], 8)
    if title:
        text(draw, (box[0] + 14, box[1] + 14), title, COLORS["text"], F["md"])


def stat(draw, box, label, value, color):
    rr(draw, box, COLORS["panel"], COLORS["border"], 7)
    text(draw, (box[0] + 14, box[1] + 16), label, COLORS["muted"], F["sm"])
    text(draw, (box[0] + 14, box[1] + 46), value, color, F["num"])


def pill(draw, box, label, fill, outline=None, fnt=None):
    rr(draw, box, fill, outline or fill, 8)
    center_text(draw, box, label, COLORS["text"], fnt or F["sm"])


def input_box(draw, box, label):
    rr(draw, box, "#0d1628", COLORS["border"], 7)
    text(draw, (box[0] + 12, box[1] + 12), label, "#788aa4", F["sm"])


def login():
    img = Image.new("RGB", (W, H), COLORS["bg"])
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((5, 5, W - 5, H - 5), radius=38, outline="#263043", width=2)
    text(d, (34, 78), "Tarım ve Orman Bakanlığı", COLORS["blue"], F["sm"])
    text(d, (34, 104), "KOBÜDS", COLORS["text"], F["brand"])
    wrap(d, "Kapalı Ortamda Bitkisel Üretim Denetim Sistemi", 34, 153, 330, F["base"], COLORS["muted"])
    card(d, (28, 242, 402, 590))
    text(d, (52, 271), "Giriş", COLORS["text"], F["lg"])
    input_box(d, (52, 318, 378, 366), "E-posta")
    input_box(d, (52, 382, 378, 430), "Şifre")
    pill(d, (52, 458, 378, 512), "Giriş Yap", "#1f6bf2", fnt=F["base"])
    text(d, (52, 535), "Sürüm 2.5.0", COLORS["muted"], F["sm"])
    img.save(OUT / "01_login.png")


def home_admin():
    img, d = phone_base("KOBÜDS", "Kapalı Ortamda Bitkisel Üretim Denetim Sistemi", "Ana Sayfa")
    card(d, (30, 116, 386, 215))
    text(d, (46, 135), "Aktif kullanıcı", COLORS["muted"], F["xs"])
    text(d, (46, 158), "İsmail Zengin", COLORS["text"], F["md"])
    text(d, (46, 183), "Rol: admin", COLORS["green"], F["sm"])
    rr(d, (336, 129, 369, 161), "#223047", "#223047", 8)
    small_icon(d, "bell", 352, 145, COLORS["text"])
    rr(d, (336, 169, 369, 200), "#bf2e2e", "#bf2e2e", 8)
    small_icon(d, "exit", 352, 184, COLORS["text"])
    stat(d, (30, 228, 201, 314), "Görev sayısı", "47", "#63a8ff")
    stat(d, (210, 228, 381, 314), "Sahadaki personel", "2", COLORS["blue"])
    card(d, (30, 324, 386, 420), "İl / İlçe")
    text(d, (46, 360), "Antalya", COLORS["text"], F["lg"])
    text(d, (46, 389), "Aksu İlçe Tarım ve Orman Müdürlüğü", COLORS["muted"], F["sm"])
    card(d, (30, 432, 386, 774), "Son işlem özetleri")
    text(d, (332, 450), "Tümü", COLORS["blue"], F["sm"])
    rows = [
        ("Test Üretici", "Ünite - Domates", "Sahaya Atandı", COLORS["green"]),
        ("İsmail Zengin", "Ünite UN-2026-001 - Domates", "Denetim Tamamlandı", COLORS["green"]),
        ("Üretici", "Ünite - cdszdgdfg", "Bekliyor", COLORS["amber"]),
        ("Saha işlemi", "Ünite -", "Sahaya Atandı", COLORS["green"]),
    ]
    y = 488
    for name, sub, status, color in rows:
        rr(d, (50, y - 2, 80, y + 28), "#083d66", "#083d66", 8)
        small_icon(d, "tasks", 65, y + 12, COLORS["blue"])
        text(d, (92, y - 4), name, COLORS["text"], F["sm"])
        text(d, (92, y + 17), sub, COLORS["muted"], F["xs"])
        text(d, (285, y + 8), status, color, F["xs"])
        y += 60
    text(d, (46, 748), "Sürüm 2.5.0", "#6e819d", F["xs"])
    img.save(OUT / "02_home_admin.png")


def home_inspector():
    img, d = phone_base("KOBÜDS", "Denetçi çalışma alanı", "Ana Sayfa")
    card(d, (30, 116, 386, 211))
    text(d, (46, 136), "Aktif kullanıcı", COLORS["muted"], F["xs"])
    text(d, (46, 159), "Ayşe Denetçi", COLORS["text"], F["md"])
    text(d, (46, 184), "Rol: denetçi", COLORS["green"], F["sm"])
    stat(d, (30, 224, 201, 310), "Atanan görev", "8", "#63a8ff")
    stat(d, (210, 224, 381, 310), "Bugün", "3", COLORS["green"])
    card(d, (30, 321, 386, 417), "İl / İlçe")
    text(d, (46, 357), "Antalya", COLORS["text"], F["lg"])
    text(d, (46, 386), "Aksu İlçe Tarım ve Orman Müdürlüğü", COLORS["muted"], F["sm"])
    card(d, (30, 430, 386, 774), "Son işlem özetleri")
    rows = [
        ("Domates", "Test Üretici - 221 / 19", "Saha başlangıcı"),
        ("Biber", "Mehmet Üretici - 144 / 5", "Bekliyor"),
        ("Salatalık", "Aksu Üretici - 80 / 2", "Tamamlandı"),
    ]
    y = 489
    for name, sub, status in rows:
        rr(d, (50, y - 2, 80, y + 28), "#083d66", "#083d66", 8)
        small_icon(d, "tasks", 65, y + 12, COLORS["blue"])
        text(d, (92, y - 4), name, COLORS["text"], F["sm"])
        text(d, (92, y + 17), sub, COLORS["muted"], F["xs"])
        text(d, (270, y + 8), status, COLORS["green"], F["xs"])
        y += 67
    img.save(OUT / "03_home_inspector.png")


def cbs_layers():
    img, d = phone_base("Sera Haritası", "Üniteye dokununca bilgi kartı açılır.", "CBS")
    input_box(d, (38, 121, 342, 162), "Ünite, üretici, ada/parsel veya ilçe ara")
    pill(d, (351, 121, 393, 162), "Yenile", "#2563eb", fnt=F["xs"])
    text(d, (38, 178), "47 ünite gösteriliyor", COLORS["muted"], F["sm"])
    # map
    rr(d, (38, 211, 393, 666), "#eef4f7", "#cbd5e1", 8)
    # map pattern
    for x in range(63, 376, 45):
        d.line((x, 222, x, 656), fill="#d1dbe8", width=2)
    for y in range(245, 645, 48):
        d.line((50, y, 381, y), fill="#d1dbe8", width=2)
    d.polygon([(38, 532), (164, 490), (393, 505), (393, 666), (38, 666)], fill="#7bd3e4")
    text(d, (177, 425), "Antalya", "#374151", font(24, "semibold"))
    for x, y, c in [(222, 409, "#2f6dd6"), (312, 277, "#ef4444"), (67, 383, "#0ea5e9"), (357, 553, "#ec4899")]:
        d.ellipse((x - 9, y - 9, x + 9, y + 9), fill=c, outline="white", width=2)
    pill(d, (52, 229, 112, 263), "Alınıyor", "#5390f5", fnt=F["xs"])
    pill(d, (52, 271, 102, 305), "Yön", "#1d293d", fnt=F["xs"])
    pill(d, (350, 513, 383, 546), "+", "#f8fafc", "#cbd5e1", F["lg"])
    pill(d, (350, 550, 383, 583), "-", "#f8fafc", "#cbd5e1", F["lg"])
    rr(d, (344, 224, 382, 262), "#111827", "#d1d5db", 8)
    small_icon(d, "layer", 363, 243, "#f8fafc")
    rr(d, (214, 270, 384, 454), COLORS["panel"], COLORS["border"], 8)
    text(d, (230, 290), "Katmanlar", COLORS["text"], F["md"])
    layer_rows = [("Parseller", COLORS["green"]), ("Seralar", COLORS["blue"]), ("Yakındaki", "#9aa8bd"), ("Sınıflandırma", COLORS["amber"]), ("Re'sen üretim", COLORS["red"])]
    yy = 324
    for label, color in layer_rows:
        d.rectangle((231, yy + 2, 243, yy + 14), fill=color)
        text(d, (252, yy), label, COLORS["text"], F["xs"])
        yy += 23
    img.save(OUT / "04_cbs_layers.png")


def tasks():
    img, d = phone_base("Denetimler", "Görevleri durumuna göre takip edin.", "Denetimler")
    pill(d, (30, 119, 119, 156), "Tümü", "#113d28", "#1faa5b")
    pill(d, (127, 119, 236, 156), "Bekleyen", COLORS["panel2"], COLORS["border"])
    pill(d, (244, 119, 381, 156), "Sahaya Atandı", COLORS["panel2"], COLORS["border"])
    y = 177
    rows = [
        ("Domates", "Test Üretici", "Antalya / Aksu", "Sahaya Atandı"),
        ("Biber", "Mehmet Üretici", "Antalya / Aksu", "Bekliyor"),
        ("Salatalık", "Aksu Üretici", "Antalya / Döşemealtı", "Tamamlandı"),
        ("Çilek", "Üretici", "Isparta / Merkez", "Atanmamış"),
    ]
    for crop, producer, loc, status in rows:
        card(d, (30, y, 386, y + 112))
        text(d, (46, y + 18), crop, COLORS["text"], F["lg"])
        text(d, (46, y + 49), producer, COLORS["muted"], F["sm"])
        text(d, (46, y + 72), loc, COLORS["muted"], F["xs"])
        color = COLORS["green"] if status != "Bekliyor" else COLORS["amber"]
        pill(d, (265, y + 19, 368, y + 52), status, "#123424" if color == COLORS["green"] else "#3a2b13", None, F["xs"])
        y += 125
    img.save(OUT / "05_tasks.png")


def new_task():
    img, d = phone_base("Yeni Saha Görevi", "CBS seçiminden gelen görevi düzenleyin.", "Denetimler")
    card(d, (30, 118, 386, 742), "Ünite bilgileri")
    input_box(d, (46, 164, 370, 207), "Üretici: Test Üretici")
    input_box(d, (46, 218, 370, 261), "İl / İlçe: Antalya / Aksu")
    input_box(d, (46, 272, 370, 315), "Ada / Parsel: 221 / 19")
    input_box(d, (46, 326, 370, 369), "Ünite no: UN-2026-001")
    text(d, (46, 400), "Sınıflandırma", COLORS["text"], F["md"])
    pill(d, (46, 433, 158, 471), "Normal", "#113d28", "#22c55e")
    pill(d, (166, 433, 280, 471), "Riskli", COLORS["panel2"], COLORS["border"])
    pill(d, (46, 489, 222, 532), "Re'sen üretim alanı", COLORS["panel2"], COLORS["border"])
    input_box(d, (46, 553, 370, 597), "Denetçi seç")
    pill(d, (46, 628, 370, 680), "Görevi Oluştur", "#1f6bf2", fnt=F["base"])
    img.save(OUT / "06_new_task.png")


def task_detail_admin():
    img, d = phone_base("Domates", "- Test Üretici", "Denetimler")
    pill(d, (292, 32, 386, 72), "Sahaya Atandı", "#f59e0b", fnt=F["sm"])
    cells = [
        (30, 112, 202, 196, "Üretici", "Test Üretici\n05555555555"),
        (210, 112, 382, 196, "Parsel", "Antalya\n221 / 19"),
        (30, 205, 202, 289, "Ürün", "Domates\nİşletme: -"),
        (210, 205, 382, 289, "Ünite", "UN-2026-001\n1.200 m²"),
    ]
    for x1, y1, x2, y2, label, val in cells:
        rr(d, (x1, y1, x2, y2), COLORS["panel"], COLORS["border"], 7)
        text(d, (x1 + 14, y1 + 15), label, COLORS["blue"], F["xs"])
        a, b = val.split("\n")
        text(d, (x1 + 14, y1 + 38), a, COLORS["text"], F["sm"])
        text(d, (x1 + 14, y1 + 60), b, COLORS["muted"], F["sm"])
    pill(d, (30, 300, 205, 342), "Üreticiyi Ara", COLORS["blue"], fnt=F["sm"])
    pill(d, (212, 300, 386, 342), "Navigasyon", "#1faa4d", fnt=F["sm"])
    card(d, (30, 356, 386, 615), "Görevlendirme")
    text(d, (48, 392), "Denetimi sahada yürütecek kullanıcıyı seçin.", COLORS["muted"], F["sm"])
    input_box(d, (47, 421, 205, 477), "Mevcut atama\nİsmail Zengin")
    input_box(d, (213, 421, 370, 477), "Durum\nSahaya Atandı")
    input_box(d, (47, 489, 370, 535), "İsmail Zengin · Admin")
    text(d, (47, 554), "Seçilen kullanıcı: İsmail Zengin (Admin)", COLORS["text"], F["sm"])
    pill(d, (47, 579, 370, 626), "Denetimi İptal Et", "#b91c1c", fnt=F["sm"])
    text(d, (49, 646), "Not: Atanmış görevde tekrar görev ata butonu yok.", COLORS["muted"], F["xs"])
    img.save(OUT / "07_task_detail_admin.png")


def inspector_flow():
    img, d = phone_base("Saha Denetimi", "Denetçi ekranı", "Denetimler")
    card(d, (30, 118, 386, 204), "Görev")
    text(d, (48, 153), "Domates · Test Üretici", COLORS["text"], F["md"])
    text(d, (48, 178), "Antalya / Aksu · 221 / 19", COLORS["muted"], F["sm"])
    card(d, (30, 219, 386, 735), "Denetim adımları")
    steps = [
        ("1", "Saha başlangıcı", True),
        ("2", "Konum doğrulama", True),
        ("3", "Fotoğraf ve bulgu", False),
        ("4", "Ek-8 önizleme", False),
        ("5", "Tamamla", False),
    ]
    y = 270
    for no, label, done in steps:
        c = COLORS["green"] if done else "#24324a"
        d.ellipse((49, y, 81, y + 32), fill=c, outline="#3d4f6d")
        center_text(d, (49, y, 81, y + 32), no, COLORS["text"], F["sm"])
        text(d, (96, y + 4), label, COLORS["text"], F["md"])
        if done:
            text(d, (315, y + 7), "Tamam", COLORS["green"], F["xs"])
        y += 78
    pill(d, (47, 662, 370, 710), "Saha Kaydını Güncelle", "#1f6bf2", fnt=F["base"])
    img.save(OUT / "08_inspector_flow.png")


def reports_filters():
    img, d = phone_base("Raporlar", "CBS üzerinden oluşturulan raporlar listelenir ve PDF çıktısı alınır.", "Rapor")
    card(d, (24, 132, 386, 273))
    text(d, (42, 150), "Oluşturulan rapor", COLORS["muted"], F["sm"])
    text(d, (42, 177), "0", COLORS["green"], F["num"])
    pill(d, (42, 217, 370, 258), "Ek-8 PDF Oluştur", "#1faa4d", fnt=F["sm"])
    card(d, (24, 284, 386, 350), "Filtreler")
    pill(d, (330, 301, 370, 333), "v", COLORS["panel2"], COLORS["border"], F["lg"])
    rr(d, (24, 360, 386, 557), COLORS["panel"], COLORS["border"], 8)
    input_box(d, (38, 377, 374, 416), "Üreticiye göre filtrele")
    input_box(d, (38, 425, 374, 464), "Ada / parsele göre filtrele")
    input_box(d, (38, 473, 374, 512), "Ünite noya göre filtrele")
    input_box(d, (38, 521, 198, 560), "Başlangıç tarihi")
    input_box(d, (214, 521, 374, 560), "Bitiş tarihi")
    text(d, (24, 584), "Son raporlar", COLORS["text"], F["md"])
    pill(d, (342, 577, 386, 609), "CBS", COLORS["panel2"], fnt=F["xs"])
    card(d, (24, 622, 386, 733))
    text(d, (46, 650), "Henüz rapor yok", COLORS["text"], F["sm"])
    wrap(d, "İlk Ek-8 çıktısını CBS ekranında seçilen sera üzerinden oluşturun.", 46, 675, 295, F["sm"], COLORS["muted"])
    img.save(OUT / "09_reports_filters.png")


def profile():
    img, d = phone_base("Profil", "Kullanıcı ve görev kapsamı", "Ana Sayfa")
    card(d, (30, 120, 386, 266), "Kullanıcı")
    text(d, (50, 158), "İsmail Zengin", COLORS["text"], F["lg"])
    text(d, (50, 188), "admin", COLORS["green"], F["sm"])
    text(d, (50, 214), "ismail.zengin@tarbil.gov.tr", COLORS["muted"], F["sm"])
    card(d, (30, 282, 386, 430), "Çalışma yeri")
    text(d, (50, 322), "Antalya", COLORS["text"], F["lg"])
    text(d, (50, 352), "Aksu İlçe Tarım ve Orman Müdürlüğü", COLORS["muted"], F["sm"])
    text(d, (50, 380), "Bakanlık veri tabanı dağıtımı ile eşleşir.", COLORS["muted"], F["xs"])
    card(d, (30, 446, 386, 610), "Sürüm")
    text(d, (50, 485), "KOBÜDS 2.5", COLORS["text"], F["lg"])
    text(d, (50, 516), "versionName 2.5.0 · versionCode 25", COLORS["muted"], F["sm"])
    pill(d, (50, 548, 366, 594), "Çıkış Yap", "#b91c1c", fnt=F["sm"])
    img.save(OUT / "10_profile.png")


def ek8():
    img, d = phone_base("Ek-8 Raporu", "PDF önizleme", "Rapor")
    rr(d, (29, 116, 387, 760), "#f8fafc", "#d7dee8", 8)
    text(d, (58, 146), "T.C.", "#111827", F["base"])
    text(d, (58, 172), "TARIM VE ORMAN BAKANLIĞI", "#111827", F["md"])
    text(d, (58, 207), "KAPALI ORTAMDA BİTKİSEL ÜRETİM", "#111827", F["sm"])
    text(d, (58, 229), "DENETİM FORMU (EK-8)", "#111827", F["lg"])
    y = 280
    rows = [
        ("Üretici", "Test Üretici"),
        ("İl / İlçe", "Antalya / Aksu"),
        ("Ada / Parsel", "221 / 19"),
        ("Ünite No", "UN-2026-001"),
        ("Ürün", "Domates"),
        ("Denetçi", "İsmail Zengin"),
    ]
    for label, value in rows:
        d.rectangle((58, y, 340, y + 36), outline="#cbd5e1")
        text(d, (68, y + 9), label, "#334155", F["xs"])
        text(d, (190, y + 9), value, "#0f172a", F["xs"])
        y += 36
    d.rectangle((58, y + 28, 340, y + 142), outline="#cbd5e1")
    text(d, (68, y + 42), "Açıklama", "#334155", F["xs"])
    wrap(d, "Saha denetimi mobil uygulama üzerinden kaydedilmiştir.", 68, y + 68, 240, F["xs"], "#334155")
    pill(d, (58, 693, 340, 733), "PDF İndir", "#1faa4d", fnt=F["sm"])
    img.save(OUT / "11_ek8_report.png")


if __name__ == "__main__":
    for png in OUT.glob("*.png"):
        png.unlink()
    login()
    home_admin()
    home_inspector()
    cbs_layers()
    tasks()
    new_task()
    task_detail_admin()
    inspector_flow()
    reports_filters()
    profile()
    ek8()
    print(f"Generated {len(list(OUT.glob('*.png')))} screenshots in {OUT}")
