import { motion, AnimatePresence } from "motion/react";
import { X, Heart, MessageCircle, UserPlus, Music2, Sparkles, Check, Trash2, Wifi, WifiOff } from "lucide-react";
import { NotificationData } from "../hooks/useWebSocket";

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationData[];
  unreadCount: number;
  isConnected: boolean;
  onMarkAsRead: (id: number) => void;
  onMarkAllAsRead: () => void;
  onDeleteNotification: (id: number) => void;
  onClearAll: () => void;
}

export default function NotificationModal({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  isConnected,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onClearAll
}: NotificationModalProps) {

  const getIcon = (type: string) => {
    switch (type) {
      case "like":
        return <Heart className="w-4 h-4 text-pink-400" />;
      case "comment":
        return <MessageCircle className="w-4 h-4 text-blue-400" />;
      case "follow":
        return <UserPlus className="w-4 h-4 text-green-400" />;
      case "playlist":
        return <Music2 className="w-4 h-4 text-purple-400" />;
      case "ai":
        return <Sparkles className="w-4 h-4 text-yellow-400" />;
      default:
        return <Music2 className="w-4 h-4 text-white" />;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 flex items-start justify-end p-4 pt-16"
        onClick={onClose}
        style={{ willChange: 'opacity' }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50" style={{ willChange: 'auto' }} />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, x: 20, y: -10 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: 20, y: -10 }}
          transition={{ type: "spring", damping: 30, stiffness: 400 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-sm max-h-[70vh] overflow-hidden bg-gradient-to-br from-gray-800/95 to-gray-900/95 border border-white/20 rounded-2xl shadow-2xl"
          style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-white/10 bg-gray-800/90">
            <div className="flex items-center gap-2">
              <h2 className="text-white text-lg font-bold">알림</h2>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                  {unreadCount}
                </span>
              )}
              {/* 연결 상태 표시 */}
              <div className="flex items-center gap-1 ml-2">
                {isConnected ? (
                  <Wifi className="w-3 h-3 text-green-400" />
                ) : (
                  <WifiOff className="w-3 h-3 text-red-400" />
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllAsRead}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
                  title="모두 읽음 처리"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={onClearAll}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
                  title="모두 삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto max-h-[calc(70vh-60px)]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
                  <Music2 className="w-8 h-8 text-white/50" />
                </div>
                <p className="text-white/70 mb-1">알림이 없습니다</p>
                <p className="text-white/50 text-sm">새로운 알림이 오면 여기에 표시됩니다</p>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {notifications.map((notification) => (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    onClick={() => onMarkAsRead(notification.id)}
                    className={`p-4 hover:bg-white/10 transition-colors cursor-pointer group ${
                      !notification.isRead ? "bg-white/5" : ""
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Avatar */}
                      <div className="relative">
                        {notification.avatar && (notification.avatar.startsWith('http') || notification.avatar.startsWith('data:') || notification.avatar.startsWith('//')) ? (
                          <>
                            <img 
                              src={notification.avatar.startsWith('//') ? `https:${notification.avatar}` : notification.avatar} 
                              alt="" 
                              className="w-10 h-10 rounded-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-lg hidden">
                              👤
                            </div>
                          </>
                        ) : (
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-lg">
                            {notification.avatar || '👤'}
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gray-800/90 rounded-full flex items-center justify-center">
                          {getIcon(notification.type)}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm">
                          <span className="font-medium">{notification.title}</span>
                          <span className="text-white/70">{notification.message}</span>
                        </p>
                        <p className="text-white/50 text-xs mt-1">{notification.time}</p>
                      </div>

                      {/* Unread indicator & Delete */}
                      <div className="flex items-center gap-2">
                        {!notification.isRead && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteNotification(notification.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all"
                        >
                          <X className="w-3 h-3 text-white/50" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
