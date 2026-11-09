#!/usr/bin/env python3
"""Generates targets/watch/Demo/DemoData.swift: the invented sample wedding as
watch snapshots (4 kinds x en/es), wrapped in #if DEBUG so Release has none.
Run from guestly-mobile/: python3 docs/watch/tools/gen_demo.py"""
import json, os

def qr(n=25, seed=20270321):
    rows = []
    s = seed
    def finder(x, y):
        for cx, cy in ((0, 0), (n - 7, 0), (0, n - 7)):
            if cx - 1 <= x <= cx + 7 and cy - 1 <= y <= cy + 7:
                dx, dy = x - cx, y - cy
                if dx < 0 or dx > 6 or dy < 0 or dy > 6: return 0
                if dx in (0, 6) or dy in (0, 6): return 1
                return 1 if 2 <= dx <= 4 and 2 <= dy <= 4 else 0
        return -1
    for y in range(n):
        r = ""
        for x in range(n):
            s = (s * 1103515245 + 12345) % 2147483648
            f = finder(x, y)
            on = ((s >> 16) % 2 == 1) if f == -1 else f == 1
            r += "1" if on else "0"
        rows.append(r)
    return rows

T = {
 "en": dict(date="21 Mar 2027", t1="Approve menu cards", n1="Done 9:40", t2="Confirm florist delivery", n2="Due today", t3="Send seating to venue", n3="Due Friday",
            next_name="Florist", next_due="Due Friday", team=[("Planner","Replies in minutes"),("Venue","Walkthrough Thursday"),("Photographer","Shot list approved")],
            left="18 min left", ceremony="Ceremony", cocktail="Cocktail hour", dinner="Dinner", line="17:00 · Courtyard",
            q="Push dinner?", body="Ceremony is running over. Dinner moves to 19:45.", push="Push 15 min", keep="Keep 19:30",
            last="Last in: Mateo Rojas · Table 4", summary="2 of 3 on site", florist="Florist", catering="Catering", band="Band", on1="On site 14:10", on2="On site 15:00", late="Late 12 min",
            today="Today", saturday="Saturday", dec="12 Dec", w1="96 of 158 here", w2="3 tasks open", w3="14 replies pending",
            from_="Tomás Vega asks", question="Can I bring a plus one?", party="Party of 2 · Table 7",
            shuttle="Shuttle leaves", lobby="Hotel lobby · in 25 min", courtyard="Courtyard", table="Table 7"),
 "es": dict(date="21 mar 2027", t1="Aprobar tarjetas del menú", n1="Hecho 9:40", t2="Confirmar entrega de flores", n2="Vence hoy", t3="Enviar mesas al salón", n3="Vence el viernes",
            next_name="Florista", next_due="Vence el viernes", team=[("Planner","Responde en minutos"),("Salón","Visita el jueves"),("Fotógrafo","Lista de tomas aprobada")],
            left="faltan 18 min", ceremony="Ceremonia", cocktail="Cóctel", dinner="Cena", line="17:00 · Patio",
            q="¿Atrasar la cena?", body="La ceremonia se está pasando. La cena se mueve a las 19:45.", push="Atrasar 15 min", keep="Dejar 19:30",
            last="Último: Mateo Rojas · Mesa 4", summary="2 de 3 en el lugar", florist="Florista", catering="Banquetería", band="Banda", on1="En el lugar 14:10", on2="En el lugar 15:00", late="Retraso 12 min",
            today="Hoy", saturday="Sábado", dec="12 dic", w1="96 de 158 llegaron", w2="3 tareas abiertas", w3="14 respuestas pendientes",
            from_="Tomás Vega pregunta", question="¿Puedo llevar acompañante?", party="Grupo de 2 · Mesa 7",
            shuttle="Sale el transporte", lobby="Lobby del hotel · en 25 min", courtyard="Patio", table="Mesa 7"),
}

def build(kind, lang):
    t = T[lang]
    dayof = "dayof" in kind
    role = "planner" if kind.startswith("planner") else "guest" if kind == "guest" else "couple"
    s = {"v": 1, "at": 1794253773000, "lang": lang, "enabled": True, "role": role,
         "wedding": {"names": "Camila & Andrés", "dateText": t["date"], "days": 0 if dayof else 132, "passed": False, "isDayOf": dayof}}
    needs = [{"id": "c12", "from": t["from_"], "question": t["question"], "canReply": True}]
    if role == "couple":
        s["replies"] = {"going": 118, "pending": 31, "declined": 9, "total": 158}
        s["tasks"] = {"done": 1, "total": 3, "items": [
            {"id": "t1", "title": t["t1"], "note": t["n1"], "urgent": False, "done": True},
            {"id": "t2", "title": t["t2"], "note": t["n2"], "urgent": True, "done": False},
            {"id": "t3", "title": t["t3"], "note": t["n3"], "urgent": False, "done": False}]}
        s["budget"] = {"paidText": "$18,400", "totalText": "$31,000", "fraction": 0.59,
                       "next": {"name": t["next_name"], "amountText": "$1,200", "dueText": t["next_due"]}}
        s["team"] = [{"name": n, "note": note, "tel": "+5917000000%d" % i} for i, (n, note) in enumerate(t["team"])]
        s["needsYou"] = needs
    if role in ("couple", "planner") and dayof:
        s["dayOf"] = {"now": {"title": t["ceremony"], "line": t["line"], "leftText": t["left"], "fraction": 0.4},
                      "next": [{"time": "18:00", "title": t["cocktail"]}, {"time": "19:30", "title": t["dinner"]}]}
        if role == "couple":
            s["dayOf"]["overrun"] = {"blockId": "b3", "question": t["q"], "body": t["body"], "pushLabel": t["push"], "keepLabel": t["keep"]}
        s["door"] = {"inCount": 96, "total": 158, "lastText": t["last"]}
        tel = (lambda i: "+5917100000%d" % i) if role == "couple" else (lambda i: None)
        items = [("b1", t["florist"], t["on1"], "onsite", 1), ("b2", t["catering"], t["on2"], "onsite", 2), ("b4", t["band"], t["late"], "late", 3)]
        s["vendorsToday"] = {"summary": t["summary"], "items": [
            {k: v for k, v in dict(blockId=b, name=n, note=note, state=st, tel=tel(i)).items() if v is not None} for b, n, note, st, i in items]}
    if role == "planner":
        s["weddings"] = [{"label": t["today"], "names": "Camila & Andrés", "line": t["w1"], "today": True},
                         {"label": t["saturday"], "names": "Sofía & Martín", "line": t["w2"], "today": False},
                         {"label": t["dec"], "names": "Elena & Diego", "line": t["w3"], "today": False}]
        if not dayof:
            s["tasks"] = {"done": 1, "total": 3, "items": [
                {"id": "t1", "title": t["t1"], "note": t["n1"], "urgent": False, "done": True},
                {"id": "t2", "title": t["t2"], "note": t["n2"], "urgent": True, "done": False}]}
    if role == "guest":
        s["pass"] = {"name": "Valentina Cruz", "line": t["party"], "qr": qr()}
        s["myDay"] = [{"time": "16:15", "title": t["shuttle"], "note": t["lobby"], "soon": True},
                      {"time": "17:00", "title": t["ceremony"], "note": t["courtyard"], "soon": False},
                      {"time": "19:30", "title": t["dinner"], "note": t["table"], "soon": False}]
    return s

kinds = ["couple", "couple-dayof", "planner-dayof", "guest"]
out = ["// GENERATED by docs/watch/tools/gen_demo.py. Do not edit. Debug builds only.", "#if DEBUG", "enum DemoData {", "  static let json: [String: String] = ["]
for lang in ("en", "es"):
    for k in kinds:
        key = k if lang == "en" else k + "-es"
        out.append('    "%s": #"""\n%s\n"""#,' % (key, json.dumps(build(k, lang), ensure_ascii=False)))
out += ["  ]", "}", "#endif", ""]
dest = os.path.join("targets", "watch", "Demo", "DemoData.swift")
open(dest, "w").write("\n".join(out))
print("wrote", dest)
