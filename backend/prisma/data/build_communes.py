#!/usr/bin/env python3
"""Build communes.json: the 77 communes of Benin with department, PDA pole and coordinates.

Coordinates come from the Open-Meteo geocoding API (countryCode=BJ). Run once, commit the output.
PDA pole assignment follows the 2016 territorial split and is indicative at commune level.
"""
import json
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

DEPARTMENTS = {
    "Alibori": ["Banikoara", "Gogounou", "Kandi", "Karimama", "Malanville", "Ségbana"],
    "Atacora": ["Boukoumbé", "Cobly", "Kérou", "Kouandé", "Matéri", "Natitingou", "Péhunco", "Tanguiéta", "Toucountouna"],
    "Atlantique": ["Abomey-Calavi", "Allada", "Kpomassè", "Ouidah", "Sô-Ava", "Toffo", "Tori-Bossito", "Zè"],
    "Borgou": ["Bembèrèkè", "Kalalé", "N'Dali", "Nikki", "Parakou", "Pèrèrè", "Sinendé", "Tchaourou"],
    "Collines": ["Bantè", "Dassa-Zoumè", "Glazoué", "Ouèssè", "Savalou", "Savè"],
    "Couffo": ["Aplahoué", "Djakotomey", "Dogbo", "Klouékanmè", "Lalo", "Toviklin"],
    "Donga": ["Bassila", "Copargo", "Djougou", "Ouaké"],
    "Littoral": ["Cotonou"],
    "Mono": ["Athiémé", "Bopa", "Comè", "Grand-Popo", "Houéyogbé", "Lokossa"],
    "Ouémé": ["Adjarra", "Adjohoun", "Aguégués", "Akpro-Missérété", "Avrankou", "Bonou", "Dangbo", "Porto-Novo", "Sèmè-Kpodji"],
    "Plateau": ["Adja-Ouèrè", "Ifangni", "Kétou", "Pobè", "Sakété"],
    "Zou": ["Abomey", "Agbangnizoun", "Bohicon", "Covè", "Djidja", "Ouinhi", "Za-Kpota", "Zagnanado", "Zogbodomey"],
}

POLE_BY_COMMUNE = {
    **{c: 1 for c in ["Karimama", "Malanville"]},
    **{c: 2 for c in ["Banikoara", "Gogounou", "Kandi", "Ségbana", "Kalalé", "Nikki", "Bembèrèkè", "Sinendé", "Kérou", "Kouandé", "Péhunco"]},
    **{c: 3 for c in ["Boukoumbé", "Cobly", "Matéri", "Natitingou", "Tanguiéta", "Toucountouna"]},
}
POLE_BY_DEPARTMENT = {"Borgou": 4, "Donga": 4, "Collines": 4, "Zou": 5, "Couffo": 5, "Plateau": 6,
                      "Ouémé": 7, "Atlantique": 7, "Mono": 7, "Littoral": 7}

ALIASES = {"Dogbo": ["Dogbo-Tota", "Dogbo"], "Aguégués": ["Aguegue"],
           "Sèmè-Kpodji": ["Sèmè-Podji", "Seme-Kpodji", "Ekpè"], "Akpro-Missérété": ["Akpro-Missérété", "Missérété"],
           "Tori-Bossito": ["Tori-Bossito", "Tori Bossito"], "Za-Kpota": ["Za-Kpota", "Zakpota"],
           "Adja-Ouèrè": ["Adjaouere"], "Péhunco": ["Pehonko"], "Toucountouna": ["Toukountouna"], "Zogbodomey": ["Zogbodome"], "Sô-Ava": ["So-Ava", "Sô-Ava"], "N'Dali": ["N'Dali", "Ndali"]}


# Absent from the geocoder: approximate coordinates of the commune seat, flagged in the output.
MANUAL = {"Ifangni": (6.649, 2.720), "Za-Kpota": (7.218, 2.200), "Comè": (6.408, 1.882),
          "Adjohoun": (6.711, 2.494), "Djakotomey": (6.900, 1.720)}


def strip(s):
    return "".join(ch for ch in unicodedata.normalize("NFD", s) if unicodedata.category(ch) != "Mn")


ADMIN1 = {"Atacora": ("atacora", "atakora"), "Couffo": ("couffo", "kouffo")}


def dept_token(dept):
    return ADMIN1.get(dept, (strip(dept).lower(),))


def geocode(name, dept):
    for q in ALIASES.get(name, []) + [name, strip(name), strip(name).replace("-", " ")]:
        url = "https://geocoding-api.open-meteo.com/v1/search?" + urllib.parse.urlencode(
            {"name": q, "count": 10, "language": "fr", "format": "json", "countryCode": "BJ"})
        with urllib.request.urlopen(url, timeout=20) as r:
            results = json.load(r).get("results") or []
        results = [x for x in results if any(tok in strip(x.get("admin1", "")).lower() for tok in dept_token(dept))]
        if results:
            best = sorted(results, key=lambda x: -(x.get("population") or 0))[0]
            return round(best["latitude"], 4), round(best["longitude"], 4), q, best.get("admin1", "")
        time.sleep(0.2)
    return None


def main():
    out, missing = [], []
    for dept, communes in DEPARTMENTS.items():
        for name in communes:
            if name in MANUAL:
                lat, lon = MANUAL[name]
                out.append({"name": name, "department": dept, "pole": POLE_BY_COMMUNE.get(name, POLE_BY_DEPARTMENT.get(dept)),
                            "lat": lat, "lon": lon, "geocodedAs": "manuel, coordonnées approximatives"})
                continue
            g = geocode(name, dept)
            if not g:
                missing.append(name)
                continue
            lat, lon, matched, admin1 = g

            if not (6.0 <= lat <= 12.5 and 0.7 <= lon <= 3.9):
                missing.append(f"{name} (hors Bénin: {lat},{lon})")
                continue
            out.append({"name": name, "department": dept,
                        "pole": POLE_BY_COMMUNE.get(name, POLE_BY_DEPARTMENT.get(dept)),
                        "lat": lat, "lon": lon, "geocodedAs": matched})
    print(f"{len(out)} communes geocoded, missing: {missing}")
    Path(__file__).with_name("communes.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
    return 0 if len(out) == 77 and not missing else 1


if __name__ == "__main__":
    sys.exit(main())
