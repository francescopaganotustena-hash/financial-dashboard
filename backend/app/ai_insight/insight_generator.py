"""AI Insight Generator for RRG data commentary."""

import logging
from typing import Dict, List, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class AIInsightGenerator:
    """Generates template-based insights from RRG data."""

    # Quadrant definitions
    QUADRANT_NAMES = {
        "Leading": "Leading (outperforming with positive momentum)",
        "Weakening": "Weakening (outperforming but losing momentum)",
        "Lagging": "Lagging (underperforming with negative momentum)",
        "Improving": "Improving (underperforming but gaining momentum)",
    }

    def __init__(self):
        pass

    def generate_insights(self, rrg_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate AI insights from RRG data.

        Args:
            rrg_data: RRG response data with assets list

        Returns:
            Dictionary with summary and bullet points
        """
        assets = rrg_data.get("assets", [])
        benchmark = rrg_data.get("benchmark", "SPY")
        period = rrg_data.get("period", "daily")

        if not assets:
            return {
                "summary": "No data available for analysis.",
                "bullet_points": [],
            }

        # Categorize assets by quadrant
        quadrants = {
            "Leading": [],
            "Weakening": [],
            "Lagging": [],
            "Improving": [],
        }

        for asset in assets:
            quadrant = asset.get("quadrant", "Unknown")
            if quadrant in quadrants:
                quadrants[quadrant].append(asset)

        # Analyze momentum trends
        momentum_analysis = self._analyze_momentum(assets)

        # Generate summary
        summary = self._generate_summary(quadrants, benchmark, period, momentum_analysis)

        # Generate bullet points
        bullet_points = self._generate_bullet_points(quadrants, momentum_analysis)

        # Add rotation alerts
        rotation_alerts = self._detect_rotations(assets)
        bullet_points.extend(rotation_alerts)

        return {
            "summary": summary,
            "bullet_points": bullet_points,
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "benchmark": benchmark,
            "period": period,
        }

    def _analyze_momentum(self, assets: List[Dict]) -> Dict[str, Any]:
        """Analyze momentum trends for assets."""
        accelerators = []
        decelerators = []

        for asset in assets:
            tail = asset.get("tail", [])
            if len(tail) >= 2:
                # Compare recent momentum
                recent_momentum = tail[-1].get("rs_momentum", 0)
                previous_momentum = tail[-2].get("rs_momentum", 0)

                if recent_momentum > previous_momentum:
                    accelerators.append({
                        "symbol": asset["symbol"],
                        "change": recent_momentum - previous_momentum,
                    })
                elif recent_momentum < previous_momentum:
                    decelerators.append({
                        "symbol": asset["symbol"],
                        "change": previous_momentum - recent_momentum,
                    })

        # Sort by magnitude
        accelerators.sort(key=lambda x: x["change"], reverse=True)
        decelerators.sort(key=lambda x: x["change"], reverse=True)

        return {
            "accelerators": accelerators[:5],  # Top 5
            "decelerators": decelerators[:5],  # Top 5
        }

    def _generate_summary(
        self,
        quadrants: Dict[str, List],
        benchmark: str,
        period: str,
        momentum_analysis: Dict[str, Any],
    ) -> str:
        """Generate summary text."""
        leading_count = len(quadrants["Leading"])
        lagging_count = len(quadrants["Lagging"])
        improving_count = len(quadrants["Improving"])
        weakening_count = len(quadrants["Weakening"])

        total = leading_count + lagging_count + improving_count + weakening_count

        if total == 0:
            return "Nessun dato disponibile per l'analisi."

        # Build summary based on quadrant distribution
        parts = []

        # Market breadth
        if leading_count > lagging_count:
            parts.append(
                f"Il mercato mostra forza: {leading_count} settori su {total} stanno outperformando "
                f"il benchmark {benchmark} con momentum positivo."
            )
        elif lagging_count > leading_count:
            parts.append(
                f"Il mercato mostra debolezza: {lagging_count} settori su {total} stanno underperformando "
                f"il benchmark {benchmark} con momentum negativo."
            )
        else:
            parts.append(
                f"Il mercato è bilanciato: {leading_count} settori in leadership e {lagging_count} in lagging "
                f"rispetto a {benchmark}."
            )

        # Rotation signal
        if improving_count > 0:
            parts.append(
                f"{improving_count} settori stanno mostrando segnali di miglioramento "
                "(entrando in territorio di outperformance)."
            )

        if weakening_count > 0:
            parts.append(
                f"{weakening_count} settori stanno mostrando segnali di indebolimento "
                "(perdendo momentum relativo)."
            )

        # Momentum leaders
        if momentum_analysis["accelerators"]:
            top_accel = momentum_analysis["accelerators"][0]["symbol"]
            parts.append(f"{top_accel} sta accelerando il momentum relativo.")

        if momentum_analysis["decelerators"]:
            top_decel = momentum_analysis["decelerators"][0]["symbol"]
            parts.append(f"{top_decel} sta decelerando il momentum relativo.")

        return " ".join(parts)

    def _generate_bullet_points(
        self,
        quadrants: Dict[str, List],
        momentum_analysis: Dict[str, Any],
    ) -> List[str]:
        """Generate bullet point insights."""
        bullets = []

        # Leading sector
        if quadrants["Leading"]:
            leaders = ", ".join([a["symbol"] for a in quadrants["Leading"]])
            bullets.append(
                f"🟢 **Leader**: {leaders} - Settori in outperformance con momentum positivo. "
                f"Questi settori stanno battendo il benchmark con forza."
            )

        # Improving sectors
        if quadrants["Improving"]:
            improvers = ", ".join([a["symbol"] for a in quadrants["Improving"]])
            bullets.append(
                f"🔵 **In miglioramento**: {improvers} - Settori che stanno guadagnando momentum. "
                f"Potenziali opportunità di rotazione in entrata."
            )

        # Weakening sectors
        if quadrants["Weakening"]:
            weakeners = ", ".join([a["symbol"] for a in quadrants["Weakening"]])
            bullets.append(
                f"🟡 **In indebolimento**: {weakeners} - Settori che stanno perdendo momentum. "
                f"Monitorare per possibili rotazioni in uscita."
            )

        # Lagging sectors
        if quadrants["Lagging"]:
            laggers = ", ".join([a["symbol"] for a in quadrants["Lagging"]])
            bullets.append(
                f"🔴 **Laggards**: {laggers} - Settori in underperformance con momentum negativo. "
                f"Questi settori stanno sottoperformando il benchmark."
            )

        # Top accelerator
        if momentum_analysis["accelerators"]:
            top = momentum_analysis["accelerators"][0]
            bullets.append(
                f"📈 **Accelerazione**: {top['symbol']} ha il momentum relativo in maggiore crescita "
                f"(+{top['change']:.2f})."
            )

        # Top decelerator
        if momentum_analysis["decelerators"]:
            top = momentum_analysis["decelerators"][0]
            bullets.append(
                f"📉 **Decelerazione**: {top['symbol']} ha il momentum relativo in maggiore calo "
                f"(-{top['change']:.2f})."
            )

        return bullets

    def _detect_rotations(self, assets: List[Dict]) -> List[str]:
        """Detect quadrant rotations based on tail data."""
        alerts = []

        for asset in assets:
            tail = asset.get("tail", [])
            if len(tail) >= 2:
                current_quadrant = asset.get("quadrant", "")
                previous_point = tail[-2]
                current_point = tail[-1]

                # Simple rotation detection based on RS position
                prev_rs = previous_point.get("rs_ratio", 100)
                curr_rs = current_point.get("rs_ratio", 100)

                # Crossing the RS=100 line
                if prev_rs < 100 and curr_rs >= 100:
                    alerts.append(
                        f"🔄 **Rotazione**: {asset['symbol']} sta entrando in territorio di outperformance "
                        f"(RS Ratio crossing 100)."
                    )
                elif prev_rs >= 100 and curr_rs < 100:
                    alerts.append(
                        f"🔄 **Rotazione**: {asset['symbol']} sta entrando in territorio di underperformance "
                        f"(RS Ratio crossing 100)."
                    )

        return alerts


# Singleton instance
insight_generator = AIInsightGenerator()
