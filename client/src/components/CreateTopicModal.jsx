import { useState } from 'react';

const categories = [
  { value: 'financing', label: '融资', emoji: '💰' },
  { value: 'ipo', label: '上市', emoji: '📈' },
  { value: 'valuation', label: '估值', emoji: '💎' },
  { value: 'trend', label: '趋势', emoji: '🔥' },
  { value: 'gossip', label: '八卦', emoji: '💬' },
  { value: 'other', label: '其他', emoji: '📌' }
];

export function CreateTopicModal({ onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('financing');
  const [settlementDate, setSettlementDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return setError('请填写预测主题');
    setError('');
    setLoading(true);
    try {
      await onCreate(title.trim(), description.trim(), category, settlementDate || null);
    } catch (err) {
      setError(err.message || '创建失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">发起新预测</h2>
              <p className="text-blue-100 text-sm mt-0.5">分享你对一级市场的洞察</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition text-white text-xl"
            >×</button>
          </div>
        </div>

        {/* Form */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                预测主题 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：燧原科技能否在2026年上市？"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition text-sm"
                maxLength={100}
                required
              />
              <div className="text-xs text-gray-400 mt-1 text-right">{title.length}/100</div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">话题分类</label>
              <div className="grid grid-cols-3 gap-2">
                {categories.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`py-2 px-3 rounded-xl border-2 transition text-sm font-medium ${
                      category === cat.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                详细说明 <span className="text-gray-400 font-normal">（可选）</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="补充背景信息、判断依据、数据来源等..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl resize-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition text-sm"
                rows="3"
                maxLength={500}
              />
            </div>

            {/* Settlement Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                预计结算日期 <span className="text-gray-400 font-normal">（可选）</span>
              </label>
              <input
                type="date"
                value={settlementDate}
                onChange={(e) => setSettlementDate(e.target.value)}
                min={minDateStr}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">到期后管理员可手动结算，胜者瓜分积分</p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <span>⚠️</span><span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? '发布中...' : '🚀 发布预测'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
