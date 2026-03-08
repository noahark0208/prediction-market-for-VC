import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const categories = [
  { value: 'all', label: '全部', emoji: '📋' },
  { value: 'financing', label: '融资', emoji: '💰' },
  { value: 'ipo', label: '上市', emoji: '📈' },
  { value: 'valuation', label: '估值', emoji: '💎' },
  { value: 'trend', label: '趋势', emoji: '🔥' },
  { value: 'gossip', label: '八卦', emoji: '💬' },
  { value: 'other', label: '其他', emoji: '📌' }
];

const roleLabels = {
  vc: { label: 'VC', color: 'blue' },
  fa: { label: 'FA', color: 'purple' },
  founder: { label: '创业者', color: 'green' },
  other: { label: '其他', color: 'gray' }
};

export function TopicList({ topics, onSelectTopic, selectedCategory, onCategoryChange }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">🔥 热门预测</h2>
      </div>
      
      {/* 分类筛选 */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        {categories.map(cat => (
          <button
            key={cat.value}
            onClick={() => onCategoryChange(cat.value)}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition ${
              selectedCategory === cat.value
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-400'
            }`}
          >
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>
      
      <div className="grid gap-4">
        {topics.map(topic => (
          <TopicCard key={topic.id} topic={topic} onClick={() => onSelectTopic(topic)} />
        ))}
      </div>
    </div>
  );
}

function TopicCard({ topic, onClick }) {
  const total = topic.yes_votes + topic.no_votes;
  const yesPercent = total > 0 ? Math.round((topic.yes_votes / total) * 100) : 50;
  const noPercent = 100 - yesPercent;
  
  const roleInfo = roleLabels[topic.creator_role] || roleLabels.other;

  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-gray-100 hover:border-blue-300 hover:shadow-xl cursor-pointer transition-all duration-300 group"
    >
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <h3 className="text-base sm:text-lg font-bold text-gray-800 group-hover:text-blue-600 transition flex-1 pr-3 sm:pr-4">
          {topic.title}
        </h3>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium bg-${roleInfo.color}-100 text-${roleInfo.color}-700`}>
            {roleInfo.label}
          </span>
          <span className="text-xs sm:text-sm text-gray-500">👥 {topic.total_participants}</span>
        </div>
      </div>
      
      {topic.description && (
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">{topic.description}</p>
      )}
      
      <div className="space-y-2 sm:space-y-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex-1 bg-gray-100 rounded-full h-2 sm:h-3 overflow-hidden">
            <div className="h-full flex">
              <div 
                className="bg-gradient-to-r from-green-400 to-green-500 transition-all duration-500" 
                style={{ width: `${yesPercent}%` }}
              />
              <div 
                className="bg-gradient-to-r from-red-400 to-red-500 transition-all duration-500" 
                style={{ width: `${noPercent}%` }}
              />
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-xl sm:text-2xl font-bold text-green-600">{yesPercent}%</span>
              <span className="text-xs sm:text-sm text-gray-500">看涨</span>
            </div>
            <div className="w-px h-4 sm:h-6 bg-gray-200"></div>
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-xl sm:text-2xl font-bold text-red-600">{noPercent}%</span>
              <span className="text-xs sm:text-sm text-gray-500">看跌</span>
            </div>
          </div>
          <span className="text-xs text-gray-400">
            {new Date(topic.created_at).toLocaleDateString('zh-CN')}
          </span>
        </div>
      </div>
    </div>
  );
}
