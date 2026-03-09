import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function VoteTrend({ topicId }) {
  const [trend, setTrend] = useState([]);

  useEffect(() => {
    fetchTrend();
  }, [topicId]);

  const fetchTrend = async () => {
    try {
      const res = await axios.get(`${API_URL}/topics/${topicId}/trend`);
      setTrend(res.data);
    } catch {}
  };

  if (trend.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-base font-bold text-gray-900 mb-4">📊 投票趋势</h3>
        <div className="text-center py-8 text-gray-400 text-sm">
          <div className="text-2xl mb-2">📈</div>
          暂无趋势数据，投票后将显示
        </div>
      </div>
    );
  }

  // 只展示最近 20 条快照，避免过长
  const displayTrend = trend.slice(-20);

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-gray-900">📊 投票趋势</h3>
        <span className="text-xs text-gray-400">{trend.length} 条记录</span>
      </div>
      <div className="space-y-1.5">
        {displayTrend.map((snapshot, idx) => {
          const total = snapshot.yes_votes + snapshot.no_votes;
          const yesPercent = total > 0 ? Math.round((snapshot.yes_votes / total) * 100) : 50;

          return (
            <div key={idx} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-28 shrink-0 text-right">
                {formatTime(snapshot.snapshot_time)}
              </span>
              <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden flex">
                <div
                  className="bg-green-500 flex items-center justify-center transition-all duration-300"
                  style={{ width: `${yesPercent}%` }}
                >
                  {yesPercent > 20 && (
                    <span className="text-white text-xs font-bold">{yesPercent}%</span>
                  )}
                </div>
                <div
                  className="bg-red-400 flex items-center justify-center transition-all duration-300"
                  style={{ width: `${100 - yesPercent}%` }}
                >
                  {100 - yesPercent > 20 && (
                    <span className="text-white text-xs font-bold">{100 - yesPercent}%</span>
                  )}
                </div>
              </div>
              <span className="text-xs text-gray-400 w-10 shrink-0 text-right">{total}人</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-500"></div>
          <span>看涨</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-400"></div>
          <span>看跌</span>
        </div>
      </div>
    </div>
  );
}
