import { useState } from 'react';

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
  vc: { label: 'VC', bg: 'bg-blue-100', text: 'text-blue-700' },
  fa: { label: 'FA', bg: 'bg-purple-100', text: 'text-purple-700' },
  founder: { label: '创业者', bg: 'bg-green-100', text: 'text-green-700' },
  other: { label: '其他', bg: 'bg-gray-100', text: 'text-gray-600' }
};

export function TopicList({ topics, onSelectTopic, selectedCategory, onCategoryChange, searchQuery, onSearch, sortMode, onSortChange }) {
  return (
    <div className="space-y-5">
      {/* Search Bar */}
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="搜索预测话题..."
          className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition text-sm"
        />
        {searchQuery && (
          <button
            onClick={() => onSearch('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
          >×</button>
        )}
      </div>

      {/* Filters Row */}
      <div className="flex items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 flex-1 min-w-0">
          {categories.map(cat => (
            <button
              key={cat.value}
              onClick={() => onCategoryChange(cat.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition shrink-0 ${
                selectedCategory === cat.value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>

        {/* Sort Toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 shrink-0">
          <button
            onClick={() => onSortChange('hot')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${
              sortMode === 'hot' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >🔥 热度</button>
          <button
            onClick={() => onSortChange('new')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${
              sortMode === 'new' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >🕐 最新</button>
        </div>
      </div>

      {/* Topic Count */}
      {searchQuery && (
        <p className="text-sm text-gray-500">
          找到 <span className="font-semibold text-gray-800">{topics.length}</span> 个相关话题
        </p>
      )}

      {/* Topic Grid */}
      <div className="grid gap-3">
        {topics.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-gray-600 font-medium">没有找到相关话题</div>
            <div className="text-gray-400 text-sm mt-1">换个关键词试试吧</div>
          </div>
        ) : (
          topics.map(topic => (
            <TopicCard key={topic.id} topic={topic} onClick={() => onSelectTopic(topic)} />
          ))
        )}
      </div>
    </div>
  );
}

function TopicCard({ topic, onClick }) {
  const total = topic.yes_votes + topic.no_votes;
  const yesPercent = total > 0 ? Math.round((topic.yes_votes / total) * 100) : 50;
  const noPercent = 100 - yesPercent;
  const roleInfo = roleLabels[topic.creator_role] || roleLabels.other;
  const isSettled = topic.status === 'settled';

  const categoryEmoji = {
    financing: '💰', ipo: '📈', valuation: '💎',
    trend: '🔥', gossip: '💬', other: '📌'
  }[topic.category] || '📌';

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border transition-all duration-200 cursor-pointer group ${
        isSettled
          ? 'border-gray-200 opacity-80 hover:opacity-100 hover:border-gray-300'
          : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
      }`}
    >
      <div className="p-5">
        {/* Top Row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-xs text-gray-400">{categoryEmoji}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleInfo.bg} ${roleInfo.text}`}>
                {roleInfo.label}
              </span>
              {isSettled && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  topic.settlement_result === 'yes'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  已结算 · {topic.settlement_result === 'yes' ? '看涨成立' : '看跌成立'}
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition leading-snug line-clamp-2">
              {topic.title}
            </h3>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-bold text-gray-700">{topic.total_participants}</div>
            <div className="text-xs text-gray-400">参与</div>
          </div>
        </div>

        {topic.description && (
          <p className="text-xs text-gray-500 mb-3 line-clamp-1 leading-relaxed">{topic.description}</p>
        )}

        {/* Progress Bar */}
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div className="h-full flex">
            <div
              className="bg-green-500 transition-all duration-500"
              style={{ width: `${yesPercent}%` }}
            />
            <div
              className="bg-red-400 transition-all duration-500"
              style={{ width: `${noPercent}%` }}
            />
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-base font-bold text-green-600">{yesPercent}%</span>
              <span className="text-xs text-gray-400">看涨</span>
            </div>
            <div className="w-px h-3 bg-gray-200"></div>
            <div className="flex items-center gap-1">
              <span className="text-base font-bold text-red-500">{noPercent}%</span>
              <span className="text-xs text-gray-400">看跌</span>
            </div>
          </div>
          <span className="text-xs text-gray-400">
            {new Date(topic.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
    </div>
  );
}
