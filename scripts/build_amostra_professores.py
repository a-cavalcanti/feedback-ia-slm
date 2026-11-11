#!/usr/bin/env python3
"""Gera amostra estratificada para avaliação humana (GitHub Pages) e referência IA."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CSV = (
    REPO_ROOT
    / "resultado_rubrica"
    / "prova-tecnologia-results-1500-rubrica-16dim-consolidado.csv"
)
DEFAULT_ITEMS_JSON = REPO_ROOT / "docs" / "data" / "items.json"
DEFAULT_MANIFEST = REPO_ROOT / "dados-professores" / "amostra_manifest.csv"
DEFAULT_REF_IA = REPO_ROOT / "dados-professores" / "referencia_ia.csv"

DIMENSOES_CONTEUDO = [
    "alinhamento_objetivos",
    "especificidade",
    "tom_motivacional",
    "pontos_fortes",
    "pontos_fracos",
    "legibilidade",
]

CASE_COLS = ["modelo", "prompt_variant", "pergunta", "resposta_aluno", "feedback"]


def extrair_scores_conteudo_likert(valor) -> dict[str, int] | None:
    """Extrai scores das 6 dimensões de conteúdo e converte 0–2 → Likert 1–3."""
    try:
        if pd.isna(valor):
            return None
        dados = json.loads(valor) if isinstance(valor, str) else valor
        if isinstance(dados, dict) and "erro" in dados:
            return None
        conteudo = dados.get("conteudo", {})
        scores: dict[str, int] = {}
        for dim in DIMENSOES_CONTEUDO:
            info = conteudo.get(dim)
            if info is None and dim == "pontos_fracos":
                info = conteudo.get("pontos_fraços")
            if info is None:
                return None
            scores[dim] = int(info["score"]) + 1
        return scores
    except (json.JSONDecodeError, TypeError, KeyError, ValueError):
        return None


def stable_case_key(row: pd.Series) -> str:
    payload = "|".join(str(row[c]) for c in CASE_COLS)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def assign_item_ids(df_cases: pd.DataFrame) -> pd.DataFrame:
    df = df_cases.copy()
    df = df.sort_values(CASE_COLS).reset_index(drop=True)
    df["item_id"] = [f"TEC-{i:04d}" for i in range(1, len(df) + 1)]
    df["case_key"] = df.apply(stable_case_key, axis=1)
    return df


def stratified_sample(
    df_cases: pd.DataFrame, n_per_cell: int, seed: int
) -> pd.DataFrame:
    parts = []
    for (modelo, prompt), group in df_cases.groupby(["modelo", "prompt_variant"]):
        n = min(n_per_cell, len(group))
        parts.append(group.sample(n=n, random_state=seed))
    return pd.concat(parts, ignore_index=True).sort_values("item_id")


def build_referencia_ia(df: pd.DataFrame, case_to_item: dict[str, str]) -> pd.DataFrame:
    rows = []
    for _, row in df.iterrows():
        case_key = stable_case_key(row)
        item_id = case_to_item.get(case_key)
        if item_id is None:
            continue
        scores = extrair_scores_conteudo_likert(row.get("analise_feedback"))
        if scores is None:
            continue
        entry = {
            "item_id": item_id,
            "juiz": row["juiz"],
            "modelo": row["modelo"],
            "prompt_variant": row["prompt_variant"],
        }
        for dim in DIMENSOES_CONTEUDO:
            entry[f"likert_{dim}"] = scores[dim]
        rows.append(entry)
    ref = pd.DataFrame(rows)
    if ref.empty:
        return ref
    return ref.sort_values(["item_id", "juiz"]).reset_index(drop=True)


def item_record(row: pd.Series) -> dict:
    return {
        "item_id": row["item_id"],
        "modelo": row["modelo"],
        "prompt_variant": row["prompt_variant"],
        "disciplina": row["disciplina"] if pd.notna(row.get("disciplina")) else "",
        "pergunta": row["pergunta"],
        "resposta_aluno": row["resposta_aluno"],
        "explicacao": row["explicacao"] if pd.notna(row.get("explicacao")) else "",
        "feedback": row["feedback"],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    parser.add_argument("--n-per-cell", type=int, default=5)
    parser.add_argument("--seed", type=int, default=123)
    parser.add_argument("--items-json", type=Path, default=DEFAULT_ITEMS_JSON)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--referencia-ia", type=Path, default=DEFAULT_REF_IA)
    parser.add_argument("--all-cases", action="store_true", help="Incluir todos os casos (sem amostragem)")
    args = parser.parse_args()

    df = pd.read_csv(args.csv)
    # Um registro por caso (juízes duplicam linhas)
    df_cases = df.drop_duplicates(subset=CASE_COLS, keep="first").copy()
    df_cases = assign_item_ids(df_cases)

    case_to_item = dict(zip(df_cases["case_key"], df_cases["item_id"]))

    if args.all_cases:
        sample = df_cases
    else:
        sample = stratified_sample(df_cases, args.n_per_cell, args.seed)

    manifest_cols = [
        "item_id",
        "case_key",
        "modelo",
        "prompt_variant",
        "disciplina",
        "pergunta",
        "resposta_aluno",
        "feedback",
    ]
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    sample[manifest_cols].to_csv(args.manifest, index=False, encoding="utf-8-sig")

    items = {
        "meta": {
            "n_items": len(sample),
            "n_per_cell": None if args.all_cases else args.n_per_cell,
            "seed": args.seed,
            "source_csv": str(args.csv.relative_to(REPO_ROOT)),
        },
        "items": [item_record(row) for _, row in sample.iterrows()],
    }
    args.items_json.parent.mkdir(parents=True, exist_ok=True)
    args.items_json.write_text(
        json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    sampled_keys = set(sample["case_key"])
    df_ref_src = df[df.apply(stable_case_key, axis=1).isin(sampled_keys)]
    ref_ia = build_referencia_ia(df_ref_src, case_to_item)
    ref_ia.to_csv(args.referencia_ia, index=False, encoding="utf-8-sig")

    print(f"Itens públicos: {args.items_json} ({len(sample)} itens)")
    print(f"Manifesto: {args.manifest}")
    print(f"Referência IA: {args.referencia_ia} ({len(ref_ia)} linhas juiz×item)")


if __name__ == "__main__":
    main()
