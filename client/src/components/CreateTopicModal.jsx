import { useState } from 'react';

export function CreateTopicModal({ onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('financing');

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate(title, description, category);
  };

  const categories = [
    { value: 'financing', label: '💰 融资', color: 'blue' },
    { value: 'ipo', label: '📈 上市', color: 'green' },
    { value: 'valuation', label: '💎 估值', color: 'purple' },
    { value: 'trend', label: '🔥 趋势', color: 'orange' },
    { value: 'gossip', label: '💬 八卦', color: 'pink' },
    { value: 'other', label: '📌 其他', color: 'gray' }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          发起新预测
        </h2>
        <p className="text-gray-500 mb-6">分享你对一级市场的洞察</p>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">预测主题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：燧原科技能否在2026年上市？"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-3 text-gray-700">选择分类</label>
            <div className="grid grid-cols-3 gap-3">
              {categories.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`p-3 rounded-xl border-2 transition ${
                    category === cat.value 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-center text-sm font-medium">
                    {cat.label}
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">详细说明（可选）</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="补充背景信息、判断依据等..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl resize-none focus:outline-none focus:border-blue-500 transition"
              rows="4"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold text-lg"
          >
            发布预测
          </button>
        </form>
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 text-gray-500 hover:text-gray-700 transition"
        >
          取消
        </button>
      </div>
    </div>
  );
}
