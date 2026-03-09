import { useState } from 'react';

const roles = [
  { value: 'vc', label: 'VC 投资人', emoji: '💼', desc: '基金/机构投资人' },
  { value: 'fa', label: 'FA', emoji: '🤝', desc: '财务顾问' },
  { value: 'founder', label: '创业者', emoji: '🚀', desc: '公司创始人/CEO' },
  { value: 'other', label: '其他', emoji: '👤', desc: '媒体/研究/其他' }
];

export function LoginModal({ onClose, onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('vc');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) return setError('请输入邮箱');
    if (!password.trim()) return setError('请输入密码');
    if (isRegister && password.length < 6) return setError('密码至少 6 位');

    setLoading(true);
    try {
      await onLogin(email.trim(), password, isRegister, role);
    } catch (err) {
      setError(err.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">
                {isRegister ? '创建账号' : '欢迎回来'}
              </h2>
              <p className="text-blue-100 text-sm mt-0.5">
                {isRegister ? '注册即获得 1000 积分' : '登录继续你的预测之旅'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition text-white text-xl leading-none"
            >×</button>
          </div>
        </div>

        {/* Form */}
        <div className="px-8 py-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">邮箱</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition text-sm"
                placeholder="your@email.com"
                autoComplete="email"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">密码</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition text-sm"
                  placeholder={isRegister ? '至少 6 位' : '请输入密码'}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                >
                  {showPassword ? '隐藏' : '显示'}
                </button>
              </div>
            </div>

            {/* Role Selection (Register only) */}
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">你的身份</label>
                <div className="grid grid-cols-2 gap-2">
                  {roles.map(r => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRole(r.value)}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition text-left ${
                        role === r.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <span className="text-xl shrink-0">{r.emoji}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-800">{r.label}</div>
                        <div className="text-xs text-gray-500 truncate">{r.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? '处理中...' : isRegister ? '立即注册' : '登录'}
            </button>
          </form>

          {/* Toggle */}
          <div className="mt-4 text-center">
            <span className="text-sm text-gray-500">
              {isRegister ? '已有账号？' : '还没有账号？'}
            </span>
            <button
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium ml-1"
            >
              {isRegister ? '去登录' : '免费注册'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
