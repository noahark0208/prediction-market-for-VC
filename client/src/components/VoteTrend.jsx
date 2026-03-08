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
    } catch (err) {
      console.error(err);
    }
  };

  if (trend.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-lg mb-6">
        <h3 className="text-xl font-bold mb-4 text-gray-800">📊 投票趋势</h3>
        <div className="text-center py-8 text-gray-400">暂无趋势数据</div>
      </div>
    );
  }

  const maxVotes = Math.max(...trend.map(t => t.yes_votes + t.no_votes));

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-lg mb-6">
      <h3 className="text-xl font-bold mb-4 text-gray-800">📊 投票趋势</h3>
      <div className="space-y-2">
        {trend.map((snapshot, idx) => {
          const total = snapshot.yes_votes + snapshot.no_votes;
          const yesPercent = total > 0 ? Math.round((snapshot.yes_votes / total) * 100) : 50;
          const time = new Date(snapshot.snapshot_time).toLocaleString('zh-CN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          return (
            <div key={idx} className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-24">{time}</span>
              <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden flex">
                <div 
                  className="bg-gradient-to-r from-green-400 to-green-500 flex items-center justify-center text-white text-xs font-bold"
                  style={{ width: `${yesPercent}%` }}
                >
                  {yesPercent > 15 && `${yesPercent}%`}
                </div>
                <div 
                  className="bg-gradient-to-r from-red-400 to-red-500 flex items-center justify-center text-white text-xs font-bold"
                  style={{ width: `${100 - yesPercent}%` }}
                >
                  {100 - yesPercent > 15 && `${100 - yesPercent}%`}
                </div>
              </div>
              <span className="text-xs text-gray-500 w-16 text-right">{total}人</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
