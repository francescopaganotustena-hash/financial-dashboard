/**
 * AI Insight Panel Component
 *
 * Displays AI-generated commentary on RRG data including:
 * - Market summary
 * - Bullet points with sector analysis
 * - Rotation alerts
 */

import React, { useState, useEffect, useCallback } from 'react';
import './AIInsightPanel.css';
import { API_BASE_URL } from '../../config/api';

export interface InsightData {
  summary: string;
  bullet_points: string[];
  generated_at: string;
  benchmark: string;
  period: string;
}

export interface RRGAsset {
  symbol: string;
  name: string;
  quadrant: string;
  current: {
    rs_ratio: number;
    rs_momentum: number;
  };
  tail: Array<{
    date: string;
    rs_ratio: number;
    rs_momentum: number;
  }>;
}

interface AIInsightPanelProps {
  rrgData: RRGAsset[];
  benchmark?: string;
  period?: string;
  className?: string;
}

export const AIInsightPanel: React.FC<AIInsightPanelProps> = ({
  rrgData,
  benchmark = 'SPY',
  period = 'daily',
  className = '',
}) => {
  const [insight, setInsight] = useState<InsightData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsight = useCallback(async () => {
    if (!rrgData || rrgData.length === 0) {
      setInsight(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          benchmark,
          period,
          assets: rrgData,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch insights: ${response.status}`);
      }

      const data: InsightData = await response.json();
      setInsight(data);
    } catch (e) {
      console.error('[AIInsightPanel] Error fetching insight:', e);
      setError(e instanceof Error ? e.message : 'Failed to load insights');
    } finally {
      setIsLoading(false);
    }
  }, [rrgData, benchmark, period]);

  // Fetch insight when RRG data changes
  useEffect(() => {
    fetchInsight();
  }, [fetchInsight]);

  // Format timestamp
  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('it-IT', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  // Parse bullet point to extract emoji and bold text
  const parseBulletPoint = (text: string) => {
    const emojiMatch = text.match(/^([🟢🔵🟡🔴📈📉🔄]+)\s*\*\*([^*]+)\*\*:\s*(.+)/u);
    if (emojiMatch) {
      return {
        emoji: emojiMatch[1],
        category: emojiMatch[2],
        content: emojiMatch[3],
      };
    }
    return { emoji: null, category: null, content: text };
  };

  return (
    <div className={`ai-insight-panel ${className}`}>
      <div className="ai-insight-header">
        <h3>
          <span className="ai-icon">🤖</span>
          AI Insights
        </h3>
        {insight?.generated_at && (
          <span className="ai-timestamp">
            Aggiornato: {formatTime(insight.generated_at)}
          </span>
        )}
      </div>

      <div className="ai-insight-content">
        {isLoading && (
          <div className="ai-loading">
            <div className="ai-loading-skeleton">
              <div className="skeleton-line skeleton-line--full" />
              <div className="skeleton-line skeleton-line--80" />
              <div className="skeleton-line skeleton-line--60" />
            </div>
            <div className="ai-loading-text">Generazione insights...</div>
          </div>
        )}

        {error && (
          <div className="ai-error">
            <span className="ai-error-icon">⚠️</span>
            <p>{error}</p>
            <button onClick={fetchInsight} className="ai-retry-btn">
              Riprova
            </button>
          </div>
        )}

        {!isLoading && !error && insight && (
          <div className="ai-content">
            <div className="ai-summary">
              <p>{insight.summary}</p>
            </div>

            {insight.bullet_points && insight.bullet_points.length > 0 && (
              <ul className="ai-bullets">
                {insight.bullet_points.map((bullet, index) => {
                  const parsed = parseBulletPoint(bullet);
                  return (
                    <li key={index} className="ai-bullet">
                      {parsed.emoji && (
                        <span className="ai-bullet-emoji">{parsed.emoji}</span>
                      )}
                      {parsed.category && (
                        <span className="ai-bullet-category">{parsed.category}</span>
                      )}
                      <span className="ai-bullet-content">{parsed.content}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {!isLoading && !error && !insight && (
          <div className="ai-empty">
            <p>Nessun dato disponibile per l'analisi</p>
          </div>
        )}
      </div>
    </div>
  );
};
