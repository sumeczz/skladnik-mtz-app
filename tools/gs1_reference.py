#!/usr/bin/env python3
"""
Referenční implementace GS1 pomocných funkcí pro projekt "Skladník MTZ".

Účel:
  * zdroj pravdy pro testovací vektory (docs/test-vectors/gs1_vectors.json),
  * ověření, že Dart implementace (lib/core/gs1/) dává stejné výsledky.

Rozsah je záměrně omezený na AI používané ve skladu (viz docs/04-gs1-128-reference.md).
Neznámý AI = chyba UNKNOWN_AI (aplikace pak může kód přijmout jako "raw", pokud to nastavení dovolí).

Použití:
  python tools/gs1_reference.py --selftest
  python tools/gs1_reference.py --write-vectors docs/test-vectors/gs1_vectors.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys

GS = "\x1d"  # ASCII 29, oddělovač proměnlivých polí (FNC1 v datech)

# AI -> přesná délka dat
FIXED = {
    "00": 18, "01": 14, "02": 14,
    "11": 6, "13": 6, "15": 6, "17": 6,
    "20": 2, "410": 13,
}
for _n in range(6):  # 3100..3105 čistá hmotnost v kg (n = pozice desetinné čárky)
    FIXED[f"310{_n}"] = 6

# AI -> maximální délka dat
VARIABLE = {
    "10": 20, "21": 20, "30": 8, "37": 8,
    "240": 30, "241": 30, "400": 30, "401": 30,
    "420": 20, "421": 12, "90": 30,
}
for _n in range(91, 100):  # 91..99 interní informace firmy
    VARIABLE[str(_n)] = 90

NUMERIC = {"00", "01", "02", "11", "13", "15", "17", "20", "30", "37", "410"} | {
    f"310{n}" for n in range(6)
}
DATE_AIS = {"11", "13", "15", "17"}
CHECKED = {"00", "01", "02", "410"}  # mají kontrolní číslici (mod 10)

# GS1 znaková sada 82 (číslice, písmena a vybrané znaky)
CSET82 = re.compile(r"[0-9A-Za-z!\"%&'()*+,\-./:;<=>?_ ]+")


class Gs1Error(Exception):
    def __init__(self, code: str, detail: str = ""):
        super().__init__(f"{code}: {detail}" if detail else code)
        self.code = code
        self.detail = detail


def check_digit(payload: str) -> str:
    """Kontrolní číslice GS1 (mod 10). Váhy 3,1,3,1... počítáno zprava od posledního znaku payloadu."""
    if not re.fullmatch(r"[0-9]+", payload):
        raise Gs1Error("NON_NUMERIC", payload)
    total = sum(int(ch) * (3 if i % 2 == 0 else 1) for i, ch in enumerate(reversed(payload)))
    return str((10 - total % 10) % 10)


def build_sscc(extension: int, company_prefix: str, serial: int) -> str:
    """SSCC = extension(1) + company prefix + serial reference (spolu prefix+serial = 16 číslic) + kontrolní číslice."""
    if not 0 <= extension <= 9:
        raise Gs1Error("BAD_EXTENSION", str(extension))
    if not re.fullmatch(r"[0-9]{6,12}", company_prefix):
        raise Gs1Error("BAD_PREFIX", company_prefix)
    serial_len = 16 - len(company_prefix)
    if serial < 0 or serial >= 10 ** serial_len:
        raise Gs1Error("SERIAL_OVERFLOW", f"max {10 ** serial_len - 1}")
    payload = f"{extension}{company_prefix}{str(serial).zfill(serial_len)}"
    return payload + check_digit(payload)


def _match_ai(s: str, i: int):
    for length in (2, 3, 4):  # AI jsou prefix-free, nejkratší shoda je správná
        cand = s[i:i + length]
        if len(cand) == length and (cand in FIXED or cand in VARIABLE):
            return cand
    return None


def _validate(ai: str, value: str) -> None:
    if not CSET82.fullmatch(value):
        raise Gs1Error("BAD_CHARSET", ai)
    if ai in NUMERIC and not re.fullmatch(r"[0-9]+", value):
        raise Gs1Error("NON_NUMERIC", ai)
    if ai in DATE_AIS:
        mm, dd = int(value[2:4]), int(value[4:6])
        if not (1 <= mm <= 12 and 0 <= dd <= 31):  # DD=00 = poslední den v měsíci
            raise Gs1Error("BAD_DATE", ai)
    if ai in CHECKED and value[-1] != check_digit(value[:-1]):
        raise Gs1Error("BAD_CHECK_DIGIT", ai)


def human_readable_to_element_string(text: str) -> str:
    pairs = re.findall(r"\((\d{2,4})\)([^()]*)", text.strip())
    rebuilt = "".join(f"({a}){v}" for a, v in pairs)
    if not pairs or rebuilt != text.strip():
        raise Gs1Error("UNKNOWN_AI", text)
    out = []
    for idx, (ai, value) in enumerate(pairs):
        out.append(ai + value)
        if ai in VARIABLE and idx != len(pairs) - 1:
            out.append(GS)
    return "".join(out)


def parse(data: str) -> list[tuple[str, str]]:
    """Parsuje element string (s GS) nebo lidsky čitelný zápis '(01)...(10)...'. Vrací [(AI, hodnota), ...]."""
    if data.startswith("]C1"):  # symbology identifier GS1-128
        data = data[3:]
    if data.lstrip().startswith("("):
        data = human_readable_to_element_string(data)
    out: list[tuple[str, str]] = []
    i, n = 0, len(data)
    while i < n:
        if data[i] == GS:
            i += 1
            continue
        ai = _match_ai(data, i)
        if ai is None:
            raise Gs1Error("UNKNOWN_AI", data[i:i + 4])
        i += len(ai)
        if ai in FIXED:
            ln = FIXED[ai]
            value = data[i:i + ln]
            if len(value) != ln or GS in value:
                raise Gs1Error("BAD_LENGTH", ai)
            i += ln
        else:
            j = data.find(GS, i)
            j = n if j == -1 else j
            value = data[i:j]
            if not value:
                raise Gs1Error("EMPTY_VALUE", ai)
            if len(value) > VARIABLE[ai]:
                raise Gs1Error("TOO_LONG", ai)
            i = j
        _validate(ai, value)
        if any(a == ai for a, _ in out):
            raise Gs1Error("DUPLICATE_AI", ai)
        out.append((ai, value))
    if not out:
        raise Gs1Error("EMPTY")
    return out


def to_element_string(pairs: list[tuple[str, str]]) -> str:
    parts = []
    for idx, (ai, value) in enumerate(pairs):
        parts.append(ai + value)
        if ai in VARIABLE and idx != len(pairs) - 1:
            parts.append(GS)
    return "".join(parts)


def to_human_readable(pairs: list[tuple[str, str]]) -> str:
    return "".join(f"({ai}){value}" for ai, value in pairs)


# --------------------------------------------------------------------------- vectors
def build_vectors() -> dict:
    check_cases = [
        # (payload, očekávaná číslice nebo None = jen dopočítat, poznámka)
        ("400638133393", "1", "EAN-13 4006381333931 (veřejně známý příklad)"),
        ("590123412345", "7", "EAN-13 5901234123457 (veřejně známý příklad)"),
        ("950110153000", "3", "GTIN-13 9501101530003 (vzorový GS1 příklad)"),
        ("0950110153000", "3", "GTIN-14 s úvodní nulou: 09501101530003"),
        ("10614141234567890", None, "SSCC payload (17 číslic)"),
        ("00000000000000000", "0", "samé nuly"),
    ]
    vectors: dict = {
        "_comment": "Generováno tools/gs1_reference.py. Neupravuj ručně.",
        "check_digit": [],
    }
    for payload, expected, note in check_cases:
        got = check_digit(payload)
        if expected is not None:
            assert got == expected, (payload, got, expected)
        vectors["check_digit"].append({"payload": payload, "expected": got, "note": note})

    sscc_cases = [
        (1, "0614141", 234567890, "prefix 7 číslic, serial 9 číslic"),
        (0, "8591234", 1, "FIKTIVNÍ prefix, serial 1"),
        (3, "85912345678", 1, "prefix 11 číslic, serial 5 číslic"),
        (9, "859123456", 9999999, "prefix 9 číslic, serial 7 číslic"),
    ]
    vectors["sscc_build"] = []
    for ext, prefix, serial, note in sscc_cases:
        sscc = build_sscc(ext, prefix, serial)
        assert len(sscc) == 18 and sscc[-1] == check_digit(sscc[:-1])
        vectors["sscc_build"].append(
            {"extension": ext, "company_prefix": prefix, "serial": serial, "expected": sscc, "note": note}
        )

    vectors["sscc_build_errors"] = []
    error_cases = [
        ((1, "0614141", 10 ** 9), "SERIAL_OVERFLOW"),
        ((10, "0614141", 1), "BAD_EXTENSION"),
        ((1, "12345", 1), "BAD_PREFIX"),
    ]
    for args, code in error_cases:
        try:
            build_sscc(*args)
        except Gs1Error as e:
            assert e.code == code, (args, e.code, code)
        else:
            raise AssertionError(args)
        vectors["sscc_build_errors"].append(
            {"extension": args[0], "company_prefix": args[1], "serial": args[2], "expected_error": code}
        )

    sscc_example = build_sscc(1, "0614141", 234567890)
    valid_inputs = [
        (f"(00){sscc_example}", "SSCC v lidsky čitelném zápisu"),
        (f"00{sscc_example}", "SSCC jako element string"),
        (f"]C1{'00' + sscc_example}", "SSCC s prefixem symbology identifier ]C1"),
        ("01095011015300031714070410AB-123", "GTIN + expirace + šarže (šarže na konci, bez GS)"),
        ("(01)09501101530003(17)261231(10)LOT-7(21)SN9", "lidsky čitelný zápis, dvě proměnlivá pole"),
        ("10LOT42" + GS + "21SN0001", "dvě proměnlivá pole oddělená GS"),
        ("(3103)001500", "čistá hmotnost 1,500 kg (AI 3103)"),
        ("(400)PO-2026-001(90)INT-A", "číslo objednávky + interní informace"),
        ("(17)260200", "DD=00 = poslední den v měsíci je povoleno"),
    ]
    vectors["parse_valid"] = []
    for raw, note in valid_inputs:
        pairs = parse(raw)
        vectors["parse_valid"].append(
            {
                "input": raw,
                "note": note,
                "ai": [{"ai": a, "value": v} for a, v in pairs],
                "element_string": to_element_string(pairs),
                "human_readable": to_human_readable(pairs),
            }
        )

    invalid_inputs = [
        (f"(00){sscc_example[:-1]}9" if sscc_example[-1] != "9" else f"(00){sscc_example[:-1]}0", "BAD_CHECK_DIGIT"),
        ("(01)0950110153000", "BAD_LENGTH"),
        ("(17)261331", "BAD_DATE"),
        ("(10)" + "A" * 21, "TOO_LONG"),
        ("(88)ABC", "UNKNOWN_AI"),
        ("(11)26AB01", "NON_NUMERIC"),
        ("(10)AB^CD", "BAD_CHARSET"),
        ("(10)A(10)B", "DUPLICATE_AI"),
        ("(10)", "EMPTY_VALUE"),
        ("", "EMPTY"),
    ]
    vectors["parse_invalid"] = []
    for raw, code in invalid_inputs:
        try:
            parse(raw)
        except Gs1Error as e:
            assert e.code == code, (raw, e.code, code)
        else:
            raise AssertionError(f"mělo selhat: {raw!r}")
        vectors["parse_invalid"].append({"input": raw, "expected_error": code})
    return vectors


def selftest() -> None:
    v = build_vectors()
    print(
        "OK:",
        len(v["check_digit"]), "check_digit,",
        len(v["sscc_build"]), "sscc_build,",
        len(v["parse_valid"]), "parse_valid,",
        len(v["parse_invalid"]), "parse_invalid",
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--write-vectors", metavar="PATH")
    args = ap.parse_args()
    if args.write_vectors:
        with open(args.write_vectors, "w", encoding="utf-8") as f:
            json.dump(build_vectors(), f, ensure_ascii=True, indent=2)
            f.write("\n")
        print("Zapsáno:", args.write_vectors)
        return 0
    selftest()
    return 0


if __name__ == "__main__":
    sys.exit(main())
