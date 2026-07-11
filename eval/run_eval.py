"""Run the evaluation harness over eval/scenarios.json.

Usage:
    python eval/run_eval.py
    python eval/run_eval.py --json   # machine-readable output
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from acr_assistant.pipeline import ConsultPipeline  # noqa: E402

from metrics import EvalReport, score_scenario  # noqa: E402


def _color(text: str, ok: bool) -> str:
    if not sys.stdout.isatty():
        return text
    return f"\033[92m{text}\033[0m" if ok else f"\033[91m{text}\033[0m"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", action="store_true", help="emit JSON only")
    parser.add_argument(
        "--scenarios",
        default=str(Path(__file__).parent / "scenarios.json"),
        help="path to scenarios JSON",
    )
    args = parser.parse_args()

    pipeline = ConsultPipeline.from_settings()
    valid_ids = pipeline._valid_chunk_ids
    scenarios = json.loads(Path(args.scenarios).read_text(encoding="utf-8"))["scenarios"]

    outcomes = []
    for s in scenarios:
        result = pipeline.run(s["scenario"])
        outcome = score_scenario(s, result, valid_ids)
        outcomes.append(outcome)

    report = EvalReport(outcomes=outcomes)
    summary = report.summary()

    if args.json:
        print(json.dumps({
            "summary": summary,
            "outcomes": [o.__dict__ for o in outcomes],
        }, indent=2, default=lambda o: o.__dict__))
        return 0

    # Human-readable
    print()
    print("=" * 78)
    print("ACR Consult Assistant — Evaluation Harness")
    print("=" * 78)
    for o in outcomes:
        d = o.detail
        head = f"[{o.scenario_id}]"
        print(f"\n{head}")
        print(f"  topic       : expected={d['expected_topic']}   got={d['got_topic']}   "
              f"{_color('OK' if o.topic_correct else 'MISS', o.topic_correct)}")
        print(f"  variant     : expected={d['expected_variant']}   got={d['got_variant']}   "
              f"{_color('OK' if o.variant_correct else 'MISS', o.variant_correct)}")
        print(f"  top proc    : expected={d['expected_top_procedure']!r}   got={d['got_top_procedure']!r}   "
              f"{_color('OK' if o.top_procedure_correct else 'MISS', o.top_procedure_correct)}")
        print(f"  concordance : {o.appropriateness_concordance:.2f}   "
              f"citation fid: {o.citation_fidelity:.2f}   recs: {d['n_recs']}")
        if d["rejected"]:
            print(f"  rejected    : {d['rejected']}")

    print()
    print("-" * 78)
    print("SUMMARY")
    print("-" * 78)
    print(f"  scenarios                     : {int(summary['n'])}")
    print(f"  topic_accuracy                : {summary['topic_accuracy']*100:5.1f}%")
    print(f"  variant_accuracy              : {summary['variant_accuracy']*100:5.1f}%")
    print(f"  top_procedure_accuracy        : {summary['top_procedure_accuracy']*100:5.1f}%")
    print(f"  appropriateness_concordance   : {summary['appropriateness_concordance']*100:5.1f}%")
    print(f"  citation_fidelity             : {summary['citation_fidelity']*100:5.1f}%")
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
